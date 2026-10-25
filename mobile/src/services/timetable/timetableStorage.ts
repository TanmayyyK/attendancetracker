/**
 * Versioned AsyncStorage Persistence for Academic Timetable & Holidays
 *
 * Implements resilient loading, saving, slot validation, and holiday management.
 * Supports dependency-injected storage adapter for deterministic, isolated unit testing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  TIMETABLE_STORAGE_KEY,
  type TimetableConfigV1,
  type TimetableSlot,
  type AcademicHoliday,
} from '../../types/timetable.ts';

import {
  createDefaultTimetableConfig,
  validateAndSanitizeConfig,
  sanitizeSlot,
  sanitizeHoliday,
  detectSlotOverlap,
  sortSlotsChronologically,
} from '../../utils/timetablePolicy.ts';

import { isValidCalendarDate } from '../../utils/dates.ts';

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
}

/**
 * Loads the timetable configuration from storage.
 * If data is corrupt or missing, returns a safe default without overwriting existing data.
 */
export async function loadTimetableConfig(
  storage: StorageAdapter = AsyncStorage
): Promise<{ config: TimetableConfigV1; isCorrupt: boolean }> {
  try {
    const raw = await storage.getItem(TIMETABLE_STORAGE_KEY);
    if (!raw) {
      return { config: createDefaultTimetableConfig(), isCorrupt: false };
    }

    const parsed = JSON.parse(raw);
    const { valid, config } = validateAndSanitizeConfig(parsed);

    if (!valid) {
      console.warn('Timetable storage payload failed schema validation, using safe fallback.');
      return { config, isCorrupt: true };
    }

    return { config, isCorrupt: false };
  } catch (err) {
    console.warn('Failed to parse timetable configuration from storage:', err);
    return { config: createDefaultTimetableConfig(), isCorrupt: true };
  }
}

/**
 * Persists the entire timetable configuration to storage.
 */
export async function saveTimetableConfig(
  config: TimetableConfigV1,
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  try {
    const { valid, config: sanitized } = validateAndSanitizeConfig(config);
    if (!valid) {
      return false;
    }

    sanitized.updatedAt = new Date().toISOString();
    await storage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch (err) {
    console.warn('Failed to save timetable configuration:', err);
    return false;
  }
}

/**
 * Adds or updates a recurring class slot.
 * Validates time constraints and checks for time overlaps on the same day.
 */
export async function addOrUpdateSlot(
  slot: TimetableSlot,
  storage: StorageAdapter = AsyncStorage
): Promise<{ success: boolean; error?: string }> {
  const { slot: sanitized, error: slotError } = sanitizeSlot(slot);
  if (!sanitized || slotError) {
    return { success: false, error: slotError ?? 'Invalid slot parameters' };
  }

  const { config } = await loadTimetableConfig(storage);

  // Check for time overlap on the same day with any OTHER slot
  for (const existing of config.slots) {
    if (existing.id !== sanitized.id && existing.day === sanitized.day) {
      if (detectSlotOverlap(sanitized, existing)) {
        return {
          success: false,
          error: `Time overlaps with existing ${existing.subject} (${existing.startTime} - ${existing.endTime}) on ${existing.day}.`,
        };
      }
    }
  }

  // Update if exists, otherwise append
  const index = config.slots.findIndex((s) => s.id === sanitized.id);
  if (index >= 0) {
    config.slots[index] = sanitized;
  } else {
    config.slots.push(sanitized);
  }

  config.slots = sortSlotsChronologically(config.slots);
  const saved = await saveTimetableConfig(config, storage);
  return { success: saved, error: saved ? undefined : 'Failed to write to storage' };
}

/**
 * Removes a recurring class slot by ID.
 */
export async function removeSlot(
  slotId: string,
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  if (!slotId) return false;
  const { config } = await loadTimetableConfig(storage);
  const initialLength = config.slots.length;
  config.slots = config.slots.filter((s) => s.id !== slotId);

  if (config.slots.length === initialLength) {
    return true; // Already absent
  }

  return await saveTimetableConfig(config, storage);
}

/**
 * Adds an academic holiday or non-teaching day.
 */
export async function addHoliday(
  holiday: AcademicHoliday,
  storage: StorageAdapter = AsyncStorage
): Promise<{ success: boolean; error?: string }> {
  const { holiday: sanitized, error: holError } = sanitizeHoliday(holiday);
  if (!sanitized || holError) {
    return { success: false, error: holError ?? 'Invalid holiday parameters' };
  }

  const { config } = await loadTimetableConfig(storage);

  // Check if holiday already exists for this date
  const existingDate = config.holidays.find((h) => h.date === sanitized.date && h.id !== sanitized.id);
  if (existingDate) {
    return {
      success: false,
      error: `A holiday is already configured on ${sanitized.date} (${existingDate.name}).`,
    };
  }

  const index = config.holidays.findIndex((h) => h.id === sanitized.id);
  if (index >= 0) {
    config.holidays[index] = sanitized;
  } else {
    config.holidays.push(sanitized);
  }

  config.holidays.sort((a, b) => a.date.localeCompare(b.date));
  const saved = await saveTimetableConfig(config, storage);
  return { success: saved, error: saved ? undefined : 'Failed to write to storage' };
}

/**
 * Removes a holiday by ID.
 */
export async function removeHoliday(
  holidayId: string,
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  if (!holidayId) return false;
  const { config } = await loadTimetableConfig(storage);
  const initialLength = config.holidays.length;
  config.holidays = config.holidays.filter((h) => h.id !== holidayId);

  if (config.holidays.length === initialLength) {
    return true;
  }

  return await saveTimetableConfig(config, storage);
}

/**
 * Updates the effective-from date for the timetable.
 */
export async function setEffectiveFromDate(
  effectiveFrom: string,
  storage: StorageAdapter = AsyncStorage
): Promise<{ success: boolean; error?: string }> {
  if (!isValidCalendarDate(effectiveFrom)) {
    return { success: false, error: 'Invalid calendar date format (expected YYYY-MM-DD)' };
  }

  const { config } = await loadTimetableConfig(storage);
  config.effectiveFrom = effectiveFrom.trim();
  const saved = await saveTimetableConfig(config, storage);
  return { success: saved, error: saved ? undefined : 'Failed to write to storage' };
}

/**
 * Resets timetable storage completely.
 */
export async function resetTimetableStorage(
  storage: StorageAdapter = AsyncStorage
): Promise<void> {
  if (typeof storage.removeItem === 'function') {
    await storage.removeItem(TIMETABLE_STORAGE_KEY);
  } else {
    await storage.setItem(TIMETABLE_STORAGE_KEY, '');
  }
}
