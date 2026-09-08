"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRecorder, isRecordingSupported } from "@/lib/audio";
import { MAX_AUDIO_SECONDS } from "@/lib/constants";

function mmss(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({ value, onChange }: { value: Blob | null; onChange: (b: Blob | null) => void }) {
  const supported = isRecordingSupported();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const clip = value ?? recorded;
  const url = useMemo(() => (clip ? URL.createObjectURL(clip) : null), [clip]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = createRecorder(stream);
    rec.onAutoStop(() => stop());
    recorderRef.current = rec;
    rec.start();
    setRecorded(null);
    setRecording(true);
    setElapsed(0);
    tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  async function stop() {
    if (tick.current) clearInterval(tick.current);
    const rec = recorderRef.current;
    if (!rec) return;
    const { blob } = await rec.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecorded(blob);
    onChange(blob);
  }

  function del() {
    setRecorded(null);
    onChange(null);
  }

  if (!supported) {
    return <p className="text-xs text-slate-500">Voice notes are not supported on this device. You can skip this field.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pak Fan comments (voice note, optional)</span>
      {recording ? (
        <button type="button" onClick={stop}
          className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
          Stop · {mmss(elapsed)} / {mmss(MAX_AUDIO_SECONDS)}
        </button>
      ) : clip && url ? (
        <div className="flex flex-col gap-2">
          <audio src={url} controls className="w-full" />
          <div className="flex gap-2">
            <button type="button" onClick={start} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Record again</button>
            <button type="button" onClick={del} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-600">Delete</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start}
          className="self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Record</button>
      )}
    </div>
  );
}
