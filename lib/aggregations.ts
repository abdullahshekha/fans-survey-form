import { BRANDS, OTHER_BRAND } from "./constants";
import { normalizeOtherBrand } from "./brandAliases";

type Datum = { label: string; value: number };
type BrandField = { value: string | null; other: string | null };

export function countByMarket(surveys: { market: string }[], markets: readonly string[]): Datum[] {
  const counts = new Map<string, number>(markets.map((m) => [m, 0]));
  for (const s of surveys) counts.set(s.market, (counts.get(s.market) ?? 0) + 1);
  return markets.map((m) => ({ label: m, value: counts.get(m) ?? 0 }));
}

/** Counts a brand-select field: fixed BRANDS keep their bars; free-text "Other"
 * entries are alias-normalized, and any resulting bucket with 2+ occurrences
 * gets its own bar instead of being folded into a catch-all "Other" bar. */
function countBrandField(fields: BrandField[]): Datum[] {
  const counts = new Map<string, number>(BRANDS.map((b) => [b, 0]));
  const otherTally = new Map<string, number>();
  for (const { value, other } of fields) {
    if (!value) continue;
    if (value === OTHER_BRAND) {
      if (!other) continue;
      const bucket = normalizeOtherBrand(other);
      otherTally.set(bucket, (otherTally.get(bucket) ?? 0) + 1);
    } else {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const result: Datum[] = BRANDS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));

  const promoted: Datum[] = [];
  let leftover = 0;
  for (const [label, value] of otherTally) {
    if (value >= 2) promoted.push({ label, value });
    else leftover += value;
  }
  promoted.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  result.push(...promoted);
  if (leftover > 0) result.push({ label: OTHER_BRAND, value: leftover });

  return result;
}

export function countMostSellingFan(
  surveys: { most_selling_fan: string | null; most_selling_fan_other: string | null }[],
): Datum[] {
  return countBrandField(surveys.map((s) => ({ value: s.most_selling_fan, other: s.most_selling_fan_other })));
}

export function countRec30w1(surveys: { rec_30w_1: string | null; rec_30w_1_other: string | null }[]): Datum[] {
  return countBrandField(surveys.map((s) => ({ value: s.rec_30w_1, other: s.rec_30w_1_other })));
}

export function countRec30w2(surveys: { rec_30w_2: string | null; rec_30w_2_other: string | null }[]): Datum[] {
  return countBrandField(surveys.map((s) => ({ value: s.rec_30w_2, other: s.rec_30w_2_other })));
}

export function countRec50w1(surveys: { rec_50w_1: string | null; rec_50w_1_other: string | null }[]): Datum[] {
  return countBrandField(surveys.map((s) => ({ value: s.rec_50w_1, other: s.rec_50w_1_other })));
}

export function countRec50w2(surveys: { rec_50w_2: string | null; rec_50w_2_other: string | null }[]): Datum[] {
  return countBrandField(surveys.map((s) => ({ value: s.rec_50w_2, other: s.rec_50w_2_other })));
}

export function overviewStats(surveys: { market: string }[]): { totalSurveys: number; marketsCovered: number } {
  return {
    totalSurveys: surveys.length,
    marketsCovered: new Set(surveys.map((s) => s.market).filter(Boolean)).size,
  };
}

const PAK_FANS = "Pak Fans";

type PakFansSurvey = {
  market: string;
  most_selling_fan: string | null;
  rec_30w_1: string | null;
  rec_50w_1: string | null;
};

export type PakFansHold = {
  market: string;
  n: number;
  shareMostSelling: number;
  shareRec30w: number;
  shareRec50w: number;
  betterHold: boolean;
};

/** A market "has a better hold" for Pak Fans when its local share of Pak Fans
 * mentions — on most-selling, 30W recommendation, or 50W recommendation —
 * meets or beats Pak Fans' citywide share on that same metric. Pak Fans
 * rarely outright leads any single market in this dataset, so plurality
 * would surface almost nothing; comparing against the citywide baseline
 * instead highlights markets where the brand over-indexes. */
export function pakFansHoldByMarket(surveys: PakFansSurvey[], marketNames: readonly string[]): PakFansHold[] {
  const cityTotal = surveys.length || 1;
  const cityShare = (field: keyof PakFansSurvey) =>
    surveys.filter((s) => s[field] === PAK_FANS).length / cityTotal;
  const cityMostSelling = cityShare("most_selling_fan");
  const cityRec30w = cityShare("rec_30w_1");
  const cityRec50w = cityShare("rec_50w_1");

  return marketNames.map((market) => {
    const rows = surveys.filter((s) => s.market === market);
    const n = rows.length || 1;
    const shareMostSelling = rows.filter((s) => s.most_selling_fan === PAK_FANS).length / n;
    const shareRec30w = rows.filter((s) => s.rec_30w_1 === PAK_FANS).length / n;
    const shareRec50w = rows.filter((s) => s.rec_50w_1 === PAK_FANS).length / n;
    const betterHold =
      rows.length > 0 &&
      (shareMostSelling >= cityMostSelling && shareMostSelling > 0 ||
        shareRec30w >= cityRec30w && shareRec30w > 0 ||
        shareRec50w >= cityRec50w && shareRec50w > 0);
    return { market, n: rows.length, shareMostSelling, shareRec30w, shareRec50w, betterHold };
  });
}
