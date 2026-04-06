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

type RowCount = { present: number; absent: number };

export function DailyEntryView() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, RowCount>>(
    Object.fromEntries(PROFESSORS.map((p) => [p, { present: 0, absent: 0 }]))
  );

  const totalRows = useMemo(
    () => Object.values(counts).reduce((acc, cur) => acc + cur.present + cur.absent, 0),
    [counts]
  );

  function updateCount(professor: string, key: keyof RowCount, delta: number) {
    setCounts((prev) => {
      const current = prev[professor][key];
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [professor]: {
          ...prev[professor],
          [key]: next
        }
      };
    });
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    const rows = PROFESSORS.map((professor) => ({
      date,
      mode: "teacher" as const,
      subject: SUBJECT_MAP[professor],
      professor,
      present: counts[professor].present,
      absent: counts[professor].absent
    })).filter((r) => r.present + r.absent > 0);

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

    setMessage(`Saved ${result.inserted} rows successfully.`);
    setCounts(Object.fromEntries(PROFESSORS.map((p) => [p, { present: 0, absent: 0 }])));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Daily Entry</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Log attendance with + / - controls.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200/50 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Daily Entry"}
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Total pending rows: {totalRows}</div>
        {message ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {message}
          </div>
        ) : null}
      </section>

      <section className="glass-card p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSORS.map((prof) => {
            const c = counts[prof];
            return (
              <div key={prof} className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-violet-600/10 px-4 py-2 font-black tracking-tight text-violet-400">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-[10px] text-white">
                    {prof[0]}
                  </div>
                  {prof}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Present</div>
                    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-slate-900/40 p-1">
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                        onClick={() => updateCount(prof, "present", -1)}
                      >
                        −
                      </button>
                      <div className="flex-1 text-center font-mono text-lg font-black transition-all group-hover:scale-110">
                        {c.present}
                      </div>
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                        onClick={() => updateCount(prof, "present", 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Absent</div>
                    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-slate-900/40 p-1">
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                        onClick={() => updateCount(prof, "absent", -1)}
                      >
                        −
                      </button>
                      <div className="flex-1 text-center font-mono text-lg font-black transition-all group-hover:scale-110">
                        {c.absent}
                      </div>
                      <button
                        type="button"
                        className="touch-target flex h-full items-center justify-center px-3 font-bold transition active:scale-90"
                        onClick={() => updateCount(prof, "absent", 1)}
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

