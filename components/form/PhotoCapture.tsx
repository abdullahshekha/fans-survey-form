"use client";
import { useMemo, useRef, useState } from "react";
import { compressImage, compressDocument } from "@/lib/compression";
import { MAX_INNER_PHOTOS, MAX_QUOTATION_PHOTOS } from "@/lib/constants";

interface Props {
  front: File | null;
  inner: File[];
  quotation: File[];
  onFrontChange: (f: File | null) => void;
  onInnerChange: (files: File[]) => void;
  onQuotationChange: (files: File[]) => void;
}

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
      <img src={url} alt={file.name} className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">✕</button>
    </div>
  );
}

export function PhotoCapture({ front, inner, quotation, onFrontChange, onInnerChange, onQuotationChange }: Props) {
  const [notice, setNotice] = useState("");
  const busy = useRef(false);

  async function handleFront(files: FileList | null) {
    if (!files?.[0]) return;
    onFrontChange(await compressImage(files[0]));
  }

  async function addPhotos(
    files: FileList | null,
    current: File[],
    max: number,
    compress: (f: File) => Promise<File>,
    onChange: (files: File[]) => void,
    noun: string,
  ) {
    if (!files || busy.current) return;
    busy.current = true;
    try {
      const room = max - current.length;
      if (room <= 0) { setNotice(`You can attach a maximum of ${max} ${noun}.`); return; }
      const picked = Array.from(files).slice(0, room);
      if (picked.length < files.length) setNotice(`Only ${room} more ${noun} could be added (max ${max}).`);
      else setNotice("");
      const compressed = await Promise.all(picked.map(compress));
      onChange([...current, ...compressed]);
    } finally {
      busy.current = false;
    }
  }

  const handleInner = (files: FileList | null) =>
    addPhotos(files, inner, MAX_INNER_PHOTOS, compressImage, onInnerChange, "inner photos");
  const handleQuotation = (files: FileList | null) =>
    addPhotos(files, quotation, MAX_QUOTATION_PHOTOS, compressDocument, onQuotationChange, "quotation photos");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Front photo</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="front-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleFront(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="front-gallery-input" type="file" accept="image/*" hidden
              onChange={(e) => handleFront(e.target.files)} />
          </label>
        </div>
        {front ? <div className="flex"><Thumb file={front} onRemove={() => onFrontChange(null)} /></div> : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Inner photos ({inner.length}/{MAX_INNER_PHOTOS})</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="inner-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleInner(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="inner-gallery-input" type="file" accept="image/*" multiple hidden
              onChange={(e) => handleInner(e.target.files)} />
          </label>
        </div>
        {notice ? <span role="status" className="text-xs text-amber-700">{notice}</span> : null}
        <div className="flex flex-wrap gap-2">
          {inner.map((f, i) => (
            <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => onInnerChange(inner.filter((_, j) => j !== i))} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Quotation photo — optional ({quotation.length}/{MAX_QUOTATION_PHOTOS})</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="quotation-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleQuotation(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="quotation-gallery-input" type="file" accept="image/*" multiple hidden
              onChange={(e) => handleQuotation(e.target.files)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {quotation.map((f, i) => (
            <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => onQuotationChange(quotation.filter((_, j) => j !== i))} />
          ))}
        </div>
      </div>
    </div>
  );
}
