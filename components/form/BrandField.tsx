"use client";
import { BRAND_SELECT_OPTIONS, MAX_OTHER_BRAND_LEN, OTHER_BRAND } from "@/lib/constants";

interface Props {
  label: string;
  name: string;
  value: string;
  otherValue: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}

export function BrandField({
  label, name, value, otherValue, onChange, onOtherChange, error, placeholder = "Select a brand",
}: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        name={name} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
      >
        <option value="">{placeholder}</option>
        {BRAND_SELECT_OPTIONS.map((o) => (
          <option key={o} value={o}>{o === OTHER_BRAND ? "Other…" : o}</option>
        ))}
      </select>
      {value === OTHER_BRAND ? (
        <input
          name={`${name}_other`} value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          maxLength={MAX_OTHER_BRAND_LEN} placeholder="Type the brand name"
          aria-label={`${label} — brand name`}
          aria-invalid={!!error}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base font-normal"
        />
      ) : null}
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
