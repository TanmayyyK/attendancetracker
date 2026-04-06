"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("attendace-theme");
    const initialDark = stored ? stored === "dark" : true;
    setDark(initialDark);
    document.documentElement.classList.toggle("dark", initialDark);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("attendace-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="glass-card inline-flex items-center gap-2 px-3 py-2 text-sm font-medium"
      aria-label="Toggle theme"
      type="button"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
