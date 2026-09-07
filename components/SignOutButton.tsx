"use client";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await createBrowserSupabase().auth.signOut(); router.push("/login"); router.refresh(); }}
      className="text-sm text-slate-500 underline">
      Sign out
    </button>
  );
}
