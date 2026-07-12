/**
 * Guarded URL opening - the ONLY way the app may open or load a URL.
 *
 * Audit note: as of this writing the app opens zero external URLs (no
 * WebView, no Linking calls, no in-app browser). Any future feature that
 * opens a link MUST go through `openExternalUrl` below - never call
 * `Linking.openURL` directly - so the user's Focus Protection blocklist is
 * always consulted first. Blocking covers protocol/www/case variants,
 * subdomains, ports, paths, queries, fragments, encoded URLs, and trailing
 * dots (see isUrlBlocked in the protection domain).
 */

import { Linking } from 'react-native';
import { useStore } from './store';
import { isUrlBlocked } from '@/domain/protection';

export type OpenUrlResult = 'opened' | 'blocked' | 'failed';

/** True when the URL's hostname matches the user's blocklist (exact domain
 *  or any subdomain of it). */
export function isBlockedByUser(url: string): boolean {
  return isUrlBlocked(url, useStore.getState().blockedSites);
}

/**
 * Open a URL only if it does not hit the user's blocklist.
 * Returns 'blocked' without opening anything when it does.
 */
export async function openExternalUrl(url: string): Promise<OpenUrlResult> {
  if (isBlockedByUser(url)) return 'blocked';
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
