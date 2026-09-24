export function StatTile({ label, value, sublabel, accent }: {
  label: string; value: number | string; sublabel?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-3xl font-bold ${accent ? "text-blue-700" : ""}`}>{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-400">{sublabel}</p> : null}
    </div>
  );
}
