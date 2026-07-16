/**
 * Need or Want? - 24-hour cooldown reminder notification.
 *
 * Schedules a local notification that fires after the 24-hour cooldown ends,
 * reminding the user of the item they paused on. Tapping the notification
 * deep-links to the need-or-want screen for the follow-up.
 *
 * Follows the same lazy-loading + graceful-degradation pattern as
 * triggerPrediction.ts — works without expo-notifications installed.
 */

import { Platform } from 'react-native';
import { NEED_OR_WANT_COOLDOWN_MS } from '@/domain/alternatives';

// ---------------------------------------------------------------------------
// Lazy expo-notifications loader
// ---------------------------------------------------------------------------

type ExpoNotifications = typeof import('expo-notifications');

let _notifs: ExpoNotifications | null | undefined = undefined;

const CHANNEL_ID = 'need-or-want-reminders';
const NOTIF_TAG = 'need-or-want-reminder';

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

// ---------------------------------------------------------------------------
// Android channel setup
// ---------------------------------------------------------------------------

let channelSetup = false;

async function ensureChannel(notifs: ExpoNotifications): Promise<void> {
  if (Platform.OS !== 'android' || channelSetup) return;
  try {
    await notifs.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Purchase Reminders',
      importance: notifs.AndroidImportance.HIGH,
      sound: 'default',
    });
    channelSetup = true;
  } catch {
    // Android-only; no-op on iOS
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Schedule a reminder notification that fires after the 24-hour cooldown.
 * Cancels any existing need-or-want reminder before scheduling a new one.
 *
 * @param itemName - The item name to include in the notification body
 * @param itemPrice - The price string (e.g. "$49.99") to include
 * @param currency - The currency symbol
 */
export async function scheduleNeedOrWantReminder(
  itemName: string,
  itemPrice: string,
  currency: string,
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

    // Cancel any existing reminder
    await cancelNeedOrWantReminder();

    const priceDisplay = itemPrice ? ` (${currency}${itemPrice})` : '';
    const triggerDate = new Date(Date.now() + NEED_OR_WANT_COOLDOWN_MS);

    await notifs.scheduleNotificationAsync({
      content: {
        title: '24 hours are up!',
        body: `Did you buy "${itemName}"${priceDisplay}?`,
        sound: true,
        data: {
          tag: NOTIF_TAG,
          deepLink: 'unchainly://need-or-want',
        },
      },
      trigger: {
        type: notifs.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch {
    // Notification scheduling must never crash the app
  }
}

/**
 * Cancel any pending need-or-want reminder notification.
 */
export async function cancelNeedOrWantReminder(): Promise<void> {
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
