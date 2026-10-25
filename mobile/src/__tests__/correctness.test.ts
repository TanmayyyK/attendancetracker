import test from 'node:test';
import assert from 'node:assert';

import {
  calculateAttendanceStatus,
  calculateOverallAttendance,
  TARGET_ATTENDANCE_PERCENTAGE,
} from '../utils/attendance.ts';

import {
  getLocalTodayDateString,
  isValidCalendarDate,
  formatDateOnly,
} from '../utils/dates.ts';

import {
  prepareAttendanceExportData,
} from '../utils/export.ts';

import {
  calculateSubjectSummary,
  calculateClassesRequired,
  calculateSafeToMiss,
  simulateAttendanceWhatIf,
  generateAttendanceProjections,
  isValidClassCount,
  isValidTargetPercentage,
  validateAttendanceCounts,
} from '../utils/attendanceIntelligence.ts';

import {
  WEEKLY_VOICE,
  DEFAULT_REMINDER_TIMES,
} from '../services/notifications/voice.ts';

import {
  formatReminderKey,
  parseReminderKey,
  isTimeInQuietHours,
  computeDesiredReminders,
  computeReconciliationPlan,
  validatePreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_QUIET_HOURS,
  validateNotificationDestination,
  ALLOWED_NOTIFICATION_ROUTES,
  extractScheduledRecordData,
  computeNextReminderFromRecords,
} from '../services/notifications/rules.ts';

import {
  evaluateAttendanceSuppression,
} from '../services/notifications/attendanceWatcher.ts';

import type {
  DesiredReminder,
  ExistingScheduledRecord,
  ManagedReminderState,
  NotificationPreferences,
} from '../services/notifications/types.ts';

// ---------------------------------------------------------------------------
// 1. Weighted Overall Attendance Calculations
// ---------------------------------------------------------------------------
test('Overall attendance: uses weighted total classes rather than unweighted arithmetic mean', () => {
  // Scenario:
  // Subject A: 1 present out of 1 class = 100%
  // Subject B: 20 present out of 40 classes = 50%
  //
  // Unweighted mean would be (100 + 50) / 2 = 75.0% (misleading "Safe Zone").
  // True weighted attendance is (1 + 20) / (1 + 40) = 21 / 41 = 51.2195% (Critical "Danger Zone").
  const totalPresents = 21;
  const totalClasses = 41;

  const weightedPercentage = calculateOverallAttendance(totalPresents, totalClasses);
  assert.strictEqual(Math.round(weightedPercentage * 10) / 10, 51.2);
  assert.strictEqual(weightedPercentage < TARGET_ATTENDANCE_PERCENTAGE, true);
});

test('Overall attendance: clamps values strictly between 0 and 100', () => {
  assert.strictEqual(calculateOverallAttendance(10, 10), 100);
  assert.strictEqual(calculateOverallAttendance(0, 10), 0);
  assert.strictEqual(calculateOverallAttendance(5, 10), 50);
});

// ---------------------------------------------------------------------------
// 2. The 75% Target Classes-Needed Calculation
// ---------------------------------------------------------------------------
test('Classes needed: correctly calculates required attendance to reach 75%', () => {
  // 10 present out of 20 classes (50%) -> need 20 more consecutive classes
  // Check: (10 + 20) / (20 + 20) = 30 / 40 = 75%
  const status50 = calculateAttendanceStatus(10, 20);
  assert.strictEqual(status50.needed, 20);

  // 0 present out of 10 classes (0%) -> need 30 more
  // Check: 30 / 40 = 75%
  const status0 = calculateAttendanceStatus(0, 10);
  assert.strictEqual(status0.needed, 30);

  // Exactly at 75%: 15 present out of 20 classes -> need 0
  const status75 = calculateAttendanceStatus(15, 20);
  assert.strictEqual(status75.needed, 0);

  // Above 75%: 18 present out of 20 classes -> need 0
  const status90 = calculateAttendanceStatus(18, 20);
  assert.strictEqual(status90.needed, 0);
});

// ---------------------------------------------------------------------------
// 3. Safe-to-Skip Calculations and Boundary Conditions
// ---------------------------------------------------------------------------
test('Safe to skip: correctly calculates skip budget while remaining >= 75%', () => {
  // 16 present out of 20 classes (80%):
  // Formula: floor((4*16 - 3*20) / 3) = floor((64 - 60) / 3) = floor(4/3) = 1
  // Verification:
  // If skip 1: 16 / 21 = 76.19% (>= 75%)
  // If skip 2: 16 / 22 = 72.72% (< 75%)
  const status80 = calculateAttendanceStatus(16, 20);
  assert.strictEqual(status80.safeToSkip, 1);

  // Exactly at 75%: 15 present out of 20 classes
  // Formula: floor((60 - 60) / 3) = 0
  const status75 = calculateAttendanceStatus(15, 20);
  assert.strictEqual(status75.safeToSkip, 0);

  // Below 75%: 14 present out of 20 classes (70%)
  // Safe to skip must be 0
  const status70 = calculateAttendanceStatus(14, 20);
  assert.strictEqual(status70.safeToSkip, 0);

  // Perfect attendance: 30 present out of 30 classes (100%)
  // Formula: floor((120 - 90) / 3) = floor(30/3) = 10
  // Verification: 30 / (30 + 10) = 30 / 40 = 75.0%
  const status100 = calculateAttendanceStatus(30, 30);
  assert.strictEqual(status100.safeToSkip, 10);
});

// ---------------------------------------------------------------------------
// 4. Empty Attendance Data & Zero Denominators
// ---------------------------------------------------------------------------
test('Empty attendance: handles zero total classes safely without NaN or division by zero', () => {
  const overall = calculateOverallAttendance(0, 0);
  assert.strictEqual(overall, 0);
  assert.strictEqual(Number.isNaN(overall), false);

  const status = calculateAttendanceStatus(0, 0);
  assert.strictEqual(status.needed, 0);
  assert.strictEqual(status.safeToSkip, 0);

  // Negative safety handling
  const negativeStatus = calculateAttendanceStatus(-1, -5);
  assert.strictEqual(negativeStatus.needed, 0);
  assert.strictEqual(negativeStatus.safeToSkip, 0);
});

// ---------------------------------------------------------------------------
// 5. Local Date Generation & Date-Only Formatting
// ---------------------------------------------------------------------------
test('Local date: getLocalTodayDateString formats date from local components', () => {
  // A date constructed in local time
  const sample = new Date(2026, 9, 23, 1, 30, 0); // Oct 23, 2026, 01:30 AM local
  const formatted = getLocalTodayDateString(sample);
  assert.strictEqual(formatted, '2026-10-23');

  // Verify single digit month and day padding
  const singleDigitDate = new Date(2026, 0, 5, 12, 0, 0); // Jan 5, 2026
  assert.strictEqual(getLocalTodayDateString(singleDigitDate), '2026-01-05');
});

test('Date display: formatDateOnly extracts local calendar components without UTC midnight offset', () => {
  // Test formatting without UTC offset
  const formatted = formatDateOnly('2026-10-23', 'en-US');
  assert.strictEqual(formatted.includes('23'), true);
  assert.strictEqual(formatted.includes('2026'), true);

  // Edge cases
  assert.strictEqual(formatDateOnly(''), '');
  assert.strictEqual(formatDateOnly('not-a-date'), 'not-a-date');
});

// ---------------------------------------------------------------------------
// 6. Strict Calendar Date Validation
// ---------------------------------------------------------------------------
test('Date validation: accepts valid standard calendar dates', () => {
  assert.strictEqual(isValidCalendarDate('2026-10-23'), true);
  assert.strictEqual(isValidCalendarDate('2026-01-01'), true);
  assert.strictEqual(isValidCalendarDate('2026-12-31'), true);
  assert.strictEqual(isValidCalendarDate('2026-02-28'), true);
});

test('Date validation: correctly handles leap years for February 29th', () => {
  // 2024 was a leap year
  assert.strictEqual(isValidCalendarDate('2024-02-29'), true);

  // 2025 and 2026 are not leap years
  assert.strictEqual(isValidCalendarDate('2025-02-29'), false);
  assert.strictEqual(isValidCalendarDate('2026-02-29'), false);
});

test('Date validation: rejects impossible calendar dates', () => {
  assert.strictEqual(isValidCalendarDate('2026-02-30'), false); // Feb 30 does not exist
  assert.strictEqual(isValidCalendarDate('2026-02-31'), false);
  assert.strictEqual(isValidCalendarDate('2026-04-31'), false); // April has 30 days
  assert.strictEqual(isValidCalendarDate('2026-06-31'), false); // June has 30 days
  assert.strictEqual(isValidCalendarDate('2026-09-31'), false); // Sept has 30 days
  assert.strictEqual(isValidCalendarDate('2026-11-31'), false); // Nov has 30 days
});

test('Date validation: rejects malformed and out-of-range date strings', () => {
  assert.strictEqual(isValidCalendarDate('2026-13-01'), false); // Invalid month 13
  assert.strictEqual(isValidCalendarDate('2026-00-10'), false); // Invalid month 00
  assert.strictEqual(isValidCalendarDate('2026-05-00'), false); // Invalid day 00
  assert.strictEqual(isValidCalendarDate('2026-05-32'), false); // Invalid day 32
  assert.strictEqual(isValidCalendarDate('2026-9-5'), false);   // Unpadded month/day
  assert.strictEqual(isValidCalendarDate('2026/10/23'), false); // Wrong separator
  assert.strictEqual(isValidCalendarDate('1899-12-31'), false); // Out of plausible year range
  assert.strictEqual(isValidCalendarDate('2101-01-01'), false); // Out of plausible year range
  assert.strictEqual(isValidCalendarDate('hello'), false);
  assert.strictEqual(isValidCalendarDate(''), false);
});

// ---------------------------------------------------------------------------
// 7. Export Truncation Fix: Exporting More than 20 Records
// ---------------------------------------------------------------------------
test('Export dataset: includes all records without hard-coded 20-record truncation', () => {
  // Create 45 mock attendance records
  const mockRecords = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    date: '2026-10-23',
    timestamp: '10:00:00',
    subject: `Subject ${i + 1}`,
    status: i % 2 === 0 ? 'Present' : 'Absent',
  }));

  const exportData = prepareAttendanceExportData(mockRecords);

  // Prior behavior sliced to 20: logs.slice(0, 20).
  // Current behavior must retain all 45 records.
  assert.strictEqual(exportData.length, 45);
  assert.strictEqual(exportData[0].Subject, 'Subject 1');
  assert.strictEqual(exportData[44].Subject, 'Subject 45');
  assert.strictEqual(exportData[0].Date, '2026-10-23');
});

// ---------------------------------------------------------------------------
// 8. Duplicate Submission Protection
// ---------------------------------------------------------------------------
test('Duplicate submission guard: in-flight flag blocks synchronous double-taps', async () => {
  let isSubmitting = false;
  let submissionCount = 0;

  async function mockSubmit() {
    if (isSubmitting) {
      return { ok: false, blocked: true };
    }
    isSubmitting = true;
    submissionCount++;

    // Simulate async network request
    await new Promise((resolve) => setTimeout(resolve, 10));

    isSubmitting = false;
    return { ok: true, blocked: false };
  }

  // Trigger two rapid consecutive calls (representing rapid user taps)
  const [res1, res2] = await Promise.all([mockSubmit(), mockSubmit()]);

  // First should succeed, second must be blocked
  assert.strictEqual(res1.ok, true);
  assert.strictEqual(res1.blocked, false);
  assert.strictEqual(res2.ok, false);
  assert.strictEqual(res2.blocked, true);
  assert.strictEqual(submissionCount, 1);
});

// ---------------------------------------------------------------------------
// 9. API Failures vs Legitimate Empty Results
// ---------------------------------------------------------------------------
test('API distinctions: differentiate between network/server failure (null) and empty data ([])', () => {
  // Handler pattern implemented in screens:
  function evaluateLogsResponse(response: any[] | null) {
    if (response === null) {
      return { state: 'error', message: 'Unable to load attendance history. Check your connection.' };
    }
    if (response.length === 0) {
      return { state: 'empty', message: 'No entries yet' };
    }
    return { state: 'data', count: response.length };
  }

  // Failure response (network drop / 500)
  const failureResult = evaluateLogsResponse(null);
  assert.strictEqual(failureResult.state, 'error');

  // Legitimate 200 OK empty response
  const emptyResult = evaluateLogsResponse([]);
  assert.strictEqual(emptyResult.state, 'empty');

  // Normal data response
  const dataResult = evaluateLogsResponse([{ id: 1, subject: 'Physiology' }]);
  assert.strictEqual(dataResult.state, 'data');
  assert.strictEqual(dataResult.count, 1);
});

test('Insights state evaluation: correctly differentiates partial monthly failure from genuine empty trend data', () => {
  function evaluateInsightsState(monthlyData: any[] | null, summaryData: any | null) {
    if (monthlyData === null && summaryData === null) {
      return { overallError: 'Unable to load insights. Check your connection.', monthlyState: 'error', summaryState: 'error' };
    }
    const monthlyState = monthlyData === null ? 'error' : monthlyData.length === 0 ? 'empty' : 'data';
    const summaryState = summaryData === null ? 'error' : 'data';
    const monthlyError = monthlyData === null ? 'Unable to load monthly trends. Check your connection.' : null;
    return { overallError: null, monthlyState, monthlyError, summaryState };
  }

  // 1. Partial failure: monthly request fails (null), but dashboard summary succeeds
  const partialFailure = evaluateInsightsState(null, { bunk_reasons: [{ reason: 'Sick', count: 3 }] });
  assert.strictEqual(partialFailure.overallError, null);
  assert.strictEqual(partialFailure.summaryState, 'data');
  assert.strictEqual(partialFailure.monthlyState, 'error');
  assert.strictEqual(partialFailure.monthlyError, 'Unable to load monthly trends. Check your connection.');

  // 2. Legitimate successful empty response: 200 OK with 0 monthly snapshots
  const emptyMonthly = evaluateInsightsState([], { bunk_reasons: [] });
  assert.strictEqual(emptyMonthly.overallError, null);
  assert.strictEqual(emptyMonthly.monthlyState, 'empty');
  assert.strictEqual(emptyMonthly.monthlyError, null);

  // 3. Normal data response: both succeed with data
  const normalData = evaluateInsightsState(
    [{ month_key: '2026-10', overall: { present: 10, total: 12 } }],
    { bunk_reasons: [] }
  );
  assert.strictEqual(normalData.monthlyState, 'data');
  assert.strictEqual(normalData.summaryState, 'data');

  // 4. Complete failure: both endpoints fail
  const completeFailure = evaluateInsightsState(null, null);
  assert.strictEqual(completeFailure.overallError, 'Unable to load insights. Check your connection.');
  assert.strictEqual(completeFailure.monthlyState, 'error');
});

// ---------------------------------------------------------------------------
// 10. Deterministic Reminder Key Formatting & Parsing
// ---------------------------------------------------------------------------
test('Reminder keys: generates and parses deterministic logical keys', () => {
  assert.strictEqual(formatReminderKey(1, 'morning'), 'reminder-v3-1-morning');
  assert.strictEqual(formatReminderKey(2, 'wrapUp'), 'reminder-v3-2-wrapUp');
  assert.strictEqual(formatReminderKey(7, 'night'), 'reminder-v3-7-night');

  const parsed1 = parseReminderKey('reminder-v3-1-morning');
  assert.deepStrictEqual(parsed1, { weekday: 1, moment: 'morning' });

  const parsed2 = parseReminderKey('reminder-v3-5-wrapUp');
  assert.deepStrictEqual(parsed2, { weekday: 5, moment: 'wrapUp' });

  // Invalid key formats
  assert.strictEqual(parseReminderKey('reminder-v3-8-morning'), null); // Weekday out of bounds
  assert.strictEqual(parseReminderKey('reminder-v3-0-night'), null);
  assert.strictEqual(parseReminderKey('reminder-v3-2-lunch'), null); // Invalid moment
  assert.strictEqual(parseReminderKey('legacy-id-12345'), null);
  assert.strictEqual(parseReminderKey(''), null);
});

// ---------------------------------------------------------------------------
// 11. Historical Voice Schedule & Default Moments Integrity
// ---------------------------------------------------------------------------
test('Voice schedule: preserves all 21 historical reminders verbatim', () => {
  assert.strictEqual(WEEKLY_VOICE.length, 7);

  // Check default times
  assert.strictEqual(DEFAULT_REMINDER_TIMES.morning.hour, 8);
  assert.strictEqual(DEFAULT_REMINDER_TIMES.morning.minute, 15);
  assert.strictEqual(DEFAULT_REMINDER_TIMES.wrapUp.hour, 16);
  assert.strictEqual(DEFAULT_REMINDER_TIMES.wrapUp.minute, 15);
  assert.strictEqual(DEFAULT_REMINDER_TIMES.night.hour, 21);
  assert.strictEqual(DEFAULT_REMINDER_TIMES.night.minute, 15);

  // Check sample historical copy preservation
  const sunday = WEEKLY_VOICE.find((d) => d.weekday === 1)!;
  assert.strictEqual(sunday.moments.morning.title, 'Sunday reset ✨');
  assert.strictEqual(sunday.moments.morning.body, 'A tiny plan now makes the whole week feel lighter.');
  assert.strictEqual(sunday.moments.morning.destination, '/(tabs)/');

  const monday = WEEKLY_VOICE.find((d) => d.weekday === 2)!;
  assert.strictEqual(monday.moments.morning.title, 'Fresh-week energy ☀️');
  assert.strictEqual(monday.moments.morning.destination, '/(tabs)/');

  const friday = WEEKLY_VOICE.find((d) => d.weekday === 6)!;
  assert.strictEqual(friday.moments.wrapUp.title, 'Friday check-in 💜');
  assert.strictEqual(friday.moments.wrapUp.body, 'Before weekend brain arrives, save today’s classes.');

  const saturday = WEEKLY_VOICE.find((d) => d.weekday === 7)!;
  assert.strictEqual(saturday.moments.night.title, 'Soft landing for the week 🌙');
  assert.strictEqual(saturday.moments.night.destination, '/(tabs)/add');

  // Verify full default list generation has exactly 21 reminders
  const desired = computeDesiredReminders(DEFAULT_NOTIFICATION_PREFERENCES);
  assert.strictEqual(desired.length, 21);
});

// ---------------------------------------------------------------------------
// 12. Notification Preference Sanitization & Malformed Input Fallbacks
// ---------------------------------------------------------------------------
test('Preference validation: sanitizes corrupted or malformed preference payloads', () => {
  // Empty or invalid inputs
  const fromNull = validatePreferences(null);
  assert.strictEqual(fromNull.enabled, true);
  assert.deepStrictEqual(fromNull.activeDays, [1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(fromNull.moments.morning.hour, 8);

  const fromUndefined = validatePreferences(undefined);
  assert.strictEqual(fromUndefined.enabled, true);

  // Out of range hours and minutes
  const corruptedTimes = validatePreferences({
    moments: {
      morning: { enabled: true, hour: 29, minute: 99 },
      wrapUp: { enabled: true, hour: -5, minute: -1 },
    },
  });
  assert.strictEqual(corruptedTimes.moments.morning.hour, 8);
  assert.strictEqual(corruptedTimes.moments.morning.minute, 15);
  assert.strictEqual(corruptedTimes.moments.wrapUp.hour, 16);
  assert.strictEqual(corruptedTimes.moments.wrapUp.minute, 15);

  // Corrupted active days array
  const corruptedDays = validatePreferences({
    activeDays: [1, 1, 9, 0, -2, 'three', 5],
  });
  assert.deepStrictEqual(corruptedDays.activeDays, [1, 5]);

  // Empty active days array falls back to all 7 days
  const emptyDays = validatePreferences({ activeDays: [] });
  assert.deepStrictEqual(emptyDays.activeDays, [1, 2, 3, 4, 5, 6, 7]);
});

// ---------------------------------------------------------------------------
// 13. Quiet Hours Window Evaluation (Overnight vs Same-Day)
// ---------------------------------------------------------------------------
test('Quiet hours: accurately evaluates cross-midnight and same-day quiet windows', () => {
  // Overnight window: 22:00 (10 PM) to 07:00 (7 AM)
  const overnightConfig = {
    enabled: true,
    startHour: 22,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
  };

  assert.strictEqual(isTimeInQuietHours(22, 0, overnightConfig), true);   // Start boundary
  assert.strictEqual(isTimeInQuietHours(23, 30, overnightConfig), true);  // Late night
  assert.strictEqual(isTimeInQuietHours(0, 0, overnightConfig), true);    // Midnight
  assert.strictEqual(isTimeInQuietHours(4, 30, overnightConfig), true);   // Early morning
  assert.strictEqual(isTimeInQuietHours(6, 59, overnightConfig), true);   // Right before end
  assert.strictEqual(isTimeInQuietHours(7, 0, overnightConfig), false);   // End boundary
  assert.strictEqual(isTimeInQuietHours(8, 15, overnightConfig), false);  // Morning reminder
  assert.strictEqual(isTimeInQuietHours(16, 15, overnightConfig), false); // WrapUp reminder
  assert.strictEqual(isTimeInQuietHours(21, 15, overnightConfig), false); // Night reminder
  assert.strictEqual(isTimeInQuietHours(21, 59, overnightConfig), false); // 1 min before start

  // Same-day window: 14:00 (2 PM) to 18:00 (6 PM)
  const daytimeConfig = {
    enabled: true,
    startHour: 14,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
  };

  assert.strictEqual(isTimeInQuietHours(13, 59, daytimeConfig), false);
  assert.strictEqual(isTimeInQuietHours(14, 0, daytimeConfig), true);
  assert.strictEqual(isTimeInQuietHours(16, 15, daytimeConfig), true); // Catches wrapUp reminder
  assert.strictEqual(isTimeInQuietHours(18, 0, daytimeConfig), false);
  assert.strictEqual(isTimeInQuietHours(19, 0, daytimeConfig), false);

  // Disabled quiet hours always returns false
  const disabledConfig = { ...overnightConfig, enabled: false };
  assert.strictEqual(isTimeInQuietHours(23, 0, disabledConfig), false);

  // Equal start and end returns false (zero duration)
  const zeroDurationConfig = { enabled: true, startHour: 8, startMinute: 0, endHour: 8, endMinute: 0 };
  assert.strictEqual(isTimeInQuietHours(8, 0, zeroDurationConfig), false);
});

// ---------------------------------------------------------------------------
// 14. Reconciliation Engine Diffing (toKeep, toSchedule, toCancel)
// ---------------------------------------------------------------------------
test('Reconciliation engine: correctly calculates diffing plans across scenarios', () => {
  const desired = computeDesiredReminders(DEFAULT_NOTIFICATION_PREFERENCES);
  assert.strictEqual(desired.length, 21);

  // Scenario A: Clean initial run (no existing notifications)
  const planInitial = computeReconciliationPlan(desired, [], null);
  assert.strictEqual(planInitial.toSchedule.length, 21);
  assert.strictEqual(planInitial.toKeep.length, 0);
  assert.strictEqual(planInitial.toCancel.length, 0);

  // Scenario B: Idempotent run (all 21 already exist and match stored mapping)
  const existingMap: ExistingScheduledRecord[] = desired.map((d, index) => ({
    identifier: `os-id-${index + 1}`,
    weekday: d.weekday,
    hour: d.hour,
    minute: d.minute,
    reminderSystem: 'attendance-v3',
    moment: d.moment,
  }));
  const storedState: ManagedReminderState = {
    version: 4,
    keyToIdentifier: Object.fromEntries(desired.map((d, index) => [d.key, `os-id-${index + 1}`])),
  };

  const planIdempotent = computeReconciliationPlan(desired, existingMap, storedState);
  assert.strictEqual(planIdempotent.toKeep.length, 21);
  assert.strictEqual(planIdempotent.toSchedule.length, 0);
  assert.strictEqual(planIdempotent.toCancel.length, 0);

  // Scenario C: External drift (1 reminder was canceled outside the app)
  const existingWithDrift = existingMap.slice(1); // 20 remaining
  const planDrift = computeReconciliationPlan(desired, existingWithDrift, storedState);
  assert.strictEqual(planDrift.toKeep.length, 20);
  assert.strictEqual(planDrift.toSchedule.length, 1);
  assert.strictEqual(planDrift.toSchedule[0].key, desired[0].key);
  assert.strictEqual(planDrift.toCancel.length, 0);

  // Scenario D: Preference change (disable Friday and Saturday)
  const weekdayOnlyPrefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    activeDays: [1, 2, 3, 4, 5], // Sunday through Thursday
  };
  const desiredWeekdayOnly = computeDesiredReminders(weekdayOnlyPrefs);
  assert.strictEqual(desiredWeekdayOnly.length, 15);

  const planDayDisabled = computeReconciliationPlan(desiredWeekdayOnly, existingMap, storedState);
  assert.strictEqual(planDayDisabled.toKeep.length, 15);
  assert.strictEqual(planDayDisabled.toSchedule.length, 0);
  assert.strictEqual(planDayDisabled.toCancel.length, 6); // 3 from Friday + 3 from Saturday

  // Scenario E: Protection against foreign/unrelated notifications
  const foreignNotification: ExistingScheduledRecord = {
    identifier: 'foreign-calendar-event-999',
    weekday: 2,
    hour: 10,
    minute: 0,
    // Note: No reminderSystem tag and not in storedState
  };
  const existingWithForeign = [...existingMap, foreignNotification];
  const planForeignProtected = computeReconciliationPlan(desired, existingWithForeign, storedState);
  assert.strictEqual(planForeignProtected.toCancel.includes('foreign-calendar-event-999'), false);
});

// ---------------------------------------------------------------------------
// 15. Backward-Compatibility Migration from Legacy Scheduler
// ---------------------------------------------------------------------------
test('Migration: adopts existing v3 reminders into deterministic keys without cancellation', () => {
  // Suppose the app has 3 reminders scheduled by legacy code without keyToIdentifier stored state
  const legacyExisting: ExistingScheduledRecord[] = [
    {
      identifier: 'legacy-os-notif-monday-morning',
      weekday: 2,
      hour: 8,
      minute: 15,
      reminderSystem: 'attendance-v3',
      moment: 'morning',
    },
    {
      identifier: 'legacy-os-notif-monday-wrapup',
      weekday: 2,
      hour: 16,
      minute: 15,
      reminderSystem: 'attendance-v3',
      moment: 'wrapUp',
    },
  ];

  // Desired is 21 reminders
  const desired = computeDesiredReminders(DEFAULT_NOTIFICATION_PREFERENCES);

  // Stored state is null (first run after upgrade)
  const plan = computeReconciliationPlan(desired, legacyExisting, null);

  // Migration should adopt the 2 matching legacy reminders into toKeep
  assert.strictEqual(plan.toKeep.length, 2);
  assert.strictEqual(plan.toKeep.some((k) => k.key === 'reminder-v3-2-morning' && k.identifier === 'legacy-os-notif-monday-morning'), true);
  assert.strictEqual(plan.toKeep.some((k) => k.key === 'reminder-v3-2-wrapUp' && k.identifier === 'legacy-os-notif-monday-wrapup'), true);

  // Remaining 19 desired should be scheduled
  assert.strictEqual(plan.toSchedule.length, 19);

  // Neither legacy reminder should be cancelled!
  assert.strictEqual(plan.toCancel.length, 0);
});

// ---------------------------------------------------------------------------
// 16. Deep-Link Route Whitelist & Validation Rules
// ---------------------------------------------------------------------------
test('Deep-link whitelist: allows valid routes and rejects malicious or unknown routes', () => {
  // Valid internal routes
  assert.strictEqual(validateNotificationDestination('/(tabs)/'), '/(tabs)/');
  assert.strictEqual(validateNotificationDestination('/(tabs)/add'), '/(tabs)/add');
  assert.strictEqual(validateNotificationDestination('/(tabs)/logs'), '/(tabs)/logs');
  assert.strictEqual(validateNotificationDestination('/(tabs)/insights'), '/(tabs)/insights');
  assert.strictEqual(validateNotificationDestination('/(tabs)/notifications'), '/(tabs)/notifications');

  // Normalized shorthand routes
  assert.strictEqual(validateNotificationDestination('/'), '/(tabs)/');
  assert.strictEqual(validateNotificationDestination('/add'), '/(tabs)/add');
  assert.strictEqual(validateNotificationDestination('/logs'), '/(tabs)/logs');
  assert.strictEqual(validateNotificationDestination('/insights'), '/(tabs)/insights');
  assert.strictEqual(validateNotificationDestination('/notifications'), '/(tabs)/notifications');

  // Malicious, unknown, or invalid inputs
  assert.strictEqual(validateNotificationDestination('https://malicious.example.com'), null);
  assert.strictEqual(validateNotificationDestination('../../etc/passwd'), null);
  assert.strictEqual(validateNotificationDestination('/admin/users'), null);
  assert.strictEqual(validateNotificationDestination('/settings'), null);
  assert.strictEqual(validateNotificationDestination('javascript:alert(1)'), null);
  assert.strictEqual(validateNotificationDestination(null), null);
  assert.strictEqual(validateNotificationDestination(undefined), null);
  assert.strictEqual(validateNotificationDestination(123), null);
  assert.strictEqual(validateNotificationDestination(''), null);
});

// ---------------------------------------------------------------------------
// 17. Navigation Queueing & Cold-Start Route Dispatch
// ---------------------------------------------------------------------------
test('Navigation queue: queues deep-links during cold-start until navigation is ready', () => {
  let isNavReady = false;
  let queuedRoute: string | null = null;
  let dispatchedRoute: string | null = null;

  function onNotificationArrival(url: unknown) {
    const valid = validateNotificationDestination(url);
    if (!valid) return false;
    if (!isNavReady) {
      queuedRoute = valid;
    } else {
      dispatchedRoute = valid;
    }
    return true;
  }

  function setReady(ready: boolean) {
    isNavReady = ready;
    if (ready && queuedRoute) {
      dispatchedRoute = queuedRoute;
      queuedRoute = null;
    }
  }

  // 1. Arrival during cold-start
  const handled = onNotificationArrival('/(tabs)/add');
  assert.strictEqual(handled, true);
  assert.strictEqual(queuedRoute, '/(tabs)/add');
  assert.strictEqual(dispatchedRoute, null);

  // 2. Cold-start finishes, layout is mounted
  setReady(true);
  assert.strictEqual(queuedRoute, null);
  assert.strictEqual(dispatchedRoute, '/(tabs)/add');

  // 3. New notification arrives while app is already warm
  dispatchedRoute = null;
  onNotificationArrival('/(tabs)/logs');
  assert.strictEqual(queuedRoute, null);
  assert.strictEqual(dispatchedRoute, '/(tabs)/logs');
});

// ---------------------------------------------------------------------------
// 18. Duplicate Notification Response Suppression
// ---------------------------------------------------------------------------
test('Notification response: suppresses duplicate interactions for the same notification event', () => {
  let lastProcessedKey: string | null = null;
  let processedCount = 0;

  function processNotificationResponse(identifier: string, actionId: string = 'default') {
    const key = `${identifier}:${actionId}`;
    if (lastProcessedKey === key) {
      return false; // suppressed duplicate
    }
    lastProcessedKey = key;
    processedCount++;
    return true;
  }

  // First tap
  assert.strictEqual(processNotificationResponse('notif-101'), true);
  assert.strictEqual(processedCount, 1);

  // Rapid accidental double tap on the exact same response
  assert.strictEqual(processNotificationResponse('notif-101'), false);
  assert.strictEqual(processedCount, 1);

  // Different notification tap
  assert.strictEqual(processNotificationResponse('notif-102'), true);
  assert.strictEqual(processedCount, 2);
});

// ---------------------------------------------------------------------------
// 19. Attendance-Aware Reminder Suppression Evaluation
// ---------------------------------------------------------------------------
test('Attendance suppression: safely defers suppression without complete daily signal', () => {
  // Invocation without signal: deferred
  const defaultEval = evaluateAttendanceSuppression();
  assert.strictEqual(defaultEval.suppressed, false);
  assert.strictEqual(defaultEval.reason, 'deferred');

  // Invocation with incomplete day: not suppressed
  const incompleteEval = evaluateAttendanceSuppression({
    date: '2026-10-23',
    isDayFullyLogged: false,
  });
  assert.strictEqual(incompleteEval.suppressed, false);
  assert.strictEqual(incompleteEval.reason, 'not_completed');

  // Invocation with explicit full day confirmed: suppressed
  const completeEval = evaluateAttendanceSuppression({
    date: '2026-10-23',
    isDayFullyLogged: true,
  });
  assert.strictEqual(completeEval.suppressed, true);
  assert.strictEqual(completeEval.reason, 'day_fully_logged');
});

// ---------------------------------------------------------------------------
// 20. Scheduled Trigger Extraction (Android vs iOS dateComponents)
// ---------------------------------------------------------------------------
test('Trigger extraction: normalizes Android flat triggers and iOS dateComponents schemas', () => {
  // Case A: Android flat trigger
  const androidRecord = extractScheduledRecordData(
    'android-id-1',
    { weekday: 2, hour: 8, minute: 15 },
    { data: { reminderSystem: 'attendance-v3', moment: 'morning', url: '/(tabs)/' } }
  );
  assert.strictEqual(androidRecord.weekday, 2);
  assert.strictEqual(androidRecord.hour, 8);
  assert.strictEqual(androidRecord.minute, 15);
  assert.strictEqual(androidRecord.reminderSystem, 'attendance-v3');
  assert.strictEqual(androidRecord.moment, 'morning');

  // Case B: iOS CalendarTriggerObject with dateComponents
  const iosRecord = extractScheduledRecordData(
    'ios-id-1',
    { type: 'calendar', dateComponents: { weekday: 6, hour: 16, minute: 15 } },
    { data: { reminderSystem: 'attendance-v3', moment: 'wrapUp', url: '/(tabs)/add' } }
  );
  assert.strictEqual(iosRecord.weekday, 6);
  assert.strictEqual(iosRecord.hour, 16);
  assert.strictEqual(iosRecord.minute, 15);
  assert.strictEqual(iosRecord.moment, 'wrapUp');

  // Case C: iOS trigger missing weekday in dateComponents, with content data fallback
  const fallbackRecord = extractScheduledRecordData(
    'ios-id-2',
    { type: 'calendar', dateComponents: { hour: 21, minute: 15 } },
    { data: { reminderSystem: 'attendance-v3', moment: 'night', weekday: 7 } }
  );
  assert.strictEqual(fallbackRecord.weekday, 7);
  assert.strictEqual(fallbackRecord.hour, 21);
  assert.strictEqual(fallbackRecord.minute, 15);

  // Case D: Corrupted or missing time components (hour/minute undefined)
  const corruptedRecord = extractScheduledRecordData(
    'corrupt-1',
    { type: 'calendar', dateComponents: { weekday: 3 } }, // missing hour/minute
    { data: { reminderSystem: 'attendance-v3', moment: 'morning' } }
  );
  assert.strictEqual(corruptedRecord.weekday, 3);
  assert.strictEqual(corruptedRecord.hour, undefined);
  assert.strictEqual(corruptedRecord.minute, undefined);

  // Case E: Out of bounds values are rejected as undefined
  const outOfBounds = extractScheduledRecordData(
    'invalid-1',
    { weekday: 9, hour: 25, minute: 70 },
    null
  );
  assert.strictEqual(outOfBounds.weekday, undefined);
  assert.strictEqual(outOfBounds.hour, undefined);
  assert.strictEqual(outOfBounds.minute, undefined);
});

// ---------------------------------------------------------------------------
// 21. Legacy Migration with iOS dateComponents & Corrupted Trigger Recovery
// ---------------------------------------------------------------------------
test('Migration resilience: adopts valid iOS triggers and replaces corrupted triggers', () => {
  const desired = computeDesiredReminders(DEFAULT_NOTIFICATION_PREFERENCES);

  // Notification 1: Valid iOS trigger with dateComponents matching Monday morning
  const validIosRecord: ExistingScheduledRecord = extractScheduledRecordData(
    'legacy-ios-valid-monday-morning',
    { type: 'calendar', dateComponents: { weekday: 2, hour: 8, minute: 15 } },
    { data: { reminderSystem: 'attendance-v3', moment: 'morning' } }
  );

  // Notification 2: Legacy corrupted trigger with missing hour/minute
  const corruptRecord: ExistingScheduledRecord = extractScheduledRecordData(
    'legacy-corrupt-monday-wrapup',
    { type: 'calendar', dateComponents: { weekday: 2 } }, // missing hour/minute
    { data: { reminderSystem: 'attendance-v3', moment: 'wrapUp' } }
  );

  const plan = computeReconciliationPlan(desired, [validIosRecord, corruptRecord], null);

  // Valid iOS notification should be cleanly adopted into toKeep
  assert.strictEqual(plan.toKeep.length, 1);
  assert.strictEqual(plan.toKeep[0].key, 'reminder-v3-2-morning');
  assert.strictEqual(plan.toKeep[0].identifier, 'legacy-ios-valid-monday-morning');

  // Corrupted notification cannot be safely matched, so it must be cancelled and replaced
  assert.strictEqual(plan.toCancel.includes('legacy-corrupt-monday-wrapup'), true);
  assert.strictEqual(plan.toSchedule.some((s) => s.key === 'reminder-v3-2-wrapUp'), true);
});

// ---------------------------------------------------------------------------
// 22. Diagnostic Accuracy: Honest Next-Reminder Derivation
// ---------------------------------------------------------------------------
test('Diagnostics: next-reminder derives strictly from actual active records, null when empty/unreadable', () => {
  // Empty active records -> nextReminder is null (never invent a time)
  assert.strictEqual(computeNextReminderFromRecords([]), null);

  // Records with missing/corrupted triggers -> returns null
  const corruptRecords: ExistingScheduledRecord[] = [
    { identifier: 'id-1', weekday: 2, hour: undefined, minute: undefined, moment: 'morning' },
  ];
  assert.strictEqual(computeNextReminderFromRecords(corruptRecords), null);

  // Test with verified active records at a specific reference time:
  // Wednesday (weekday 4) at 10:00 AM
  const wednesday10am = new Date(2026, 9, 21, 10, 0, 0); // Oct 21 2026 was Wednesday
  // Ensure reference weekday is 4
  assert.strictEqual(wednesday10am.getDay() + 1, 4);

  const activeRecords: ExistingScheduledRecord[] = [
    // Today Wednesday wrap-up at 16:15 (4:15 PM)
    { identifier: 'id-wed-wrapup', weekday: 4, hour: 16, minute: 15, moment: 'wrapUp', reminderSystem: 'attendance-v3' },
    // Today Wednesday night at 21:15 (9:15 PM)
    { identifier: 'id-wed-night', weekday: 4, hour: 21, minute: 15, moment: 'night', reminderSystem: 'attendance-v3' },
    // Tomorrow Thursday morning at 8:15 (8:15 AM)
    { identifier: 'id-thu-morning', weekday: 5, hour: 8, minute: 15, moment: 'morning', reminderSystem: 'attendance-v3' },
  ];

  const next = computeNextReminderFromRecords(activeRecords, wednesday10am);
  assert.notStrictEqual(next, null);
  // Next should be Wednesday wrapUp (16:15)
  assert.strictEqual(next!.weekday, 4);
  assert.strictEqual(next!.moment, 'wrapUp');
  assert.strictEqual(next!.time, '04:15 PM');
  assert.strictEqual(next!.title, 'Wednesday, wrapped 🌿');
});

// ---------------------------------------------------------------------------
// 23. Concurrent Reconciliation Serialization & Recovery
// ---------------------------------------------------------------------------
test('Concurrency: sequential promise chaining prevents overlapping races and recovers after rejection', async () => {
  let executionCount = 0;
  let currentlyExecuting = false;
  let hasOverlap = false;

  let queue: Promise<any> = Promise.resolve();

  async function mockSerializedReconcile(shouldFail = false) {
    const task = queue.then(
      async () => {
        if (currentlyExecuting) hasOverlap = true;
        currentlyExecuting = true;
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        currentlyExecuting = false;
        if (shouldFail) throw new Error('Simulated reconciliation failure');
        return true;
      },
      async () => {
        // Recovery path after previous rejection
        if (currentlyExecuting) hasOverlap = true;
        currentlyExecuting = true;
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        currentlyExecuting = false;
        return true;
      }
    );
    queue = task.catch(() => false);
    return task;
  }

  // Rapid dispatch of 3 concurrent requests, with the second failing
  const results = await Promise.allSettled([
    mockSerializedReconcile(false),
    mockSerializedReconcile(true),
    mockSerializedReconcile(false),
  ]);

  // All 3 tasks executed in strict sequence with zero overlap
  assert.strictEqual(hasOverlap, false);
  assert.strictEqual(executionCount, 3);

  // First succeeded, second rejected, third recovered and succeeded
  assert.strictEqual(results[0].status, 'fulfilled');
  assert.strictEqual(results[1].status, 'rejected');
  assert.strictEqual(results[2].status, 'fulfilled');
});

// ---------------------------------------------------------------------------
// 24. Permission Startup & Alerts Enable Orchestration Flow
// ---------------------------------------------------------------------------
test('Permission orchestration: startup prompts only when undetermined; Alerts Enable reconciles schedule', async () => {
  let storedPermission: 'undetermined' | 'granted' | 'denied' = 'undetermined';
  let welcomeSent = false;
  let reconciliationExecuted = false;
  let pushRegistered = false;

  async function mockRequestPermission() {
    if (storedPermission === 'granted') return true;
    storedPermission = 'granted';
    welcomeSent = true;
    return true;
  }

  async function mockStartupFlow() {
    if (storedPermission === 'undetermined') {
      const granted = await mockRequestPermission();
      if (!granted) return;
    }
    if (storedPermission !== 'granted') return;
    reconciliationExecuted = true;
    pushRegistered = true;
  }

  // 1. Initial clean launch: prompts permission, sends welcome, reconciles and registers push
  await mockStartupFlow();
  assert.strictEqual(storedPermission, 'granted');
  assert.strictEqual(welcomeSent, true);
  assert.strictEqual(reconciliationExecuted, true);
  assert.strictEqual(pushRegistered, true);

  // 2. Subsequent launch with already granted permission: does NOT re-send welcome
  welcomeSent = false;
  reconciliationExecuted = false;
  await mockStartupFlow();
  assert.strictEqual(welcomeSent, false); // welcome was not re-sent!
  assert.strictEqual(reconciliationExecuted, true);

  // 3. Launch with denied permission: does NOT prompt or schedule
  storedPermission = 'denied';
  welcomeSent = false;
  reconciliationExecuted = false;
  await mockStartupFlow();
  assert.strictEqual(welcomeSent, false);
  assert.strictEqual(reconciliationExecuted, false);

  // 4. Alerts Enable button flow: user explicitly enables after previously denied
  async function mockAlertsEnableButton() {
    const granted = await mockRequestPermission();
    if (granted) {
      reconciliationExecuted = true;
      pushRegistered = true;
    }
  }

  await mockAlertsEnableButton();
  assert.strictEqual(storedPermission, 'granted');
  assert.strictEqual(reconciliationExecuted, true);
});

// ---------------------------------------------------------------------------
// 25. Quiet Hours Schedule Exclusion and Full Restoration
// ---------------------------------------------------------------------------
test('Quiet hours: excludes overlapping reminders and safely restores full schedule when toggled off', () => {
  // Base schedule with all 7 days active
  const basePrefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    quietHours: { enabled: false, startHour: 20, startMinute: 0, endHour: 22, endMinute: 0 },
  };

  // 1. Initial state (quiet hours off): all 21 reminders desired
  const desiredInitial = computeDesiredReminders(basePrefs);
  assert.strictEqual(desiredInitial.length, 21);

  // 2. Toggle quiet hours ON (covers night reminders at 21:15): desired drops to 14
  const quietPrefsOn: NotificationPreferences = {
    ...basePrefs,
    quietHours: { ...basePrefs.quietHours, enabled: true },
  };
  const desiredQuietOn = computeDesiredReminders(quietPrefsOn);
  assert.strictEqual(desiredQuietOn.length, 14);
  assert.strictEqual(desiredQuietOn.some((d) => d.moment === 'night'), false);

  // Simulate existing 21 reminders
  const existing21: ExistingScheduledRecord[] = desiredInitial.map((d, index) => ({
    identifier: `alarm-${index + 1}`,
    weekday: d.weekday,
    hour: d.hour,
    minute: d.minute,
    reminderSystem: 'attendance-v3',
    moment: d.moment,
  }));
  const state21: ManagedReminderState = {
    version: 4,
    keyToIdentifier: Object.fromEntries(desiredInitial.map((d, index) => [d.key, `alarm-${index + 1}`])),
  };

  // Reconcile with quiet hours ON: keeps 14, cancels 7 night reminders, schedules 0
  const planQuietOn = computeReconciliationPlan(desiredQuietOn, existing21, state21);
  assert.strictEqual(planQuietOn.toKeep.length, 14);
  assert.strictEqual(planQuietOn.toCancel.length, 7);
  assert.strictEqual(planQuietOn.toSchedule.length, 0);

  // 3. Toggle quiet hours back OFF: desired returns to 21
  const quietPrefsOff: NotificationPreferences = {
    ...basePrefs,
    quietHours: { ...basePrefs.quietHours, enabled: false },
  };
  const desiredQuietOff = computeDesiredReminders(quietPrefsOff);
  assert.strictEqual(desiredQuietOff.length, 21);

  // Simulate state after quiet hours (only 14 remaining)
  const existing14 = existing21.filter((e) => e.moment !== 'night');
  const state14: ManagedReminderState = {
    version: 4,
    keyToIdentifier: Object.fromEntries(planQuietOn.toKeep.map((k) => [k.key, k.identifier])),
  };

  // Reconcile with quiet hours OFF: keeps 14, schedules back the 7 night reminders, cancels 0!
  const planQuietOff = computeReconciliationPlan(desiredQuietOff, existing14, state14);
  assert.strictEqual(planQuietOff.toKeep.length, 14);
  assert.strictEqual(planQuietOff.toSchedule.length, 7);
  assert.strictEqual(planQuietOff.toCancel.length, 0);
  assert.strictEqual(planQuietOff.toSchedule.every((s) => s.moment === 'night'), true);
});

// ---------------------------------------------------------------------------
// 32. Attendance Intelligence: Subject Summary & Status Classification
// ---------------------------------------------------------------------------
test('Intelligence: subject summary handles zero data vs 0% vs 100% vs partial attendance', () => {
  // Case 1: Zero recorded classes (no data state, distinct from 0%)
  const noData = calculateSubjectSummary(0, 0, 75);
  assert.strictEqual(noData.hasData, false);
  assert.strictEqual(noData.percentage, null);
  assert.strictEqual(noData.status, 'no_data');
  assert.strictEqual(noData.total, 0);
  assert.strictEqual(noData.attended, 0);
  assert.strictEqual(noData.missed, 0);
  assert.strictEqual(noData.target, 75);

  // Case 2: Genuine 0% attendance (total classes logged, none attended)
  const zeroPct = calculateSubjectSummary(0, 10, 75);
  assert.strictEqual(zeroPct.hasData, true);
  assert.strictEqual(zeroPct.percentage, 0);
  assert.strictEqual(zeroPct.status, 'below_target');
  assert.strictEqual(zeroPct.missed, 10);

  // Case 3: 100% attendance
  const perfect = calculateSubjectSummary(10, 10, 75);
  assert.strictEqual(perfect.hasData, true);
  assert.strictEqual(perfect.percentage, 100);
  assert.strictEqual(perfect.status, 'target_met');
  assert.strictEqual(perfect.missed, 0);

  // Case 4: Target boundary (exact 75%)
  const exact = calculateSubjectSummary(15, 20, 75);
  assert.strictEqual(exact.percentage, 75);
  assert.strictEqual(exact.status, 'target_met');

  // Case 5: Just below target (70% < 75%)
  const below = calculateSubjectSummary(14, 20, 75);
  assert.strictEqual(below.percentage, 70);
  assert.strictEqual(below.status, 'below_target');

  // Case 6: Configurable target (e.g. 85%)
  const customTargetMet = calculateSubjectSummary(18, 20, 85); // 90% >= 85%
  assert.strictEqual(customTargetMet.status, 'target_met');
  assert.strictEqual(customTargetMet.target, 85);

  const customTargetBelow = calculateSubjectSummary(16, 20, 85); // 80% < 85%
  assert.strictEqual(customTargetBelow.status, 'below_target');
  assert.strictEqual(customTargetBelow.target, 85);
});

// ---------------------------------------------------------------------------
// 33. Attendance Intelligence: Classes Required to Reach Target
// ---------------------------------------------------------------------------
test('Intelligence: classes required to reach target handles all mathematical cases & unreachable 100%', () => {
  // Case 1: Target already satisfied
  const alreadyMet = calculateClassesRequired(18, 20, 75); // 90% >= 75%
  assert.strictEqual(alreadyMet.status, 'target_met');
  assert.strictEqual(alreadyMet.required, 0);
  assert.strictEqual(alreadyMet.isAchievable, true);
  assert.strictEqual(alreadyMet.currentPercentage, 90);

  // Case 2: Exact boundary
  const boundary = calculateClassesRequired(15, 20, 75); // 75% == 75%
  assert.strictEqual(boundary.status, 'target_met');
  assert.strictEqual(boundary.required, 0);

  // Case 3: Standard shortfall
  // 14/20 = 70%. Need 4 more: (14 + 4) / (20 + 4) = 18 / 24 = 75%.
  const shortfall = calculateClassesRequired(14, 20, 75);
  assert.strictEqual(shortfall.status, 'achievable');
  assert.strictEqual(shortfall.required, 4);
  assert.strictEqual(shortfall.isAchievable, true);
  assert.strictEqual(shortfall.projectedAttended, 18);
  assert.strictEqual(shortfall.projectedTotal, 24);
  assert.strictEqual(shortfall.projectedPercentage, 75);

  // Case 4: 0% attendance shortfall
  // 0/5 = 0%. Need 15 more: (0 + 15) / (5 + 15) = 15 / 20 = 75%.
  const zeroShortfall = calculateClassesRequired(0, 5, 75);
  assert.strictEqual(zeroShortfall.status, 'achievable');
  assert.strictEqual(zeroShortfall.required, 15);
  assert.strictEqual(zeroShortfall.projectedPercentage, 75);

  // Case 5: Unreachable 100% target (at least 1 class already missed)
  // 9/10 = 90%. Target is 100%. Even with infinite future attended classes, attendance < 100%.
  const unreachable = calculateClassesRequired(9, 10, 100);
  assert.strictEqual(unreachable.status, 'unreachable');
  assert.strictEqual(unreachable.required, 0);
  assert.strictEqual(unreachable.isAchievable, false);
  assert.strictEqual(unreachable.projectedPercentage, null);

  // Case 6: 100% target when 100% is currently maintained
  const perfect100 = calculateClassesRequired(10, 10, 100);
  assert.strictEqual(perfect100.status, 'target_met');
  assert.strictEqual(perfect100.required, 0);
  assert.strictEqual(perfect100.isAchievable, true);

  // Case 7: 0% target
  const zeroTarget = calculateClassesRequired(0, 5, 0);
  assert.strictEqual(zeroTarget.status, 'target_met');
  assert.strictEqual(zeroTarget.required, 0);

  // Case 8: Custom target with non-integer ceiling division
  // 10/20 = 50%, target = 85%.
  // rawRequired = (85 * 20 - 1000) / (100 - 85) = 700 / 15 = 46.6666... => ceil is 47.
  // Verification:
  // With 47 classes: (10 + 47) / (20 + 47) = 57 / 67 = 85.0746% >= 85%. (Success)
  // With 46 classes: (10 + 46) / (20 + 46) = 56 / 66 = 84.8484% < 85%. (Fails)
  const ceilCase = calculateClassesRequired(10, 20, 85);
  assert.strictEqual(ceilCase.status, 'achievable');
  assert.strictEqual(ceilCase.required, 47);
  assert.strictEqual(ceilCase.projectedAttended, 57);
  assert.strictEqual(ceilCase.projectedTotal, 67);
  assert.strictEqual(ceilCase.projectedPercentage! >= 85, true);

  // Case 9: Zero data
  const noDataCase = calculateClassesRequired(0, 0, 75);
  assert.strictEqual(noDataCase.status, 'no_data');
  assert.strictEqual(noDataCase.required, 0);
});

// ---------------------------------------------------------------------------
// 34. Attendance Intelligence: Safe-to-Miss Calculation
// ---------------------------------------------------------------------------
test('Intelligence: safe-to-miss handles boundary conditions, 0% target, and rounding', () => {
  // Case 1: Already below target (can miss 0)
  const below = calculateSafeToMiss(14, 20, 75); // 70% < 75%
  assert.strictEqual(below.status, 'below_target');
  assert.strictEqual(below.safeToMiss, 0);

  // Case 2: Exactly on boundary (15/20 = 75%)
  // Missing 1 class gives 15/21 = 71.42% < 75%. Safe to miss is 0.
  const boundary = calculateSafeToMiss(15, 20, 75);
  assert.strictEqual(boundary.status, 'can_miss');
  assert.strictEqual(boundary.safeToMiss, 0);

  // Case 3: Positive margin
  // 16/20 = 80%.
  // Skip 1: 16/21 = 76.19% >= 75%. (Safe)
  // Skip 2: 16/22 = 72.72% < 75%. (Unsafe)
  // Maximum safe to miss is 1.
  const margin1 = calculateSafeToMiss(16, 20, 75);
  assert.strictEqual(margin1.status, 'can_miss');
  assert.strictEqual(margin1.safeToMiss, 1);
  assert.strictEqual(margin1.projectedAttended, 16);
  assert.strictEqual(margin1.projectedTotal, 21);
  assert.strictEqual(margin1.projectedPercentage! >= 75, true);

  // Case 4: 100% current attendance (10/10)
  // Skip 3: 10/13 = 76.92% >= 75%.
  // Skip 4: 10/14 = 71.42% < 75%.
  // Maximum safe to miss is 3.
  const perfect = calculateSafeToMiss(10, 10, 75);
  assert.strictEqual(perfect.status, 'can_miss');
  assert.strictEqual(perfect.safeToMiss, 3);
  assert.strictEqual(perfect.projectedTotal, 13);

  // Case 5: Target 0% (unlimited classes can be missed)
  const zeroTarget = calculateSafeToMiss(5, 10, 0);
  assert.strictEqual(zeroTarget.status, 'unlimited');
  assert.strictEqual(zeroTarget.safeToMiss, Infinity);

  // Case 6: Target 100% with perfect attendance
  // 10/10 = 100%, target = 100%. Missing any class drops below 100%. Safe to miss = 0.
  const target100 = calculateSafeToMiss(10, 10, 100);
  assert.strictEqual(target100.status, 'can_miss');
  assert.strictEqual(target100.safeToMiss, 0);

  // Case 7: Custom target (60%)
  // 15/20 = 75%, target = 60%.
  // raw = (1500 - 1200) / 60 = 300 / 60 = 5.
  // Skip 5: 15 / 25 = 60.0% >= 60%. (Safe)
  // Skip 6: 15 / 26 = 57.69% < 60%. (Unsafe)
  const custom60 = calculateSafeToMiss(15, 20, 60);
  assert.strictEqual(custom60.safeToMiss, 5);
  assert.strictEqual(custom60.projectedTotal, 25);
  assert.strictEqual(custom60.projectedPercentage, 60);

  // Case 8: Zero data
  const noData = calculateSafeToMiss(0, 0, 75);
  assert.strictEqual(noData.status, 'no_data');
  assert.strictEqual(noData.safeToMiss, 0);
});

// ---------------------------------------------------------------------------
// 35. Attendance Intelligence: Equivalence with Phase 1 75% Formula Helper
// ---------------------------------------------------------------------------
test('Intelligence: equivalence with existing Phase 1 75% target helper across all counts', () => {
  // Test all attended/total combinations from total = 1 to 40
  for (let total = 1; total <= 40; total++) {
    for (let attended = 0; attended <= total; attended++) {
      const legacy = calculateAttendanceStatus(attended, total);
      const reqIntelligence = calculateClassesRequired(attended, total, 75);
      const safeIntelligence = calculateSafeToMiss(attended, total, 75);

      // Verify exact equivalence of required/needed
      assert.strictEqual(
        reqIntelligence.required,
        legacy.needed,
        `Mismatch in required classes for (${attended}/${total})`
      );

      // Verify exact equivalence of safeToMiss/safeToSkip
      assert.strictEqual(
        safeIntelligence.safeToMiss,
        legacy.safeToSkip,
        `Mismatch in safe-to-miss classes for (${attended}/${total})`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 36. Attendance Intelligence: What-If Simulation
// ---------------------------------------------------------------------------
test('Intelligence: what-if simulation computes projections without mutating inputs', () => {
  const originalInput = Object.freeze({
    currentAttended: 12,
    currentTotal: 20,
    hypotheticalAttended: 4,
    hypotheticalMissed: 1,
  });

  // Current: 12/20 = 60.0%
  // Projected: (12 + 4) / (20 + 4 + 1) = 16 / 25 = 64.0%
  // Delta: +4.0%
  const result = simulateAttendanceWhatIf(originalInput);

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.hasData, true);
  assert.strictEqual(result.projectedAttended, 16);
  assert.strictEqual(result.projectedMissed, 9); // (20 - 12) + 1 = 9
  assert.strictEqual(result.projectedTotal, 25);
  assert.strictEqual(result.currentPercentage, 60);
  assert.strictEqual(result.projectedPercentage, 64);
  assert.strictEqual(result.percentageDelta, 4);

  // Confirm input object is strictly unchanged
  assert.strictEqual(originalInput.currentAttended, 12);
  assert.strictEqual(originalInput.currentTotal, 20);

  // What-if from zero data
  const zeroDataSim = simulateAttendanceWhatIf({
    currentAttended: 0,
    currentTotal: 0,
    hypotheticalAttended: 3,
    hypotheticalMissed: 1,
  });
  assert.strictEqual(zeroDataSim.isValid, true);
  assert.strictEqual(zeroDataSim.currentPercentage, null);
  assert.strictEqual(zeroDataSim.projectedAttended, 3);
  assert.strictEqual(zeroDataSim.projectedTotal, 4);
  assert.strictEqual(zeroDataSim.projectedPercentage, 75);
  assert.strictEqual(zeroDataSim.percentageDelta, null);
});

// ---------------------------------------------------------------------------
// 37. Attendance Intelligence: Strict Input Validation & Edge Case Rejection
// ---------------------------------------------------------------------------
test('Intelligence: strictly rejects invalid, negative, fractional, NaN, infinite, and out-of-order inputs', () => {
  // Negative attended
  const negAttended = calculateClassesRequired(-1, 10, 75);
  assert.strictEqual(negAttended.status, 'invalid_input');

  // Negative total
  const negTotal = calculateSafeToMiss(5, -10, 75);
  assert.strictEqual(negTotal.status, 'invalid_input');

  // Attended > Total
  const attendedExceeds = calculateClassesRequired(12, 10, 75);
  assert.strictEqual(attendedExceeds.status, 'invalid_input');

  // Fractional class counts
  const fracAttended = calculateSafeToMiss(4.5, 10, 75);
  assert.strictEqual(fracAttended.status, 'invalid_input');

  const fracTotal = calculateClassesRequired(4, 10.5, 75);
  assert.strictEqual(fracTotal.status, 'invalid_input');

  // Target < 0 or > 100
  const negTarget = calculateClassesRequired(5, 10, -5);
  assert.strictEqual(negTarget.status, 'invalid_input');

  const excessTarget = calculateSafeToMiss(5, 10, 105);
  assert.strictEqual(excessTarget.status, 'invalid_input');

  // NaN & Infinity
  const nanCount = calculateClassesRequired(NaN, 10, 75);
  assert.strictEqual(nanCount.status, 'invalid_input');

  const infCount = calculateSafeToMiss(5, Infinity, 75);
  assert.strictEqual(infCount.status, 'invalid_input');

  const nanTarget = calculateClassesRequired(5, 10, NaN);
  assert.strictEqual(nanTarget.status, 'invalid_input');

  // What-if validation
  const invalidSim1 = simulateAttendanceWhatIf({
    currentAttended: 15,
    currentTotal: 10, // Invalid: attended > total
    hypotheticalAttended: 2,
    hypotheticalMissed: 0,
  });
  assert.strictEqual(invalidSim1.isValid, false);
  assert.strictEqual(typeof invalidSim1.error, 'string');

  const invalidSim2 = simulateAttendanceWhatIf({
    currentAttended: 5,
    currentTotal: 10,
    hypotheticalAttended: -1, // Negative
    hypotheticalMissed: 0,
  });
  assert.strictEqual(invalidSim2.isValid, false);

  const invalidSim3 = simulateAttendanceWhatIf({
    currentAttended: 5,
    currentTotal: 10,
    hypotheticalAttended: 1.5, // Fractional
    hypotheticalMissed: 0,
  });
  assert.strictEqual(invalidSim3.isValid, false);
});

// ---------------------------------------------------------------------------
// 38. Attendance Intelligence: Scale, Property Stress, & Unified Projection Helper
// ---------------------------------------------------------------------------
test('Intelligence: scale stress and unified projection helper', () => {
  // Large scale test (10,000 classes)
  // 7,000 / 10,000 = 70%. Target 75%.
  // Required: (75 * 10000 - 100 * 7000) / 25 = (750000 - 700000) / 25 = 50000 / 25 = 2,000 classes.
  // Projected: 9,000 / 12,000 = 75%.
  const largeReq = calculateClassesRequired(7000, 10000, 75);
  assert.strictEqual(largeReq.status, 'achievable');
  assert.strictEqual(largeReq.required, 2000);
  assert.strictEqual(largeReq.projectedAttended, 9000);
  assert.strictEqual(largeReq.projectedTotal, 12000);
  assert.strictEqual(largeReq.projectedPercentage, 75);

  // Large scale safe-to-miss: 8,000 / 10,000 = 80%. Target 75%.
  // rawSafe = (800000 - 750000) / 75 = 50000 / 75 = 666.666... => floor is 666.
  // Skip 666: 8000 / 10666 = 75.00469% >= 75%. (Safe)
  // Skip 667: 8000 / 10667 = 74.99765% < 75%. (Unsafe)
  const largeSafe = calculateSafeToMiss(8000, 10000, 75);
  assert.strictEqual(largeSafe.safeToMiss, 666);
  assert.strictEqual(largeSafe.projectedTotal, 10666);
  assert.strictEqual(largeSafe.projectedPercentage! >= 75, true);

  // Unified projection helper
  const projection = generateAttendanceProjections(14, 20, 75);
  assert.strictEqual(projection.summary.percentage, 70);
  assert.strictEqual(projection.summary.status, 'below_target');
  assert.strictEqual(projection.requiredToTarget.required, 4);
  assert.strictEqual(projection.safeToMiss.safeToMiss, 0);
});

// ---------------------------------------------------------------------------
// 39. Attendance Intelligence: Mathematical Boundary Precision & Invariants
// ---------------------------------------------------------------------------
test('Intelligence: mathematical boundary precision, near-integer targets, and independent invariants', () => {
  // --- 1. Integer boundary: 15/20 is exactly 75.0% ---
  // A. Exactly 75.0%
  const summaryExact75 = calculateSubjectSummary(15, 20, 75);
  assert.strictEqual(summaryExact75.status, 'target_met');
  assert.strictEqual(summaryExact75.percentage, 75);

  const reqExact75 = calculateClassesRequired(15, 20, 75);
  assert.strictEqual(reqExact75.status, 'target_met');
  assert.strictEqual(reqExact75.required, 0);

  const safeExact75 = calculateSafeToMiss(15, 20, 75);
  assert.strictEqual(safeExact75.status, 'can_miss');
  assert.strictEqual(safeExact75.safeToMiss, 0);
  // Invariant for safeExact75: 0 misses stays >= 75%, 1 miss drops below
  assert.strictEqual((15 * 100) / (20 + 0) >= 75, true);
  assert.strictEqual((15 * 100) / (20 + 1) < 75, true);

  // B. Target slightly ABOVE current (75.000000001% > 75.0%)
  const summaryAbove = calculateSubjectSummary(15, 20, 75.000000001);
  assert.strictEqual(summaryAbove.status, 'below_target');

  const reqAbove = calculateClassesRequired(15, 20, 75.000000001);
  assert.strictEqual(reqAbove.status, 'achievable');
  assert.strictEqual(reqAbove.required, 1);
  // Invariant: 1 class reaches, 0 classes does not
  assert.strictEqual(((15 + 1) * 100) / (20 + 1) >= 75.000000001, true);
  assert.strictEqual(((15 + 0) * 100) / (20 + 0) < 75.000000001, true);

  const safeAbove = calculateSafeToMiss(15, 20, 75.000000001);
  assert.strictEqual(safeAbove.status, 'below_target');
  assert.strictEqual(safeAbove.safeToMiss, 0);

  // C. Target slightly BELOW current (74.999999999% < 75.0%)
  const summaryBelow = calculateSubjectSummary(15, 20, 74.999999999);
  assert.strictEqual(summaryBelow.status, 'target_met');

  const reqBelow = calculateClassesRequired(15, 20, 74.999999999);
  assert.strictEqual(reqBelow.status, 'target_met');
  assert.strictEqual(reqBelow.required, 0);

  const safeBelow = calculateSafeToMiss(15, 20, 74.999999999);
  assert.strictEqual(safeBelow.status, 'can_miss');
  assert.strictEqual(safeBelow.safeToMiss, 0);
  assert.strictEqual((15 * 100) / (20 + 0) >= 74.999999999, true);
  assert.strictEqual((15 * 100) / (20 + 1) < 74.999999999, true);

  // --- 2. Target 100% vs 99.999999999% ---
  // A. Exactly 100% with absences is unreachable
  const req100Unreachable = calculateClassesRequired(15, 20, 100);
  assert.strictEqual(req100Unreachable.status, 'unreachable');
  assert.strictEqual(req100Unreachable.isAchievable, false);
  assert.strictEqual(req100Unreachable.required, 0);
  assert.strictEqual(req100Unreachable.projectedPercentage, null);

  // B. Exactly 100% with zero absences is met
  const req100Met = calculateClassesRequired(20, 20, 100);
  assert.strictEqual(req100Met.status, 'target_met');
  assert.strictEqual(req100Met.isAchievable, true);
  assert.strictEqual(req100Met.required, 0);
  assert.strictEqual(req100Met.projectedPercentage, 100);

  // C. 99.999999999% is reachable (finite positive integer)
  const reqNear100 = calculateClassesRequired(15, 20, 99.999999999);
  assert.strictEqual(reqNear100.status, 'achievable');
  assert.strictEqual(reqNear100.isAchievable, true);
  assert.strictEqual(reqNear100.required, 499994629597);
  // Verify exact invariant for 99.999999999%
  const R = reqNear100.required;
  assert.strictEqual(((15 + R) * 100) / (20 + R) >= 99.999999999, true);
  assert.strictEqual(((15 + R - 1) * 100) / (20 + R - 1) < 99.999999999, true);

  // --- 3. Target 0% vs 0.000000001% Safe to Miss ---
  // A. Exactly 0% is unlimited (Infinity)
  const safe0 = calculateSafeToMiss(15, 20, 0);
  assert.strictEqual(safe0.status, 'unlimited');
  assert.strictEqual(safe0.safeToMiss, Infinity);

  // B. 0.000000001% is finite (not unlimited)
  const safeNear0 = calculateSafeToMiss(15, 20, 0.000000001);
  assert.strictEqual(safeNear0.status, 'can_miss');
  assert.strictEqual(Number.isFinite(safeNear0.safeToMiss), true);
  assert.strictEqual(safeNear0.safeToMiss, 1499999999980);
  const S = safeNear0.safeToMiss;
  assert.strictEqual((15 * 100) / (20 + S) >= 0.000000001, true);
  assert.strictEqual((15 * 100) / (20 + S + 1) < 0.000000001, true);

  // --- 4. No-Data & Null Percentage Semantics ---
  const sumNoData = calculateSubjectSummary(0, 0, 75);
  assert.strictEqual(sumNoData.percentage, null);
  assert.strictEqual(sumNoData.hasData, false);
  assert.strictEqual(sumNoData.status, 'no_data');

  const reqNoData = calculateClassesRequired(0, 0, 75);
  assert.strictEqual(reqNoData.status, 'no_data');
  assert.strictEqual(reqNoData.isAchievable, false);
  assert.strictEqual(reqNoData.required, 0);
  assert.strictEqual(reqNoData.currentPercentage, null);
  assert.strictEqual(reqNoData.projectedPercentage, null);

  const safeNoData = calculateSafeToMiss(0, 0, 75);
  assert.strictEqual(safeNoData.status, 'no_data');
  assert.strictEqual(safeNoData.safeToMiss, 0);
  assert.strictEqual(safeNoData.currentPercentage, null);

  const whatIfNoData = simulateAttendanceWhatIf({
    currentAttended: 0,
    currentTotal: 0,
    hypotheticalAttended: 0,
    hypotheticalMissed: 0,
  });
  assert.strictEqual(whatIfNoData.isValid, true);
  assert.strictEqual(whatIfNoData.hasData, false);
  assert.strictEqual(whatIfNoData.currentPercentage, null);
  assert.strictEqual(whatIfNoData.projectedPercentage, null);
  assert.strictEqual(whatIfNoData.percentageDelta, null);

  // --- 5. Consistency of Input Validation across Public Functions ---
  const invalidSummary = calculateSubjectSummary(-1, 10, 75);
  assert.strictEqual(invalidSummary.status, 'invalid_input');
  assert.strictEqual(invalidSummary.percentage, null);

  const invalidSummaryTarget = calculateSubjectSummary(5, 10, 110);
  assert.strictEqual(invalidSummaryTarget.status, 'invalid_input');

  const invalidReq = calculateClassesRequired(12, 10, 75);
  assert.strictEqual(invalidReq.status, 'invalid_input');

  const invalidSafe = calculateSafeToMiss(5, 10, -5);
  assert.strictEqual(invalidSafe.status, 'invalid_input');

  // --- 6. Independent Invariant Sweep across Fractional Targets ---
  const testTargets = [33.333333333, 50.0, 66.666666667, 83.333333333, 91.5];
  const testCases = [
    { a: 3, n: 10 },
    { a: 7, n: 12 },
    { a: 11, n: 15 },
    { a: 18, n: 20 },
    { a: 22, n: 25 },
  ];

  for (const t of testTargets) {
    for (const { a, n } of testCases) {
      const reqResult = calculateClassesRequired(a, n, t);
      if (reqResult.status === 'achievable') {
        const req = reqResult.required;
        assert.strictEqual(
          ((a + req) * 100) / (n + req) >= t,
          true,
          `Invariant failed: ((a+req)/(n+req))*100 < t for a=${a}, n=${n}, t=${t}, req=${req}`
        );
        if (req > 0) {
          assert.strictEqual(
            ((a + req - 1) * 100) / (n + req - 1) < t,
            true,
            `Minimality failed: ((a+req-1)/(n+req-1))*100 >= t for a=${a}, n=${n}, t=${t}, req=${req}`
          );
        }
      }

      const safeResult = calculateSafeToMiss(a, n, t);
      if (safeResult.status === 'can_miss') {
        const safe = safeResult.safeToMiss;
        assert.strictEqual(
          (a * 100) / (n + safe) >= t,
          true,
          `Invariant failed: (a/(n+safe))*100 < t for a=${a}, n=${n}, t=${t}, safe=${safe}`
        );
        assert.strictEqual(
          (a * 100) / (n + safe + 1) < t,
          true,
          `Maximality failed: (a/(n+safe+1))*100 >= t for a=${a}, n=${n}, t=${t}, safe=${safe}`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 40. Attendance Intelligence: Safe-Integer Numeric Safety, Loop Termination, and Overflow Contract
// ---------------------------------------------------------------------------
test('Intelligence: safe-integer numeric safety, loop termination, and overflow contract', () => {
  const unsafeNumber = 2 ** 54; // Beyond Number.MAX_SAFE_INTEGER
  const unsafeMaxPlusOne = Number.MAX_SAFE_INTEGER + 1;

  // 1. Unsafe integer inputs are strictly rejected rather than performing lossy arithmetic
  const unsafeSummary1 = calculateSubjectSummary(unsafeNumber, unsafeNumber, 75);
  assert.strictEqual(unsafeSummary1.status, 'invalid_input');

  const unsafeSummary2 = calculateSubjectSummary(10, unsafeMaxPlusOne, 75);
  assert.strictEqual(unsafeSummary2.status, 'invalid_input');

  const unsafeReq1 = calculateClassesRequired(unsafeNumber, unsafeNumber, 75);
  assert.strictEqual(unsafeReq1.status, 'invalid_input');

  const unsafeReq2 = calculateClassesRequired(10, unsafeMaxPlusOne, 75);
  assert.strictEqual(unsafeReq2.status, 'invalid_input');

  const unsafeSafe1 = calculateSafeToMiss(unsafeNumber, unsafeNumber, 75);
  assert.strictEqual(unsafeSafe1.status, 'invalid_input');

  const unsafeSafe2 = calculateSafeToMiss(10, unsafeMaxPlusOne, 75);
  assert.strictEqual(unsafeSafe2.status, 'invalid_input');

  const unsafeSim1 = simulateAttendanceWhatIf({
    currentAttended: unsafeNumber,
    currentTotal: unsafeNumber,
    hypotheticalAttended: 0,
    hypotheticalMissed: 0,
  });
  assert.strictEqual(unsafeSim1.isValid, false);

  const unsafeSim2 = simulateAttendanceWhatIf({
    currentAttended: 10,
    currentTotal: 20,
    hypotheticalAttended: unsafeMaxPlusOne,
    hypotheticalMissed: 0,
  });
  assert.strictEqual(unsafeSim2.isValid, false);

  // 2. Projected overflow in simulation
  const overflowSim = simulateAttendanceWhatIf({
    currentAttended: Number.MAX_SAFE_INTEGER - 5,
    currentTotal: Number.MAX_SAFE_INTEGER - 5,
    hypotheticalAttended: 10,
    hypotheticalMissed: 0,
  });
  assert.strictEqual(overflowSim.isValid, false);
  assert.strictEqual(overflowSim.error, 'Projected class counts exceed the maximum safe integer limit');

  // 3. Overflow contract for mathematically finite results exceeding Number.MAX_SAFE_INTEGER
  // A. Target near 100% requiring more classes than MAX_SAFE_INTEGER
  const near100Overflow = calculateClassesRequired(15, 20, 99.99999999999999);
  assert.strictEqual(near100Overflow.status, 'overflow');
  assert.strictEqual(near100Overflow.isAchievable, false);
  assert.strictEqual(near100Overflow.required, Infinity);
  assert.strictEqual(near100Overflow.projectedPercentage, null);
  assert.strictEqual(typeof near100Overflow.explanation, 'string');

  // B. Target near 0% allowing more misses than MAX_SAFE_INTEGER
  const near0Overflow1 = calculateSafeToMiss(15, 20, 1e-14);
  assert.strictEqual(near0Overflow1.status, 'overflow');
  assert.strictEqual(near0Overflow1.safeToMiss, Infinity);
  assert.strictEqual(near0Overflow1.projectedPercentage, null);

  const near0Overflow2 = calculateSafeToMiss(15, 20, 1e-300);
  assert.strictEqual(near0Overflow2.status, 'overflow');
  assert.strictEqual(near0Overflow2.safeToMiss, Infinity);

  // 4. Distinction between exact math cases and overflow
  // - Exact 100% with absences is unreachable, NOT overflow
  const exact100 = calculateClassesRequired(15, 20, 100);
  assert.strictEqual(exact100.status, 'unreachable');
  assert.strictEqual(exact100.required, 0);

  // - Exact 0% is unlimited, NOT overflow
  const exact0 = calculateSafeToMiss(15, 20, 0);
  assert.strictEqual(exact0.status, 'unlimited');
  assert.strictEqual(exact0.safeToMiss, Infinity);

  // - Reachable near-100% within safe integers is achievable, NOT overflow
  const safeNear100 = calculateClassesRequired(15, 20, 99.999999999);
  assert.strictEqual(safeNear100.status, 'achievable');
  assert.strictEqual(safeNear100.required, 499994629597);

  // - Finite near-0% within safe integers is can_miss, NOT overflow
  const safeNear0 = calculateSafeToMiss(15, 20, 0.000000001);
  assert.strictEqual(safeNear0.status, 'can_miss');
  assert.strictEqual(safeNear0.safeToMiss, 1499999999980);
});
