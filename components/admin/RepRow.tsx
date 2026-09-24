"use client";
import { useTransition } from "react";
import { setRepActive } from "@/app/admin/users/actions";

export function RepRow({ rep }: { rep: { id: string; username: string; full_name: string; active: boolean; count: number } }) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-3">{rep.username}</td>
      <td>{rep.full_name}</td>
      <td>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rep.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
          {rep.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="text-center">{rep.count}</td>
      <td className="text-right">
        <button disabled={pending} onClick={() => start(() => setRepActive(rep.id, !rep.active))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {rep.active ? "Deactivate" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}
