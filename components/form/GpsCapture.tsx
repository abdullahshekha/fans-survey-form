"use client";
import { useState } from "react";
import { getCurrentPosition } from "@/lib/geo";
import type { GpsFix } from "@/lib/validation";
import { MiniMap } from "@/components/MiniMap";

const MESSAGES: Record<string, string> = {
  "permission-denied": "Location permission was denied. Enable it in your browser settings and try again.",
  "unavailable": "Your device could not determine a location. Move to an open area and retry.",
  "timeout": "Getting a location took too long. Try again.",
  "unsupported": "This device does not support GPS in the browser.",
};

export function GpsCapture({ value, onChange }: { value: GpsFix | null; onChange: (f: GpsFix | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function capture() {
    setBusy(true); setError("");
    try {
      onChange(await getCurrentPosition());
    } catch (e) {
      setError(MESSAGES[(e as Error).message] ?? MESSAGES.unavailable);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Shop location (GPS)</span>
      {value ? (
        <>
          <MiniMap lat={value.lat} lng={value.lng} />
          <p className="text-xs text-slate-600">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {value.accuracy != null ? ` · ±${Math.round(value.accuracy)} m` : ""}
          </p>
          <button type="button" onClick={capture} disabled={busy}
            className="self-start rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {busy ? "Recapturing…" : "Recapture"}
          </button>
        </>
      ) : (
        <button type="button" onClick={capture} disabled={busy}
          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Capturing…" : "Capture location"}
        </button>
      )}
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
