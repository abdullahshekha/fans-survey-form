import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSurveysPage, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveyTable } from "@/components/admin/SurveyTable";
import { ExportButton } from "@/components/admin/ExportButton";

export default async function AdminSurveysPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter: SurveyFilter = {
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
    page: sp.page ? Math.max(0, parseInt(sp.page, 10)) : 0,
  };

  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const { rows, total } = await getSurveysPage(db, filter);
  const page = filter.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const u = new URLSearchParams(sp as Record<string, string>);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} survey(s)</p>
        <ExportButton filter={filter} />
      </div>
      <SurveyFilterBar reps={reps ?? []} current={sp} />
      <SurveyTable rows={rows} />
      <div className="mt-4 flex items-center justify-between text-sm">
        <a aria-disabled={page <= 0} href={qs(Math.max(0, page - 1))}
          className={`rounded border px-3 py-1.5 ${page <= 0 ? "pointer-events-none opacity-40" : ""}`}>Previous</a>
        <span>Page {page + 1} of {pages}</span>
        <a aria-disabled={page + 1 >= pages} href={qs(page + 1)}
          className={`rounded border px-3 py-1.5 ${page + 1 >= pages ? "pointer-events-none opacity-40" : ""}`}>Next</a>
      </div>
    </div>
  );
}
