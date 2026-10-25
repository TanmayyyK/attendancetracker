/**
 * Historical Attendance Calendar Regression & Keyset Pagination Tests
 *
 * Verifies:
 * 1. Multi-page keyset pagination across September 20 loads all available history.
 * 2. Records older than September 20 are retained and indexed by their exact dates.
 * 3. Keyset cursor progression does not skip records or stop prematurely.
 * 4. Repeated, stuck, or malformed cursors halt safely with explicit incomplete state.
 * 5. Duplicate page responses (server ignoring before_id) fail safely without false success.
 * 6. Intermediate pagination failure produces an explicit incomplete-history state.
 * 7. Date mapping preserves historical calendar days without timezone offset shifts.
 * 8. Calendar month grid and summary include records before September 20.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  parsePaginationHeaders,
  mergePaginatedLogs,
  fetchAllAttendancePages,
  type AttendanceLogRecord,
} from '../utils/logsPolicy.ts';

import {
  groupRecordsByDate,
  generateMonthGrid,
  calculateMonthSummary,
  summarizeDayAttendance,
  formatFullDateDisplay,
  getYearMonthFromDate,
} from '../utils/calendarPolicy.ts';

test('1. Multi-page keyset pagination spanning before and after September 20 loads all records', async () => {
  // Deterministic fixture spanning October down to August 2026
  const page1: AttendanceLogRecord[] = [
    { id: 300, date: '2026-10-23', timestamp: '10:00:00', subject: 'Anatomy', professor: 'Dr. A', status: 'Present' },
    { id: 299, date: '2026-10-15', timestamp: '11:00:00', subject: 'Physiology', professor: 'Dr. B', status: 'Present' },
    { id: 201, date: '2026-09-22', timestamp: '09:00:00', subject: 'Samhita', professor: 'Dr. C', status: 'Absent' },
  ];

  const page2: AttendanceLogRecord[] = [
    { id: 200, date: '2026-09-18', timestamp: '10:00:00', subject: 'Padarth Vigyan', professor: 'Dr. D', status: 'Present' },
    { id: 199, date: '2026-09-10', timestamp: '11:00:00', subject: 'Sanskrit', professor: 'Dr. E', status: 'Present' },
    { id: 101, date: '2026-09-02', timestamp: '12:00:00', subject: 'Anatomy', professor: 'Dr. A', status: 'Absent' },
  ];

  const page3: AttendanceLogRecord[] = [
    { id: 100, date: '2026-08-28', timestamp: '10:00:00', subject: 'Physiology', professor: 'Dr. B', status: 'Present' },
    { id: 50, date: '2026-08-15', timestamp: '11:00:00', subject: 'Samhita', professor: 'Dr. C', status: 'Present' },
  ];

  const requestedCursors: (number | null)[] = [];

  const fetchPage = async (cursor: number | null) => {
    requestedCursors.push(cursor);
    if (cursor === null) {
      return { items: page1, hasMore: true, nextCursor: 201 };
    }
    if (cursor === 201) {
      return { items: page2, hasMore: true, nextCursor: 101 };
    }
    if (cursor === 101) {
      return { items: page3, hasMore: false, nextCursor: null };
    }
    return { items: [], hasMore: false, nextCursor: null };
  };

  const result = await fetchAllAttendancePages(fetchPage);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.hasMoreRemaining, false);
  assert.strictEqual(result.records.length, 8);
  assert.deepStrictEqual(requestedCursors, [null, 201, 101]);

  // Verify all records on both sides of September 20 are retained
  const recordDates = result.records.map((r) => r.date);
  assert.ok(recordDates.includes('2026-10-23'));
  assert.ok(recordDates.includes('2026-09-22'));
  assert.ok(recordDates.includes('2026-09-18'), 'Record from 2026-09-18 before Sept 20 must be present');
  assert.ok(recordDates.includes('2026-09-10'), 'Record from 2026-09-10 before Sept 20 must be present');
  assert.ok(recordDates.includes('2026-09-02'), 'Record from 2026-09-02 before Sept 20 must be present');
  assert.ok(recordDates.includes('2026-08-28'), 'Record from August must be present');
});

test('2. Records older than September 20 are indexed correctly by calendar policy', () => {
  const records: AttendanceLogRecord[] = [
    { id: 250, date: '2026-09-25', timestamp: '10:00:00', subject: 'Anatomy', professor: 'P1', status: 'Present' },
    { id: 200, date: '2026-09-18', timestamp: '10:00:00', subject: 'Physiology', professor: 'P2', status: 'Present' },
    { id: 190, date: '2026-09-15', timestamp: '09:00:00', subject: 'Samhita', professor: 'P3', status: 'Absent' },
    { id: 150, date: '2026-09-05', timestamp: '11:00:00', subject: 'Padarth Vigyan', professor: 'P4', status: 'Present' },
    { id: 100, date: '2026-08-20', timestamp: '10:00:00', subject: 'Sanskrit', professor: 'P5', status: 'Present' },
  ];

  const dateMap = groupRecordsByDate(records);

  // Dates before September 20 must be in the map
  assert.strictEqual(dateMap.has('2026-09-18'), true);
  assert.strictEqual(dateMap.has('2026-09-15'), true);
  assert.strictEqual(dateMap.has('2026-09-05'), true);
  assert.strictEqual(dateMap.has('2026-08-20'), true);

  // September 2026 grid must show activity on those days
  const septGrid = generateMonthGrid(2026, 9, dateMap, '2026-10-25');
  const day18 = septGrid.find((cell) => cell.date === '2026-09-18');
  assert.ok(day18);
  assert.strictEqual(day18.totalClasses, 1);
  assert.strictEqual(day18.presentCount, 1);
  assert.strictEqual(day18.intensity, 1);

  const day15 = septGrid.find((cell) => cell.date === '2026-09-15');
  assert.ok(day15);
  assert.strictEqual(day15.totalClasses, 1);
  assert.strictEqual(day15.absentCount, 1);
  assert.strictEqual(day15.intensity, 1);

  // Month summary for September must include both pre- and post-Sept 20 classes
  const septSummary = calculateMonthSummary(2026, 9, dateMap);
  assert.strictEqual(septSummary.totalClasses, 4);
  assert.strictEqual(septSummary.presentCount, 3);
  assert.strictEqual(septSummary.absentCount, 1);
  assert.strictEqual(septSummary.activeDaysCount, 4);
});

test('3. Repeated cursor halts pagination safely with explicit incomplete state', async () => {
  let callCount = 0;
  const repeatedCursorMock = async (_cursor: number | null) => {
    callCount++;
    if (callCount === 1) {
      return {
        items: [{ id: 100, date: '2026-10-20', timestamp: '10:00:00', subject: 'A', professor: 'P', status: 'Present' }],
        hasMore: true,
        nextCursor: 90,
      };
    }
    // Server returns identical cursor 90 again instead of advancing
    return {
      items: [{ id: 90, date: '2026-10-19', timestamp: '10:00:00', subject: 'B', professor: 'P', status: 'Present' }],
      hasMore: true,
      nextCursor: 90,
    };
  };

  const result = await fetchAllAttendancePages(repeatedCursorMock);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.hasMoreRemaining, true);
  assert.strictEqual(result.records.length, 2);
  assert.ok(result.error?.includes('repeated cursor'));
});

test('4. Server returning duplicate items (ignoring before_id) halts with explicit failure', async () => {
  const page1Items: AttendanceLogRecord[] = [
    { id: 1246, date: '2026-10-23', timestamp: '10:00:00', subject: 'A', professor: 'P', status: 'Present' },
    { id: 1147, date: '2026-09-22', timestamp: '10:00:00', subject: 'B', professor: 'P', status: 'Present' },
  ];

  let callCount = 0;
  const legacyServerMock = async (_cursor: number | null) => {
    callCount++;
    // Page 2 returns the exact same items because backend ignored before_id
    return {
      items: page1Items,
      hasMore: true,
      nextCursor: 1147,
    };
  };

  const result = await fetchAllAttendancePages(legacyServerMock);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.hasMoreRemaining, true);
  assert.strictEqual(result.records.length, 2);
  assert.ok(result.error?.includes('duplicate records'));
});

test('5. Intermediate pagination failure produces an explicit incomplete-history state', async () => {
  let callCount = 0;
  const networkDropMock = async (cursor: number | null) => {
    callCount++;
    if (callCount === 1) {
      return {
        items: [
          { id: 50, date: '2026-10-20', timestamp: '10:00:00', subject: 'A', professor: 'P', status: 'Present' },
        ],
        hasMore: true,
        nextCursor: 40,
      };
    }
    // Network drops on page 2
    return null;
  };

  const result = await fetchAllAttendancePages(networkDropMock);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.hasMoreRemaining, true);
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(result.records[0].id, 50);
  assert.ok(result.error?.includes('Failed to retrieve attendance history'));
});

test('6. Date mapping preserves historical calendar days without timezone shifts', () => {
  const dates = ['2026-09-20', '2026-09-19', '2026-09-01', '2026-08-31', '2026-01-01'];

  for (const dateStr of dates) {
    const summary = summarizeDayAttendance(dateStr, [], '2026-10-25');
    assert.strictEqual(summary.date, dateStr);

    const parts = dateStr.split('-').map(Number);
    assert.strictEqual(summary.dayOfMonth, parts[2]);

    const ym = getYearMonthFromDate(dateStr);
    assert.strictEqual(ym.year, parts[0]);
    assert.strictEqual(ym.month, parts[1]);
  }

  // Display name formatting
  assert.strictEqual(formatFullDateDisplay('2026-09-20'), 'Sunday, September 20, 2026');
  assert.strictEqual(formatFullDateDisplay('2026-09-19'), 'Saturday, September 19, 2026');
});

test('7. Header parsing accurately detects present vs missing pagination headers', () => {
  // Case with standard pagination headers
  const withHeaders = {
    get: (name: string) => {
      const lower = name.toLowerCase();
      if (lower === 'x-has-more') return 'true';
      if (lower === 'x-next-cursor') return '1147';
      return null;
    },
  };
  const parsed1 = parsePaginationHeaders(withHeaders);
  assert.strictEqual(parsed1.hasHeader, true);
  assert.strictEqual(parsed1.hasMore, true);
  assert.strictEqual(parsed1.nextCursor, 1147);

  // Case with final page pagination headers
  const finalPageHeaders = {
    get: (name: string) => {
      const lower = name.toLowerCase();
      if (lower === 'x-has-more') return 'false';
      if (lower === 'x-next-cursor') return '';
      return null;
    },
  };
  const parsed2 = parsePaginationHeaders(finalPageHeaders);
  assert.strictEqual(parsed2.hasHeader, true);
  assert.strictEqual(parsed2.hasMore, false);
  assert.strictEqual(parsed2.nextCursor, null);

  // Case with legacy server (no pagination headers)
  const legacyHeaders = {
    get: () => null,
  };
  const parsed3 = parsePaginationHeaders(legacyHeaders);
  assert.strictEqual(parsed3.hasHeader, false);
  assert.strictEqual(parsed3.hasMore, false);
  assert.strictEqual(parsed3.nextCursor, null);
});
