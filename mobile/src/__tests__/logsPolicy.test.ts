/**
 * Logs & History Policy Integration Tests
 *
 * Verifies Phase 2D Batch 1 requirements:
 * 1. Dynamic subject discovery combining canonical and encountered subjects.
 * 2. Subject and status filtering (individual and compound).
 * 3. Strict chronological sorting (date desc, timestamp desc, id desc).
 * 4. Month grouping with timezone-safe calendar extraction.
 * 5. Monthly section summary totals (total classes, presents, absents).
 * 6. Empty state differentiation (empty history vs 0 filter matches).
 * 7. Export formatting with all 6 columns (Date, Time, Subject, Status, Reason, Professor).
 * 8. Cross-tab refresh and invalidation on addition and deletion.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  extractAvailableSubjects,
  filterLogs,
  sortLogsChronologically,
  groupLogsByMonth,
  formatMonthTitle,
  type AttendanceLogRecord,
} from '../utils/logsPolicy.ts';

import {
  prepareAttendanceExportData,
} from '../utils/export.ts';

import {
  CANONICAL_SUBJECTS,
} from '../types/attendanceIntelligence.ts';

import {
  notifyAttendanceMutation,
  getAttendanceVersion,
  resetAttendanceEventBusForTesting,
  createFocusRefreshCoordinator,
} from '../services/attendance/attendanceEventBus.ts';

test('1. Subject discovery combines canonical subjects and dynamic subjects in order', () => {
  const records: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-24', timestamp: '10:00:00', subject: 'Anatomy', professor: 'Satish Sir', status: 'Present' },
    { id: 2, date: '2026-10-24', timestamp: '11:00:00', subject: 'Biochemistry (Guest)', professor: 'Guest', status: 'Present' },
    { id: 3, date: '2026-10-24', timestamp: '12:00:00', subject: 'Pharmacology Elective', professor: 'Dr. Rao', status: 'Absent' },
  ];

  const subjects = extractAvailableSubjects(records);

  // 'All' is first
  assert.strictEqual(subjects[0], 'All');

  // Next are all 5 canonical subjects in exact order
  for (let i = 0; i < CANONICAL_SUBJECTS.length; i++) {
    assert.strictEqual(subjects[i + 1], CANONICAL_SUBJECTS[i]);
  }

  // Dynamic subjects are appended alphabetically after canonical
  assert.strictEqual(subjects.includes('Biochemistry (Guest)'), true);
  assert.strictEqual(subjects.includes('Pharmacology Elective'), true);
  assert.strictEqual(subjects[CANONICAL_SUBJECTS.length + 1], 'Biochemistry (Guest)');
  assert.strictEqual(subjects[CANONICAL_SUBJECTS.length + 2], 'Pharmacology Elective');
});

test('2. Subject and status filtering operates independently and as compound filter', () => {
  const records: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-24', timestamp: '09:00:00', subject: 'Physiology', professor: 'P1', status: 'Present' },
    { id: 2, date: '2026-10-24', timestamp: '10:00:00', subject: 'Physiology', professor: 'P1', status: 'Absent', reason: 'Sick' },
    { id: 3, date: '2026-10-24', timestamp: '11:00:00', subject: 'Anatomy', professor: 'P2', status: 'Present' },
    { id: 4, date: '2026-10-24', timestamp: '12:00:00', subject: 'Anatomy', professor: 'P2', status: 'Absent', reason: 'Sleeping' },
  ];

  // 1. All / All
  const all = filterLogs(records, { subject: 'All', status: 'All' });
  assert.strictEqual(all.length, 4);

  // 2. Subject filter only
  const physiology = filterLogs(records, { subject: 'Physiology', status: 'All' });
  assert.strictEqual(physiology.length, 2);
  assert.strictEqual(physiology.every((r) => r.subject === 'Physiology'), true);

  // 3. Status filter only
  const absents = filterLogs(records, { subject: 'All', status: 'Absent' });
  assert.strictEqual(absents.length, 2);
  assert.strictEqual(absents.every((r) => r.status === 'Absent'), true);

  // 4. Compound filter: Physiology + Absent
  const compound = filterLogs(records, { subject: 'Physiology', status: 'Absent' });
  assert.strictEqual(compound.length, 1);
  assert.strictEqual(compound[0].id, 2);
  assert.strictEqual(compound[0].subject, 'Physiology');
  assert.strictEqual(compound[0].status, 'Absent');
  assert.strictEqual(compound[0].reason, 'Sick');
});

test('3. Chronological sorting orders retroactively logged entries by actual date', () => {
  // Simulate out-of-order database insertions (e.g. retroactive entries have higher IDs)
  const records: AttendanceLogRecord[] = [
    { id: 50, date: '2026-09-15', timestamp: '14:00:00', subject: 'Physiology', professor: 'P1', status: 'Present' }, // Retroactively entered with high ID
    { id: 10, date: '2026-10-20', timestamp: '09:00:00', subject: 'Anatomy', professor: 'P2', status: 'Present' },
    { id: 12, date: '2026-10-20', timestamp: '11:00:00', subject: 'Samhita', professor: 'P3', status: 'Present' },
    { id: 30, date: '2026-10-24', timestamp: '10:00:00', subject: 'Physiology', professor: 'P1', status: 'Present' },
  ];

  const sorted = sortLogsChronologically(records);

  // Newest calendar date first
  assert.strictEqual(sorted[0].date, '2026-10-24');
  assert.strictEqual(sorted[0].id, 30);

  // Next same date: 2026-10-20, sorted by timestamp descending
  assert.strictEqual(sorted[1].date, '2026-10-20');
  assert.strictEqual(sorted[1].timestamp, '11:00:00');
  assert.strictEqual(sorted[1].id, 12);

  assert.strictEqual(sorted[2].date, '2026-10-20');
  assert.strictEqual(sorted[2].timestamp, '09:00:00');
  assert.strictEqual(sorted[2].id, 10);

  // September entry must be at the bottom despite having the highest ID (id: 50)
  assert.strictEqual(sorted[3].date, '2026-09-15');
  assert.strictEqual(sorted[3].id, 50);
});

test('4. Month grouping and timezone safety', () => {
  assert.strictEqual(formatMonthTitle('2026-10'), 'October 2026');
  assert.strictEqual(formatMonthTitle('2026-03'), 'March 2026');
  assert.strictEqual(formatMonthTitle('invalid'), 'Other Classes');

  const records: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-01', timestamp: '09:00:00', subject: 'Physiology', professor: 'P1', status: 'Present' }, // 1st of October
    { id: 2, date: '2026-09-30', timestamp: '16:00:00', subject: 'Anatomy', professor: 'P2', status: 'Present' }, // 30th of September
    { id: 3, date: '2026-09-15', timestamp: '10:00:00', subject: 'Samhita', professor: 'P3', status: 'Absent' },
  ];

  const sections = groupLogsByMonth(records);

  assert.strictEqual(sections.length, 2);

  // Section 1: October 2026
  assert.strictEqual(sections[0].monthKey, '2026-10');
  assert.strictEqual(sections[0].title, 'October 2026');
  assert.strictEqual(sections[0].data.length, 1);
  assert.strictEqual(sections[0].data[0].id, 1);

  // Section 2: September 2026
  assert.strictEqual(sections[1].monthKey, '2026-09');
  assert.strictEqual(sections[1].title, 'September 2026');
  assert.strictEqual(sections[1].data.length, 2);
});

test('5. Section metrics accurately calculate total, present, and absent counts', () => {
  const records: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-24', timestamp: '09:00:00', subject: 'S1', professor: 'P1', status: 'Present' },
    { id: 2, date: '2026-10-24', timestamp: '10:00:00', subject: 'S2', professor: 'P1', status: 'Present' },
    { id: 3, date: '2026-10-23', timestamp: '11:00:00', subject: 'S3', professor: 'P1', status: 'Absent', reason: 'Sick' },
    { id: 4, date: '2026-10-22', timestamp: '12:00:00', subject: 'S4', professor: 'P1', status: 'Absent', reason: 'Mood' },
    { id: 5, date: '2026-10-21', timestamp: '13:00:00', subject: 'S5', professor: 'P1', status: 'Present' },
  ];

  const sections = groupLogsByMonth(records);
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].totalClasses, 5);
  assert.strictEqual(sections[0].presentCount, 3);
  assert.strictEqual(sections[0].absentCount, 2);
});

test('6. Distinguishes empty dataset from filter with zero matches', () => {
  // Genuinely empty dataset
  const emptySections = groupLogsByMonth([]);
  assert.strictEqual(emptySections.length, 0);

  // Loaded dataset with 3 records
  const loadedRecords: AttendanceLogRecord[] = [
    { id: 1, date: '2026-10-24', timestamp: '09:00:00', subject: 'Anatomy', professor: 'P1', status: 'Present' },
    { id: 2, date: '2026-10-24', timestamp: '10:00:00', subject: 'Anatomy', professor: 'P1', status: 'Present' },
  ];

  // Filter for Physiology (no matches)
  const filtered = filterLogs(loadedRecords, { subject: 'Physiology', status: 'All' });
  assert.strictEqual(filtered.length, 0);

  // Client can distinguish loadedRecords.length > 0 while filtered.length === 0
  assert.strictEqual(loadedRecords.length, 2);
  assert.strictEqual(filtered.length, 0);
});

test('7. Export formatting includes all 6 columns without data loss', () => {
  const records = [
    {
      id: 1,
      date: '2026-10-24',
      timestamp: '09:30:00',
      subject: 'Physiology',
      status: 'Absent',
      reason: 'Migraine',
      professor: 'Satish Sir (Dean)',
    },
    {
      id: 2,
      date: '2026-10-24',
      timestamp: '11:00:00',
      subject: 'Anatomy',
      status: 'Present',
      reason: null,
      professor: 'Tanvi Mam',
    },
  ];

  const exportData = prepareAttendanceExportData(records);

  assert.strictEqual(exportData.length, 2);

  // Row 1
  assert.strictEqual(exportData[0].Date, '2026-10-24');
  assert.strictEqual(exportData[0].Time, '09:30:00');
  assert.strictEqual(exportData[0].Subject, 'Physiology');
  assert.strictEqual(exportData[0].Status, 'Absent');
  assert.strictEqual(exportData[0].Reason, 'Migraine');
  assert.strictEqual(exportData[0].Professor, 'Satish Sir (Dean)');

  // Row 2 (null reason becomes empty string)
  assert.strictEqual(exportData[1].Date, '2026-10-24');
  assert.strictEqual(exportData[1].Subject, 'Anatomy');
  assert.strictEqual(exportData[1].Status, 'Present');
  assert.strictEqual(exportData[1].Reason, '');
  assert.strictEqual(exportData[1].Professor, 'Tanvi Mam');
});

test('8. Cross-tab refresh and invalidation on addition and deletion', async () => {
  resetAttendanceEventBusForTesting(0);
  assert.strictEqual(getAttendanceVersion(), 0);

  let logsFetchCount = 0;
  let homeFetchCount = 0;

  const logsCoordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      logsFetchCount += 1;
    },
  });

  const homeCoordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      homeFetchCount += 1;
    },
  });

  // Initial focus: no refreshes
  await logsCoordinator.checkAndRefresh();
  await homeCoordinator.checkAndRefresh();
  assert.strictEqual(logsFetchCount, 0);
  assert.strictEqual(homeFetchCount, 0);

  // 1. User submits attendance on Add tab
  notifyAttendanceMutation();
  assert.strictEqual(getAttendanceVersion(), 1);

  // User navigates to History tab -> Logs refreshes automatically
  const logsRefreshedAfterAdd = await logsCoordinator.checkAndRefresh();
  assert.strictEqual(logsRefreshedAfterAdd, true);
  assert.strictEqual(logsFetchCount, 1);

  // 2. User deletes an entry on History tab -> deletion triggers notifyAttendanceMutation()
  notifyAttendanceMutation();
  logsCoordinator.markSynced(); // Logs marks itself synced to prevent redundant re-fetch of its own deletion
  assert.strictEqual(getAttendanceVersion(), 2);

  // Navigating to Home tab -> Home detects version 2 and refreshes
  const homeRefreshedAfterDelete = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(homeRefreshedAfterDelete, true);
  assert.strictEqual(homeFetchCount, 1);

  // Subsequent focus without new operations makes 0 network calls
  assert.strictEqual(await logsCoordinator.checkAndRefresh(), false);
  assert.strictEqual(await homeCoordinator.checkAndRefresh(), false);
  assert.strictEqual(logsFetchCount, 1);
  assert.strictEqual(homeFetchCount, 1);
});
