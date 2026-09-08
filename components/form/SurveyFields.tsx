"use client";
import type React from "react";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { BrandField } from "./BrandField";
import { GpsCapture } from "./GpsCapture";
import { MARKETS, SHOP_SIZES } from "@/lib/constants";
import type { SurveyFormValues } from "@/lib/validation";

export function SurveyFields({
  v, set, errors, photos, voice,
}: {
  v: SurveyFormValues;
  set: <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => void;
  errors: Record<string, string>;
  photos: React.ReactNode;
  voice: React.ReactNode;
}) {
  return (
    <>
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

      {photos}

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

      {voice}
    </>
  );
}
