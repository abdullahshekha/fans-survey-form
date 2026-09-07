import { describe, it, expect, vi } from "vitest";

const createSignedUrls = vi.fn();
const createSignedUrl = vi.fn();
const single = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
    storage: { from: () => ({ createSignedUrls, createSignedUrl }) },
  }),
}));

import { getSignedMediaUrls } from "@/app/survey/[id]/actions";

describe("getSignedMediaUrls", () => {
  it("returns [] when the caller cannot see the survey", async () => {
    single.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const res = await getSignedMediaUrls("sid");
    expect(res).toEqual({ photos: [], audio: null });
  });

  it("signs each photo path and the audio path", async () => {
    single.mockResolvedValue({
      data: {
        audio_path: "uid/sid/comment.webm",
        survey_photos: [
          { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
          { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
        ],
      },
      error: null,
    });
    createSignedUrls.mockResolvedValue({ data: [
      { path: "uid/sid/front.jpg", signedUrl: "https://x/front" },
      { path: "uid/sid/inner-0.jpg", signedUrl: "https://x/inner0" },
    ], error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://x/audio" }, error: null });

    const res = await getSignedMediaUrls("sid");
    expect(res.photos).toEqual([
      { kind: "front", url: "https://x/front" },
      { kind: "inner", url: "https://x/inner0" },
    ]);
    expect(res.audio).toBe("https://x/audio");
  });
});
