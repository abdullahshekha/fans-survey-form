import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionProfile: vi.fn() }));

const countResult: { current: { count: number | null } } = { current: { count: 0 } };
const ilikeResult: { current: { data: { name: string }[] | null } } = { current: { data: [] } };
const insertMock = vi.fn(async () => ({ error: null }));
const updateEqMock = vi.fn(async (_vals: { name: string }, _oldName: string) => ({ error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      if (table !== "markets") throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) return Promise.resolve(countResult.current);
          return { ilike: () => Promise.resolve(ilikeResult.current) };
        },
        insert: insertMock,
        update: (vals: { name: string }) => ({ eq: (_col: string, val: string) => updateEqMock(vals, val) }),
      };
    },
  }),
}));

import { getSessionProfile } from "@/lib/auth";
import { addMarket, renameMarket } from "@/app/admin/housekeeping/actions";
import { MARKET_COLOR_PALETTE } from "@/lib/constants";

const admin = { id: "a1", username: "admin", full_name: "Admin", role: "admin" as const, active: true, created_at: "" };
const rep = { ...admin, id: "r1", username: "rep.one", role: "rep" as const };

beforeEach(() => {
  vi.mocked(getSessionProfile).mockResolvedValue(admin);
  countResult.current = { count: 3 };
  ilikeResult.current = { data: [] };
  insertMock.mockClear();
  updateEqMock.mockClear();
});

describe("addMarket", () => {
  it("rejects a non-admin caller", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(rep);
    await expect(addMarket("New Town")).rejects.toThrow(/not authorized/i);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await expect(addMarket("   ")).rejects.toThrow(/required/i);
  });

  it("rejects a name over 40 characters", async () => {
    await expect(addMarket("x".repeat(41))).rejects.toThrow(/40/);
  });

  it("rejects a case-insensitive duplicate", async () => {
    ilikeResult.current = { data: [{ name: "Malir" }] };
    await expect(addMarket("malir")).rejects.toThrow(/already exists/i);
  });

  it("inserts with the palette color at count % length and the next sort_order", async () => {
    countResult.current = { count: 12 };
    await addMarket(" New Town ");
    expect(insertMock).toHaveBeenCalledWith({
      name: "New Town",
      color: MARKET_COLOR_PALETTE[12 % MARKET_COLOR_PALETTE.length],
      sort_order: 13,
    });
  });
});

describe("renameMarket", () => {
  it("rejects a non-admin caller", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(rep);
    await expect(renameMarket("UP", "University Road")).rejects.toThrow(/not authorized/i);
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await expect(renameMarket("UP", "  ")).rejects.toThrow(/required/i);
  });

  it("rejects a name over 40 characters", async () => {
    await expect(renameMarket("UP", "x".repeat(41))).rejects.toThrow(/40/);
  });

  it("allows a case-only rename without a duplicate check", async () => {
    await renameMarket("UP", "up");
    expect(updateEqMock).toHaveBeenCalledWith({ name: "up" }, "UP");
  });

  it("rejects a rename that collides with another existing market", async () => {
    ilikeResult.current = { data: [{ name: "Malir" }] };
    await expect(renameMarket("UP", "Malir")).rejects.toThrow(/already exists/i);
  });

  it("updates the row by its old name", async () => {
    await renameMarket("UP", "University Road");
    expect(updateEqMock).toHaveBeenCalledWith({ name: "University Road" }, "UP");
  });
});
