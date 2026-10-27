"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { rupiah, rupiahShort, formatPercent } from "@/lib/format";

// Validated (CVD-safe) two-series palette: income / expense.
export const CHART = { income: "#0A8A74", expense: "#E0904A", grid: "#EDEAE3", axis: "#5F6B7A" };

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const inc = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const exp = payload.find((p) => p.dataKey === "expense")?.value ?? 0;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-lift">
      <p className="mb-1 font-bold text-charcoal">{label}</p>
      <p className="flex items-center gap-2 text-charcoal"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART.income }} /> Pemasukan <span className="tabular ml-auto pl-3 font-semibold">{rupiah(inc)}</span></p>
      <p className="flex items-center gap-2 text-charcoal"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART.expense }} /> Pengeluaran <span className="tabular ml-auto pl-3 font-semibold">{rupiah(exp)}</span></p>
      <p className="mt-1 border-t border-line pt-1 text-muted">Selisih <span className="tabular font-semibold text-charcoal">{rupiah(inc - exp, { sign: true })}</span></p>
    </div>
  );
}

export function ChartLegend({ large }: { large?: boolean }) {
  return (
    <div className={`flex items-center gap-4 ${large ? "text-lg" : "text-sm"} text-muted`}>
      <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: CHART.income }} /> Pemasukan</span>
      <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: CHART.expense }} /> Pengeluaran</span>
    </div>
  );
}

export function FlowChart({
  data,
  height = 260,
  large,
}: {
  data: { label: string; income: number; expense: number }[];
  height?: number;
  large?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Grafik pemasukan dan pengeluaran">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: large ? 16 : 12 }} dy={6} />
          <YAxis tickLine={false} axisLine={false} width={large ? 80 : 62} tick={{ fill: CHART.axis, fontSize: large ? 14 : 11 }} tickFormatter={(v) => rupiahShort(v).replace("Rp", "")} />
          <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgba(8,127,109,0.06)" }} />
          <Bar dataKey="income" fill={CHART.income} radius={[4, 4, 0, 0]} maxBarSize={large ? 44 : 22} animationDuration={900} />
          <Bar dataKey="expense" fill={CHART.expense} radius={[4, 4, 0, 0]} maxBarSize={large ? 44 : 22} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked horizontal bars — clearer than a pie for category shares. Single hue (magnitude). */
export function CategoryBars({
  rows,
  tone = "income",
  large,
  limit = 6,
}: {
  rows: { name: string; amount: number }[];
  tone?: "income" | "expense";
  large?: boolean;
  limit?: number;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const top = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.amount, 0);
  const list = rest > 0 ? [...top, { name: "Lainnya", amount: rest }] : top;
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Belum ada data pada periode ini.</p>;
  return (
    <ul className={large ? "space-y-5" : "space-y-3.5"}>
      {list.map((r, i) => (
        <li key={r.name} title={`${r.name}: ${rupiah(r.amount)}`}>
          <div className={`flex items-baseline justify-between gap-3 ${large ? "text-xl" : "text-sm"}`}>
            <span className="truncate font-medium text-charcoal">{r.name}</span>
            <span className="tabular shrink-0 font-semibold text-charcoal">
              {rupiah(r.amount)} <span className="font-normal text-muted">· {formatPercent((r.amount / total) * 100)}</span>
            </span>
          </div>
          <div className={`mt-1.5 w-full overflow-hidden rounded-full bg-stone-100 ${large ? "h-4" : "h-2"}`}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: tone === "income" ? CHART.income : CHART.expense }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.amount / max) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
