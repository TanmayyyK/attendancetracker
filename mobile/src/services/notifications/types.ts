/**
 * Notification and Reminder Type Definitions
 */

export type ReminderMoment = 'morning' | 'wrapUp' | 'night';

export interface ReminderCopy {
  title: string;
  body: string;
  destination: '/(tabs)/' | '/(tabs)/add';
}

export interface DayVoice {
  weekday: number; // 1 = Sunday, 2 = Monday, ..., 7 = Saturday
  moments: Record<ReminderMoment, ReminderCopy>;
}

export interface MomentConfig {
  enabled: boolean;
  hour: number;   // 0..23
  minute: number; // 0..59
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number;   // 0..23
  startMinute: number; // 0..59
  endHour: number;     // 0..23
  endMinute: number;   // 0..59
}

export interface NotificationPreferences {
  version: number;
  enabled: boolean;
  moments: Record<ReminderMoment, MomentConfig>;
  activeDays: number[]; // Array of unique integers 1..7 (1=Sun, 7=Sat)
  quietHours: QuietHoursConfig;
  attendanceSuppression: boolean; // Integration flag (deferred until daily completion signal exists)
}

/**
 * Persisted state mapping deterministic reminder keys to actual OS notification identifiers.
 */
export interface ManagedReminderState {
  version: number; // Version 4 uses deterministic key mapping
  keyToIdentifier: Record<string, string>; // e.g. "reminder-v3-2-morning" -> "notif-uuid-123"
  legacyIdentifiers?: string[]; // Backwards compatibility with version 3
  lastReconciledAt?: string;
}

export interface DesiredReminder {
  key: string; // e.g. "reminder-v3-1-morning"
  weekday: number;
  moment: ReminderMoment;
  hour: number;
  minute: number;
  title: string;
  body: string;
  destination: '/(tabs)/' | '/(tabs)/add';
}

export interface ExistingScheduledRecord {
  identifier: string;
  weekday?: number;
  hour?: number;
  minute?: number;
  reminderSystem?: string;
  moment?: string;
  url?: string;
}

export interface ReconciliationPlan {
  toKeep: Array<{ key: string; identifier: string }>;
  toCancel: string[]; // OS identifiers to cancel
  toSchedule: DesiredReminder[]; // Desired reminders needing new OS schedule
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface ScheduleDiagnostics {
  permissionStatus: PermissionStatus;
  schedulerStatus: 'healthy' | 'degraded' | 'disabled' | 'permission_required';
  scheduledCount: number;
  nextReminder: {
    weekday: number;
    moment: ReminderMoment;
    time: string;
    title: string;
  } | null;
  lastReconciled: string | null;
  error: string | null;
}
