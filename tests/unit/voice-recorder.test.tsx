import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fakeRecorder = { start: vi.fn(), stop: vi.fn(async () => ({ blob: new Blob(["a"], { type: "audio/webm" }), seconds: 3, mimeType: "audio/webm" })), onAutoStop: vi.fn() };
vi.mock("@/lib/audio", () => ({
  isRecordingSupported: vi.fn(() => true),
  createRecorder: vi.fn(() => fakeRecorder),
}));
import { isRecordingSupported } from "@/lib/audio";
import { VoiceRecorder } from "@/components/form/VoiceRecorder";

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:a");
  globalThis.URL.revokeObjectURL = vi.fn();
  // @ts-expect-error partial mock
  navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) };
});

describe("VoiceRecorder", () => {
  it("records then exposes playback and returns the blob", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /record/i }));
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onChange).toHaveBeenCalledWith(expect.any(Blob));
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows a fallback when recording is unsupported", () => {
    (isRecordingSupported as unknown as Mock).mockReturnValueOnce(false);
    render(<VoiceRecorder value={null} onChange={vi.fn()} />);
    expect(screen.getByText(/not supported on this device/i)).toBeInTheDocument();
  });
});
