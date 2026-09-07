import { describe, it, expect, vi } from "vitest";
import { pickAudioMimeType } from "@/lib/audio";

describe("pickAudioMimeType", () => {
  it("prefers audio/webm when supported", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (t: string) => t === "audio/webm" });
    expect(pickAudioMimeType()).toBe("audio/webm");
    vi.unstubAllGlobals();
  });
  it("falls back to audio/mp4", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (t: string) => t === "audio/mp4" });
    expect(pickAudioMimeType()).toBe("audio/mp4");
    vi.unstubAllGlobals();
  });
});
