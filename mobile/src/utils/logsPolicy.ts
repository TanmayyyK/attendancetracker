/**
 * Attendance Logs & History Policy
 *
 * Implements pure sorting, filtering, and monthly grouping for attendance logs:
 * 1. Chronological sorting: date descending, then timestamp descending, then id descending.
 * 2. Dynamic subject discovery merging canonical subjects with custom subjects in logs.
 * 3. Compound filtering across subject and attendance status.
 * 4. Month-year grouping with per-section summary metrics (total classes, presents, absents).
 * 5. Timezone-safe calendar month extraction without UTC midnight offsets.
 *
 * Zero React/React Native dependencies; 100% testable in Node.
 */

import { CANONICAL_SUBJECTS } from '../types/attendanceIntelligence.ts';

export interface AttendanceLogRecord {
  id: number;
  date: string; // YYYY-MM-DD
  timestamp: string; // HH:MM:SS
  subject: string;
  professor: string;
  status: 'Present' | 'Absent' | string;
  reason?: string | null;
  [key: string]: any;
}

export type StatusFilter = 'All' | 'Present' | 'Absent';

export interface LogsFilterState {
  subject: string; // 'All' or specific subject name
  status: StatusFilter;
}

export interface MonthSection {
  monthKey: string; // "2026-10"
  title: string; // "October 2026"
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  data: AttendanceLogRecord[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Formats a "YYYY-MM" key into a human-readable "Month Year" string.
 * Uses calendar components directly to avoid timezone shift bugs.
 */
export function formatMonthTitle(monthKey: string): string {
  if (!monthKey || typeof monthKey !== 'string') {
    return 'Other Classes';
  }

  const parts = monthKey.split('-');
  if (parts.length < 2) {
    return 'Other Classes';
  }

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return 'Other Classes';
  }

  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

/**
 * Extracts available subjects by combining canonical subjects with any dynamic
 * subjects encountered in the records, maintaining canonical order first.
 */
export function extractAvailableSubjects(
  records: AttendanceLogRecord[],
  canonical: readonly string[] = CANONICAL_SUBJECTS
): string[] {
  const dynamicSubjects = new Set<string>();

  if (Array.isArray(records)) {
    for (const r of records) {
      if (r && typeof r.subject === 'string' && r.subject.trim()) {
        const trimmed = r.subject.trim();
        if (!canonical.includes(trimmed as any)) {
          dynamicSubjects.add(trimmed);
        }
      }
    }
  }

  const sortedDynamic = Array.from(dynamicSubjects).sort((a, b) => a.localeCompare(b));
  return ['All', ...canonical, ...sortedDynamic];
}

/**
 * Sorts attendance logs strictly chronologically:
 * Primary: Date descending (e.g. 2026-10-24 before 2026-10-23)
 * Secondary: Timestamp descending (e.g. 14:00:00 before 09:00:00)
 * Tertiary: ID descending (newest entries first if timestamp is identical)
 */
export function sortLogsChronologically(records: AttendanceLogRecord[]): AttendanceLogRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  return [...records].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA); // Date descending
    }

    const timeA = a.timestamp || '';
    const timeB = b.timestamp || '';
    if (timeA !== timeB) {
      return timeB.localeCompare(timeA); // Time descending
    }

    return (b.id || 0) - (a.id || 0); // ID descending
  });
}

/**
 * Filters attendance records by subject and attendance status.
 */
export function filterLogs(
  records: AttendanceLogRecord[],
  filter: LogsFilterState
): AttendanceLogRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  const targetSubject = filter.subject.trim().toLowerCase();
  const targetStatus = filter.status.trim().toLowerCase();

  return records.filter((r) => {
    if (!r) return false;

    // Subject check
    if (targetSubject !== 'all') {
      const subjectName = (r.subject || '').trim().toLowerCase();
      if (subjectName !== targetSubject) {
        return false;
      }
    }

    // Status check
    if (targetStatus !== 'all') {
      const statusValue = (r.status || '').trim().toLowerCase();
      if (statusValue !== targetStatus) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Groups attendance records into monthly sections with calculated totals.
 * Automatically sorts chronologically before grouping.
 */
export function groupLogsByMonth(records: AttendanceLogRecord[]): MonthSection[] {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const sorted = sortLogsChronologically(records);
  const groupsMap = new Map<string, AttendanceLogRecord[]>();

  for (const r of sorted) {
    let monthKey = 'Unknown';
    if (r.date && typeof r.date === 'string') {
      const parts = r.date.split('-');
      if (parts.length >= 2 && parts[0].length === 4 && parts[1].length === 2) {
        monthKey = `${parts[0]}-${parts[1]}`;
      }
    }

    const existing = groupsMap.get(monthKey);
    if (existing) {
      existing.push(r);
    } else {
      groupsMap.set(monthKey, [r]);
    }
  }

  const sections: MonthSection[] = [];
  for (const [monthKey, items] of groupsMap.entries()) {
    let presentCount = 0;
    let absentCount = 0;

    for (const item of items) {
      const st = (item.status || '').trim().toLowerCase();
      if (st === 'present') {
        presentCount += 1;
      } else if (st === 'absent') {
        absentCount += 1;
      }
    }

    sections.push({
      monthKey,
      title: formatMonthTitle(monthKey),
      totalClasses: items.length,
      presentCount,
      absentCount,
      data: items,
    });
  }

  return sections;
}

/**
 * Deduplicates and merges new paginated records into an existing collection.
 * Preserves the order of existing items and appends only unseen IDs from incoming items.
 */
export function mergePaginatedLogs(
  existing: AttendanceLogRecord[],
  incoming: AttendanceLogRecord[]
): AttendanceLogRecord[] {
  if (!Array.isArray(existing)) {
    return Array.isArray(incoming) ? [...incoming] : [];
  }
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return [...existing];
  }

  const existingIds = new Set<number>();
  for (const r of existing) {
    if (r && typeof r.id === 'number') {
      existingIds.add(r.id);
    }
  }

  const fresh: AttendanceLogRecord[] = [];
  for (const r of incoming) {
    if (r && typeof r.id === 'number' && !existingIds.has(r.id)) {
      fresh.push(r);
    }
  }

  return [...existing, ...fresh];
}

/**
 * Parses pagination headers from an HTTP response or headers map.
 */
export function parsePaginationHeaders(headers: {
  get: (name: string) => string | null | undefined;
} | Record<string, string | null | undefined>): { hasMore: boolean; nextCursor: number | null; hasHeader: boolean } {
  const getHeader = (key: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as any).get === 'function') {
      return (headers as any).get(key) || (headers as any).get(key.toLowerCase()) || null;
    }
    const dict = headers as Record<string, string | null | undefined>;
    return dict[key] ?? dict[key.toLowerCase()] ?? null;
  };

  const hasMoreRaw = getHeader('X-Has-More');
  const nextCursorRaw = getHeader('X-Next-Cursor');

  const hasMore = hasMoreRaw ? hasMoreRaw.trim().toLowerCase() === 'true' : false;
  let nextCursor: number | null = null;
  if (nextCursorRaw && nextCursorRaw.trim() !== '') {
    const parsed = parseInt(nextCursorRaw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      nextCursor = parsed;
    }
  }

  return { hasMore, nextCursor, hasHeader: hasMoreRaw !== null };
}

export interface CompleteHistoryFetchResult {
  ok: boolean;
  records: AttendanceLogRecord[];
  hasMoreRemaining: boolean;
  error?: string;
}

/**
 * Iteratively retrieves all attendance pages from the API for complete-history export.
 * Safely stops and reports failure if any intermediate page request fails.
 */
export async function fetchAllAttendancePages(
  fetchPage: (beforeId: number | null) => Promise<{ items: AttendanceLogRecord[]; hasMore: boolean; nextCursor: number | null } | null>,
  options?: {
    onProgress?: (totalFetched: number, hasMore: boolean) => void;
    abortSignal?: { aborted: boolean };
  }
): Promise<CompleteHistoryFetchResult> {
  let allRecords: AttendanceLogRecord[] = [];
  let currentCursor: number | null = null;
  let keepGoing = true;
  let iterations = 0;
  const MAX_PAGES = 50; // Guard against runaway pagination loops

  while (keepGoing && iterations < MAX_PAGES) {
    iterations++;

    if (options?.abortSignal?.aborted) {
      return {
        ok: false,
        records: allRecords,
        hasMoreRemaining: true,
        error: 'Export was cancelled by user.',
      };
    }

    const pageResult = await fetchPage(currentCursor);
    if (!pageResult) {
      return {
        ok: false,
        records: allRecords,
        hasMoreRemaining: true,
        error: `Failed to retrieve attendance history at cursor ${currentCursor ?? 'start'}.`,
      };
    }

    const prevCount = allRecords.length;
    allRecords = mergePaginatedLogs(allRecords, pageResult.items);

    // Guard: If server returned items but none were new, or cursor didn't advance,
    // the backend contract is violated or returning duplicate pages. Halt with explicit failure.
    if (allRecords.length === prevCount && pageResult.items.length > 0) {
      return {
        ok: false,
        records: allRecords,
        hasMoreRemaining: true,
        error: `Pagination halted: server returned duplicate records at cursor ${currentCursor ?? 'start'}.`,
      };
    }
    if (currentCursor !== null && currentCursor === pageResult.nextCursor) {
      return {
        ok: false,
        records: allRecords,
        hasMoreRemaining: true,
        error: `Pagination halted: server returned repeated cursor ${currentCursor}.`,
      };
    }

    currentCursor = pageResult.nextCursor;
    keepGoing = pageResult.hasMore && currentCursor !== null;

    if (options?.onProgress) {
      options.onProgress(allRecords.length, pageResult.hasMore);
    }
  }

  if (keepGoing) {
    return {
      ok: false,
      records: allRecords,
      hasMoreRemaining: true,
      error: `Pagination stopped: reached maximum allowed pages (${MAX_PAGES}) with more records remaining.`,
    };
  }

  return {
    ok: true,
    records: allRecords,
    hasMoreRemaining: false,
  };
}
