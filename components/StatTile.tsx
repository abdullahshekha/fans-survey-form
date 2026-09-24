export function StatTile({ label, value, sublabel, accent }: {
  label: string; value: number | string; sublabel?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent ? "border-gold-100 bg-gold-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-3xl font-bold ${accent ? "text-gold-700" : "text-slate-900"}`}>{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-400">{sublabel}</p> : null}
    </div>
  );
}
