/**
 * Unit tests for the Focus Protection URL utilities.
 * Run with: npm test
 * (compiles src/domain/protection.ts to .test-build/, then runs node --test)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  extractHostname,
  normalizeDomain,
  isHostnameBlocked,
  domainsOverlap,
  isUrlBlocked,
  activeBlockedDomains,
  siteLabel,
} = require('../.test-build/protection.js');

// ─────────────────────────────────────────────────────────────────────────────
// extractHostname
// ─────────────────────────────────────────────────────────────────────────────

test('extractHostname: plain domains and full URLs', () => {
  assert.equal(extractHostname('youtube.com'), 'youtube.com');
  assert.equal(extractHostname('www.reddit.com'), 'www.reddit.com');
  assert.equal(extractHostname('https://youtube.com'), 'youtube.com');
  assert.equal(extractHostname('http://youtube.com'), 'youtube.com');
  assert.equal(extractHostname('reddit.com/r/programming'), 'reddit.com');
  assert.equal(extractHostname('https://m.youtube.com/watch?v=abc123'), 'm.youtube.com');
});

test('extractHostname: bypass attempts are neutralized', () => {
  assert.equal(extractHostname('HTTPS://WWW.YOUTUBE.COM'), 'www.youtube.com', 'mixed casing');
  assert.equal(extractHostname('youtube.com:8080'), 'youtube.com', 'port');
  assert.equal(extractHostname('youtube.com?utm=x'), 'youtube.com', 'query string');
  assert.equal(extractHostname('youtube.com#section'), 'youtube.com', 'fragment');
  assert.equal(extractHostname('youtube.com.'), 'youtube.com', 'trailing dot');
  assert.equal(extractHostname('youtube.com...'), 'youtube.com', 'multiple trailing dots');
  assert.equal(extractHostname('youtube%2Ecom'), 'youtube.com', 'percent-encoded dot');
  assert.equal(extractHostname('ftp://youtube.com'), 'youtube.com', 'other protocol');
  assert.equal(extractHostname('//youtube.com/x'), 'youtube.com', 'protocol-relative');
  assert.equal(extractHostname('user:pass@youtube.com'), 'youtube.com', 'userinfo');
  assert.equal(extractHostname('youtube.com\\evil'), 'youtube.com', 'backslash path');
  assert.equal(extractHostname('  youtube.com  '), 'youtube.com', 'whitespace');
});

test('extractHostname: malformed input returns null, never throws', () => {
  assert.equal(extractHostname(''), null);
  assert.equal(extractHostname('   '), null);
  assert.equal(extractHostname('not a website'), null);
  assert.equal(extractHostname('nodots'), null);
  assert.equal(extractHostname('..'), null);
  assert.equal(extractHostname('http://'), null);
  assert.equal(extractHostname('-bad.com'), null);
  assert.equal(extractHostname('bad-.com'), null);
  assert.equal(extractHostname('%E0%A4%A'), null, 'broken percent-encoding');
  assert.equal(extractHostname('a'.repeat(300) + '.com'), null, 'over-long host');
  assert.equal(extractHostname('me@example.com'), null, 'bare email address');
  assert.equal(extractHostname('mailto:me@example.com'), null, 'mailto link');
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeDomain (blocklist storage form)
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeDomain: all common variants collapse to one entry', () => {
  const variants = [
    'facebook.com',
    'www.facebook.com',
    'https://facebook.com',
    'http://facebook.com',
    'https://www.facebook.com/',
    'HTTPS://WWW.FACEBOOK.COM/profile?id=1#top',
    'facebook.com.',
  ];
  for (const v of variants) {
    assert.equal(normalizeDomain(v), 'facebook.com', `variant: ${v}`);
  }
});

test('normalizeDomain: keeps meaningful subdomains, strips only www', () => {
  assert.equal(normalizeDomain('old.reddit.com'), 'old.reddit.com');
  assert.equal(normalizeDomain('www.reddit.com'), 'reddit.com');
  assert.equal(normalizeDomain('reddit.com/r/programming'), 'reddit.com');
});

test('normalizeDomain: invalid input is rejected gracefully', () => {
  for (const bad of ['', ' ', 'nope', 'www.', 'http://', '!!!.com', 'a b.com']) {
    assert.equal(normalizeDomain(bad), null, `input: ${JSON.stringify(bad)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// isHostnameBlocked (subdomain matching)
// ─────────────────────────────────────────────────────────────────────────────

test('isHostnameBlocked: exact and subdomain matches', () => {
  assert.equal(isHostnameBlocked('youtube.com', 'youtube.com'), true);
  assert.equal(isHostnameBlocked('www.youtube.com', 'youtube.com'), true);
  assert.equal(isHostnameBlocked('m.youtube.com', 'youtube.com'), true);
  assert.equal(isHostnameBlocked('music.youtube.com', 'youtube.com'), true);
  assert.equal(isHostnameBlocked('a.b.c.youtube.com', 'youtube.com'), true);
});

test('isHostnameBlocked: near-miss domains are NOT blocked', () => {
  assert.equal(isHostnameBlocked('notyoutube.com', 'youtube.com'), false);
  assert.equal(isHostnameBlocked('youtube.com.evil.com', 'youtube.com'), false);
  assert.equal(isHostnameBlocked('youtube.org', 'youtube.com'), false);
  assert.equal(isHostnameBlocked('yout.ube.com', 'youtube.com'), false);
});

test('domainsOverlap: parent and subdomain entries are treated as duplicates', () => {
  assert.equal(domainsOverlap('youtube.com', 'youtube.com'), true);
  assert.equal(domainsOverlap('m.youtube.com', 'youtube.com'), true);
  assert.equal(domainsOverlap('youtube.com', 'm.youtube.com'), true);
  assert.equal(domainsOverlap('notyoutube.com', 'youtube.com'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// isUrlBlocked (end-to-end blocklist matching)
// ─────────────────────────────────────────────────────────────────────────────

const blocklist = [{ domain: 'youtube.com' }, { domain: 'reddit.com' }, { domain: 'stake.com' }];

test('isUrlBlocked: every access pattern for a blocked site is caught', () => {
  const blocked = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'HTTP://YOUTUBE.COM',
    'youtube.com:443/live',
    'youtube.com.#frag',
    'youtube%2Ecom',
    'reddit.com',
    'old.reddit.com',
    'www.reddit.com/r/gambling',
    '//stake.com/casino',
  ];
  for (const url of blocked) {
    assert.equal(isUrlBlocked(url, blocklist), true, `should block: ${url}`);
  }
});

test('isUrlBlocked: legitimate sites pass through', () => {
  const allowed = [
    'google.com',
    'https://wikipedia.org/wiki/Recovery',
    'notyoutube.com',
    'youtube.com.phishing.example',
    'reddit.org',
  ];
  for (const url of allowed) {
    assert.equal(isUrlBlocked(url, blocklist), false, `should allow: ${url}`);
  }
});

test('isUrlBlocked: malformed URLs never throw and are not blocked', () => {
  for (const junk of ['', '   ', 'not a url', '%%%', '::::', 'javascript:alert(1)']) {
    assert.equal(isUrlBlocked(junk, blocklist), false, `input: ${JSON.stringify(junk)}`);
  }
});

test('isUrlBlocked: empty blocklist blocks nothing', () => {
  assert.equal(isUrlBlocked('youtube.com', []), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Misc domain helpers
// ─────────────────────────────────────────────────────────────────────────────

test('activeBlockedDomains: returns every stored domain', () => {
  const sites = [
    { id: '1', domain: 'stake.com', addedAt: 1 },
    { id: '2', domain: 'bet365.com', addedAt: 2 },
  ];
  assert.deepEqual(activeBlockedDomains(sites), ['stake.com', 'bet365.com']);
});

test('siteLabel: nickname wins, domain is the fallback', () => {
  assert.equal(siteLabel({ domain: 'stake.com' }), 'stake.com');
  assert.equal(siteLabel({ domain: 'stake.com', nickname: 'Casino' }), 'Casino');
  assert.equal(siteLabel({ domain: 'stake.com', nickname: '  ' }), 'stake.com');
});
