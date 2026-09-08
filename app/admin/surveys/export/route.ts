import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
import { SIGNED_URL_TTL } from "@/lib/constants";
import { toExportRows, buildCsv, EXPORT_COLUMNS } from "@/lib/exportSurveys";

export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const filter: SurveyFilter & { all: true } = {
    all: true,
    market: sp.get("market") || undefined,
    repId: sp.get("repId") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    q: sp.get("q") || undefined,
  };

  const db = createAdminSupabase();
  const base = db.from("surveys").select(
    "*, profiles!surveys_rep_id_fkey(username), survey_photos(kind, storage_path, sort_order)",
  );
  const { data: surveys, error } = await buildSurveyQuery(base, filter);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoPaths = new Set<string>();
  const audioPaths = new Set<string>();
  (surveys ?? []).forEach((s: any) => {
    (s.survey_photos ?? []).forEach((p: any) => photoPaths.add(p.storage_path));
    if (s.audio_path) audioPaths.add(s.audio_path);
  });
  const signedByPath = new Map<string, string>();
  if (photoPaths.size) {
    const { data } = await db.storage.from("survey-photos").createSignedUrls([...photoPaths], SIGNED_URL_TTL);
    (data ?? []).forEach((d: any) => d.signedUrl && signedByPath.set(d.path, d.signedUrl));
  }
  for (const p of audioPaths) {
    const { data } = await db.storage.from("survey-audio").createSignedUrl(p, SIGNED_URL_TTL);
    if (data?.signedUrl) signedByPath.set(p, data.signedUrl);
  }

  const rows = toExportRows(surveys ?? [], signedByPath);
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `Media links in this file expire ${Math.round(SIGNED_URL_TTL / 3600)} hours after ${new Date().toISOString()}.`;

  if (format === "csv") {
    const body = `# ${note}\n${buildCsv(rows)}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="surveys-${stamp}.csv"`,
      },
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Surveys");
  const meta = XLSX.utils.aoa_to_sheet([[note]]);
  XLSX.utils.book_append_sheet(wb, meta, "Notes");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="surveys-${stamp}.xlsx"`,
    },
  });
}
