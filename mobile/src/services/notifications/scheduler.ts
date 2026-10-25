/**
 * Idempotent Notification Scheduler, Reconciliation Engine, and Diagnostics
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api';
import { palette } from '@/design/tokens';
import type {
  ReminderMoment,
  NotificationPreferences,
  ManagedReminderState,
  DesiredReminder,
  ExistingScheduledRecord,
  ReconciliationPlan,
  QuietHoursConfig,
  ScheduleDiagnostics,
  PermissionStatus,
} from './types';
import {
  REMINDER_CHANNEL,
  REMINDER_CATEGORY,
  REMINDER_LOG_ACTION,
  REMINDER_SYSTEM_TAG,
  WEEKLY_VOICE,
  WELCOME_NOTIFICATION,
} from './voice';
import {
  getStoredPreferences,
  saveStoredPreferences,
  getStoredReminderState,
  saveStoredReminderState,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from './storage';

import {
  formatReminderKey,
  parseReminderKey,
  isTimeInQuietHours,
  computeDesiredReminders,
  computeReconciliationPlan,
  extractScheduledRecordData,
  computeNextReminderFromRecords,
} from './rules';

export {
  formatReminderKey,
  parseReminderKey,
  isTimeInQuietHours,
  computeDesiredReminders,
  computeReconciliationPlan,
  extractScheduledRecordData,
  computeNextReminderFromRecords,
};

let isChannelConfigured = false;

/**
 * Configure native Android notification channel and iOS category.
 * Gracefully handles Expo Go on Android where NotificationsChannelsProvider is unavailable.
 */
export async function configureNotificationPresentation() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: 'Attendance check-ins',
        description: 'Gentle prompts to keep your attendance current.',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 160],
        lightColor: palette.dark.accent,
        sound: 'default',
      });
      isChannelConfigured = true;
    } catch (channelErr) {
      isChannelConfigured = false;
      console.warn('Unable to configure Android notification channel, using system default:', channelErr);
    }
  }

  if (Platform.OS === 'ios') {
    try {
      await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
        {
          identifier: REMINDER_LOG_ACTION,
          buttonTitle: 'Log today',
          options: { opensAppToForeground: true },
        },
      ]);
    } catch (categoryErr) {
      console.warn('Unable to configure iOS notification category:', categoryErr);
    }
  }
}

/**
 * Checks system notification permissions without automatically prompting.
 */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status === 'granted') return 'granted';
    if (settings.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Explicit user request for notification permissions.
 * Sends welcome notification only upon fresh first grant.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;

    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return false;

    // Send the one-time welcome greeting confirming the choice
    await Notifications.scheduleNotificationAsync({
      content: {
        title: WELCOME_NOTIFICATION.title,
        body: WELCOME_NOTIFICATION.body,
        sound: 'default',
        categoryIdentifier: REMINDER_CATEGORY,
        data: { url: WELCOME_NOTIFICATION.destination, reminderSystem: REMINDER_SYSTEM_TAG, moment: 'welcome' },
      },
      trigger: null,
    });

    return true;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Fetches scheduled OS notifications and maps them into ExistingScheduledRecord.
 * Correctly normalizes Android flat triggers and iOS dateComponents calendar triggers.
 */
export async function fetchExistingScheduledRecords(): Promise<ExistingScheduledRecord[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((req) => extractScheduledRecordData(req.identifier, req.trigger, req.content));
  } catch (err) {
    console.warn('Failed to query scheduled notifications:', err);
    return [];
  }
}

// In-memory Promise chain serializing reconciliation tasks to prevent concurrent races
let reconciliationChain: Promise<boolean> = Promise.resolve(true);

/**
 * Internal reconciliation executor: reads preferences, compares desired against OS scheduled,
 * and applies minimal atomic diff.
 */
async function executeReconciliation(customPrefs?: NotificationPreferences): Promise<boolean> {
  try {
    const preferences = customPrefs ?? (await getStoredPreferences());
    const [storedState, existingRecords] = await Promise.all([
      getStoredReminderState(),
      fetchExistingScheduledRecords(),
    ]);

    const desired = computeDesiredReminders(preferences);
    const plan = computeReconciliationPlan(desired, existingRecords, storedState);

    // Cancel obsolete/modified reminders
    if (plan.toCancel.length > 0) {
      await Promise.all(
        plan.toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
      );
    }

    // Schedule missing/updated reminders
    const newlyScheduledMapping: Record<string, string> = {};
    for (const item of plan.toKeep) {
      newlyScheduledMapping[item.key] = item.identifier;
    }

    for (const item of plan.toSchedule) {
      try {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.body,
            sound: 'default',
            categoryIdentifier: REMINDER_CATEGORY,
            data: {
              url: item.destination,
              reminderSystem: REMINDER_SYSTEM_TAG,
              moment: item.moment,
              weekday: item.weekday,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: item.weekday,
            hour: item.hour,
            minute: item.minute,
            ...(isChannelConfigured ? { channelId: REMINDER_CHANNEL } : {}),
          },
        });
        newlyScheduledMapping[item.key] = identifier;
      } catch (scheduleErr) {
        console.warn(`Failed to schedule reminder ${item.key}:`, scheduleErr);
      }
    }

    // Persist new mapping state
    await saveStoredReminderState({
      version: 4,
      keyToIdentifier: newlyScheduledMapping,
      lastReconciledAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.warn('Reconciliation failed:', error);
    return false;
  }
}

/**
 * Serialized reconciliation runner:
 * Queues concurrent calls onto a shared Promise chain so rapid toggles converge sequentially
 * without race conditions, duplicate scheduling, or unhandled promise rejection blockage.
 */
export function reconcileReminders(customPrefs?: NotificationPreferences): Promise<boolean> {
  const nextTask = reconciliationChain.then(
    () => executeReconciliation(customPrefs),
    () => executeReconciliation(customPrefs)
  );
  reconciliationChain = nextTask.catch(() => false);
  return nextTask;
}

/**
 * Computes diagnostic information about reminder system health.
 * Accurately derives status and next reminder strictly from actual active managed records.
 */
export async function getScheduleDiagnostics(): Promise<ScheduleDiagnostics> {
  const [permission, preferences, existing] = await Promise.all([
    getPermissionStatus(),
    getStoredPreferences(),
    fetchExistingScheduledRecords(),
  ]);

  const managedRecords = existing.filter((e) => e.reminderSystem === REMINDER_SYSTEM_TAG);
  const scheduledCount = managedRecords.length;
  const desired = computeDesiredReminders(preferences);
  const desiredCount = desired.length;

  let schedulerStatus: ScheduleDiagnostics['schedulerStatus'] = 'healthy';
  let error: string | null = null;

  if (permission !== 'granted') {
    schedulerStatus = 'permission_required';
    error = 'Notification permission is not granted';
  } else if (!preferences.enabled) {
    schedulerStatus = 'disabled';
  } else if (scheduledCount === 0 && preferences.activeDays.length > 0) {
    schedulerStatus = 'degraded';
    error = 'Reminders are enabled but none are active in the system scheduler';
  } else if (scheduledCount < desiredCount) {
    schedulerStatus = 'degraded';
    error = `Only ${scheduledCount} of ${desiredCount} expected check-ins are active`;
  }

  // Calculate next scheduled reminder STRICTLY from actual active managed notifications
  let nextReminder: ScheduleDiagnostics['nextReminder'] = null;
  if (permission === 'granted' && preferences.enabled && managedRecords.length > 0) {
    nextReminder = computeNextReminderFromRecords(managedRecords, new Date());
  }

  return {
    permissionStatus: permission,
    schedulerStatus,
    scheduledCount,
    nextReminder,
    lastReconciled: new Date().toLocaleTimeString(),
    error,
  };
}

/**
 * Triggers an immediate local test notification to verify presentation.
 */
export async function triggerTestNotification(): Promise<boolean> {
  try {
    const permission = await getPermissionStatus();
    if (permission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }

    await configureNotificationPresentation();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test Check-in ✨',
        body: 'Your notification system is working and ready to keep your attendance on track.',
        sound: 'default',
        categoryIdentifier: REMINDER_CATEGORY,
        data: { url: '/(tabs)/', reminderSystem: REMINDER_SYSTEM_TAG, moment: 'test' },
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('Failed to trigger test notification:', err);
    return false;
  }
}

/**
 * Register push token with backend if on a physical device.
 */
export async function registerDeviceForPush(): Promise<void> {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (!Device.isDevice || isExpoGo) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerPushToken(token, Device.modelName ?? undefined);
  } catch (err) {
    console.warn('Unable to register push token:', err);
  }
}

/**
 * Complete setup entry point called on app startup.
 * Restores first-launch permission prompt when undetermined without re-prompting if denied.
 */
export async function setupReminderSystem(): Promise<void> {
  try {
    await configureNotificationPresentation();
    let permission = await getPermissionStatus();

    // If permission has never been prompted (first launch), request permission
    if (permission === 'undetermined') {
      const granted = await requestNotificationPermission();
      permission = granted ? 'granted' : await getPermissionStatus();
    }

    // If permission is denied or undetermined, do not attempt to schedule
    if (permission !== 'granted') return;

    await Promise.all([reconcileReminders(), registerDeviceForPush()]);
  } catch (error) {
    console.warn('Unable to configure attendance reminders:', error);
  }
}
