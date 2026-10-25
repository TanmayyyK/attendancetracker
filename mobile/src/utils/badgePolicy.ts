/**
 * Badge Display Policy and Resolution for Subject Intelligence
 *
 * Pure, deterministic mapping of SubjectIntelligenceItem states into:
 * - badge label
 * - semantic tone ('neutral' | 'success' | 'warning' | 'danger')
 * - accessibility label
 *
 * Rules:
 * 1. no_data -> "No data" (neutral)
 * 2. target_met with safe-to-miss > 0 -> "Safe to miss N" (success)
 * 3. target_met with safe-to-miss === 0 -> "On boundary" (warning)
 * 4. below_target with achievable recovery -> "Need N classes" (danger)
 * 5. unreachable, unlimited, overflow, or invalid input -> explicit text labels, never NaN or Infinity.
 *
 * Has ZERO dependencies on React or React Native so it can be 100% verified in pure Node tests.
 */

import type { SubjectIntelligenceItem } from '../types/attendanceIntelligence.ts';

export interface BadgeDisplayModel {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  accessibilityLabel: string;
}

export function resolveBadgeDisplay(
  item: Pick<SubjectIntelligenceItem, 'currentStatus' | 'hasData' | 'projections'>
): BadgeDisplayModel {
  if (!item || !item.hasData || item.currentStatus === 'no_data') {
    return {
      label: 'No data',
      tone: 'neutral',
      accessibilityLabel: 'No attendance data logged',
    };
  }

  if (
    item.currentStatus === 'invalid_input' ||
    item.projections.requiredToTarget.status === 'invalid_input' ||
    item.projections.safeToMiss.status === 'invalid_input'
  ) {
    return {
      label: 'Invalid data',
      tone: 'danger',
      accessibilityLabel: 'Invalid attendance data',
    };
  }

  if (item.currentStatus === 'target_met') {
    const { status, safeToMiss } = item.projections.safeToMiss;

    if (status === 'can_miss') {
      if (safeToMiss > 0) {
        return {
          label: `Safe to miss ${safeToMiss}`,
          tone: 'success',
          accessibilityLabel: `Safe to miss ${safeToMiss} ${safeToMiss === 1 ? 'class' : 'classes'}`,
        };
      }
      return {
        label: 'On boundary',
        tone: 'warning',
        accessibilityLabel: 'On boundary, cannot miss any upcoming classes',
      };
    }

    if (status === 'unlimited') {
      return {
        label: 'Unlimited',
        tone: 'success',
        accessibilityLabel: 'Target is 0%, attendance can be missed freely',
      };
    }

    if (status === 'overflow') {
      return {
        label: 'Out of range',
        tone: 'success',
        accessibilityLabel: 'Safe to miss count exceeds calculation limit',
      };
    }

    return {
      label: 'On boundary',
      tone: 'warning',
      accessibilityLabel: 'On boundary',
    };
  }

  if (item.currentStatus === 'below_target') {
    const { status, required } = item.projections.requiredToTarget;

    if (status === 'achievable') {
      const classWord = required === 1 ? 'class' : 'classes';
      return {
        label: `Need ${required} ${classWord}`,
        tone: 'danger',
        accessibilityLabel: `Need to attend ${required} ${classWord} to reach target`,
      };
    }

    if (status === 'unreachable') {
      return {
        label: 'Unreachable',
        tone: 'danger',
        accessibilityLabel: 'Target cannot be reached mathematically',
      };
    }

    if (status === 'overflow') {
      return {
        label: 'Out of range',
        tone: 'danger',
        accessibilityLabel: 'Required class count exceeds calculation limit',
      };
    }

    return {
      label: 'Below target',
      tone: 'danger',
      accessibilityLabel: 'Below target attendance',
    };
  }

  return {
    label: 'No data',
    tone: 'neutral',
    accessibilityLabel: 'No attendance data logged',
  };
}
