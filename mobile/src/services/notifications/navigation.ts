/**
 * Safe Notification Deep-Link Router & Response Handler
 */

import { router, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { REMINDER_LOG_ACTION } from './voice';
import {
  ALLOWED_NOTIFICATION_ROUTES,
  type AllowedNotificationRoute,
  validateNotificationDestination,
} from './rules';

export {
  ALLOWED_NOTIFICATION_ROUTES,
  type AllowedNotificationRoute,
  validateNotificationDestination,
};

// In-memory navigation readiness and pending queue
let isNavigationReady = false;
let pendingDestination: AllowedNotificationRoute | null = null;
let lastProcessedResponseKey: string | null = null;

export function isReadyForNavigation(): boolean {
  return isNavigationReady;
}

export function getPendingDestination(): AllowedNotificationRoute | null {
  return pendingDestination;
}

/**
 * Sets navigation readiness and flushes any pending destination queued during cold start.
 */
export function setNavigationReady(ready: boolean) {
  isNavigationReady = ready;
  if (ready && pendingDestination) {
    const destination = pendingDestination;
    pendingDestination = null;
    try {
      router.push(destination as Href);
    } catch (err) {
      console.warn('Failed to navigate to queued notification route:', err);
    }
  }
}

/**
 * Processes a notification response from cold-start, background tap, or foreground tap.
 * Idempotent: ignores duplicate invocations for the exact same notification response.
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse | null): boolean {
  if (!response?.notification) return false;

  const notification = response.notification;
  const identifier = notification.request.identifier;
  const actionIdentifier = response.actionIdentifier ?? 'default';
  const responseKey = `${identifier}:${actionIdentifier}`;

  // Prevent duplicate navigation for the exact same interaction
  if (lastProcessedResponseKey === responseKey) {
    return false;
  }

  // Handle interactive iOS "Log today" button action
  if (actionIdentifier === REMINDER_LOG_ACTION) {
    lastProcessedResponseKey = responseKey;
    if (isNavigationReady) {
      router.push('/(tabs)/add' as Href);
    } else {
      pendingDestination = '/(tabs)/add';
    }
    return true;
  }

  const rawUrl = notification.request.content.data?.url;
  const validatedRoute = validateNotificationDestination(rawUrl);

  if (!validatedRoute) {
    // Malformed or unknown destination: do not navigate
    return false;
  }

  lastProcessedResponseKey = responseKey;

  if (isNavigationReady) {
    try {
      router.push(validatedRoute as Href);
    } catch (err) {
      console.warn('Error during notification navigation:', err);
      pendingDestination = validatedRoute;
    }
  } else {
    // Queue destination until RootLayout signals onLayoutReady
    pendingDestination = validatedRoute;
  }

  return true;
}

/**
 * Resets internal navigation queue state (primarily for automated testing).
 */
export function _resetNavigationStateForTesting() {
  isNavigationReady = false;
  pendingDestination = null;
  lastProcessedResponseKey = null;
}
