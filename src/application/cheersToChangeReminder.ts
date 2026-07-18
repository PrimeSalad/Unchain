/**
 * Cheers to Change - weekly reminder notification.
 *
 * Schedules a local notification that fires when the next assessment becomes
 * available (7 days after the last completion). If the assessment is missed,
 * only one gentle reminder is sent. Never repeatedly notifies.
 */

import { Platform } from 'react-native';
import { CHEERS_TO_CHANGE_INTERVAL_MS } from '@/domain/cheersToChange';

// ── Lazy expo-notifications loader ────────────────────────────────────────

type ExpoNotifications = typeof import('expo-notifications');

let _notifs: ExpoNotifications | null | undefined = undefined;

const CHANNEL_ID = 'cheers-to-change-reminders';
const NOTIF_TAG = 'cheers-to-change-reminder';

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
      name: 'Wellness Check-in Reminders',
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
 * Schedule a weekly reminder notification that fires when the next Cheers to
 * Change assessment becomes available. Cancels any existing reminders first.
 */
export async function scheduleCheersToChangeReminder(
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
    await cancelCheersToChangeReminders();

    const nextAvailableAt = lastCompletedAt != null
      ? lastCompletedAt + CHEERS_TO_CHANGE_INTERVAL_MS
      : Date.now() + 60_000;

    if (nextAvailableAt <= Date.now()) return;

    await notifs.scheduleNotificationAsync({
      content: {
        title: 'Time for your weekly check-in',
        body: 'Take a couple of minutes to reflect on how your body has been feeling this week.',
        sound: true,
        data: {
          tag: NOTIF_TAG,
          deepLink: 'unchainly://cheers-to-change',
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
 * Cancel all pending Cheers to Change reminder notifications.
 */
export async function cancelCheersToChangeReminders(): Promise<void> {
  const notifs = await getNotifs();
  if (!notifs) return;
  try {
    const scheduled = await notifs.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(
      (n) => (n.content.data?.tag as string | undefined) === NOTIF_TAG,
    );
    await Promise.all(ours.map((n) => notifs.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Graceful degradation
  }
}
