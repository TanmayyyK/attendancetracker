/**
 * Versioned AsyncStorage Persistence for Student Subject Targets
 *
 * Implements safe reading, writing, resetting, and error fallbacks for per-subject targets.
 * Supports dependency-injected storage adapter for deterministic, isolated unit testing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TARGET_STORAGE_KEY,
  sanitizeStoredTargets,
  validateTargetPercentage,
} from '../../utils/targetPolicy.ts';
import type { StoredSubjectTargetsV1 } from '../../types/attendanceIntelligence.ts';

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
}

/**
 * Loads and sanitizes all custom subject targets from storage.
 * Falls back to an empty dictionary on corrupt or missing data without throwing.
 */
export async function getStoredTargets(
  storage: StorageAdapter = AsyncStorage
): Promise<Record<string, number>> {
  try {
    const raw = await storage.getItem(TARGET_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeStoredTargets(parsed);
    return sanitized.targets;
  } catch (err) {
    console.warn('Failed to load subject targets from storage, falling back to defaults:', err);
    return {};
  }
}

/**
 * Persists a custom target for a specific subject after strict range validation [60..95].
 * Returns false if target is outside allowed range or persistence fails.
 */
export async function saveSubjectTarget(
  subject: string,
  target: number,
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  const validTarget = validateTargetPercentage(target);
  if (validTarget === null) {
    return false;
  }

  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
  if (!cleanSubject) {
    return false;
  }

  try {
    const raw = await storage.getItem(TARGET_STORAGE_KEY);
    let currentTargets: Record<string, number> = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        currentTargets = sanitizeStoredTargets(parsed).targets;
      } catch {
        currentTargets = {};
      }
    }

    const updatedTargets = { ...currentTargets, [cleanSubject]: validTarget };

    const payload: StoredSubjectTargetsV1 = {
      version: 1,
      updatedAt: new Date().toISOString(),
      targets: updatedTargets,
    };

    await storage.setItem(TARGET_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn(`Failed to persist target for subject "${subject}":`, err);
    return false;
  }
}

/**
 * Resets a subject target to institutional default (removes the subject's custom entry).
 */
export async function removeSubjectTarget(
  subject: string,
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
  if (!cleanSubject) {
    return false;
  }

  try {
    const raw = await storage.getItem(TARGET_STORAGE_KEY);
    if (!raw) {
      return true; // Already default - no targets stored
    }

    let currentTargets: Record<string, number> = {};
    try {
      const parsed = JSON.parse(raw);
      currentTargets = sanitizeStoredTargets(parsed).targets;
    } catch {
      currentTargets = {};
    }

    if (!(cleanSubject in currentTargets)) {
      return true; // Already default
    }

    const { [cleanSubject]: _, ...remainingTargets } = currentTargets;

    const payload: StoredSubjectTargetsV1 = {
      version: 1,
      updatedAt: new Date().toISOString(),
      targets: remainingTargets,
    };

    await storage.setItem(TARGET_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn(`Failed to remove custom target for subject "${subject}":`, err);
    return false;
  }
}

/**
 * Clears all custom subject targets, restoring all subjects to 75% default.
 */
export async function clearAllSubjectTargets(
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  try {
    const payload: StoredSubjectTargetsV1 = {
      version: 1,
      updatedAt: new Date().toISOString(),
      targets: {},
    };

    await storage.setItem(TARGET_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('Failed to clear subject targets:', err);
    return false;
  }
}
