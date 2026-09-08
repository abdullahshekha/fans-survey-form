"use client";
import { useState, useTransition } from "react";
import { sweepOrphans } from "@/app/admin/housekeeping/actions";

export function SweepButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string>("");
  return (
    <div className="flex flex-col gap-2">
      <button disabled={pending} onClick={() => start(async () => {
        const { removedFiles } = await sweepOrphans();
        setResult(`Removed ${removedFiles} orphaned file(s).`);
      })} className="self-start rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Scanning…" : "Clean up orphaned files"}
      </button>
      {result ? <p role="status" className="text-sm text-emerald-700">{result}</p> : null}
    </div>
  );
}
