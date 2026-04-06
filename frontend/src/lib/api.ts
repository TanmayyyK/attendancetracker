import { CumulativeSubjectCard, DashboardSummary, MonthlySnapshot, SubjectCard } from "@/types/dashboard";

// If we are on Vercel, use the relative /api path that vercel.json routes to Python.
// If we are on your local Mac, use the localhost FastAPI server.
// Dynamically set the API base path
// Dynamically set the API base path
const API_BASE = process.env.NODE_ENV === "production" 
  ? "https://attendancetracker-gamma.vercel.app/api" 
  : "http://localhost:8000/api";
const EMPTY_SUMMARY: DashboardSummary = {
  overall: { total: 0, present: 0, absent: 0, percentage: 0, streak: 0 },
  subject_cards: [],
  month_trend: [],
  burnout_analysis: [],
  predictive_trajectory: { projected_percentage: 0 }
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, { cache: "no-store" });
    if (!res.ok) {
      return EMPTY_SUMMARY;
    }
    return res.json();
  } catch {
    // Keep UI alive when API is temporarily unavailable.
    return EMPTY_SUMMARY;
  }
}

export async function getSimulatorSubjects(): Promise<SubjectCard[]> {
  try {
    const res = await fetch(`${API_BASE}/simulator/subjects`, { cache: "no-store" });
    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch {
    return [];
  }
}

export async function getCumulativeSubjects(): Promise<CumulativeSubjectCard[]> {
  try {
    const res = await fetch(`${API_BASE}/subjects/cumulative`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getMonthlySnapshots(): Promise<MonthlySnapshot[]> {
  try {
    const res = await fetch(`${API_BASE}/insights/monthly`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function createAttendanceEntry(payload: {
  date: string;
  subject: string;
  professor: string;
  status: "Present" | "Absent";
  timestamp?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createBulkAttendance(
  rows: Array<{
    date: string;
    subject: string;
    professor?: string;
    mode?: "teacher" | "subject";
    present: number;
    absent: number;
  }>
): Promise<{ ok: boolean; inserted: number }> {
  try {
    const res = await fetch(`${API_BASE}/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    if (!res.ok) return { ok: false, inserted: 0 };
    const data = await res.json();
    return { ok: true, inserted: Number(data?.inserted ?? 0) };
  } catch {
    return { ok: false, inserted: 0 };
  }
}
