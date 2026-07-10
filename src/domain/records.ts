/** Locally-stored recovery records. */

export interface DailyCheckIn {
  id: string;
  at: number;
  gambled: boolean;
  mood?: number; // 1..10
  urgeStrength?: number; // 1..10
  triggers?: string[];
  notes?: string;
}

export interface UrgeLog {
  id: string;
  at: number;
  intensity: number; // 1..10
  trigger?: string;
  notes?: string;
  resisted: boolean;
}

export interface RelapseEvent {
  id: string;
  at: number;
  amount?: number;
  whatHappened?: string;
  cause?: string;
  feeling?: string;
}

export interface JournalEntry {
  id: string;
  at: number;
  /** Free-text reflection / notes. */
  text: string;
  /** Mood rating 1–10. */
  mood?: number;
  /** Craving / trigger tag (legacy urge-journal path). */
  trigger?: string;

  // ── Gambling-specific fields (only populated for gambling addiction) ──────
  /** Did the user gamble on this day? */
  gambled?: boolean;
  /** Amount wagered (if gambled). */
  amountWagered?: number;
  /** Did the user lose money? */
  lost?: boolean;
  /** Amount lost (if applicable). */
  amountLost?: number;
  /** Why they gambled — selected option or free-text when "Other" chosen. */
  whyGambled?: string;

  // ── Financial tracking ────────────────────────────────────────────────────
  /**
   * The user's current money balance as of this journal entry.
   * Recorded independently from gambling outcome — a user can have more money
   * on a relapse day (e.g. they won) or less on a clean day (e.g. spent on
   * bills). Recovery status is NEVER inferred from this field; it is purely
   * for financial trend tracking on the Home and Progress screens.
   */
  moneyBalance?: number;
}

/** Emergency Reflection — captured during a crisis (SOS). Stored separately
 *  from the Journal so the two features never mix. */
export interface Reflection {
  id: string;
  at: number;
  text: string;
}

export type TimelineType =
  | 'checkin'
  | 'clean'
  | 'money'
  | 'urge'
  | 'relapse'
  | 'journal'
  | 'milestone'
  | 'badge'
  | 'achievement'
  | 'breathing'
  | 'start';

export interface TimelineEvent {
  id: string;
  at: number;
  type: TimelineType;
  label: string;
}

export function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
