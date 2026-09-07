"use client";
import { useState } from "react";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { BRANDS, MARKETS, SHOP_SIZES } from "@/lib/constants";
import { validateSurvey, type SurveyFormValues, type GpsFix } from "@/lib/validation";

const EMPTY: SurveyFormValues = {
  shop_name: "", market: "", shop_size: "", customer_name: "", customer_number: "",
  gps: null, most_selling_fan: "", rec_30w_1: "", rec_30w_2: "", rec_50w_1: "", rec_50w_2: "",
  frontPhoto: null, innerPhotos: [], audio: null,
};

export function SurveyForm({ onSubmit }: { onSubmit: (v: SurveyFormValues) => Promise<void> }) {
  const [v, setV] = useState<SurveyFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

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
        {/* GpsCapture slotted in Task 15 */}
        {errors.gps ? <span role="alert" className="text-xs text-red-600">{errors.gps}</span> : null}
      </div>

      <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos ? "true" : undefined}>
        {/* PhotoCapture slotted in Task 16 */}
        {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
        {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
      </div>

      <SelectField label="Most selling fan" name="most_selling_fan" value={v.most_selling_fan}
        onChange={(x) => set("most_selling_fan", x)} error={errors.most_selling_fan} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="30W — Recommend 1" name="rec_30w_1" value={v.rec_30w_1}
        onChange={(x) => set("rec_30w_1", x)} error={errors.rec_30w_1} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="30W — Recommend 2 (optional)" name="rec_30w_2" value={v.rec_30w_2}
        onChange={(x) => set("rec_30w_2", x)} error={errors.rec_30w_2} options={BRANDS} placeholder="None" />
      <SelectField label="50W — Recommend 1" name="rec_50w_1" value={v.rec_50w_1}
        onChange={(x) => set("rec_50w_1", x)} error={errors.rec_50w_1} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="50W — Recommend 2 (optional)" name="rec_50w_2" value={v.rec_50w_2}
        onChange={(x) => set("rec_50w_2", x)} error={errors.rec_50w_2} options={BRANDS} placeholder="None" />

      <div data-region="voice">{/* VoiceRecorder slotted in Task 17 */}</div>

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
