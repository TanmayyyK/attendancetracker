import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isLeapYear,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  formatMonthYearKey,
  formatDateString,
  getPreviousMonth,
  getNextMonth,
  calculateHeatmapIntensity,
  groupRecordsByDate,
  summarizeDayAttendance,
  generateMonthGrid,
  calculateMonthSummary,
  calculateSubjectBreakdown,
  formatFullDateDisplay,
  getYearMonthFromDate,
} from '../utils/calendarPolicy.ts';

import {
  fetchAllAttendancePages,
  type AttendanceLogRecord,
} from '../utils/logsPolicy.ts';

describe('Historical Attendance Calendar Policy Tests', () => {
  it('1. Weekday alignment aligns Monday as first column (0 = Monday, 6 = Sunday)', () => {
    // October 1, 2026 is a Thursday -> weekday index 3 (Mon=0, Tue=1, Wed=2, Thu=3)
    const oct2026 = getFirstWeekdayOfMonth(2026, 10);
    assert.equal(oct2026, 3);

    // February 1, 2026 is a Sunday -> weekday index 6
    const feb2026 = getFirstWeekdayOfMonth(2026, 2);
    assert.equal(feb2026, 6);

    // June 1, 2026 is a Monday -> weekday index 0
    const jun2026 = getFirstWeekdayOfMonth(2026, 6);
    assert.equal(jun2026, 0);

    // September 1, 2026 is a Tuesday -> weekday index 1
    const sep2026 = getFirstWeekdayOfMonth(2026, 9);
    assert.equal(sep2026, 1);
  });

  it('2. Month length, leap years, and year transitions calculate accurately', () => {
    // Leap year 2024
    assert.equal(isLeapYear(2024), true);
    assert.equal(getDaysInMonth(2024, 2), 29);

    // Non-leap years 2025, 2026
    assert.equal(isLeapYear(2025), false);
    assert.equal(getDaysInMonth(2025, 2), 28);
    assert.equal(isLeapYear(2026), false);
    assert.equal(getDaysInMonth(2026, 2), 28);

    // Century leap rules (2000 was leap, 2100 is not)
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(2100), false);

    // Standard 30 and 31 day months
    assert.equal(getDaysInMonth(2026, 1), 31);
    assert.equal(getDaysInMonth(2026, 4), 30);
    assert.equal(getDaysInMonth(2026, 7), 31);
    assert.equal(getDaysInMonth(2026, 9), 30);
    assert.equal(getDaysInMonth(2026, 11), 30);
    assert.equal(getDaysInMonth(2026, 12), 31);

    // Year transitions
    assert.deepEqual(getPreviousMonth(2026, 1), { year: 2025, month: 12 });
    assert.deepEqual(getNextMonth(2025, 12), { year: 2026, month: 1 });
    assert.deepEqual(getPreviousMonth(2026, 7), { year: 2026, month: 6 });
    assert.deepEqual(getNextMonth(2026, 7), { year: 2026, month: 8 });
  });

  it('3. Attendance records map correctly to local calendar dates without timezone shift', () => {
    const rawRecords: AttendanceLogRecord[] = [
      {
        id: 101,
        date: '2026-10-15',
        timestamp: '09:00:00',
        subject: 'Physiology',
        professor: 'Dr. Rao',
        status: 'Present',
      },
      {
        id: 102,
        date: '2026-10-15',
        timestamp: '10:00:00',
        subject: 'Anatomy',
        professor: 'Dr. Sharma',
        status: 'Absent',
        reason: 'Sick',
      },
      {
        id: 103,
        date: '2026-10-16',
        timestamp: '11:00:00',
        subject: 'Samhita',
        professor: 'Dr. Joshi',
        status: 'Present',
      },
    ];

    const mapped = groupRecordsByDate(rawRecords);
    assert.equal(mapped.size, 2);

    const oct15 = mapped.get('2026-10-15');
    assert.ok(oct15);
    assert.equal(oct15.length, 2);
    assert.equal(oct15[0].subject, 'Physiology');
    assert.equal(oct15[1].subject, 'Anatomy');

    const oct16 = mapped.get('2026-10-16');
    assert.ok(oct16);
    assert.equal(oct16.length, 1);
    assert.equal(oct16[0].subject, 'Samhita');

    assert.equal(mapped.get('2026-10-17'), undefined);
  });

  it('4. Multiple records on one date compute combined presents, absents, and percentage', () => {
    const dateRecords: AttendanceLogRecord[] = [
      { id: 1, date: '2026-10-20', timestamp: '09:00:00', subject: 'Physiology', professor: '', status: 'Present' },
      { id: 2, date: '2026-10-20', timestamp: '10:00:00', subject: 'Anatomy', professor: '', status: 'Present' },
      { id: 3, date: '2026-10-20', timestamp: '11:00:00', subject: 'Samhita', professor: '', status: 'Absent', reason: 'Headache' },
      { id: 4, date: '2026-10-20', timestamp: '12:00:00', subject: 'Padarth Vigyan', professor: '', status: 'Present' },
    ];

    const summary = summarizeDayAttendance('2026-10-20', dateRecords, '2026-10-25');
    assert.equal(summary.totalClasses, 4);
    assert.equal(summary.presentCount, 3);
    assert.equal(summary.absentCount, 1);
    assert.equal(summary.percentage, 75.0);
    assert.equal(summary.hasPresent, true);
    assert.equal(summary.hasAbsent, true);
    assert.equal(summary.intensity, 4); // 4 classes = Level 4
  });

  it('5. Distinguishes days with no records from days with recorded absences', () => {
    // Case A: Day with 0 records
    const emptyDay = summarizeDayAttendance('2026-10-21', [], '2026-10-25');
    assert.equal(emptyDay.totalClasses, 0);
    assert.equal(emptyDay.presentCount, 0);
    assert.equal(emptyDay.absentCount, 0);
    assert.equal(emptyDay.percentage, null); // null, NOT 0%
    assert.equal(emptyDay.hasPresent, false);
    assert.equal(emptyDay.hasAbsent, false);
    assert.equal(emptyDay.intensity, 0);

    // Case B: Day with 1 class that was Absent
    const absentOnlyDay = summarizeDayAttendance(
      '2026-10-22',
      [{ id: 10, date: '2026-10-22', timestamp: '09:00:00', subject: 'Anatomy', professor: '', status: 'Absent', reason: 'Sleeping' }],
      '2026-10-25'
    );
    assert.equal(absentOnlyDay.totalClasses, 1);
    assert.equal(absentOnlyDay.presentCount, 0);
    assert.equal(absentOnlyDay.absentCount, 1);
    assert.equal(absentOnlyDay.percentage, 0.0); // 0% attendance
    assert.equal(absentOnlyDay.hasPresent, false);
    assert.equal(absentOnlyDay.hasAbsent, true);
    assert.equal(absentOnlyDay.intensity, 1); // 1 class occurred -> Level 1 intensity
  });

  it('6. Activity intensity thresholds are deterministic and stable across months', () => {
    assert.equal(calculateHeatmapIntensity(0), 0);
    assert.equal(calculateHeatmapIntensity(1), 1);
    assert.equal(calculateHeatmapIntensity(2), 2);
    assert.equal(calculateHeatmapIntensity(3), 3);
    assert.equal(calculateHeatmapIntensity(4), 4);
    assert.equal(calculateHeatmapIntensity(5), 4);
    assert.equal(calculateHeatmapIntensity(10), 4);
  });

  it('7. Future dates are marked accurately and do not fabricate activity', () => {
    const today = '2026-10-25';

    const pastDay = summarizeDayAttendance('2026-10-24', [], today);
    assert.equal(pastDay.isFuture, false);
    assert.equal(pastDay.isToday, false);

    const todaySummary = summarizeDayAttendance('2026-10-25', [], today);
    assert.equal(todaySummary.isFuture, false);
    assert.equal(todaySummary.isToday, true);

    const futureDay = summarizeDayAttendance('2026-10-26', [], today);
    assert.equal(futureDay.isFuture, true);
    assert.equal(futureDay.isToday, false);
    assert.equal(futureDay.totalClasses, 0);
    assert.equal(futureDay.intensity, 0);
  });

  it('8. Month grid generates complete 7-day rows aligned to Monday', () => {
    const dateMap = new Map<string, AttendanceLogRecord[]>();
    dateMap.set('2026-10-01', [
      { id: 1, date: '2026-10-01', timestamp: '09:00:00', subject: 'Physiology', professor: '', status: 'Present' },
    ]);

    // October 2026 starts on Thursday (index 3). Leading days needed: 3 (Mon, Tue, Wed).
    // October has 31 days.
    // 3 + 31 = 34 days -> remainder is 6 -> needs 1 trailing day to make 35 cells (5 full weeks).
    const grid = generateMonthGrid(2026, 10, dateMap, '2026-10-25');
    assert.equal(grid.length % 7, 0);
    assert.equal(grid.length, 35);

    // First cell is Monday Sept 28, 2026 (isCurrentMonth = false)
    assert.equal(grid[0].date, '2026-09-28');
    assert.equal(grid[0].isCurrentMonth, false);

    // 4th cell is Thursday Oct 1, 2026 (isCurrentMonth = true)
    assert.equal(grid[3].date, '2026-10-01');
    assert.equal(grid[3].isCurrentMonth, true);
    assert.equal(grid[3].totalClasses, 1);
    assert.equal(grid[3].intensity, 1);

    // Last cell is Sunday Nov 1, 2026 (isCurrentMonth = false)
    assert.equal(grid[34].date, '2026-11-01');
    assert.equal(grid[34].isCurrentMonth, false);
  });

  it('9. Monthly summary aggregates totals, presents, absents, percentage, and active days', () => {
    const dateMap = new Map<string, AttendanceLogRecord[]>();
    dateMap.set('2026-10-05', [
      { id: 1, date: '2026-10-05', timestamp: '09:00:00', subject: 'Physiology', professor: '', status: 'Present' },
      { id: 2, date: '2026-10-05', timestamp: '10:00:00', subject: 'Anatomy', professor: '', status: 'Absent' },
    ]);
    dateMap.set('2026-10-06', [
      { id: 3, date: '2026-10-06', timestamp: '09:00:00', subject: 'Samhita', professor: '', status: 'Present' },
    ]);

    const summary = calculateMonthSummary(2026, 10, dateMap);
    assert.equal(summary.monthTitle, 'October 2026');
    assert.equal(summary.totalClasses, 3);
    assert.equal(summary.presentCount, 2);
    assert.equal(summary.absentCount, 1);
    assert.equal(summary.percentage, 66.7);
    assert.equal(summary.activeDaysCount, 2);
    assert.equal(summary.totalDaysInMonth, 31);
  });

  it('10. Subject breakdown derives per-subject metrics for selected date', () => {
    const records: AttendanceLogRecord[] = [
      { id: 1, date: '2026-10-10', timestamp: '09:00:00', subject: 'Physiology', professor: 'Dr. Rao', status: 'Present' },
      { id: 2, date: '2026-10-10', timestamp: '10:00:00', subject: 'Physiology', professor: 'Dr. Rao', status: 'Present' },
      { id: 3, date: '2026-10-10', timestamp: '11:00:00', subject: 'Anatomy', professor: 'Dr. Sharma', status: 'Absent', reason: 'Sick' },
    ];

    const breakdown = calculateSubjectBreakdown(records);
    assert.equal(breakdown.length, 2);

    const physio = breakdown.find((b) => b.subject === 'Physiology');
    assert.ok(physio);
    assert.equal(physio.total, 2);
    assert.equal(physio.present, 2);
    assert.equal(physio.absent, 0);
    assert.equal(physio.percentage, 100.0);

    const anatomy = breakdown.find((b) => b.subject === 'Anatomy');
    assert.ok(anatomy);
    assert.equal(anatomy.total, 1);
    assert.equal(anatomy.present, 0);
    assert.equal(anatomy.absent, 1);
    assert.equal(anatomy.percentage, 0.0);
  });

  it('11. Complete-history pagination fetches multi-page datasets for calendar', async () => {
    // Mock multi-page API
    const page1: AttendanceLogRecord[] = [
      { id: 200, date: '2026-10-25', timestamp: '10:00:00', subject: 'Physiology', professor: '', status: 'Present' },
      { id: 199, date: '2026-10-24', timestamp: '10:00:00', subject: 'Anatomy', professor: '', status: 'Present' },
    ];
    const page2: AttendanceLogRecord[] = [
      { id: 150, date: '2026-09-15', timestamp: '09:00:00', subject: 'Samhita', professor: '', status: 'Absent' },
      { id: 149, date: '2026-08-10', timestamp: '09:00:00', subject: 'Padarth Vigyan', professor: '', status: 'Present' },
    ];

    const fetchMock = async (cursor: number | null) => {
      if (cursor === null) {
        return { items: page1, hasMore: true, nextCursor: 199 };
      }
      if (cursor === 199) {
        return { items: page2, hasMore: false, nextCursor: null };
      }
      return { items: [], hasMore: false, nextCursor: null };
    };

    const result = await fetchAllAttendancePages(fetchMock);
    assert.equal(result.ok, true);
    assert.equal(result.records.length, 4);

    const grouped = groupRecordsByDate(result.records);
    assert.equal(grouped.size, 4);
    assert.ok(grouped.has('2026-10-25'));
    assert.ok(grouped.has('2026-10-24'));
    assert.ok(grouped.has('2026-09-15'));
    assert.ok(grouped.has('2026-08-10'));
  });

  it('12. Complete-history pagination safely handles network failure mid-fetch', async () => {
    let callCount = 0;
    const failingFetchMock = async (cursor: number | null) => {
      callCount++;
      if (callCount === 1) {
        return {
          items: [{ id: 10, date: '2026-10-20', timestamp: '09:00:00', subject: 'Physiology', professor: '', status: 'Present' }],
          hasMore: true,
          nextCursor: 10,
        };
      }
      // Fail on page 2
      return null;
    };

    const result = await fetchAllAttendancePages(failingFetchMock);
    assert.equal(result.ok, false);
    assert.equal(result.hasMoreRemaining, true);
    assert.equal(result.records.length, 1);
    assert.ok(result.error);
  });

  it('13. Full date display formatting with weekday name', () => {
    assert.equal(formatFullDateDisplay('2026-10-26'), 'Monday, October 26, 2026');
    assert.equal(formatFullDateDisplay('2026-10-01'), 'Thursday, October 1, 2026');
    assert.equal(formatFullDateDisplay('2024-02-29'), 'Thursday, February 29, 2024');
  });

  it('14. Year and month extraction fallback and parsing', () => {
    assert.deepEqual(getYearMonthFromDate('2026-10-25'), { year: 2026, month: 10 });
    assert.deepEqual(getYearMonthFromDate('2025-01-01'), { year: 2025, month: 1 });
    assert.deepEqual(getYearMonthFromDate('2026-04'), { year: 2026, month: 4 });
  });

  it('15. Empty attendance data evaluates to clean zero metrics without NaN or crash', () => {
    const emptyMap = new Map<string, AttendanceLogRecord[]>();
    const monthSummary = calculateMonthSummary(2026, 5, emptyMap);

    assert.equal(monthSummary.totalClasses, 0);
    assert.equal(monthSummary.presentCount, 0);
    assert.equal(monthSummary.absentCount, 0);
    assert.equal(monthSummary.percentage, null);
    assert.equal(monthSummary.activeDaysCount, 0);
    assert.equal(monthSummary.totalDaysInMonth, 31);
  });
});
