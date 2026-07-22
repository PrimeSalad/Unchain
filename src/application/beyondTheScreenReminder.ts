/**
 * Beyond the Screen - weekly reminder notification.
 *
 * Schedules a local notification that fires when the next assessment becomes
 * available (7 days after the last completion). If the assessment is missed,
 * only one gentle reminder is sent. Never repeatedly notifies.
 */

import { Platform } from 'react-native';
import { BEYOND_THE_SCREEN_INTERVAL_MS } from '@/domain/beyondTheScreen';
import { privateNotificationContent } from '@/domain/notificationPrivacy';

// ── Lazy expo-notifications loader ────────────────────────────────────────

type ExpoNotifications = typeof import('expo-notifications');

let _notifs: ExpoNotifications | null | undefined = undefined;

const CHANNEL_ID = 'beyond-the-screen-reminders';
const NOTIF_TAG = 'beyond-the-screen-reminder';

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
      name: 'Unchainly Reminders',
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
 * Schedule a weekly reminder notification that fires when the next Beyond the
 * Screen assessment becomes available. Cancels any existing reminders first.
 */
export async function scheduleBeyondTheScreenReminder(
  lastCompletedAt: number | null,
): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;

  try {
    const { status } = await notifs.getPermissionsAsync();
    if (status !== 'granted') return;

    await ensureChannel(notifs);
    await cancelBeyondTheScreenReminders();

    const nextAvailableAt = lastCompletedAt != null
      ? lastCompletedAt + BEYOND_THE_SCREEN_INTERVAL_MS
      : Date.now() + 60_000;

    if (nextAvailableAt <= Date.now()) return;

    const notification = privateNotificationContent();
    await notifs.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: true,
        data: {
          tag: NOTIF_TAG,
          deepLink: 'unchainly://beyond-the-screen',
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
 * Cancel all pending Beyond the Screen reminder notifications.
 */
export async function cancelBeyondTheScreenReminders(): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;
  try {
    const scheduled = await notifs.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(
      (n) =>
        (n.content.data?.tag as string | undefined) === NOTIF_TAG,
    );
    await Promise.all(ours.map((n) => notifs.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Graceful degradation
  }
}