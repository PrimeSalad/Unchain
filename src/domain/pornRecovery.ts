/**
 * Pornography recovery domain — pure TS, zero framework deps.
 * Kept completely separate from gambling.ts so neither module is ever modified.
 */

// ---------------------------------------------------------------------------
// Addiction-specific triggers for porn recovery
// ---------------------------------------------------------------------------

export const PORN_TRIGGERS = [
  'Stress',
  'Boredom',
  'Loneliness',
  'Anxiety',
  'Late night',
  'Being alone',
  'After a hard day',
  'Explicit content online',
  'Idle time',
  'Social media',
  'Low mood',
  'Other',
] as const;

export type PornTrigger = (typeof PORN_TRIGGERS)[number];

// ---------------------------------------------------------------------------
// Last Check-in — human-readable time-since
// ---------------------------------------------------------------------------

export function formatLastCheckedIn(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return 'Never';
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWeek = Math.floor(diffDay / 7);
  return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
}

// ---------------------------------------------------------------------------
// Weekly reset helper — urgesResisted resets every Monday at local midnight
// ---------------------------------------------------------------------------

export function currentWeekStart(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday).getTime();
}
