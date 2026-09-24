"use client";
import type { SurveyFilter } from "@/lib/adminQueries";

export function ExportButton({ filter }: { filter: SurveyFilter }) {
  const qs = new URLSearchParams();
  if (filter.market) qs.set("market", filter.market);
  if (filter.repId) qs.set("repId", filter.repId);
  if (filter.from) qs.set("from", filter.from);
  if (filter.to) qs.set("to", filter.to);
  if (filter.q) qs.set("q", filter.q);
  const href = (fmt: string) => `/admin/surveys/export?format=${fmt}&${qs.toString()}`;
  return (
    <div className="flex gap-2">
      <a href={href("csv")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Export CSV</a>
      <a href={href("xlsx")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Export Excel</a>
    </div>
  );
}
