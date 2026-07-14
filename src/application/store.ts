import { create } from 'zustand';
import type * as ZustandMiddleware from 'zustand/middleware';

// Use the CommonJS middleware entry at runtime so web bundling doesn't pull
// zustand's ESM middleware path, which can leak import.meta into the browser
// bundle and white-screen Expo web.
const middleware = require('zustand/middleware') as typeof ZustandMiddleware;
const { persist, createJSONStorage } = middleware;
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecoveryProfile } from '@/domain/gambling';
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
import type { AltAchievement, AltCounts, AlternativeId } from '@/domain/alternatives';
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

interface RecoveryState {
  onboarded: boolean;
  profile: RecoveryProfile | null;
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
 *  the journal activity is derived from the journal entries themselves. */
function altFullDay(
  alternatives: Partial<Record<AlternativeId, number>>,
  journal: Array<{ at: number }>,
  now: number,
): boolean {
  return ALTERNATIVES.every((a) =>
    a.id === 'journal'
      ? journal.some((j) => sameDay(j.at, now))
      : alternatives[a.id] != null && sameDay(alternatives[a.id]!, now),
  );
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
      profile: null,
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

      updateLastCheckedIn: () => set({ lastCheckedIn: Date.now() }),

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
            altFullDay(alternatives, s.journal, now),
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
                : { id: uid(), at: dayMid + 12 * 3_600_000, gambled: false, text: 'Clean day.' },
            );
            dayMid += MS_PER_DAY;
          }
        }

        set({
          onboarded: true,
          profile,
          relapses: initialRelapses,
          journal: initialJournal,
          timeline: [evt('start', 'Recovery started')],
        });
      },

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
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),

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
          const alreadyToday = s.journal.some((j) => {
            if (!sameDay(j.at, Date.now())) return false;
            if (isGamblingEntry) return j.gambled !== undefined;
            if (isPornEntry) return j.watched !== undefined;
            if (isSocialEntry) return j.binged !== undefined;
            if (isSmokeEntry) return j.smoked !== undefined;
            if (isAlcoholEntry) return j.drank !== undefined;
            if (isDrugEntry) return j.used !== undefined;
            if (isGamingEntry) return j.played !== undefined;
            return true; // generic entry - block any duplicate
          });
          if (alreadyToday) return s;

          const entry: JournalEntry = { ...data, id: uid(), at: Date.now() };

          // Journaling is also a Healthy Alternative - a new entry can unlock
          // habit achievements (journal count, or completing the full day).
          const journalAfter = [entry, ...s.journal];
          const altUnlocked = newAltUnlocks(
            { ...s.altCounts, journal: journalAfter.length },
            altFullDay(s.alternatives, journalAfter, Date.now()),
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

          return {
            journal: journalAfter,
            points: s.points + 5 + altUnlocked.length * 5,
            ...altPatch,
            timeline: [...altEvents, evt('journal', 'Wrote a journal entry'), ...s.timeline],
          };
        });
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
        return {
          ...current,
          ...p,
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
