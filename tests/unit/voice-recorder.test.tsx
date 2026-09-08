import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fakeRecorder = {
  start: vi.fn(),
  stop: vi.fn(async () => ({ blob: new Blob(["a"], { type: "audio/webm" }), seconds: 3, mimeType: "audio/webm" })),
  onAutoStop: vi.fn(),
};
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

const audioFile = (type: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], "note", { type });

describe("VoiceRecorder", () => {
  it("records then exposes playback and returns the blob", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^record$/i }));
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onChange).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("accepts a valid uploaded audio file", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByTestId("audio-upload-input"), audioFile("audio/mpeg"));
    expect(onChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("rejects a non-audio upload without calling onChange", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByTestId("audio-upload-input"), audioFile("application/pdf"), {
      applyAccept: false,
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/audio file/i);
  });

  it("plays an existing note and can clear it", async () => {
    const onClearExisting = vi.fn();
    render(<VoiceRecorder value={null} onChange={vi.fn()} existingUrl="https://x/a.mp3" onClearExisting={onClearExisting} />);
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("https://x/a.mp3");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onClearExisting).toHaveBeenCalled();
  });

  it("still offers upload when recording is unsupported", () => {
    (isRecordingSupported as unknown as Mock).mockReturnValueOnce(false);
    render(<VoiceRecorder value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("audio-upload-input")).toBeInTheDocument();
  });
});
