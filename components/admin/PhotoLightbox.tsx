"use client";
import { useEffect, useState } from "react";

export type LightboxPhoto = { url: string; kind: string };

export function SurveyThumbnails({ shopName, photos }: { shopName: string; photos: LightboxPhoto[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (photos.length === 0) {
    return <p className="text-xs text-slate-400">No photos</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${p.url}-${i}`} src={p.url} alt={`${shopName} — ${p.kind} photo ${i + 1}`}
            onClick={() => setOpenAt(i)}
            className="h-16 w-16 cursor-pointer rounded-lg border border-slate-200 object-cover transition hover:opacity-80" />
        ))}
      </div>
      {openAt !== null ? (
        <Lightbox shopName={shopName} photos={photos} index={openAt} onIndex={setOpenAt} onClose={() => setOpenAt(null)} />
      ) : null}
    </>
  );
}

function Lightbox({ shopName, photos, index, onIndex, onClose }: {
  shopName: string; photos: LightboxPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photo = photos[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4" onClick={onClose}>
      <div className="flex w-full max-w-4xl items-center justify-between text-sm text-slate-200">
        <p>{shopName} — {photo.kind} photo ({index + 1} / {photos.length})</p>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-200 hover:bg-white/10" aria-label="Close">
          Close ✕
        </button>
      </div>
      <div className="relative flex w-full max-w-4xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 ? (
          <button onClick={prev} aria-label="Previous photo"
            className="absolute left-0 rounded-full bg-black/40 p-3 text-white hover:bg-black/60">‹</button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`${shopName} — ${photo.kind} photo ${index + 1}`}
          className="max-h-[75vh] max-w-full rounded-lg object-contain" />
        {photos.length > 1 ? (
          <button onClick={next} aria-label="Next photo"
            className="absolute right-0 rounded-full bg-black/40 p-3 text-white hover:bg-black/60">›</button>
        ) : null}
      </div>
    </div>
  );
}
