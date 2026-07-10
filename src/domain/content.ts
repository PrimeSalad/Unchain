/** Static recovery content — quotes, tips, alternatives. All local, no network. */

export const QUOTES = [
  'One day at a time.',
  "Recovery starts with today's decision.",
  'Your future is worth more than another bet.',
  'Recovery is built through small decisions.',
  "You've already saved enough to build something better.",
  'The urge will pass whether you act on it or not.',
  'Every honest check-in strengthens your recovery.',
  'You are not your worst day.',
  'The money you keep is a future you choose.',
];

export const BREATHING_TIPS = [
  'Breathe out slowly — longer than you breathe in.',
  'Let your shoulders drop. Unclench your jaw.',
  'This feeling is temporary. You are safe right now.',
  'You do not have to make any decision this minute.',
];

export function quoteOfNow(seed = Date.now()): string {
  return QUOTES[Math.floor(seed / 3_600_000) % QUOTES.length];
}
