/**
 * Home Screen Intelligence Integration Tests
 *
 * Verifies:
 * 1. Subject intelligence badge states (no_data, safe to miss N, on boundary, need N classes, unreachable, overflow, invalid).
 * 2. Target adjustment controls (60-95% range, integer steps, boundary limits).
 * 3. Reset to default (75%) behavior.
 * 4. Transparent storage failure handling (preventing false success states).
 * 5. Explicit no-data (null) vs genuine 0% attendance differentiation.
 * 6. Subject selection and active sheet resolution coherence.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  MIN_TARGET_PERCENTAGE,
  MAX_TARGET_PERCENTAGE,
  DEFAULT_TARGET_PERCENTAGE,
  CANONICAL_SUBJECTS,
  type SubjectIntelligenceItem,
} from '../types/attendanceIntelligence.ts';

import {
  resolveBadgeDisplay,
} from '../utils/badgePolicy.ts';

import {
  generateAttendanceProjections,
} from '../utils/attendanceIntelligence.ts';

import {
  mergeCumulativeSubjects,
  validateTargetPercentage,
} from '../utils/targetPolicy.ts';

import {
  saveSubjectTarget,
  removeSubjectTarget,
  getStoredTargets,
  type StorageAdapter,
} from '../services/attendance/targetStorage.ts';

// Helper to create an in-memory mock storage
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

// Helper to create a failing mock storage
function createFailingStorage(): StorageAdapter {
  return {
    getItem: async () => {
      throw new Error('Disk read I/O error');
    },
    setItem: async () => {
      throw new Error('Disk write I/O error');
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Badge Display Mapping: All States and Exceptional Cases
// ---------------------------------------------------------------------------
test('Badge state: resolves "No data" (neutral) when subject has no logged records', () => {
  const projections = generateAttendanceProjections(0, 0, 75);
  const badge = resolveBadgeDisplay({
    hasData: false,
    currentStatus: 'no_data',
    projections,
  });

  assert.strictEqual(badge.label, 'No data');
  assert.strictEqual(badge.tone, 'neutral');
});

test('Badge state: resolves "Safe to miss N" (success) when target met with positive buffer', () => {
  // 18 / 20 = 90% attendance, target 75%
  // 18 / (20 + S) >= 0.75 => 20 + S <= 24 => S <= 4
  const projections = generateAttendanceProjections(18, 20, 75);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'target_met',
    projections,
  });

  assert.strictEqual(badge.label, 'Safe to miss 4');
  assert.strictEqual(badge.tone, 'success');
});

test('Badge state: resolves "Safe to miss 1" (success) when exactly 1 class can be missed', () => {
  // 16 / 20 = 80%, target 75%
  // 16 / 21 = 76.19% >= 75%; 16 / 22 = 72.7% < 75% => safe to miss 1
  const projections = generateAttendanceProjections(16, 20, 75);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'target_met',
    projections,
  });

  assert.strictEqual(badge.label, 'Safe to miss 1');
  assert.strictEqual(badge.tone, 'success');
});

test('Badge state: resolves "On boundary" (warning) when target met with 0 skip budget', () => {
  // 15 / 20 = 75.0%, target 75%
  // Missing 1 class gives 15 / 21 = 71.4% < 75% => safe to miss 0
  const projections = generateAttendanceProjections(15, 20, 75);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'target_met',
    projections,
  });

  assert.strictEqual(badge.label, 'On boundary');
  assert.strictEqual(badge.tone, 'warning');
});

test('Badge state: resolves "Need N classes" (danger) with correct pluralization for N > 1', () => {
  // 14 / 20 = 70.0%, target 75%
  // Attend 4 more: 18 / 24 = 75.0%
  const projections = generateAttendanceProjections(14, 20, 75);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'below_target',
    projections,
  });

  assert.strictEqual(badge.label, 'Need 4 classes');
  assert.strictEqual(badge.tone, 'danger');
});

test('Badge state: resolves "Need 1 class" (danger) with singular noun when N === 1', () => {
  // 14 / 19 = 73.68%, target 75%
  // Attend 1 more: 15 / 20 = 75.0%
  const projections = generateAttendanceProjections(14, 19, 75);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'below_target',
    projections,
  });

  assert.strictEqual(badge.label, 'Need 1 class');
  assert.strictEqual(badge.tone, 'danger');
});

test('Badge state: resolves "Unreachable" (danger) when target cannot be reached', () => {
  // 0 / 10 = 0%, target 100% -> cannot reach 100% since missed classes cannot be undone
  const projections = generateAttendanceProjections(0, 10, 100);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'below_target',
    projections,
  });

  assert.strictEqual(badge.label, 'Unreachable');
  assert.strictEqual(badge.tone, 'danger');
});

test('Badge state: resolves "Out of range" (danger) on classes-required overflow status', () => {
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'below_target',
    projections: {
      summary: { total: 10, attended: 1, missed: 9, percentage: 10, hasData: true, status: 'below_target', target: 99 },
      requiredToTarget: {
        status: 'overflow',
        required: Infinity,
        isAchievable: false,
        target: 99,
        currentPercentage: 10,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: 'Calculation exceeds safe limits.',
      },
      safeToMiss: {
        status: 'below_target',
        safeToMiss: 0,
        target: 99,
        currentPercentage: 10,
        projectedPercentage: null,
        projectedAttended: 1,
        projectedTotal: 10,
        explanation: 'Below target.',
      },
    },
  });

  assert.strictEqual(badge.label, 'Out of range');
  assert.strictEqual(badge.tone, 'danger');
});

test('Badge state: resolves "Out of range" (success) on safe-to-miss overflow status', () => {
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'target_met',
    projections: {
      summary: { total: 10, attended: 10, missed: 0, percentage: 100, hasData: true, status: 'target_met', target: 0 },
      requiredToTarget: {
        status: 'target_met',
        required: 0,
        isAchievable: true,
        target: 0,
        currentPercentage: 100,
        projectedPercentage: 100,
        projectedAttended: 10,
        projectedTotal: 10,
        explanation: 'Target met.',
      },
      safeToMiss: {
        status: 'overflow',
        safeToMiss: Infinity,
        target: 0,
        currentPercentage: 100,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: 'Target of 0% allows missing more classes than representable.',
      },
    },
  });

  assert.strictEqual(badge.label, 'Out of range');
  assert.strictEqual(badge.tone, 'success');
});

test('Badge state: resolves "Unlimited" (success) when target is 0%', () => {
  const projections = generateAttendanceProjections(5, 10, 0);
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'target_met',
    projections,
  });

  assert.strictEqual(badge.label, 'Unlimited');
  assert.strictEqual(badge.tone, 'success');
});

test('Badge state: resolves "Invalid data" (danger) on malformed attendance input', () => {
  const badge = resolveBadgeDisplay({
    hasData: true,
    currentStatus: 'invalid_input',
    projections: {
      summary: { total: 10, attended: 12, missed: 0, percentage: null, hasData: true, status: 'invalid_input', target: 75 },
      requiredToTarget: {
        status: 'invalid_input',
        required: 0,
        isAchievable: false,
        target: 75,
        currentPercentage: null,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: 'Invalid input.',
      },
      safeToMiss: {
        status: 'invalid_input',
        safeToMiss: 0,
        target: 75,
        currentPercentage: null,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: 'Invalid input.',
      },
    },
  });

  assert.strictEqual(badge.label, 'Invalid data');
  assert.strictEqual(badge.tone, 'danger');
});

// ---------------------------------------------------------------------------
// 2. Target Adjustment and Reset Behavior
// ---------------------------------------------------------------------------
test('Target adjustment: strictly enforces [60..95] bounds in integer steps', async () => {
  const storage = createMockStorage();

  // Valid adjustment to 80%
  const ok80 = await saveSubjectTarget('Physiology', 80, storage);
  assert.strictEqual(ok80, true);

  // Boundary min 60%
  const ok60 = await saveSubjectTarget('Physiology', 60, storage);
  assert.strictEqual(ok60, true);

  // Boundary max 95%
  const ok95 = await saveSubjectTarget('Physiology', 95, storage);
  assert.strictEqual(ok95, true);

  // Below min 59% -> rejected
  const ok59 = await saveSubjectTarget('Physiology', 59, storage);
  assert.strictEqual(ok59, false);

  // Above max 96% -> rejected
  const ok96 = await saveSubjectTarget('Physiology', 96, storage);
  assert.strictEqual(ok96, false);

  // Non-integer -> rejected
  const okFloat = await saveSubjectTarget('Physiology', 75.5, storage);
  assert.strictEqual(okFloat, false);

  const targets = await getStoredTargets(storage);
  assert.strictEqual(targets['Physiology'], 95);
});

test('Target reset: resets customized subject back to default 75%', async () => {
  const storage = createMockStorage();

  await saveSubjectTarget('Anatomy', 85, storage);
  let targets = await getStoredTargets(storage);
  assert.strictEqual(targets['Anatomy'], 85);

  const resetOk = await removeSubjectTarget('Anatomy', storage);
  assert.strictEqual(resetOk, true);

  targets = await getStoredTargets(storage);
  assert.strictEqual('Anatomy' in targets, false);

  // When merged with cumulative data, Anatomy now uses default 75%
  const merged = mergeCumulativeSubjects(
    [{ subject: 'Anatomy', present: 8, total: 10 }],
    targets
  );
  const anatomyItem = merged.subjects.find((s) => s.subject === 'Anatomy');
  assert.ok(anatomyItem);
  assert.strictEqual(anatomyItem.target, DEFAULT_TARGET_PERCENTAGE);
  assert.strictEqual(anatomyItem.isCustomTarget, false);
});

// ---------------------------------------------------------------------------
// 3. Storage Failure Transparency: Honest Error Reporting
// ---------------------------------------------------------------------------
test('Storage failure: saveSubjectTarget returns false on storage write errors without false success', async () => {
  const failingStorage = createFailingStorage();

  const saved = await saveSubjectTarget('Samhita', 80, failingStorage);
  assert.strictEqual(saved, false, 'Expected saveSubjectTarget to return false when storage fails');
});

test('Storage failure: removeSubjectTarget returns false on storage read/write errors', async () => {
  const failingStorage = createFailingStorage();

  const reset = await removeSubjectTarget('Samhita', failingStorage);
  assert.strictEqual(reset, false, 'Expected removeSubjectTarget to return false when storage fails');
});

// ---------------------------------------------------------------------------
// 4. No-Data (null) vs Genuine 0% Attendance Rendering
// ---------------------------------------------------------------------------
test('No-data vs 0%: unlogged subject displays null percentage, while 0/5 displays 0%', () => {
  const apiData = [
    { subject: 'Physiology', present: 0, total: 5 }, // genuine 0%
    // 'Anatomy' omitted -> unlogged
  ];

  const merged = mergeCumulativeSubjects(apiData, {});

  const physio = merged.subjects.find((s) => s.subject === 'Physiology');
  const anatomy = merged.subjects.find((s) => s.subject === 'Anatomy');

  assert.ok(physio);
  assert.ok(anatomy);

  // Physiology: 0/5 = genuine 0%
  assert.strictEqual(physio.total, 5);
  assert.strictEqual(physio.present, 0);
  assert.strictEqual(physio.hasData, true);
  assert.strictEqual(physio.percentage, 0);
  assert.strictEqual(physio.currentStatus, 'below_target');
  const physioBadge = resolveBadgeDisplay(physio);
  assert.strictEqual(physioBadge.label, 'Need 15 classes');

  // Anatomy: unlogged = no data
  assert.strictEqual(anatomy.total, 0);
  assert.strictEqual(anatomy.present, 0);
  assert.strictEqual(anatomy.hasData, false);
  assert.strictEqual(anatomy.percentage, null);
  assert.strictEqual(anatomy.currentStatus, 'no_data');
  const anatomyBadge = resolveBadgeDisplay(anatomy);
  assert.strictEqual(anatomyBadge.label, 'No data');
});

test('Overall no-data vs genuine 0%: differentiates overall null from overall 0%', () => {
  // Case A: completely empty records
  const emptyMerged = mergeCumulativeSubjects([], {});
  assert.strictEqual(emptyMerged.overall.hasData, false);
  assert.strictEqual(emptyMerged.overall.percentage, null);
  assert.strictEqual(emptyMerged.overall.currentStatus, 'no_data');

  // Case B: 0 total presents across 8 classes
  const zeroMerged = mergeCumulativeSubjects([{ subject: 'Physiology', present: 0, total: 8 }], {});
  assert.strictEqual(zeroMerged.overall.hasData, true);
  assert.strictEqual(zeroMerged.overall.percentage, 0);
  assert.strictEqual(zeroMerged.overall.currentStatus, 'below_target');
});

// ---------------------------------------------------------------------------
// 5. Subject Selection & Coherence with Active Detail Sheet
// ---------------------------------------------------------------------------
test('Subject selection: resolves active subject and recalculates upon target update without desync', () => {
  const apiData = [
    { subject: 'Physiology', present: 15, total: 20 }, // 75.0%
  ];

  // Initial target: 75% -> on boundary
  let targets: Record<string, number> = {};
  let merged = mergeCumulativeSubjects(apiData, targets);

  let selectedSubject = merged.subjects.find((s) => s.subject === 'Physiology');
  assert.ok(selectedSubject);
  assert.strictEqual(selectedSubject.target, 75);
  assert.strictEqual(selectedSubject.currentStatus, 'target_met');
  assert.strictEqual(resolveBadgeDisplay(selectedSubject).label, 'On boundary');

  // User increases target to 80% via detail sheet
  targets = { ...targets, Physiology: 80 };
  merged = mergeCumulativeSubjects(apiData, targets);

  selectedSubject = merged.subjects.find((s) => s.subject === 'Physiology');
  assert.ok(selectedSubject);
  assert.strictEqual(selectedSubject.target, 80);
  assert.strictEqual(selectedSubject.isCustomTarget, true);
  // At 80% target, 15/20 (75%) is below target: needs 5 classes
  assert.strictEqual(selectedSubject.currentStatus, 'below_target');
  assert.strictEqual(resolveBadgeDisplay(selectedSubject).label, 'Need 5 classes');

  // User decreases target to 70% via detail sheet
  targets = { ...targets, Physiology: 70 };
  merged = mergeCumulativeSubjects(apiData, targets);

  selectedSubject = merged.subjects.find((s) => s.subject === 'Physiology');
  assert.ok(selectedSubject);
  assert.strictEqual(selectedSubject.target, 70);
  // At 70% target, 15/20 (75%) has buffer: safe to miss 1 class (15/21 = 71.4%)
  assert.strictEqual(selectedSubject.currentStatus, 'target_met');
  assert.strictEqual(resolveBadgeDisplay(selectedSubject).label, 'Safe to miss 1');
});
