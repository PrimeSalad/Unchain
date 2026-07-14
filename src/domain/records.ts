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
  /** Did the user spend money on porn/R18 content? */
  pornDidSpend?: boolean;
  /** How much was spent on porn/R18 content. */
  pornSpendAmount?: number;
  /** Remaining money after porn spend (moneyBalance - pornSpendAmount). */
  pornRemainingMoney?: number;

  // ── Smoking-specific fields (only populated for smoking addiction) ────────
  /**
   * Did the user smoke on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  smoked?: boolean;
  /** Did the user spend money on smoking? */
  smokeDidSpend?: boolean;
  /** How much was spent on smoking. */
  smokeSpendAmount?: number;
  /** Remaining money after smoking spend (moneyBalance - smokeSpendAmount). */
  smokeRemainingMoney?: number;
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

  // ── Alcohol-specific fields (only populated for alcohol addiction) ─────────
  /**
   * Did the user drink alcohol on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  drank?: boolean;
  /** Did the user spend money on alcohol? */
  drinkDidSpend?: boolean;
  /** How much was spent on alcohol. */
  drinkSpendAmount?: number;
  /** Remaining money after alcohol spend (moneyBalance - drinkSpendAmount). */
  drinkRemainingMoney?: number;
  /** Number of standard drinks consumed on a relapse day. */
  drankCount?: string;
  /** Type of alcohol consumed (beer, spirits, wine, etc.). */
  drankType?: string;
  /** What triggered the drinking relapse. */
  drankTrigger?: string;
  /** Emotions felt before drinking. */
  drankEmotions?: string[];
  /** What could help next time. */
  drankNextTimePlan?: string;
  /** Urge intensity on a clean day (1–10). */
  alcoholUrgeIntensity?: number;
  /** What helped the user stay alcohol-free on a clean day. */
  alcoholWhatHelped?: string;

  // ── Drugs / substances-specific fields (only populated for drugs addiction) ──
  /**
   * Did the user use substances on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  used?: boolean;
  /** Did the user spend money on drugs/substances? */
  drugDidSpend?: boolean;
  /** How much was spent on drugs/substances. */
  drugSpendAmount?: number;
  /** Remaining money after drug spend (moneyBalance - drugSpendAmount). */
  drugRemainingMoney?: number;
  /** What substance was used (relapse day). */
  drugType?: string;
  /** How much was used (relapse day). */
  drugAmount?: string;
  /** What triggered the relapse (relapse day). */
  drugTrigger?: string;
  /** Emotions felt before using (relapse day). */
  drugEmotions?: string[];
  /** What could help next time (relapse day). */
  drugNextTimePlan?: string;
  /** Urge intensity on a clean day (1–10). */
  drugUrgeIntensity?: number;
  /** What helped the user stay clean on a clean day. */
  drugWhatHelped?: string;

  // ── Gaming-specific fields (only populated for gaming addiction) ──────
  /**
   * Did the user play excessively on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  played?: boolean;
  /** Hours spent gaming on a relapse day. */
  gamingHours?: string;
  /** What was played (relapse day). */
  gamingType?: string;
  /** How much was spent on in-game purchases (relapse day). */
  gamingAmountSpent?: number;
  /** Currency symbol used for the spend amount. */
  gamingSpendCurrency?: string;
  /** What triggered the gaming relapse. */
  gamingTrigger?: string;
  /** Emotions felt before gaming (relapse day). */
  gamingEmotions?: string[];
  /** What could help next time (relapse day). */
  gamingNextTimePlan?: string;
  /** How they feel now after gaming (relapse day). */
  gamingFeelingNow?: string;
  /** Urge intensity on a clean day (1–10). */
  gamingUrgeIntensity?: number;
  /** What helped the user stay gaming-free on a clean day. */
  gamingWhatHelped?: string;

  // ── Online-shopping-specific fields (only populated for online_shopping addiction) ──
  /**
   * Did the user shop online on this day?
   * true  → relapse (red calendar day, streak resets)
   * false → clean   (green calendar day)
   */
  shopped?: boolean;
  /** Where they shopped (relapse day). */
  shopWhere?: string;
  /** How much was spent (relapse day). */
  shopAmountSpent?: number;
  /** Currency symbol used for the spend amount. */
  shopSpendCurrency?: string;
  /** Remaining money after shopping (moneyBalance - shopAmountSpent). */
  shopRemainingMoney?: number;
  /** What triggered the shopping relapse. */
  shopTrigger?: string;
  /** Emotions felt before shopping (relapse day). */
  shopEmotions?: string[];
  /** What could help next time (relapse day). */
  shopNextTimePlan?: string;
  /** How they feel now after shopping (relapse day). */
  shopFeelingNow?: string;
  /** Urge intensity on a clean day (1–10). */
  shopUrgeIntensity?: number;
  /** What helped the user stay shop-free on a clean day. */
  shopWhatHelped?: string;
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
