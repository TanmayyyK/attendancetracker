"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

type NavHref = "/" | "/insights" | "/simulator" | "/log";

const items: Array<{ href: NavHref; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/simulator", label: "Simulator" },
  { href: "/log", label: "Daily Entry" }
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="glass-card flex items-center gap-1 p-1">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? "text-slate-900 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-white/70 dark:bg-white/10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

