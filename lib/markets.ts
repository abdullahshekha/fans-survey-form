import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketOption = { name: string; color: string };

export async function getMarkets(supabase: SupabaseClient): Promise<MarketOption[]> {
  const { data, error } = await supabase.from("markets").select("name, color").order("sort_order");
  if (error) throw error;
  return (data ?? []) as MarketOption[];
}

export type MarketBoundary = {
  name: string;
  color: string;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  boundary_source: "osm" | "field-data" | null;
};

export async function getMarketBoundaries(supabase: SupabaseClient): Promise<MarketBoundary[]> {
  const { data, error } = await supabase
    .from("markets")
    .select("name, color, boundary, boundary_source")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as MarketBoundary[];
}
