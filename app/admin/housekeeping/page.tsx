import { SweepButton } from "@/components/admin/SweepButton";

export default function HousekeepingPage() {
  return (
    <div className="flex flex-col gap-4">
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
