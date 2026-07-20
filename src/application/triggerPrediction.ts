/**
 * TriggerPredictionService
 *
 * Analyses the user's urge history, identifies high-risk time windows, and
 * schedules local notifications 15 minutes before each predicted window.
 *
 * Architecture:
 *   - Pure TypeScript scheduler – no framework deps.
 *   - Calls expo-notifications when available (add the package for full
 *     native push; degrades gracefully to a no-op without it).
 *   - All data stays 100 % local – nothing is ever sent to a server.
 *   - Re-scheduling is idempotent: call `syncPredictionNotifications` on
 *     every urges-array change; it cancels stale notifications and schedules
 *     only the ones that are still relevant.
 *
 * To enable native notifications:
 *   npm install expo-notifications
 *   Request permission only from an explicit reminder control; passive app
 *   startup and hydration sync must never show the system prompt.
 *   The service will auto-detect the module and activate full scheduling.
 */

import {
  analyzeUrges,
  predictionNotificationMessage,
  type PredictionWindow,
} from '@/domain/urgeAnalytics';
import type { UrgeLog } from '@/domain/records';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Notification channel ID – used to group recovery reminders on Android.
// ---------------------------------------------------------------------------
const CHANNEL_ID = 'recovery-predictions';

/** Tag prefix so we can cancel only our own scheduled notifications. */
const NOTIF_TAG_PREFIX = 'trigger-prediction-';

// ---------------------------------------------------------------------------
// Lazy expo-notifications loader
// Keeps the app working even if expo-notifications is not installed.
// ---------------------------------------------------------------------------

type ExpoNotifications = typeof import('expo-notifications');

let _notifs: ExpoNotifications | null | undefined = undefined; // undefined = not yet attempted

/** expo-notifications' native scheduling/response APIs are not implemented
 * on web. Keeping this check here makes every exported service method a safe
 * async no-op in browsers while prediction analytics continue normally. */
export function supportsNativePredictionNotifications(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function getNotifs(): Promise<ExpoNotifications | null> {
  if (!supportsNativePredictionNotifications()) return null;
  if (_notifs !== undefined) return _notifs;
  try {
    // Dynamic import so the module boundary is transparent at bundle time.
    _notifs = await import('expo-notifications');
    return _notifs;
  } catch {
    _notifs = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

/** Request notification permissions from an explicit, user-initiated reminder
 *  control. Never call this from app launch, hydration, or passive sync. */
export async function requestPredictionPermissions(): Promise<boolean> {
  const notifs = await getNotifs();
  if (!notifs) return false;
  try {
    const { status } = await notifs.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notifTag(hour: number, dow: number): string {
  return `${NOTIF_TAG_PREFIX}${dow}-${hour}`;
}

/** Computes the next occurrence (as a Date) of a given (hour, dow) bucket,
 *  scheduled 15 minutes BEFORE the hour so the user has time to prepare. */
function nextOccurrence(hour: number, dow: number): Date {
  const now = new Date();
  const currentDow = now.getDay();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  // Notify 15 min before the risky hour
  const notifyHour = hour === 0 ? 23 : hour - 1;
  const notifyMin = hour === 0 ? 45 : 45; // always :45 of the preceding hour

  // Days until this dow (0 = today if time hasn't passed yet)
  let daysUntil = (dow - currentDow + 7) % 7;

  // If today is the right day, check if the notification time has already passed
  if (daysUntil === 0) {
    const alreadyPassed =
      currentHour > notifyHour ||
      (currentHour === notifyHour && currentMin >= notifyMin);
    if (alreadyPassed) daysUntil = 7; // schedule for next week
  }

  const target = new Date(now);
  target.setDate(target.getDate() + daysUntil);
  target.setHours(notifyHour, notifyMin, 0, 0);
  return target;
}

// ---------------------------------------------------------------------------
// Android notification channel setup (idempotent)
// ---------------------------------------------------------------------------

let channelSetup = false;

async function ensureChannel(notifs: ExpoNotifications): Promise<void> {
  if (Platform.OS !== 'android' || channelSetup) return;
  try {
    await notifs.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recovery Predictions',
      importance: notifs.AndroidImportance.DEFAULT,
      sound: null, // silent - supportive, not alarming
    });
    channelSetup = true;
  } catch {
    // Android-only API; silently no-op on iOS
  }
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/** Cancel all previously scheduled prediction notifications. */
export async function cancelPredictionNotifications(): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;
  try {
    const scheduled = await notifs.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) =>
      (n.content.data?.tag as string | undefined)?.startsWith(NOTIF_TAG_PREFIX),
    );
    await Promise.all(ours.map((n) => notifs.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Graceful degradation
  }
}

// ---------------------------------------------------------------------------
// Core scheduling
// ---------------------------------------------------------------------------

/** Maximum number of prediction windows to schedule. Keeps things light. */
const MAX_PREDICTIONS_TO_SCHEDULE = 5;

/**
 * Main entry point. Call this whenever the urges array changes.
 *
 * 1. Runs `analyzeUrges` to get the latest prediction windows.
 * 2. Cancels any previously scheduled prediction notifications.
 * 3. Schedules new notifications for the top N upcoming high-risk windows.
 *
 * Notifications fire 15 minutes before each high-risk hour.
 * Opening the notification deep-links to /sos so the user can act immediately.
 */
export async function syncPredictionNotifications(urges: UrgeLog[]): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return; // expo-notifications not installed - no-op

  try {
    // Passive sync must never trigger a system permission prompt.
    const { status } = await notifs.getPermissionsAsync();
    if (status !== 'granted') return;

    await ensureChannel(notifs);
    await cancelPredictionNotifications();

    const { predictions, hasSufficientData, trend } = analyzeUrges(urges);
    if (!hasSufficientData || predictions.length === 0) return;

    // Take the top-scored windows (already sorted by score desc)
    // As urge frequency improves, reduce reminder volume automatically.
    // New or worsening patterns retain a wider safety net.
    const scheduleLimit = trend.improving
      ? Math.min(2, MAX_PREDICTIONS_TO_SCHEDULE)
      : MAX_PREDICTIONS_TO_SCHEDULE;
    const toSchedule = predictions.slice(0, scheduleLimit);

    await Promise.all(
      toSchedule.map(async (window: PredictionWindow) => {
        const { title, body } = predictionNotificationMessage(window);
        const triggerDate = nextOccurrence(window.hour, window.dow);

        // Only schedule if the trigger is in the future (sanity check)
        if (triggerDate.getTime() <= Date.now()) return;

        try {
          await notifs.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: true,
              data: {
                tag: notifTag(window.hour, window.dow),
                // Deep-link target: opened when the user taps the notification
                deepLink: 'unchainly://sos',
                hour: window.hour,
                dow: window.dow,
                score: window.score,
              },
            },
            trigger: {
              type: notifs.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
            },
          });
        } catch {
          // One window failing shouldn't block the rest
        }
      }),
    );
  } catch {
    // Network/permission errors must never crash the app
  }
}

// ---------------------------------------------------------------------------
// Notification tap handler
// Sets up the handler that deep-links to /sos when the user taps a prediction
// notification. Call once in your app root (e.g. app/_layout.tsx).
// ---------------------------------------------------------------------------

/**
 * Register the notification response handler.
 * Returns an unsubscribe function – call it in your cleanup.
 *
 * Usage in _layout.tsx:
 *   useEffect(() => {
 *     const unsub = registerPredictionNotificationHandler(router);
 *     return unsub;
 *   }, []);
 */
export function registerPredictionNotificationHandler(
  router: { push: (path: '/sos' | '/need-or-want') => void },
): () => void {
  let sub: { remove: () => void } | undefined;
  let active = true;

  void (async () => {
    try {
      const notifs = await getNotifs();
      if (!notifs || !active) return;
      notifs.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      const handleDeepLink = (data: Record<string, unknown>) => {
        const deepLink = data?.deepLink as string | undefined;
        const tag = data?.tag as string | undefined;
        if (deepLink === 'unchainly://need-or-want' || tag === 'need-or-want-reminder') {
          router.push('/need-or-want');
        } else if (tag?.startsWith(NOTIF_TAG_PREFIX)) {
          router.push('/sos');
        }
      };
      sub = notifs.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        try { handleDeepLink(data); } catch { /* Navigation may not be ready. */ }
      });
      const initial = await notifs.getLastNotificationResponseAsync();
      if (active && initial) {
        try { handleDeepLink(initial.notification.request.content.data as Record<string, unknown>); } catch { /* Ignore. */ }
      }
    } catch {
      // A missing native implementation must never affect app startup.
    }
  })();

  return () => { active = false; sub?.remove(); };
}

// ---------------------------------------------------------------------------
// In-app scheduler hook
// Uses a simple interval to re-check predictions and display in-app banners
// as a fallback when expo-notifications is unavailable or not permitted.
// ---------------------------------------------------------------------------

/** State for the in-app fallback scheduler. */
interface InAppSchedulerState {
  lastUrgesLength: number;
  nextCheckMs: number;
  fired: Set<string>;
  onTrigger: ((window: PredictionWindow) => void) | null;
}

const inAppState: InAppSchedulerState = {
  lastUrgesLength: -1,
  nextCheckMs: 0,
  fired: new Set(),
  onTrigger: null,
};

/**
 * Register a callback that fires when the current time enters a high-risk
 * window (within 15 min). Used for in-app banners when native notifications
 * are not available.
 *
 * Returns an unsubscribe function.
 */
export function registerInAppPredictionWatcher(
  onTrigger: (window: PredictionWindow) => void,
): () => void {
  inAppState.onTrigger = onTrigger;
  return () => {
    inAppState.onTrigger = null;
  };
}

/**
 * Drive the in-app watcher. Call this in a setInterval (or AppState listener).
 * Low cost: does nothing if predictions haven't changed.
 */
export function tickInAppPredictions(urges: UrgeLog[]): void {
  if (inAppState.onTrigger == null) return;
  const { predictions, hasSufficientData } = analyzeUrges(urges);
  if (!hasSufficientData) return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDow = now.getDay();
  const currentMin = now.getMinutes();

  // Fire for any window whose start hour is within the next 15 minutes
  for (const p of predictions) {
    const minutesUntil =
      (p.dow === currentDow
        ? (p.hour - currentHour) * 60 - currentMin
        : ((p.dow - currentDow + 7) % 7) * 1440 - currentMin);

    if (minutesUntil >= 0 && minutesUntil <= 15) {
      const key = `${p.dow}-${p.hour}`;
      if (!inAppState.fired.has(key)) {
        inAppState.fired.add(key);
        // Auto-expire the "fired" state after 30 min so it can fire again next week
        setTimeout(() => inAppState.fired.delete(key), 30 * 60 * 1000);
        inAppState.onTrigger(p);
      }
    }
  }
}
