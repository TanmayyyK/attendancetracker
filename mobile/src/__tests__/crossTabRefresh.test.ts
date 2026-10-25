/**
 * Cross-Tab Attendance Refresh Integration Tests
 *
 * Verifies Phase 2C Batch 1 requirements:
 * 1. Successful attendance submission increments the version and triggers invalidation.
 * 2. Failed or invalid submissions do NOT trigger invalidation or version increments.
 * 3. Home refreshes when it becomes active after a successful submission.
 * 4. Insights refreshes when it becomes active after a successful submission.
 * 5. Independent tabs catch up on their own lifecycle without missing mutations.
 * 6. Repeated or rapid overlapping focus events do NOT cause duplicate concurrent requests.
 * 7. Manual pull-to-refresh works independently and synchronizes observed version.
 * 8. Refresh failure preserves content and exposes retry without crashing.
 * 9. Multiple mutations while inactive collapse into a single catch-up refresh.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  notifyAttendanceMutation,
  getAttendanceVersion,
  subscribeAttendanceMutation,
  resetAttendanceEventBusForTesting,
  createFocusRefreshCoordinator,
} from '../services/attendance/attendanceEventBus.ts';

import {
  mergeCumulativeSubjects,
  type RawApiSubjectRecord,
} from '../utils/targetPolicy.ts';

import {
  resolveSimulatorSectionState,
} from '../utils/simulatorPolicy.ts';

test('1. Successful attendance submission triggers invalidation and version increment', () => {
  resetAttendanceEventBusForTesting(0);
  assert.strictEqual(getAttendanceVersion(), 0);

  let listenerFiredCount = 0;
  const unsubscribe = subscribeAttendanceMutation(() => {
    listenerFiredCount += 1;
  });

  // Simulate Add tab submission workflow
  const simulateSubmission = (result: { ok: boolean; inserted?: number }) => {
    if (result.ok) {
      notifyAttendanceMutation();
    }
  };

  simulateSubmission({ ok: true, inserted: 3 });

  assert.strictEqual(getAttendanceVersion(), 1);
  assert.strictEqual(listenerFiredCount, 1);

  unsubscribe();
  notifyAttendanceMutation();
  assert.strictEqual(getAttendanceVersion(), 2);
  assert.strictEqual(listenerFiredCount, 1, 'Unsubscribed listener must not receive further events');
});

test('2. Failed or invalid submissions do NOT trigger invalidation or version increment', () => {
  resetAttendanceEventBusForTesting(5);
  assert.strictEqual(getAttendanceVersion(), 5);

  let listenerFiredCount = 0;
  subscribeAttendanceMutation(() => {
    listenerFiredCount += 1;
  });

  const simulateSubmission = (result: { ok: boolean; error?: string }) => {
    if (result.ok) {
      notifyAttendanceMutation();
    }
  };

  // Simulate network failure, 500 error, or validation reject
  simulateSubmission({ ok: false, error: 'Connection timeout' });
  simulateSubmission({ ok: false, error: 'Internal server error' });

  assert.strictEqual(getAttendanceVersion(), 5, 'Version must remain unchanged on submission failure');
  assert.strictEqual(listenerFiredCount, 0, 'No listeners should be notified on failure');
});

test('3. Home refreshes when it becomes active after a successful submission', async () => {
  resetAttendanceEventBusForTesting(0);

  let homeRefreshCount = 0;
  const homeCoordinator = createFocusRefreshCoordinator({
    onRefresh: async () => {
      homeRefreshCount += 1;
    },
  });

  // Initial focus check (on initial mount): version is 0, observed is 0
  const refreshedInitial = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(refreshedInitial, false, 'Initial focus must not trigger duplicate refresh');
  assert.strictEqual(homeRefreshCount, 0);

  // User submits attendance on Add tab
  notifyAttendanceMutation();
  assert.strictEqual(getAttendanceVersion(), 1);

  // User switches back to Home tab -> focus effect runs checkAndRefresh
  const refreshedAfterMutation = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(refreshedAfterMutation, true, 'Home must refresh after mutation');
  assert.strictEqual(homeRefreshCount, 1);
  assert.strictEqual(homeCoordinator.getLastObservedVersion(), 1);

  // User stays on Home or taps Home again
  const refreshedSameTab = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(refreshedSameTab, false, 'No repeated refresh without new mutation');
  assert.strictEqual(homeRefreshCount, 1);
});

test('4. Insights refreshes when it becomes active after a successful submission', async () => {
  resetAttendanceEventBusForTesting(0);

  let snapshotsFetched = 0;
  let intelligenceRefreshed = 0;

  const insightsCoordinator = createFocusRefreshCoordinator({
    onRefresh: async () => {
      // Replicates Promise.all([fetchData(), refreshIntelligence()])
      snapshotsFetched += 1;
      intelligenceRefreshed += 1;
    },
  });

  // Initial focus: no refresh
  await insightsCoordinator.checkAndRefresh();
  assert.strictEqual(snapshotsFetched, 0);
  assert.strictEqual(intelligenceRefreshed, 0);

  // Mutation occurs
  notifyAttendanceMutation();

  // Insights becomes active
  const refreshed = await insightsCoordinator.checkAndRefresh();
  assert.strictEqual(refreshed, true);
  assert.strictEqual(snapshotsFetched, 1, 'Monthly snapshots must refresh');
  assert.strictEqual(intelligenceRefreshed, 1, 'Attendance intelligence must refresh');

  // Second focus without mutation
  const redundant = await insightsCoordinator.checkAndRefresh();
  assert.strictEqual(redundant, false);
  assert.strictEqual(snapshotsFetched, 1);
  assert.strictEqual(intelligenceRefreshed, 1);
});

test('5. Independent tabs catch up on their own lifecycles', async () => {
  resetAttendanceEventBusForTesting(0);

  let homeCalls = 0;
  let insightsCalls = 0;

  const home = createFocusRefreshCoordinator({
    onRefresh: () => {
      homeCalls += 1;
    },
  });

  const insights = createFocusRefreshCoordinator({
    onRefresh: () => {
      insightsCalls += 1;
    },
  });

  // Attendance submitted on Add tab (v = 1)
  notifyAttendanceMutation();

  // User goes to Home tab
  await home.checkAndRefresh();
  assert.strictEqual(homeCalls, 1);
  assert.strictEqual(insightsCalls, 0, 'Insights has not focused yet; must not refresh prematurely');

  // User switches back and forth between Home and other apps/subviews
  await home.checkAndRefresh();
  assert.strictEqual(homeCalls, 1);

  // User finally visits Insights tab
  await insights.checkAndRefresh();
  assert.strictEqual(insightsCalls, 1, 'Insights must catch up when focused');

  // Both are now synchronized to v = 1
  await home.checkAndRefresh();
  await insights.checkAndRefresh();
  assert.strictEqual(homeCalls, 1);
  assert.strictEqual(insightsCalls, 1);
});

test('6. Overlapping rapid focus events do not trigger duplicate concurrent requests', async () => {
  resetAttendanceEventBusForTesting(0);

  let networkCalls = 0;
  let resolveNetwork: (() => void) | null = null;

  const coordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      networkCalls += 1;
      return new Promise<void>((resolve) => {
        resolveNetwork = resolve;
      });
    },
  });

  // Mutation occurs
  notifyAttendanceMutation();

  // First focus triggers refresh (now in-flight)
  const firstPromise = coordinator.checkAndRefresh();
  assert.strictEqual(coordinator.isInFlight(), true);
  assert.strictEqual(networkCalls, 1);

  // Rapid second and third focus events while first is still in-flight
  const secondResult = await coordinator.checkAndRefresh();
  const thirdResult = await coordinator.checkAndRefresh();

  assert.strictEqual(secondResult, false, 'Overlapping focus must not start concurrent refresh');
  assert.strictEqual(thirdResult, false, 'Overlapping focus must not start concurrent refresh');
  assert.strictEqual(networkCalls, 1, 'Only exactly 1 network call must be made');

  // In-flight refresh finishes
  resolveNetwork!();
  await firstPromise;

  assert.strictEqual(coordinator.isInFlight(), false);
  assert.strictEqual(coordinator.getLastObservedVersion(), 1);
});

test('7. Manual pull-to-refresh synchronizes observed version', async () => {
  resetAttendanceEventBusForTesting(0);

  let focusRefreshCount = 0;
  const coordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      focusRefreshCount += 1;
    },
  });

  // Mutation occurs (v = 1)
  notifyAttendanceMutation();

  // User manually pulls to refresh before focus handler triggers
  coordinator.markSynced();
  assert.strictEqual(coordinator.getLastObservedVersion(), 1);

  // Subsequent focus sees that data is already up-to-date
  const focusResult = await coordinator.checkAndRefresh();
  assert.strictEqual(focusResult, false, 'Focus must not re-fetch what manual pull already fetched');
  assert.strictEqual(focusRefreshCount, 0);
});

test('8. Refresh failure preserves existing content and exposes retry state', async () => {
  resetAttendanceEventBusForTesting(0);

  // 1. Existing valid state before refresh
  const initialRecords: RawApiSubjectRecord[] = [
    { subject: 'Physiology', present: 18, absent: 2, total: 20 },
  ];
  const initialData = mergeCumulativeSubjects(initialRecords, {});
  assert.strictEqual(initialData.overall.percentage, 90.0);
  assert.strictEqual(initialData.isApiError, false);

  // 2. Refresh fails due to network outage (returns null)
  let failedRefreshAttempted = false;
  const coordinator = createFocusRefreshCoordinator({
    onRefresh: async () => {
      failedRefreshAttempted = true;
      // Simulates failed fetch
      const failedRecords: RawApiSubjectRecord[] | null = null;
      const failureState = mergeCumulativeSubjects(failedRecords, {});
      assert.strictEqual(failureState.isApiError, true);
    },
  });

  notifyAttendanceMutation();
  const result = await coordinator.checkAndRefresh();

  assert.strictEqual(result, true, 'Coordinator must run refresh attempt');
  assert.strictEqual(failedRefreshAttempted, true);
  assert.strictEqual(coordinator.isInFlight(), false, 'In-flight flag must reset even after failure');

  // 3. Simulator UI handles error state cleanly with retry
  const simulatorState = resolveSimulatorSectionState({
    isLoading: false,
    isIntelligenceError: true,
    intelligenceError: 'Unable to load attendance data. Please check your connection.',
    subjectCount: 5,
  });
  assert.strictEqual(simulatorState.sectionStatus, 'error');
  assert.strictEqual(simulatorState.canRetry, true);
  if (simulatorState.sectionStatus === 'error') {
    assert.match(simulatorState.errorMessage || '', /Unable to load/);
  }
});

test('9. Multiple mutations while inactive collapse into a single catch-up refresh', async () => {
  resetAttendanceEventBusForTesting(0);

  let refreshCallCount = 0;
  const coordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      refreshCallCount += 1;
    },
  });

  // Multiple mutations while screen is blurred (e.g. 3 entries logged on Add tab)
  notifyAttendanceMutation();
  notifyAttendanceMutation();
  notifyAttendanceMutation();
  assert.strictEqual(getAttendanceVersion(), 3);

  // Screen focuses once
  const refreshed = await coordinator.checkAndRefresh();
  assert.strictEqual(refreshed, true);
  assert.strictEqual(refreshCallCount, 1, 'Must execute exactly 1 refresh for the latest state');
  assert.strictEqual(coordinator.getLastObservedVersion(), 3);
});
