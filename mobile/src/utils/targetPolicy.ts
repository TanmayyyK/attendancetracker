/**
 * Attendance Target Policy and Canonical Subject Merging
 *
 * Implements:
 * 1. Target percentage validation ([60..95] integer range, 75 default).
 * 2. Versioned AsyncStorage payload sanitization and migration.
 * 3. Canonical subject list merging (preserving order, zero-data representation, and custom subjects).
 * 4. Weighted overall attendance aggregation with explicit null representation for no-data.
 *
 * Has ZERO dependencies on React, native modules, or AsyncStorage. 100% pure and deterministic.
 */

import {
  CANONICAL_SUBJECTS,
  MIN_TARGET_PERCENTAGE,
  MAX_TARGET_PERCENTAGE,
  DEFAULT_TARGET_PERCENTAGE,
  type StoredSubjectTargetsV1,
  type SubjectIntelligenceItem,
  type OverallAttendanceSummary,
} from '../types/attendanceIntelligence.ts';

import {
  generateAttendanceProjections,
  validateAttendanceCounts,
} from './attendanceIntelligence.ts';

export const TARGET_STORAGE_KEY = '@attendance/subject_targets_v1';

/**
 * Validates whether a value is a permitted student target percentage.
 * Target must be a safe integer between 60% and 95% inclusive.
 */
export function validateTargetPercentage(target: unknown): number | null {
  if (
    typeof target === 'number' &&
    Number.isSafeInteger(target) &&
    target >= MIN_TARGET_PERCENTAGE &&
    target <= MAX_TARGET_PERCENTAGE
  ) {
    return target;
  }
  return null;
}

/**
 * Sanitizes and validates raw storage payloads, handling corrupt data gracefully.
 */
export function sanitizeStoredTargets(raw: unknown): StoredSubjectTargetsV1 {
  const fallback: StoredSubjectTargetsV1 = {
    version: 1,
    updatedAt: new Date().toISOString(),
    targets: {},
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;

  // Handle version 1 payload
  if (candidate.version === 1 && candidate.targets && typeof candidate.targets === 'object') {
    const rawTargets = candidate.targets as Record<string, unknown>;
    const sanitizedMap: Record<string, number> = {};

    for (const [subjectName, targetVal] of Object.entries(rawTargets)) {
      const valid = validateTargetPercentage(targetVal);
      if (valid !== null && typeof subjectName === 'string' && subjectName.trim().length > 0) {
        sanitizedMap[subjectName.trim()] = valid;
      }
    }

    return {
      version: 1,
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : fallback.updatedAt,
      targets: sanitizedMap,
    };
  }

  // If unknown version or malformed, return clean default
  return fallback;
}

export interface RawApiSubjectRecord {
  subject?: unknown;
  present?: unknown;
  total?: unknown;
  percentage?: unknown;
  [key: string]: unknown;
}

export interface MergedAttendanceResult {
  isApiError: boolean;
  isEmptyDataset: boolean;
  overall: OverallAttendanceSummary;
  subjects: SubjectIntelligenceItem[];
}

/**
 * Merges API cumulative subject records with canonical subjects and custom targets.
 *
 * Rules:
 * 1. If apiSubjects is null, flags isApiError: true without throwing.
 * 2. If apiSubjects is empty ([]), flags isEmptyDataset: true and preserves canonical subjects with zero data.
 * 3. Canonical subjects are always included in their exact defined order.
 * 4. Subjects with 0 logged classes have percentage: null, hasData: false, currentStatus: 'no_data'.
 * 5. Unexpected / custom / legacy subjects returned by the API are appended at the end without data loss.
 * 6. Overall attendance uses weighted totals ((totalPresent / totalClasses) * 100), never an unweighted average.
 * 7. When totalClasses === 0, overall percentage is null (NOT 0%).
 */
export function mergeCumulativeSubjects(
  apiSubjects: RawApiSubjectRecord[] | null,
  customTargets: Record<string, number> = {},
  streak: number = 0
): MergedAttendanceResult {
  const isApiError = apiSubjects === null;
  const rawList = Array.isArray(apiSubjects) ? apiSubjects : [];
  const isEmptyDataset = !isApiError && rawList.length === 0;

  // Build lookup index of API records by trimmed subject name
  const apiMap = new Map<string, RawApiSubjectRecord>();
  for (const item of rawList) {
    if (item && typeof item.subject === 'string' && item.subject.trim().length > 0) {
      apiMap.set(item.subject.trim(), item);
    }
  }

  const subjects: SubjectIntelligenceItem[] = [];
  const processedSubjectNames = new Set<string>();

  // Step 1: Process canonical subjects in exact canonical order
  for (const canonicalName of CANONICAL_SUBJECTS) {
    processedSubjectNames.add(canonicalName);
    const apiRecord = apiMap.get(canonicalName);

    const rawPresent = apiRecord?.present;
    const rawTotal = apiRecord?.total;

    const present = typeof rawPresent === 'number' && Number.isSafeInteger(rawPresent) && rawPresent >= 0 ? rawPresent : 0;
    const total = typeof rawTotal === 'number' && Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : 0;

    const customTarget = customTargets[canonicalName];
    const target = validateTargetPercentage(customTarget) ?? DEFAULT_TARGET_PERCENTAGE;
    const isCustomTarget = target !== DEFAULT_TARGET_PERCENTAGE;

    // Detect malformed records (e.g. attended > total or negative numbers in raw record)
    const countValidation = validateAttendanceCounts(
      apiRecord ? rawPresent : 0,
      apiRecord ? rawTotal : 0
    );

    const projections = generateAttendanceProjections(present, total, target);

    subjects.push({
      subject: canonicalName,
      isCanonical: true,
      present,
      total,
      missed: Math.max(0, total - present),
      percentage: countValidation.isValid ? projections.summary.percentage : null,
      hasData: countValidation.isValid && total > 0,
      target,
      isCustomTarget,
      currentStatus: countValidation.isValid ? projections.summary.status : 'invalid_input',
      projections,
    });
  }

  // Step 2: Append any unexpected / custom / legacy subjects from API in API encounter order
  for (const item of rawList) {
    if (item && typeof item.subject === 'string') {
      const subjectName = item.subject.trim();
      if (subjectName.length > 0 && !processedSubjectNames.has(subjectName)) {
        processedSubjectNames.add(subjectName);

        const rawPresent = item.present;
        const rawTotal = item.total;

        const present = typeof rawPresent === 'number' && Number.isSafeInteger(rawPresent) && rawPresent >= 0 ? rawPresent : 0;
        const total = typeof rawTotal === 'number' && Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : 0;

        const customTarget = customTargets[subjectName];
        const target = validateTargetPercentage(customTarget) ?? DEFAULT_TARGET_PERCENTAGE;
        const isCustomTarget = target !== DEFAULT_TARGET_PERCENTAGE;

        const countValidation = validateAttendanceCounts(rawPresent, rawTotal);
        const projections = generateAttendanceProjections(present, total, target);

        subjects.push({
          subject: subjectName,
          isCanonical: false,
          present,
          total,
          missed: Math.max(0, total - present),
          percentage: countValidation.isValid ? projections.summary.percentage : null,
          hasData: countValidation.isValid && total > 0,
          target,
          isCustomTarget,
          currentStatus: countValidation.isValid ? projections.summary.status : 'invalid_input',
          projections,
        });
      }
    }
  }

  // Step 3: Compute weighted overall attendance across all valid subject records
  let totalPresents = 0;
  let totalClasses = 0;

  for (const s of subjects) {
    if (s.currentStatus !== 'invalid_input' && s.total > 0) {
      totalPresents += s.present;
      totalClasses += s.total;
    }
  }

  const overallProjections = generateAttendanceProjections(
    totalPresents,
    totalClasses,
    DEFAULT_TARGET_PERCENTAGE
  );

  const overall: OverallAttendanceSummary = {
    total: totalClasses,
    present: totalPresents,
    absent: Math.max(0, totalClasses - totalPresents),
    percentage: totalClasses > 0 ? overallProjections.summary.percentage : null,
    hasData: totalClasses > 0,
    target: DEFAULT_TARGET_PERCENTAGE,
    currentStatus: totalClasses > 0 ? overallProjections.summary.status : 'no_data',
    streak: typeof streak === 'number' && Number.isSafeInteger(streak) && streak >= 0 ? streak : 0,
    projections: overallProjections,
  };

  return {
    isApiError,
    isEmptyDataset,
    overall,
    subjects,
  };
}
