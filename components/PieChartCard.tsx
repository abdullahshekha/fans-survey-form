"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#0f172a", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0", "#0ea5e9", "#a3a3a3"];
const HIGHLIGHT_FILL = "#2563eb";

export function PieChartCard({
  title,
  data,
  highlightLabel,
}: {
  title: string;
  data: { label: string; value: number }[];
  highlightLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={1}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={d.label === highlightLabel ? HIGHLIGHT_FILL : PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
