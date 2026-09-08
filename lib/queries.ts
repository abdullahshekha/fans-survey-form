import type { SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "@/lib/constants";

export type SurveyListItem = {
  id: string;
  shop_name: string;
  market: Market;
  created_at: string;
  front_thumb_path: string | null;
};

export async function getRepSurveys(supabase: SupabaseClient, repId: string): Promise<SurveyListItem[]> {
  const { data, error } = await supabase
    .from("surveys")
    .select("id, shop_name, market, created_at, survey_photos!inner(storage_path, kind)")
    .eq("rep_id", repId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    shop_name: row.shop_name,
    market: row.market,
    created_at: row.created_at,
    front_thumb_path: row.survey_photos?.find((p: any) => p.kind === "front")?.storage_path ?? null,
  }));
}
