const FIELD = "mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function SurveyFilterBar({ markets, reps, current }: {
  markets: string[];
  reps: { id: string; username: string }[];
  current: Record<string, string>;
}) {
  return (
    <form method="GET" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex flex-col text-xs font-medium text-slate-600">Market
        <select name="market" defaultValue={current.market ?? ""} className={FIELD}>
          <option value="">All</option>
          {markets.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-slate-600">Rep
        <select name="repId" defaultValue={current.repId ?? ""} className={FIELD}>
          <option value="">All</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-slate-600">From
        <input type="date" name="from" defaultValue={current.from ?? ""} className={FIELD} /></label>
      <label className="flex flex-col text-xs font-medium text-slate-600">To
        <input type="date" name="to" defaultValue={current.to ?? ""} className={FIELD} /></label>
      <label className="flex flex-1 flex-col text-xs font-medium text-slate-600" style={{ minWidth: 180 }}>Search
        <input name="q" defaultValue={current.q ?? ""} placeholder="Shop or customer" className={FIELD} /></label>
      <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
      <a href="/admin/surveys" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset</a>
    </form>
  );
}
