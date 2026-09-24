"use client";
import { useState, useTransition } from "react";
import { getAudioUrl } from "@/app/admin/surveys/actions";

export function AudioPlayButton({ surveyId }: { surveyId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (url) return <audio src={url} controls autoPlay className="h-8 w-40" />;

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const res = await getAudioUrl(surveyId);
            if (res.url) setUrl(res.url);
            else setError(res.error ?? "Could not load voice note.");
          })
        }
        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {pending ? "Loading…" : "Play"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
