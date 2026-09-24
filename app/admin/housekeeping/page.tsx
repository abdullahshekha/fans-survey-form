import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { MarketsSection } from "@/components/admin/MarketsSection";
import { SweepButton } from "@/components/admin/SweepButton";

export default async function HousekeepingPage() {
  const db = createAdminSupabase();
  const markets = await getMarkets(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Housekeeping</h1>
      <MarketsSection markets={markets} />
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Storage housekeeping</h2>
          <p className="text-sm text-slate-500">
            Removes photo and voice-note files left behind by submissions that never completed.
          </p>
        </div>
        <SweepButton />
      </div>
    </div>
  );
}
