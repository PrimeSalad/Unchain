/**
 * Lock-screen-safe notification copy.
 *
 * Recovery categories, urge timing, health details, purchase names, prices,
 * and journal content are intentionally excluded because notification
 * previews may be visible while the device is locked.
 */
export const PRIVATE_NOTIFICATION_TITLE = 'Unchainly';
export const PRIVATE_NOTIFICATION_BODY = 'Your check-in is ready.';

export interface PrivateNotificationContent {
  title: string;
  body: string;
}

export function privateNotificationContent(): PrivateNotificationContent {
  return {
    title: PRIVATE_NOTIFICATION_TITLE,
    body: PRIVATE_NOTIFICATION_BODY,
  };
}

/** Useful for tests and release audits of future notification copy. */
export function containsSensitiveNotificationDetail(content: PrivateNotificationContent): boolean {
  const normalized = `${content.title} ${content.body}`.toLowerCase();
  return [
    'urge',
    'relapse',
    'recovery',
    'gambling',
    'porn',
    'alcohol',
    'drug',
    'smok',
    'lung',
    'breath',
    'purchase',
    'price',
    'bought',
    'buy',
    '$',
    '₱',
  ].some((term) => normalized.includes(term));
}
