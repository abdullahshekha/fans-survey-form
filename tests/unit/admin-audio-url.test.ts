import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));

const single = vi.fn();
const createSignedUrl = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

import { getAudioUrl } from "@/app/admin/surveys/actions";

describe("getAudioUrl", () => {
  beforeEach(() => {
    getSessionProfile.mockResolvedValue({ role: "admin" });
  });

  it("rejects non-admins", async () => {
    getSessionProfile.mockResolvedValue({ role: "rep" });
    await expect(getAudioUrl("sid")).rejects.toThrow("Not authorized");
  });

  it("returns an error when the survey has no voice note", async () => {
    single.mockResolvedValue({ data: { audio_path: null }, error: null });
    const res = await getAudioUrl("sid");
    expect(res).toEqual({ error: "No voice note." });
  });

  it("returns a signed url when a voice note exists", async () => {
    single.mockResolvedValue({ data: { audio_path: "uid/sid/comment.webm" }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://x/audio" }, error: null });
    const res = await getAudioUrl("sid");
    expect(res).toEqual({ url: "https://x/audio" });
  });
});
