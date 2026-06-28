export const API_BASE = "https://attendancetracker-gamma.vercel.app/api";

export async function getDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    if (!res.ok) throw new Error("Failed to fetch summary");
    return res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function getCumulativeSubjects() {
  try {
    const res = await fetch(`${API_BASE}/subjects/cumulative`);
    if (!res.ok) throw new Error("Failed to fetch cumulative subjects");
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function getSimulatorSubjects() {
  try {
    const res = await fetch(`${API_BASE}/simulator/subjects`);
    if (!res.ok) throw new Error("Failed to fetch simulator subjects");
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function getMonthlySnapshots() {
  try {
    const res = await fetch(`${API_BASE}/insights/monthly`);
    if (!res.ok) throw new Error("Failed to fetch insights");
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function createAttendanceEntry(payload: {
  date: string;
  subject: string;
  professor: string;
  status: "Present" | "Absent";
}) {
  try {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function getAttendanceLogs() {
  try {
    const res = await fetch(`${API_BASE}/attendance`);
    if (!res.ok) throw new Error("Failed to fetch logs");
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function deleteAttendanceLog(id: number) {
  try {
    const res = await fetch(`${API_BASE}/attendance/${id}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}
