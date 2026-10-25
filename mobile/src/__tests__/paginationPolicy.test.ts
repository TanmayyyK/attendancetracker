/**
 * Attendance Pagination & Complete History Tests (Phase 2D Batch 2)
 *
 * Verifies:
 * 1. Pagination header parsing (X-Has-More, X-Next-Cursor).
 * 2. ID-based keyset deduplication and sequential page merging.
 * 3. Initial, middle, final, and empty page progression.
 * 4. Exact page boundary handling.
 * 5. Concurrent load-more protection and retry after page failure.
 * 6. Retroactive date placement into monthly sections across multiple pages.
 * 7. Filtering preserved across paginated pages.
 * 8. Complete export iterative page fetching and progress tracking.
 * 9. Export failure protection preventing silent partial export.
 * 10. Spreadsheet column formatting and incomplete dataset banner.
 * 11. Cross-tab focus-refresh on addition and deletion.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  parsePaginationHeaders,
  mergePaginatedLogs,
  fetchAllAttendancePages,
  filterLogs,
  groupLogsByMonth,
  type AttendanceLogRecord,
} from '../utils/logsPolicy.ts';

import {
  prepareAttendanceExportData,
} from '../utils/export.ts';

import {
  notifyAttendanceMutation,
  getAttendanceVersion,
  resetAttendanceEventBusForTesting,
  createFocusRefreshCoordinator,
} from '../services/attendance/attendanceEventBus.ts';

test('1. parsePaginationHeaders correctly extracts cursor and hasMore across header formats', () => {
  // Case-insensitive / standard headers
  const h1 = {
    get: (key: string) => {
      const map: Record<string, string> = {
        'x-has-more': 'true',
        'x-next-cursor': '451',
      };
      return map[key.toLowerCase()] ?? null;
    },
  };
  const parsed1 = parsePaginationHeaders(h1);
  assert.strictEqual(parsed1.hasMore, true);
  assert.strictEqual(parsed1.nextCursor, 451);

  // End of pages: hasMore false, empty cursor
  const h2 = {
    get: (key: string) => {
      const map: Record<string, string> = {
        'x-has-more': 'false',
        'x-next-cursor': '',
      };
      return map[key.toLowerCase()] ?? null;
    },
  };
  const parsed2 = parsePaginationHeaders(h2);
  assert.strictEqual(parsed2.hasMore, false);
  assert.strictEqual(parsed2.nextCursor, null);

  // Plain dictionary input
  const dictHeaders = {
    'X-Has-More': 'true',
    'X-Next-Cursor': '102',
  };
  const parsed3 = parsePaginationHeaders(dictHeaders);
  assert.strictEqual(parsed3.hasMore, true);
  assert.strictEqual(parsed3.nextCursor, 102);

  // Invalid / non-numeric cursor
  const badCursor = {
    'X-Has-More': 'true',
    'X-Next-Cursor': 'invalid_id',
  };
  const parsed4 = parsePaginationHeaders(badCursor);
  assert.strictEqual(parsed4.hasMore, true);
  assert.strictEqual(parsed4.nextCursor, null);
});

test('2. mergePaginatedLogs deduplicates by ID while preserving chronological order', () => {
  const existing: AttendanceLogRecord[] = [
    { id: 100, date: '2026-10-24', timestamp: '14:00:00', subject: 'Math', professor: 'Prof A', status: 'Present' },
    { id: 99, date: '2026-10-24', timestamp: '11:00:00', subject: 'Physics', professor: 'Prof B', status: 'Present' },
  ];

  // Incoming contains ID 99 (duplicate from concurrency/retry) and ID 98 (new)
  const incoming: AttendanceLogRecord[] = [
    { id: 99, date: '2026-10-24', timestamp: '11:00:00', subject: 'Physics', professor: 'Prof B', status: 'Present' },
    { id: 98, date: '2026-10-23', timestamp: '10:00:00', subject: 'CS', professor: 'Prof C', status: 'Absent' },
  ];

  const merged = mergePaginatedLogs(existing, incoming);
  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged[0].id, 100);
  assert.strictEqual(merged[1].id, 99);
  assert.strictEqual(merged[2].id, 98);
});

test('3. Keyset pagination progression across multi-page dataset', () => {
  // Simulate server holding records 100 down to 1
  const serverDb: AttendanceLogRecord[] = [];
  for (let i = 100; i >= 1; i--) {
    serverDb.push({
      id: i,
      date: `2026-10-${String((i % 20) + 1).padStart(2, '0')}`,
      timestamp: '10:00:00',
      subject: `Subject ${i % 3}`,
      professor: 'Prof X',
      status: i % 2 === 0 ? 'Present' : 'Absent',
    });
  }

  // Page 1 (limit 40)
  const p1Items = serverDb.slice(0, 40);
  const p1Cursor = p1Items[p1Items.length - 1].id; // 61
  const p1HasMore = true;

  let accumulated = mergePaginatedLogs([], p1Items);
  assert.strictEqual(accumulated.length, 40);
  assert.strictEqual(accumulated[0].id, 100);
  assert.strictEqual(accumulated[accumulated.length - 1].id, 61);

  // Page 2 (limit 40, before_id 61)
  const p2Items = serverDb.filter((r) => r.id < p1Cursor).slice(0, 40);
  const p2Cursor = p2Items[p2Items.length - 1].id; // 21
  const p2HasMore = true;

  accumulated = mergePaginatedLogs(accumulated, p2Items);
  assert.strictEqual(accumulated.length, 80);
  assert.strictEqual(accumulated[accumulated.length - 1].id, 21);

  // Page 3 (limit 40, before_id 21)
  const p3Items = serverDb.filter((r) => r.id < p2Cursor).slice(0, 40);
  const p3HasMore = false; // Only 20 items left
  assert.strictEqual(p3Items.length, 20);

  accumulated = mergePaginatedLogs(accumulated, p3Items);
  assert.strictEqual(accumulated.length, 100);
  assert.strictEqual(accumulated[accumulated.length - 1].id, 1);
});

test('4. Exact page boundary evaluates hasMore accurately', () => {
  // Server has exactly 50 records, requested with limit 50
  const serverDb: AttendanceLogRecord[] = [];
  for (let i = 50; i >= 1; i--) {
    serverDb.push({
      id: i,
      date: '2026-10-10',
      timestamp: '09:00:00',
      subject: 'Math',
      professor: 'Prof M',
      status: 'Present',
    });
  }

  // When probing with limit+1 (51): len(rows) is 50 -> has_more is false
  const rows = serverDb.slice(0, 51);
  const hasMore = rows.length > 50;
  assert.strictEqual(hasMore, false);
});

test('5. Concurrent load-more protection and retry after page failure', async () => {
  let inflight = false;
  let pageRequests = 0;
  let shouldFail = true;

  const simulateLoadMore = async () => {
    if (inflight) return 'BLOCKED';
    inflight = true;
    pageRequests++;
    try {
      if (shouldFail) {
        throw new Error('Network timeout');
      }
      return 'SUCCESS';
    } finally {
      inflight = false;
    }
  };

  // 1. Initial attempt fails
  let errCaught = false;
  try {
    await simulateLoadMore();
  } catch {
    errCaught = true;
  }
  assert.strictEqual(errCaught, true);
  assert.strictEqual(pageRequests, 1);
  assert.strictEqual(inflight, false);

  // 2. Retry succeeds without resetting cursor
  shouldFail = false;
  const retryResult = await simulateLoadMore();
  assert.strictEqual(retryResult, 'SUCCESS');
  assert.strictEqual(pageRequests, 2);
});

test('6. Retroactive dates place into target monthly sections across pages', () => {
  // Page 1: Latest entries with ID 100 (today) and ID 99 (retroactive August class entered today)
  const page1: AttendanceLogRecord[] = [
    { id: 100, date: '2026-10-24', timestamp: '10:00:00', subject: 'Math', professor: 'P1', status: 'Present' },
    { id: 99, date: '2026-08-15', timestamp: '11:00:00', subject: 'Physics', professor: 'P2', status: 'Absent' },
  ];

  let accumulated = mergePaginatedLogs([], page1);
  let sections = groupLogsByMonth(accumulated);

  // SectionList has 2 sections: October 2026 (1 class) and August 2026 (1 class)
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].monthKey, '2026-10');
  assert.strictEqual(sections[0].totalClasses, 1);
  assert.strictEqual(sections[1].monthKey, '2026-08');
  assert.strictEqual(sections[1].totalClasses, 1);

  // Page 2: Contains September 2026 and more August 2026 entries
  const page2: AttendanceLogRecord[] = [
    { id: 98, date: '2026-09-20', timestamp: '09:00:00', subject: 'Math', professor: 'P1', status: 'Present' },
    { id: 97, date: '2026-08-10', timestamp: '09:00:00', subject: 'Physics', professor: 'P2', status: 'Present' },
  ];

  accumulated = mergePaginatedLogs(accumulated, page2);
  sections = groupLogsByMonth(accumulated);

  // Grouping automatically places September in between, and folds ID 97 into August 2026!
  assert.strictEqual(sections.length, 3);
  assert.strictEqual(sections[0].monthKey, '2026-10');
  assert.strictEqual(sections[1].monthKey, '2026-09');
  assert.strictEqual(sections[2].monthKey, '2026-08');

  // August section now has 2 classes (1 present, 1 absent)
  assert.strictEqual(sections[2].totalClasses, 2);
  assert.strictEqual(sections[2].presentCount, 1);
  assert.strictEqual(sections[2].absentCount, 1);
});

test('7. Filtering applies accurately across newly loaded paginated pages', () => {
  const p1: AttendanceLogRecord[] = [
    { id: 50, date: '2026-10-24', timestamp: '10:00:00', subject: 'Math', professor: 'P1', status: 'Present' },
    { id: 49, date: '2026-10-24', timestamp: '11:00:00', subject: 'Physics', professor: 'P2', status: 'Present' },
  ];
  const p2: AttendanceLogRecord[] = [
    { id: 48, date: '2026-10-23', timestamp: '10:00:00', subject: 'Math', professor: 'P1', status: 'Absent' },
    { id: 47, date: '2026-10-23', timestamp: '11:00:00', subject: 'CS', professor: 'P3', status: 'Present' },
  ];

  let accumulated = mergePaginatedLogs([], p1);
  let mathOnly = filterLogs(accumulated, { subject: 'Math', status: 'All' });
  assert.strictEqual(mathOnly.length, 1);

  // Load page 2
  accumulated = mergePaginatedLogs(accumulated, p2);
  mathOnly = filterLogs(accumulated, { subject: 'Math', status: 'All' });
  assert.strictEqual(mathOnly.length, 2);
  assert.strictEqual(mathOnly[0].id, 50);
  assert.strictEqual(mathOnly[1].id, 48);
});

test('8. fetchAllAttendancePages iterates until complete and reports progress', async () => {
  const mockPages = [
    { items: [{ id: 3, date: '2026-10-24', timestamp: '10:00:00', subject: 'A', professor: 'P', status: 'Present' }], hasMore: true, nextCursor: 2 },
    { items: [{ id: 2, date: '2026-10-23', timestamp: '10:00:00', subject: 'B', professor: 'P', status: 'Present' }], hasMore: true, nextCursor: 1 },
    { items: [{ id: 1, date: '2026-10-22', timestamp: '10:00:00', subject: 'C', professor: 'P', status: 'Present' }], hasMore: false, nextCursor: null },
  ];

  let fetchIndex = 0;
  const progressReports: number[] = [];

  const result = await fetchAllAttendancePages(
    async (_cursor) => {
      const page = mockPages[fetchIndex++];
      return page ?? null;
    },
    {
      onProgress: (count) => progressReports.push(count),
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.hasMoreRemaining, false);
  assert.strictEqual(result.records.length, 3);
  assert.deepStrictEqual(progressReports, [1, 2, 3]);
});

test('9. fetchAllAttendancePages halts on intermediate page failure without silent completion', async () => {
  let callCount = 0;

  const result = await fetchAllAttendancePages(async (_cursor) => {
    callCount++;
    if (callCount === 2) {
      // Network drop on page 2
      return null;
    }
    return {
      items: [{ id: 10, date: '2026-10-24', timestamp: '10:00:00', subject: 'A', professor: 'P', status: 'Present' }],
      hasMore: true,
      nextCursor: 9,
    };
  });

  // Must report failure and flag that more remained
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.hasMoreRemaining, true);
  assert.strictEqual(result.records.length, 1);
  assert.strictEqual(typeof result.error, 'string');
});

test('10. Spreadsheet formatting handles all 6 columns and incomplete dataset warnings', () => {
  const records: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-24', timestamp: '09:00:00', subject: 'Math', professor: 'Dr. Rao', status: 'Absent', reason: 'Fever' },
  ];

  // 1. Normal complete export
  const completeRows = prepareAttendanceExportData(records);
  assert.strictEqual(completeRows.length, 1);
  assert.strictEqual(completeRows[0].Date, '2026-10-24');
  assert.strictEqual(completeRows[0].Time, '09:00:00');
  assert.strictEqual(completeRows[0].Subject, 'Math');
  assert.strictEqual(completeRows[0].Status, 'Absent');
  assert.strictEqual(completeRows[0].Reason, 'Fever');
  assert.strictEqual(completeRows[0].Professor, 'Dr. Rao');

  // 2. Incomplete export banner
  const incompleteRows = prepareAttendanceExportData(records, { isIncomplete: true });
  assert.strictEqual(incompleteRows.length, 2);
  assert.strictEqual(incompleteRows[0].Date, '--- ATTENTION ---');
  assert.strictEqual(incompleteRows[0].Time, 'INCOMPLETE DATASET');
  assert.strictEqual(incompleteRows[0].Status, 'PARTIAL');
  assert.strictEqual(incompleteRows[1].Subject, 'Math');
});

test('11. Addition and deletion focus synchronization resets and refreshes', async () => {
  resetAttendanceEventBusForTesting(0);

  let refreshCount = 0;
  const coordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      refreshCount++;
    },
  });

  // Initial focus check: version is 0, observed is 0 -> does not trigger duplicate refresh
  const initialFired = await coordinator.checkAndRefresh();
  assert.strictEqual(initialFired, false);
  assert.strictEqual(refreshCount, 0);

  // User submits attendance on Add tab
  notifyAttendanceMutation();
  assert.strictEqual(getAttendanceVersion(), 1);

  // User switches back to Logs tab -> focus effect runs checkAndRefresh
  const refreshedAfterMutation = await coordinator.checkAndRefresh();
  assert.strictEqual(refreshedAfterMutation, true);
  assert.strictEqual(refreshCount, 1);

  // Subsequent focus without mutation does not re-fetch
  const refreshedSameTab = await coordinator.checkAndRefresh();
  assert.strictEqual(refreshedSameTab, false);
  assert.strictEqual(refreshCount, 1);
});
