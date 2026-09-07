import { describe, it, expect } from "vitest";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";
import { MARKETS } from "@/lib/constants";

const surveys = [
  { market: "Malir", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "GFC", rec_30w_2: "Tamoor", rec_50w_1: "GFC", rec_50w_2: null },
  { market: "Malir", rep_username: "rep.two", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_30w_2: null, rec_50w_1: "GFC", rec_50w_2: "SK" },
  { market: "Arambagh", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null, rec_50w_1: "Tamoor", rec_50w_2: null },
];

describe("aggregations", () => {
  it("countByMarket returns all 12 markets in order with correct counts", () => {
    const out = countByMarket(surveys);
    expect(out).toHaveLength(12);
    expect(out.map((o) => o.label)).toEqual([...MARKETS]);
    expect(out.find((o) => o.label === "Malir")!.value).toBe(2);
    expect(out.find((o) => o.label === "UP")!.value).toBe(0);
  });

  it("countByRep is sorted descending", () => {
    const out = countByRep(surveys);
    expect(out[0]).toEqual({ label: "rep.one", value: 2 });
    expect(out[1]).toEqual({ label: "rep.two", value: 1 });
  });

  it("countMostSellingFan counts per brand", () => {
    const out = countMostSellingFan(surveys);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(2);
    expect(out.find((o) => o.label === "Royal")!.value).toBe(1);
    expect(out.find((o) => o.label === "SK")!.value).toBe(0);
  });

  it("countRecommendedBrands sums all four recommendation columns", () => {
    const out = countRecommendedBrands(surveys);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(3);   // s1:2, s2:1
    expect(out.find((o) => o.label === "Tamoor")!.value).toBe(3); // s1:1, s3:2
    expect(out.find((o) => o.label === "SK")!.value).toBe(1);
  });

  it("overviewStats reports totals and distinct markets", () => {
    expect(overviewStats(surveys)).toEqual({ totalSurveys: 3, marketsCovered: 2 });
  });
});
