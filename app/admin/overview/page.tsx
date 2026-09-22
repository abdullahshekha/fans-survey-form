import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { StatTile } from "@/components/StatTile";
import { BarChartCard } from "@/components/BarChartCard";
import {
  countByMarket, countMostSellingFan, countRec30w1, countRec30w2, countRec50w1, countRec50w2, overviewStats,
} from "@/lib/aggregations";

const PAK_FANS = "Pak Fans";

export default async function AdminOverviewPage() {
  const db = createAdminSupabase();
  const markets = await getMarkets(db);
  const marketNames = markets.map((m) => m.name);
  const { data: raw } = await db.from("surveys").select(
    "market, most_selling_fan, most_selling_fan_other, rec_30w_1, rec_30w_1_other, rec_30w_2, rec_30w_2_other, rec_50w_1, rec_50w_1_other, rec_50w_2, rec_50w_2_other",
  );
  const surveys = raw ?? [];
  const { count: activeReps } = await db.from("profiles")
    .select("id", { count: "exact", head: true }).eq("role", "rep").eq("active", true);

  const stats = overviewStats(surveys);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total surveys" value={stats.totalSurveys} />
        <StatTile label="Active reps" value={activeReps ?? 0} />
        <StatTile label="Markets covered" value={`${stats.marketsCovered} / ${marketNames.length}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard title="Shop count by market" data={countByMarket(surveys, marketNames)} />
        <BarChartCard title="Most selling fan" data={countMostSellingFan(surveys)} highlightLabel={PAK_FANS} />
        <BarChartCard title="1st recommendation (30W)" data={countRec30w1(surveys)} highlightLabel={PAK_FANS} />
        <BarChartCard title="2nd recommendation (30W)" data={countRec30w2(surveys)} highlightLabel={PAK_FANS} />
        <BarChartCard title="1st recommendation (50W)" data={countRec50w1(surveys)} highlightLabel={PAK_FANS} />
        <BarChartCard title="2nd recommendation (50W)" data={countRec50w2(surveys)} highlightLabel={PAK_FANS} />
      </div>
    </div>
  );
}
