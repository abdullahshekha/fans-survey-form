export const PAGE_SIZE = 25;

export interface SurveyFilter {
  market?: string;
  repId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  all?: boolean;
}

export function buildSurveyQuery(query: any, f: SurveyFilter) {
  if (f.market) query = query.eq("market", f.market);
  if (f.repId) query = query.eq("rep_id", f.repId);
  if (f.from) query = query.gte("created_at", f.from);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59`);
  if (f.q) {
    const safe = f.q.replace(/["\\]/g, "").replace(/[%,()*]/g, " ").trim();
    if (safe) query = query.or(`shop_name.ilike."%${safe}%",customer_name.ilike."%${safe}%"`);
  }
  const ordered = query.order("created_at", { ascending: false });
  if (f.all) return ordered;
  const page = f.page ?? 0;
  return ordered.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
}

export interface AdminSurveyRow {
  id: string;
  created_at: string;
  edited_at: string | null;
  rep_username: string;
  shop_name: string;
  market: string;
  shop_size: string;
  most_selling_fan: string;
  most_selling_fan_other: string | null;
  front_thumb_path: string | null;
}

export async function getSurveysPage(db: any, f: SurveyFilter): Promise<{ rows: AdminSurveyRow[]; total: number }> {
  const base = db
    .from("surveys")
    .select(
      "id, created_at, edited_at, shop_name, market, shop_size, most_selling_fan, most_selling_fan_other, profiles!surveys_rep_id_fkey(username), survey_photos(kind, storage_path, sort_order)",
      { count: "exact" },
    );
  const { data, count, error } = await buildSurveyQuery(base, f);
  if (error) throw error;
  const rows: AdminSurveyRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    edited_at: r.edited_at ?? null,
    rep_username: r.profiles?.username ?? "—",
    shop_name: r.shop_name,
    market: r.market,
    shop_size: r.shop_size,
    most_selling_fan: r.most_selling_fan,
    most_selling_fan_other: r.most_selling_fan_other ?? null,
    front_thumb_path: r.survey_photos?.find((p: any) => p.kind === "front")?.storage_path ?? null,
  }));
  return { rows, total: count ?? rows.length };
}
