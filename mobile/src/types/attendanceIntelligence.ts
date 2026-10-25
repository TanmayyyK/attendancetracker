/**
 * Attendance Intelligence Types and Contracts
 *
 * Defines contracts for per-subject intelligence items, overall weighted attendance summaries,
 * and versioned local target persistence schemas.
 */

import type {
  AttendanceTargetStatus,
  ClassesRequiredStatus,
  ClassesRequiredResult,
  SafeToMissStatus,
  SafeToMissResult,
  AttendanceProjection,
  AttendanceSummary,
} from '../utils/attendanceIntelligence.ts';

// Re-export core status types for consumers
export type {
  AttendanceTargetStatus,
  ClassesRequiredStatus,
  ClassesRequiredResult,
  SafeToMissStatus,
  SafeToMissResult,
  AttendanceProjection,
  AttendanceSummary,
};

/**
 * Permitted target range for student personal goals (60% to 95%).
 * Default institutional reference threshold is 75%.
 */
export const MIN_TARGET_PERCENTAGE = 60;
export const MAX_TARGET_PERCENTAGE = 95;
export const DEFAULT_TARGET_PERCENTAGE = 75;

/**
 * Canonical five subjects in standard display order.
 */
export const CANONICAL_SUBJECTS = [
  'Physiology',
  'Anatomy',
  'Samhita',
  'Padarth Vigyan',
  'Sanskrit (CM Sir)',
] as const;

export type CanonicalSubjectName = typeof CANONICAL_SUBJECTS[number];

/**
 * Versioned payload schema for locally stored subject targets in AsyncStorage.
 */
export interface StoredSubjectTargetsV1 {
  version: 1;
  updatedAt: string; // ISO 8601 timestamp
  targets: Record<string, number>; // subjectName -> target integer [60..95]
}

/**
 * Intelligence model for a single subject.
 */
export interface SubjectIntelligenceItem {
  subject: string;
  isCanonical: boolean;
  present: number;
  total: number;
  missed: number;
  percentage: number | null; // null when total === 0; never forced to 0%
  hasData: boolean;
  target: number; // [60..95], defaults to 75
  isCustomTarget: boolean; // true if target !== DEFAULT_TARGET_PERCENTAGE
  currentStatus: AttendanceTargetStatus; // 'no_data' | 'below_target' | 'target_met' | 'invalid_input'
  projections: AttendanceProjection;
}

/**
 * Intelligence model for overall weighted attendance across all subjects.
 */
export interface OverallAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  percentage: number | null; // null when total === 0; never forced to 0%
  hasData: boolean;
  target: number; // fixed baseline 75
  currentStatus: AttendanceTargetStatus;
  streak: number;
  projections: AttendanceProjection;
}

/**
 * Hook state interface exposing data, loading states, and target management actions.
 */
export interface AttendanceIntelligenceState {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isApiError: boolean;
  isEmptyDataset: boolean;
  overall: OverallAttendanceSummary;
  subjects: SubjectIntelligenceItem[];
  setSubjectTarget: (subject: string, target: number) => Promise<boolean>;
  resetSubjectTarget: (subject: string) => Promise<boolean>;
  resetAllTargets: () => Promise<boolean>;
  refresh: () => Promise<void>;
}
