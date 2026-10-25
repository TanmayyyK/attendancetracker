/**
 * Attendance Math and Compliance Utilities
 *
 * Implements the core 75% target attendance formulas and weighted overall calculations.
 */

export const TARGET_ATTENDANCE_PERCENTAGE = 75;

export interface AttendanceStatusResult {
  needed: number;
  safeToSkip: number;
}

/**
 * Calculates classes needed to reach 75% or classes safe to skip while maintaining >= 75%.
 *
 * Target rule:
 * - Attend N more: (present + N) / (total + N) >= 3/4  =>  N >= 3*total - 4*present
 * - Skip S classes: present / (total + S) >= 3/4       =>  S <= (4*present - 3*total) / 3
 *
 * When total === 0 or counts are non-positive, returns { needed: 0, safeToSkip: 0 }.
 */
export function calculateAttendanceStatus(present: number, total: number): AttendanceStatusResult {
  const safePresent = Math.max(0, present);
  const safeTotal = Math.max(0, total);

  if (safeTotal === 0) {
    return { needed: 0, safeToSkip: 0 };
  }

  const needed = Math.max(0, 3 * safeTotal - 4 * safePresent);
  const safeToSkip = Math.floor(Math.max(0, (4 * safePresent - 3 * safeTotal) / 3));

  return { needed, safeToSkip };
}

/**
 * Calculates weighted overall attendance percentage: (totalPresents / totalClasses) * 100.
 *
 * Does not average subject percentages without weighting.
 * Handles zero denominators safely by returning 0.
 */
export function calculateOverallAttendance(totalPresents: number, totalClasses: number): number {
  if (totalClasses <= 0) {
    return 0;
  }
  const safePresents = Math.max(0, totalPresents);
  const percentage = (safePresents / totalClasses) * 100;
  return Math.max(0, Math.min(100, percentage));
}
