import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
import { getMarkets, getMarketBoundaries } from "@/lib/markets";
import { pakFansHoldByMarket } from "@/lib/aggregations";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveysMap, type MapPoint } from "@/components/SurveysMap";

export default async function AdminMapPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter: SurveyFilter & { all: true } = {
    all: true,
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
  };
  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const markets = await getMarkets(db);
  const boundaries = await getMarketBoundaries(db);
  const base = db.from("surveys").select(
    "id, shop_name, market, gps_lat, gps_lng, created_at, most_selling_fan, rec_30w_1, rec_50w_1, profiles!surveys_rep_id_fkey(username)",
  );
  const { data } = await buildSurveyQuery(base, filter);
  const rows = data ?? [];
  const points: MapPoint[] = rows.map((r: any) => ({
    id: r.id, lat: r.gps_lat, lng: r.gps_lng, shop_name: r.shop_name, market: r.market,
    rep_username: r.profiles?.username ?? "—", created_at: r.created_at,
  }));

  // "Better hold" is computed from the unfiltered citywide baseline, then
  // shown only for markets that still have surveys in the current filter —
  // otherwise a market filter would silently change what "citywide" means.
  const { data: allForHold } = await db
    .from("surveys")
    .select("market, most_selling_fan, rec_30w_1, rec_50w_1");
  const hold = pakFansHoldByMarket(allForHold ?? [], markets.map((m) => m.name));
  const visibleMarkets = new Set(points.map((p) => p.market));
  const betterHoldMarkets = new Set(hold.filter((h) => h.betterHold && visibleMarkets.has(h.market)).map((h) => h.market));

  return (
    <div>
      <SurveyFilterBar markets={markets.map((m) => m.name)} reps={reps ?? []} current={sp} />
      <SurveysMap points={points} markets={markets} boundaries={boundaries} betterHoldMarkets={betterHoldMarkets} />
    </div>
  );
}
