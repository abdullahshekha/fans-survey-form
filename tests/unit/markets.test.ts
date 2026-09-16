import { describe, it, expect, vi } from "vitest";
import { getMarkets } from "@/lib/markets";

describe("getMarkets", () => {
  it("selects name and color ordered by sort_order", async () => {
    const order = vi.fn(async () => ({
      data: [{ name: "B", color: "#111111" }, { name: "A", color: "#222222" }],
      error: null,
    }));
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const db = { from } as any;

    const result = await getMarkets(db);

    expect(from).toHaveBeenCalledWith("markets");
    expect(select).toHaveBeenCalledWith("name, color");
    expect(order).toHaveBeenCalledWith("sort_order");
    expect(result).toEqual([{ name: "B", color: "#111111" }, { name: "A", color: "#222222" }]);
  });

  it("throws when the query errors", async () => {
    const db = {
      from: () => ({ select: () => ({ order: async () => ({ data: null, error: new Error("boom") }) }) }),
    } as any;

    await expect(getMarkets(db)).rejects.toThrow("boom");
  });
});
