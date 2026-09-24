"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/surveys", label: "Surveys" },
  { href: "/admin/map", label: "Map" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/housekeeping", label: "Housekeeping" },
];

export function AdminNav({ horizontal }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={horizontal ? "flex gap-1 overflow-x-auto py-2" : "flex flex-col gap-0.5"}>
      {TABS.map((t) => {
        const active = pathname === t.href || pathname?.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
