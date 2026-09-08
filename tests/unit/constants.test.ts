import { describe, it, expect } from "vitest";
import { MARKETS, BRANDS, SHOP_SIZES, MARKET_COLORS, MAX_INNER_PHOTOS } from "@/lib/constants";
import { BRAND_SELECT_OPTIONS, OTHER_BRAND, MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN } from "@/lib/constants";

describe("constants", () => {
  it("has 12 markets in spec order", () => {
    expect(MARKETS).toHaveLength(12);
    expect(MARKETS[0]).toBe("Arambagh");
    expect(MARKETS[11]).toBe("Landhi/Korangi");
  });
  it("has 7 brands", () => {
    expect(BRANDS).toEqual(["Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans"]);
  });
  it("has 3 shop sizes", () => {
    expect(SHOP_SIZES).toEqual(["Small", "Medium", "Large"]);
  });
  it("assigns a distinct colour to every market", () => {
    const colors = MARKETS.map((m) => MARKET_COLORS[m]);
    expect(new Set(colors).size).toBe(12);
  });
  it("caps inner photos at 10", () => {
    expect(MAX_INNER_PHOTOS).toBe(10);
  });
});

describe("v2 constants", () => {
  it("BRAND_SELECT_OPTIONS is the 7 brands plus Other", () => {
    expect(BRAND_SELECT_OPTIONS).toEqual([...BRANDS, "Other"]);
    expect(OTHER_BRAND).toBe("Other");
  });
  it("quotation cap is 2, other-brand length cap is 40", () => {
    expect(MAX_QUOTATION_PHOTOS).toBe(2);
    expect(MAX_OTHER_BRAND_LEN).toBe(40);
  });
});
