"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Fan Retailer Survey</h1>
        <p className="text-sm text-slate-500">Sign in to record shop visits.</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Username
          <input name="username" autoCapitalize="none" autoCorrect="off" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input name="password" type="password" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
