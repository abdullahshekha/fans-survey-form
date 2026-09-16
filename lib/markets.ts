import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketOption = { name: string; color: string };

export async function getMarkets(supabase: SupabaseClient): Promise<MarketOption[]> {
  const { data, error } = await supabase.from("markets").select("name, color").order("sort_order");
  if (error) throw error;
  return (data ?? []) as MarketOption[];
}
