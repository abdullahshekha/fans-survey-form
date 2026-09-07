import { describe, it, expect, vi } from "vitest";
import { buildSurveyQuery, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";

function fakeBuilder() {
  const calls: [string, unknown[]][] = [];
  const b: any = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "__calls") return calls;
      return (...args: unknown[]) => { calls.push([prop, args]); return b; };
    },
  });
  return b;
}

describe("buildSurveyQuery", () => {
  it("applies every provided filter", () => {
    const b = fakeBuilder();
    const filter: SurveyFilter = { market: "Malir", repId: "r1", from: "2026-09-01", to: "2026-09-07", q: "madina", page: 2 };
    buildSurveyQuery(b, filter);
    const names = b.__calls.map((c: any) => c[0]);
    expect(names).toEqual(expect.arrayContaining(["eq", "gte", "lte", "or", "order", "range"]));
    const range = b.__calls.find((c: any) => c[0] === "range")[1];
    expect(range).toEqual([2 * PAGE_SIZE, 2 * PAGE_SIZE + PAGE_SIZE - 1]);
  });

  it("omits filters that are not set", () => {
    const b = fakeBuilder();
    buildSurveyQuery(b, {});
    const names = b.__calls.map((c: any) => c[0]);
    expect(names).not.toContain("or");
    expect(names).toContain("range");
  });

  it("skips range when all: true", () => {
    const b = fakeBuilder();
    buildSurveyQuery(b, { all: true });
    const names = b.__calls.map((c: any) => c[0]);
    expect(names).toContain("order");
    expect(names).not.toContain("range");
  });
});
