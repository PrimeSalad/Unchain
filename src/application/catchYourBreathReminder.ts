/**
 * Catch Your Breath - weekly reminder notification.
 *
 * Schedules a local notification that fires when the next assessment becomes
 * available (7 days after the last completion). If the assessment is missed,
 * only one gentle reminder is sent. Never repeatedly notifies.
 *
 * Follows the same lazy-loading + graceful-degradation pattern as
 * triggerPrediction.ts and needOrWantReminder.ts.
 */

import { Platform } from 'react-native';
import { CATCH_YOUR_BREATH_INTERVAL_MS } from '@/domain/catchYourBreath';

// ── Lazy expo-notifications loader ────────────────────────────────────────

type ExpoNotifications = typeof import('expo-notifications');

let _notifs: ExpoNotifications | null | undefined = undefined;

const CHANNEL_ID = 'catch-your-breath-reminders';
const NOTIF_TAG = 'catch-your-breath-reminder';
const MISSED_NOTIF_TAG = 'catch-your-breath-missed';

async function getNotifs(): Promise<ExpoNotifications | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (_notifs !== undefined) return _notifs;
  try {
    _notifs = await import('expo-notifications');
    return _notifs;
  } catch {
    _notifs = null;
    return null;
  }
}

// ── Android channel setup ─────────────────────────────────────────────────

let channelSetup = false;

async function ensureChannel(notifs: ExpoNotifications): Promise<void> {
  if (Platform.OS !== 'android' || channelSetup) return;
  try {
    await notifs.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Breathing Check-in Reminders',
      importance: notifs.AndroidImportance.DEFAULT,
      sound: 'default',
    });
    channelSetup = true;
  } catch {
    // Android-only; no-op on iOS
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Schedule a weekly reminder notification that fires when the next Catch Your
 * Breath assessment becomes available. Cancels any existing reminders first.
 *
 * @param lastCompletedAt - Timestamp of the last completed assessment, or null
 *                          if none has been completed yet.
 */
export async function scheduleCatchYourBreathReminder(
  lastCompletedAt: number | null,
): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;

  try {
    let { status } = await notifs.getPermissionsAsync();
    if (status === 'undetermined') {
      status = (await notifs.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    await ensureChannel(notifs);

    // Cancel any existing reminders
    await cancelCatchYourBreathReminders();

    // Calculate when the next assessment becomes available
    const nextAvailableAt = lastCompletedAt != null
      ? lastCompletedAt + CATCH_YOUR_BREATH_INTERVAL_MS
      : Date.now() + 60_000; // First-time: schedule 1 minute from now

    // Don't schedule if it's already past
    if (nextAvailableAt <= Date.now()) return;

    await notifs.scheduleNotificationAsync({
      content: {
        title: 'Time for your weekly check-in',
        body: 'Take two minutes to see how your breathing has changed this week.',
        sound: true,
        data: {
          tag: NOTIF_TAG,
          deepLink: 'unchainly://catch-your-breath',
        },
      },
      trigger: {
        type: notifs.SchedulableTriggerInputTypes.DATE,
        date: new Date(nextAvailableAt),
      },
    });
  } catch {
    // Notification scheduling must never crash the app
  }
}

/**
 * Schedule a single missed-assessment reminder (1 day after the assessment
 * became available, if still not completed). Only fires once.
 */
export async function scheduleCatchYourBreathMissedReminder(
  availableAt: number,
): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;

  try {
    await ensureChannel(notifs);

    // Only schedule if more than 1 day has passed since it became available
    const oneDayLater = availableAt + 24 * 60 * 60 * 1000;
    if (oneDayLater <= Date.now()) return;

    // Check if we already have a missed reminder scheduled
    const scheduled = await notifs.getAllScheduledNotificationsAsync();
    const alreadyScheduled = scheduled.some(
      (n) => (n.content.data?.tag as string | undefined) === MISSED_NOTIF_TAG,
    );
    if (alreadyScheduled) return;

    await notifs.scheduleNotificationAsync({
      content: {
        title: 'Your lungs miss you',
        body: 'Your weekly breathing reflection is waiting. Take a moment to check in with yourself.',
        sound: true,
        data: {
          tag: MISSED_NOTIF_TAG,
          deepLink: 'unchainly://catch-your-breath',
        },
      },
      trigger: {
        type: notifs.SchedulableTriggerInputTypes.DATE,
        date: new Date(oneDayLater),
      },
    });
  } catch {
    // Graceful degradation
  }
}

/**
 * Cancel all pending Catch Your Breath reminder notifications.
 */
export async function cancelCatchYourBreathReminders(): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;
  try {
    const scheduled = await notifs.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(
      (n) =>
        (n.content.data?.tag as string | undefined) === NOTIF_TAG ||
        (n.content.data?.tag as string | undefined) === MISSED_NOTIF_TAG,
    );
    await Promise.all(ours.map((n) => notifs.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Graceful degradation
  }
}
