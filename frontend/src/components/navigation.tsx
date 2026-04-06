"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  BarChart3, 
  FlaskConical, 
  ClipboardCheck,
  Search
} from "lucide-react";

type NavHref = "/" | "/insights" | "/simulator" | "/log";

const items: Array<{ href: NavHref; label: string; icon: any }> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
  { href: "/log", label: "Daily Entry", icon: ClipboardCheck }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Top Nav */}
      <nav className="glass-card hidden items-center gap-1 p-1 md:flex">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-xl px-4 py-2 text-sm font-medium transition ${
                active 
                  ? "text-slate-900 dark:text-white" 
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-xl bg-white/80 shadow-sm dark:bg-white/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/20 bg-white/80 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 md:hidden">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition active:scale-90 ${
                active 
                  ? "text-violet-600 dark:text-violet-400" 
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill-mobile"
                  className="absolute inset-x-1 bottom-1 top-1 -z-10 rounded-lg bg-violet-100 dark:bg-violet-500/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
