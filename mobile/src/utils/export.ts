/**
 * Attendance Export Utilities
 */

export interface AttendanceExportRecord {
  date?: string;
  timestamp?: string;
  subject?: string;
  status?: string;
  reason?: string | null;
  professor?: string | null;
  [key: string]: any;
}

export interface AttendanceSpreadsheetRow {
  Date: string;
  Time: string;
  Subject: string;
  Status: string;
  Reason: string;
  Professor: string;
}

export interface PrepareExportOptions {
  isIncomplete?: boolean;
  incompleteNotice?: string;
}

/**
 * Prepares attendance records for spreadsheet export.
 *
 * Maps all available records into spreadsheet rows including reason and professor details.
 * If marked incomplete, prepends a prominent banner row warning the reader.
 */
export function prepareAttendanceExportData(
  records: AttendanceExportRecord[],
  options?: PrepareExportOptions
): AttendanceSpreadsheetRow[] {
  if (!Array.isArray(records)) {
    return [];
  }

  const rows: AttendanceSpreadsheetRow[] = [];

  if (options?.isIncomplete) {
    rows.push({
      Date: '--- ATTENTION ---',
      Time: 'INCOMPLETE DATASET',
      Subject: options.incompleteNotice ?? 'Network interrupted before all records could be fetched',
      Status: 'PARTIAL',
      Reason: 'INCOMPLETE',
      Professor: 'INCOMPLETE',
    });
  }

  for (const log of records) {
    rows.push({
      Date: log.date ?? '',
      Time: log.timestamp ?? '',
      Subject: log.subject ?? '',
      Status: log.status ?? '',
      Reason: log.reason ?? '',
      Professor: log.professor ?? '',
    });
  }

  return rows;
}
