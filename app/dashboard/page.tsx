import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRepSurveys } from "@/lib/queries";
import { relativeDate } from "@/lib/format";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/overview");

  const supabase = await createServerSupabase();
  const surveys = await getRepSurveys(supabase, profile.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Signed in as {profile.full_name}</p>
          <h1 className="text-xl font-semibold">Your surveys</h1>
        </div>
        <SignOutButton />
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-4xl font-bold">{surveys.length}</p>
        <p className="text-sm text-slate-500">surveys submitted</p>
      </div>

      <Link href="/survey/new"
        className="rounded-lg bg-slate-900 py-3 text-center text-base font-medium text-white">
        + New Survey
      </Link>

      <ul className="flex flex-col gap-2">
        {surveys.length === 0 ? <li className="text-sm text-slate-500">No surveys yet.</li> : null}
        {surveys.map((s) => (
          <li key={s.id}>
            <Link href={`/survey/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <span>
                <span className="block font-medium">{s.shop_name}</span>
                <span className="block text-xs text-slate-500">
                  {s.market} · {relativeDate(s.created_at)}
                  {s.edited_at ? <span className="ml-1 text-amber-700">· Edited</span> : null}
                </span>
              </span>
              <span aria-hidden className="text-slate-300">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
