/**
 * Attendance Event Bus & Invalidation Coordinator
 *
 * Lightweight, zero-dependency in-memory invalidation coordinator for cross-tab updates.
 * When an attendance submission succeeds on the Add tab (or any write occurs),
 * `notifyAttendanceMutation()` increments the monotonic mutation version and notifies subscribers.
 *
 * Active/focused screens compare their last observed version against `getAttendanceVersion()`
 * to refresh server-backed data automatically on tab focus without duplicate requests.
 */

let attendanceVersion = 0;
const listeners = new Set<() => void>();

/**
 * Notifies all subscribers and increments the attendance mutation version.
 * Called only upon verified successful attendance mutations.
 */
export function notifyAttendanceMutation(): void {
  attendanceVersion += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('[attendanceEventBus] Error in mutation listener:', err);
    }
  });
}

/**
 * Returns the current monotonically increasing attendance version.
 */
export function getAttendanceVersion(): number {
  return attendanceVersion;
}

/**
 * Subscribes a listener to attendance mutations.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeAttendanceMutation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Resets the version and listeners. Strictly for unit tests.
 */
export function resetAttendanceEventBusForTesting(version = 0): void {
  attendanceVersion = version;
  listeners.clear();
}

export interface FocusRefreshCoordinatorOptions {
  onRefresh: () => Promise<void> | void;
  getVersion?: () => number;
  initialVersion?: number;
}

export interface FocusRefreshCoordinator {
  checkAndRefresh: () => Promise<boolean>;
  markSynced: () => void;
  getLastObservedVersion: () => number;
  isInFlight: () => boolean;
}

/**
 * Creates a pure stateful coordinator for focus-based refresh checks.
 * Encapsulates the logic of comparing observed version against current version,
 * guarding against concurrent in-flight executions, and tracking synchronization state.
 */
export function createFocusRefreshCoordinator(
  options: FocusRefreshCoordinatorOptions
): FocusRefreshCoordinator {
  const getVersion = options.getVersion ?? getAttendanceVersion;
  let lastObservedVersion = options.initialVersion ?? getVersion();
  let inFlight = false;

  const markSynced = () => {
    lastObservedVersion = getVersion();
  };

  const checkAndRefresh = async (): Promise<boolean> => {
    const currentVersion = getVersion();
    if (lastObservedVersion < currentVersion && !inFlight) {
      lastObservedVersion = currentVersion;
      inFlight = true;
      try {
        await Promise.resolve(options.onRefresh());
        return true;
      } finally {
        inFlight = false;
      }
    }
    return false;
  };

  return {
    checkAndRefresh,
    markSynced,
    getLastObservedVersion: () => lastObservedVersion,
    isInFlight: () => inFlight,
  };
}
