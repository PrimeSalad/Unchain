/**
 * Recovery quotes - bundled with the app so motivation works fully offline.
 * All quotes are original recovery-focused lines (no invented attributions);
 * the model supports an optional author for future additions.
 */

export interface Quote {
  text: string;
  author?: string;
}

export interface FavoriteQuote {
  text: string;
  author?: string;
  /** When the user favorited it - also the stable identity for removal. */
  savedAt: number;
}

export const QUOTES: Quote[] = [
  { text: 'One day at a time. That is the whole method, and it works.' },
  { text: 'The urge is loud, but it is not in charge. You are.' },
  { text: 'Every craving you outlast makes the next one smaller.' },
  { text: 'You are not starting over. You are starting from experience.' },
  { text: 'Recovery is built through small decisions, repeated daily.' },
  { text: 'The money you keep today is a future you chose on purpose.' },
  { text: 'You do not have to feel strong to act strong.' },
  { text: 'Cravings peak and fall - usually within minutes. Wait them out.' },
  { text: 'A bad day clean is still a clean day. It counts.' },
  { text: 'You are not your worst day, and you never were.' },
  { text: 'The best time to stop was yesterday. The next best time is right now.' },
  { text: 'Discomfort is the feeling of your brain healing.' },
  { text: 'Every honest check-in is a brick in the wall between you and relapse.' },
  { text: 'You have survived one hundred percent of your hardest days so far.' },
  { text: 'Freedom is not one big choice. It is a thousand small ones.' },
  { text: 'The person you are becoming is worth more than any bet.' },
  { text: 'Slips are data, not destiny. Learn the lesson and keep walking.' },
  { text: 'Your future self is watching today with gratitude.' },
  { text: 'Peace of mind pays better than any jackpot ever will.' },
  { text: 'You are allowed to be proud of progress no one else can see.' },
  { text: 'When the urge says "just once", remember it has said that before.' },
  { text: 'Rest is productive. Boredom is survivable. Urges are temporary.' },
  { text: 'Ask for help early. Strength includes knowing when to reach out.' },
  { text: 'You broke the chain once today already - by choosing to be here.' },
  { text: 'Nothing you could win tonight is worth what it costs tomorrow.' },
  { text: 'Healing is not linear, but it is happening. Keep going.' },
  { text: 'The calm you feel on day thirty is built on day one.' },
  { text: 'Say no once, and the whole day gets easier.' },
  { text: 'Your reasons for quitting are stronger than your reasons for staying.' },
  { text: 'Cravings cannot make you do anything. They can only ask.' },
  { text: 'A walk, a breath, a glass of water - small anchors hold big ships.' },
  { text: 'You are trading a moment of relief for a lifetime of freedom. Good trade.' },
  { text: 'The strongest word in recovery is "tomorrow I will still be free."' },
  { text: 'Every day free is proof that you can do hard things.' },
  { text: 'Talk to yourself like someone you are helping to recover - because you are.' },
  { text: 'You did not come this far to only come this far.' },
];

/** Local calendar day key, e.g. "2026-07-10". Rolls over at the device's midnight. */
export function localDayKey(now = Date.now()): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** How many recently-shown indexes to remember before allowing repeats. */
export const QUOTE_HISTORY_SIZE = Math.floor(QUOTES.length * 0.6);

/**
 * Pick the next daily quote index, avoiding recently shown ones until the
 * collection has been reasonably cycled. Falls back to the full pool when
 * every index is "recent" (defensive - should not happen with the cap).
 */
export function pickDailyQuoteIndex(recent: number[], poolSize = QUOTES.length): number {
  const seen = new Set(recent);
  const candidates: number[] = [];
  for (let i = 0; i < poolSize; i++) if (!seen.has(i)) candidates.push(i);
  const pool = candidates.length > 0 ? candidates : Array.from({ length: poolSize }, (_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}
