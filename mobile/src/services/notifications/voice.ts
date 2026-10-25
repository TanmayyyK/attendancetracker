/**
 * Preserved Reminder Copy, Schedules, and Destination Contracts
 *
 * Verbatim copy from the original attendance reminder system.
 * Must not be modified without explicit owner approval.
 */

import type { DayVoice, ReminderMoment } from './types';

export const REMINDER_CHANNEL = 'attendance-reminders';
export const REMINDER_CATEGORY = 'attendance-check-in';
export const REMINDER_LOG_ACTION = 'open-attendance-log';
export const REMINDER_STATE_KEY = '@attendance/reminder-state';
export const REMINDER_SYSTEM_TAG = 'attendance-v3';

export const DEFAULT_REMINDER_TIMES: Record<ReminderMoment, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 15 },
  wrapUp: { hour: 16, minute: 15 },
  night: { hour: 21, minute: 15 },
};

export const WELCOME_NOTIFICATION = {
  title: 'You’re all set ✨',
  body: 'Welcome in! Your gentle attendance check-ins are ready whenever you need them.',
  destination: '/(tabs)/' as const,
};

/**
 * Each weekday gets its own recurring copy.
 * Preserves the exact 21 weekly messages and destinations.
 */
export const WEEKLY_VOICE: DayVoice[] = [
  {
    weekday: 1, // Sunday
    moments: {
      morning: {
        title: 'Sunday reset ✨',
        body: 'A tiny plan now makes the whole week feel lighter.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Little Sunday check-in 🌷',
        body: 'If you had class today, save the attendance while it is still fresh.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'Future-you says thank you 🫶',
        body: 'One quick attendance update, then proper rest.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 2, // Monday
    moments: {
      morning: {
        title: 'Fresh-week energy ☀️',
        body: 'Show up for today’s little wins. Your streak is cheering for you.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Monday, logged ✍️',
        body: 'Classes done? Give today its attendance check before you move on.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'Close Monday softly 🌙',
        body: 'A 10-second log keeps your dashboard honest.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 3, // Tuesday
    moments: {
      morning: {
        title: 'You’ve got this, star 💜',
        body: 'Small consistency is still consistency. Make today count.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Tiny Tuesday win ✨',
        body: 'Mark today’s classes now and keep the numbers on your side.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'A small favour for tomorrow 🌙',
        body: 'Log today once, then leave the rest for morning-you.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 4, // Wednesday
    moments: {
      morning: {
        title: 'Midweek glow-up 🌼',
        body: 'You are closer than you think. Let’s make today visible.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Wednesday, wrapped 🌿',
        body: 'Your future stats need one thing from you: today’s attendance.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'Keep the streak cozy ✨',
        body: 'A quick check-in now means one less thing to remember later.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 5, // Thursday
    moments: {
      morning: {
        title: 'Thursday focus mode 🌸',
        body: 'Make room for the class, the notes, and your little progress.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Thursday: done and dusted 💫',
        body: 'Tap once to save today’s attendance before the evening begins.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'One last tiny task 🫶',
        body: 'Your attendance tracker is ready when you are.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 6, // Friday
    moments: {
      morning: {
        title: 'Friday, but make it count ✨',
        body: 'Finish the week strong—one class at a time.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Friday check-in 💜',
        body: 'Before weekend brain arrives, save today’s classes.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'Weekend almost unlocked 🌙',
        body: 'A quick attendance log and you are officially free to unwind.',
        destination: '/(tabs)/add',
      },
    },
  },
  {
    weekday: 7, // Saturday
    moments: {
      morning: {
        title: 'Saturday, your pace 🌞',
        body: 'Whether it is class or catch-up, keep your progress in view.',
        destination: '/(tabs)/',
      },
      wrapUp: {
        title: 'Saturday’s little win 🌷',
        body: 'If today had classes, give them their check before you switch off.',
        destination: '/(tabs)/add',
      },
      night: {
        title: 'Soft landing for the week 🌙',
        body: 'One last check-in, then enjoy a guilt-free night.',
        destination: '/(tabs)/add',
      },
    },
  },
];
