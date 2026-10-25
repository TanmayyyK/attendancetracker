/**
 * Versioned Local Preference and Reminder State Persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  NotificationPreferences,
  ManagedReminderState,
} from './types';
import { REMINDER_STATE_KEY } from './voice';
import {
  DEFAULT_QUIET_HOURS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  validatePreferences,
} from './rules';

export const PREFERENCES_STORAGE_KEY = '@attendance/notification-preferences-v1';

export {
  DEFAULT_QUIET_HOURS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  validatePreferences,
};

export async function getStoredPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    const parsed = JSON.parse(raw);
    return validatePreferences(parsed);
  } catch (err) {
    console.warn('Failed to load notification preferences, using defaults:', err);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export async function saveStoredPreferences(prefs: NotificationPreferences): Promise<boolean> {
  try {
    const validated = validatePreferences(prefs);
    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch (err) {
    console.warn('Failed to persist notification preferences:', err);
    return false;
  }
}

export async function getStoredReminderState(): Promise<ManagedReminderState | null> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Support Version 4 (keyToIdentifier mapping)
    if (parsed.version === 4 && parsed.keyToIdentifier && typeof parsed.keyToIdentifier === 'object') {
      return parsed as ManagedReminderState;
    }

    // Support Version 3 (legacy array of string identifiers)
    if (parsed.version === 3 && Array.isArray(parsed.identifiers)) {
      return {
        version: 3,
        keyToIdentifier: {},
        legacyIdentifiers: parsed.identifiers,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function saveStoredReminderState(state: ManagedReminderState): Promise<boolean> {
  try {
    await AsyncStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('Failed to persist managed reminder state:', err);
    return false;
  }
}
