/**
 * Focus Protection — a voluntary, consent-first blocklist the user builds
 * themselves. Pure domain: types, validation, and session math.
 *
 * Privacy & compliance rules (see App Store Review Guidelines):
 *  - The user adds every website explicitly; nothing is ever blocked
 *    automatically or silently.
 *  - No browsing history is read, monitored, or collected — the app never
 *    knows what the user visits, only the list the user typed in.
 *  - Everything is stored locally on the device; nothing is uploaded.
 *  - OS-level enforcement (Safari content filtering / Family Controls)
 *    requires a native extension + Apple's Family Controls entitlement; this
 *    domain model is the single source of truth such a module would read.
 */

export interface BlockedSite {
  id: string;
  /** Normalized domain, e.g. "casino.com". */
  domain: string;
  /** Optional user-given nickname, e.g. "Online Casino". */
  nickname?: string;
  addedAt: number;
  /** Off = temporarily disabled without deleting. */
  enabled: boolean;
}

export interface ProtectionSession {
  startedAt: number;
  endsAt: number;
  /** How it was started — manual pick or the SOS urge flow. */
  trigger: 'manual' | 'sos';
}

/** Session length presets (minutes). "Until tomorrow" is handled separately. */
export const SESSION_PRESETS = [10, 30, 60, 120] as const;

/** Longest accepted custom duration (minutes) — 24 hours. */
export const MAX_CUSTOM_MINUTES = 24 * 60;

/**
 * Purely OPTIONAL suggestions — never added automatically. Each requires an
 * explicit Add tap from the user before it enters their personal blocklist.
 */
export const SUGGESTED_SITES: string[] = [
  'bet365.com',
  'stake.com',
  'bitstarz.com',
  'bitstarz.io',
  '1xbet.com',
  '888casino.com',
];

/**
 * Normalize free-form input ("https://www.Stake.com/casino?x=1") to a bare
 * domain ("stake.com"). Returns null when the input is not a plausible domain.
 */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // strip scheme
  s = s.split('/')[0].split('?')[0].split('#')[0]; // strip path/query/hash
  const atIdx = s.lastIndexOf('@'); // strip userinfo
  if (atIdx >= 0) s = s.slice(atIdx + 1);
  s = s.split(':')[0]; // strip port
  s = s.replace(/^www\./, '');
  if (s.length > 253) return null;
  const ok = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s);
  return ok ? s : null;
}

/** Display name for a site — nickname when given, else the domain. */
export function siteLabel(site: Pick<BlockedSite, 'domain' | 'nickname'>): string {
  return site.nickname?.trim() || site.domain;
}

/** Local midnight of tomorrow — the end of an "Until tomorrow" session. */
export function nextLocalMidnight(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function sessionActive(s: ProtectionSession | null, now = Date.now()): boolean {
  return s != null && s.endsAt > now;
}

/** Remaining whole seconds of the session (0 when over or absent). */
export function sessionRemainingSec(s: ProtectionSession | null, now = Date.now()): number {
  if (!s) return 0;
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

/** "1h 05m" / "12m" / "45s" — compact remaining-time label. */
export function formatRemaining(totalSec: number): string {
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  if (totalSec >= 60) return `${Math.ceil(totalSec / 60)}m`;
  return `${totalSec}s`;
}

export type SiteStatus = 'active' | 'protected' | 'disabled';

/** A site's live status given whether a protection session is running. */
export function siteStatus(site: BlockedSite, hasActiveSession: boolean): SiteStatus {
  if (!site.enabled) return 'disabled';
  return hasActiveSession ? 'active' : 'protected';
}
