import { BRANDS, MARKETS, OTHER_BRAND } from "./constants";

type Datum = { label: string; value: number };

const BRAND_BUCKETS = [...BRANDS, OTHER_BRAND];

export function countByMarket(surveys: { market: string }[]): Datum[] {
  const counts = new Map<string, number>(MARKETS.map((m) => [m, 0]));
  for (const s of surveys) counts.set(s.market, (counts.get(s.market) ?? 0) + 1);
  return MARKETS.map((m) => ({ label: m, value: counts.get(m) ?? 0 }));
}

export function countByRep(surveys: { rep_username: string }[]): Datum[] {
  const counts = new Map<string, number>();
  for (const s of surveys) counts.set(s.rep_username, (counts.get(s.rep_username) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function countMostSellingFan(surveys: { most_selling_fan: string }[]): Datum[] {
  const counts = new Map<string, number>(BRAND_BUCKETS.map((b) => [b, 0]));
  for (const s of surveys) counts.set(s.most_selling_fan, (counts.get(s.most_selling_fan) ?? 0) + 1);
  return BRAND_BUCKETS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
}

export function countRecommendedBrands(
  surveys: { rec_30w_1: string | null; rec_30w_2: string | null; rec_50w_1: string | null; rec_50w_2: string | null }[],
): Datum[] {
  const counts = new Map<string, number>(BRAND_BUCKETS.map((b) => [b, 0]));
  for (const s of surveys) {
    for (const v of [s.rec_30w_1, s.rec_30w_2, s.rec_50w_1, s.rec_50w_2]) {
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return BRAND_BUCKETS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
}

export function overviewStats(surveys: { market: string }[]): { totalSurveys: number; marketsCovered: number } {
  return {
    totalSurveys: surveys.length,
    marketsCovered: new Set(surveys.map((s) => s.market).filter(Boolean)).size,
  };
}
