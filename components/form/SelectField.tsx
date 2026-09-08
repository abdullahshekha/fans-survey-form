"use client";
interface Props {
  label: string; name: string; value: string;
  onChange: (v: string) => void; error?: string;
  options: readonly string[]; placeholder: string;
}
export function SelectField({ label, name, value, onChange, error, options, placeholder }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        name={name} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
