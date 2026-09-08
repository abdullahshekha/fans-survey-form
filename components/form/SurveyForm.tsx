"use client";
import { useState } from "react";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { BrandField } from "./BrandField";
import { GpsCapture } from "./GpsCapture";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceRecorder } from "./VoiceRecorder";
import { MARKETS, SHOP_SIZES } from "@/lib/constants";
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

      <TextField label="Shop name" name="shop_name" value={v.shop_name}
        onChange={(x) => set("shop_name", x)} error={errors.shop_name} />
      <SelectField label="Market" name="market" value={v.market}
        onChange={(x) => set("market", x)} error={errors.market} options={MARKETS} placeholder="Choose a market" />
      <SelectField label="Shop size" name="shop_size" value={v.shop_size}
        onChange={(x) => set("shop_size", x)} error={errors.shop_size} options={SHOP_SIZES} placeholder="Select a size" />
      <TextField label="Customer name" name="customer_name" value={v.customer_name}
        onChange={(x) => set("customer_name", x)} error={errors.customer_name} />
      <TextField label="Customer number" name="customer_number" type="tel" inputMode="tel"
        value={v.customer_number} onChange={(x) => set("customer_number", x)} error={errors.customer_number} />

      <div data-region="gps" data-invalid={errors.gps ? "true" : undefined}>
        <GpsCapture value={v.gps} onChange={(f) => set("gps", f)} />
        {errors.gps ? <span role="alert" className="text-xs text-red-600">{errors.gps}</span> : null}
      </div>

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

      <BrandField label="Most selling fan" name="most_selling_fan"
        value={v.most_selling_fan} otherValue={v.most_selling_fan_other}
        onChange={(x) => set("most_selling_fan", x)} onOtherChange={(x) => set("most_selling_fan_other", x)}
        error={errors.most_selling_fan || errors.most_selling_fan_other} />
      <BrandField label="30W — Recommend 1" name="rec_30w_1"
        value={v.rec_30w_1} otherValue={v.rec_30w_1_other}
        onChange={(x) => set("rec_30w_1", x)} onOtherChange={(x) => set("rec_30w_1_other", x)}
        error={errors.rec_30w_1 || errors.rec_30w_1_other} />
      <BrandField label="30W — Recommend 2 (optional)" name="rec_30w_2" placeholder="None"
        value={v.rec_30w_2} otherValue={v.rec_30w_2_other}
        onChange={(x) => set("rec_30w_2", x)} onOtherChange={(x) => set("rec_30w_2_other", x)}
        error={errors.rec_30w_2 || errors.rec_30w_2_other} />
      <BrandField label="50W — Recommend 1" name="rec_50w_1"
        value={v.rec_50w_1} otherValue={v.rec_50w_1_other}
        onChange={(x) => set("rec_50w_1", x)} onOtherChange={(x) => set("rec_50w_1_other", x)}
        error={errors.rec_50w_1 || errors.rec_50w_1_other} />
      <BrandField label="50W — Recommend 2 (optional)" name="rec_50w_2" placeholder="None"
        value={v.rec_50w_2} otherValue={v.rec_50w_2_other}
        onChange={(x) => set("rec_50w_2", x)} onOtherChange={(x) => set("rec_50w_2_other", x)}
        error={errors.rec_50w_2 || errors.rec_50w_2_other} />

      <div data-region="voice">
        <VoiceRecorder value={v.audio} onChange={(b) => set("audio", b)} />
      </div>

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
