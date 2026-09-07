"use client";
import { useTransition } from "react";
import { setRepActive } from "@/app/admin/users/actions";

export function RepRow({ rep }: { rep: { id: string; username: string; full_name: string; active: boolean; count: number } }) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-2">{rep.username}</td>
      <td>{rep.full_name}</td>
      <td className="text-center">{rep.count}</td>
      <td className="text-right">
        <button disabled={pending} onClick={() => start(() => setRepActive(rep.id, !rep.active))}
          className="rounded border border-slate-300 px-2 py-1 text-xs">
          {rep.active ? "Deactivate" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}
