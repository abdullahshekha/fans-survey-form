"use client";
import { useActionState, useEffect, useRef } from "react";
import { createRep } from "@/app/admin/users/actions";

export function AddRepForm() {
  const [state, action, pending] = useActionState(createRep, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
      <label className="flex flex-col text-xs font-medium">Username
        <input name="username" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Full name
        <input name="full_name" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Password
        <input name="password" type="text" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <button disabled={pending} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add rep"}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p role="status" className="w-full text-sm text-emerald-600">Rep added.</p> : null}
    </form>
  );
}
