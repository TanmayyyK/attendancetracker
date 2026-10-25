/**
 * Attendance Intelligence Integration Tests
 *
 * Verifies:
 * 1. Canonical subject list merging (order, zero-data representation, and custom subject retention).
 * 2. Weighted overall attendance calculations (avoiding arithmetic mean averaging).
 * 3. Overall no-data representation (null vs genuine 0%).
 * 4. API failures (null) vs genuine empty responses ([]).
 * 5. Isolation of corrupt/invalid API records.
 * 6. Target range validation (60-95% safe integer range).
 * 7. Storage persistence, reset, and corruption resilience.
 * 8. Separation of current status from projection statuses.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  CANONICAL_SUBJECTS,
  DEFAULT_TARGET_PERCENTAGE,
  MIN_TARGET_PERCENTAGE,
  MAX_TARGET_PERCENTAGE,
} from '../types/attendanceIntelligence.ts';

import {
  validateTargetPercentage,
  sanitizeStoredTargets,
  mergeCumulativeSubjects,
  TARGET_STORAGE_KEY,
} from '../utils/targetPolicy.ts';

import {
  getStoredTargets,
  saveSubjectTarget,
  removeSubjectTarget,
  clearAllSubjectTargets,
  type StorageAdapter,
} from '../services/attendance/targetStorage.ts';

// Helper: in-memory mock storage adapter for deterministic, isolated testing
function createMockStorage(initialData: Record<string, string> = {}): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Canonical Subject Merging on Empty API Response
// ---------------------------------------------------------------------------
test('Canonical merge: includes all 5 canonical subjects in exact order on empty API response', () => {
  const result = mergeCumulativeSubjects([], {});

  assert.strictEqual(result.isApiError, false);
  assert.strictEqual(result.isEmptyDataset, true);
  assert.strictEqual(result.subjects.length, 5);

  // Verify exact order and zero-data state
  CANONICAL_SUBJECTS.forEach((expectedName, index) => {
    const item = result.subjects[index];
    assert.strictEqual(item.subject, expectedName);
    assert.strictEqual(item.isCanonical, true);
    assert.strictEqual(item.present, 0);
    assert.strictEqual(item.total, 0);
    assert.strictEqual(item.missed, 0);
    assert.strictEqual(item.percentage, null); // Must be null, never 0%
    assert.strictEqual(item.hasData, false);
    assert.strictEqual(item.target, DEFAULT_TARGET_PERCENTAGE);
    assert.strictEqual(item.currentStatus, 'no_data');
    assert.strictEqual(item.projections.requiredToTarget.status, 'no_data');
    assert.strictEqual(item.projections.safeToMiss.status, 'no_data');
  });

  // Overall attendance must represent no-data as null
  assert.strictEqual(result.overall.total, 0);
  assert.strictEqual(result.overall.present, 0);
  assert.strictEqual(result.overall.percentage, null);
  assert.strictEqual(result.overall.hasData, false);
  assert.strictEqual(result.overall.currentStatus, 'no_data');
});

// ---------------------------------------------------------------------------
// 2. Canonical Merging with Partial Data
// ---------------------------------------------------------------------------
test('Canonical merge: preserves API counts for logged subjects and fills unlogged canonical subjects', () => {
  const apiRecords = [
    { subject: 'Physiology', present: 16, total: 20 },
    { subject: 'Anatomy', present: 8, total: 10 },
  ];

  const result = mergeCumulativeSubjects(apiRecords, { Anatomy: 85 });

  assert.strictEqual(result.isApiError, false);
  assert.strictEqual(result.isEmptyDataset, false);
  assert.strictEqual(result.subjects.length, 5);

  // 1. Physiology (logged, default 75% target)
  const physio = result.subjects[0];
  assert.strictEqual(physio.subject, 'Physiology');
  assert.strictEqual(physio.present, 16);
  assert.strictEqual(physio.total, 20);
  assert.strictEqual(physio.percentage, 80);
  assert.strictEqual(physio.hasData, true);
  assert.strictEqual(physio.target, 75);
  assert.strictEqual(physio.isCustomTarget, false);
  assert.strictEqual(physio.currentStatus, 'target_met');
  assert.strictEqual(physio.projections.safeToMiss.safeToMiss, 1);

  // 2. Anatomy (logged, custom 85% target)
  const anatomy = result.subjects[1];
  assert.strictEqual(anatomy.subject, 'Anatomy');
  assert.strictEqual(anatomy.present, 8);
  assert.strictEqual(anatomy.total, 10);
  assert.strictEqual(anatomy.percentage, 80);
  assert.strictEqual(anatomy.target, 85);
  assert.strictEqual(anatomy.isCustomTarget, true);
  assert.strictEqual(anatomy.currentStatus, 'below_target');
  assert.strictEqual(anatomy.projections.requiredToTarget.status, 'achievable');
  assert.strictEqual(anatomy.projections.requiredToTarget.required, 4);

  // 3, 4, 5. Unlogged canonical subjects: Samhita, Padarth Vigyan, Sanskrit
  const unlogged = result.subjects.slice(2);
  assert.strictEqual(unlogged.length, 3);
  unlogged.forEach((item) => {
    assert.strictEqual(item.present, 0);
    assert.strictEqual(item.total, 0);
    assert.strictEqual(item.percentage, null);
    assert.strictEqual(item.hasData, false);
    assert.strictEqual(item.currentStatus, 'no_data');
  });
});

// ---------------------------------------------------------------------------
// 3. Unexpected / Custom / Legacy Subjects Retention
// ---------------------------------------------------------------------------
test('Canonical merge: preserves and appends non-canonical subjects at the tail without data loss', () => {
  const apiRecords = [
    { subject: 'Physiology', present: 10, total: 10 },
    { subject: 'Biochemistry', present: 7, total: 10 }, // Custom
    { subject: 'Clinical Rotations', present: 18, total: 20 }, // Custom
  ];

  const result = mergeCumulativeSubjects(apiRecords, { Biochemistry: 80 });

  // 5 canonical + 2 custom = 7 subjects
  assert.strictEqual(result.subjects.length, 7);

  // Canonical first
  assert.strictEqual(result.subjects[0].subject, 'Physiology');
  assert.strictEqual(result.subjects[0].isCanonical, true);
  assert.strictEqual(result.subjects[1].subject, 'Anatomy');
  assert.strictEqual(result.subjects[1].isCanonical, true);
  assert.strictEqual(result.subjects[4].subject, 'Sanskrit (CM Sir)');
  assert.strictEqual(result.subjects[4].isCanonical, true);

  // Custom at the tail
  const biochem = result.subjects[5];
  assert.strictEqual(biochem.subject, 'Biochemistry');
  assert.strictEqual(biochem.isCanonical, false);
  assert.strictEqual(biochem.present, 7);
  assert.strictEqual(biochem.total, 10);
  assert.strictEqual(biochem.target, 80);
  assert.strictEqual(biochem.isCustomTarget, true);
  assert.strictEqual(biochem.currentStatus, 'below_target');

  const clinical = result.subjects[6];
  assert.strictEqual(clinical.subject, 'Clinical Rotations');
  assert.strictEqual(clinical.isCanonical, false);
  assert.strictEqual(clinical.present, 18);
  assert.strictEqual(clinical.total, 20);
  assert.strictEqual(clinical.target, 75);
});

// ---------------------------------------------------------------------------
// 4. Weighted Overall Attendance vs Unweighted Averaging
// ---------------------------------------------------------------------------
test('Weighted overall: calculates exact weighted percentage rather than unweighted mean', () => {
  // Scenario:
  // Subject 1: 1 present / 1 total = 100.0%
  // Subject 2: 9 present / 19 total = 47.368%
  // Weighted: (1 + 9) / (1 + 19) = 10 / 20 = 50.0%
  // Unweighted mean would falsely report (100 + 47.368) / 2 = 73.68%
  const apiRecords = [
    { subject: 'Physiology', present: 1, total: 1 },
    { subject: 'Anatomy', present: 9, total: 19 },
  ];

  const result = mergeCumulativeSubjects(apiRecords);

  assert.strictEqual(result.overall.present, 10);
  assert.strictEqual(result.overall.total, 20);
  assert.strictEqual(result.overall.absent, 10);
  assert.strictEqual(result.overall.percentage, 50); // Exactly 50.0%
  assert.strictEqual(result.overall.currentStatus, 'below_target');
  assert.strictEqual(result.overall.projections.requiredToTarget.required, 20);
});

// ---------------------------------------------------------------------------
// 5. Overall No-Data Representation (null vs genuine 0%)
// ---------------------------------------------------------------------------
test('Overall no-data: distinguishes total === 0 (null) from genuine 0% attendance', () => {
  // Case A: Zero classes logged
  const zeroClassesResult = mergeCumulativeSubjects([]);
  assert.strictEqual(zeroClassesResult.overall.total, 0);
  assert.strictEqual(zeroClassesResult.overall.present, 0);
  assert.strictEqual(zeroClassesResult.overall.percentage, null);
  assert.strictEqual(zeroClassesResult.overall.hasData, false);
  assert.strictEqual(zeroClassesResult.overall.currentStatus, 'no_data');

  // Case B: Logged classes exist, but zero attended (genuine 0%)
  const zeroAttendedResult = mergeCumulativeSubjects([
    { subject: 'Physiology', present: 0, total: 10 },
  ]);
  assert.strictEqual(zeroAttendedResult.overall.total, 10);
  assert.strictEqual(zeroAttendedResult.overall.present, 0);
  assert.strictEqual(zeroAttendedResult.overall.absent, 10);
  assert.strictEqual(zeroAttendedResult.overall.percentage, 0); // Numeric 0%, NOT null
  assert.strictEqual(zeroAttendedResult.overall.hasData, true);
  assert.strictEqual(zeroAttendedResult.overall.currentStatus, 'below_target');
});

// ---------------------------------------------------------------------------
// 6. API Failure (null) vs Empty Response ([])
// ---------------------------------------------------------------------------
test('API distinctions: correctly differentiates network failure from empty response', () => {
  const failureResult = mergeCumulativeSubjects(null);
  assert.strictEqual(failureResult.isApiError, true);
  assert.strictEqual(failureResult.isEmptyDataset, false);
  assert.strictEqual(failureResult.overall.percentage, null);

  const emptyResult = mergeCumulativeSubjects([]);
  assert.strictEqual(emptyResult.isApiError, false);
  assert.strictEqual(emptyResult.isEmptyDataset, true);
  assert.strictEqual(emptyResult.subjects.length, 5);
});

// ---------------------------------------------------------------------------
// 7. Isolation of Malformed API Records
// ---------------------------------------------------------------------------
test('API resilience: flags invalid records without corrupting valid subjects or overall totals', () => {
  const recordsWithCorruption = [
    { subject: 'Physiology', present: 15, total: 20 }, // Valid: 15/20 (75%)
    { subject: 'Anatomy', present: 25, total: 20 }, // Corrupted: attended > total
    { subject: 'Samhita', present: -2, total: 10 }, // Corrupted: negative present
  ];

  const result = mergeCumulativeSubjects(recordsWithCorruption);

  // Physiology is unaffected
  const physio = result.subjects.find((s) => s.subject === 'Physiology');
  assert.strictEqual(physio?.currentStatus, 'target_met');
  assert.strictEqual(physio?.percentage, 75);

  // Anatomy and Samhita are flagged invalid
  const anatomy = result.subjects.find((s) => s.subject === 'Anatomy');
  assert.strictEqual(anatomy?.currentStatus, 'invalid_input');
  assert.strictEqual(anatomy?.percentage, null);

  const samhita = result.subjects.find((s) => s.subject === 'Samhita');
  assert.strictEqual(samhita?.currentStatus, 'invalid_input');
  assert.strictEqual(samhita?.percentage, null);

  // Overall attendance only tallies the valid record (15/20 = 75%)
  assert.strictEqual(result.overall.present, 15);
  assert.strictEqual(result.overall.total, 20);
  assert.strictEqual(result.overall.percentage, 75);
});

// ---------------------------------------------------------------------------
// 8. Target Range Validation (60% to 95%)
// ---------------------------------------------------------------------------
test('Target validation: strictly validates integer range 60-95', () => {
  // Valid bounds and interior values
  assert.strictEqual(validateTargetPercentage(60), 60);
  assert.strictEqual(validateTargetPercentage(75), 75);
  assert.strictEqual(validateTargetPercentage(90), 90);
  assert.strictEqual(validateTargetPercentage(95), 95);

  // Out of range (< 60 or > 95)
  assert.strictEqual(validateTargetPercentage(59), null);
  assert.strictEqual(validateTargetPercentage(0), null);
  assert.strictEqual(validateTargetPercentage(-5), null);
  assert.strictEqual(validateTargetPercentage(96), null);
  assert.strictEqual(validateTargetPercentage(100), null);
  assert.strictEqual(validateTargetPercentage(105), null);

  // Fractional, NaN, infinite, and non-numeric values
  assert.strictEqual(validateTargetPercentage(75.5), null);
  assert.strictEqual(validateTargetPercentage(NaN), null);
  assert.strictEqual(validateTargetPercentage(Infinity), null);
  assert.strictEqual(validateTargetPercentage('75'), null);
  assert.strictEqual(validateTargetPercentage(null), null);
  assert.strictEqual(validateTargetPercentage(undefined), null);
});

// ---------------------------------------------------------------------------
// 9. Target Storage Persistence, Reset, and Isolation
// ---------------------------------------------------------------------------
test('Target storage: supports saving, updating, resetting, and clearing targets', async () => {
  const storage = createMockStorage();

  // Initially empty
  const initial = await getStoredTargets(storage);
  assert.deepStrictEqual(initial, {});

  // Save valid target for Anatomy (85%)
  const saveOk1 = await saveSubjectTarget('Anatomy', 85, storage);
  assert.strictEqual(saveOk1, true);

  const after1 = await getStoredTargets(storage);
  assert.strictEqual(after1['Anatomy'], 85);

  // Save valid target for Physiology (90%)
  const saveOk2 = await saveSubjectTarget('Physiology', 90, storage);
  assert.strictEqual(saveOk2, true);

  const after2 = await getStoredTargets(storage);
  assert.strictEqual(after2['Anatomy'], 85);
  assert.strictEqual(after2['Physiology'], 90);

  // Reject invalid target (50%)
  const saveInvalid = await saveSubjectTarget('Samhita', 50, storage);
  assert.strictEqual(saveInvalid, false);
  const afterInvalid = await getStoredTargets(storage);
  assert.strictEqual('Samhita' in afterInvalid, false);

  // Reset Anatomy target (removes key from storage)
  const resetOk = await removeSubjectTarget('Anatomy', storage);
  assert.strictEqual(resetOk, true);
  const afterReset = await getStoredTargets(storage);
  assert.strictEqual('Anatomy' in afterReset, false);
  assert.strictEqual(afterReset['Physiology'], 90);

  // Clear all targets
  const clearOk = await clearAllSubjectTargets(storage);
  assert.strictEqual(clearOk, true);
  const afterClear = await getStoredTargets(storage);
  assert.deepStrictEqual(afterClear, {});
});

// ---------------------------------------------------------------------------
// 10. Corrupt Storage Recovery and Migration Fallback
// ---------------------------------------------------------------------------
test('Target storage: handles corrupt JSON, malformed schema, and invalid entries gracefully', async () => {
  // Case A: Unparseable JSON string in storage
  const brokenStorage = createMockStorage({
    [TARGET_STORAGE_KEY]: '{ unparseable: json [',
  });
  const fromBroken = await getStoredTargets(brokenStorage);
  assert.deepStrictEqual(fromBroken, {});

  // Case B: Schema with invalid types and out-of-range targets
  const corruptPayload = {
    version: 1,
    updatedAt: 'invalid-date',
    targets: {
      Anatomy: 85, // valid
      Physiology: 40, // invalid (< 60)
      Samhita: 'eighty', // invalid type
      'Padarth Vigyan': 105, // invalid (> 95)
      '': 75, // invalid empty subject name
    },
  };
  const sanitized = sanitizeStoredTargets(corruptPayload);
  assert.strictEqual(sanitized.version, 1);
  assert.deepStrictEqual(sanitized.targets, { Anatomy: 85 }); // Only valid retained

  // Case C: Non-object or unrecognized version
  const badVersion = sanitizeStoredTargets({ version: 99, targets: { Anatomy: 85 } });
  assert.deepStrictEqual(badVersion.targets, {});
});

// ---------------------------------------------------------------------------
// 11. Separation of Current Status from Projection Statuses
// ---------------------------------------------------------------------------
test('Status separation: current attendance status remains distinct from projection statuses', () => {
  // Subject below target (14/20 = 70% with target 75%)
  const belowResult = mergeCumulativeSubjects([
    { subject: 'Physiology', present: 14, total: 20 },
  ]);
  const item = belowResult.subjects[0];

  assert.strictEqual(item.currentStatus, 'below_target');
  assert.strictEqual(item.projections.requiredToTarget.status, 'achievable');
  assert.strictEqual(item.projections.safeToMiss.status, 'below_target');

  // Subject at boundary (15/20 = 75% with target 75%)
  const boundaryResult = mergeCumulativeSubjects([
    { subject: 'Physiology', present: 15, total: 20 },
  ]);
  const boundaryItem = boundaryResult.subjects[0];

  assert.strictEqual(boundaryItem.currentStatus, 'target_met');
  assert.strictEqual(boundaryItem.projections.requiredToTarget.status, 'target_met');
  assert.strictEqual(boundaryItem.projections.safeToMiss.status, 'can_miss');
  assert.strictEqual(boundaryItem.projections.safeToMiss.safeToMiss, 0);
});
