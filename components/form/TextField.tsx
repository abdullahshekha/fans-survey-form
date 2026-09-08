"use client";
interface Props {
  label: string; name: string; value: string;
  onChange: (v: string) => void; error?: string;
  type?: "text" | "tel"; inputMode?: "text" | "tel" | "numeric";
}
export function TextField({ label, name, value, onChange, error, type = "text", inputMode }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name} type={type} inputMode={inputMode} value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 px-3 py-2 text-base"
      />
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
