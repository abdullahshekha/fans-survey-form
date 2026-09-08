import { describe, it, expect, vi } from "vitest";
import { uploadEditedMedia, extFromAudioMime } from "@/lib/upload";

function fakeSupabase(uploadImpl: any) {
  const upload = vi.fn(uploadImpl);
  return { client: { storage: { from: () => ({ upload }) } } as any, upload };
}

describe("extFromAudioMime", () => {
  it("maps known types", () => {
    expect(extFromAudioMime("audio/mpeg")).toBe("mp3");
    expect(extFromAudioMime("audio/webm")).toBe("webm");
    expect(extFromAudioMime("audio/x-m4a")).toBe("m4a");
    expect(extFromAudioMime("audio/wut")).toBe("bin");
  });
});

describe("uploadEditedMedia", () => {
  it("keeps existing paths and uploads only new files", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    const { client, upload } = fakeSupabase(async () => ({ error: null }));
    const res = await uploadEditedMedia(client, "rep1", "surv1", {
      front: { keep: "rep1/surv1/front.jpg" },
      inner: [{ keep: "rep1/surv1/inner-0.jpg" }, { file: new File(["x"], "n.jpg", { type: "image/jpeg" }) }],
      quotation: [],
      audio: { file: new File(["a"], "n.mp3", { type: "audio/mpeg" }) },
    });
    expect(res.front).toBe("rep1/surv1/front.jpg");
    expect(res.inner).toEqual(["rep1/surv1/inner-0.jpg", "rep1/surv1/inner-uuid.jpg"]);
    expect(res.audio).toBe("rep1/surv1/comment-uuid.mp3");
    expect(upload).toHaveBeenCalledTimes(2); // 1 inner + 1 audio
    vi.unstubAllGlobals();
  });

  it("throws when a photo upload fails", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    const { client } = fakeSupabase(async () => ({ error: { message: "boom" } }));
    await expect(uploadEditedMedia(client, "rep1", "surv1", {
      front: { file: new File(["x"], "f.jpg", { type: "image/jpeg" }) },
      inner: [{ keep: "rep1/surv1/inner-0.jpg" }], quotation: [], audio: null,
    })).rejects.toThrow(/Photo upload failed/);
    vi.unstubAllGlobals();
  });
});
