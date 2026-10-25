/**
 * Pure Business Rules and Algorithms for Notification Scheduling and Routing
 *
 * This module has ZERO dependencies on native modules (no Expo, no React Native, no AsyncStorage),
 * allowing it to be verified directly and deterministically in any testing or CI environment.
 */

import type {
  ReminderMoment,
  NotificationPreferences,
  ManagedReminderState,
  DesiredReminder,
  ExistingScheduledRecord,
  ReconciliationPlan,
  QuietHoursConfig,
} from './types.ts';

import {
  DEFAULT_REMINDER_TIMES,
  REMINDER_SYSTEM_TAG,
  WEEKLY_VOICE,
} from './voice.ts';

// ---------------------------------------------------------------------------
// 1. Storage & Preference Validation Rules
// ---------------------------------------------------------------------------

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: false,
  startHour: 22,
  startMinute: 0,
  endHour: 7,
  endMinute: 0,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  version: 1,
  enabled: true,
  moments: {
    morning: { enabled: true, hour: DEFAULT_REMINDER_TIMES.morning.hour, minute: DEFAULT_REMINDER_TIMES.morning.minute },
    wrapUp: { enabled: true, hour: DEFAULT_REMINDER_TIMES.wrapUp.hour, minute: DEFAULT_REMINDER_TIMES.wrapUp.minute },
    night: { enabled: true, hour: DEFAULT_REMINDER_TIMES.night.hour, minute: DEFAULT_REMINDER_TIMES.night.minute },
  },
  activeDays: [1, 2, 3, 4, 5, 6, 7], // All 7 days active by default
  quietHours: { ...DEFAULT_QUIET_HOURS },
  attendanceSuppression: false, // Deferred integration flag
};

function isValidHour(h: unknown): boolean {
  return typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23;
}

function isValidMinute(m: unknown): boolean {
  return typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= 59;
}

function validateMoment(raw: any, momentKey: ReminderMoment): { enabled: boolean; hour: number; minute: number } {
  const def = DEFAULT_NOTIFICATION_PREFERENCES.moments[momentKey];
  if (!raw || typeof raw !== 'object') return { ...def };

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : def.enabled,
    hour: isValidHour(raw.hour) ? raw.hour : def.hour,
    minute: isValidMinute(raw.minute) ? raw.minute : def.minute,
  };
}

function validateQuietHours(raw: any): QuietHoursConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_QUIET_HOURS };

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_QUIET_HOURS.enabled,
    startHour: isValidHour(raw.startHour) ? raw.startHour : DEFAULT_QUIET_HOURS.startHour,
    startMinute: isValidMinute(raw.startMinute) ? raw.startMinute : DEFAULT_QUIET_HOURS.startMinute,
    endHour: isValidHour(raw.endHour) ? raw.endHour : DEFAULT_QUIET_HOURS.endHour,
    endMinute: isValidMinute(raw.endMinute) ? raw.endMinute : DEFAULT_QUIET_HOURS.endMinute,
  };
}

function validateActiveDays(raw: any): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NOTIFICATION_PREFERENCES.activeDays];

  const validDays = raw
    .filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7);
  const uniqueDays = Array.from(new Set(validDays)).sort();

  return uniqueDays.length > 0 ? uniqueDays : [...DEFAULT_NOTIFICATION_PREFERENCES.activeDays];
}

/**
 * Validates any raw object (e.g. parsed JSON from storage) into a strict NotificationPreferences.
 * Falls back to default values for missing or invalid properties without throwing.
 */
export function validatePreferences(raw: any): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    version: 1,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    moments: {
      morning: validateMoment(raw.moments?.morning, 'morning'),
      wrapUp: validateMoment(raw.moments?.wrapUp, 'wrapUp'),
      night: validateMoment(raw.moments?.night, 'night'),
    },
    activeDays: validateActiveDays(raw.activeDays),
    quietHours: validateQuietHours(raw.quietHours),
    attendanceSuppression: typeof raw.attendanceSuppression === 'boolean'
      ? raw.attendanceSuppression
      : DEFAULT_NOTIFICATION_PREFERENCES.attendanceSuppression,
  };
}

// ---------------------------------------------------------------------------
// 2. Deterministic Key Rules
// ---------------------------------------------------------------------------

/**
 * Generates a stable deterministic logical key for a reminder moment.
 * Format: reminder-v3-<weekday>-<moment>
 */
export function formatReminderKey(weekday: number, moment: ReminderMoment): string {
  return `reminder-v3-${weekday}-${moment}`;
}

export function parseReminderKey(key: string): { weekday: number; moment: ReminderMoment } | null {
  const match = key.match(/^reminder-v3-([1-7])-(morning|wrapUp|night)$/);
  if (!match) return null;
  return {
    weekday: parseInt(match[1], 10),
    moment: match[2] as ReminderMoment,
  };
}

// ---------------------------------------------------------------------------
// 3. Quiet Hours Calculation
// ---------------------------------------------------------------------------

/**
 * Checks whether a given (hour, minute) falls within a quiet-hours window.
 * Properly evaluates both same-day windows (e.g. 13:00 to 15:00) and overnight windows (e.g. 22:00 to 07:00).
 */
export function isTimeInQuietHours(hour: number, minute: number, quiet: QuietHoursConfig): boolean {
  if (!quiet || !quiet.enabled) return false;

  const currentTotal = hour * 60 + minute;
  const startTotal = quiet.startHour * 60 + quiet.startMinute;
  const endTotal = quiet.endHour * 60 + quiet.endMinute;

  if (startTotal === endTotal) {
    return false; // Equal start and end means zero-length window
  }

  if (startTotal < endTotal) {
    // Standard window on the same calendar day (e.g. 13:00 - 16:00)
    return currentTotal >= startTotal && currentTotal < endTotal;
  } else {
    // Overnight window spanning midnight (e.g. 22:00 - 07:00)
    return currentTotal >= startTotal || currentTotal < endTotal;
  }
}

// ---------------------------------------------------------------------------
// 4. Desired Reminders Computation
// ---------------------------------------------------------------------------

/**
 * Pure function: Computes the list of desired reminders from user preferences and weekly voice copy.
 */
export function computeDesiredReminders(preferences: NotificationPreferences): DesiredReminder[] {
  if (!preferences.enabled) {
    return [];
  }

  const desired: DesiredReminder[] = [];

  for (const day of WEEKLY_VOICE) {
    if (!preferences.activeDays.includes(day.weekday)) {
      continue;
    }

    const moments: ReminderMoment[] = ['morning', 'wrapUp', 'night'];

    for (const moment of moments) {
      const momentConfig = preferences.moments[moment];
      if (!momentConfig || !momentConfig.enabled) {
        continue;
      }

      // Quiet hours check
      if (isTimeInQuietHours(momentConfig.hour, momentConfig.minute, preferences.quietHours)) {
        continue;
      }

      const copy = day.moments[moment];
      desired.push({
        key: formatReminderKey(day.weekday, moment),
        weekday: day.weekday,
        moment,
        hour: momentConfig.hour,
        minute: momentConfig.minute,
        title: copy.title,
        body: copy.body,
        destination: copy.destination,
      });
    }
  }

  return desired;
}

// ---------------------------------------------------------------------------
// 5. Reconciliation Planning Algorithm
// ---------------------------------------------------------------------------

/**
 * Pure function: Computes the reconciliation plan (toKeep, toCancel, toSchedule).
 *
 * Conservative migration:
 * - Matches existing scheduled notifications using stored mapping OR request content metadata.
 * - Protects unrelated notifications from being cancelled.
 * - Only cancels notifications that belong to this system and are obsolete or modified.
 */
export function computeReconciliationPlan(
  desired: DesiredReminder[],
  existing: ExistingScheduledRecord[],
  storedState: ManagedReminderState | null
): ReconciliationPlan {
  const desiredMap = new Map<string, DesiredReminder>();
  for (const d of desired) {
    desiredMap.set(d.key, d);
  }

  const existingMap = new Map<string, ExistingScheduledRecord>();
  for (const e of existing) {
    existingMap.set(e.identifier, e);
  }

  const keyToIdentifier: Record<string, string> = { ...(storedState?.keyToIdentifier || {}) };
  const legacyIdSet = new Set<string>(storedState?.legacyIdentifiers || []);

  const toKeep: Array<{ key: string; identifier: string }> = [];
  const matchedIdentifiers = new Set<string>();

  // Pass 1: Match from stored keyToIdentifier mapping
  for (const [key, id] of Object.entries(keyToIdentifier)) {
    const desiredItem = desiredMap.get(key);
    const existingItem = existingMap.get(id);

    if (
      desiredItem &&
      existingItem &&
      existingItem.weekday === desiredItem.weekday &&
      existingItem.hour === desiredItem.hour &&
      existingItem.minute === desiredItem.minute
    ) {
      toKeep.push({ key, identifier: id });
      matchedIdentifiers.add(id);
    }
  }

  // Pass 2: Migration match from existing requests by inspecting content metadata
  for (const item of existing) {
    if (matchedIdentifiers.has(item.identifier)) continue;

    // Must be a managed reminder belonging to our system
    const isManaged = item.reminderSystem === REMINDER_SYSTEM_TAG || legacyIdSet.has(item.identifier);
    if (!isManaged) continue;

    if (item.weekday && item.moment) {
      const derivedKey = formatReminderKey(item.weekday, item.moment as ReminderMoment);
      const desiredItem = desiredMap.get(derivedKey);

      // If desired and not already kept and trigger matches, adopt it!
      if (
        desiredItem &&
        !toKeep.some((k) => k.key === derivedKey) &&
        item.hour === desiredItem.hour &&
        item.minute === desiredItem.minute
      ) {
        toKeep.push({ key: derivedKey, identifier: item.identifier });
        matchedIdentifiers.add(item.identifier);
      }
    }
  }

  const keptKeys = new Set(toKeep.map((k) => k.key));

  // Determine which desired reminders need scheduling
  const toSchedule = desired.filter((d) => !keptKeys.has(d.key));

  // Determine which existing managed reminders must be cancelled
  const toCancel: string[] = [];
  for (const item of existing) {
    if (matchedIdentifiers.has(item.identifier)) continue;

    const isOurAppReminder =
      item.reminderSystem === REMINDER_SYSTEM_TAG ||
      legacyIdSet.has(item.identifier) ||
      Object.values(keyToIdentifier).includes(item.identifier);

    // Cancel ONLY reminders that strictly belong to our reminder system
    if (isOurAppReminder) {
      toCancel.push(item.identifier);
    }
  }

  return { toKeep, toCancel, toSchedule };
}

// ---------------------------------------------------------------------------
// 6. Navigation Route Whitelist & Validation Rules
// ---------------------------------------------------------------------------

export const ALLOWED_NOTIFICATION_ROUTES = [
  '/(tabs)/',
  '/(tabs)/add',
  '/(tabs)/logs',
  '/(tabs)/insights',
  '/(tabs)/notifications',
] as const;

export type AllowedNotificationRoute = typeof ALLOWED_NOTIFICATION_ROUTES[number];

/**
 * Validates an incoming URL string against the internal route whitelist.
 * Rejects external URLs, malicious traversal, malformed strings, or unauthorized routes.
 */
export function validateNotificationDestination(rawUrl: unknown): AllowedNotificationRoute | null {
  if (typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();

  // Normalize shorthand routes
  if (trimmed === '/' || trimmed === '/(tabs)' || trimmed === '/(tabs)/') {
    return '/(tabs)/';
  }
  if (trimmed === '/add' || trimmed === '/(tabs)/add') {
    return '/(tabs)/add';
  }
  if (trimmed === '/logs' || trimmed === '/(tabs)/logs') {
    return '/(tabs)/logs';
  }
  if (trimmed === '/insights' || trimmed === '/(tabs)/insights') {
    return '/(tabs)/insights';
  }
  if (trimmed === '/notifications' || trimmed === '/(tabs)/notifications') {
    return '/(tabs)/notifications';
  }

  // Exact whitelist match check
  for (const allowed of ALLOWED_NOTIFICATION_ROUTES) {
    if (trimmed === allowed) return allowed;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 7. Trigger Extraction & Active Alarm Diagnostics
// ---------------------------------------------------------------------------

/**
 * Pure function: Extracts and normalizes scheduled notification data across Android and iOS trigger schemas.
 * Supports iOS dateComponents as well as flat trigger properties, with payload metadata fallback.
 */
export function extractScheduledRecordData(
  identifier: string,
  trigger: any,
  content: any
): ExistingScheduledRecord {
  // 1. Weekday extraction: top-level trigger -> dateComponents -> content data fallback
  let weekday: number | undefined;
  if (typeof trigger?.weekday === 'number' && Number.isInteger(trigger.weekday) && trigger.weekday >= 1 && trigger.weekday <= 7) {
    weekday = trigger.weekday;
  } else if (typeof trigger?.dateComponents?.weekday === 'number' && Number.isInteger(trigger.dateComponents.weekday) && trigger.dateComponents.weekday >= 1 && trigger.dateComponents.weekday <= 7) {
    weekday = trigger.dateComponents.weekday;
  } else if (typeof content?.data?.weekday === 'number' && Number.isInteger(content.data.weekday) && content.data.weekday >= 1 && content.data.weekday <= 7) {
    weekday = content.data.weekday;
  }

  // 2. Hour extraction: top-level trigger -> dateComponents
  let hour: number | undefined;
  if (typeof trigger?.hour === 'number' && Number.isInteger(trigger.hour) && trigger.hour >= 0 && trigger.hour <= 23) {
    hour = trigger.hour;
  } else if (typeof trigger?.dateComponents?.hour === 'number' && Number.isInteger(trigger.dateComponents.hour) && trigger.dateComponents.hour >= 0 && trigger.dateComponents.hour <= 23) {
    hour = trigger.dateComponents.hour;
  }

  // 3. Minute extraction: top-level trigger -> dateComponents
  let minute: number | undefined;
  if (typeof trigger?.minute === 'number' && Number.isInteger(trigger.minute) && trigger.minute >= 0 && trigger.minute <= 59) {
    minute = trigger.minute;
  } else if (typeof trigger?.dateComponents?.minute === 'number' && Number.isInteger(trigger.dateComponents.minute) && trigger.dateComponents.minute >= 0 && trigger.dateComponents.minute <= 59) {
    minute = trigger.dateComponents.minute;
  }

  return {
    identifier,
    weekday,
    hour,
    minute,
    reminderSystem: typeof content?.data?.reminderSystem === 'string' ? content.data.reminderSystem : undefined,
    moment: typeof content?.data?.moment === 'string' ? content.data.moment : undefined,
    url: typeof content?.data?.url === 'string' ? content.data.url : undefined,
  };
}

/**
 * Pure function: Computes the closest upcoming reminder strictly from actual active managed records.
 * Returns null if records list is empty or if no records contain valid time components.
 */
export function computeNextReminderFromRecords(
  records: ExistingScheduledRecord[],
  referenceDate: Date = new Date()
): { weekday: number; moment: ReminderMoment; time: string; title: string } | null {
  const validRecords = records.filter(
    (r) =>
      r.weekday !== undefined &&
      r.hour !== undefined &&
      r.minute !== undefined &&
      r.moment !== undefined
  );

  if (validRecords.length === 0) {
    return null;
  }

  // JS: 0=Sun, 1=Mon, ..., 6=Sat. Voice: 1=Sun, ..., 7=Sat
  const currentVoiceWeekday = referenceDate.getDay() + 1;
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  let closestDiffMinutes = Infinity;
  let nextRecord: ExistingScheduledRecord | null = null;

  for (const r of validRecords) {
    let dayOffset = r.weekday! - currentVoiceWeekday;
    if (dayOffset < 0 || (dayOffset === 0 && r.hour! * 60 + r.minute! <= currentMinutes)) {
      dayOffset += 7;
    }
    const totalMinutesUntil = dayOffset * 24 * 60 + (r.hour! * 60 + r.minute! - currentMinutes);
    if (totalMinutesUntil < closestDiffMinutes) {
      closestDiffMinutes = totalMinutesUntil;
      nextRecord = r;
    }
  }

  if (!nextRecord) return null;

  const hour = nextRecord.hour!;
  const minute = nextRecord.minute!;
  const timeFormatted = `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

  const voiceDay = WEEKLY_VOICE.find((d) => d.weekday === nextRecord!.weekday);
  const voiceCopy = nextRecord.moment ? voiceDay?.moments[nextRecord.moment as ReminderMoment] : undefined;
  const title = voiceCopy?.title ?? 'Attendance check-in';

  return {
    weekday: nextRecord.weekday!,
    moment: nextRecord.moment as ReminderMoment,
    time: timeFormatted,
    title,
  };
}
