import { describe, it, expect, vi } from "vitest";
import { getRepSurveys } from "@/lib/queries";

function fakeSupabase(rows: any[]) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: async () => ({ data: rows, error: null }),
  };
  return { from: () => chain } as any;
}

describe("getRepSurveys", () => {
  it("maps edited_at through", async () => {
    const rows = [{
      id: "s1", shop_name: "A", market: "Malir", created_at: "2026-09-01T00:00:00Z",
      edited_at: "2026-09-02T00:00:00Z",
      survey_photos: [{ kind: "front", storage_path: "u/s1/front.jpg" }],
    }];
    const [item] = await getRepSurveys(fakeSupabase(rows), "rep1");
    expect(item.edited_at).toBe("2026-09-02T00:00:00Z");
    expect(item.front_thumb_path).toBe("u/s1/front.jpg");
  });
});
