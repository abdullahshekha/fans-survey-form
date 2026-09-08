import { MAX_AUDIO_SECONDS } from "./constants";

export function isRecordingSupported(): boolean {
  return typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";
}

export function pickAudioMimeType(): "audio/webm" | "audio/mp4" {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/mp4";
}

export function createRecorder(stream: MediaStream) {
  const mimeType = pickAudioMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  let startedAt = 0;
  let autoStopCb: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return {
    start() {
      chunks.length = 0;
      startedAt = Date.now();
      recorder.start();
      timer = setTimeout(() => { if (recorder.state === "recording") { recorder.stop(); autoStopCb?.(); } }, MAX_AUDIO_SECONDS * 1000);
    },
    stop(): Promise<{ blob: Blob; seconds: number; mimeType: string }> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          if (timer) clearTimeout(timer);
          stream.getTracks().forEach((t) => t.stop());
          resolve({ blob: new Blob(chunks, { type: mimeType }), seconds: Math.round((Date.now() - startedAt) / 1000), mimeType });
        };
        if (recorder.state !== "inactive") recorder.stop();
      });
    },
    onAutoStop(cb: () => void) { autoStopCb = cb; },
  };
}
