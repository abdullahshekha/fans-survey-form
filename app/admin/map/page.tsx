import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
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
  const base = db.from("surveys").select(
    "id, shop_name, market, gps_lat, gps_lng, created_at, profiles!surveys_rep_id_fkey(username)",
  );
  const { data } = await buildSurveyQuery(base, filter);
  const points: MapPoint[] = (data ?? []).map((r: any) => ({
    id: r.id, lat: r.gps_lat, lng: r.gps_lng, shop_name: r.shop_name, market: r.market,
    rep_username: r.profiles?.username ?? "—", created_at: r.created_at,
  }));

  return (
    <div>
      <SurveyFilterBar reps={reps ?? []} current={sp} />
      <SurveysMap points={points} />
    </div>
  );
}
