/**
 * Attendance-Aware Reminder Suppression Integration Point
 *
 * NOTE ON DESIGN & DEFERRAL:
 * The attendance data model records atomic class entries without a daily schedule timetable
 * or an explicit "day completed" confirmation. Because recording one class does not prove that
 * all classes for the day have finished, automatic cancellation of afternoon or night reminders
 * based merely on the presence of any attendance record would cause students with multiple
 * lecture blocks to miss critical check-in reminders.
 *
 * Per Phase 2A architectural specifications, automatic suppression is deferred until an explicit
 * daily completion signal or timetable model is approved by the owner.
 */

export interface AttendanceCompletionSignal {
  date: string;
  isDayFullyLogged: boolean;
}

export interface AttendanceSuppressionResult {
  suppressed: boolean;
  reason: 'deferred' | 'not_completed' | 'day_fully_logged';
}

/**
 * Evaluates whether reminders for a given date should be suppressed.
 * Returns { suppressed: false, reason: 'deferred' } by default, deferring automatic suppression to preserve reliable reminder delivery.
 */
export function evaluateAttendanceSuppression(
  signal?: AttendanceCompletionSignal | null
): AttendanceSuppressionResult {
  if (!signal) {
    return { suppressed: false, reason: 'deferred' };
  }
  if (!signal.isDayFullyLogged) {
    return { suppressed: false, reason: 'not_completed' };
  }
  return { suppressed: true, reason: 'day_fully_logged' };
}
