/**
 * Historical Attendance Calendar Policy
 *
 * Implements deterministic calendar calculations, Monday-aligned month grids,
 * GitHub-style activity heatmap intensity levels, and daily/monthly summaries.
 *
 * Zero UI/React Native dependencies; 100% testable in Node.
 */

import type { AttendanceLogRecord } from './logsPolicy.ts';
import { isValidCalendarDate, getLocalTodayDateString } from './dates.ts';

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export const HEATMAP_THRESHOLDS = {
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4_MIN: 4,
} as const;

export interface DayAttendanceSummary {
  date: string; // "YYYY-MM-DD"
  dayOfMonth: number; // 1..31
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  percentage: number | null; // e.g. 100.0 or 50.0 (null if totalClasses === 0)
  hasPresent: boolean;
  hasAbsent: boolean;
  intensity: HeatmapLevel;
  records: AttendanceLogRecord[];
}

export interface MonthSummary {
  year: number;
  month: number; // 1..12
  monthKey: string; // "YYYY-MM"
  monthTitle: string; // "October 2026"
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  percentage: number | null; // (present / total) * 100 or null if total === 0
  activeDaysCount: number; // days in this month with at least 1 record
  totalDaysInMonth: number;
}

export interface SubjectAttendanceStat {
  subject: string;
  present: number;
  absent: number;
  total: number;
  percentage: number | null;
}

export const MONTH_NAMES = [
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

export const WEEKDAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const WEEKDAY_FULL_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/**
 * Checks whether a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  if (isNaN(year) || year < 1) return false;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of days in a given month (1..12).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12 || isNaN(year)) {
    return 30;
  }
  // Month in JS Date is 0-indexed; passing 0 as day returns the last day of previous month
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the Monday-aligned weekday index for the 1st day of a month.
 * 0 = Monday, 1 = Tuesday ... 5 = Saturday, 6 = Sunday.
 */
export function getFirstWeekdayOfMonth(year: number, month: number): number {
  const localFirstDay = new Date(year, month - 1, 1);
  const jsDay = localFirstDay.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Formats year and month into "YYYY-MM" string key.
 */
export function formatMonthYearKey(year: number, month: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Formats year, month, and day into "YYYY-MM-DD" local calendar date.
 */
export function formatDateString(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extracts { year, month } from a "YYYY-MM" or "YYYY-MM-DD" string.
 */
export function getYearMonthFromDate(dateString: string): { year: number; month: number } {
  if (!dateString || typeof dateString !== 'string') {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }

  const parts = dateString.split('-').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { year: parts[0], month: Math.max(1, Math.min(12, parts[1])) };
  }

  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

/**
 * Calculates navigation target for the previous month.
 */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * Calculates navigation target for the next month.
 */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/**
 * Deterministic GitHub-style activity intensity calculation.
 *
 * Intensity strictly reflects the number of recorded classes, not attendance quality:
 * - 0 classes: Level 0 (no background fill)
 * - 1 class: Level 1 (light intensity)
 * - 2 classes: Level 2 (medium intensity)
 * - 3 classes: Level 3 (strong intensity)
 * - 4+ classes: Level 4 (maximum intensity)
 */
export function calculateHeatmapIntensity(count: number): HeatmapLevel {
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/**
 * Groups an array of attendance records by date ("YYYY-MM-DD").
 */
export function groupRecordsByDate(records: AttendanceLogRecord[]): Map<string, AttendanceLogRecord[]> {
  const map = new Map<string, AttendanceLogRecord[]>();
  if (!Array.isArray(records)) {
    return map;
  }

  for (const record of records) {
    if (!record || !record.date || typeof record.date !== 'string') {
      continue;
    }
    const trimmedDate = record.date.trim();
    if (!isValidCalendarDate(trimmedDate)) {
      continue;
    }

    const existing = map.get(trimmedDate);
    if (existing) {
      existing.push(record);
    } else {
      map.set(trimmedDate, [record]);
    }
  }

  return map;
}

/**
 * Summarizes attendance for a specific calendar date.
 */
export function summarizeDayAttendance(
  dateString: string,
  records: AttendanceLogRecord[] | undefined,
  todayDateString: string = getLocalTodayDateString(),
  isCurrentMonth: boolean = true
): DayAttendanceSummary {
  const dayRecords = records ?? [];
  let presentCount = 0;
  let absentCount = 0;

  for (const r of dayRecords) {
    const status = (r.status || '').trim().toLowerCase();
    if (status === 'present') {
      presentCount += 1;
    } else if (status === 'absent') {
      absentCount += 1;
    }
  }

  const totalClasses = dayRecords.length;
  const isFuture = dateString > todayDateString;
  const isToday = dateString === todayDateString;

  let percentage: number | null = null;
  if (totalClasses > 0) {
    percentage = Math.round((presentCount / totalClasses) * 1000) / 10;
  }

  const parts = dateString.split('-').map(Number);
  const dayOfMonth = parts.length === 3 ? parts[2] : 1;

  return {
    date: dateString,
    dayOfMonth,
    isCurrentMonth,
    isToday,
    isFuture,
    totalClasses,
    presentCount,
    absentCount,
    percentage,
    hasPresent: presentCount > 0,
    hasAbsent: absentCount > 0,
    intensity: calculateHeatmapIntensity(totalClasses),
    records: dayRecords,
  };
}

/**
 * Generates the complete calendar grid for a given year and month.
 * Correctly aligns to Monday, incorporates previous-month padding,
 * and fills trailing cells to form complete 7-day rows.
 */
export function generateMonthGrid(
  year: number,
  month: number,
  dateRecordsMap: Map<string, AttendanceLogRecord[]>,
  todayDateString: string = getLocalTodayDateString()
): DayAttendanceSummary[] {
  const grid: DayAttendanceSummary[] = [];

  const daysInCurrentMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayOfMonth(year, month); // 0 = Mon .. 6 = Sun

  // 1. Preceding month padding days
  if (firstWeekday > 0) {
    const prevMonthInfo = getPreviousMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(prevMonthInfo.year, prevMonthInfo.month);
    const startDay = daysInPrevMonth - firstWeekday + 1;

    for (let day = startDay; day <= daysInPrevMonth; day++) {
      const dateStr = formatDateString(prevMonthInfo.year, prevMonthInfo.month, day);
      const records = dateRecordsMap.get(dateStr);
      grid.push(summarizeDayAttendance(dateStr, records, todayDateString, false));
    }
  }

  // 2. Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const dateStr = formatDateString(year, month, day);
    const records = dateRecordsMap.get(dateStr);
    grid.push(summarizeDayAttendance(dateStr, records, todayDateString, true));
  }

  // 3. Trailing next month padding days to complete full 7-day weeks (multiples of 7)
  const remainder = grid.length % 7;
  if (remainder !== 0) {
    const paddingNeeded = 7 - remainder;
    const nextMonthInfo = getNextMonth(year, month);

    for (let day = 1; day <= paddingNeeded; day++) {
      const dateStr = formatDateString(nextMonthInfo.year, nextMonthInfo.month, day);
      const records = dateRecordsMap.get(dateStr);
      grid.push(summarizeDayAttendance(dateStr, records, todayDateString, false));
    }
  }

  return grid;
}

/**
 * Aggregates attendance metrics across an entire calendar month.
 */
export function calculateMonthSummary(
  year: number,
  month: number,
  dateRecordsMap: Map<string, AttendanceLogRecord[]>
): MonthSummary {
  const daysInMonth = getDaysInMonth(year, month);
  let totalClasses = 0;
  let presentCount = 0;
  let absentCount = 0;
  let activeDaysCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(year, month, day);
    const records = dateRecordsMap.get(dateStr);
    if (records && records.length > 0) {
      activeDaysCount += 1;
      totalClasses += records.length;
      for (const r of records) {
        const st = (r.status || '').trim().toLowerCase();
        if (st === 'present') {
          presentCount += 1;
        } else if (st === 'absent') {
          absentCount += 1;
        }
      }
    }
  }

  let percentage: number | null = null;
  if (totalClasses > 0) {
    percentage = Math.round((presentCount / totalClasses) * 1000) / 10;
  }

  const monthKey = formatMonthYearKey(year, month);
  const monthTitle = `${MONTH_NAMES[month - 1]} ${year}`;

  return {
    year,
    month,
    monthKey,
    monthTitle,
    totalClasses,
    presentCount,
    absentCount,
    percentage,
    activeDaysCount,
    totalDaysInMonth: daysInMonth,
  };
}

/**
 * Calculates per-subject attendance statistics for a given set of records.
 */
export function calculateSubjectBreakdown(
  records: AttendanceLogRecord[]
): SubjectAttendanceStat[] {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const subjectMap = new Map<string, { present: number; absent: number; total: number }>();

  for (const r of records) {
    const subject = (r.subject || 'Unknown').trim();
    const st = (r.status || '').trim().toLowerCase();

    let entry = subjectMap.get(subject);
    if (!entry) {
      entry = { present: 0, absent: 0, total: 0 };
      subjectMap.set(subject, entry);
    }

    entry.total += 1;
    if (st === 'present') {
      entry.present += 1;
    } else if (st === 'absent') {
      entry.absent += 1;
    }
  }

  const result: SubjectAttendanceStat[] = [];
  for (const [subject, stats] of subjectMap.entries()) {
    const percentage =
      stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : null;
    result.push({
      subject,
      present: stats.present,
      absent: stats.absent,
      total: stats.total,
      percentage,
    });
  }

  return result.sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject));
}

/**
 * Formats a local date string into human-readable format with weekday.
 * e.g. "2026-10-26" -> "Monday, October 26, 2026"
 */
export function formatFullDateDisplay(dateString: string): string {
  if (!isValidCalendarDate(dateString)) {
    return dateString;
  }

  const parts = dateString.split('-').map(Number);
  const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = localDate.getDay();
  const weekdayName = WEEKDAY_FULL_NAMES[jsDay === 0 ? 6 : jsDay - 1];
  const monthName = MONTH_NAMES[parts[1] - 1];

  return `${weekdayName}, ${monthName} ${parts[2]}, ${parts[0]}`;
}
