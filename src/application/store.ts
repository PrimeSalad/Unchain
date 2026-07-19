import { create } from 'zustand';
import type * as ZustandMiddleware from 'zustand/middleware';

// Use the CommonJS middleware entry at runtime so web bundling doesn't pull
// zustand's ESM middleware path, which can leak import.meta into the browser
// bundle and white-screen Expo web.
const middleware = require('zustand/middleware') as typeof ZustandMiddleware;
const { persist, createJSONStorage } = middleware;
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AddictionType, RecoveryProfile } from '@/domain/gambling';
import { streakDays, currentStreakStart } from '@/domain/gambling';
import { currentWeekStart } from '@/domain/pornRecovery';
import type { Badge, Goal, GoalKind } from '@/domain/achievements';
import type { SudokuLevel } from '@/domain/games/sudoku';
import type { Difficulty as CheckersDifficulty } from '@/domain/games/checkers';
import {
  GAME_ACHIEVEMENTS,
  evaluateGameAchievements,
  type GameAchievement,
  type GameEvent,
} from '@/domain/games/achievements';
import {
  BADGES,
  computeStats,
  earnedBadgeIds,
  goalProgress,
  goalTitle,
} from '@/domain/achievements';
import type {
  DailyCheckIn,
  JournalEntry,
  Reflection,
  RelapseEvent,
  TimelineEvent,
  TimelineType,
  UrgeLog,
} from '@/domain/records';
import { sameDay } from '@/domain/records';
import type { AltAchievement, AltCounts, AlternativeId, NeedOrWantEntry } from '@/domain/alternatives';
import type { CatchYourBreathEntry } from '@/domain/catchYourBreath';
import { catchYourBreathAvailability } from '@/domain/catchYourBreath';
import type { CheersToChangeEntry } from '@/domain/cheersToChange';
import { cheersToChangeAvailability } from '@/domain/cheersToChange';
import type { BackOnTrackEntry } from '@/domain/backOnTrack';
import { backOnTrackAvailability } from '@/domain/backOnTrack';
import type { OneMoreMinuteSession } from '@/domain/oneMoreMinute';
import { computeStats as computeOmmStats, evaluateOmmAchievements } from '@/domain/oneMoreMinute';
import type { FoodEntry, WaterEntry, FastingSession, NutritionGoals } from '@/domain/fuelYourRecovery';
import { dailyFoodSummary, dailyWaterTotal, mealStreak, waterStreak, evaluateFuelAchievements, dayKey } from '@/domain/fuelYourRecovery';
import {
  ALTERNATIVES,
  altAchievementById,
  alternativeById,
  evaluateAltAchievements,
} from '@/domain/alternatives';
import type { FavoriteQuote } from '@/domain/quotes';
import { QUOTES, QUOTE_HISTORY_SIZE, localDayKey, pickDailyQuoteIndex } from '@/domain/quotes';
import type { BlockedSite } from '@/domain/protection';
import { domainsOverlap, normalizeDomain } from '@/domain/protection';
import type { DailyMissionState, MissionId } from '@/domain/missions';
import { missionById, missionDayKey } from '@/domain/missions';
import { challengeDayNumber, dailyChallengeTarget } from '@/domain/games/inhibition';
import { normalizeSelectedAddictions } from '@/domain/multiAddiction';
import { journalCompletedToday } from '@/domain/addictionJournal';

/**
 * Single local store for the recovery companion. Offline-first: no accounts,
 * no backend - persisted to the device with AsyncStorage.
 */

type ThemePref = 'system' | 'light' | 'dark';

/** Recreational-games progress. Flat shape keeps shallow merges simple. */
export interface GamesState {
  blocksBest: number;
  blocksGames: number;
  checkersWins: number;
  checkersLosses: number;
  sudokuSolved: number;
  sudokuBestMs: Partial<Record<SudokuLevel, number>>;
  clarityDay: number;
  clarityGuesses: string[];
  clarityStatus: 'playing' | 'won' | 'lost';
  clarityStreak: number;
  clarityBestStreak: number;
  clarityPlayed: number;
  clarityWon: number;
  clarityPracticePlayed: number;
  clarityPracticeWon: number;
  gonogoBest: number;
  gonogoGames: number;
  stopBest: number;
  stopGames: number;
  /** Daily-challenge completion day per game (challengeDayNumber), so each
   *  game's challenge can only pay out once per local day. */
  challengeDoneDay: Record<string, number>;
  /** Permanently unlocked game achievements: id → unlockedAt (ms). */
  achievements: Record<string, number>;
  /** Games whose "How to play" popup the user opted out of ("Don't show
   *  this again"). The header info button always re-opens it on demand. */
  tutorialsHidden: Record<string, boolean>;
}

export const initialGames: GamesState = {
  blocksBest: 0,
  blocksGames: 0,
  checkersWins: 0,
  checkersLosses: 0,
  sudokuSolved: 0,
  sudokuBestMs: {},
  clarityDay: -1,
  clarityGuesses: [],
  clarityStatus: 'playing',
  clarityStreak: 0,
  clarityBestStreak: 0,
  clarityPlayed: 0,
  clarityWon: 0,
  clarityPracticePlayed: 0,
  clarityPracticeWon: 0,
  gonogoBest: 0,
  gonogoGames: 0,
  stopBest: 0,
  stopGames: 0,
  challengeDoneDay: {},
  achievements: {},
  tutorialsHidden: {},
};

export interface AddictionRecoverySnapshot {
  profile: RecoveryProfile;
  checkIns: DailyCheckIn[];
  urges: UrgeLog[];
  relapses: RelapseEvent[];
  journal: JournalEntry[];
  reflections: Reflection[];
  timeline: TimelineEvent[];
  points: number;
  longestStreak: number;
  goals: Goal[];
  celebratedBadges: string[];
  alternatives: Partial<Record<AlternativeId, number>>;
  altCounts: AltCounts;
  altAchievements: Record<string, number>;
  altSeconds: Partial<Record<AlternativeId, number>>;
  altSessions: Partial<Record<AlternativeId, number>>;
  walkSteps: number;
  walkMeters: number;
  waterToday: { day: string; glasses: number };
  waterGlassesTotal: number;
  needOrWantCooldown: number | null;
  needOrWantEntries: NeedOrWantEntry[];
  activeNeedOrWantId: string | null;
  catchYourBreathEntries: CatchYourBreathEntry[];
  lastCatchYourBreathAt: number | null;
  cheersToChangeEntries: CheersToChangeEntry[];
  lastCheersToChangeAt: number | null;
  backOnTrackEntries: BackOnTrackEntry[];
  lastBackOnTrackAt: number | null;
  lastCheckedIn: number | null;
  urgesResisted: number;
  urgesResistedWeek: number;
  healthyHabitsCount: number;
  dailyMissions: DailyMissionState;
  missionXp: number;
}

export interface DailyJournalPlan {
  day: string;
  required: AddictionType[];
  startedAt: number;
  completedAt?: number;
}

export interface PersistedJournalDraft {
  day: string;
  values: Record<string, unknown>;
}

interface RecoveryState {
  onboarded: boolean;
  disclaimerAccepted: boolean;
  profile: RecoveryProfile | null;
  recoveryByAddiction: Partial<Record<AddictionType, AddictionRecoverySnapshot>>;
  dailyJournalPlan: DailyJournalPlan | null;
  journalDrafts: Partial<Record<AddictionType, PersistedJournalDraft>>;
  checkIns: DailyCheckIn[];
  urges: UrgeLog[];
  relapses: RelapseEvent[];
  journal: JournalEntry[];
  reflections: Reflection[];
  timeline: TimelineEvent[];
  points: number;
  longestStreak: number;
  goals: Goal[];
  /** Badge ids already surfaced to the user (so we celebrate each only once). */
  celebratedBadges: string[];
  games: GamesState;
  themePref: ThemePref;

  // ── Healthy Alternatives ────────────────────────────────────────────────
  /** Last completion timestamp per activity. "Done today" = sameDay(ts, now),
   *  so state resets automatically at local midnight without a scheduler. */
  alternatives: Partial<Record<AlternativeId, number>>;
  /** Lifetime completion counts (one per activity per day) - powers the
   *  healthy-habit achievements. `journal` is derived, not stored here. */
  altCounts: AltCounts;
  /** Permanently unlocked habit achievements: id → unlockedAt (ms). */
  altAchievements: Record<string, number>;
  /** Lifetime seconds spent per timed activity - powers the Strava-style
   *  session share cards. Every session adds, including same-day repeats. */
  altSeconds: Partial<Record<AlternativeId, number>>;
  /** Lifetime session counts per activity (every session, incl. repeats). */
  altSessions: Partial<Record<AlternativeId, number>>;
  /** Lifetime walk totals - steps counted and metres covered (GPS). */
  walkSteps: number;
  walkMeters: number;
  /** Glasses drunk today - day-keyed so it resets at local midnight. */
  waterToday: { day: string; glasses: number };
  /** Lifetime glasses logged. */
  waterGlassesTotal: number;
  /** Need or Want? cooldown - timestamp when the 24-hour cooldown started.
   *  null means no active cooldown. Persists across app restarts. */
  needOrWantCooldown: number | null;
  /** All need-or-want entries — the item, reflections, and outcome. */
  needOrWantEntries: NeedOrWantEntry[];
  /** Active need-or-want entry id during cooldown (so follow-up can load it). */
  activeNeedOrWantId: string | null;

  // ── Catch Your Breath (smoking-only weekly reflection) ──────────────────
  /** All weekly lung health assessment entries, newest first. */
  catchYourBreathEntries: CatchYourBreathEntry[];
  /** Timestamp of the last completed assessment. null = never completed. */
  lastCatchYourBreathAt: number | null;

  // ── Cheers to Change (alcohol-only weekly reflection) ───────────────────
  /** All weekly wellness assessment entries, newest first. */
  cheersToChangeEntries: CheersToChangeEntry[];
  /** Timestamp of the last completed assessment. null = never completed. */
  lastCheersToChangeAt: number | null;

  // ── Back on Track (drug/substance-only weekly reflection) ───────────────
  /** All weekly recovery check-in entries, newest first. */
  backOnTrackEntries: BackOnTrackEntry[];
  /** Timestamp of the last completed assessment. null = never completed. */
  lastBackOnTrackAt: number | null;

  // ── One More Minute (universal recovery timer) ──────────────────────────
  /** All timer sessions (history). */
  ommSessions: OneMoreMinuteSession[];
  /** Permanently unlocked OMM achievements: id → unlockedAt (ms). */
  ommAchievements: Record<string, number>;

  // ── Fuel Your Recovery (universal nutrition companion) ──────────────────
  /** All food entries (history). */
  fuelFoodEntries: FoodEntry[];
  /** All water entries (history). */
  fuelWaterEntries: WaterEntry[];
  /** All fasting sessions (history). */
  fuelFastingSessions: FastingSession[];
  /** User's nutrition goals. */
  fuelGoals: NutritionGoals;
  /** Whether the user has completed the body info setup (BMI, lifestyle). */
  fuelBodyInfoSet: boolean;
  /** Permanently unlocked Fuel achievements: id → unlockedAt (ms). */
  fuelAchievements: Record<string, number>;

  // ── Porn Recovery Metrics ───────────────────────────────────────────────
  lastCheckedIn: number | null;
  urgesResisted: number;
  urgesResistedWeek: number;
  healthyHabitsCount: number;
  updateLastCheckedIn: () => void;

  // ── Education Hub ────────────────────────────────────────────────────────
  /** Bookmarked guide/resource ids. */
  eduBookmarks: string[];
  /** Reading progress per built-in guide: fraction read + scroll offset so
   *  "Continue reading" reopens exactly where the user left off. */
  eduProgress: Record<string, { pct: number; offset: number }>;
  /** The last guide opened - powers the hub's Continue Reading card. */
  eduLastGuideId: string | null;
  toggleEduBookmark: (id: string) => void;
  setEduProgress: (guideId: string, pct: number, offset: number) => void;

  // ── Focus Protection ────────────────────────────────────────────────────
  /** The user's permanent blocklist - every entry added explicitly by them,
   *  protected until manually removed. No timers, no expiry. Stored locally
   *  only; never uploaded, never auto-populated. */
  blockedSites: BlockedSite[];

  // ── Daily Missions ───────────────────────────────────────────────────────
  /** Today's mission completion state. Resets automatically on a new local
   *  calendar day (checked on every completeMission call and on hydration). */
  dailyMissions: DailyMissionState;
  /** Lifetime XP accumulated from missions. Powers the level system. */
  missionXp: number;

  // ── Recovery Motivation ─────────────────────────────────────────────────
  /** Quotes the user has hearted. Survive restarts/updates via persistence. */
  favoriteQuotes: FavoriteQuote[];
  /** Today's quote - same all day, rotates once per local calendar day. */
  dailyQuote: { day: string; index: number } | null;
  /** Recently shown quote indexes - avoids repeats until the pool cycles. */
  recentQuotes: number[];

  // Recreational games - record actions return achievements newly unlocked
  // by that result so screens can celebrate them.
  recordCheckers: (
    result: 'win' | 'loss',
    ctx: { difficulty: CheckersDifficulty; piecesLeft: number },
  ) => GameAchievement[];
  recordSudoku: (
    level: SudokuLevel,
    ms: number,
    ctx: { mistakes: number; hints: number },
  ) => GameAchievement[];
  recordBlocks: (score: number, ctx: { maxCombo: number; maxLines: number }) => GameAchievement[];
  /** Record an inhibition-game round. Awards Recovery Points scaled by the
   *  score (plus a daily-challenge bonus the first time the day's target is
   *  beaten) and returns everything the results screen needs. */
  recordInhibition: (
    game: 'gonogo',
    summary: {
      score: number;
      accuracy: number;
      maxCombo: number;
      avgReactionMs: number;
      trials: number;
    },
  ) => { unlocked: GameAchievement[]; pointsEarned: number; newBest: boolean; challengeCompleted: boolean };
  saveClarityProgress: (day: number, guesses: string[]) => void;
  /** Remember whether a game's "How to play" popup auto-shows on open. */
  setTutorialHidden: (game: string, hidden: boolean) => void;
  recordClarityResult: (day: number, guesses: string[], won: boolean) => GameAchievement[];
  recordClarityPractice: (won: boolean, guessCount: number) => GameAchievement[];
  /** Set (or intentionally edit) today's mood on today's check-in. No-op without one. */
  setTodayMood: (mood: number) => void;

  /** Mark a Healthy Alternative complete for today (idempotent per day -
   *  repeat sessions refresh the timestamp without double-awarding). Returns
   *  any habit achievements newly unlocked by this completion. */
  completeAlternative: (id: AlternativeId) => AltAchievement[];
  /** Log a finished activity session's duration for lifetime stats. Safe to
   *  call on every session - repeats add up (that's the point). */
  recordAltSession: (id: AlternativeId, seconds: number) => void;
  /** Add a finished walk's steps + metres to the lifetime totals. */
  recordWalkMetrics: (steps: number, meters: number) => void;
  /** Log glasses of water for today (clamped 1–24 per log). Returns today's
   *  running total after the log. */
  logWater: (glasses: number) => number;
  /** Start the 24-hour Need or Want? cooldown. Completes the alternative
   *  for today and records the start timestamp. */
  startNeedOrWantCooldown: () => void;
  /** Save a need-or-want entry when the cooldown starts. */
  saveNeedOrWantEntry: (entry: Omit<NeedOrWantEntry, 'id' | 'at' | 'cooldownStart' | 'decision'>) => string;
  /** Record the user's follow-up decision on a need-or-want entry. */
  decideNeedOrWantEntry: (id: string, decision: boolean) => void;
  /** Delete a need-or-want entry from history. */
  deleteNeedOrWantEntry: (id: string) => void;
  /** Save a Catch Your Breath weekly assessment. Returns any habit achievements
   *  newly unlocked. Increments healthyHabitsCount and awards points. */
  addCatchYourBreath: (entry: Omit<CatchYourBreathEntry, 'id' | 'at'>) => AltAchievement[];
  /** Whether the Catch Your Breath assessment is available now (7-day cooldown). */
  canCompleteCatchYourBreath: () => { available: boolean; nextAt?: number; daysLeft?: number };
  /** Delete a Catch Your Breath entry from history. */
  deleteCatchYourBreathEntry: (id: string) => void;
  /** Save a Cheers to Change weekly assessment. Returns any habit achievements
   *  newly unlocked. Increments healthyHabitsCount and awards points. */
  addCheersToChange: (entry: Omit<CheersToChangeEntry, 'id' | 'at'>) => AltAchievement[];
  /** Whether the Cheers to Change assessment is available now (7-day cooldown). */
  canCompleteCheersToChange: () => { available: boolean; nextAt?: number; daysLeft?: number };
  /** Delete a Cheers to Change entry from history. */
  deleteCheersToChangeEntry: (id: string) => void;
  /** Save a Back on Track weekly assessment. Returns any habit achievements
   *  newly unlocked. Increments healthyHabitsCount and awards points. */
  addBackOnTrack: (entry: Omit<BackOnTrackEntry, 'id' | 'at'>) => AltAchievement[];
  /** Whether the Back on Track assessment is available now (7-day cooldown). */
  canCompleteBackOnTrack: () => { available: boolean; nextAt?: number; daysLeft?: number };
  /** Delete a Back on Track entry from history. */
  deleteBackOnTrackEntry: (id: string) => void;
  /** Complete a One More Minute session. Awards points, achievements, and timeline events. */
  completeOmmSession: (session: Omit<OneMoreMinuteSession, 'id'>) => void;
  /** Log a food entry. */
  addFuelFoodEntry: (entry: Omit<FoodEntry, 'id' | 'at'>) => void;
  /** Delete a food entry. */
  deleteFuelFoodEntry: (id: string) => void;
  /** Toggle a food as favorite. */
  toggleFuelFavorite: (id: string) => void;
  /** Log water intake. */
  addFuelWater: (amountMl: number) => void;
  /** Start a fasting session. */
  startFuelFast: (targetMinutes: number) => void;
  /** End the current fasting session. */
  endFuelFast: () => void;
  /** Update nutrition goals. */
  updateFuelGoals: (patch: Partial<NutritionGoals>) => void;
  /** Mark body info setup as complete. */
  setFuelBodyInfo: (patch: Partial<NutritionGoals>) => void;
  /** Add a website to the permanent blocklist. Validates + de-duplicates.
   *  Protection starts immediately and never expires. */
  addBlockedSite: (domainInput: string, nickname?: string) => 'added' | 'duplicate' | 'invalid';
  /** Edit domain and/or nickname. Validates + de-duplicates against others. */
  updateBlockedSite: (
    id: string,
    patch: { domain?: string; nickname?: string },
  ) => 'updated' | 'duplicate' | 'invalid';
  /** The ONLY way a site stops being protected - explicit manual removal. */
  removeBlockedSite: (id: string) => void;

  /** Complete a daily mission for today. Idempotent - repeating the same
   *  mission ID in the same day is a no-op. Returns the XP awarded (0 if
   *  already completed or on error). Resets stale state if a new local day
   *  has started. */
  completeMission: (id: MissionId) => number;

  /** Heart / un-heart a quote. */
  toggleFavoriteQuote: (q: { text: string; author?: string }) => void;
  removeFavoriteQuote: (savedAt: number) => void;
  /** Make sure today's quote is chosen; returns its index. Cheap no-op when
   *  today's pick already exists. */
  ensureDailyQuote: () => number;

  completeSetup: (profile: RecoveryProfile) => void;
  setActiveAddiction: (addiction: AddictionType) => void;
  ensureDailyJournalPlan: () => AddictionType[];
  saveJournalDraft: (addiction: AddictionType, values: Record<string, unknown>) => void;
  clearJournalDraft: (addiction: AddictionType) => void;
  acceptDisclaimer: () => void;
  addGoal: (kind: GoalKind, target: number) => void;
  removeGoal: (id: string) => void;
  /** Recompute earned badges + goal completions; returns badges newly earned
   *  since the last call (for celebration). Safe to call on any change. */
  syncAchievements: () => Badge[];
  updateProfile: (patch: Partial<RecoveryProfile>) => void;
  submitCheckIn: (data: Omit<DailyCheckIn, 'id' | 'at'>) => void;
  logUrge: (data: Omit<UrgeLog, 'id' | 'at'>) => string;
  updateUrge: (id: string, data: Omit<UrgeLog, 'id' | 'at'>) => void;
  deleteUrge: (id: string) => void;
  logRelapse: (data: Omit<RelapseEvent, 'id' | 'at'>) => void;
  addJournal: (data: Omit<JournalEntry, 'id' | 'at'>) => void;
  addJournalForAddiction: (addiction: AddictionType, data: Omit<JournalEntry, 'id' | 'at'>) => void;
  addReflection: (text: string) => void;
  deleteReflection: (id: string) => void;
  addPoints: (n: number) => void;
  pushTimeline: (type: TimelineType, label: string) => void;
  setTheme: (t: ThemePref) => void;
  /** Wipes all recovery records and restarts the streak from now, but keeps
   *  profile details (name, addiction type, reason, theme). */
  resetRecovery: () => void;
  /** Deletes every piece of local data and returns the app to onboarding. */
  resetAll: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function evt(type: TimelineType, label: string): TimelineEvent {
  return { id: uid(), at: Date.now(), type, label };
}

function selectedAddictions(profile: RecoveryProfile): AddictionType[] {
  return normalizeSelectedAddictions(profile.addictionType, profile.selectedAddictions);
}

function seededJournalEntry(addiction: AddictionType, at: number, relapsed: boolean): JournalEntry {
  const base = { id: uid(), at, text: relapsed ? 'Last use before recovery.' : 'Clean day.' };
  switch (addiction) {
    case 'pornography': return { ...base, watched: relapsed };
    case 'social_media': return { ...base, binged: relapsed };
    case 'online_shopping': return { ...base, shopped: relapsed };
    case 'smoking': return { ...base, smoked: relapsed };
    case 'alcohol': return { ...base, drank: relapsed };
    case 'drugs': return { ...base, used: relapsed };
    case 'gaming': return { ...base, played: relapsed };
    case 'other': return { ...base, otherActed: relapsed };
    default: return { ...base, gambled: relapsed };
  }
}

function initialRecoveryHistory(profile: RecoveryProfile): Pick<AddictionRecoverySnapshot, 'relapses' | 'journal' | 'timeline'> {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const isToday = profile.startedAt >= todayMid;
  const seedAt = profile.startedAt + 1;
  const relapses: RelapseEvent[] = isToday
    ? []
    : [{ id: uid(), at: seedAt, whatHappened: 'Last use before recovery' }];
  const journal: JournalEntry[] = [];
  if (!isToday) {
    journal.push(seededJournalEntry(profile.addictionType, seedAt, true));
    const cursor = new Date(profile.startedAt);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getTime() < todayMid) {
      const noon = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12).getTime();
      journal.push(seededJournalEntry(profile.addictionType, noon, false));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { relapses, journal, timeline: [evt('start', 'Recovery started')] };
}

function createAddictionSnapshot(profile: RecoveryProfile): AddictionRecoverySnapshot {
  const history = initialRecoveryHistory(profile);
  return {
    profile, checkIns: [], urges: [], relapses: history.relapses, journal: history.journal,
    reflections: [], timeline: history.timeline, points: 0, longestStreak: 0,
    goals: [], celebratedBadges: [], alternatives: {}, altCounts: {}, altAchievements: {},
    altSeconds: {}, altSessions: {}, walkSteps: 0, walkMeters: 0,
    waterToday: { day: '', glasses: 0 }, waterGlassesTotal: 0,
    needOrWantCooldown: null, needOrWantEntries: [], activeNeedOrWantId: null,
    catchYourBreathEntries: [], lastCatchYourBreathAt: null,
    cheersToChangeEntries: [], lastCheersToChangeAt: null,
    backOnTrackEntries: [], lastBackOnTrackAt: null,
    lastCheckedIn: null, urgesResisted: 0, urgesResistedWeek: 0,
    healthyHabitsCount: 0, dailyMissions: { day: missionDayKey(), completed: [] }, missionXp: 0,
  };
}

/**
 * A newly added secondary track starts when it is added. Values that only
 * describe the current track (last-use history, spending, and triggers) must
 * not be copied into a different addiction's recovery record.
 */
function createSecondaryProfile(
  source: RecoveryProfile,
  addictionType: AddictionType,
  selections: AddictionType[],
): RecoveryProfile {
  return {
    name: source.name,
    age: source.age,
    addictionType,
    selectedAddictions: selections,
    startedAt: Date.now(),
    expenseAmount: 0,
    expensePeriod: source.expensePeriod,
    currency: source.currency,
    triggers: [],
    reason: source.reason,
  };
}

function captureAddictionSnapshot(s: RecoveryState): AddictionRecoverySnapshot | null {
  if (!s.profile) return null;
  return {
    profile: s.profile, checkIns: s.checkIns, urges: s.urges, relapses: s.relapses,
    journal: s.journal, reflections: s.reflections, timeline: s.timeline,
    points: s.points, longestStreak: s.longestStreak, goals: s.goals,
    celebratedBadges: s.celebratedBadges, alternatives: s.alternatives,
    altCounts: s.altCounts, altAchievements: s.altAchievements, altSeconds: s.altSeconds,
    altSessions: s.altSessions, walkSteps: s.walkSteps, walkMeters: s.walkMeters,
    waterToday: s.waterToday, waterGlassesTotal: s.waterGlassesTotal,
    needOrWantCooldown: s.needOrWantCooldown, needOrWantEntries: s.needOrWantEntries,
    activeNeedOrWantId: s.activeNeedOrWantId,
    catchYourBreathEntries: s.catchYourBreathEntries, lastCatchYourBreathAt: s.lastCatchYourBreathAt,
    cheersToChangeEntries: s.cheersToChangeEntries, lastCheersToChangeAt: s.lastCheersToChangeAt,
    backOnTrackEntries: s.backOnTrackEntries, lastBackOnTrackAt: s.lastBackOnTrackAt,
    lastCheckedIn: s.lastCheckedIn, urgesResisted: s.urgesResisted,
    urgesResistedWeek: s.urgesResistedWeek, healthyHabitsCount: s.healthyHabitsCount,
    dailyMissions: s.dailyMissions, missionXp: s.missionXp,
  };
}

function journalForAddictionState(s: RecoveryState, addiction: AddictionType): JournalEntry[] {
  if (s.profile?.addictionType === addiction) return s.journal;
  return s.recoveryByAddiction[addiction]?.journal ?? [];
}

function dailyJournalIsComplete(s: RecoveryState): boolean {
  const plan = s.dailyJournalPlan;
  if (!plan || plan.day !== missionDayKey() || plan.required.length === 0) return false;
  return plan.required.every((addiction) =>
    journalCompletedToday(journalForAddictionState(s, addiction), addiction),
  );
}

function resistedCounterPatch(
  s: Pick<RecoveryState, 'urgesResisted' | 'urgesResistedWeek'>,
  now = Date.now(),
) {
  const weekStart = currentWeekStart(now);
  const sameWeek = s.urgesResistedWeek === weekStart;
  return {
    urgesResisted: sameWeek ? s.urgesResisted + 1 : 1,
    urgesResistedWeek: weekStart,
  };
}

const PERSIST_KEY = 'unchainly-gambling-v1';
const LEGACY_PERSIST_KEY = 'unchained-gambling-v1';

const persistentStorage = {
  async getItem(name: string) {
    const current = await AsyncStorage.getItem(name);
    if (current != null || name !== PERSIST_KEY) return current;

    const legacy = await AsyncStorage.getItem(LEGACY_PERSIST_KEY);
    if (legacy != null) {
      await AsyncStorage.setItem(PERSIST_KEY, legacy);
    }
    return legacy;
  },
  setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
  async removeItem(name: string) {
    await AsyncStorage.removeItem(name);
    if (name === PERSIST_KEY) {
      await AsyncStorage.removeItem(LEGACY_PERSIST_KEY);
    }
  },
};

/** True when every Healthy Alternative has been completed today -
 *  the journal activity is derived from the journal entries themselves.
 *  `need-or-want` is only required for online shopping addiction. */
function altFullDay(
  alternatives: Partial<Record<AlternativeId, number>>,
  journal: Array<{ at: number }>,
  now: number,
  addictionType?: string,
): boolean {
  return ALTERNATIVES.every((a) => {
    // 'need-or-want' only counts for online shopping addiction
    if (a.id === 'need-or-want' && addictionType !== 'online_shopping') return true;
    // 'catch-your-breath', 'cheers-to-change', and 'back-on-track' are weekly, not daily
    if (a.id === 'catch-your-breath' || a.id === 'cheers-to-change' || a.id === 'back-on-track') return true;
    return a.id === 'journal'
      ? journal.some((j) => sameDay(j.at, now))
      : alternatives[a.id] != null && sameDay(alternatives[a.id]!, now);
  });
}

/** Habit-achievement ids newly satisfied and not yet unlocked. */
function newAltUnlocks(
  counts: AltCounts,
  fullDay: boolean,
  unlockedMap: Record<string, number>,
): AltAchievement[] {
  return evaluateAltAchievements(counts, fullDay)
    .filter((id) => !unlockedMap[id])
    .map((id) => altAchievementById(id))
    .filter((a): a is AltAchievement => !!a);
}

/**
 * Merge a games-state update with achievement evaluation. Returns the state
 * patch (games + timeline + points) and the achievements newly unlocked by
 * this event. Unlocks are permanent and each awards a few points.
 */
function withGameEvent(
  s: Pick<RecoveryState, 'points' | 'timeline'>,
  games: GamesState,
  ev: GameEvent,
): { patch: { games: GamesState; points: number; timeline: TimelineEvent[] }; unlocked: GameAchievement[] } {
  const ids = evaluateGameAchievements(games, ev).filter((id) => !games.achievements[id]);
  const now = Date.now();
  const unlocked = ids
    .map((id) => GAME_ACHIEVEMENTS.find((a) => a.id === id))
    .filter((a): a is GameAchievement => !!a);
  const nextGames = ids.length
    ? { ...games, achievements: { ...games.achievements, ...Object.fromEntries(ids.map((id) => [id, now])) } }
    : games;
  return {
    patch: {
      games: nextGames,
      points: s.points + unlocked.length * 5,
      timeline: [
        ...unlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`)),
        ...s.timeline,
      ],
    },
    unlocked,
  };
}

export const useStore = create<RecoveryState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      disclaimerAccepted: false,
      profile: null,
      recoveryByAddiction: {},
      dailyJournalPlan: null,
      journalDrafts: {},
      checkIns: [],
      urges: [],
      relapses: [],
      journal: [],
      reflections: [],
      timeline: [],
      points: 0,
      longestStreak: 0,
      goals: [],
      celebratedBadges: [],
      games: initialGames,
      themePref: 'system',
      alternatives: {},
      altCounts: {},
      altAchievements: {},
      altSeconds: {},
      altSessions: {},
      walkSteps: 0,
      walkMeters: 0,
      waterToday: { day: '', glasses: 0 },
      waterGlassesTotal: 0,
      needOrWantCooldown: null,
      needOrWantEntries: [],
      activeNeedOrWantId: null,
      catchYourBreathEntries: [],
      lastCatchYourBreathAt: null,
      cheersToChangeEntries: [],
      lastCheersToChangeAt: null,
      backOnTrackEntries: [],
      lastBackOnTrackAt: null,
      ommSessions: [],
      ommAchievements: {},
      fuelFoodEntries: [],
      fuelWaterEntries: [],
      fuelFastingSessions: [],
      fuelGoals: { dailyCalories: 2000, dailyWaterMl: 2500, dailyProtein: 50, dailyCarbs: 250, dailyFat: 65, dailyFiber: 25, fastingGoal: null },
      fuelBodyInfoSet: false,
      fuelAchievements: {},
      blockedSites: [],
      favoriteQuotes: [],
      dailyMissions: { day: '', completed: [] },
      missionXp: 0,
      dailyQuote: null,
      recentQuotes: [],
      lastCheckedIn: null,
      urgesResisted: 0,
      urgesResistedWeek: 0,
      healthyHabitsCount: 0,
      eduBookmarks: [],
      eduProgress: {},
      eduLastGuideId: null,

      updateLastCheckedIn: () => set((s) =>
        s.profile?.addictionType === 'pornography'
          ? { lastCheckedIn: Date.now() }
          : {},
      ),

      toggleEduBookmark: (id) =>
        set((s) => ({
          eduBookmarks: s.eduBookmarks.includes(id)
            ? s.eduBookmarks.filter((b) => b !== id)
            : [id, ...s.eduBookmarks],
        })),

      setEduProgress: (guideId, pct, offset) =>
        set((s) => {
          const prev = s.eduProgress[guideId];
          // Progress only moves forward; the offset always tracks the latest
          // position so Continue Reading reopens where they actually were.
          const nextPct = Math.max(prev?.pct ?? 0, Math.min(1, Math.max(0, pct)));
          return {
            eduProgress: { ...s.eduProgress, [guideId]: { pct: nextPct, offset: Math.max(0, offset) } },
            eduLastGuideId: guideId,
          };
        }),

      logWater: (glasses) => {
        const n = Math.max(1, Math.min(24, Math.round(glasses)));
        let total = n;
        set((s) => {
          const day = localDayKey();
          const sofar = s.waterToday.day === day ? s.waterToday.glasses : 0;
          total = sofar + n;
          return {
            waterToday: { day, glasses: total },
            waterGlassesTotal: s.waterGlassesTotal + n,
          };
        });
        return total;
      },

      startNeedOrWantCooldown: () => {
        const now = Date.now();
        set((s) => ({
          needOrWantCooldown: now,
        }));
      },

      saveNeedOrWantEntry: (data) => {
        const id = uid();
        const entry: NeedOrWantEntry = {
          ...data,
          id,
          at: Date.now(),
          cooldownStart: Date.now(),
          decision: null,
        };
        set((s) => ({
          needOrWantEntries: [entry, ...s.needOrWantEntries],
          activeNeedOrWantId: id,
        }));
        return id;
      },

      decideNeedOrWantEntry: (id, decision) =>
        set((s) => ({
          needOrWantEntries: s.needOrWantEntries.map((e) =>
            e.id === id ? { ...e, decision, decidedAt: Date.now() } : e,
          ),
          activeNeedOrWantId: s.activeNeedOrWantId === id ? null : s.activeNeedOrWantId,
        })),

      deleteNeedOrWantEntry: (id) =>
        set((s) => ({
          needOrWantEntries: s.needOrWantEntries.filter((e) => e.id !== id),
        })),

      canCompleteCatchYourBreath: () => {
        const { lastCatchYourBreathAt } = get();
        const result = catchYourBreathAvailability(lastCatchYourBreathAt);
        return result.available
          ? { available: true }
          : { available: false, nextAt: result.nextAt, daysLeft: result.daysLeft };
      },

      addCatchYourBreath: (data) => {
        let unlocked: AltAchievement[] = [];
        const now = Date.now();

        // Enforce 7-day cooldown - silently no-op if called too early
        const { lastCatchYourBreathAt } = get();
        const avail = catchYourBreathAvailability(lastCatchYourBreathAt, now);
        if (!avail.available) return [];

        const entry: CatchYourBreathEntry = {
          ...data,
          id: uid(),
          at: now,
        };
        set((s) => {
          // Evaluate habit achievements for the new count
          const altCounts: AltCounts = { ...s.altCounts, 'catch-your-breath': (s.altCounts['catch-your-breath'] ?? 0) + 1 };
          const counts: AltCounts = { ...altCounts, journal: s.journal.length };
          unlocked = newAltUnlocks(
            counts,
            altFullDay(s.alternatives, s.journal, now, s.profile?.addictionType),
            s.altAchievements,
          );
          return {
            catchYourBreathEntries: [entry, ...s.catchYourBreathEntries],
            lastCatchYourBreathAt: now,
            alternatives: { ...s.alternatives, 'catch-your-breath': now },
            altCounts,
            altAchievements: unlocked.length
              ? { ...s.altAchievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) }
              : s.altAchievements,
            points: s.points + 5 + unlocked.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...unlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`)),
              evt('activity', 'Recovery activity - Catch Your Breath'),
              ...s.timeline,
            ],
          };
        });
        return unlocked;
      },

      deleteCatchYourBreathEntry: (id) =>
        set((s) => ({
          catchYourBreathEntries: s.catchYourBreathEntries.filter((e) => e.id !== id),
        })),

      canCompleteCheersToChange: () => {
        const { lastCheersToChangeAt } = get();
        const result = cheersToChangeAvailability(lastCheersToChangeAt);
        return result.available
          ? { available: true }
          : { available: false, nextAt: result.nextAt, daysLeft: result.daysLeft };
      },

      addCheersToChange: (data) => {
        let unlocked: AltAchievement[] = [];
        const now = Date.now();

        const { lastCheersToChangeAt } = get();
        const avail = cheersToChangeAvailability(lastCheersToChangeAt, now);
        if (!avail.available) return [];

        const entry: CheersToChangeEntry = {
          ...data,
          id: uid(),
          at: now,
        };
        set((s) => {
          const altCounts: AltCounts = { ...s.altCounts, 'cheers-to-change': (s.altCounts['cheers-to-change'] ?? 0) + 1 };
          const counts: AltCounts = { ...altCounts, journal: s.journal.length };
          unlocked = newAltUnlocks(
            counts,
            altFullDay(s.alternatives, s.journal, now, s.profile?.addictionType),
            s.altAchievements,
          );
          return {
            cheersToChangeEntries: [entry, ...s.cheersToChangeEntries],
            lastCheersToChangeAt: now,
            alternatives: { ...s.alternatives, 'cheers-to-change': now },
            altCounts,
            altAchievements: unlocked.length
              ? { ...s.altAchievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) }
              : s.altAchievements,
            points: s.points + 5 + unlocked.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...unlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`)),
              evt('activity', 'Recovery activity - Cheers to Change'),
              ...s.timeline,
            ],
          };
        });
        return unlocked;
      },

      deleteCheersToChangeEntry: (id) =>
        set((s) => ({
          cheersToChangeEntries: s.cheersToChangeEntries.filter((e) => e.id !== id),
        })),

      canCompleteBackOnTrack: () => {
        const { lastBackOnTrackAt } = get();
        const result = backOnTrackAvailability(lastBackOnTrackAt);
        return result.available
          ? { available: true }
          : { available: false, nextAt: result.nextAt, daysLeft: result.daysLeft };
      },

      addBackOnTrack: (data) => {
        let unlocked: AltAchievement[] = [];
        const now = Date.now();

        const { lastBackOnTrackAt } = get();
        const avail = backOnTrackAvailability(lastBackOnTrackAt, now);
        if (!avail.available) return [];

        const entry: BackOnTrackEntry = {
          ...data,
          id: uid(),
          at: now,
        };
        set((s) => {
          const altCounts: AltCounts = { ...s.altCounts, 'back-on-track': (s.altCounts['back-on-track'] ?? 0) + 1 };
          const counts: AltCounts = { ...altCounts, journal: s.journal.length };
          unlocked = newAltUnlocks(
            counts,
            altFullDay(s.alternatives, s.journal, now, s.profile?.addictionType),
            s.altAchievements,
          );
          return {
            backOnTrackEntries: [entry, ...s.backOnTrackEntries],
            lastBackOnTrackAt: now,
            alternatives: { ...s.alternatives, 'back-on-track': now },
            altCounts,
            altAchievements: unlocked.length
              ? { ...s.altAchievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) }
              : s.altAchievements,
            points: s.points + 5 + unlocked.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...unlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`)),
              evt('activity', 'Recovery activity - Back on Track'),
              ...s.timeline,
            ],
          };
        });
        return unlocked;
      },

      deleteBackOnTrackEntry: (id) =>
        set((s) => ({
          backOnTrackEntries: s.backOnTrackEntries.filter((e) => e.id !== id),
        })),

      completeOmmSession: (sessionData) => {
        const session: OneMoreMinuteSession = {
          ...sessionData,
          id: uid(),
        };
        set((s) => {
          const sessions = [session, ...s.ommSessions];
          const stats = computeOmmStats(sessions);
          const newIds = evaluateOmmAchievements(stats).filter((id) => !s.ommAchievements[id]);
          const now = Date.now();
          const newAchievements = newIds.length
            ? { ...s.ommAchievements, ...Object.fromEntries(newIds.map((id) => [id, now])) }
            : s.ommAchievements;
          const pointsEarned = 10 + newIds.length * 5;
          return {
            ommSessions: sessions,
            ommAchievements: newAchievements,
            points: s.points + pointsEarned,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...newIds.map((id) => {
                const a = require('@/domain/oneMoreMinute').ommAchievementById(id);
                return evt('achievement', `Achievement unlocked - ${a?.title ?? id}`);
              }),
              evt('activity', `One More Minute - ${Math.round(session.actualSeconds / 60)} min focused`),
              ...s.timeline,
            ],
          };
        });
      },

      addFuelFoodEntry: (data) => {
        const entry: FoodEntry = { ...data, id: uid(), at: Date.now() };
        set((s) => {
          const meals = s.fuelFoodEntries.length + 1;
          const waterDays = new Set(s.fuelWaterEntries.filter((w) => w.at >= Date.now() - 7 * 86_400_000).map((w) => dayKey(w.at))).size;
          const fasts = s.fuelFastingSessions.filter((f) => f.completed).length;
          const mStreak = mealStreak([...s.fuelFoodEntries, entry]);
          const wStreak = waterStreak(s.fuelWaterEntries, s.fuelGoals.dailyWaterMl);
          const fuelData = { meals, waterDays, fasts, mealStreak: mStreak, waterStreak: wStreak };
          const newIds = evaluateFuelAchievements(fuelData).filter((id) => !s.fuelAchievements[id]);
          const now = Date.now();
          return {
            fuelFoodEntries: [entry, ...s.fuelFoodEntries],
            fuelAchievements: newIds.length ? { ...s.fuelAchievements, ...Object.fromEntries(newIds.map((id) => [id, now])) } : s.fuelAchievements,
            points: s.points + 5 + newIds.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...newIds.map((id) => {
                const a = require('@/domain/fuelYourRecovery').fuelAchievementById(id);
                return evt('achievement', `Achievement unlocked - ${a?.title ?? id}`);
              }),
              evt('activity', `Fuel - logged ${entry.name}`),
              ...s.timeline,
            ],
          };
        });
      },

      deleteFuelFoodEntry: (id) =>
        set((s) => ({ fuelFoodEntries: s.fuelFoodEntries.filter((e) => e.id !== id) })),

      toggleFuelFavorite: (id) =>
        set((s) => ({
          fuelFoodEntries: s.fuelFoodEntries.map((e) => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e),
        })),

      addFuelWater: (amountMl) => {
        const entry: WaterEntry = { id: uid(), at: Date.now(), amountMl };
        set((s) => {
          const newWater = [...s.fuelWaterEntries, entry];
          const waterDays = new Set(newWater.filter((w) => w.at >= Date.now() - 7 * 86_400_000).map((w) => dayKey(w.at))).size;
          const meals = s.fuelFoodEntries.length;
          const fasts = s.fuelFastingSessions.filter((f) => f.completed).length;
          const wStreak = waterStreak(newWater, s.fuelGoals.dailyWaterMl);
          const mStreak = mealStreak(s.fuelFoodEntries);
          const fuelData = { meals, waterDays, fasts, mealStreak: mStreak, waterStreak: wStreak };
          const newIds = evaluateFuelAchievements(fuelData).filter((id) => !s.fuelAchievements[id]);
          const now = Date.now();
          return {
            fuelWaterEntries: newWater,
            fuelAchievements: newIds.length ? { ...s.fuelAchievements, ...Object.fromEntries(newIds.map((id) => [id, now])) } : s.fuelAchievements,
            points: s.points + newIds.length * 5,
            timeline: newIds.map((id) => {
              const a = require('@/domain/fuelYourRecovery').fuelAchievementById(id);
              return evt('achievement', `Achievement unlocked - ${a?.title ?? id}`);
            }).concat(s.timeline),
          };
        });
      },

      startFuelFast: (targetMinutes) => {
        const session: FastingSession = { id: uid(), startedAt: Date.now(), endedAt: null, targetMinutes, completed: false };
        set((s) => ({ fuelFastingSessions: [session, ...s.fuelFastingSessions] }));
      },

      endFuelFast: () => {
        set((s) => {
          const now = Date.now();
          const updated = s.fuelFastingSessions.map((f) => {
            if (f.endedAt != null) return f;
            const actualMinutes = Math.round((now - f.startedAt) / 60_000);
            const completed = actualMinutes >= f.targetMinutes * 0.9;
            return { ...f, endedAt: now, completed };
          });
          const completedFasts = updated.filter((f) => f.completed).length;
          const meals = s.fuelFoodEntries.length;
          const waterDays = new Set(s.fuelWaterEntries.filter((w) => w.at >= now - 7 * 86_400_000).map((w) => dayKey(w.at))).size;
          const mStreak = mealStreak(s.fuelFoodEntries);
          const wStreak = waterStreak(s.fuelWaterEntries, s.fuelGoals.dailyWaterMl);
          const fuelData = { meals, waterDays, fasts: completedFasts, mealStreak: mStreak, waterStreak: wStreak };
          const newIds = evaluateFuelAchievements(fuelData).filter((id) => !s.fuelAchievements[id]);
          return {
            fuelFastingSessions: updated,
            fuelAchievements: newIds.length ? { ...s.fuelAchievements, ...Object.fromEntries(newIds.map((id) => [id, now])) } : s.fuelAchievements,
            points: s.points + 5 + newIds.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...newIds.map((id) => {
                const a = require('@/domain/fuelYourRecovery').fuelAchievementById(id);
                return evt('achievement', `Achievement unlocked - ${a?.title ?? id}`);
              }),
              evt('activity', 'Fuel - completed fast'),
              ...s.timeline,
            ],
          };
        });
      },

      updateFuelGoals: (patch) =>
        set((s) => ({ fuelGoals: { ...s.fuelGoals, ...patch } })),

      setFuelBodyInfo: (patch) =>
        set((s) => ({ fuelGoals: { ...s.fuelGoals, ...patch }, fuelBodyInfoSet: true })),

      recordWalkMetrics: (steps, meters) =>
        set((s) => ({
          walkSteps: s.walkSteps + Math.max(0, Math.round(steps)),
          walkMeters: s.walkMeters + Math.max(0, Math.round(meters)),
        })),

      recordAltSession: (id, seconds) =>
        set((s) => ({
          altSeconds: {
            ...s.altSeconds,
            [id]: (s.altSeconds[id] ?? 0) + Math.max(0, Math.round(seconds)),
          },
          altSessions: { ...s.altSessions, [id]: (s.altSessions[id] ?? 0) + 1 },
        })),

      addBlockedSite: (domainInput, nickname) => {
        const domain = normalizeDomain(domainInput);
        if (!domain) return 'invalid';
        if (get().blockedSites.some((s) => domainsOverlap(domain, s.domain))) return 'duplicate';
        const site: BlockedSite = {
          id: uid(),
          domain,
          nickname: nickname?.trim() || undefined,
          addedAt: Date.now(),
        };
        set((s) => ({
          blockedSites: [site, ...s.blockedSites],
          timeline: [evt('shield', `Focus Protection - added ${domain} to the blocklist`), ...s.timeline],
        }));
        return 'added';
      },

      updateBlockedSite: (id, patch) => {
        let domain: string | undefined;
        if (patch.domain != null) {
          const normalized = normalizeDomain(patch.domain);
          if (!normalized) return 'invalid';
          const currentDomain = get().blockedSites.find((site) => site.id === id)?.domain;
          if (
            normalized !== currentDomain &&
            get().blockedSites.some((site) => site.id !== id && domainsOverlap(normalized, site.domain))
          ) {
            return 'duplicate';
          }
          domain = normalized;
        }
        set((s) => ({
          blockedSites: s.blockedSites.map((b) =>
            b.id === id
              ? {
                  ...b,
                  ...(domain != null ? { domain } : {}),
                  ...(patch.nickname != null ? { nickname: patch.nickname.trim() || undefined } : {}),
                }
              : b,
          ),
        }));
        return 'updated';
      },

      removeBlockedSite: (id) =>
        set((s) => ({ blockedSites: s.blockedSites.filter((b) => b.id !== id) })),

      completeMission: (id) => {
        let awarded = 0;
        set((s) => {
          const today = missionDayKey();
          // Normalise: if the stored day is stale, reset to a clean slate for
          // today. This is the only place daily reset happens so that the
          // selector can return `s.dailyMissions` as a stable reference.
          const missions: DailyMissionState =
            s.dailyMissions.day === today
              ? s.dailyMissions
              : { day: today, completed: [] };

          // Idempotent: don't double-award the same mission on the same day.
          if (missions.completed.includes(id)) {
            // Still normalise the day even when there's nothing to award.
            return missions === s.dailyMissions ? {} : { dailyMissions: missions };
          }

          const mission = missionById(id);
          awarded = mission.xp;
          const nextMissions: DailyMissionState = {
            day: today,
            completed: [...missions.completed, id],
          };
          return {
            dailyMissions: nextMissions,
            missionXp: s.missionXp + awarded,
            points: s.points + awarded,
            timeline: [
              evt('activity', `Daily Mission complete - ${mission.title}`),
              ...s.timeline,
            ],
          };
        });
        return awarded;
      },

      completeAlternative: (id) => {
        let unlocked: AltAchievement[] = [];
        set((s) => {
          const now = Date.now();
          const prev = s.alternatives[id];
          const already = prev != null && sameDay(prev, now);
          const alternatives = { ...s.alternatives, [id]: now };

          // Repeat sessions the same day refresh the timestamp only - no
          // double points, counts, timeline entries, or achievement checks.
          if (already) return { alternatives };

          const altCounts: AltCounts = { ...s.altCounts, [id]: (s.altCounts[id] ?? 0) + 1 };
          const counts: AltCounts = { ...altCounts, journal: s.journal.length };
          unlocked = newAltUnlocks(
            counts,
            altFullDay(alternatives, s.journal, now, s.profile?.addictionType),
            s.altAchievements,
          );

          return {
            alternatives,
            altCounts,
            altAchievements: unlocked.length
              ? { ...s.altAchievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) }
              : s.altAchievements,
            points: s.points + 5 + unlocked.length * 5,
            healthyHabitsCount: s.healthyHabitsCount + 1,
            timeline: [
              ...unlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`)),
              evt('activity', `Recovery activity - ${alternativeById(id).title}`),
              ...s.timeline,
            ],
          };
        });
        return unlocked;
      },

      toggleFavoriteQuote: (q) => {
        set((s) => {
          const existing = s.favoriteQuotes.find((f) => f.text === q.text);
          return {
            favoriteQuotes: existing
              ? s.favoriteQuotes.filter((f) => f.text !== q.text)
              : [{ text: q.text, author: q.author, savedAt: Date.now() }, ...s.favoriteQuotes],
          };
        });
      },

      removeFavoriteQuote: (savedAt) =>
        set((s) => ({ favoriteQuotes: s.favoriteQuotes.filter((f) => f.savedAt !== savedAt) })),

      ensureDailyQuote: () => {
        const s = get();
        const day = localDayKey();
        // Re-pick when the stored index no longer fits the pool (an app
        // update can shrink QUOTES; a stale index must never crash a lookup).
        if (s.dailyQuote?.day === day && s.dailyQuote.index < QUOTES.length) {
          return s.dailyQuote.index;
        }
        const index = pickDailyQuoteIndex(s.recentQuotes, QUOTES.length);
        set({
          dailyQuote: { day, index },
          recentQuotes: [...s.recentQuotes, index].slice(-QUOTE_HISTORY_SIZE),
        });
        return index;
      },

      recordCheckers: (result, ctx) => {
        let unlocked: GameAchievement[] = [];
        set((s) => {
          const games: GamesState = {
            ...s.games,
            checkersWins: s.games.checkersWins + (result === 'win' ? 1 : 0),
            checkersLosses: s.games.checkersLosses + (result === 'loss' ? 1 : 0),
          };
          const r = withGameEvent(s, games, { game: 'checkers', result, ...ctx });
          unlocked = r.unlocked;
          return r.patch;
        });
        return unlocked;
      },

      recordSudoku: (level, ms, ctx) => {
        let unlocked: GameAchievement[] = [];
        set((s) => {
          const prev = s.games.sudokuBestMs[level];
          const games: GamesState = {
            ...s.games,
            sudokuSolved: s.games.sudokuSolved + 1,
            sudokuBestMs: { ...s.games.sudokuBestMs, [level]: prev == null ? ms : Math.min(prev, ms) },
          };
          const r = withGameEvent(s, games, { game: 'sudoku', level, ms, ...ctx });
          unlocked = r.unlocked;
          return r.patch;
        });
        return unlocked;
      },

      recordInhibition: (game, summary) => {
        let unlocked: GameAchievement[] = [];
        let pointsEarned = 0;
        let newBest = false;
        let challengeCompleted = false;
        set((s) => {
          const prevBest = s.games.gonogoBest;
          newBest = summary.score > prevBest;
          const games: GamesState = {
            ...s.games,
            gonogoBest: Math.max(s.games.gonogoBest, summary.score),
            gonogoGames: s.games.gonogoGames + 1,
          };

          const ev: GameEvent = { game: 'gonogo', ...summary };
          const r = withGameEvent(s, games, ev);
          unlocked = r.unlocked;

          // Recovery Points: a modest score-scaled award on top of the
          // achievement points withGameEvent already granted.
          pointsEarned = Math.max(2, Math.min(15, Math.round(summary.score / 150)));

          // Daily challenge - beat today's target once per day for a bonus.
          const day = challengeDayNumber();
          const target = dailyChallengeTarget(prevBest, day);
          const doneDay = s.games.challengeDoneDay[game] ?? -1;
          if (doneDay !== day && summary.score >= target) {
            challengeCompleted = true;
            pointsEarned += 10;
            r.patch.games = {
              ...r.patch.games,
              challengeDoneDay: { ...r.patch.games.challengeDoneDay, [game]: day },
            };
            r.patch.timeline = [
              evt('achievement', 'Daily challenge complete - Go / No-Go'),
              ...r.patch.timeline,
            ];
          }

          return { ...r.patch, points: r.patch.points + pointsEarned };
        });
        return { unlocked, pointsEarned, newBest, challengeCompleted };
      },

      recordBlocks: (score, ctx) => {
        let unlocked: GameAchievement[] = [];
        set((s) => {
          const games: GamesState = {
            ...s.games,
            blocksBest: Math.max(s.games.blocksBest, score),
            blocksGames: s.games.blocksGames + 1,
          };
          const r = withGameEvent(s, games, { game: 'blocks', score, ...ctx });
          unlocked = r.unlocked;
          return r.patch;
        });
        return unlocked;
      },

      setTutorialHidden: (game, hidden) =>
        set((s) => ({
          games: {
            ...s.games,
            tutorialsHidden: { ...s.games.tutorialsHidden, [game]: hidden },
          },
        })),

      saveClarityProgress: (day, guesses) =>
        set((s) => ({
          games: { ...s.games, clarityDay: day, clarityGuesses: guesses, clarityStatus: 'playing' },
        })),

      recordClarityResult: (day, guesses, won) => {
        let unlocked: GameAchievement[] = [];
        set((s) => {
          const g = s.games;
          // Guard: only tally a given day once.
          const alreadyDone = g.clarityDay === day && g.clarityStatus !== 'playing';
          if (alreadyDone) {
            return { games: { ...g, clarityGuesses: guesses } };
          }
          const streak = won ? g.clarityStreak + 1 : 0;
          const games: GamesState = {
            ...g,
            clarityDay: day,
            clarityGuesses: guesses,
            clarityStatus: won ? 'won' : 'lost',
            clarityPlayed: g.clarityPlayed + 1,
            clarityWon: g.clarityWon + (won ? 1 : 0),
            clarityStreak: streak,
            clarityBestStreak: Math.max(g.clarityBestStreak, streak),
          };
          const r = withGameEvent(s, games, {
            game: 'clarity', won, guessCount: guesses.length, daily: true,
          });
          unlocked = r.unlocked;
          return r.patch;
        });
        return unlocked;
      },

      recordClarityPractice: (won, guessCount) => {
        let unlocked: GameAchievement[] = [];
        set((s) => {
          const games: GamesState = {
            ...s.games,
            clarityPracticePlayed: s.games.clarityPracticePlayed + 1,
            clarityPracticeWon: s.games.clarityPracticeWon + (won ? 1 : 0),
          };
          const r = withGameEvent(s, games, { game: 'clarity', won, guessCount, daily: false });
          unlocked = r.unlocked;
          return r.patch;
        });
        return unlocked;
      },

      setTodayMood: (mood) =>
        set((s) => {
          const today = s.checkIns.find((c) => sameDay(c.at, Date.now()));
          if (!today) return s;
          return {
            checkIns: s.checkIns.map((c) => (c.id === today.id ? { ...c, mood } : c)),
          };
        }),

      completeSetup: (profile) => {
        const selections = selectedAddictions(profile);
        profile = { ...profile, selectedAddictions: selections };
        const recoveryByAddiction: Partial<Record<AddictionType, AddictionRecoverySnapshot>> = {};
        for (const addictionType of selections) {
          const trackProfile = addictionType === profile.addictionType
            ? profile
            : createSecondaryProfile(profile, addictionType, selections);
          recoveryByAddiction[addictionType] = createAddictionSnapshot(trackProfile);
        }
        // If the user last used on a past day, seed:
        //   1. A RelapseEvent on that day (for streak math).
        //   2. An addiction-specific JournalEntry on that day → calendar shows red.
        //      - gambling/smoking/alcohol/drugs/etc. → gambled: true
        //      - pornography                         → watched: true
        //   3. Addiction-specific clean entries for every day BETWEEN the relapse
        //      and today (exclusive) → calendar shows those days green.
        //   Today itself is left blank - the user fills it in via the journal.
        const now = new Date();
        const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const isToday = profile.startedAt >= todayMid;

        // Seed timestamp: 1ms after local midnight of the last-used day.
        const seedAt = profile.startedAt + 1;

        const isPorn = profile.addictionType === 'pornography';
        const isAlcohol = profile.addictionType === 'alcohol';
        const isDrugs = profile.addictionType === 'drugs';
        const isSmoke = profile.addictionType === 'smoking';
        const isSocial = profile.addictionType === 'social_media';
        const isGaming = profile.addictionType === 'gaming';
        const isShopping = profile.addictionType === 'online_shopping';
        const isOther = profile.addictionType === 'other';

        const initialRelapses: RelapseEvent[] = isToday
          ? []
          : [{ id: uid(), at: seedAt, whatHappened: 'Last use before recovery' }];

        const initialJournal: import('@/domain/records').JournalEntry[] = [];

        if (!isToday) {
          // Red dot on the last-used day - use the correct field for the addiction type.
          initialJournal.push(
            isPorn
              ? { id: uid(), at: seedAt, watched: true,  text: 'Last use before recovery.' }
              : isAlcohol
              ? { id: uid(), at: seedAt, drank: true,    text: 'Last use before recovery.' }
              : isDrugs
              ? { id: uid(), at: seedAt, used: true,     text: 'Last use before recovery.' }
              : isSmoke
              ? { id: uid(), at: seedAt, smoked: true,   text: 'Last use before recovery.' }
              : isSocial
              ? { id: uid(), at: seedAt, binged: true,   text: 'Last use before recovery.' }
              : isGaming
              ? { id: uid(), at: seedAt, played: true,   text: 'Last use before recovery.' }
              : isShopping
              ? { id: uid(), at: seedAt, shopped: true,  text: 'Last use before recovery.' }
              : isOther
              ? { id: uid(), at: seedAt, otherActed: true, text: 'Last use before recovery.' }
              : { id: uid(), at: seedAt, gambled: true,  text: 'Last use before recovery.' },
          );

          // Green dots for every full calendar day after the relapse up to
          // (but not including) today. Each entry is stamped at noon local
          // time of that day so it looks natural in the journal list.
          const MS_PER_DAY = 86_400_000;
          let dayMid = profile.startedAt + MS_PER_DAY; // midnight of day after relapse
          while (dayMid < todayMid) {
            initialJournal.push(
              isPorn
                ? { id: uid(), at: dayMid + 12 * 3_600_000, watched: false, text: 'Clean day.' }
                : isAlcohol
                ? { id: uid(), at: dayMid + 12 * 3_600_000, drank: false,   text: 'Clean day.' }
                : isDrugs
                ? { id: uid(), at: dayMid + 12 * 3_600_000, used: false,    text: 'Clean day.' }
                : isSmoke
                ? { id: uid(), at: dayMid + 12 * 3_600_000, smoked: false,  text: 'Clean day.' }
                : isSocial
                ? { id: uid(), at: dayMid + 12 * 3_600_000, binged: false,  text: 'Clean day.' }
                : isGaming
                ? { id: uid(), at: dayMid + 12 * 3_600_000, played: false,  text: 'Clean day.' }
                : isShopping
                ? { id: uid(), at: dayMid + 12 * 3_600_000, shopped: false, text: 'Clean day.' }
                : isOther
                ? { id: uid(), at: dayMid + 12 * 3_600_000, otherActed: false, text: 'Clean day.' }
                : { id: uid(), at: dayMid + 12 * 3_600_000, gambled: false, text: 'Clean day.' },
            );
            dayMid += MS_PER_DAY;
          }
        }

        set({
          onboarded: true,
          profile,
          recoveryByAddiction,
          dailyJournalPlan: null,
          journalDrafts: {},
          relapses: initialRelapses,
          journal: initialJournal,
          timeline: [evt('start', 'Recovery started')],
        });
      },

      setActiveAddiction: (addiction) =>
        set((s) => {
          if (!s.profile || s.profile.addictionType === addiction) return s;
          const selections = selectedAddictions(s.profile);
          const requiredToday = s.dailyJournalPlan?.day === missionDayKey()
            ? s.dailyJournalPlan.required
            : [];
          if (!selections.includes(addiction) && !requiredToday.includes(addiction)) return s;
          const current = captureAddictionSnapshot(s);
          const target = s.recoveryByAddiction[addiction] ?? createAddictionSnapshot({
            ...s.profile,
            addictionType: addiction,
            addictionDetail: undefined,
            selectedAddictions: selections,
          });
          const today = missionDayKey();
          return {
            ...target,
            profile: {
              ...target.profile,
              name: s.profile.name,
              age: s.profile.age,
              selectedAddictions: selections,
            },
            dailyMissions: target.dailyMissions.day === today
              ? target.dailyMissions
              : { day: today, completed: [] },
            recoveryByAddiction: current
              ? { ...s.recoveryByAddiction, [current.profile.addictionType]: current }
              : s.recoveryByAddiction,
          };
        }),

      ensureDailyJournalPlan: () => {
        const s = get();
        if (!s.profile) return [];
        const day = missionDayKey();
        if (s.dailyJournalPlan?.day === day && s.dailyJournalPlan.required.length > 0) {
          return s.dailyJournalPlan.required;
        }
        const required = selectedAddictions(s.profile);
        set({ dailyJournalPlan: { day, required, startedAt: Date.now() }, journalDrafts: {} });
        return required;
      },

      saveJournalDraft: (addiction, values) =>
        set((s) => ({
          journalDrafts: {
            ...s.journalDrafts,
            [addiction]: { day: missionDayKey(), values },
          },
        })),

      clearJournalDraft: (addiction) =>
        set((s) => {
          const drafts = { ...s.journalDrafts };
          delete drafts[addiction];
          return { journalDrafts: drafts };
        }),

      acceptDisclaimer: () => set({ disclaimerAccepted: true }),

      addGoal: (kind, target) =>
        set((s) => ({
          goals: [...s.goals, { id: uid(), kind, target, createdAt: Date.now() }],
        })),

      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      syncAchievements: () => {
        const s = get();
        if (!s.profile) return [];
        const stats = computeStats({ ...s, profile: s.profile });

        // Newly earned badges.
        const earned = earnedBadgeIds(stats);
        const newlyIds = earned.filter((id) => !s.celebratedBadges.includes(id));

        // Newly achieved goals.
        const goals = s.goals.map((g) =>
          g.achievedAt ? g : goalProgress(g, stats).done ? { ...g, achievedAt: Date.now() } : g,
        );
        const newlyGoals = goals.filter((g, i) => g.achievedAt && !s.goals[i].achievedAt);

        if (newlyIds.length === 0 && newlyGoals.length === 0) return [];

        const title = (id: string) => BADGES.find((b) => b.id === id)?.title ?? id;
        const currency = s.profile.currency;
        set({
          celebratedBadges: [...s.celebratedBadges, ...newlyIds],
          goals,
          timeline: [
            ...newlyIds.map((id) => evt('achievement', `Badge earned - ${title(id)}`)),
            ...newlyGoals.map((g) => evt('milestone', `Goal reached - ${goalTitle(g, currency)}`)),
            ...s.timeline,
          ],
        });
        return newlyIds
          .map((id) => BADGES.find((b) => b.id === id))
          .filter((b): b is Badge => !!b);
      },

      updateProfile: (patch) =>
        set((s) => {
          if (!s.profile) return s;
          const profile = { ...s.profile, ...patch };
          const previousSelections = selectedAddictions(s.profile);
          const nextSelections = selectedAddictions(profile);
          const added = nextSelections.filter((addiction) => !previousSelections.includes(addiction));
          if (added.length === 0) return { profile };

          const recoveryByAddiction = { ...s.recoveryByAddiction };
          for (const addiction of added) {
            // Re-selecting a previously removed track restores its history;
            // only a genuinely new track receives a fresh snapshot.
            if (!recoveryByAddiction[addiction]) {
              recoveryByAddiction[addiction] = createAddictionSnapshot(
                createSecondaryProfile(profile, addiction, nextSelections),
              );
            }
          }
          return { profile, recoveryByAddiction };
        }),

      submitCheckIn: (data) => {
        set((s) => {
          // One check-in per day: a second submit the same day edits the
          // existing entry instead of duplicating it (no double points).
          const existing = s.checkIns.find((c) => sameDay(c.at, Date.now()));
          if (existing) {
            return {
              checkIns: s.checkIns.map((c) => (c.id === existing.id ? { ...c, ...data } : c)),
            };
          }
          const entry: DailyCheckIn = { ...data, id: uid(), at: Date.now() };
          return {
            checkIns: [entry, ...s.checkIns],
            points: s.points + 10,
            timeline: [
              evt('checkin', 'Completed daily check-in'),
              ...(data.gambled ? [] : [evt('clean', 'Stayed clean today')]),
              ...s.timeline,
            ],
          };
        });
      },

      logUrge: (data) => {
        const now = Date.now();
        const entry: UrgeLog = { ...data, id: uid(), at: now };
        set((s) => ({
          urges: [entry, ...s.urges],
          points: s.points + 5,
          ...(data.resisted ? resistedCounterPatch(s, now) : {}),
          timeline: [evt('urge', `Logged urge - intensity ${data.intensity}/10`), ...s.timeline],
        }));
        return entry.id;
      },

      updateUrge: (id, data) => set((s) => ({
        urges: s.urges.map((urge) => urge.id === id ? { ...urge, ...data } : urge),
      })),

      deleteUrge: (id) => set((s) => ({
        urges: s.urges.filter((urge) => urge.id !== id),
      })),

      logRelapse: (data) => {
        set((s) => {
          if (!s.profile) return s;
          // Compute current streak from events so longestStreak is accurate.
          const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
          const prevDays = streakDays(streakStart);
          const relapse: RelapseEvent = { ...data, id: uid(), at: Date.now() };
          // Do NOT mutate profile.startedAt - the relapses array is the
          // canonical history.  streakDays is now derived from events.
          return {
            relapses: [relapse, ...s.relapses],
            longestStreak: Math.max(s.longestStreak, prevDays),
            timeline: [evt('relapse', 'Logged a relapse - recovery continues'), ...s.timeline],
          };
        });
      },

      addJournal: (data) => {
        set((s) => {
          if (!s.profile) return s;

          // ── One journal entry per calendar day per addiction type ──────
          // Gambling entries are keyed by the `gambled` field; porn entries by
          // the `watched` field.  This lets the gates stay completely separate
          // so neither addiction type ever blocks the other.
          const isGamblingEntry = data.gambled !== undefined;
          const isPornEntry = data.watched !== undefined;
          const isSocialEntry = data.binged !== undefined;
          const isSmokeEntry = data.smoked !== undefined;
          const isAlcoholEntry = data.drank !== undefined;
          const isDrugEntry = data.used !== undefined;
          const isGamingEntry = data.played !== undefined;
          const isShopEntry = data.shopped !== undefined;
          const isOtherEntry = data.otherActed !== undefined;
          const alreadyToday = s.journal.some((j) => {
            if (!sameDay(j.at, Date.now())) return false;
            if (isGamblingEntry) return j.gambled !== undefined;
            if (isPornEntry) return j.watched !== undefined;
            if (isSocialEntry) return j.binged !== undefined;
            if (isSmokeEntry) return j.smoked !== undefined;
            if (isAlcoholEntry) return j.drank !== undefined;
            if (isDrugEntry) return j.used !== undefined;
            if (isGamingEntry) return j.played !== undefined;
            if (isShopEntry) return j.shopped !== undefined;
            if (isOtherEntry) return j.otherActed !== undefined;
            return true; // generic entry - block any duplicate
          });
          if (alreadyToday) return s;

          const entry: JournalEntry = { ...data, id: uid(), at: Date.now() };

          // Journaling is also a Healthy Alternative - a new entry can unlock
          // habit achievements (journal count, or completing the full day).
          const journalAfter = [entry, ...s.journal];
          const altUnlocked = newAltUnlocks(
            { ...s.altCounts, journal: journalAfter.length },
            altFullDay(s.alternatives, journalAfter, Date.now(), s.profile?.addictionType),
            s.altAchievements,
          );
          const altPatch = altUnlocked.length
            ? {
                altAchievements: {
                  ...s.altAchievements,
                  ...Object.fromEntries(altUnlocked.map((a) => [a.id, Date.now()])),
                },
              }
            : {};
          const altEvents = altUnlocked.map((a) => evt('achievement', `Achievement unlocked - ${a.title}`));

          if (data.gambled) {
            // Record the relapse event but do NOT touch profile.startedAt.
            // The streak and calendar are derived purely from the events array.
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              amount: data.amountLost,
              whatHappened: data.whyGambled,
              cause: data.whyGambled,
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - gambling relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          // ── Porn recovery: watched=true → relapse; watched=false → clean ──
          if (data.watched === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.relapseLeadUp,
              cause: data.relapseTrigger,
              feeling: data.emotionsBefore,
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - porn relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.watched === false) {
            const now = Date.now();
            const cleanTriggers = data.triggersEncountered ?? (data.trigger ? [data.trigger] : undefined);
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.urgeIntensity ?? 1,
              trigger: cleanTriggers?.[0] ?? 'Daily journal',
              triggers: cleanTriggers,
              notes: data.whatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          if (data.gambled === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: 1,
              trigger: 'Daily journal',
              triggers: ['Daily journal'],
              notes: data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', 'Logged a clean-day urge check from journal'),
                ...s.timeline,
              ],
            };
          }

          if (data.otherActed === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(), at: Date.now(), whatHappened: data.text, cause: data.text,
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - custom habit relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.otherActed === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(), at: now, intensity: 1, trigger: 'Daily journal',
              triggers: ['Daily journal'], notes: data.text, resisted: true, mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a custom habit journal entry - clean day'),
                evt('urge', 'Logged a clean-day urge check from journal'),
                ...s.timeline,
              ],
            };
          }

          // ── Social media: binged=true → relapse; binged=false → clean ─────
          if (data.binged === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.bingeTrigger,
              cause: data.bingeTrigger,
              feeling: data.bingeEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - social media binge logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.binged === false) {
            const now = Date.now();
            const cleanTriggers = data.socialTriggersEncountered;
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.socialUrgeIntensity ?? 1,
              trigger: cleanTriggers?.[0] ?? 'Daily journal',
              triggers: cleanTriggers?.length ? cleanTriggers : ['Daily journal'],
              notes: data.socialWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          // ── Smoking: smoked=true → relapse; smoked=false → clean ──────────
          if (data.smoked === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.smokeTrigger,
              cause: data.smokeTrigger,
              feeling: data.smokeEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - smoking relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.smoked === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.smokeUrgeIntensity ?? 1,
              trigger: data.smokeTrigger ?? 'Daily journal',
              triggers: data.smokeTrigger ? [data.smokeTrigger] : ['Daily journal'],
              notes: data.smokeWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          // ── Alcohol: drank=true → relapse; drank=false → clean ──────────
          if (data.drank === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.drankTrigger,
              cause: data.drankTrigger,
              feeling: data.drankEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - alcohol relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.drank === false) {
            const now = Date.now();
            const cleanTriggers = data.triggersEncountered;
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.alcoholUrgeIntensity ?? 1,
              trigger: cleanTriggers?.[0] ?? 'Daily journal',
              triggers: cleanTriggers?.length ? cleanTriggers : ['Daily journal'],
              notes: data.alcoholWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          // ── Drugs / substances: used=true → relapse; used=false → clean ────
          if (data.used === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.drugTrigger,
              cause: data.drugTrigger,
              feeling: data.drugEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - substance use relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.used === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.drugUrgeIntensity ?? 1,
              trigger: data.drugWhatHelped ?? 'Daily journal',
              triggers: data.drugWhatHelped ? [data.drugWhatHelped] : ['Daily journal'],
              notes: data.drugWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          // ── Gaming: played=true → relapse; played=false → clean ──────────
          if (data.played === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              whatHappened: data.gamingTrigger,
              cause: data.gamingTrigger,
              feeling: data.gamingEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - gaming relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.played === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.gamingUrgeIntensity ?? 1,
              trigger: data.gamingWhatHelped ?? 'Daily journal',
              triggers: data.gamingWhatHelped ? [data.gamingWhatHelped] : ['Daily journal'],
              notes: data.gamingWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          // ── Online Shopping: shopped=true → relapse; shopped=false → clean ──
          if (data.shopped === true) {
            const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
            const prevDays = streakDays(streakStart);
            const relapseEntry: RelapseEvent = {
              id: uid(),
              at: Date.now(),
              amount: data.shopAmountSpent,
              whatHappened: data.shopTrigger,
              cause: data.shopTrigger,
              feeling: data.shopEmotions?.join(', '),
            };
            return {
              journal: journalAfter,
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5 + altUnlocked.length * 5,
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Journal entry - online shopping relapse logged'),
                evt('relapse', 'Logged a relapse via journal - recovery continues'),
                ...s.timeline,
              ],
            };
          }

          if (data.shopped === false) {
            const now = Date.now();
            const urgeEntry: UrgeLog = {
              id: uid(),
              at: now,
              intensity: data.shopUrgeIntensity ?? 1,
              trigger: data.shopWhatHelped ?? 'Daily journal',
              triggers: data.shopWhatHelped ? [data.shopWhatHelped] : ['Daily journal'],
              notes: data.shopWhatHelped ?? data.text,
              resisted: true,
              mood: data.mood,
            };
            return {
              journal: journalAfter,
              urges: [urgeEntry, ...s.urges],
              points: s.points + 5 + altUnlocked.length * 5,
              ...resistedCounterPatch(s, now),
              ...altPatch,
              timeline: [
                ...altEvents,
                evt('journal', 'Wrote a journal entry - clean day'),
                evt('urge', `Resisted urge via journal - intensity ${urgeEntry.intensity}/10`),
                ...s.timeline,
              ],
            };
          }

          return {
            journal: journalAfter,
            points: s.points + 5 + altUnlocked.length * 5,
            ...altPatch,
            timeline: [...altEvents, evt('journal', 'Wrote a journal entry'), ...s.timeline],
          };
        });
      },

      addJournalForAddiction: (addiction, data) => {
        const originalProfile = get().profile;
        const original = originalProfile?.addictionType;
        if (!original || !originalProfile) return;
        const originalSelections = selectedAddictions(originalProfile);

        if (original !== addiction) get().setActiveAddiction(addiction);
        if (get().profile?.addictionType !== addiction) return;
        get().addJournal(data);
        get().clearJournalDraft(addiction);
        if (original !== addiction) get().setActiveAddiction(original);
        set((s) => s.profile
          ? { profile: { ...s.profile, selectedAddictions: originalSelections } }
          : s);

        const after = get();
        if (dailyJournalIsComplete(after) && after.dailyJournalPlan && !after.dailyJournalPlan.completedAt) {
          set({ dailyJournalPlan: { ...after.dailyJournalPlan, completedAt: Date.now() } });
        }
      },

      addReflection: (text) => {
        const entry: Reflection = { id: uid(), at: Date.now(), text: text.trim() };
        set((s) => ({ reflections: [entry, ...s.reflections] }));
      },

      deleteReflection: (rid) =>
        set((s) => ({ reflections: s.reflections.filter((r) => r.id !== rid) })),

      addPoints: (n) => set((s) => ({ points: s.points + n })),

      pushTimeline: (type, label) =>
        set((s) => ({ timeline: [evt(type, label), ...s.timeline] })),

      setTheme: (t) => set({ themePref: t }),

      resetRecovery: () =>
        set((s) => ({
          checkIns: [],
          urges: [],
          relapses: [],
          journal: [],
          reflections: [],
          timeline: [evt('start', 'Recovery restarted')],
          points: 0,
          longestStreak: 0,
          goals: [],
          celebratedBadges: [],
          alternatives: {},
          dailyJournalPlan: null,
          journalDrafts: {},
          needOrWantCooldown: null,
          needOrWantEntries: [],
          activeNeedOrWantId: null,
          // Weekly porn-recovery counters are recovery data - restart them
          // with the streak. Lifetime habit totals are kept, like altCounts.
          urgesResisted: 0,
          urgesResistedWeek: 0,
          // Restart the streak from right now, keeping all profile details.
          profile: s.profile ? { ...s.profile, startedAt: Date.now() } : null,
        })),

      resetAll: () => {
        // Remove the AsyncStorage key so wiped state persists across restarts.
        // Without this, Zustand would rehydrate the old data on next launch.
        persistentStorage.removeItem(PERSIST_KEY).catch(() => {});
        set({
          onboarded: false,
          profile: null,
          recoveryByAddiction: {},
          dailyJournalPlan: null,
          journalDrafts: {},
          checkIns: [],
          urges: [],
          relapses: [],
          journal: [],
          reflections: [],
          timeline: [],
          points: 0,
          longestStreak: 0,
          goals: [],
          celebratedBadges: [],
          games: initialGames,
          themePref: 'system',
          alternatives: {},
          altCounts: {},
          altAchievements: {},
          altSeconds: {},
          altSessions: {},
          walkSteps: 0,
          walkMeters: 0,
          waterToday: { day: '', glasses: 0 },
          waterGlassesTotal: 0,
          needOrWantCooldown: null,
          needOrWantEntries: [],
          activeNeedOrWantId: null,
          lastCheckedIn: null,
          urgesResisted: 0,
          urgesResistedWeek: 0,
          healthyHabitsCount: 0,
          eduBookmarks: [],
          eduProgress: {},
          eduLastGuideId: null,
          blockedSites: [],
          favoriteQuotes: [],
          dailyQuote: null,
          recentQuotes: [],
          dailyMissions: { day: '', completed: [] },
          missionXp: 0,
          // Fuel Your Recovery
          fuelFoodEntries: [],
          fuelWaterEntries: [],
          fuelFastingSessions: [],
          fuelGoals: { dailyCalories: 2000, dailyWaterMl: 2500, dailyProtein: 50, dailyCarbs: 250, dailyFat: 65, dailyFiber: 25, fastingGoal: null },
          fuelBodyInfoSet: false,
          fuelAchievements: {},
          // Catch Your Breath
          catchYourBreathEntries: [],
          lastCatchYourBreathAt: null,
          // Cheers to Change
          cheersToChangeEntries: [],
          lastCheersToChangeAt: null,
          // One More Minute
          ommSessions: [],
          ommAchievements: {},
        });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => persistentStorage),
      // Deep-merge the games slice so users upgrading from an older build get
      // defaults for fields that didn't exist when their state was saved.
      // Also normalise dailyMissions to today so the selector never has to
      // construct a new object - eliminating the getSnapshot infinite-loop.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RecoveryState>;
        const today = missionDayKey();
        const storedMissions = p.dailyMissions;
        const dailyMissions: DailyMissionState =
          storedMissions?.day === today
            ? storedMissions
            : { day: today, completed: [] };
        const profile = p.profile
          ? { ...p.profile, selectedAddictions: selectedAddictions(p.profile) }
          : null;
        const dailyJournalPlan = p.dailyJournalPlan?.day === today
          ? p.dailyJournalPlan
          : null;
        const journalDrafts = Object.fromEntries(
          Object.entries(p.journalDrafts ?? {}).filter(([, draft]) => draft?.day === today),
        ) as RecoveryState['journalDrafts'];
        return {
          ...current,
          ...p,
          profile,
          recoveryByAddiction: p.recoveryByAddiction ?? {},
          dailyJournalPlan,
          journalDrafts,
          games: { ...initialGames, ...(p.games ?? {}) },
          dailyMissions,
          missionXp: p.missionXp ?? 0,
        };
      },
    },
  ),
);

// --- selectors --------------------------------------------------------------

export function useProfile(): RecoveryProfile | null {
  return useStore((s) => s.profile);
}

export function useProfileForAddiction(addiction: AddictionType): RecoveryProfile | null {
  return useStore((s) =>
    s.profile?.addictionType === addiction
      ? s.profile
      : s.recoveryByAddiction[addiction]?.profile ?? null,
  );
}

export function useTodayJournalForAddiction(addiction: AddictionType): JournalEntry | undefined {
  return useStore((s) =>
    journalForAddictionState(s, addiction).find((entry) =>
      sameDay(entry.at, Date.now()) && journalCompletedToday([entry], addiction),
    ),
  );
}

export function isDailyJournalCompleteNow(): boolean {
  return dailyJournalIsComplete(useStore.getState());
}

export function useDailyJournalProgress(): {
  required: AddictionType[];
  completed: AddictionType[];
  complete: boolean;
} {
  const profile = useStore((s) => s.profile);
  const plan = useStore((s) => s.dailyJournalPlan);
  const activeJournal = useStore((s) => s.journal);
  const recoveryByAddiction = useStore((s) => s.recoveryByAddiction);
  if (!profile) return { required: [], completed: [], complete: false };
  const required = plan?.day === missionDayKey()
    ? plan.required
    : selectedAddictions(profile);
  const completed = required.filter((addiction) => {
    const journal = profile.addictionType === addiction
      ? activeJournal
      : recoveryByAddiction[addiction]?.journal ?? [];
    return journalCompletedToday(journal, addiction);
  });
  return { required, completed, complete: required.length > 0 && completed.length === required.length };
}

/** Today's check-in, or undefined if none logged yet. */
export function useTodayCheckIn(): DailyCheckIn | undefined {
  return useStore((s) => s.checkIns.find((c) => sameDay(c.at, Date.now())));
}

/**
 * Today's journal entry for gambling users, or undefined if none submitted yet.
 * Finds any entry today where `gambled` is defined (gambling-specific gate).
 * For gambling users only - do NOT use this in porn-journal-entry.tsx.
 */
export function useTodayJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.gambled !== undefined),
  );
}

/**
 * Today's journal entry for pornography users, or undefined if none submitted yet.
 * Finds any entry today where `watched` is defined (porn-specific gate).
 * Completely separate from useTodayJournal so a user who has both types of
 * entries (edge case) never has their porn gate blocked by a gambling entry.
 */
export function useTodayPornJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.watched !== undefined),
  );
}

/**
 * Today's journal entry of ANY addiction type. For type-agnostic surfaces
 * (Healthy Alternatives "journal done today", Protection's activity counter)
 * that only care whether the user journaled at all - never for wizard gates.
 */
export function useTodayAnyJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) => s.journal.find((j) => sameDay(j.at, Date.now())));
}

/**
 * Today's journal entry for social-media users, or undefined if none submitted yet.
 * Finds any entry today where `binged` is defined (social-media-specific gate).
 * Completely separate from useTodayJournal and useTodayPornJournal.
 */
export function useTodaySocialJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.binged !== undefined),
  );
}

/**
 * Today's journal entry for smoking users, or undefined if none submitted yet.
 * Finds any entry today where `smoked` is defined (smoking-specific gate).
 */
export function useTodaySmokeJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.smoked !== undefined),
  );
}

/**
 * Today's journal entry for alcohol users, or undefined if none submitted yet.
 * Finds any entry today where `drank` is defined (alcohol-specific gate).
 */
export function useTodayAlcoholJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.drank !== undefined),
  );
}

/**
 * Today's journal entry for drugs/substances users, or undefined if none submitted yet.
 * Finds any entry today where `used` is defined (drugs-specific gate).
 */
export function useTodayDrugJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.used !== undefined),
  );
}

/**
 * Today's journal entry for gaming users, or undefined if none submitted yet.
 * Finds any entry today where `played` is defined (gaming-specific gate).
 */
export function useTodayGamingJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.played !== undefined),
  );
}

/**
 * Today's journal entry for online shopping users, or undefined if none submitted yet.
 * Finds any entry today where `shopped` is defined (shopping-specific gate).
 */
export function useTodayOnlineShoppingJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) =>
    s.journal.find((j) => sameDay(j.at, Date.now()) && j.shopped !== undefined),
  );
}

/**
 * Today's daily mission state.
 *
 * The selector returns `s.dailyMissions` directly - always a stable reference
 * from the store - so Zustand never sees a new object and the
 * "getSnapshot should be cached" infinite-loop warning cannot fire.
 *
 * Daily reset is handled in two places so the selector stays trivial:
 *  1. `completeMission` normalises to today before every mutation.
 *  2. The persist `merge` resets stale state on cold launch.
 * This means `s.dailyMissions` is always the correct day's state by the time
 * any component reads it.
 */
export function useDailyMissions(): DailyMissionState {
  return useStore((s) => s.dailyMissions);
}
