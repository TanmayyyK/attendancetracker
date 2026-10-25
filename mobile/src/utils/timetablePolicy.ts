/**
 * Pure Timetable & Academic Calendar Policy
 *
 * Implements deterministic validation, slot overlap detection, chronological sorting,
 * and local-calendar academic week calculations.
 *
 * Zero native/React dependencies; 100% testable in Node.
 */

import {
  TEACHING_DAYS,
  type TeachingDay,
  type TimetableSlot,
  type AcademicHoliday,
  type TimetableConfigV1,
  type DayScheduleResolution,
} from '../types/timetable.ts';

import { isValidCalendarDate, getLocalTodayDateString } from './dates.ts';

/**
 * Validates 24-hour time format "HH:MM" (00:00 to 23:59).
 */
export function validateTimeFormat(time: string): boolean {
  if (!time || typeof time !== 'string') {
    return false;
  }
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
}

/**
 * Converts "HH:MM" to total minutes since midnight (e.g. "09:30" -> 570).
 */
export function timeToMinutes(time: string): number {
  if (!validateTimeFormat(time)) {
    return -1;
  }
  const [h, m] = time.trim().split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks whether end time is strictly after start time.
 */
export function isEndTimeAfterStartTime(start: string, end: string): boolean {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin < 0 || endMin < 0) {
    return false;
  }
  return endMin > startMin;
}

/**
 * Validates whether a day string is an approved TeachingDay (Monday .. Saturday).
 * Sunday is strictly rejected.
 */
export function isTeachingDay(day: unknown): day is TeachingDay {
  if (typeof day !== 'string') return false;
  return TEACHING_DAYS.includes(day as TeachingDay);
}

/**
 * Detects whether two slots on the same day overlap in time.
 * If slots are on different days or one is invalid, returns false.
 */
export function detectSlotOverlap(slotA: TimetableSlot, slotB: TimetableSlot): boolean {
  if (!slotA || !slotB || slotA.day !== slotB.day) {
    return false;
  }

  const startA = timeToMinutes(slotA.startTime);
  const endA = timeToMinutes(slotA.endTime);
  const startB = timeToMinutes(slotB.startTime);
  const endB = timeToMinutes(slotB.endTime);

  if (startA < 0 || endA < 0 || startB < 0 || endB < 0) {
    return false;
  }

  // Two open intervals (startA, endA) and (startB, endB) overlap if max(start) < min(end)
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Sorts timetable slots chronologically:
 * Primary: Start time ascending
 * Secondary: End time ascending
 * Tertiary: ID ascending
 */
export function sortSlotsChronologically(slots: TimetableSlot[]): TimetableSlot[] {
  if (!Array.isArray(slots)) {
    return [];
  }

  return [...slots].sort((a, b) => {
    const startA = timeToMinutes(a.startTime);
    const startB = timeToMinutes(b.startTime);
    if (startA !== startB) {
      return startA - startB;
    }

    const endA = timeToMinutes(a.endTime);
    const endB = timeToMinutes(b.endTime);
    if (endA !== endB) {
      return endA - endB;
    }

    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Sanitizes and validates a single timetable slot.
 */
export function sanitizeSlot(
  raw: unknown
): { slot: TimetableSlot | null; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { slot: null, error: 'Slot must be an object' };
  }

  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return { slot: null, error: 'Slot ID is required' };
  }

  if (!isTeachingDay(r.day)) {
    return { slot: null, error: 'Day must be Monday through Saturday. Sunday is not a teaching day.' };
  }

  const startTime = typeof r.startTime === 'string' ? r.startTime.trim() : '';
  const endTime = typeof r.endTime === 'string' ? r.endTime.trim() : '';

  if (!validateTimeFormat(startTime)) {
    return { slot: null, error: `Invalid start time "${startTime}". Must be 24h HH:MM format.` };
  }
  if (!validateTimeFormat(endTime)) {
    return { slot: null, error: `Invalid end time "${endTime}". Must be 24h HH:MM format.` };
  }
  if (!isEndTimeAfterStartTime(startTime, endTime)) {
    return { slot: null, error: `End time (${endTime}) must be strictly after start time (${startTime}).` };
  }

  const subject = typeof r.subject === 'string' ? r.subject.trim() : '';
  if (!subject) {
    return { slot: null, error: 'Subject is required' };
  }

  const professor = typeof r.professor === 'string' && r.professor.trim() ? r.professor.trim() : undefined;
  const room = typeof r.room === 'string' && r.room.trim() ? r.room.trim() : undefined;

  return {
    slot: {
      id,
      day: r.day,
      startTime,
      endTime,
      subject,
      professor,
      room,
    },
  };
}

/**
 * Sanitizes and validates a single holiday entry.
 */
export function sanitizeHoliday(
  raw: unknown
): { holiday: AcademicHoliday | null; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { holiday: null, error: 'Holiday must be an object' };
  }

  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id.trim() : '';
  if (!id) {
    return { holiday: null, error: 'Holiday ID is required' };
  }

  const date = typeof r.date === 'string' ? r.date.trim() : '';
  if (!isValidCalendarDate(date)) {
    return { holiday: null, error: `Invalid holiday date "${date}". Must be YYYY-MM-DD.` };
  }

  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) {
    return { holiday: null, error: 'Holiday name is required' };
  }

  return {
    holiday: {
      id,
      date,
      name,
    },
  };
}

/**
 * Creates an empty default timetable configuration.
 */
export function createDefaultTimetableConfig(effectiveFrom?: string): TimetableConfigV1 {
  const effective = effectiveFrom && isValidCalendarDate(effectiveFrom)
    ? effectiveFrom
    : getLocalTodayDateString();

  return {
    version: 1,
    effectiveFrom: effective,
    slots: [],
    holidays: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates and sanitizes a complete TimetableConfigV1 payload.
 * Drops invalid or overlapping slots safely while preserving valid data.
 */
export function validateAndSanitizeConfig(
  raw: unknown,
  fallbackEffectiveFrom?: string
): { valid: boolean; config: TimetableConfigV1; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      config: createDefaultTimetableConfig(fallbackEffectiveFrom),
      error: 'Stored payload is not a valid object',
    };
  }

  const r = raw as Record<string, unknown>;

  if (r.version !== 1) {
    return {
      valid: false,
      config: createDefaultTimetableConfig(fallbackEffectiveFrom),
      error: `Unsupported timetable configuration version "${r.version}"`,
    };
  }

  let effectiveFrom = typeof r.effectiveFrom === 'string' ? r.effectiveFrom.trim() : '';
  if (!isValidCalendarDate(effectiveFrom)) {
    effectiveFrom = fallbackEffectiveFrom && isValidCalendarDate(fallbackEffectiveFrom)
      ? fallbackEffectiveFrom
      : getLocalTodayDateString();
  }

  // Sanitize slots: reject malformed items and enforce no duplicate IDs
  const validSlots: TimetableSlot[] = [];
  const seenIds = new Set<string>();

  if (Array.isArray(r.slots)) {
    for (const rawSlot of r.slots) {
      const { slot } = sanitizeSlot(rawSlot);
      if (slot && !seenIds.has(slot.id)) {
        seenIds.add(slot.id);
        validSlots.push(slot);
      }
    }
  }

  // Sanitize holidays
  const validHolidays: AcademicHoliday[] = [];
  const seenHolidayIds = new Set<string>();
  const seenHolidayDates = new Set<string>();

  if (Array.isArray(r.holidays)) {
    for (const rawHol of r.holidays) {
      const { holiday } = sanitizeHoliday(rawHol);
      if (holiday && !seenHolidayIds.has(holiday.id) && !seenHolidayDates.has(holiday.date)) {
        seenHolidayIds.add(holiday.id);
        seenHolidayDates.add(holiday.date);
        validHolidays.push(holiday);
      }
    }
  }

  const updatedAt = typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : new Date().toISOString();

  return {
    valid: true,
    config: {
      version: 1,
      effectiveFrom,
      slots: sortSlotsChronologically(validSlots),
      holidays: validHolidays.sort((a, b) => a.date.localeCompare(b.date)),
      updatedAt,
    },
  };
}

/**
 * Extracts weekday information for any valid local calendar date string (YYYY-MM-DD).
 * Sunday is strictly identified as non-teaching.
 */
export function getWeekdayFromCalendarDate(dateString: string): {
  isSunday: boolean;
  teachingDay: TeachingDay | null;
  dayName: string;
  dayIndex: number; // 0 for Monday .. 5 for Saturday, 6 for Sunday
} {
  if (!isValidCalendarDate(dateString)) {
    return { isSunday: false, teachingDay: null, dayName: 'Unknown', dayIndex: -1 };
  }

  const parts = dateString.split('-').map(Number);
  const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = localDate.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

  if (jsDay === 0) {
    return {
      isSunday: true,
      teachingDay: null,
      dayName: 'Sunday',
      dayIndex: 6,
    };
  }

  const teachingDay = TEACHING_DAYS[jsDay - 1];
  return {
    isSunday: false,
    teachingDay,
    dayName: teachingDay,
    dayIndex: jsDay - 1,
  };
}

/**
 * Returns the Monday calendar date ("YYYY-MM-DD") for the week containing referenceDate.
 * Academic week runs Monday through Sunday.
 */
export function getMondayOfWeek(referenceDateString: string): string {
  if (!isValidCalendarDate(referenceDateString)) {
    return referenceDateString;
  }

  const parts = referenceDateString.split('-').map(Number);
  const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = localDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

  // Days to subtract to reach Monday
  const diff = jsDay === 0 ? 6 : jsDay - 1;
  localDate.setDate(localDate.getDate() - diff);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Sunday calendar date ("YYYY-MM-DD") for the week containing referenceDate.
 */
export function getSundayOfWeek(referenceDateString: string): string {
  const monday = getMondayOfWeek(referenceDateString);
  const parts = monday.split('-').map(Number);
  const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
  localDate.setDate(localDate.getDate() + 6);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface WeekDayInfo {
  date: string;
  dayName: string;
  isSunday: boolean;
  teachingDay: TeachingDay | null;
}

/**
 * Returns all 7 days of the academic week (Monday through Sunday) for referenceDate.
 */
export function getWeekDaysRange(referenceDateString: string): WeekDayInfo[] {
  const monday = getMondayOfWeek(referenceDateString);
  const parts = monday.split('-').map(Number);
  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(parts[0], parts[1] - 1, parts[2] + i);
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isSunday = i === 6;
    const teachingDay = isSunday ? null : TEACHING_DAYS[i];
    days.push({
      date: dateStr,
      dayName: isSunday ? 'Sunday' : TEACHING_DAYS[i],
      isSunday,
      teachingDay,
    });
  }

  return days;
}

/**
 * Resolves the planned schedule for a specific calendar date against the active timetable config.
 *
 * Rules:
 * 1. If date is before config.effectiveFrom: not applicable.
 * 2. If date is Sunday: non-teaching day (slots = []).
 * 3. If date matches an AcademicHoliday: suspended for holiday (slots = []).
 * 4. Otherwise: returns chronological class slots assigned to that day of week.
 */
export function getEffectiveScheduleForDate(
  dateString: string,
  config: TimetableConfigV1
): DayScheduleResolution {
  if (!isValidCalendarDate(dateString)) {
    return {
      isApplicable: false,
      status: 'before_effective_date',
      date: dateString,
      dayName: 'Invalid',
      slots: [],
    };
  }

  const weekdayInfo = getWeekdayFromCalendarDate(dateString);

  // 1. Check if date is before effective date
  if (dateString < config.effectiveFrom) {
    return {
      isApplicable: false,
      status: 'before_effective_date',
      date: dateString,
      dayName: weekdayInfo.dayName,
      slots: [],
    };
  }

  // 2. Check Sunday (non-teaching)
  if (weekdayInfo.isSunday) {
    return {
      isApplicable: true,
      status: 'sunday',
      date: dateString,
      dayName: 'Sunday',
      slots: [],
    };
  }

  // 3. Check Holiday override
  const holiday = config.holidays.find((h) => h.date === dateString);
  if (holiday) {
    return {
      isApplicable: true,
      status: 'holiday',
      date: dateString,
      dayName: weekdayInfo.dayName,
      holidayName: holiday.name,
      slots: [],
    };
  }

  // 4. Normal teaching day
  const slotsForDay = config.slots.filter((s) => s.day === weekdayInfo.teachingDay);
  return {
    isApplicable: true,
    status: 'teaching_day',
    date: dateString,
    dayName: weekdayInfo.dayName,
    slots: sortSlotsChronologically(slotsForDay),
  };
}
