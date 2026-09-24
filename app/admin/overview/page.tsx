import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { StatTile } from "@/components/StatTile";
import { BarChartCard } from "@/components/BarChartCard";
import { PieChartCard } from "@/components/PieChartCard";
import {
  countByMarket, countMostSellingFan, countRec30w1, countRec30w2, countRec50w1, countRec50w2, overviewStats, shareOf,
} from "@/lib/aggregations";
import { KARACHI_ANNUAL_FAN_MARKET_UNITS } from "@/lib/constants";

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
  const mostSelling = countMostSellingFan(surveys);
  const rec30w1 = countRec30w1(surveys);
  const rec50w1 = countRec50w1(surveys);
  const pakFansMostSellingShare = shareOf(mostSelling, PAK_FANS, stats.totalSurveys);
  const pakFansEstUnits = Math.round(pakFansMostSellingShare * KARACHI_ANNUAL_FAN_MARKET_UNITS);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Overview</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Total surveys" value={stats.totalSurveys} />
        <StatTile label="Active reps" value={activeReps ?? 0} />
        <StatTile label="Markets covered" value={`${stats.marketsCovered} / ${marketNames.length}`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Pak Fans market position (estimate)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile accent label="Most-selling share" value={`${(pakFansMostSellingShare * 100).toFixed(1)}%`}
            sublabel={`${mostSelling.find((d) => d.label === PAK_FANS)?.value ?? 0} of ${stats.totalSurveys} surveyed shops`} />
          <StatTile accent label="Est. units / year" value={pakFansEstUnits.toLocaleString()}
            sublabel={`of Karachi's assumed ${(KARACHI_ANNUAL_FAN_MARKET_UNITS / 1_000_000).toFixed(1)}M-unit market`} />
          <StatTile accent label="Recommendation share" value={`${(shareOf(rec30w1, PAK_FANS, stats.totalSurveys) * 100).toFixed(1)}% / ${(shareOf(rec50w1, PAK_FANS, stats.totalSurveys) * 100).toFixed(1)}%`}
            sublabel="30W / 50W, 1st recommendation" />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Estimate = citywide most-selling share × an assumed {KARACHI_ANNUAL_FAN_MARKET_UNITS.toLocaleString()}-unit
          Karachi market (external input, not derived from this survey) — a proportional estimate, not a measured figure.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BarChartCard title="Shop count by market" data={countByMarket(surveys, marketNames)} />
        <PieChartCard title="Most selling fan" data={mostSelling} highlightLabel={PAK_FANS} />
        <PieChartCard title="1st recommendation (30W)" data={rec30w1} highlightLabel={PAK_FANS} />
        <PieChartCard title="1st recommendation (50W)" data={rec50w1} highlightLabel={PAK_FANS} />
        <PieChartCard title="2nd recommendation (30W)" data={countRec30w2(surveys)} highlightLabel={PAK_FANS} />
        <PieChartCard title="2nd recommendation (50W)" data={countRec50w2(surveys)} highlightLabel={PAK_FANS} />
      </div>
    </div>
  );
}
