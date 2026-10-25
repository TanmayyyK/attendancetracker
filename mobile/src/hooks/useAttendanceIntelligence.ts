/**
 * Attendance Intelligence Integration Hook
 *
 * Coordinates:
 * 1. Fetching cumulative attendance from the backend API.
 * 2. Merging API records with the canonical 5 subjects (preserving order and zero-data states).
 * 3. Loading and persisting student custom targets [60..95] in AsyncStorage.
 * 4. Calculating exact deterministic projections and weighted overall attendance.
 * 5. Instant optimistic recalculation on target changes without network delay.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCumulativeSubjects, getDashboardSummary } from '../api.ts';
import {
  mergeCumulativeSubjects,
  type RawApiSubjectRecord,
} from '../utils/targetPolicy.ts';
import {
  getStoredTargets,
  saveSubjectTarget as persistSubjectTarget,
  removeSubjectTarget as deleteSubjectTarget,
  clearAllSubjectTargets as wipeAllSubjectTargets,
} from '../services/attendance/targetStorage.ts';
import type {
  AttendanceIntelligenceState,
  SubjectIntelligenceItem,
  OverallAttendanceSummary,
} from '../types/attendanceIntelligence.ts';

// Initial zero-data fallback
const initialResult = mergeCumulativeSubjects(null, {}, 0);

export function useAttendanceIntelligence(): AttendanceIntelligenceState {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiError, setIsApiError] = useState(false);
  const [isEmptyDataset, setIsEmptyDataset] = useState(false);

  const [overall, setOverall] = useState<OverallAttendanceSummary>(initialResult.overall);
  const [subjects, setSubjects] = useState<SubjectIntelligenceItem[]>(initialResult.subjects);

  // In-memory cache of latest API data and targets to allow zero-latency recalculations
  const rawApiRecordsRef = useRef<RawApiSubjectRecord[] | null>(null);
  const streakRef = useRef<number>(0);
  const targetsRef = useRef<Record<string, number>>({});

  const applyCalculations = useCallback(() => {
    const result = mergeCumulativeSubjects(
      rawApiRecordsRef.current,
      targetsRef.current,
      streakRef.current
    );

    setIsApiError(result.isApiError);
    setIsEmptyDataset(result.isEmptyDataset);
    setOverall(result.overall);
    setSubjects(result.subjects);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [cumulativeData, summaryData, storedTargets] = await Promise.all([
        getCumulativeSubjects(),
        getDashboardSummary(),
        getStoredTargets(),
      ]);

      targetsRef.current = storedTargets;

      // Distinguish API failure (null) from valid empty data ([])
      if (cumulativeData === null) {
        rawApiRecordsRef.current = null;
        setError('Unable to load attendance data. Please check your connection.');
        setIsApiError(true);
      } else {
        rawApiRecordsRef.current = cumulativeData;
        streakRef.current = summaryData?.overall?.streak || 0;
        setError(null);
        setIsApiError(false);
      }

      applyCalculations();
    } catch (err) {
      console.warn('[useAttendanceIntelligence] fetchData error:', err);
      setError('An unexpected error occurred while loading attendance intelligence.');
      setIsApiError(true);
      applyCalculations();
    } finally {
      setLoading(false);
    }
  }, [applyCalculations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const setSubjectTarget = useCallback(
    async (subject: string, target: number): Promise<boolean> => {
      const ok = await persistSubjectTarget(subject, target);
      if (ok) {
        targetsRef.current = { ...targetsRef.current, [subject.trim()]: target };
        applyCalculations();
      }
      return ok;
    },
    [applyCalculations]
  );

  const resetSubjectTarget = useCallback(
    async (subject: string): Promise<boolean> => {
      const ok = await deleteSubjectTarget(subject);
      if (ok) {
        const { [subject.trim()]: _, ...rest } = targetsRef.current;
        targetsRef.current = rest;
        applyCalculations();
      }
      return ok;
    },
    [applyCalculations]
  );

  const resetAllTargets = useCallback(async (): Promise<boolean> => {
    const ok = await wipeAllSubjectTargets();
    if (ok) {
      targetsRef.current = {};
      applyCalculations();
    }
    return ok;
  }, [applyCalculations]);

  return {
    loading,
    refreshing,
    error,
    isApiError,
    isEmptyDataset,
    overall,
    subjects,
    setSubjectTarget,
    resetSubjectTarget,
    resetAllTargets,
    refresh,
  };
}
