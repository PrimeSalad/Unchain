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
  /** Multiple selected triggers. `trigger` is retained for older local data. */
  triggers?: string[];
  notes?: string;
  resisted: boolean;
  /** Mood rating at the time of the urge (1–10, optional - older entries won't have this). */
  mood?: number;
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
  /** Why they gambled - selected option or free-text when "Other" chosen. */
  whyGambled?: string;

  // ── Financial tracking ────────────────────────────────────────────────────
  /**
   * The RAW answer to "How much money do you have today?" as entered by the
   * user. Financial metrics never read this directly - they use the
   * recovery-adjusted balance (`recoveryAdjustedBalance` in gambling.ts):
   * on a day the user gambled and lost, the wager is subtracted
   * (remaining = moneyToday - wagerAmount); a gambling win is never added,
   * so wins can never improve any progress metric. Recovery status (streak,
   * calendar, achievements) is NEVER inferred from this field.
   */
  moneyBalance?: number;

  // ── Pornography-specific fields (only populated for porn addiction) ────────
  /**
   * Did the user watch pornography on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day, urgesResisted++)
   */
  watched?: boolean;

  // ── Smoking-specific fields (only populated for smoking addiction) ────────
  /**
   * Did the user smoke on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  smoked?: boolean;
  /** Number of cigarettes / vapes smoked on a relapse day. */
  smokedCount?: number;
  /** What type they smoked (cigarette, vape, cigar, etc.) */
  smokedType?: string;
  /** What triggered the smoking relapse. */
  smokeTrigger?: string;
  /** Emotions felt before smoking. */
  smokeEmotions?: string[];
  /** What could help next time. */
  smokeNextTimePlan?: string;
  /** Urge intensity on a clean day (1–10). */
  smokeUrgeIntensity?: number;
  /** What helped the user resist on a clean day. */
  smokeWhatHelped?: string;

  // ── Social-media-specific fields (only populated for social_media addiction) ──
  /**
   * Did the user binge social media on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  binged?: boolean;
  /** Platforms used during a binge session. */
  bingedPlatforms?: string[];
  /** How long they scrolled in minutes (binge day). */
  bingeDuration?: string;
  /** What triggered the binge. */
  bingeTrigger?: string;
  /** How they were feeling before the binge. */
  bingeEmotions?: string[];
  /** What could help next time. */
  bingeNextTimePlan?: string;
  /** Urge intensity on a clean day (1–10). */
  socialUrgeIntensity?: number;
  /** Triggers noticed on a clean social-media-free day. */
  socialTriggersEncountered?: string[];
  /** What helped the user stay off social media. */
  socialWhatHelped?: string;
  /** Urge intensity experienced today (1–10, clean day only). */
  urgeIntensity?: number;
  /** Triggers the user encountered today (clean day). */
  triggersEncountered?: string[];
  /** What helped them stay clean (clean day). */
  whatHelped?: string;
  /** How long they watched in minutes (relapse day). */
  watchDuration?: number;
  /** What led up to the relapse (relapse day). */
  relapseLeadUp?: string;
  /** Emotions felt before watching (relapse day). */
  emotionsBefore?: string;
  /** What triggered the relapse (relapse day). */
  relapseTrigger?: string;
  /** What could help next time (relapse day). */
  nextTimePlan?: string;
  /** How they feel now after watching (relapse day). */
  feelingNow?: string;
}

/** Emergency Reflection - captured during a crisis (SOS). Stored separately
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
  | 'activity'
  | 'shield'
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
