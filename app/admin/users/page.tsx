import { createAdminSupabase } from "@/lib/supabase/admin";
import { AddRepForm } from "@/components/admin/AddRepForm";
import { RepRow } from "@/components/admin/RepRow";

export default async function AdminUsersPage() {
  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles")
    .select("id, username, full_name, active").eq("role", "rep").order("username");
  const { data: counts } = await db.from("surveys").select("rep_id");
  const countBy = new Map<string, number>();
  (counts ?? []).forEach((r: any) => countBy.set(r.rep_id, (countBy.get(r.rep_id) ?? 0) + 1));

  return (
    <div className="flex flex-col gap-6">
      <AddRepForm />
      <table className="w-full">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <th className="py-2">Username</th><th>Name</th><th className="text-center">Surveys</th><th></th>
        </tr></thead>
        <tbody>
          {(reps ?? []).map((r: any) => (
            <RepRow key={r.id} rep={{ ...r, count: countBy.get(r.id) ?? 0 }} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
