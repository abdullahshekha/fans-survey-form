"use client";
import { useState } from "react";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceRecorder } from "./VoiceRecorder";
import { SurveyFields } from "./SurveyFields";
import { validateSurvey, type SurveyFormValues, type GpsFix } from "@/lib/validation";

const EMPTY: SurveyFormValues = {
  shop_name: "", market: "", shop_size: "", customer_name: "", customer_number: "",
  gps: null, most_selling_fan: "", rec_30w_1: "", rec_30w_2: "", rec_50w_1: "", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

export function SurveyForm({ onSubmit, onDirty }: { onSubmit: (v: SurveyFormValues) => Promise<void>; onDirty?: () => void }) {
  const [v, setV] = useState<SurveyFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => {
    onDirty?.();
    setV((s) => ({ ...s, [k]: val }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSurvey(v);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-28">
      <h1 className="text-xl font-semibold">New shop survey</h1>

      <SurveyFields
        v={v}
        set={set}
        errors={errors}
        photos={
          <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos || errors.quotationPhotos ? "true" : undefined}>
            <PhotoCapture
              front={v.frontPhoto} inner={v.innerPhotos} quotation={v.quotationPhotos}
              onFrontChange={(f) => set("frontPhoto", f)}
              onInnerChange={(files) => set("innerPhotos", files)}
              onQuotationChange={(f) => set("quotationPhotos", f)}
            />
            {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
            {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
            {errors.quotationPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.quotationPhotos}</span> : null}
          </div>
        }
        voice={
          <div data-region="voice">
            <VoiceRecorder value={v.audio} onChange={(b) => set("audio", b)} />
            {errors.audio ? <span role="alert" className="block text-xs text-red-600">{errors.audio}</span> : null}
          </div>
        }
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60">
          {busy ? "Submitting…" : "Submit survey"}
        </button>
      </div>
    </form>
  );
}

export { EMPTY as EMPTY_SURVEY };
