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

export const MOTIVATION = [
  "You've already saved money that used to disappear.",
  'Recovery is built through small decisions, repeated.',
  'Cravings peak and fall — usually within minutes.',
  'The best time to stop was yesterday. The next best time is now.',
];

export const BREATHING_TIPS = [
  'Breathe out slowly — longer than you breathe in.',
  'Let your shoulders drop. Unclench your jaw.',
  'This feeling is temporary. You are safe right now.',
  'You do not have to make any decision this minute.',
];

export const HEALTHY_ALTERNATIVES = [
  'Take a 10-minute walk.',
  'Message someone you trust.',
  'Drink a glass of water.',
  'Move your money out of reach.',
  'Do 20 push-ups or stretch.',
  'Write down what you are feeling.',
];

export function quoteOfNow(seed = Date.now()): string {
  return QUOTES[Math.floor(seed / 3_600_000) % QUOTES.length];
}
export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
