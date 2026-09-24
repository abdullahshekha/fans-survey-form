import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-1">
          <p className="text-sm font-semibold leading-tight text-slate-900">Fan Retailer Survey</p>
          <p className="text-xs text-slate-500">Admin</p>
        </div>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4">
          <p className="px-1 text-xs text-slate-500">Signed in as {profile.username}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <p className="text-sm font-semibold">Fan Retailer Survey — Admin</p>
          <SignOutButton />
        </header>
        <div className="border-b border-slate-200 bg-white px-4 md:hidden">
          <AdminNav horizontal />
        </div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
