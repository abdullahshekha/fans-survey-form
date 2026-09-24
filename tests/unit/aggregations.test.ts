import { describe, it, expect } from "vitest";
import {
  countByMarket, countMostSellingFan, countRec30w1, countRec30w2, countRec50w1, countRec50w2, overviewStats,
  pakFansHoldByMarket, shareOf,
} from "@/lib/aggregations";

const MARKET_NAMES = [
  "Arambagh", "MA Jinnah", "Waterpump", "Bohrapir", "Johar Mor", "UP",
  "Liaquatabad", "Shah Faisal Colony", "Orangi Town", "Baldia Town", "Malir", "Landhi/Korangi",
];

const surveys = [
  { market: "Malir", most_selling_fan: "GFC", most_selling_fan_other: null,
    rec_30w_1: "GFC", rec_30w_1_other: null, rec_30w_2: "Tamoor", rec_30w_2_other: null,
    rec_50w_1: "GFC", rec_50w_1_other: null, rec_50w_2: null, rec_50w_2_other: null },
  { market: "Malir", most_selling_fan: "Royal", most_selling_fan_other: null,
    rec_30w_1: "Royal", rec_30w_1_other: null, rec_30w_2: null, rec_30w_2_other: null,
    rec_50w_1: "GFC", rec_50w_1_other: null, rec_50w_2: "SK", rec_50w_2_other: null },
  { market: "Arambagh", most_selling_fan: "GFC", most_selling_fan_other: null,
    rec_30w_1: "Tamoor", rec_30w_1_other: null, rec_30w_2: null, rec_30w_2_other: null,
    rec_50w_1: "Tamoor", rec_50w_1_other: null, rec_50w_2: null, rec_50w_2_other: null },
  { market: "UP", most_selling_fan: "Other", most_selling_fan_other: "Karam Fan",
    rec_30w_1: "Other", rec_30w_1_other: "karam", rec_30w_2: null, rec_30w_2_other: null,
    rec_50w_1: "Royal", rec_50w_1_other: null, rec_50w_2: "Other", rec_50w_2_other: "One-off Brand" },
];

describe("aggregations", () => {
  it("countByMarket returns every given market in order with correct counts", () => {
    const out = countByMarket(surveys, MARKET_NAMES);
    expect(out).toHaveLength(12);
    expect(out.map((o) => o.label)).toEqual(MARKET_NAMES);
    expect(out.find((o) => o.label === "Malir")!.value).toBe(2);
    expect(out.find((o) => o.label === "UP")!.value).toBe(1);
  });

  it("countByMarket reflects a shorter or reordered markets list", () => {
    const out = countByMarket(surveys, ["UP", "Arambagh"]);
    expect(out).toEqual([{ label: "UP", value: 1 }, { label: "Arambagh", value: 1 }]);
  });

  it("countMostSellingFan counts per brand", () => {
    const out = countMostSellingFan(surveys);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(2);
    expect(out.find((o) => o.label === "Royal")!.value).toBe(1);
    expect(out.find((o) => o.label === "SK")!.value).toBe(0);
  });

  it("promotes an 'Other' bucket with 2+ alias-normalized occurrences to its own bar", () => {
    const out = countMostSellingFan(surveys);
    // "Karam Fan" in most_selling_fan_other should alias-normalize to "Karam".
    // Only 1 occurrence here, so it stays folded into "Other".
    expect(out.find((o) => o.label === "Karam")).toBeUndefined();
    expect(out.find((o) => o.label === "Other")!.value).toBe(1);
  });

  it("countRec30w1/2 and countRec50w1/2 count their own columns independently", () => {
    expect(countRec30w1(surveys).find((o) => o.label === "GFC")!.value).toBe(1);
    expect(countRec30w2(surveys).find((o) => o.label === "Tamoor")!.value).toBe(1);
    expect(countRec50w1(surveys).find((o) => o.label === "GFC")!.value).toBe(2);
    expect(countRec50w2(surveys).find((o) => o.label === "SK")!.value).toBe(1);
    expect(countRec50w2(surveys).find((o) => o.label === "Other")!.value).toBe(1);
  });

  it("merges alias-normalized 'Other' names across two occurrences into their own bar", () => {
    const withRepeat = [
      ...surveys,
      { market: "UP", most_selling_fan: "Other", most_selling_fan_other: "karam inverter fan",
        rec_30w_1: null, rec_30w_1_other: null, rec_30w_2: null, rec_30w_2_other: null,
        rec_50w_1: null, rec_50w_1_other: null, rec_50w_2: null, rec_50w_2_other: null },
    ];
    const out = countMostSellingFan(withRepeat);
    expect(out.find((o) => o.label === "Karam")!.value).toBe(2);
    expect(out.find((o) => o.label === "Other")).toBeUndefined();
  });

  it("overviewStats reports totals and distinct markets", () => {
    expect(overviewStats(surveys)).toEqual({ totalSurveys: 4, marketsCovered: 3 });
  });
});

describe("pakFansHoldByMarket", () => {
  const rows = [
    { market: "X", most_selling_fan: "Pak Fans", rec_30w_1: "Royal", rec_50w_1: "Royal" },
    { market: "X", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_50w_1: "Royal" },
    { market: "Y", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_50w_1: "Royal" },
    { market: "Y", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_50w_1: "Royal" },
  ];

  it("flags a market whose Pak Fans share on any metric meets or beats the citywide share", () => {
    const out = pakFansHoldByMarket(rows, ["X", "Y"]);
    expect(out.find((r) => r.market === "X")).toMatchObject({ n: 2, shareMostSelling: 0.5, betterHold: true });
    expect(out.find((r) => r.market === "Y")).toMatchObject({ n: 2, shareMostSelling: 0, betterHold: false });
  });

  it("never flags a market with zero surveys", () => {
    const out = pakFansHoldByMarket(rows, ["Z"]);
    expect(out).toEqual([{ market: "Z", n: 0, shareMostSelling: 0, shareRec30w: 0, shareRec50w: 0, betterHold: false }]);
  });
});

describe("shareOf", () => {
  it("returns a label's fraction of the total", () => {
    const data = [{ label: "Pak Fans", value: 10 }, { label: "Royal", value: 20 }];
    expect(shareOf(data, "Pak Fans", 126)).toBeCloseTo(10 / 126);
  });

  it("returns 0 for a missing label or a zero total", () => {
    const data = [{ label: "Royal", value: 20 }];
    expect(shareOf(data, "Pak Fans", 126)).toBe(0);
    expect(shareOf(data, "Royal", 0)).toBe(0);
  });
});
