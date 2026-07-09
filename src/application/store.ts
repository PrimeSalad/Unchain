import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecoveryProfile } from '@/domain/gambling';
import { streakDays, currentStreakStart } from '@/domain/gambling';
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

/**
 * Single local store for the recovery companion. Offline-first: no accounts,
 * no backend — persisted to the device with AsyncStorage.
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
  /** Permanently unlocked game achievements: id → unlockedAt (ms). */
  achievements: Record<string, number>;
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
  achievements: {},
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

  // Recreational games — record actions return achievements newly unlocked
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
  saveClarityProgress: (day: number, guesses: string[]) => void;
  recordClarityResult: (day: number, guesses: string[], won: boolean) => GameAchievement[];
  recordClarityPractice: (won: boolean, guessCount: number) => GameAchievement[];
  /** Set (or intentionally edit) today's mood on today's check-in. No-op without one. */
  setTodayMood: (mood: number) => void;

  completeSetup: (profile: RecoveryProfile) => void;
  addGoal: (kind: GoalKind, target: number) => void;
  removeGoal: (id: string) => void;
  /** Recompute earned badges + goal completions; returns badges newly earned
   *  since the last call (for celebration). Safe to call on any change. */
  syncAchievements: () => Badge[];
  updateProfile: (patch: Partial<RecoveryProfile>) => void;
  submitCheckIn: (data: Omit<DailyCheckIn, 'id' | 'at'>) => void;
  logUrge: (data: Omit<UrgeLog, 'id' | 'at'>) => void;
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

const PERSIST_KEY = 'unchained-gambling-v1';

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
        ...unlocked.map((a) => evt('achievement', `Achievement unlocked — ${a.title}`)),
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
        //   2. A JournalEntry(gambled=true) on that day → calendar shows red.
        //   3. A JournalEntry(gambled=false) for every day BETWEEN the relapse
        //      and today (exclusive) → calendar shows those days green.
        //   Today itself is left blank — the user fills it in via the journal.
        const now = new Date();
        const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const isToday = profile.startedAt >= todayMid;

        // Seed timestamp: 1ms after local midnight of the last-used day.
        const seedAt = profile.startedAt + 1;

        const initialRelapses: RelapseEvent[] = isToday
          ? []
          : [{ id: uid(), at: seedAt, whatHappened: 'Last use before recovery' }];

        const initialJournal: import('@/domain/records').JournalEntry[] = [];

        if (!isToday) {
          // Red dot on the last-used day.
          initialJournal.push({
            id: uid(),
            at: seedAt,
            gambled: true,
            text: 'Last use before recovery.',
          });

          // Green dots for every full calendar day after the relapse up to
          // (but not including) today. Each entry is stamped at noon local
          // time of that day so it looks natural in the journal list.
          const MS_PER_DAY = 86_400_000;
          let dayMid = profile.startedAt + MS_PER_DAY; // midnight of day after relapse
          while (dayMid < todayMid) {
            initialJournal.push({
              id: uid(),
              at: dayMid + 12 * 3_600_000, // noon of that day
              gambled: false,
              text: 'Clean day.',
            });
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
        set({
          celebratedBadges: [...s.celebratedBadges, ...newlyIds],
          goals,
          timeline: [
            ...newlyIds.map((id) => evt('achievement', `Badge earned — ${title(id)}`)),
            ...newlyGoals.map((g) => evt('milestone', `Goal reached — ${goalTitle(g)}`)),
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
        const entry: UrgeLog = { ...data, id: uid(), at: Date.now() };
        set((s) => ({
          urges: [entry, ...s.urges],
          points: s.points + 5,
          timeline: [evt('urge', `Logged urge — intensity ${data.intensity}/10`), ...s.timeline],
        }));
      },

      logRelapse: (data) => {
        set((s) => {
          if (!s.profile) return s;
          // Compute current streak from events so longestStreak is accurate.
          const streakStart = currentStreakStart(s.profile.startedAt, s.relapses, s.journal);
          const prevDays = streakDays(streakStart);
          const relapse: RelapseEvent = { ...data, id: uid(), at: Date.now() };
          // Do NOT mutate profile.startedAt — the relapses array is the
          // canonical history.  streakDays is now derived from events.
          return {
            relapses: [relapse, ...s.relapses],
            longestStreak: Math.max(s.longestStreak, prevDays),
            timeline: [evt('relapse', 'Logged a relapse — recovery continues'), ...s.timeline],
          };
        });
      },

      addJournal: (data) => {
        set((s) => {
          if (!s.profile) return s;

          // ── One journal entry per calendar day ─────────────────────────
          // If the user already submitted today, silently no-op so double-taps
          // and navigation loops can never create duplicates.
          if (s.journal.some((j) => sameDay(j.at, Date.now()))) return s;

          const entry: JournalEntry = { ...data, id: uid(), at: Date.now() };

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
              journal: [entry, ...s.journal],
              relapses: [relapseEntry, ...s.relapses],
              longestStreak: Math.max(s.longestStreak, prevDays),
              points: s.points + 5,
              timeline: [
                evt('journal', 'Journal entry — gambling relapse logged'),
                evt('relapse', 'Logged a relapse via journal — recovery continues'),
                ...s.timeline,
              ],
            };
          }

          return {
            journal: [entry, ...s.journal],
            points: s.points + 5,
            timeline: [evt('journal', 'Wrote a journal entry'), ...s.timeline],
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
          // Restart the streak from right now, keeping all profile details.
          profile: s.profile ? { ...s.profile, startedAt: Date.now() } : null,
        })),

      resetAll: () => {
        // Remove the AsyncStorage key so wiped state persists across restarts.
        // Without this, Zustand would rehydrate the old data on next launch.
        AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
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
        });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Deep-merge the games slice so users upgrading from an older build get
      // defaults for fields that didn't exist when their state was saved.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RecoveryState>;
        return {
          ...current,
          ...p,
          games: { ...initialGames, ...(p.games ?? {}) },
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

/** Today's journal entry, or undefined if none submitted yet today. */
export function useTodayJournal(): import('@/domain/records').JournalEntry | undefined {
  return useStore((s) => s.journal.find((j) => sameDay(j.at, Date.now())));
}
