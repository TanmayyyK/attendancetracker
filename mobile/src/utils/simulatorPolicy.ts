/**
 * What-If Simulation Policy and Projection Model
 *
 * Implements pure deterministic what-if attendance projection logic for a single subject:
 * 1. Simulates future attended and missed classes using simulateAttendanceWhatIf.
 * 2. Evaluates projected attendance against the subject's target (default 75% or custom override).
 * 3. Derives required-to-target or safe-to-miss counts under the hypothetical scenario.
 * 4. Immutable: never modifies original attendance records or stored subject targets.
 *
 * Has ZERO dependencies on React, React Native, or storage for 100% Node testability.
 */

import {
  simulateAttendanceWhatIf,
  generateAttendanceProjections,
} from './attendanceIntelligence.ts';
import {
  DEFAULT_TARGET_PERCENTAGE,
  type SubjectIntelligenceItem,
} from '../types/attendanceIntelligence.ts';

export type SimulatorStatus =
  | 'no_data'
  | 'target_met'
  | 'below_target'
  | 'unreachable'
  | 'overflow'
  | 'invalid_input';

export interface SimulatorProjectionModel {
  isValid: boolean;
  error?: string;
  subjectName: string;
  currentAttended: number;
  currentTotal: number;
  currentPercentage: number | null;
  hasData: boolean;
  target: number;
  isCustomTarget: boolean;
  hypotheticalAttended: number;
  hypotheticalMissed: number;
  projectedAttended: number;
  projectedTotal: number;
  projectedPercentage: number | null;
  percentageDelta: number | null;
  status: SimulatorStatus;
  statusLabel: string;
  statusTone: 'neutral' | 'success' | 'warning' | 'danger';
  explanation: string;
  classesRequired: number;
  safeToMiss: number;
}

export interface CalculateSimulatorParams {
  subject: SubjectIntelligenceItem;
  hypotheticalAttended: number;
  hypotheticalMissed: number;
  targetOverride?: number;
}

/**
 * Calculates what-if projection for a subject with hypothetical attended and missed classes.
 */
export function calculateSimulatorProjection(
  params: CalculateSimulatorParams
): SimulatorProjectionModel {
  const { subject, hypotheticalAttended, hypotheticalMissed, targetOverride } = params;

  const target =
    typeof targetOverride === 'number' &&
    Number.isFinite(targetOverride) &&
    targetOverride >= 0 &&
    targetOverride <= 100
      ? targetOverride
      : (subject?.target ?? DEFAULT_TARGET_PERCENTAGE);

  const isCustomTarget = target !== DEFAULT_TARGET_PERCENTAGE;

  // Validate subject input
  if (!subject || typeof subject !== 'object') {
    return {
      isValid: false,
      error: 'Subject record is required',
      subjectName: '',
      currentAttended: 0,
      currentTotal: 0,
      currentPercentage: null,
      hasData: false,
      target,
      isCustomTarget,
      hypotheticalAttended: 0,
      hypotheticalMissed: 0,
      projectedAttended: 0,
      projectedTotal: 0,
      projectedPercentage: null,
      percentageDelta: null,
      status: 'invalid_input',
      statusLabel: 'Invalid data',
      statusTone: 'danger',
      explanation: 'Subject record is invalid.',
      classesRequired: 0,
      safeToMiss: 0,
    };
  }

  const simResult = simulateAttendanceWhatIf({
    currentAttended: subject.present,
    currentTotal: subject.total,
    hypotheticalAttended,
    hypotheticalMissed,
  });

  if (!simResult.isValid) {
    const isOverflow =
      simResult.error?.includes('exceed') ||
      false;

    return {
      isValid: false,
      error: simResult.error || 'Invalid simulation inputs',
      subjectName: subject.subject,
      currentAttended: subject.present,
      currentTotal: subject.total,
      currentPercentage: subject.percentage,
      hasData: subject.hasData,
      target,
      isCustomTarget,
      hypotheticalAttended,
      hypotheticalMissed,
      projectedAttended: 0,
      projectedTotal: 0,
      projectedPercentage: null,
      percentageDelta: null,
      status: isOverflow ? 'overflow' : 'invalid_input',
      statusLabel: isOverflow ? 'Out of range' : 'Invalid data',
      statusTone: 'danger',
      explanation: isOverflow
        ? 'Projected counts exceed safe integer calculation limits.'
        : simResult.error || 'Invalid simulation inputs.',
      classesRequired: 0,
      safeToMiss: 0,
    };
  }

  const {
    projectedAttended,
    projectedTotal,
    projectedPercentage,
    percentageDelta,
  } = simResult;

  // Scenario 1: Zero projected classes (both current total and hypothetical additions are 0)
  if (projectedTotal === 0) {
    return {
      isValid: true,
      subjectName: subject.subject,
      currentAttended: subject.present,
      currentTotal: subject.total,
      currentPercentage: null,
      hasData: false,
      target,
      isCustomTarget,
      hypotheticalAttended,
      hypotheticalMissed,
      projectedAttended: 0,
      projectedTotal: 0,
      projectedPercentage: null,
      percentageDelta: null,
      status: 'no_data',
      statusLabel: 'No data',
      statusTone: 'neutral',
      explanation: 'Add hypothetical attended or missed classes above to project outcomes.',
      classesRequired: 0,
      safeToMiss: 0,
    };
  }

  // Scenario 2: Evaluate projection using attendance intelligence engine
  const projections = generateAttendanceProjections(
    projectedAttended,
    projectedTotal,
    target
  );

  const req = projections.requiredToTarget;
  const safe = projections.safeToMiss;

  // Projected percentage meets target
  if (projectedPercentage !== null && projectedPercentage >= target) {
    if (safe.status === 'overflow') {
      return {
        isValid: true,
        subjectName: subject.subject,
        currentAttended: subject.present,
        currentTotal: subject.total,
        currentPercentage: subject.percentage,
        hasData: subject.hasData,
        target,
        isCustomTarget,
        hypotheticalAttended,
        hypotheticalMissed,
        projectedAttended,
        projectedTotal,
        projectedPercentage,
        percentageDelta,
        status: 'overflow',
        statusLabel: 'Out of range',
        statusTone: 'success',
        explanation: 'Safe-to-miss count exceeds safe calculation limits.',
        classesRequired: 0,
        safeToMiss: Infinity,
      };
    }

    if (safe.status === 'unlimited') {
      return {
        isValid: true,
        subjectName: subject.subject,
        currentAttended: subject.present,
        currentTotal: subject.total,
        currentPercentage: subject.percentage,
        hasData: subject.hasData,
        target,
        isCustomTarget,
        hypotheticalAttended,
        hypotheticalMissed,
        projectedAttended,
        projectedTotal,
        projectedPercentage,
        percentageDelta,
        status: 'target_met',
        statusLabel: 'Unlimited',
        statusTone: 'success',
        explanation: 'Target is 0%. Attendance can be missed freely without dropping below target.',
        classesRequired: 0,
        safeToMiss: Infinity,
      };
    }

    const safeCount = safe.safeToMiss;
    let explanation = '';
    if (safeCount > 0) {
      explanation = `Projected attendance meets target. You could safely miss up to ${safeCount} additional class${safeCount === 1 ? '' : 'es'}.`;
    } else {
      explanation = `Projected attendance is on the ${target}% boundary. Missing the next class will drop below target.`;
    }

    return {
      isValid: true,
      subjectName: subject.subject,
      currentAttended: subject.present,
      currentTotal: subject.total,
      currentPercentage: subject.percentage,
      hasData: subject.hasData,
      target,
      isCustomTarget,
      hypotheticalAttended,
      hypotheticalMissed,
      projectedAttended,
      projectedTotal,
      projectedPercentage,
      percentageDelta,
      status: 'target_met',
      statusLabel: 'Target met',
      statusTone: 'success',
      explanation,
      classesRequired: 0,
      safeToMiss: safeCount,
    };
  }

  // Projected percentage is below target
  if (req.status === 'unreachable') {
    return {
      isValid: true,
      subjectName: subject.subject,
      currentAttended: subject.present,
      currentTotal: subject.total,
      currentPercentage: subject.percentage,
      hasData: subject.hasData,
      target,
      isCustomTarget,
      hypotheticalAttended,
      hypotheticalMissed,
      projectedAttended,
      projectedTotal,
      projectedPercentage,
      percentageDelta,
      status: 'unreachable',
      statusLabel: 'Unreachable',
      statusTone: 'danger',
      explanation: `Mathematically unreachable: attending 100% of future classes cannot bring total up to ${target}%.`,
      classesRequired: Infinity,
      safeToMiss: 0,
    };
  }

  if (req.status === 'overflow') {
    return {
      isValid: true,
      subjectName: subject.subject,
      currentAttended: subject.present,
      currentTotal: subject.total,
      currentPercentage: subject.percentage,
      hasData: subject.hasData,
      target,
      isCustomTarget,
      hypotheticalAttended,
      hypotheticalMissed,
      projectedAttended,
      projectedTotal,
      projectedPercentage,
      percentageDelta,
      status: 'overflow',
      statusLabel: 'Out of range',
      statusTone: 'danger',
      explanation: 'Required class count exceeds safe calculation limits.',
      classesRequired: Infinity,
      safeToMiss: 0,
    };
  }

  const reqCount = req.required;
  const explanation = `Projected attendance is below ${target}%. Need to attend ${reqCount} more consecutive class${reqCount === 1 ? '' : 'es'} to reach target.`;

  return {
    isValid: true,
    subjectName: subject.subject,
    currentAttended: subject.present,
    currentTotal: subject.total,
    currentPercentage: subject.percentage,
    hasData: subject.hasData,
    target,
    isCustomTarget,
    hypotheticalAttended,
    hypotheticalMissed,
    projectedAttended,
    projectedTotal,
    projectedPercentage,
    percentageDelta,
    status: 'below_target',
    statusLabel: 'Below target',
    statusTone: 'danger',
    explanation,
    classesRequired: reqCount,
    safeToMiss: 0,
  };
}

// ---------------------------------------------------------------------------
// UI State Policy Helpers
// ---------------------------------------------------------------------------

export interface DeltaBadgeDisplay {
  shouldShow: boolean;
  text: string;
  tone: 'neutral' | 'success' | 'danger';
  direction: 'up' | 'down' | 'none';
}

/**
 * Resolves truthful delta presentation:
 * - Hidden when no adjustments have been made or percentageDelta is null (prevents misleading +0.0% on unadjusted baseline).
 * - Net zero (rounds to 0.0%) displayed neutrally without upward or downward trending arrows.
 * - Positive delta displayed in success tone with upward arrow.
 * - Negative delta displayed in danger tone with downward arrow.
 */
export function resolveDeltaBadgeDisplay(params: {
  hasAdjustments: boolean;
  percentageDelta: number | null;
}): DeltaBadgeDisplay {
  const { hasAdjustments, percentageDelta } = params;

  if (!hasAdjustments || percentageDelta === null) {
    return {
      shouldShow: false,
      text: '',
      tone: 'neutral',
      direction: 'none',
    };
  }

  // Net delta rounds to 0.0%
  if (Math.abs(percentageDelta) < 0.05) {
    return {
      shouldShow: true,
      text: '0.0%',
      tone: 'neutral',
      direction: 'none',
    };
  }

  if (percentageDelta > 0) {
    return {
      shouldShow: true,
      text: `+${percentageDelta.toFixed(1)}%`,
      tone: 'success',
      direction: 'up',
    };
  }

  return {
    shouldShow: true,
    text: `${percentageDelta.toFixed(1)}%`,
    tone: 'danger',
    direction: 'down',
  };
}

export interface InsightsSimulatorSectionState {
  sectionStatus: 'loading' | 'error' | 'ready' | 'hidden';
  errorMessage: string | null;
  canRetry: boolean;
}

/**
 * Resolves the display state for the Insights what-if simulator section:
 * - Loading: when overall screen or intelligence hook is in flight.
 * - Error: when cumulative attendance API fails (isolated from monthly snapshots and bunk analytics).
 * - Ready: when intelligence loaded successfully and subjects exist.
 * - Hidden: when no subjects exist and no error occurred.
 */
export function resolveSimulatorSectionState(params: {
  isLoading: boolean;
  isIntelligenceError: boolean;
  intelligenceError: string | null;
  subjectCount: number;
}): InsightsSimulatorSectionState {
  if (params.isLoading) {
    return { sectionStatus: 'loading', errorMessage: null, canRetry: false };
  }
  if (params.isIntelligenceError) {
    return {
      sectionStatus: 'error',
      errorMessage: params.intelligenceError || 'Unable to load attendance records for simulation.',
      canRetry: true,
    };
  }
  if (params.subjectCount > 0) {
    return { sectionStatus: 'ready', errorMessage: null, canRetry: false };
  }
  return { sectionStatus: 'hidden', errorMessage: null, canRetry: false };
}
