import { describe, it, expect, vi } from "vitest";

describe("usernameToEmail", () => {
  it("appends the configured domain", async () => {
    vi.stubEnv("REP_EMAIL_DOMAIN", "survey.local");
    const { usernameToEmail } = await import("@/lib/auth");
    expect(usernameToEmail("Rep.One")).toBe("rep.one@survey.local");
    vi.unstubAllEnvs();
  });
});
