import { describe, it, expect } from "vitest";
import { MARKETS, BRANDS, SHOP_SIZES, MARKET_COLORS, MAX_INNER_PHOTOS } from "@/lib/constants";

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
