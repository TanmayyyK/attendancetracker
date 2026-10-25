import {
  DEFAULT_SUBMISSION_TIMEOUT_MS,
  classifyHttpOutcome,
  classifyCaughtException,
  type SubmissionOutcome,
} from './utils/submissionSafety.ts';
import { parsePaginationHeaders } from './utils/logsPolicy.ts';

export const API_BASE = "https://attendancetracker-gamma.vercel.app/api";

export async function getDashboardSummary(): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch summary: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] getDashboardSummary error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCumulativeSubjects(): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/subjects/cumulative`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch cumulative subjects: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] getCumulativeSubjects error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getSimulatorSubjects(): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/simulator/subjects`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch simulator subjects: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] getSimulatorSubjects error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getMonthlySnapshots(): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/insights/monthly`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch insights: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] getMonthlySnapshots error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createAttendanceEntry(payload: {
  date: string;
  subject: string;
  professor: string;
  status: "Present" | "Absent";
  reason?: string;
}): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] createAttendanceEntry failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[API] createAttendanceEntry error:', err);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface CreateBulkAttendanceOptions {
  timeoutMs?: number;
}

export interface BulkAttendanceResult {
  ok: boolean;
  inserted?: number;
  error?: string;
  outcome: SubmissionOutcome;
}

export async function createBulkAttendance(
  rows: any[],
  options?: CreateBulkAttendanceOptions
): Promise<BulkAttendanceResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SUBMISSION_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detailMsg: string | undefined;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          detailMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {}

      const outcome = classifyHttpOutcome(res.status, detailMsg);
      return {
        ok: false,
        error: outcome.error,
        outcome,
      };
    }

    try {
      const data = await res.json();
      const inserted = typeof data?.inserted === 'number' ? data.inserted : 0;
      return {
        ok: true,
        inserted,
        outcome: { kind: 'success', inserted },
      };
    } catch {
      // 200 OK was received (transaction committed on server), but body parsing failed
      const outcome: SubmissionOutcome = {
        kind: 'ambiguous_failure',
        error: 'Attendance was recorded, but the confirmation response could not be read.',
        reason: 'malformed_response',
        statusCode: 200,
      };
      return {
        ok: false,
        error: outcome.error,
        outcome,
      };
    }
  } catch (err: any) {
    const outcome = classifyCaughtException(err, controller.signal.aborted);
    return {
      ok: false,
      error: outcome.error,
      outcome,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface GetAttendanceLogsOptions {
  limit?: number;
  beforeId?: number | null;
  timeoutMs?: number;
}

export interface AttendancePageResult {
  items: any[];
  hasMore: boolean;
  nextCursor: number | null;
}

export async function getAttendanceLogsPage(
  options?: GetAttendanceLogsOptions
): Promise<AttendancePageResult | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const params = new URLSearchParams();
    if (typeof options?.limit === 'number') {
      params.set('limit', String(options.limit));
    }
    if (typeof options?.beforeId === 'number' && options.beforeId > 0) {
      params.set('before_id', String(options.beforeId));
    }
    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/attendance?${queryString}` : `${API_BASE}/attendance`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch logs from ${url}: HTTP ${res.status}`);
      return null;
    }
    const items = await res.json();
    if (!Array.isArray(items)) {
      console.warn('[API] Malformed attendance response: expected array');
      return null;
    }

    const { hasMore, nextCursor, hasHeader } = parsePaginationHeaders(res.headers);

    let finalHasMore = hasMore;
    let finalNextCursor = nextCursor;

    if (hasHeader) {
      finalHasMore = hasMore;
      finalNextCursor = nextCursor;
    } else {
      // Legacy server fallback (no X-Has-More header):
      // Check if server actually respected requested before_id.
      // If items returned contain IDs >= beforeId, the server ignored before_id.
      const requestedBeforeId = options?.beforeId;
      const serverIgnoredBeforeId =
        typeof requestedBeforeId === 'number' &&
        requestedBeforeId > 0 &&
        items.length > 0 &&
        typeof items[0]?.id === 'number' &&
        items[0].id >= requestedBeforeId;

      if (serverIgnoredBeforeId) {
        console.warn(`[API] Server ignored before_id=${requestedBeforeId} pagination cursor; received records with ID ${items[0]?.id}. Keyset pagination unavailable.`);
        return null;
      }

      const reqLimit = options?.limit ?? 100;
      finalHasMore = items.length === reqLimit;
      finalNextCursor =
        finalHasMore && items.length > 0 && typeof items[items.length - 1]?.id === 'number'
          ? items[items.length - 1].id
          : null;
    }

    return {
      items,
      hasMore: finalHasMore,
      nextCursor: finalNextCursor,
    };
  } catch (err) {
    console.warn('[API] getAttendanceLogsPage error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getAttendanceLogs(
  options?: GetAttendanceLogsOptions
): Promise<any[] | null> {
  try {
    const page = await getAttendanceLogsPage(options);
    return page?.items ?? null;
  } catch (err) {
    console.warn('[API] getAttendanceLogs error:', err);
    return null;
  }
}

export async function deleteAttendanceLog(id: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/attendance/${id}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] deleteAttendanceLog failed for id ${id}: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[API] deleteAttendanceLog error:', err);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerPushToken(token: string, deviceName?: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/notifications/register-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device_name: deviceName }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] registerPushToken failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[API] Failed to register push token:", err);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getNotificationHistory(): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/notifications/history`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch notification history: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] getNotificationHistory error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
