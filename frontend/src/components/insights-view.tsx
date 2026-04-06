"use client";

import { DashboardSummary } from "@/types/dashboard";
import { MonthlySnapshot } from "@/types/dashboard";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useMemo, useState } from "react";

function colorFor(value: number) {
  if (value >= 75) return "text-emerald-400";
  if (value >= 65) return "text-amber-400";
  return "text-rose-400";
}

function MonthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <div className="font-medium">{label}</div>
      <div className="mt-1 font-mono text-slate-700 dark:text-slate-200">
        {p.percentage?.toFixed?.(1)}% · {p.present}/{p.total}
      </div>
    </div>
  );
}

function DowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <div className="font-medium">{label}</div>
      <div className="mt-1 font-mono text-slate-700 dark:text-slate-200">{Number(value).toFixed(1)}%</div>
    </div>
  );
}

export function InsightsView({ summary, snapshots }: { summary: DashboardSummary; snapshots: MonthlySnapshot[] }) {
  const projected = summary.predictive_trajectory.projected_percentage;
  const initialKey = snapshots?.[snapshots.length - 1]?.month_key ?? "";
  const [selected, setSelected] = useState(initialKey);

  const selectedSnapshot = useMemo(
    () => snapshots.find((s) => s.month_key === selected) ?? snapshots[snapshots.length - 1],
    [selected, snapshots]
  );

  return (
    <div className="space-y-6">
      <section className="glass-card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/10 via-indigo-400/10 to-cyan-400/10" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Predictive Trajectory
          </p>
          <p className="mt-2 text-lg font-semibold">
            At this rate, you will end the semester at{" "}
            <span className={`font-mono ${colorFor(projected)}`}>{projected.toFixed(1)}%</span>
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Projection is based on your current pattern and pace.
          </p>
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">🗓️ Monthly Report Cards</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Snapshots reflect your cumulative attendance as it stood at each month end.
            </p>
          </div>
          {selectedSnapshot?.insight ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-600 dark:text-slate-200">
              {selectedSnapshot.insight}
            </div>
          ) : null}
        </div>

        {snapshots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-600 dark:text-slate-300">
            No monthly snapshots yet. Log more data across at least one month.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {snapshots.map((s) => {
                const active = s.month_key === selected;
                return (
                  <button
                    key={s.month_key}
                    type="button"
                    onClick={() => setSelected(s.month_key)}
                    className={`rounded-2xl border px-4 py-2 text-left transition ${
                      active
                        ? "border-violet-400/40 bg-violet-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{s.overall.percentage.toFixed(1)}%</span>
                      {s.is_mtd ? (
                        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-cyan-300">
                          Month-to-date
                        </span>
                      ) : null}
                      {s.is_complete ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                          Final
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedSnapshot ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Overall @ {selectedSnapshot.cutoff_date}
                  </div>
                  <div className={`mt-2 font-mono text-4xl ${colorFor(selectedSnapshot.overall.percentage)}`}>
                    {selectedSnapshot.overall.percentage.toFixed(1)}%
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {selectedSnapshot.overall.present}/{selectedSnapshot.overall.total}
                  </div>
                  {selectedSnapshot.overall_delta !== null ? (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      Δ{" "}
                      <span className={`font-mono ${selectedSnapshot.overall_delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {selectedSnapshot.overall_delta >= 0 ? "+" : ""}
                        {selectedSnapshot.overall_delta.toFixed(1)}%
                      </span>{" "}
                      vs last month
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">First month tracked</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Subject-wise breakdown
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedSnapshot.subjects.map((sub) => {
                      const safe = sub.percentage >= 75;
                      const delta = selectedSnapshot.deltas?.[sub.subject];
                      return (
                        <div key={sub.subject} className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{sub.subject}</div>
                            <div className="flex items-center gap-2">
                              {typeof delta === "number" ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                                    delta >= 0
                                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                      : "border-rose-400/30 bg-rose-400/10 text-rose-300"
                                  }`}
                                >
                                  {delta >= 0 ? "+" : ""}
                                  {delta.toFixed(1)}%
                                </span>
                              ) : null}
                              <span className={`font-mono text-xs ${colorFor(sub.percentage)}`}>{sub.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded bg-white/10">
                            <div
                              className={`h-full rounded ${safe ? "bg-emerald-500" : "bg-rose-500"}`}
                              style={{ width: `${Math.max(0, Math.min(100, sub.percentage))}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">
                              {Number.isInteger(sub.present) ? sub.present : sub.present.toFixed(1)}/
                              {Number.isInteger(sub.total) ? sub.total : sub.total.toFixed(1)}
                            </span>
                            <span className={safe ? "text-emerald-300" : "text-rose-300"}>{sub.status_hint}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Month-wise Trends</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Smooth trend of monthly attendance %.</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.month_trend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendaceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#4f46e5" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MonthTooltip />} trigger="click" />
                <Area
                  type="monotone"
                  dataKey="percentage"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#attendaceGradient)"
                  dot={false}
                  activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Burnout Analysis</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Attendance % by day of week.</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.burnout_analysis} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.10)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => val.slice(0, 3)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DowTooltip />} trigger="click" cursor={{ fill: "rgba(139,92,246,0.08)" }} />
                <Bar dataKey="attendance" radius={[6, 6, 0, 0]} fill="rgba(139,92,246,0.75)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Bunk Budget Matrix</h2>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">
              Max skips allowed while staying above 75%
            </p>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2">Subject / Professor</th>
                <th className="px-4 py-2">Current %</th>
                <th className="px-4 py-2 text-center">Safe Skips</th>
                <th className="px-4 py-2">Requirement Alert</th>
              </tr>
            </thead>
            <tbody>
              {summary.subject_cards.map((s) => {
                const safe = s.percentage >= 75;
                return (
                  <tr key={s.professor} className="group transition-colors hover:bg-white/5">
                    <td className="px-4 py-4 rounded-l-2xl border-y border-l border-white/5 bg-white/5">
                      <div className="font-bold">{s.professor}</div>
                      <div className="text-[10px] font-bold text-slate-500 font-mono mt-0.5">
                        {s.present}P / {s.total}T
                      </div>
                    </td>
                    <td className="px-4 py-4 border-y border-white/5 bg-white/5">
                      <span className={`font-mono font-bold text-lg ${colorFor(s.percentage)}`}>{s.percentage.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-4 border-y border-white/5 bg-white/5 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[32px] rounded-lg border px-2 py-1 font-mono font-bold text-sm ${
                          safe
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                            : "border-rose-400/30 bg-rose-400/10 text-rose-400 opacity-50"
                        }`}
                      >
                        {safe ? s.safe_to_skip : 0}
                      </span>
                    </td>
                    <td className="px-4 py-4 rounded-r-2xl border-y border-r border-white/5 bg-white/5">
                      <div className={`text-xs font-bold ${safe ? "text-slate-400" : "text-rose-400 animate-pulse"}`}>
                        {safe ? `Safe to skip next ${s.safe_to_skip}` : `Must attend next ${s.need_to_attend}`}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {summary.subject_cards.map((s) => {
            const safe = s.percentage >= 75;
            return (
              <div key={s.professor} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-sm">{s.professor}</div>
                  <span className={`font-mono font-bold ${colorFor(s.percentage)}`}>{s.percentage.toFixed(1)}%</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Safe Skips</div>
                    <div className={`text-xl font-black font-mono ${safe ? "text-emerald-400" : "text-rose-400 opacity-50"}`}>
                      {safe ? s.safe_to_skip : 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</div>
                    <div className={`text-[11px] font-bold leading-tight ${safe ? "text-slate-300" : "text-rose-400"}`}>
                      {safe ? `Safe to skip ${s.safe_to_skip}` : `Need ${s.need_to_attend} more`}
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 text-[10px] font-bold text-slate-500 font-mono">
                  Current Session: {s.present} Present / {s.total} Total
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

