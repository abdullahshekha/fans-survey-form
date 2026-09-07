import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

const TABS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/surveys", label: "Surveys" },
  { href: "/admin/map", label: "Map" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fan Retailer Survey — Admin</h1>
        <SignOutButton />
      </header>
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
