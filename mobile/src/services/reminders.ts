import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api';
import { palette } from '@/design/tokens';

const REMINDER_CHANNEL = 'attendance-reminders';
const REMINDER_CATEGORY = 'attendance-check-in';
const REMINDER_STATE_KEY = '@attendance/reminder-state';
const REMINDER_VERSION = 3;

export const REMINDER_LOG_ACTION = 'open-attendance-log';

type ReminderMoment = 'morning' | 'wrapUp' | 'night';

interface ReminderCopy {
  title: string;
  body: string;
  destination: '/(tabs)/' | '/(tabs)/add';
}

interface DayVoice {
  weekday: number;
  moments: Record<ReminderMoment, ReminderCopy>;
}

interface ManagedReminderState {
  version: number;
  identifiers: string[];
}

const REMINDER_TIMES: Record<ReminderMoment, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 15 },
  wrapUp: { hour: 16, minute: 15 },
  night: { hour: 21, minute: 15 },
};

// Each weekday gets its own recurring copy. This creates a personal rhythm
// without scheduling a noisy stream of one-off notifications.
const WEEKLY_VOICE: DayVoice[] = [
  {
    weekday: 1,
    moments: {
      morning: { title: 'Sunday reset ✨', body: 'A tiny plan now makes the whole week feel lighter.', destination: '/(tabs)/' },
      wrapUp: { title: 'Little Sunday check-in 🌷', body: 'If you had class today, save the attendance while it is still fresh.', destination: '/(tabs)/add' },
      night: { title: 'Future-you says thank you 🫶', body: 'One quick attendance update, then proper rest.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 2,
    moments: {
      morning: { title: 'Fresh-week energy ☀️', body: 'Show up for today’s little wins. Your streak is cheering for you.', destination: '/(tabs)/' },
      wrapUp: { title: 'Monday, logged ✍️', body: 'Classes done? Give today its attendance check before you move on.', destination: '/(tabs)/add' },
      night: { title: 'Close Monday softly 🌙', body: 'A 10-second log keeps your dashboard honest.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 3,
    moments: {
      morning: { title: 'You’ve got this, star 💜', body: 'Small consistency is still consistency. Make today count.', destination: '/(tabs)/' },
      wrapUp: { title: 'Tiny Tuesday win ✨', body: 'Mark today’s classes now and keep the numbers on your side.', destination: '/(tabs)/add' },
      night: { title: 'A small favour for tomorrow 🌙', body: 'Log today once, then leave the rest for morning-you.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 4,
    moments: {
      morning: { title: 'Midweek glow-up 🌼', body: 'You are closer than you think. Let’s make today visible.', destination: '/(tabs)/' },
      wrapUp: { title: 'Wednesday, wrapped 🌿', body: 'Your future stats need one thing from you: today’s attendance.', destination: '/(tabs)/add' },
      night: { title: 'Keep the streak cozy ✨', body: 'A quick check-in now means one less thing to remember later.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 5,
    moments: {
      morning: { title: 'Thursday focus mode 🌸', body: 'Make room for the class, the notes, and your little progress.', destination: '/(tabs)/' },
      wrapUp: { title: 'Thursday: done and dusted 💫', body: 'Tap once to save today’s attendance before the evening begins.', destination: '/(tabs)/add' },
      night: { title: 'One last tiny task 🫶', body: 'Your attendance tracker is ready when you are.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 6,
    moments: {
      morning: { title: 'Friday, but make it count ✨', body: 'Finish the week strong—one class at a time.', destination: '/(tabs)/' },
      wrapUp: { title: 'Friday check-in 💜', body: 'Before weekend brain arrives, save today’s classes.', destination: '/(tabs)/add' },
      night: { title: 'Weekend almost unlocked 🌙', body: 'A quick attendance log and you are officially free to unwind.', destination: '/(tabs)/add' },
    },
  },
  {
    weekday: 7,
    moments: {
      morning: { title: 'Saturday, your pace 🌞', body: 'Whether it is class or catch-up, keep your progress in view.', destination: '/(tabs)/' },
      wrapUp: { title: 'Saturday’s little win 🌷', body: 'If today had classes, give them their check before you switch off.', destination: '/(tabs)/add' },
      night: { title: 'Soft landing for the week 🌙', body: 'One last check-in, then enjoy a guilt-free night.', destination: '/(tabs)/add' },
    },
  },
];

function isManagedReminder(request: Notifications.NotificationRequest): boolean {
  return request.content.data?.reminderSystem === 'attendance-v3';
}

function isLegacyAttendanceReminder(request: Notifications.NotificationRequest): boolean {
  // Version 1 and 2 reminders all navigated to the dashboard and had no owner.
  return request.content.data?.url === '/(tabs)/' && !request.content.data?.reminderSystem;
}

async function getStoredState(): Promise<ManagedReminderState | null> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagedReminderState;
    return Array.isArray(parsed.identifiers) ? parsed : null;
  } catch {
    return null;
  }
}

async function configurePresentation() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Attendance check-ins',
      description: 'Gentle prompts to keep your attendance current.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 160],
      lightColor: palette.dark.accent,
      sound: 'default',
    });
  }

  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      {
        identifier: REMINDER_LOG_ACTION,
        buttonTitle: 'Log today',
        options: { opensAppToForeground: true },
      },
    ]);
  }
}

async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.status !== 'granted') return false;

  // This is the only immediate notification. It confirms the user's choice
  // and introduces the reminder rhythm without waiting for the first schedule.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'You’re all set ✨',
      body: 'Welcome in! Your gentle attendance check-ins are ready whenever you need them.',
      sound: 'default',
      categoryIdentifier: REMINDER_CATEGORY,
      data: { url: '/(tabs)/', reminderSystem: 'attendance-v3', moment: 'welcome' },
    },
    trigger: null,
  });
  return true;
}

async function syncReminderPlan() {
  const [storedState, scheduled] = await Promise.all([
    getStoredState(),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);
  const activeIdentifiers = new Set(scheduled.map((request) => request.identifier));
  const expectedCount = WEEKLY_VOICE.length * Object.keys(REMINDER_TIMES).length;

  if (
    storedState?.version === REMINDER_VERSION &&
    storedState.identifiers.length === expectedCount &&
    storedState.identifiers.every((identifier) => activeIdentifiers.has(identifier))
  ) {
    return;
  }

  // Cancel only reminders this app owns. The legacy predicate is deliberately
  // narrow so future notification features are never removed by this migration.
  const identifiersToCancel = storedState?.identifiers ?? scheduled
    .filter((request) => isManagedReminder(request) || isLegacyAttendanceReminder(request))
    .map((request) => request.identifier);
  await Promise.all(identifiersToCancel.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));

  const identifiers: string[] = [];
  try {
    for (const day of WEEKLY_VOICE) {
      for (const moment of Object.keys(REMINDER_TIMES) as ReminderMoment[]) {
        const copy = day.moments[moment];
        const time = REMINDER_TIMES[moment];
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: copy.title,
            body: copy.body,
            sound: 'default',
            categoryIdentifier: REMINDER_CATEGORY,
            data: {
              url: copy.destination,
              reminderSystem: 'attendance-v3',
              moment,
              weekday: day.weekday,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day.weekday,
            hour: time.hour,
            minute: time.minute,
            channelId: REMINDER_CHANNEL,
          },
        });
        identifiers.push(identifier);
      }
    }
    await AsyncStorage.setItem(REMINDER_STATE_KEY, JSON.stringify({ version: REMINDER_VERSION, identifiers }));
  } catch (error) {
    await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
    throw error;
  }
}

async function registerDeviceForPush() {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (!Device.isDevice || isExpoGo) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(token, Device.modelName ?? undefined);
}

/** Configure local reminders, refresh the managed schedule, and register push delivery. */
export async function setupReminderSystem() {
  try {
    await configurePresentation();
    if (!(await requestPermission())) return;

    await Promise.all([syncReminderPlan(), registerDeviceForPush()]);
  } catch (error) {
    // A reminder issue should never block the app's primary attendance workflow.
    console.warn('Unable to configure attendance reminders', error);
  }
}
