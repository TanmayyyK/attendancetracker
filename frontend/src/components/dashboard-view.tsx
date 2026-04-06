"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, GraduationCap, UserCheck, UserX } from "lucide-react";
import { CumulativeSubjectCard, DashboardSummary } from "@/types/dashboard";
import { createBulkAttendance } from "@/lib/api";
import { useRouter } from "next/navigation";

const SUBJECT_PROF_MAP: Record<string, string[]> = {
  Physiology: ["Anoop Sir", "Ritesh Mam"],
  Anatomy: ["Raghu Sir", "Akanksha Mam", "Tanvi Mam"],
  Samhita: ["Satish Sir (Dean)", "Dhaval Sir", "Mahesh Sir"],
  "Padarth Vigyan": ["Satish Sir (Dean)", "Dhaval Sir", "Mahesh Sir"],
  "Sanskrit (CM Sir)": ["CM Sir"]
};
const TEACHERS = [
  "Satish Sir (Dean)",
  "Raghu Sir",
  "Tanvi Mam",
  "Akanksha Mam",
  "Dhaval Sir",
  "Ritesh Mam",
  "Anoop Sir",
  "CM Sir",
  "Mahesh Sir"
];
const SUBJECTS = ["Physiology", "Anatomy", "Samhita", "Padarth Vigyan", "Sanskrit (CM Sir)"] as const;
type CountRow = { present: number; absent: number };

function colorForPercentage(value: number): string {
  if (value >= 75) return "text-emerald-500";
  if (value >= 65) return "text-amber-500";
  return "text-rose-500";
}

export function DashboardView({
  summary,
  cumulativeSubjects
}: {
  summary: DashboardSummary;
  cumulativeSubjects: CumulativeSubjectCard[];
}) {
  const router = useRouter();
  const { overall, subject_cards } = summary;
  const [openLog, setOpenLog] = useState(false);
  const [logMode, setLogMode] = useState<"subject" | "teacher">("subject");
  const [teacherCounts, setTeacherCounts] = useState<Record<string, CountRow>>(
    Object.fromEntries(TEACHERS.map((t) => [t, { present: 0, absent: 0 }]))
  );
  const [subjectCounts, setSubjectCounts] = useState<Record<string, CountRow>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }]))
  );
  const [saving, setSaving] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);

  const now = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const pendingRows = useMemo(() => {
    const src = logMode === "teacher" ? teacherCounts : subjectCounts;
    return Object.values(src).reduce((acc, cur) => acc + cur.present + cur.absent, 0);
  }, [logMode, subjectCounts, teacherCounts]);

  function updateCount(mode: "teacher" | "subject", keyName: string, type: keyof CountRow, delta: number) {
    const update = (prev: Record<string, CountRow>) => ({
      ...prev,
      [keyName]: { ...prev[keyName], [type]: Math.max(0, prev[keyName][type] + delta) }
    });
    if (mode === "teacher") setTeacherCounts(update);
    else setSubjectCounts(update);
  }

  async function quickLogSaveAll() {
    setSaving(true);
    setLogMessage(null);
    const today = new Date().toISOString().slice(0, 10);
    const rows =
      logMode === "teacher"
        ? TEACHERS.map((teacher) => ({
            date: today,
            mode: "teacher" as const,
            subject:
              teacher === "CM Sir"
                ? "Sanskrit (CM Sir)"
                : teacher === "Anoop Sir" || teacher === "Ritesh Mam"
                  ? "Physiology"
                  : teacher === "Raghu Sir" || teacher === "Akanksha Mam" || teacher === "Tanvi Mam"
                    ? "Anatomy"
                    : teacher === "Dhaval Sir"
                      ? "Padarth Vigyan"
                      : "Samhita",
            professor: teacher,
            present: teacherCounts[teacher].present,
            absent: teacherCounts[teacher].absent
          })).filter((r) => r.present + r.absent > 0)
        : SUBJECTS.map((subject) => ({
            date: today,
            mode: "subject" as const,
            subject,
            present: subjectCounts[subject].present,
            absent: subjectCounts[subject].absent
          })).filter((r) => r.present + r.absent > 0);

    if (rows.length === 0) {
      setSaving(false);
      setLogMessage("Add at least one entry first.");
      return;
    }
    const result = await createBulkAttendance(rows);
    setSaving(false);
    if (result.ok) {
      setLogMessage(`Saved ${result.inserted} entries.`);
      setTeacherCounts(Object.fromEntries(TEACHERS.map((t) => [t, { present: 0, absent: 0 }])));
      setSubjectCounts(Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }])));
      setOpenLog(false);
      router.refresh();
      return;
    }
    setLogMessage("Could not save entries. Check backend status.");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <section className="glass-card p-6 md:p-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">{now}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Dashboard</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">Your command center for attendance control.</p>
          </div>
          <div className="rounded-2xl bg-slate-900/80 px-5 py-3 font-mono text-3xl text-white shadow-xl dark:bg-white/10">
            <span className={colorForPercentage(overall.percentage)}>{overall.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Classes", value: overall.total, icon: GraduationCap },
          { label: "Present", value: overall.present, icon: UserCheck },
          { label: "Absent", value: overall.absent, icon: UserX },
          { label: "Streak", value: `${overall.streak}d`, icon: Flame }
        ].map((item) => (
          <div key={item.label} className="glass-card p-4">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-sm">{item.label}</span>
              <item.icon size={16} />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="glass-card p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">📚 Cumulative Performance</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Subject-level cumulative attendance.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cumulativeSubjects.map((s) => {
            const safe = s.percentage >= 75;
            const width = Math.max(0, Math.min(100, s.percentage));
            return (
              <div key={s.subject} className="rounded-xl border border-slate-200/50 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{s.subject}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                      safe
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-rose-400/30 bg-rose-400/10 text-rose-300"
                    }`}
                  >
                    {s.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                  <div
                    className={`h-full rounded ${safe ? "bg-emerald-500" : "bg-rose-500"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">
                    {Number.isInteger(s.present) ? s.present : s.present.toFixed(1)}/
                    {Number.isInteger(s.total) ? s.total : s.total.toFixed(1)}
                  </span>
                  <span className={safe ? "text-emerald-300" : "text-rose-300"}>{s.status_hint}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">At-a-Glance Subject Cards</h2>
          <button
            className="touch-target group flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 active:scale-95"
            type="button"
            onClick={() => setOpenLog(true)}
          >
            Quick Log Today
          </button>
        </div>
        {logMessage ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {logMessage}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subject_cards.map((subject) => {
            const width = Math.max(0, Math.min(100, subject.percentage));
            return (
              <div key={subject.professor} className="rounded-xl border border-slate-200/50 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{subject.professor}</p>
                  <p className={`font-mono text-sm ${colorForPercentage(subject.percentage)}`}>
                    {subject.percentage.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                  <div className="h-full rounded bg-violet-500" style={{ width: `${width}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">
                    {subject.present}/{subject.total}
                  </span>
                  <span>{subject.status_hint}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {openLog ? (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-950/60 p-0 md:items-center md:justify-center md:p-4">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="glass-card flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl p-0 md:max-w-4xl md:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h3 className="text-lg font-bold">Quick Log Today</h3>
                <p className="text-xs text-slate-500">Log entries for {now.split(",")[0]}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenLog(false)}
                className="touch-target flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 transition hover:bg-white/10 active:scale-95"
              >
                ✕
              </button>
            </div>

            <div className="scrolling-touch flex-1 overflow-y-auto p-5">
              <div className="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1.5">
                {(["subject", "teacher"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLogMode(mode)}
                    className={`relative rounded-xl px-6 py-2 text-sm font-bold transition ${
                      logMode === mode ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {logMode === mode && (
                      <motion.span
                        layoutId="log-mode-pill"
                        className="absolute inset-0 -z-10 rounded-xl bg-violet-600 shadow-lg shadow-violet-600/20"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    {mode === "subject" ? "By Subject" : "By Teacher"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(logMode === "teacher" ? TEACHERS : SUBJECTS).map((name) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                    <div className="mb-3 text-sm font-bold">{name}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Present</div>
                        <div className="flex h-12 items-center overflow-hidden rounded-xl bg-slate-900/40 p-1">
                          <button
                            type="button"
                            className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                            onClick={() => updateCount(logMode, name, "present", -1)}
                          >
                            −
                          </button>
                          <div className="flex-1 text-center font-mono text-lg font-bold">
                            {(logMode === "teacher" ? teacherCounts[name] : subjectCounts[name]).present}
                          </div>
                          <button
                            type="button"
                            className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                            onClick={() => updateCount(logMode, name, "present", 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Absent</div>
                        <div className="flex h-12 items-center overflow-hidden rounded-xl bg-slate-900/40 p-1">
                          <button
                            type="button"
                            className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                            onClick={() => updateCount(logMode, name, "absent", -1)}
                          >
                            −
                          </button>
                          <div className="flex-1 text-center font-mono text-lg font-bold">
                            {(logMode === "teacher" ? teacherCounts[name] : subjectCounts[name]).absent}
                          </div>
                          <button
                            type="button"
                            className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                            onClick={() => updateCount(logMode, name, "absent", 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-900/40 p-5 md:bg-transparent">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-500">Pending entries: <span className="font-bold text-slate-300">{pendingRows}</span></div>
                <button
                  type="button"
                  disabled={saving || pendingRows === 0}
                  onClick={quickLogSaveAll}
                  className="rounded-2xl bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-violet-600/30 transition hover:bg-violet-500 disabled:opacity-50 disabled:shadow-none active:scale-95"
                >
                  {saving ? "Saving..." : "Save Logs"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  );
}
