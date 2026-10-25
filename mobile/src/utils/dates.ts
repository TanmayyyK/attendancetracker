/**
 * Local Date Formatting and Strict Calendar Date Validation Utilities
 */

/**
 * Returns a calendar date string in local time as "YYYY-MM-DD".
 * Avoids unintended UTC day shifts caused by Date.prototype.toISOString().
 */
export function getLocalTodayDateString(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Strictly validates whether a date string is a real calendar date in "YYYY-MM-DD" format.
 *
 * Verifies:
 * 1. Strict YYYY-MM-DD regex pattern (4-digit year, 2-digit month 01-12, 2-digit day 01-31).
 * 2. Plausible year boundary (1900 to 2100).
 * 3. Exact calendar validity, rejecting impossible dates such as:
 *    - February 30th
 *    - February 29th on non-leap years (e.g. 2025, 2026)
 *    - April 31st, June 31st, September 31st, November 31st
 */
export function isValidCalendarDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  const trimmed = dateString.trim();
  const match = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!match) {
    return false;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) {
    return false;
  }

  // Construct in local calendar coordinates to verify days in month
  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getFullYear() === year &&
    testDate.getMonth() === month - 1 &&
    testDate.getDate() === day
  );
}

/**
 * Formats a "YYYY-MM-DD" date-only string for user display.
 *
 * Uses local calendar coordinates to eliminate UTC midnight interpretation shifts
 * which previously caused dates to display one day behind in timezones west of UTC.
 */
export function formatDateOnly(dateString: string, locale?: string): string {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }

  const trimmed = dateString.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return dateString;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString(locale);
}
