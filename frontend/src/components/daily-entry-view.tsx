"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBulkAttendance } from "@/lib/api";

const SUBJECT_MAP: Record<string, string> = {
  "Satish Sir (Dean)": "Samhita",
  "Raghu Sir": "Anatomy",
  "Tanvi Mam": "Anatomy",
  "Akanksha Mam": "Anatomy",
  "Dhaval Sir": "Padarth Vigyan",
  "Ritesh Mam": "Physiology",
  "Anoop Sir": "Physiology",
  "CM Sir": "Sanskrit (CM Sir)",
  "Mahesh Sir": "Samhita"
};

const PROFESSORS = [
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

const SUBJECTS = [
  "Physiology",
  "Anatomy",
  "Samhita",
  "Padarth Vigyan",
  "Sanskrit (CM Sir)"
];

type RowCount = { present: number; absent: number };

export function DailyEntryView() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logMode, setLogMode] = useState<"subject" | "teacher">("subject");

  const [teacherCounts, setTeacherCounts] = useState<Record<string, RowCount>>(
    Object.fromEntries(PROFESSORS.map((p) => [p, { present: 0, absent: 0 }]))
  );
  
  const [subjectCounts, setSubjectCounts] = useState<Record<string, RowCount>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }]))
  );

  const activeCounts = logMode === "subject" ? subjectCounts : teacherCounts;

  const totalRows = useMemo(
    () => Object.values(activeCounts).reduce((acc, cur) => acc + cur.present + cur.absent, 0),
    [activeCounts]
  );

  function updateCount(keyName: string, type: keyof RowCount, delta: number) {
    if (logMode === "subject") {
      setSubjectCounts((prev) => ({
        ...prev,
        [keyName]: { ...prev[keyName], [type]: Math.max(0, prev[keyName][type] + delta) }
      }));
    } else {
      setTeacherCounts((prev) => ({
        ...prev,
        [keyName]: { ...prev[keyName], [type]: Math.max(0, prev[keyName][type] + delta) }
      }));
    }
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    
    let rows;
    if (logMode === "teacher") {
      rows = PROFESSORS.map((professor) => ({
        date,
        mode: "teacher" as const,
        subject: SUBJECT_MAP[professor],
        professor,
        present: teacherCounts[professor].present,
        absent: teacherCounts[professor].absent
      })).filter((r) => r.present + r.absent > 0);
    } else {
      rows = SUBJECTS.map((subject) => ({
        date,
        mode: "subject" as const,
        subject,
        present: subjectCounts[subject].present,
        absent: subjectCounts[subject].absent
      })).filter((r) => r.present + r.absent > 0);
    }

    if (rows.length === 0) {
      setSaving(false);
      setMessage("Add at least one class entry.");
      return;
    }

    const result = await createBulkAttendance(rows);
    setSaving(false);

    if (!result.ok) {
      setMessage("Failed to save entries. Check backend.");
      return;
    }

    setMessage(`Saved ${result.inserted} entries successfully.`);
    if (logMode === "teacher") {
      setTeacherCounts(Object.fromEntries(PROFESSORS.map((p) => [p, { present: 0, absent: 0 }])));
    } else {
      setSubjectCounts(Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }])));
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Daily Entry</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Log attendance dynamically by subject or professor.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex w-full sm:w-auto rounded-xl bg-slate-200/50 p-1 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setLogMode("subject")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  logMode === "subject"
                    ? "bg-white text-violet-600 shadow-sm dark:bg-slate-700 dark:text-violet-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Subject
              </button>
              <button
                type="button"
                onClick={() => setLogMode("teacher")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  logMode === "teacher"
                    ? "bg-white text-violet-600 shadow-sm dark:bg-slate-700 dark:text-violet-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Professor
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/50 pt-6 dark:border-white/10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 sm:flex-none rounded-xl border border-slate-200/50 bg-white/70 px-4 py-2 text-sm font-medium shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-white/10 dark:bg-white/5"
            />
          </div>
          
          <div className="flex w-full sm:w-auto flex-col items-end gap-2">
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || totalRows === 0}
              className="w-full sm:w-auto rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save ${totalRows} Entries`}
            </button>
          </div>
        </div>
        
        {message ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            {message}
          </div>
        ) : null}
      </section>

      <section className="glass-card p-4 md:p-6">
        <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(logMode === "subject" ? SUBJECTS : PROFESSORS).map((item) => {
            const c = activeCounts[item];
            return (
              <div key={item} className="glass-card hover-lift p-5 transition-all">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600/10 font-black text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                    {item[0]}
                  </div>
                  <div className="font-bold tracking-tight text-slate-800 dark:text-slate-200 leading-tight">
                    {item}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Present</div>
                    <div className="flex h-14 items-center overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-1 shadow-inner border border-emerald-100 dark:border-emerald-900/30">
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-4 font-bold text-emerald-600 dark:text-emerald-500 transition active:scale-90 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl"
                        onClick={() => updateCount(item, "present", -1)}
                      >
                        −
                      </button>
                      <div className="flex-1 text-center font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 transition-all select-none">
                        {c.present}
                      </div>
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-4 font-bold text-emerald-600 dark:text-emerald-500 transition active:scale-90 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl"
                        onClick={() => updateCount(item, "present", 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Absent</div>
                    <div className="flex h-14 items-center overflow-hidden rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-1 shadow-inner border border-rose-100 dark:border-rose-900/30">
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-4 font-bold text-rose-600 dark:text-rose-500 transition active:scale-90 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl"
                        onClick={() => updateCount(item, "absent", -1)}
                      >
                        −
                      </button>
                      <div className="flex-1 text-center font-mono text-xl font-black text-rose-600 dark:text-rose-400 transition-all select-none">
                        {c.absent}
                      </div>
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-4 font-bold text-rose-600 dark:text-rose-500 transition active:scale-90 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl"
                        onClick={() => updateCount(item, "absent", 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

