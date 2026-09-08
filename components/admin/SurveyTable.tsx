import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { AdminSurveyRow } from "@/lib/adminQueries";

export function SurveyTable({ rows }: { rows: AdminSurveyRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No surveys match these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <th className="py-2">Date</th><th>Rep</th><th>Shop</th><th>Market</th><th>Size</th><th>Most selling</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2"><Link href={`/survey/${r.id}`} className="block">{formatDateTime(r.created_at)}</Link></td>
              <td>{r.rep_username}</td>
              <td><Link href={`/survey/${r.id}`} className="block">{r.shop_name}</Link></td>
              <td>{r.market}</td>
              <td>{r.shop_size}</td>
              <td>{r.most_selling_fan}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
