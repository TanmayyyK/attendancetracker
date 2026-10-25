/**
 * Attendance Intelligence, Target Projection, and Simulation Foundation
 *
 * Pure, deterministic mathematical calculations for:
 * 1. Subject attendance summary and status classification.
 * 2. Minimum classes required to reach a target attendance percentage.
 * 3. Maximum classes safe to miss while staying at or above a target percentage.
 * 4. What-if projection simulations without state mutation.
 *
 * Has ZERO dependencies on React, native modules, storage, network, or UI.
 */

import { TARGET_ATTENDANCE_PERCENTAGE } from './attendance.ts';

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export type AttendanceTargetStatus = 'no_data' | 'invalid_input' | 'below_target' | 'target_met';

export interface AttendanceSummary {
  total: number;
  attended: number;
  missed: number;
  percentage: number | null; // null when total === 0 to preserve distinction between no data and 0%
  hasData: boolean;
  status: AttendanceTargetStatus;
  target: number;
}

export type ClassesRequiredStatus =
  | 'no_data'
  | 'invalid_input'
  | 'target_met'
  | 'achievable'
  | 'unreachable'
  | 'overflow';

export interface ClassesRequiredResult {
  status: ClassesRequiredStatus;
  required: number;
  isAchievable: boolean;
  target: number;
  currentPercentage: number | null;
  projectedPercentage: number | null;
  projectedAttended: number;
  projectedTotal: number;
  explanation: string;
}

export type SafeToMissStatus =
  | 'no_data'
  | 'invalid_input'
  | 'below_target'
  | 'can_miss'
  | 'unlimited'
  | 'overflow';

export interface SafeToMissResult {
  status: SafeToMissStatus;
  safeToMiss: number;
  target: number;
  currentPercentage: number | null;
  projectedPercentage: number | null;
  projectedAttended: number;
  projectedTotal: number;
  explanation: string;
}

export interface WhatIfSimulationInput {
  currentAttended: number;
  currentTotal: number;
  hypotheticalAttended: number;
  hypotheticalMissed: number;
}

export interface WhatIfSimulationResult {
  isValid: boolean;
  error?: string;
  projectedAttended: number;
  projectedMissed: number;
  projectedTotal: number;
  currentPercentage: number | null;
  projectedPercentage: number | null;
  percentageDelta: number | null;
  hasData: boolean;
}

export interface AttendanceProjection {
  summary: AttendanceSummary;
  requiredToTarget: ClassesRequiredResult;
  safeToMiss: SafeToMissResult;
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

export function isValidClassCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

export function isValidTargetPercentage(target: unknown): target is number {
  return typeof target === 'number' && Number.isFinite(target) && target >= 0 && target <= 100;
}

export function validateAttendanceCounts(attended: unknown, total: unknown): { isValid: boolean; error?: string } {
  if (!isValidClassCount(attended)) {
    return { isValid: false, error: 'Attended classes count must be a non-negative safe integer' };
  }
  if (!isValidClassCount(total)) {
    return { isValid: false, error: 'Total classes count must be a non-negative safe integer' };
  }
  if (attended > total) {
    return { isValid: false, error: `Attended classes (${attended}) cannot exceed total classes (${total})` };
  }
  return { isValid: true };
}

// ---------------------------------------------------------------------------
// Core Pure Calculations
// ---------------------------------------------------------------------------

/**
 * Calculates a structured summary of subject attendance with target evaluation.
 *
 * Explicitly distinguishes zero recorded classes (percentage: null, hasData: false, status: 'no_data')
 * from genuine 0% attendance (attended: 0, total: >0, percentage: 0, status: 'below_target').
 */
export function calculateSubjectSummary(
  attended: number,
  total: number,
  targetPercentage: number = TARGET_ATTENDANCE_PERCENTAGE
): AttendanceSummary {
  const countValidation = validateAttendanceCounts(attended, total);
  if (!countValidation.isValid) {
    return {
      total: isValidClassCount(total) ? total : 0,
      attended: isValidClassCount(attended) ? attended : 0,
      missed: 0,
      percentage: null,
      hasData: false,
      status: 'invalid_input',
      target: isValidTargetPercentage(targetPercentage) ? targetPercentage : TARGET_ATTENDANCE_PERCENTAGE,
    };
  }

  if (!isValidTargetPercentage(targetPercentage)) {
    return {
      total,
      attended,
      missed: total - attended,
      percentage: null,
      hasData: false,
      status: 'invalid_input',
      target: targetPercentage,
    };
  }

  if (total === 0) {
    return {
      total: 0,
      attended: 0,
      missed: 0,
      percentage: null,
      hasData: false,
      status: 'no_data',
      target: targetPercentage,
    };
  }

  const percentage = (attended * 100) / total;
  const isTargetMet = percentage >= targetPercentage;

  return {
    total,
    attended,
    missed: total - attended,
    percentage: Math.max(0, Math.min(100, percentage)),
    hasData: true,
    status: isTargetMet ? 'target_met' : 'below_target',
    target: targetPercentage,
  };
}

/**
 * Calculates the minimum consecutive classes that must be attended to reach target percentage.
 *
 * Mathematical derivation:
 * (attended + x) / (total + x) >= target / 100
 * 100 * (attended + x) >= target * (total + x)
 * (100 - target) * x >= target * total - 100 * attended
 * x >= (target * total - 100 * attended) / (100 - target)
 *
 * Edge cases:
 * - target === 100: If attended < total (missed >= 1 class), target 100% can NEVER be reached.
 * - already met: returns 0.
 * - total === 0: returns no_data.
 */
export function calculateClassesRequired(
  attended: number,
  total: number,
  targetPercentage: number = TARGET_ATTENDANCE_PERCENTAGE
): ClassesRequiredResult {
  const countValidation = validateAttendanceCounts(attended, total);
  if (!countValidation.isValid) {
    return {
      status: 'invalid_input',
      required: 0,
      isAchievable: false,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: countValidation.error || 'Invalid input counts',
    };
  }

  if (!isValidTargetPercentage(targetPercentage)) {
    return {
      status: 'invalid_input',
      required: 0,
      isAchievable: false,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: 'Target percentage must be between 0 and 100',
    };
  }

  if (total === 0) {
    return {
      status: 'no_data',
      required: 0,
      isAchievable: false,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: 'No classes have been logged yet for this subject',
    };
  }

  const currentPct = (attended * 100) / total;

  // Case 1: Target already satisfied
  if (currentPct >= targetPercentage) {
    return {
      status: 'target_met',
      required: 0,
      isAchievable: true,
      target: targetPercentage,
      currentPercentage: currentPct,
      projectedPercentage: currentPct,
      projectedAttended: attended,
      projectedTotal: total,
      explanation: `Target of ${targetPercentage}% is already satisfied (${currentPct.toFixed(1)}%).`,
    };
  }

  // Case 2: Target is 100%, but at least 1 class has already been missed
  if (targetPercentage === 100) {
    return {
      status: 'unreachable',
      required: 0,
      isAchievable: false,
      target: targetPercentage,
      currentPercentage: currentPct,
      projectedPercentage: null,
      projectedAttended: attended,
      projectedTotal: total,
      explanation: `Target of 100% cannot be reached because ${total - attended} class(es) have already been missed.`,
    };
  }

  // Case 3: Calculate required consecutive attendance via bounded binary search
  const maxSafeRequired = Number.MAX_SAFE_INTEGER - total;
  const rawRequired = (targetPercentage * total - 100 * attended) / (100 - targetPercentage);

  if (!Number.isFinite(rawRequired) || rawRequired > maxSafeRequired) {
    if (((attended + maxSafeRequired) * 100) / (total + maxSafeRequired) < targetPercentage) {
      return {
        status: 'overflow',
        required: Infinity,
        isAchievable: false,
        target: targetPercentage,
        currentPercentage: currentPct,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: `Target of ${targetPercentage}% requires more consecutive classes than representable in JavaScript safe integers (exceeds ${Number.MAX_SAFE_INTEGER}).`,
      };
    }
  }

  // Bracket the search interval. Binary search guarantees termination in <= 54 iterations.
  let low = 0;
  let high = Math.min(maxSafeRequired, Math.max(0, Math.ceil(rawRequired) + 10));
  if (((attended + high) * 100) / (total + high) < targetPercentage) {
    high = maxSafeRequired;
    if (((attended + high) * 100) / (total + high) < targetPercentage) {
      return {
        status: 'overflow',
        required: Infinity,
        isAchievable: false,
        target: targetPercentage,
        currentPercentage: currentPct,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: `Target of ${targetPercentage}% requires more consecutive classes than representable in JavaScript safe integers (exceeds ${Number.MAX_SAFE_INTEGER}).`,
      };
    }
  }

  let required = high;
  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2);
    if (((attended + mid) * 100) / (total + mid) >= targetPercentage) {
      required = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  const projectedAttended = attended + required;
  const projectedTotal = total + required;
  const projectedPercentage = (projectedAttended * 100) / projectedTotal;

  return {
    status: 'achievable',
    required,
    isAchievable: true,
    target: targetPercentage,
    currentPercentage: currentPct,
    projectedPercentage,
    projectedAttended,
    projectedTotal,
    explanation: `Attend the next ${required} consecutive class${required === 1 ? '' : 'es'} to reach ${targetPercentage}% (projected: ${projectedPercentage.toFixed(1)}%).`,
  };
}

/**
 * Calculates the maximum consecutive classes that can be missed while keeping attendance >= target.
 *
 * Mathematical derivation:
 * attended / (total + y) >= target / 100
 * 100 * attended >= target * (total + y) = target * total + target * y
 * target * y <= 100 * attended - target * total
 * y <= (100 * attended - target * total) / target
 *
 * Edge cases:
 * - target === 0: Unlimited classes safe to miss (Infinity).
 * - currentPct < target: Already below target; returns 0.
 * - total === 0: returns no_data.
 */
export function calculateSafeToMiss(
  attended: number,
  total: number,
  targetPercentage: number = TARGET_ATTENDANCE_PERCENTAGE
): SafeToMissResult {
  const countValidation = validateAttendanceCounts(attended, total);
  if (!countValidation.isValid) {
    return {
      status: 'invalid_input',
      safeToMiss: 0,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: countValidation.error || 'Invalid input counts',
    };
  }

  if (!isValidTargetPercentage(targetPercentage)) {
    return {
      status: 'invalid_input',
      safeToMiss: 0,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: 'Target percentage must be between 0 and 100',
    };
  }

  if (total === 0) {
    return {
      status: 'no_data',
      safeToMiss: 0,
      target: targetPercentage,
      currentPercentage: null,
      projectedPercentage: null,
      projectedAttended: 0,
      projectedTotal: 0,
      explanation: 'No classes have been logged yet for this subject',
    };
  }

  const currentPct = (attended * 100) / total;

  // Case 1: Target is exactly 0% (any number of classes can be missed)
  if (targetPercentage === 0) {
    return {
      status: 'unlimited',
      safeToMiss: Infinity,
      target: targetPercentage,
      currentPercentage: currentPct,
      projectedPercentage: currentPct,
      projectedAttended: attended,
      projectedTotal: total,
      explanation: 'Target is 0%; any number of classes can be missed without falling below target.',
    };
  }

  // Case 2: Currently below target
  if (currentPct < targetPercentage) {
    return {
      status: 'below_target',
      safeToMiss: 0,
      target: targetPercentage,
      currentPercentage: currentPct,
      projectedPercentage: currentPct,
      projectedAttended: attended,
      projectedTotal: total,
      explanation: `Attendance is currently ${currentPct.toFixed(1)}%, which is below the target of ${targetPercentage}%. Zero classes can be safely missed.`,
    };
  }

  // Case 3: Calculate safe-to-miss count via bounded binary search
  const maxSafeMiss = Number.MAX_SAFE_INTEGER - total;
  const rawSafe = (100 * attended - targetPercentage * total) / targetPercentage;

  if (!Number.isFinite(rawSafe) || rawSafe > maxSafeMiss) {
    if (((attended * 100) / (total + maxSafeMiss)) >= targetPercentage) {
      return {
        status: 'overflow',
        safeToMiss: Infinity,
        target: targetPercentage,
        currentPercentage: currentPct,
        projectedPercentage: null,
        projectedAttended: 0,
        projectedTotal: 0,
        explanation: `Target of ${targetPercentage}% allows missing more consecutive classes than representable in JavaScript safe integers (exceeds ${Number.MAX_SAFE_INTEGER}).`,
      };
    }
  }

  // Bracket the search interval. Binary search guarantees termination in <= 54 iterations.
  let low = 0;
  let high = Math.min(maxSafeMiss, Math.max(0, Math.floor(rawSafe) + 10));

  let safeToMiss = 0;
  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2);
    if (((attended * 100) / (total + mid)) >= targetPercentage) {
      safeToMiss = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const projectedTotal = total + safeToMiss;
  const projectedPercentage = projectedTotal > 0 ? (attended * 100) / projectedTotal : currentPct;

  return {
    status: 'can_miss',
    safeToMiss,
    target: targetPercentage,
    currentPercentage: currentPct,
    projectedPercentage,
    projectedAttended: attended,
    projectedTotal,
    explanation:
      safeToMiss > 0
        ? `You can safely miss up to ${safeToMiss} consecutive class${safeToMiss === 1 ? '' : 'es'} while maintaining at least ${targetPercentage}% (projected: ${projectedPercentage.toFixed(1)}%).`
        : `Attendance is on the boundary of ${targetPercentage}%. Missing the next class will drop attendance below target.`,
  };
}

/**
 * Simulates a hypothetical what-if scenario.
 *
 * Deterministic and immutable: never alters the input record or global state.
 * Strictly validates inputs and rejects invalid numbers rather than silently clamping.
 */
export function simulateAttendanceWhatIf(input: WhatIfSimulationInput): WhatIfSimulationResult {
  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      error: 'Simulation input must be an object',
      projectedAttended: 0,
      projectedMissed: 0,
      projectedTotal: 0,
      currentPercentage: null,
      projectedPercentage: null,
      percentageDelta: null,
      hasData: false,
    };
  }

  const { currentAttended, currentTotal, hypotheticalAttended, hypotheticalMissed } = input;

  const currentCountValidation = validateAttendanceCounts(currentAttended, currentTotal);
  if (!currentCountValidation.isValid) {
    return {
      isValid: false,
      error: currentCountValidation.error,
      projectedAttended: 0,
      projectedMissed: 0,
      projectedTotal: 0,
      currentPercentage: null,
      projectedPercentage: null,
      percentageDelta: null,
      hasData: false,
    };
  }

  if (!isValidClassCount(hypotheticalAttended)) {
    return {
      isValid: false,
      error: 'Hypothetical attended classes must be a non-negative safe integer',
      projectedAttended: 0,
      projectedMissed: 0,
      projectedTotal: 0,
      currentPercentage: null,
      projectedPercentage: null,
      percentageDelta: null,
      hasData: false,
    };
  }

  if (!isValidClassCount(hypotheticalMissed)) {
    return {
      isValid: false,
      error: 'Hypothetical missed classes must be a non-negative safe integer',
      projectedAttended: 0,
      projectedMissed: 0,
      projectedTotal: 0,
      currentPercentage: null,
      projectedPercentage: null,
      percentageDelta: null,
      hasData: false,
    };
  }

  const projectedAttended = currentAttended + hypotheticalAttended;
  const currentMissed = currentTotal - currentAttended;
  const projectedMissed = currentMissed + hypotheticalMissed;
  const projectedTotal = currentTotal + hypotheticalAttended + hypotheticalMissed;

  if (!isValidClassCount(projectedAttended) || !isValidClassCount(projectedTotal)) {
    return {
      isValid: false,
      error: 'Projected class counts exceed the maximum safe integer limit',
      projectedAttended: 0,
      projectedMissed: 0,
      projectedTotal: 0,
      currentPercentage: null,
      projectedPercentage: null,
      percentageDelta: null,
      hasData: false,
    };
  }

  const currentPercentage = currentTotal > 0 ? (currentAttended * 100) / currentTotal : null;
  const projectedPercentage = projectedTotal > 0 ? (projectedAttended * 100) / projectedTotal : null;

  const percentageDelta =
    projectedPercentage !== null && currentPercentage !== null
      ? projectedPercentage - currentPercentage
      : null;

  return {
    isValid: true,
    projectedAttended,
    projectedMissed,
    projectedTotal,
    currentPercentage,
    projectedPercentage,
    percentageDelta,
    hasData: projectedTotal > 0,
  };
}

/**
 * Unified projection helper calculating summary, required-to-target, and safe-to-miss.
 */
export function generateAttendanceProjections(
  attended: number,
  total: number,
  targetPercentage: number = TARGET_ATTENDANCE_PERCENTAGE
): AttendanceProjection {
  return {
    summary: calculateSubjectSummary(attended, total, targetPercentage),
    requiredToTarget: calculateClassesRequired(attended, total, targetPercentage),
    safeToMiss: calculateSafeToMiss(attended, total, targetPercentage),
  };
}
