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
 * Reduce any URL-ish input to its bare hostname:
 *   "HTTPS://user@M.YouTube.com.:8080/watch?v=1#t" → "m.youtube.com"
 * Handles percent-encoding, protocol-relative URLs, backslashes, userinfo,
 * ports, paths, queries, fragments, trailing dots, and mixed casing.
 * Returns null when nothing hostname-shaped can be extracted.
 */
export function extractHostname(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  // Percent-encoded bypasses ("youtube%2Ecom") — decode defensively.
  try {
    s = decodeURIComponent(s);
  } catch {
    /* malformed escape — keep the raw string */
  }
  s = s.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  s = s.replace(/^\/\//, ''); // protocol-relative
  s = s.split('/')[0].split('\\')[0].split('?')[0].split('#')[0]; // path/query/hash
  const atIdx = s.lastIndexOf('@'); // userinfo
  if (atIdx >= 0) s = s.slice(atIdx + 1);
  s = s.split(':')[0]; // port
  s = s.replace(/\.+$/, ''); // trailing dot(s) — "youtube.com." is youtube.com
  if (!s || s.length > 253) return null;
  const ok = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s);
  return ok ? s : null;
}

/**
 * Normalize free-form input to the blocklist's canonical form: the bare
 * hostname with a leading "www." removed, so example.com / www.example.com /
 * http(s)://… / paths / ports / casing all collapse to one entry.
 */
export function normalizeDomain(input: string): string | null {
  const host = extractHostname(input);
  if (!host) return null;
  const bare = host.replace(/^www\./, '');
  // "www." alone (or "www.com"-style leftovers) must still be a valid domain.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(bare) ? bare : null;
}

/**
 * True when `hostname` is covered by `blockedDomain` — an exact match or any
 * subdomain of it. Blocking "youtube.com" covers "www.youtube.com",
 * "m.youtube.com", and "music.youtube.com", but NOT "notyoutube.com".
 */
export function isHostnameBlocked(hostname: string, blockedDomain: string): boolean {
  return hostname === blockedDomain || hostname.endsWith('.' + blockedDomain);
}

/**
 * The single gate every URL must pass before the app opens or loads it.
 * Returns true when the URL's hostname matches any blocklist entry (exact or
 * subdomain), regardless of protocol, www, casing, ports, paths, queries,
 * fragments, encoding, or trailing dots. Unparseable URLs are NOT blocked —
 * they simply fail to open on their own.
 */
export function isUrlBlocked(url: string, sites: Array<Pick<BlockedSite, 'domain'>>): boolean {
  const host = extractHostname(url);
  if (!host) return false;
  return sites.some((s) => isHostnameBlocked(host, s.domain));
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
