import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSurveysPage, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";
import { getMarkets } from "@/lib/markets";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveyTable } from "@/components/admin/SurveyTable";
import { ExportButton } from "@/components/admin/ExportButton";
import { SIGNED_URL_TTL } from "@/lib/constants";

export default async function AdminSurveysPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const parsedPage = parseInt(sp.page ?? "", 10);
  const filter: SurveyFilter = {
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 0,
  };

  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const markets = await getMarkets(db);
  const { rows, total } = await getSurveysPage(db, filter);
  const page = filter.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // One batch-sign call for every photo on the page, instead of one call per
  // thumbnail — thumbnails render immediately rather than behind a click.
  const allPaths = rows.flatMap((r) => r.photos.map((p) => p.storage_path));
  const { data: signed } = allPaths.length
    ? await db.storage.from("survey-photos").createSignedUrls(allPaths, SIGNED_URL_TTL)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const photosByRow = new Map(
    rows.map((r) => [
      r.id,
      r.photos
        .map((p) => ({ url: urlByPath.get(p.storage_path), kind: p.kind as string }))
        .filter((p): p is { url: string; kind: string } => !!p.url),
    ]),
  );

  const qs = (p: number) => {
    const u = new URLSearchParams(sp as Record<string, string>);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Surveys</h1>
        <ExportButton filter={filter} />
      </div>
      <SurveyFilterBar markets={markets.map((m) => m.name)} reps={reps ?? []} current={sp} />
      <p className="mb-3 text-sm text-slate-500">{total} survey{total === 1 ? "" : "s"}</p>
      <SurveyTable rows={rows} photosByRow={photosByRow} />
      <div className="mt-6 flex items-center justify-between text-sm">
        <a aria-disabled={page <= 0} href={qs(Math.max(0, page - 1))}
          className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 ${page <= 0 ? "pointer-events-none opacity-40" : ""}`}>Previous</a>
        <span className="text-slate-500">Page {page + 1} of {pages}</span>
        <a aria-disabled={page + 1 >= pages} href={qs(page + 1)}
          className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 ${page + 1 >= pages ? "pointer-events-none opacity-40" : ""}`}>Next</a>
      </div>
    </div>
  );
}
