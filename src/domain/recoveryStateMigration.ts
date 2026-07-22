import {
  ADDICTIONS,
  DEFAULT_CURRENCY,
  type AddictionType,
  type ExpensePeriod,
  type RecoveryProfile,
} from './gambling';
import { normalizeSelectedAddictions } from './multiAddiction';
import {
  GOAL_MODES,
  RECOVERY_TRACK_SETUP_VERSION,
  TRACK_SETUP_STATUSES,
  toLocalMidnight,
  trackUsesExpense,
  type GoalMode,
  type RecoveryTrackSetup,
  type TrackSetupStatus,
} from './recoveryTrackSetup';

/** Zustand persist schema for explicit, independently configured recovery tracks. */
export const RECOVERY_STATE_SCHEMA_VERSION = 4 as const;

type UnknownRecord = Record<string, unknown>;

const KNOWN_ADDICTIONS = new Set<string>(ADDICTIONS.map((item) => item.key));
const EXPENSE_PERIODS = new Set<string>(['daily', 'weekly', 'monthly']);
const GOAL_MODE_SET = new Set<string>(GOAL_MODES);
const SETUP_STATUS_SET = new Set<string>(TRACK_SETUP_STATUSES);
const LOCAL_EPOCH_MIDNIGHT = new Date(1970, 0, 1).getTime();

/**
 * Fields duplicated at the top level while one recovery track is active.
 * During migration these values win over a stale cached active snapshot.
 */
const ACTIVE_SNAPSHOT_FIELDS = [
  'checkIns',
  'urges',
  'relapses',
  'journal',
  'reflections',
  'timeline',
  'points',
  'longestStreak',
  'goals',
  'celebratedBadges',
  'alternatives',
  'altCounts',
  'altAchievements',
  'altSeconds',
  'altSessions',
  'walkSteps',
  'walkMeters',
  'waterToday',
  'waterGlassesTotal',
  'needOrWantCooldown',
  'needOrWantEntries',
  'activeNeedOrWantId',
  'catchYourBreathEntries',
  'lastCatchYourBreathAt',
  'cheersToChangeEntries',
  'lastCheersToChangeAt',
  'backOnTrackEntries',
  'lastBackOnTrackAt',
  'whereDidItGoEntries',
  'lastWhereDidItGoAt',
  'beyondTheScreenEntries',
  'lastBeyondTheScreenAt',
  'pressPauseEntries',
  'lastPressPauseAt',
  'lastCheckedIn',
  'urgesResisted',
  'urgesResistedWeek',
  'healthyHabitsCount',
  'dailyMissions',
  'missionXp',
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isAddictionType(value: unknown): value is AddictionType {
  return typeof value === 'string' && KNOWN_ADDICTIONS.has(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function localMidnightOrFallback(value: unknown, fallback = LOCAL_EPOCH_MIDNIGHT): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    try {
      const midnight = toLocalMidnight(value);
      if (Number.isFinite(midnight)) return midnight;
    } catch {
      // A corrupt/out-of-range Date is repaired by the deterministic fallback.
    }
  }
  return fallback;
}

function validExpensePeriod(value: unknown): value is ExpensePeriod {
  return typeof value === 'string' && EXPENSE_PERIODS.has(value);
}

function validGoalMode(value: unknown): value is GoalMode {
  return typeof value === 'string' && GOAL_MODE_SET.has(value);
}

function validSetupStatus(value: unknown): value is TrackSetupStatus {
  return typeof value === 'string' && SETUP_STATUS_SET.has(value);
}

function selectedTracks(active: AddictionType, profile: UnknownRecord): AddictionType[] {
  const raw = Array.isArray(profile.selectedAddictions)
    ? profile.selectedAddictions.filter(isAddictionType)
    : undefined;
  return normalizeSelectedAddictions(active, raw);
}

interface SharedAccount {
  name: string;
  hasAge: boolean;
  age?: number;
  currency: string;
}

function normalizeProfile(
  rawProfile: unknown,
  addictionType: AddictionType,
  selections: readonly AddictionType[],
  shared: SharedAccount,
  fallbackStartedAt: number,
): RecoveryProfile & UnknownRecord {
  const raw = isRecord(rawProfile) ? rawProfile : {};
  const startedAt = localMidnightOrFallback(raw.startedAt, fallbackStartedAt);
  const period = validExpensePeriod(raw.expensePeriod) ? raw.expensePeriod : 'weekly';
  const amount = typeof raw.expenseAmount === 'number'
    && Number.isFinite(raw.expenseAmount)
    && raw.expenseAmount >= 0
    ? raw.expenseAmount
    : 0;
  const ownCurrency = typeof raw.currency === 'string' && raw.currency.trim()
    ? raw.currency
    : shared.currency;
  const ownName = typeof raw.name === 'string' ? raw.name : shared.name;

  const normalized: RecoveryProfile & UnknownRecord = {
    ...raw,
    name: shared.name || ownName,
    addictionType,
    selectedAddictions: [...selections],
    startedAt,
    expenseAmount: amount,
    expensePeriod: period,
    currency: ownCurrency,
    triggers: stringArray(raw.triggers),
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };

  if (shared.hasAge) normalized.age = shared.age;
  else if (hasOwn(normalized, 'age')) delete normalized.age;
  return normalized;
}

function setupStatusFor(
  addictionType: AddictionType,
  active: AddictionType | null,
  selections: readonly AddictionType[],
  existing: UnknownRecord | null,
): TrackSetupStatus {
  if (addictionType === active) {
    if (
      existing?.setupVersion === RECOVERY_TRACK_SETUP_VERSION
      && validSetupStatus(existing.setupStatus)
      && existing.setupStatus !== 'archived'
    ) return existing.setupStatus;
    return 'complete';
  }
  const hasCurrentSetup = existing?.setupVersion === RECOVERY_TRACK_SETUP_VERSION;
  if (!hasCurrentSetup) return 'needs_review';

  const status = validSetupStatus(existing.setupStatus)
    ? existing.setupStatus
    : 'needs_review';
  if (!selections.includes(addictionType)) {
    if (
      (status === 'complete' || status === 'archived')
      && typeof existing.setupCompletedAt === 'number'
      && Number.isFinite(existing.setupCompletedAt)
      && existing.setupCompletedAt > 0
    ) return 'archived';
    return 'needs_review';
  }
  return status === 'archived' ? 'needs_review' : status;
}

function setupFromProfile(
  profile: RecoveryProfile & UnknownRecord,
  rawSetup: unknown,
  status: TrackSetupStatus,
): RecoveryTrackSetup & UnknownRecord {
  const existing = isRecord(rawSetup) ? rawSetup : {};
  const existingExpense = isRecord(existing.expense) ? existing.expense : {};
  const amount = typeof existingExpense.amount === 'number'
    && Number.isFinite(existingExpense.amount)
    && existingExpense.amount >= 0
    ? existingExpense.amount
    : profile.expenseAmount;
  const period = validExpensePeriod(existingExpense.period)
    ? existingExpense.period
    : profile.expensePeriod;
  const currency = typeof existingExpense.currency === 'string' && existingExpense.currency.trim()
    ? existingExpense.currency
    : profile.currency;
  const detail = typeof existing.addictionDetail === 'string'
    ? existing.addictionDetail
    : profile.addictionDetail;
  const reason = typeof existing.reason === 'string' ? existing.reason : profile.reason;
  const triggers = Array.isArray(existing.triggers)
    ? stringArray(existing.triggers)
    : [...profile.triggers];
  const startedAtLocalMidnight = localMidnightOrFallback(
    profile.startedAt,
    LOCAL_EPOCH_MIDNIGHT,
  );

  const setup: RecoveryTrackSetup & UnknownRecord = {
    ...existing,
    addictionType: profile.addictionType,
    ...(detail ? { addictionDetail: detail } : {}),
    goalMode: validGoalMode(existing.goalMode) ? existing.goalMode : 'quit',
    startedAtLocalMidnight,
    ...(trackUsesExpense(profile.addictionType)
      ? { expense: { ...existingExpense, amount, period, currency } }
      : {}),
    triggers,
    reason,
    setupVersion: RECOVERY_TRACK_SETUP_VERSION,
    setupStatus: status,
  };

  if (!trackUsesExpense(profile.addictionType) && hasOwn(setup, 'expense')) {
    delete setup.expense;
  }
  if (!detail && hasOwn(setup, 'addictionDetail')) delete setup.addictionDetail;

  if (status === 'complete') {
    setup.setupCompletedAt = typeof existing.setupCompletedAt === 'number'
      && Number.isFinite(existing.setupCompletedAt)
      && existing.setupCompletedAt > 0
      ? existing.setupCompletedAt
      : Math.max(1, startedAtLocalMidnight);
  } else if (
    status === 'archived'
    && typeof existing.setupCompletedAt === 'number'
    && Number.isFinite(existing.setupCompletedAt)
    && existing.setupCompletedAt > 0
  ) {
    setup.setupCompletedAt = existing.setupCompletedAt;
  } else if (hasOwn(setup, 'setupCompletedAt')) {
    delete setup.setupCompletedAt;
  }
  return setup;
}

function emptySnapshot(
  profile: RecoveryProfile & UnknownRecord,
  setup: RecoveryTrackSetup & UnknownRecord,
): UnknownRecord {
  return {
    profile,
    setup,
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
    whereDidItGoEntries: [],
    lastWhereDidItGoAt: null,
    beyondTheScreenEntries: [],
    lastBeyondTheScreenAt: null,
    pressPauseEntries: [],
    lastPressPauseAt: null,
    lastCheckedIn: null,
    urgesResisted: 0,
    urgesResistedWeek: 0,
    healthyHabitsCount: 0,
    dailyMissions: { day: '', completed: [] },
    missionXp: 0,
  };
}

function activeSnapshotPatch(state: UnknownRecord): UnknownRecord {
  const patch: UnknownRecord = {};
  for (const field of ACTIVE_SNAPSHOT_FIELDS) {
    if (hasOwn(state, field)) patch[field] = state[field];
  }
  return patch;
}

const NULLABLE_NUMBER_SNAPSHOT_FIELDS = new Set([
  'needOrWantCooldown',
  'lastCatchYourBreathAt',
  'lastCheersToChangeAt',
  'lastBackOnTrackAt',
  'lastWhereDidItGoAt',
  'lastBeyondTheScreenAt',
  'lastPressPauseAt',
  'lastCheckedIn',
]);

function repairedSnapshot(
  rawSnapshot: UnknownRecord,
  profile: RecoveryProfile & UnknownRecord,
  setup: RecoveryTrackSetup & UnknownRecord,
  activePatch: UnknownRecord = {},
): UnknownRecord {
  const defaults = emptySnapshot(profile, setup);
  const repaired: UnknownRecord = {
    ...defaults,
    ...rawSnapshot,
    ...activePatch,
    profile,
    setup,
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (key === 'profile' || key === 'setup') continue;
    const value = repaired[key];
    if (Array.isArray(fallback)) {
      if (!Array.isArray(value)) repaired[key] = fallback;
      continue;
    }
    if (typeof fallback === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) repaired[key] = fallback;
      continue;
    }
    if (fallback === null) {
      const valid = value === null
        || (key === 'activeNeedOrWantId' && typeof value === 'string')
        || (NULLABLE_NUMBER_SNAPSHOT_FIELDS.has(key)
          && typeof value === 'number'
          && Number.isFinite(value));
      if (!valid) repaired[key] = fallback;
      continue;
    }
    if (isRecord(fallback) && !isRecord(value)) repaired[key] = fallback;
  }

  const waterToday = repaired.waterToday;
  if (
    !isRecord(waterToday)
    || typeof waterToday.day !== 'string'
    || typeof waterToday.glasses !== 'number'
    || !Number.isFinite(waterToday.glasses)
  ) repaired.waterToday = defaults.waterToday;

  const dailyMissions = repaired.dailyMissions;
  if (
    !isRecord(dailyMissions)
    || typeof dailyMissions.day !== 'string'
    || !Array.isArray(dailyMissions.completed)
  ) repaired.dailyMissions = defaults.dailyMissions;

  return repaired;
}

/**
 * Upgrade an unknown persisted state to recovery schema v4.
 *
 * The adapter is intentionally framework-free so it can be passed directly to
 * Zustand's `persist({ migrate })`. It never mutates its input, does not create
 * historical events, and preserves fields it does not understand.
 */
export function migrateRecoveryState(
  persistedState: unknown,
  _fromVersion = 0,
): UnknownRecord {
  try {
    if (!isRecord(persistedState)) return {};
    const state: UnknownRecord = { ...persistedState };
    const rawRecovery = isRecord(state.recoveryByAddiction)
      ? state.recoveryByAddiction
      : {};
    const recoveryByAddiction: UnknownRecord = { ...rawRecovery };
    const rootProfile = isRecord(state.profile) ? state.profile : null;
    const active = rootProfile && isAddictionType(rootProfile.addictionType)
      ? rootProfile.addictionType
      : null;

    let selections: AddictionType[] = [];
    let activeProfile: (RecoveryProfile & UnknownRecord) | null = null;
    let shared: SharedAccount = {
      name: '',
      hasAge: false,
      currency: DEFAULT_CURRENCY,
    };
    let fallbackStartedAt = LOCAL_EPOCH_MIDNIGHT;

    if (active && rootProfile) {
      const rawActiveSnapshot = isRecord(rawRecovery[active]) ? rawRecovery[active] : {};
      const storedProfile = isRecord(rawActiveSnapshot.profile) ? rawActiveSnapshot.profile : {};
      const mergedActiveProfile: UnknownRecord = { ...storedProfile, ...rootProfile };
      selections = selectedTracks(active, mergedActiveProfile);
      const name = typeof mergedActiveProfile.name === 'string' ? mergedActiveProfile.name : '';
      const hasAge = hasOwn(mergedActiveProfile, 'age')
        && typeof mergedActiveProfile.age === 'number'
        && Number.isFinite(mergedActiveProfile.age);
      const currency = typeof mergedActiveProfile.currency === 'string'
        && mergedActiveProfile.currency.trim()
        ? mergedActiveProfile.currency
        : DEFAULT_CURRENCY;
      fallbackStartedAt = localMidnightOrFallback(mergedActiveProfile.startedAt);
      shared = {
        name,
        hasAge,
        ...(hasAge ? { age: mergedActiveProfile.age as number } : {}),
        currency,
      };
      activeProfile = normalizeProfile(
        mergedActiveProfile,
        active,
        selections,
        shared,
        fallbackStartedAt,
      );
      state.profile = activeProfile;
    }

    const knownSnapshotKeys = Object.keys(rawRecovery).filter(isAddictionType);
    const keysToRepair = Array.from(new Set<AddictionType>([
      ...knownSnapshotKeys,
      ...selections,
      ...(active ? [active] : []),
    ]));
    const topLevelActive = activeSnapshotPatch(state);

    for (const addictionType of keysToRepair) {
      const rawSnapshot = isRecord(rawRecovery[addictionType])
        ? rawRecovery[addictionType]
        : {};
      const rawProfile = addictionType === active && activeProfile
        ? activeProfile
        : rawSnapshot.profile;
      const trackSelections = active ? selections : [];
      const profile = normalizeProfile(
        rawProfile,
        addictionType,
        trackSelections,
        shared,
        fallbackStartedAt,
      );
      const rawSetup = isRecord(rawSnapshot.setup) ? rawSnapshot.setup : null;
      const status = setupStatusFor(addictionType, active, selections, rawSetup);
      const setup = setupFromProfile(profile, rawSetup, status);
      recoveryByAddiction[addictionType] = repairedSnapshot(
        rawSnapshot,
        profile,
        setup,
        addictionType === active ? topLevelActive : {},
      );
    }

    state.recoveryByAddiction = recoveryByAddiction;
    return state;
  } catch {
    // Persisted data originates from JSON, but this boundary accepts unknown
    // and remains safe even for hostile objects such as throwing Proxies.
    return {};
  }
}

/** Explicitly named alias for callers that prefer the target version in code. */
export const migrateRecoveryStateToV4 = migrateRecoveryState;
