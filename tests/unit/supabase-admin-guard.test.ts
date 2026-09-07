// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

describe("createAdminSupabase", () => {
  it("throws when the service role key is absent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { createAdminSupabase } = await import("@/lib/supabase/admin");
    expect(() => createAdminSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    vi.unstubAllEnvs();
  });
});
