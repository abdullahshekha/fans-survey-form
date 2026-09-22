"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DEFAULT_FILL = "#0f172a";
const HIGHLIGHT_FILL = "#2563eb";

export function BarChartCard({
  title,
  data,
  highlightLabel,
}: {
  title: string;
  data: { label: string; value: number }[];
  highlightLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" angle={-40} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.label === highlightLabel ? HIGHLIGHT_FILL : DEFAULT_FILL} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
