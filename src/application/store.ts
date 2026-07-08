import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecoveryProfile } from '@/domain/gambling';
import { streakDays } from '@/domain/gambling';
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
  themePref: ThemePref;

  completeSetup: (profile: RecoveryProfile) => void;
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

export const useStore = create<RecoveryState>()(
  persist(
    (set, _get) => ({
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
      themePref: 'system',

      completeSetup: (profile) => {
        set({
          onboarded: true,
          profile,
          timeline: [evt('start', 'Recovery started')],
        });
      },

      updateProfile: (patch) =>
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),

      submitCheckIn: (data) => {
        const entry: DailyCheckIn = { ...data, id: uid(), at: Date.now() };
        set((s) => ({
          checkIns: [entry, ...s.checkIns],
          points: s.points + 10,
          timeline: [
            evt('checkin', 'Completed daily check-in'),
            ...(data.gambled ? [] : [evt('clean', 'Stayed clean today')]),
            ...s.timeline,
          ],
        }));
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
          const prevDays = streakDays(s.profile.startedAt);
          const relapse: RelapseEvent = { ...data, id: uid(), at: Date.now() };
          return {
            relapses: [relapse, ...s.relapses],
            longestStreak: Math.max(s.longestStreak, prevDays),
            profile: { ...s.profile, startedAt: Date.now() },
            timeline: [evt('relapse', 'Logged a relapse — recovery continues'), ...s.timeline],
          };
        });
      },

      addJournal: (data) => {
        const entry: JournalEntry = { ...data, id: uid(), at: Date.now() };
        set((s) => ({
          journal: [entry, ...s.journal],
          points: s.points + 5,
          timeline: [evt('journal', 'Wrote a journal entry'), ...s.timeline],
        }));
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
          themePref: 'system',
        });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
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
