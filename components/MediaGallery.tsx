"use client";
import { useState } from "react";

export function MediaGallery({ photos }: { photos: { kind: "front" | "inner" | "quotation"; url: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <button key={i} type="button" onClick={() => setActive(p.url)}
          className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
          <img src={p.url} alt={p.kind === "front" ? "Shop front" : p.kind === "quotation" ? `Quotation ${i + 1}` : `Inner photo ${i}`} className="h-full w-full object-cover" />
        </button>
      ))}
      {active ? (
        <div role="dialog" aria-modal onClick={() => setActive(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <img src={active} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
