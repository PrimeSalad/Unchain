/**
 * Focus Protection — a permanent, consent-first blocklist the user builds
 * themselves. Pure domain: types and validation.
 *
 * Blocking model (deliberately simple and bypass-resistant):
 *  - A website on the list is protected, permanently. There are no timers,
 *    no sessions, no expiry, and no "temporarily disable" switch.
 *  - The ONLY way a website stops being protected is the user manually
 *    removing it, behind a destructive confirmation dialog.
 *
 * Privacy & compliance rules (App Store Review Guidelines):
 *  - The user adds every website explicitly; nothing is ever added or
 *    blocked automatically or silently.
 *  - No browsing history is read, monitored, or collected — the app never
 *    knows what the user visits, only the list the user typed in.
 *  - Everything is stored locally on the device; nothing is uploaded.
 *  - OS-level enforcement (Safari / system-wide blocking) requires a native
 *    build with Apple's Family Controls entitlement — see
 *    docs/focus-protection-enforcement.md. This domain model is the single
 *    source of truth that native layer reads: `activeBlockedDomains()`.
 */

export interface BlockedSite {
  id: string;
  /** Normalized domain, e.g. "casino.com". */
  domain: string;
  /** Optional user-given nickname, e.g. "Online Casino". */
  nickname?: string;
  addedAt: number;
}

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
 * domain ("stake.com"), so example.com / www.example.com / http(s) variants
 * are all the same entry. Returns null when the input is not a plausible
 * domain.
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

/**
 * The exact domain list an OS-level enforcement layer (Safari content
 * blocker / ManagedSettings web-domain shield) should block. Every listed
 * site is always active — there is no partial state.
 */
export function activeBlockedDomains(sites: BlockedSite[]): string[] {
  return sites.map((s) => s.domain);
}
