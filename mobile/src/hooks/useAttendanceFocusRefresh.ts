/**
 * Hook for cross-tab attendance focus refresh.
 *
 * When an attendance submission succeeds on the Add tab, the attendance version increments.
 * When Home or Insights gains focus (via Expo Router's useFocusEffect), this hook detects
 * that the screen's observed version is stale and automatically triggers an asynchronous refresh.
 *
 * Key guarantees:
 * - Zero network requests on initial focus (initial mount is handled by screen's own load).
 * - Zero redundant requests when focusing without a mutation.
 * - In-flight guard prevents duplicate concurrent executions from rapid focus events.
 * - No infinite focus-refresh loop.
 * - No full-screen skeleton flicker (leaves cached screen data visible while refreshing).
 */

import { useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getAttendanceVersion,
  createFocusRefreshCoordinator,
  type FocusRefreshCoordinator,
} from '../services/attendance/attendanceEventBus.ts';

export interface UseAttendanceFocusRefreshOptions {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}

export interface UseAttendanceFocusRefreshResult {
  markSynced: () => void;
}

export function useAttendanceFocusRefresh({
  onRefresh,
  enabled = true,
}: UseAttendanceFocusRefreshOptions): UseAttendanceFocusRefreshResult {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const coordinatorRef = useRef<FocusRefreshCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createFocusRefreshCoordinator({
      onRefresh: () => onRefreshRef.current(),
      getVersion: getAttendanceVersion,
    });
  }

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !coordinatorRef.current) return;
      void coordinatorRef.current.checkAndRefresh();
    }, [enabled])
  );

  const markSynced = useCallback(() => {
    coordinatorRef.current?.markSynced();
  }, []);

  return { markSynced };
}
