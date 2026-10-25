/**
 * Submission Safety & Timeout Policy Integration Tests
 *
 * Verifies Phase 2C Batch 2 requirements:
 * 1. Successful submission returns success outcome.
 * 2. HTTP 400/422 rejection classifies as definite_rejection.
 * 3. HTTP 502/503/504 classifies as ambiguous_failure (gateway_timeout).
 * 4. Request timeout after 15s triggers AbortError and classifies as client_timeout.
 * 5. Network transport failure classifies as transport_error.
 * 6. Malformed JSON after HTTP 200 classifies as malformed_response.
 * 7. Form values are preserved on failure.
 * 8. No attendance-success invalidation occurs on ambiguous or rejected outcomes.
 * 9. Identical resubmission after an ambiguous outcome requires confirmation.
 * 10. Materially changed payload is not blocked by previous ambiguous warning.
 * 11. Successful confirmed retry follows the normal success path.
 * 12. Existing cross-tab refresh coordinator remains completely intact.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  createBulkAttendance,
  type BulkAttendanceResult,
} from '../api.ts';

import {
  computeSubmissionSignature,
  classifyHttpOutcome,
  classifyCaughtException,
  SubmissionSafetyController,
  type AttendanceSubmissionRow,
} from '../utils/submissionSafety.ts';

import {
  getAttendanceVersion,
  notifyAttendanceMutation,
  resetAttendanceEventBusForTesting,
  createFocusRefreshCoordinator,
} from '../services/attendance/attendanceEventBus.ts';

// Helper to mock globalThis.fetch safely
function withMockFetch(
  mockFn: (url: string, init?: any) => Promise<any>,
  testFn: () => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn as any;
  return testFn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

test('1. Successful submission returns success outcome and inserted count', async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ inserted: 4 }),
    }),
    async () => {
      const rows: AttendanceSubmissionRow[] = [
        { date: '2026-10-24', mode: 'subject', subject: 'Anatomy', present: 2, absent: 0 },
        { date: '2026-10-24', mode: 'subject', subject: 'Physiology', present: 1, absent: 1, absent_reasons: ['Sick'] },
      ];

      const result = await createBulkAttendance(rows);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.inserted, 4);
      assert.strictEqual(result.outcome.kind, 'success');
      if (result.outcome.kind === 'success') {
        assert.strictEqual(result.outcome.inserted, 4);
      }
    }
  );
});

test('2. HTTP 400 and 422 rejections classify as definite_rejection', async () => {
  await withMockFetch(
    async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Invalid calendar date format' }),
    }),
    async () => {
      const result = await createBulkAttendance([]);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.outcome.kind, 'definite_rejection');
      if (result.outcome.kind === 'definite_rejection') {
        assert.strictEqual(result.outcome.statusCode, 422);
        assert.match(result.outcome.error, /Invalid calendar date format/);
      }
    }
  );

  await withMockFetch(
    async () => ({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Malformed request body' }),
    }),
    async () => {
      const result = await createBulkAttendance([]);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.outcome.kind, 'definite_rejection');
      if (result.outcome.kind === 'definite_rejection') {
        assert.strictEqual(result.outcome.statusCode, 400);
      }
    }
  );
});

test('3. HTTP 502/503/504 classify as ambiguous_failure (gateway_timeout)', async () => {
  for (const status of [502, 503, 504]) {
    await withMockFetch(
      async () => ({
        ok: false,
        status,
        json: async () => ({}),
      }),
      async () => {
        const result = await createBulkAttendance([]);
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.outcome.kind, 'ambiguous_failure');
        if (result.outcome.kind === 'ambiguous_failure') {
          assert.strictEqual(result.outcome.reason, 'gateway_timeout');
          assert.strictEqual(result.outcome.statusCode, status);
          assert.match(result.outcome.error, /timed out/);
        }
      }
    );
  }
});

test('4. Request timeout aborts and classifies as client_timeout', async () => {
  await withMockFetch(
    async (_url: string, init?: any) => {
      // Simulate hanging network that honors signal abortion
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        }
      });
    },
    async () => {
      // Pass a very short timeout for deterministic test execution
      const result = await createBulkAttendance([], { timeoutMs: 20 });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.outcome.kind, 'ambiguous_failure');
      if (result.outcome.kind === 'ambiguous_failure') {
        assert.strictEqual(result.outcome.reason, 'client_timeout');
        assert.match(result.outcome.error, /Request timed out/);
      }
    }
  );
});

test('5. Network transport failure classifies as transport_error', async () => {
  await withMockFetch(
    async () => {
      throw new TypeError('Network request failed');
    },
    async () => {
      const result = await createBulkAttendance([]);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.outcome.kind, 'ambiguous_failure');
      if (result.outcome.kind === 'ambiguous_failure') {
        assert.strictEqual(result.outcome.reason, 'transport_error');
        assert.match(result.outcome.error, /Network/);
      }
    }
  );
});

test('6. Malformed JSON after HTTP 200 classifies as malformed_response', async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }),
    async () => {
      const result = await createBulkAttendance([]);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.outcome.kind, 'ambiguous_failure');
      if (result.outcome.kind === 'ambiguous_failure') {
        assert.strictEqual(result.outcome.reason, 'malformed_response');
        assert.strictEqual(result.outcome.statusCode, 200);
        assert.match(result.outcome.error, /confirmation response could not be read/);
      }
    }
  );
});

test('7. Form state is preserved on failure and reset only on verified success', () => {
  let formState = {
    Physiology: { present: 2, absent: 1, absent_reasons: ['Sick'] },
  };

  const resetForm = () => {
    formState = {
      Physiology: { present: 0, absent: 0, absent_reasons: [] },
    };
  };

  const controller = new SubmissionSafetyController();
  const signature = 'sig_1';

  // 1. Ambiguous failure: form state must NOT reset
  controller.handleOutcome(
    signature,
    { kind: 'ambiguous_failure', error: 'Timeout', reason: 'client_timeout' },
    {
      onSuccess: resetForm,
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(formState.Physiology.present, 2, 'Form values must be preserved on ambiguous failure');

  // 2. Definite rejection: form state must NOT reset
  controller.handleOutcome(
    signature,
    { kind: 'definite_rejection', error: 'Invalid input', statusCode: 422 },
    {
      onSuccess: resetForm,
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(formState.Physiology.present, 2, 'Form values must be preserved on rejection');

  // 3. Success: form state resets
  controller.handleOutcome(
    signature,
    { kind: 'success', inserted: 3 },
    {
      onSuccess: resetForm,
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(formState.Physiology.present, 0, 'Form values must reset upon verified success');
});

test('8. No success invalidation occurs after an ambiguous or rejected outcome', () => {
  resetAttendanceEventBusForTesting(0);
  assert.strictEqual(getAttendanceVersion(), 0);

  const controller = new SubmissionSafetyController();
  const signature = 'sig_test_version';

  // Ambiguous outcome
  controller.handleOutcome(
    signature,
    { kind: 'ambiguous_failure', error: '504 Gateway Timeout', reason: 'gateway_timeout', statusCode: 504 },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(getAttendanceVersion(), 0, 'Version must not increment on ambiguous outcome');

  // Definite rejection outcome
  controller.handleOutcome(
    signature,
    { kind: 'definite_rejection', error: 'Validation Error', statusCode: 400 },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(getAttendanceVersion(), 0, 'Version must not increment on definite rejection');

  // Verified success outcome
  controller.handleOutcome(
    signature,
    { kind: 'success', inserted: 3 },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(getAttendanceVersion(), 1, 'Version must increment strictly on verified success');
});

test('9. Identical resubmission after ambiguity requires confirmation', () => {
  const controller = new SubmissionSafetyController();

  const rows: AttendanceSubmissionRow[] = [
    { date: '2026-10-24', mode: 'subject', subject: 'Anatomy', present: 1, absent: 0 },
  ];
  const signature = computeSubmissionSignature('2026-10-24', rows);

  // Before any submission, no confirmation is required
  assert.strictEqual(controller.shouldPromptConfirmation(signature), false);

  // First submission fails ambiguously (e.g. timeout)
  controller.handleOutcome(
    signature,
    { kind: 'ambiguous_failure', error: 'Timeout', reason: 'client_timeout' },
    {
      onSuccess: () => {},
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );

  // User attempts to submit the identical payload again
  assert.strictEqual(controller.shouldPromptConfirmation(signature), true, 'Identical retry must prompt confirmation');
});

test('10. Materially changed payload is not blocked by previous ambiguous warning', () => {
  const controller = new SubmissionSafetyController();

  const rows1: AttendanceSubmissionRow[] = [
    { date: '2026-10-24', mode: 'subject', subject: 'Anatomy', present: 1, absent: 0 },
  ];
  const signature1 = computeSubmissionSignature('2026-10-24', rows1);

  // Ambiguous failure on payload 1
  controller.handleOutcome(
    signature1,
    { kind: 'ambiguous_failure', error: 'Timeout', reason: 'client_timeout' },
    {
      onSuccess: () => {},
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );

  // User alters count for Anatomy from 1 to 2
  const rows2: AttendanceSubmissionRow[] = [
    { date: '2026-10-24', mode: 'subject', subject: 'Anatomy', present: 2, absent: 0 },
  ];
  const signature2 = computeSubmissionSignature('2026-10-24', rows2);

  assert.notStrictEqual(signature1, signature2, 'Signatures must differ when counts change');
  assert.strictEqual(controller.shouldPromptConfirmation(signature2), false, 'Changed payload must not be blocked');

  // User alters absent reason
  const rows3: AttendanceSubmissionRow[] = [
    { date: '2026-10-24', mode: 'subject', subject: 'Anatomy', present: 1, absent: 1, absent_reasons: ['Sick'] },
  ];
  const signature3 = computeSubmissionSignature('2026-10-24', rows3);
  assert.strictEqual(controller.shouldPromptConfirmation(signature3), false, 'Reason changes must not be blocked');

  // User alters calendar date
  const signature4 = computeSubmissionSignature('2026-10-25', rows1);
  assert.strictEqual(controller.shouldPromptConfirmation(signature4), false, 'Date changes must not be blocked');
});

test('11. Successful confirmed retry clears ambiguous state and triggers success path', () => {
  const controller = new SubmissionSafetyController();
  resetAttendanceEventBusForTesting(0);

  const rows: AttendanceSubmissionRow[] = [
    { date: '2026-10-24', mode: 'subject', subject: 'Physiology', present: 3, absent: 0 },
  ];
  const signature = computeSubmissionSignature('2026-10-24', rows);

  // 1. Initial attempt fails ambiguously
  controller.handleOutcome(
    signature,
    { kind: 'ambiguous_failure', error: '504 Gateway Timeout', reason: 'gateway_timeout' },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );
  assert.strictEqual(controller.shouldPromptConfirmation(signature), true);
  assert.strictEqual(getAttendanceVersion(), 0);

  // 2. User confirms "Submit Anyway" and retry succeeds
  controller.handleOutcome(
    signature,
    { kind: 'success', inserted: 3 },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );

  // Ambiguous state cleared
  assert.strictEqual(controller.shouldPromptConfirmation(signature), false, 'Ambiguous signature must clear on success');
  assert.strictEqual(controller.getLastAmbiguousSignature(), null);
  assert.strictEqual(getAttendanceVersion(), 1, 'Version must increment on successful confirmed retry');
});

test('12. Existing cross-tab refresh coordinator remains completely intact with safety flow', async () => {
  resetAttendanceEventBusForTesting(0);

  let homeRefreshed = 0;
  const homeCoordinator = createFocusRefreshCoordinator({
    onRefresh: () => {
      homeRefreshed += 1;
    },
  });

  const controller = new SubmissionSafetyController();
  const signature = 'sig_cross_tab';

  // 1. Ambiguous failure -> Home focus must NOT refresh
  controller.handleOutcome(
    signature,
    { kind: 'ambiguous_failure', error: 'Transport drop', reason: 'transport_error' },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );

  const homeRefreshedAfterAmbiguous = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(homeRefreshedAfterAmbiguous, false, 'Home must not refresh after ambiguous failure');
  assert.strictEqual(homeRefreshed, 0);

  // 2. Confirmed retry succeeds -> Home focus refreshes
  controller.handleOutcome(
    signature,
    { kind: 'success', inserted: 2 },
    {
      onSuccess: () => notifyAttendanceMutation(),
      onDefiniteRejection: () => {},
      onAmbiguousFailure: () => {},
    }
  );

  const homeRefreshedAfterSuccess = await homeCoordinator.checkAndRefresh();
  assert.strictEqual(homeRefreshedAfterSuccess, true, 'Home must refresh after confirmed success');
  assert.strictEqual(homeRefreshed, 1);
});
