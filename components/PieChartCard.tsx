"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#154545", "#1b5555", "#3a8f8f", "#6bb3b3", "#a8d3d3", "#0c2b2b", "#588080", "#94b8b8"];
const HIGHLIGHT_FILL = "#d98e2b";

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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={1}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={d.label === highlightLabel ? HIGHLIGHT_FILL : PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [`${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
