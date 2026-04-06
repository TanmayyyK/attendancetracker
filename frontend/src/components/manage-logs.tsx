"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Calendar, User, BookOpen, CheckCircle2, XCircle } from "lucide-react";

type AttendanceRecord = {
  id: number;
  date: string;
  timestamp: string;
  subject: string;
  professor: string;
  status: "Present" | "Absent";
};

export function ManageLogs() {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    try {
      const res = await fetch("http://localhost:8000/api/attendance");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteLog(id: number) {
    try {
      const res = await fetch(`http://localhost:8000/api/attendance/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((log) => log.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete log", err);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-sm text-slate-500">
        Loading attendance history...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Manage History</h2>
        <div className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
          {logs.length} Entries
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="px-5 py-4">Date & Time</th>
              <th className="px-5 py-4">Subject</th>
              <th className="px-5 py-4">Professor</th>
              <th className="px-5 py-4 text-center">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors hover:bg-white/5">
                <td className="px-5 py-4 font-mono text-xs">
                  <div className="font-bold">{log.date}</div>
                  <div className="text-slate-500">{log.timestamp}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-violet-400" />
                    <span className="font-medium">{log.subject}</span>
                  </div>
                </td>
                <td className="px-5 py-4 font-medium text-slate-400">{log.professor}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-center">
                    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest ${
                      log.status === "Present" 
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" 
                        : "border-rose-400/30 bg-rose-400/10 text-rose-400"
                    }`}>
                      {log.status === "Present" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {log.status}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <button 
                    onClick={() => deleteLog(log.id)}
                    className="touch-target rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/20 hover:text-rose-500 active:scale-90"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="scrolling-touch grid grid-cols-1 gap-3 md:hidden">
        {logs.map((log) => (
          <div key={log.id} className="glass-card flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-500">
                  <Calendar size={12} />
                  {log.date} • {log.timestamp}
                </div>
                <div className="mt-1 text-lg font-black tracking-tight">{log.subject}</div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <User size={12} />
                  {log.professor}
                </div>
              </div>
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest ${
                log.status === "Present" 
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" 
                  : "border-rose-400/30 bg-rose-400/10 text-rose-400"
              }`}>
                {log.status === "Present" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {log.status}
              </span>
            </div>
            
            <div className="flex items-center justify-end border-t border-white/5 pt-3">
              <button 
                onClick={() => deleteLog(log.id)}
                className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-400 transition active:scale-95"
              >
                <Trash2 size={14} />
                Delete Entry
              </button>
            </div>
          </div>
        ))}
      </div>

      {logs.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/2 text-slate-500">
          <BookOpen size={32} className="mb-2 opacity-20" />
          <p className="text-sm font-medium">No history found.</p>
        </div>
      )}
    </div>
  );
}
