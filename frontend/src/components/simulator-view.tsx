"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { SubjectCard } from "@/types/dashboard";

function pct(present: number, total: number) {
  if (total <= 0) return 0;
  return (present / total) * 100;
}

function colorFor(value: number) {
  if (value >= 75) return "text-emerald-400";
  if (value >= 65) return "text-amber-400";
  return "text-rose-400";
}

function useAnimatedPercent(target: number) {
  const mv = useMotionValue(target);
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    const controls = animate(mv, target, {
      duration: 0.35,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest)
    });
    return () => controls.stop();
  }, [mv, target]);

  return display;
}

export function SimulatorView({ subjects }: { subjects: SubjectCard[] }) {
  const [selected, setSelected] = useState(subjects[0]?.professor ?? "");
  const [attendNext, setAttendNext] = useState(5);
  const [skipNext, setSkipNext] = useState(3);
  const [targetPct, setTargetPct] = useState(80);

  const subject = useMemo(
    () => subjects.find((s) => s.professor === selected) ?? subjects[0],
    [selected, subjects]
  );

  const basePresent = subject?.present ?? 0;
  const baseTotal = subject?.total ?? 0;
  const basePct = pct(basePresent, baseTotal);

  const projectedPresent = basePresent + attendNext;
  const projectedTotal = baseTotal + attendNext + skipNext;
  const projectedPct = pct(projectedPresent, projectedTotal);

  const animated = useAnimatedPercent(projectedPct);
  const delta = projectedPct - basePct;

  const neededConsecutive = useMemo(() => {
    const currentP = basePresent;
    const currentT = baseTotal;
    if (currentT <= 0) return 0;
    if (pct(currentP, currentT) >= targetPct) return 0;
    for (let k = 1; k <= 400; k++) {
      const np = currentP + k;
      const nt = currentT + k;
      if (pct(np, nt) >= targetPct) return k;
    }
    return 400;
  }, [basePresent, baseTotal, targetPct]);

  if (!subject) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">No data yet. Log a few classes first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Simulator</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">What-if Attendance Sandbox</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Drag sliders and watch the projection update in real time.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">Current</div>
            <div className={`font-mono text-lg ${colorFor(basePct)}`}>{basePct.toFixed(1)}%</div>
            <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {basePresent}/{baseTotal}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-6">
          <label className="text-sm font-medium">Subject</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200/50 bg-white/70 px-3 py-2 text-sm outline-none backdrop-blur dark:border-white/10 dark:bg-white/5"
          >
            {subjects.map((s) => (
              <option key={s.professor} value={s.professor}>
                {s.professor}
              </option>
            ))}
          </select>

          <div className="mt-6 space-y-8">
            <div className="group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Attend Next</p>
                <div className="rounded-lg bg-violet-500/20 px-3 py-1 font-mono text-sm font-bold text-violet-400">
                  {attendNext} Classes
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={attendNext}
                onChange={(e) => setAttendNext(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-violet-600 transition-all hover:bg-slate-300 dark:bg-white/10 dark:accent-violet-500"
                style={{ touchAction: "manipulation" }}
              />
            </div>

            <div className="group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Skip Next</p>
                <div className="rounded-lg bg-rose-500/20 px-3 py-1 font-mono text-sm font-bold text-rose-400">
                  {skipNext} Classes
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={skipNext}
                onChange={(e) => setSkipNext(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-rose-600 transition-all hover:bg-slate-300 dark:bg-white/10 dark:accent-rose-500"
                style={{ touchAction: "manipulation" }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/12 via-indigo-400/10 to-cyan-400/10" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Projected Percentage
            </p>

            <motion.div
              layout
              className={`mt-3 font-mono text-6xl font-semibold tracking-tight md:text-7xl ${colorFor(projectedPct)}`}
            >
              {animated.toFixed(1)}%
            </motion.div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-mono">
                {projectedPresent}/{projectedTotal}
              </div>
              <div className="font-mono">
                Δ{" "}
                <span className={delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Target Calculator</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter a target % and we’ll compute the exact consecutive classes needed.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-sm font-medium">Target %</label>
            <input
              type="number"
              min={1}
              max={99}
              value={targetPct}
              onChange={(e) => setTargetPct(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200/50 bg-white/70 px-3 py-2 font-mono text-sm outline-none backdrop-blur dark:border-white/10 dark:bg-white/5"
            />
          </div>

          <div className="md:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {pct(basePresent, baseTotal) >= targetPct ? (
                <p className="text-sm text-emerald-300">
                  You already have <span className="font-mono">{basePct.toFixed(1)}%</span> — above{" "}
                  <span className="font-mono">{targetPct}%</span>.
                </p>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  You need to attend{" "}
                  <span className="font-mono text-2xl font-semibold text-violet-300">{neededConsecutive}</span>{" "}
                  consecutive classes to reach <span className="font-mono">{targetPct}%</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

