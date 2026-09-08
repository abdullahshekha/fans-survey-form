import { createAdminSupabase } from "@/lib/supabase/admin";
import { StatTile } from "@/components/StatTile";
import { BarChartCard } from "@/components/BarChartCard";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";

export default async function AdminOverviewPage() {
  const db = createAdminSupabase();
  const { data: raw } = await db.from("surveys").select(
    "market, most_selling_fan, rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, profiles!surveys_rep_id_fkey(username)",
  );
  const surveys = (raw ?? []).map((r: any) => ({ ...r, rep_username: r.profiles?.username ?? "—" }));
  const { count: activeReps } = await db.from("profiles")
    .select("id", { count: "exact", head: true }).eq("role", "rep").eq("active", true);

  const stats = overviewStats(surveys);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total surveys" value={stats.totalSurveys} />
        <StatTile label="Active reps" value={activeReps ?? 0} />
        <StatTile label="Markets covered" value={`${stats.marketsCovered} / 12`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard title="Shop count by market" data={countByMarket(surveys)} />
        <BarChartCard title="Survey count by rep" data={countByRep(surveys)} />
        <BarChartCard title="Most selling fan" data={countMostSellingFan(surveys)} />
        <BarChartCard title="Recommended brands (30W + 50W)" data={countRecommendedBrands(surveys)} />
      </div>
    </div>
  );
}
