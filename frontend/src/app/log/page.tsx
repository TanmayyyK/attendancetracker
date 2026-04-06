"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyEntryView } from "@/components/daily-entry-view";
import { ManageLogs } from "@/components/manage-logs";
import { PlusCircle, History } from "lucide-react";

export default function LogPage() {
  const [activeTab, setActiveTab] = useState<"entry" | "manage">("entry");

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1.5 shadow-xl backdrop-blur-xl">
          {[
            { id: "entry", label: "Quick Entry", icon: PlusCircle },
            { id: "manage", label: "Manage History", icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition active:scale-95 ${
                activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {activeTab === tab.id && (
                <motion.span
                  layoutId="log-tab-pill"
                  className="absolute inset-0 -z-10 rounded-xl bg-violet-600 shadow-lg shadow-violet-600/30"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "entry" ? <DailyEntryView /> : <ManageLogs />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

