/**
 * Timetable & Academic Calendar Types (Phase 2E)
 *
 * Defines the domain model for recurring Monday–Saturday class schedules,
 * non-teaching holidays, and versioned local persistence schemas.
 */

export const TIMETABLE_STORAGE_KEY = '@attendance/timetable-v1';

/**
 * Teaching days are strictly Monday through Saturday.
 * Sunday is a non-teaching day by default and cannot have recurring class slots.
 */
export const TEACHING_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type TeachingDay = (typeof TEACHING_DAYS)[number];

export interface TimetableSlot {
  id: string; // Unique stable identifier (e.g., "slot_mon_0900_physiology")
  day: TeachingDay; // Monday .. Saturday
  startTime: string; // 24-hour format "HH:MM", e.g. "09:00"
  endTime: string; // 24-hour format "HH:MM", e.g. "10:00"
  subject: string; // Canonical or custom subject
  professor?: string; // Optional faculty member
  room?: string; // Optional classroom or laboratory name
}

export interface AcademicHoliday {
  id: string; // Unique identifier (e.g., "hol_20261031_diwali")
  date: string; // Local calendar date "YYYY-MM-DD"
  name: string; // Descriptive holiday name (e.g. "Diwali Break")
}

/**
 * Version 1 Timetable Configuration Schema for AsyncStorage.
 */
export interface TimetableConfigV1 {
  version: 1;
  effectiveFrom: string; // "YYYY-MM-DD" - date this timetable became active
  slots: TimetableSlot[];
  holidays: AcademicHoliday[];
  updatedAt: string; // ISO 8601 timestamp
}

export type ScheduleDayStatus =
  | 'before_effective_date'
  | 'sunday'
  | 'holiday'
  | 'teaching_day';

export interface DayScheduleResolution {
  isApplicable: boolean;
  status: ScheduleDayStatus;
  date: string;
  dayName: string;
  holidayName?: string;
  slots: TimetableSlot[];
}
