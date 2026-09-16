import { describe, it, expect } from "vitest";
import { BRANDS, SHOP_SIZES, MARKET_COLOR_PALETTE, MAX_MARKET_NAME_LEN, MAX_INNER_PHOTOS } from "@/lib/constants";
import { BRAND_SELECT_OPTIONS, OTHER_BRAND, MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN } from "@/lib/constants";

describe("constants", () => {
  it("has 7 brands", () => {
    expect(BRANDS).toEqual(["Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans"]);
  });
  it("has 3 shop sizes", () => {
    expect(SHOP_SIZES).toEqual(["Small", "Medium", "Large"]);
  });
  it("has a non-empty palette of valid, distinct hex colors", () => {
    expect(MARKET_COLOR_PALETTE.length).toBeGreaterThanOrEqual(12);
    for (const c of MARKET_COLOR_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(MARKET_COLOR_PALETTE).size).toBe(MARKET_COLOR_PALETTE.length);
  });
  it("caps a market name at 40 characters", () => {
    expect(MAX_MARKET_NAME_LEN).toBe(40);
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
