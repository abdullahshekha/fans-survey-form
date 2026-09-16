import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { MarketsSection } from "@/components/admin/MarketsSection";
import { SweepButton } from "@/components/admin/SweepButton";

export default async function HousekeepingPage() {
  const db = createAdminSupabase();
  const markets = await getMarkets(db);

  return (
    <div className="flex flex-col gap-8">
      <MarketsSection markets={markets} />
      <div>
        <h2 className="text-base font-semibold">Storage housekeeping</h2>
        <p className="text-sm text-slate-500">
          Removes photo and voice-note files left behind by submissions that never completed.
        </p>
      </div>
      <SweepButton />
    </div>
  );
}
