import { MARKETS } from "@/lib/constants";

export function SurveyFilterBar({ reps, current }: {
  reps: { id: string; username: string }[];
  current: Record<string, string>;
}) {
  return (
    <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs font-medium">Market
        <select name="market" defaultValue={current.market ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">Rep
        <select name="repId" defaultValue={current.repId ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">From
        <input type="date" name="from" defaultValue={current.from ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">To
        <input type="date" name="to" defaultValue={current.to ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Search
        <input name="q" defaultValue={current.q ?? ""} placeholder="Shop or customer" className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      <a href="/admin/surveys" className="rounded border border-slate-300 px-3 py-2 text-sm">Reset</a>
    </form>
  );
}
