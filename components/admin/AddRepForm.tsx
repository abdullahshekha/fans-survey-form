"use client";
import { useActionState, useEffect, useRef } from "react";
import { createRep } from "@/app/admin/users/actions";

export function AddRepForm() {
  const [state, action, pending] = useActionState(createRep, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex flex-col text-xs font-medium text-slate-600">Username
        <input name="username" required className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" /></label>
      <label className="flex flex-col text-xs font-medium text-slate-600">Full name
        <input name="full_name" required className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" /></label>
      <label className="flex flex-col text-xs font-medium text-slate-600">Password
        <input name="password" type="text" required className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" /></label>
      <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Adding…" : "Add rep"}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p role="status" className="w-full text-sm text-emerald-600">Rep added.</p> : null}
    </form>
  );
}
