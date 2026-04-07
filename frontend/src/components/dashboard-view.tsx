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
      <motion.section 
        className="glass-card relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 sm:p-10 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: "easeOut", duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-black/20 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{now}</p>
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-400">
              <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Attendance Overview
            </h1>
          </div>
          
          <div className="mt-4 flex flex-col items-center">
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span 
                className={`fluid-heading bg-gradient-to-r bg-clip-text text-transparent ${
                  overall.percentage >= 75 
                    ? 'from-emerald-400 to-teal-500' 
                    : overall.percentage >= 65 
                      ? 'from-amber-400 to-orange-500' 
                      : 'from-rose-500 to-red-600'
                }`}
              >
                {overall.percentage.toFixed(1)}
              </span>
              <span className="text-xl sm:text-2xl font-medium text-slate-500 dark:text-slate-400">%</span>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 grid w-full max-w-2xl grid-cols-3 divide-x divide-slate-200/50 dark:divide-slate-700/50 rounded-2xl bg-white/50 p-4 dark:bg-black/20">
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Present</span>
              <span className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{overall.present}</span>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Absent</span>
              <span className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{overall.absent}</span>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                Streak <Flame className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
              </span>
              <span className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{overall.streak}</span>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="glass-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Subject-Wise Analytics</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Your core academic performance by subject.</p>
          </div>
          <button
            className="touch-target group flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 active:scale-95"
            type="button"
            onClick={() => setOpenLog(true)}
          >
            Quick Log Today
          </button>
        </div>
        {logMessage ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {logMessage}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {cumulativeSubjects.map((s, i) => {
            const width = Math.max(0, Math.min(100, s.percentage));
            return (
              <motion.div
                key={s.subject}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-card hover-lift flex h-full flex-col p-5 sm:p-6"
              >
                <div className="flex flex-col h-full">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="line-clamp-2 text-base sm:text-lg font-semibold leading-tight text-slate-800 dark:text-slate-200">
                      {s.subject}
                    </h3>
                    <span className={`text-xl sm:text-2xl font-bold tracking-tight ${colorForPercentage(s.percentage)}`}>
                      {s.percentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="mb-6 flex-1 space-y-3 text-sm">
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/30 px-3 py-1.5 rounded-lg">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Total Classes</span>
                      <span className="font-semibold">{Number.isInteger(s.total) ? s.total : s.total.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Present</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{Number.isInteger(s.present) ? s.present : s.present.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                      <span className="text-slate-400">Status</span>
                      <span
                        className={
                          s.percentage >= 75
                            ? "text-emerald-500"
                            : s.percentage >= 65
                              ? "text-amber-500"
                              : "text-rose-500"
                        }
                      >
                        {s.status_hint}
                      </span>
                    </div>
                    <div className="h-3 sm:h-4 w-full overflow-hidden rounded-full bg-slate-200/50 dark:bg-slate-800/50 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          s.percentage >= 75
                            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                            : s.percentage >= 65
                              ? "bg-gradient-to-r from-amber-400 to-orange-500"
                              : "bg-gradient-to-r from-rose-500 to-red-500"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="glass-card p-6 opacity-90 transition hover:opacity-100">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Professor Breakdown</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {subject_cards.map((subject, i) => {
            const width = Math.max(0, Math.min(100, subject.percentage));
            return (
              <motion.div
                key={subject.professor}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-card hover-lift flex h-full flex-col p-5 sm:p-6"
              >
                <div className="flex flex-col h-full">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="line-clamp-2 text-base sm:text-lg font-semibold leading-tight text-slate-800 dark:text-slate-200">
                      {subject.professor}
                    </h3>
                    <span className={`text-xl sm:text-2xl font-bold tracking-tight ${colorForPercentage(subject.percentage)}`}>
                      {subject.percentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="mb-6 flex-1 space-y-3 text-sm">
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/30 px-3 py-1.5 rounded-lg">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Total Classes</span>
                      <span className="font-semibold">{subject.total}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Present</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{subject.present}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Absent</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{subject.absent}</span>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                      <span className="text-slate-400">Status</span>
                      <span
                        className={
                          subject.safe_to_skip > 0
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }
                      >
                        {subject.status_hint}
                      </span>
                    </div>
                    <div className="h-3 sm:h-4 w-full overflow-hidden rounded-full bg-slate-200/50 dark:bg-slate-800/50 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          subject.percentage >= 75
                            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                            : subject.percentage >= 65
                              ? "bg-gradient-to-r from-amber-400 to-orange-500"
                              : "bg-gradient-to-r from-rose-500 to-red-500"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
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
