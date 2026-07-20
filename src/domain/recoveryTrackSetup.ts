import {
  ADDICTIONS,
  DEFAULT_CURRENCY,
  addictionMeta,
  type AddictionType,
  type ExpensePeriod,
  type RecoveryProfile,
} from './gambling';

export const RECOVERY_TRACK_SETUP_VERSION = 1 as const;

export const TRACK_SETUP_STATUSES = ['draft', 'needs_review', 'complete', 'archived'] as const;
export type TrackSetupStatus = (typeof TRACK_SETUP_STATUSES)[number];

export const GOAL_MODES = ['quit', 'reduce', 'take_a_break'] as const;
export type GoalMode = (typeof GOAL_MODES)[number];

export interface RecoveryTrackExpense {
  amount: number;
  period: ExpensePeriod;
  currency: string;
}

/**
 * Answers owned by one recovery track. Shared identity deliberately does not
 * live here, so answers cannot leak when several categories are configured.
 */
export interface RecoveryTrackDraft {
  addictionType: AddictionType;
  addictionDetail?: string;
  goalMode: GoalMode;
  startedAtLocalMidnight: number;
  expense?: RecoveryTrackExpense;
  timeBaselineMinutes?: number;
  triggers: string[];
  reason: string;
}

/** Explicit setup state; empty optional answers never imply incompleteness. */
export interface RecoveryTrackSetup extends RecoveryTrackDraft {
  setupVersion: typeof RECOVERY_TRACK_SETUP_VERSION;
  setupStatus: TrackSetupStatus;
  setupCompletedAt?: number;
}

export interface RecoveryAccountDraft {
  name: string;
  age?: number;
}

/** Only selected tracks are present, so the persisted map is intentionally partial. */
export type RecoveryTrackSetupMap = Partial<Record<AddictionType, RecoveryTrackSetup>>;

export interface RecoverySetupSubmission {
  account: RecoveryAccountDraft;
  activeTrack: AddictionType;
  trackOrder: AddictionType[];
  tracks: RecoveryTrackSetupMap;
}

export type RecoveryTrackStepKey =
  | 'detail'
  | 'goal_mode'
  | 'started_at'
  | 'expense'
  | 'time_baseline'
  | 'triggers'
  | 'reason'
  | 'review';

export type RecoveryTrackStepId = `${AddictionType}:${RecoveryTrackStepKey}`;

export interface RecoveryTrackSetupStep {
  id: RecoveryTrackStepId;
  addictionType: AddictionType;
  key: RecoveryTrackStepKey;
  required: boolean;
}

export type RecoveryTrackValidationCode =
  | 'unknown_addiction'
  | 'detail_required'
  | 'goal_mode_invalid'
  | 'started_at_invalid'
  | 'started_at_not_local_midnight'
  | 'started_at_in_future'
  | 'expense_required'
  | 'expense_not_applicable'
  | 'expense_amount_invalid'
  | 'expense_period_invalid'
  | 'currency_required'
  | 'time_baseline_required'
  | 'time_baseline_not_applicable'
  | 'time_baseline_invalid'
  | 'triggers_invalid'
  | 'reason_required'
  | 'setup_version_invalid'
  | 'setup_status_invalid'
  | 'setup_completion_time_required'
  | 'setup_completion_time_invalid'
  | 'account_name_required'
  | 'account_age_invalid'
  | 'track_order_empty'
  | 'track_order_duplicate'
  | 'active_track_missing'
  | 'track_missing'
  | 'track_not_selected'
  | 'track_type_mismatch'
  | 'track_not_complete';

export interface RecoveryTrackValidationIssue {
  code: RecoveryTrackValidationCode;
  field: string;
  message: string;
  addictionType?: AddictionType;
  stepId?: RecoveryTrackStepId;
}

export type RecoveryTrackResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: RecoveryTrackValidationIssue[] };

const EXPENSE_PERIODS: readonly ExpensePeriod[] = ['daily', 'weekly', 'monthly'];
const TIME_BASELINE_TRACKS: readonly AddictionType[] = ['social_media', 'gaming', 'other'];
const REQUIRED_TIME_BASELINE_TRACKS: readonly AddictionType[] = ['social_media', 'gaming'];
const KNOWN_ADDICTIONS = new Set<AddictionType>(ADDICTIONS.map((item) => item.key));

function isAddictionType(value: unknown): value is AddictionType {
  return typeof value === 'string' && KNOWN_ADDICTIONS.has(value as AddictionType);
}

function isGoalMode(value: unknown): value is GoalMode {
  return typeof value === 'string' && (GOAL_MODES as readonly string[]).includes(value);
}

function isExpensePeriod(value: unknown): value is ExpensePeriod {
  return typeof value === 'string' && (EXPENSE_PERIODS as readonly string[]).includes(value);
}

function isTrackSetupStatus(value: unknown): value is TrackSetupStatus {
  return typeof value === 'string' && (TRACK_SETUP_STATUSES as readonly string[]).includes(value);
}

export function trackUsesExpense(addictionType: AddictionType): boolean {
  return addictionMeta(addictionType).hasExpense;
}

export function trackUsesTimeBaseline(addictionType: AddictionType): boolean {
  return TIME_BASELINE_TRACKS.includes(addictionType);
}

export function trackRequiresTimeBaseline(addictionType: AddictionType): boolean {
  return REQUIRED_TIME_BASELINE_TRACKS.includes(addictionType);
}

/** Matches current onboarding semantics: option lists and custom habits require detail. */
export function trackRequiresDetail(addictionType: AddictionType): boolean {
  const meta = addictionMeta(addictionType);
  return addictionType === 'other' || Boolean(meta.specificOptions?.length);
}

/** Stable, category-qualified step IDs survive selection-order and Back changes. */
export function recoveryTrackSetupSteps(
  addictionType: AddictionType,
): readonly RecoveryTrackSetupStep[] {
  const make = (key: RecoveryTrackStepKey, required: boolean): RecoveryTrackSetupStep =>
    Object.freeze({
      id: `${addictionType}:${key}` as RecoveryTrackStepId,
      addictionType,
      key,
      required,
    });

  const steps: RecoveryTrackSetupStep[] = [
    make('detail', trackRequiresDetail(addictionType)),
    make('goal_mode', true),
    make('started_at', true),
  ];
  if (trackUsesExpense(addictionType)) steps.push(make('expense', true));
  if (trackUsesTimeBaseline(addictionType)) {
    steps.push(make('time_baseline', trackRequiresTimeBaseline(addictionType)));
  }
  steps.push(make('triggers', false), make('reason', true), make('review', true));
  return Object.freeze(steps);
}

/** Flatten selected tracks without losing category order or conditional steps. */
export function recoverySetupStepsForTracks(
  trackOrder: readonly AddictionType[],
): readonly RecoveryTrackSetupStep[] {
  return Object.freeze(trackOrder.flatMap((type) => recoveryTrackSetupSteps(type)));
}

/** Convert any timestamp to midnight in the device's local calendar. */
export function toLocalMidnight(timestamp = Date.now()): number {
  if (!Number.isFinite(timestamp)) throw new RangeError('timestamp must be finite');
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Calendar arithmetic avoids fixed-24-hour errors across daylight-saving changes. */
export function localMidnightDaysAgo(daysAgo: number, from = Date.now()): number {
  if (!Number.isInteger(daysAgo) || daysAgo < 0) {
    throw new RangeError('daysAgo must be a non-negative integer');
  }
  if (!Number.isFinite(from)) throw new RangeError('from must be finite');
  const date = new Date(from);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysAgo).getTime();
}

export function isLocalMidnight(timestamp: number): boolean {
  if (!Number.isFinite(timestamp)) return false;
  const date = new Date(timestamp);
  return date.getHours() === 0
    && date.getMinutes() === 0
    && date.getSeconds() === 0
    && date.getMilliseconds() === 0;
}

export interface CreateRecoveryTrackDraftOptions {
  now?: number;
  goalMode?: GoalMode;
  expensePeriod?: ExpensePeriod;
  currency?: string;
}

/** Every call returns independent arrays/objects, safe for a draft map keyed by category. */
export function createRecoveryTrackDraft(
  addictionType: AddictionType,
  options: CreateRecoveryTrackDraftOptions = {},
): RecoveryTrackDraft {
  const currency = options.currency?.trim() || DEFAULT_CURRENCY;
  const expensePeriod = options.expensePeriod ?? 'weekly';
  return {
    addictionType,
    goalMode: options.goalMode ?? 'quit',
    startedAtLocalMidnight: toLocalMidnight(options.now ?? Date.now()),
    ...(trackUsesExpense(addictionType)
      ? { expense: { amount: 0, period: expensePeriod, currency } }
      : {}),
    triggers: [],
    reason: '',
  };
}

/** Canonicalize user-entered text and remove duplicate/blank triggers. */
export function normalizeRecoveryTrackDraft(draft: RecoveryTrackDraft): RecoveryTrackDraft {
  const detail = typeof draft.addictionDetail === 'string'
    ? draft.addictionDetail.trim()
    : '';
  const triggers = Array.isArray(draft.triggers)
    ? Array.from(new Set(
      draft.triggers
        .filter((trigger): trigger is string => typeof trigger === 'string')
        .map((trigger) => trigger.trim())
        .filter(Boolean),
    ))
    : [];
  return {
    addictionType: draft.addictionType,
    ...(detail ? { addictionDetail: detail } : {}),
    goalMode: draft.goalMode,
    startedAtLocalMidnight: draft.startedAtLocalMidnight,
    ...(draft.expense
      ? {
          expense: {
            amount: draft.expense.amount,
            period: draft.expense.period,
            currency: typeof draft.expense.currency === 'string'
              ? draft.expense.currency.trim()
              : '',
          },
        }
      : {}),
    ...(draft.timeBaselineMinutes == null
      ? {}
      : { timeBaselineMinutes: draft.timeBaselineMinutes }),
    triggers,
    reason: typeof draft.reason === 'string' ? draft.reason.trim() : '',
  };
}

function issue(
  code: RecoveryTrackValidationCode,
  field: string,
  message: string,
  addictionType?: AddictionType,
  stepKey?: RecoveryTrackStepKey,
): RecoveryTrackValidationIssue {
  return {
    code,
    field,
    message,
    ...(addictionType ? { addictionType } : {}),
    ...(addictionType && stepKey
      ? { stepId: `${addictionType}:${stepKey}` as RecoveryTrackStepId }
      : {}),
  };
}

export function validateRecoveryTrackDraft(
  draft: RecoveryTrackDraft,
  now = Date.now(),
): RecoveryTrackValidationIssue[] {
  const issues: RecoveryTrackValidationIssue[] = [];
  const rawType: unknown = draft?.addictionType;
  if (!isAddictionType(rawType)) {
    return [issue('unknown_addiction', 'addictionType', 'Choose a supported recovery category.')];
  }
  const addictionType = rawType;
  const normalized = normalizeRecoveryTrackDraft(draft);

  if (trackRequiresDetail(addictionType) && !normalized.addictionDetail) {
    issues.push(issue(
      'detail_required',
      'addictionDetail',
      'Answer the category-specific question before continuing.',
      addictionType,
      'detail',
    ));
  }
  if (!isGoalMode(draft.goalMode)) {
    issues.push(issue(
      'goal_mode_invalid',
      'goalMode',
      'Choose whether to quit, reduce, or take a break.',
      addictionType,
      'goal_mode',
    ));
  }

  const startedAt = draft.startedAtLocalMidnight;
  if (!Number.isFinite(startedAt)) {
    issues.push(issue(
      'started_at_invalid',
      'startedAtLocalMidnight',
      'Choose a valid recovery start date.',
      addictionType,
      'started_at',
    ));
  } else {
    if (!isLocalMidnight(startedAt)) {
      issues.push(issue(
        'started_at_not_local_midnight',
        'startedAtLocalMidnight',
        'Recovery start must use local-calendar midnight.',
        addictionType,
        'started_at',
      ));
    }
    if (Number.isFinite(now) && startedAt > toLocalMidnight(now)) {
      issues.push(issue(
        'started_at_in_future',
        'startedAtLocalMidnight',
        'Recovery start cannot be in the future.',
        addictionType,
        'started_at',
      ));
    }
  }

  if (trackUsesExpense(addictionType)) {
    if (!draft.expense) {
      issues.push(issue(
        'expense_required',
        'expense',
        'Review the money baseline for this recovery track.',
        addictionType,
        'expense',
      ));
    } else {
      if (!Number.isFinite(draft.expense.amount) || draft.expense.amount < 0) {
        issues.push(issue(
          'expense_amount_invalid',
          'expense.amount',
          'Expense must be zero or a positive number.',
          addictionType,
          'expense',
        ));
      }
      if (!isExpensePeriod(draft.expense.period)) {
        issues.push(issue(
          'expense_period_invalid',
          'expense.period',
          'Choose a daily, weekly, or monthly expense period.',
          addictionType,
          'expense',
        ));
      }
      if (typeof draft.expense.currency !== 'string' || !draft.expense.currency.trim()) {
        issues.push(issue(
          'currency_required',
          'expense.currency',
          'Choose a currency for the money baseline.',
          addictionType,
          'expense',
        ));
      }
    }
  } else if (draft.expense != null) {
    issues.push(issue(
      'expense_not_applicable',
      'expense',
      'This recovery category does not use a money baseline.',
      addictionType,
      'detail',
    ));
  }

  if (trackRequiresTimeBaseline(addictionType) && draft.timeBaselineMinutes == null) {
    issues.push(issue(
      'time_baseline_required',
      'timeBaselineMinutes',
      'Enter the usual daily time for this recovery track.',
      addictionType,
      'time_baseline',
    ));
  }
  if (draft.timeBaselineMinutes != null) {
    if (!trackUsesTimeBaseline(addictionType)) {
      issues.push(issue(
        'time_baseline_not_applicable',
        'timeBaselineMinutes',
        'This recovery category does not use a time baseline.',
        addictionType,
        'detail',
      ));
    } else if (
      !Number.isInteger(draft.timeBaselineMinutes)
      || draft.timeBaselineMinutes <= 0
      || draft.timeBaselineMinutes > 24 * 60
    ) {
      issues.push(issue(
        'time_baseline_invalid',
        'timeBaselineMinutes',
        'Daily time must be a whole number from 1 to 1,440 minutes.',
        addictionType,
        'time_baseline',
      ));
    }
  }

  if (!Array.isArray(draft.triggers) || draft.triggers.some((trigger) => typeof trigger !== 'string')) {
    issues.push(issue(
      'triggers_invalid',
      'triggers',
      'Triggers must be a list of text labels.',
      addictionType,
      'triggers',
    ));
  }
  if (!normalized.reason) {
    issues.push(issue(
      'reason_required',
      'reason',
      'Add a personal reason for this recovery track.',
      addictionType,
      'reason',
    ));
  }
  return issues;
}

export function validateRecoveryTrackSetup(
  setup: RecoveryTrackSetup,
  now = Date.now(),
): RecoveryTrackValidationIssue[] {
  const issues = validateRecoveryTrackDraft(setup, now);
  const addictionType = isAddictionType(setup?.addictionType) ? setup.addictionType : undefined;
  if (setup?.setupVersion !== RECOVERY_TRACK_SETUP_VERSION) {
    issues.push(issue(
      'setup_version_invalid',
      'setupVersion',
      `Recovery track setup version must be ${RECOVERY_TRACK_SETUP_VERSION}.`,
      addictionType,
    ));
  }
  if (!isTrackSetupStatus(setup?.setupStatus)) {
    issues.push(issue(
      'setup_status_invalid',
      'setupStatus',
      'Recovery track setup has an unsupported status.',
      addictionType,
    ));
  }
  if (setup?.setupStatus === 'complete' || setup?.setupStatus === 'archived') {
    if (setup.setupCompletedAt == null) {
      issues.push(issue(
        'setup_completion_time_required',
        'setupCompletedAt',
        'Completed recovery setup needs a completion timestamp.',
        addictionType,
      ));
    } else if (
      !Number.isFinite(setup.setupCompletedAt)
      || setup.setupCompletedAt <= 0
      || setup.setupCompletedAt > now
    ) {
      issues.push(issue(
        'setup_completion_time_invalid',
        'setupCompletedAt',
        'Setup completion time must be a valid timestamp that is not in the future.',
        addictionType,
      ));
    }
  }
  return issues;
}

/**
 * Runtime eligibility gate for actions that create data in, or activate, a
 * recovery track. A persisted status flag alone is not sufficient: older or
 * damaged snapshots can say `complete` while still missing required answers.
 */
export function isCompleteRecoveryTrackSetup(
  setup: RecoveryTrackSetup | null | undefined,
  now = Date.now(),
): setup is RecoveryTrackSetup {
  return setup?.setupStatus === 'complete'
    && validateRecoveryTrackSetup(setup, now).length === 0;
}

/** A fully configured track may be active (`complete`) or retained as
 * archived history. This broader predicate is reserved for frozen workflows
 * such as finishing a daily-journal plan after the track was archived. */
export function isConfiguredRecoveryTrackSetup(
  setup: RecoveryTrackSetup | null | undefined,
  now = Date.now(),
): setup is RecoveryTrackSetup {
  return (setup?.setupStatus === 'complete' || setup?.setupStatus === 'archived')
    && validateRecoveryTrackSetup(setup, now).length === 0;
}

export function finalizeRecoveryTrackDraft(
  draft: RecoveryTrackDraft,
  completedAt = Date.now(),
): RecoveryTrackResult<RecoveryTrackSetup> {
  const normalized = normalizeRecoveryTrackDraft(draft);
  const issues = validateRecoveryTrackDraft(normalized, completedAt);
  if (!Number.isFinite(completedAt) || completedAt <= 0) {
    issues.push(issue(
      'setup_completion_time_invalid',
      'setupCompletedAt',
      'Setup completion time must be a valid timestamp.',
      isAddictionType(normalized.addictionType) ? normalized.addictionType : undefined,
    ));
  }
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      ...normalized,
      setupVersion: RECOVERY_TRACK_SETUP_VERSION,
      setupStatus: 'complete',
      setupCompletedAt: completedAt,
    },
  };
}

export function createRecoverySetupSubmission(
  input: RecoverySetupSubmission,
  now = Date.now(),
): RecoveryTrackResult<RecoverySetupSubmission> {
  const issues: RecoveryTrackValidationIssue[] = [];
  const name = typeof input.account?.name === 'string' ? input.account.name.trim() : '';
  if (!name) {
    issues.push(issue('account_name_required', 'account.name', 'Enter a nickname before continuing.'));
  }
  const age = input.account?.age;
  if (age != null && (!Number.isInteger(age) || age < 1 || age > 100)) {
    issues.push(issue('account_age_invalid', 'account.age', 'Age must be a whole number from 1 to 100.'));
  }

  const rawOrder = Array.isArray(input.trackOrder) ? input.trackOrder : [];
  const validOrder = rawOrder.filter(isAddictionType);
  if (rawOrder.length === 0) {
    issues.push(issue('track_order_empty', 'trackOrder', 'Select at least one recovery track.'));
  }
  if (validOrder.length !== rawOrder.length) {
    issues.push(issue('unknown_addiction', 'trackOrder', 'Track order contains an unsupported category.'));
  }
  if (new Set(validOrder).size !== validOrder.length) {
    issues.push(issue('track_order_duplicate', 'trackOrder', 'Each recovery category may appear only once.'));
  }
  if (!isAddictionType(input.activeTrack) || !validOrder.includes(input.activeTrack)) {
    issues.push(issue('active_track_missing', 'activeTrack', 'Active track must be in the selected track order.'));
  }

  const normalizedTracks: RecoveryTrackSetupMap = {};
  for (const addictionType of Array.from(new Set(validOrder))) {
    const setup = input.tracks?.[addictionType];
    if (!setup) {
      issues.push(issue(
        'track_missing',
        `tracks.${addictionType}`,
        'Every selected recovery category needs a configured track.',
        addictionType,
      ));
      continue;
    }
    if (setup.addictionType !== addictionType) {
      issues.push(issue(
        'track_type_mismatch',
        `tracks.${addictionType}.addictionType`,
        'Recovery track is stored under the wrong category key.',
        addictionType,
      ));
    }
    if (setup.setupStatus !== 'complete') {
      issues.push(issue(
        'track_not_complete',
        `tracks.${addictionType}.setupStatus`,
        'Finish and confirm this recovery track before submitting.',
        addictionType,
      ));
    }
    issues.push(...validateRecoveryTrackSetup(setup, now));
    normalizedTracks[addictionType] = {
      ...normalizeRecoveryTrackDraft(setup),
      setupVersion: setup.setupVersion,
      setupStatus: setup.setupStatus,
      ...(setup.setupCompletedAt == null ? {} : { setupCompletedAt: setup.setupCompletedAt }),
    };
  }

  for (const key of Object.keys(input.tracks ?? {})) {
    if (!isAddictionType(key)) {
      issues.push(issue(
        'unknown_addiction',
        `tracks.${key}`,
        'Recovery setup contains an unsupported category.',
      ));
    } else if (!validOrder.includes(key)) {
      issues.push(issue(
        'track_not_selected',
        `tracks.${key}`,
        'Unselected recovery tracks cannot be included in this submission.',
        key,
      ));
    }
  }

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      account: { name, ...(age == null ? {} : { age }) },
      activeTrack: input.activeTrack,
      trackOrder: [...validOrder],
      tracks: normalizedTracks,
    },
  };
}

/**
 * Compatibility adapter for the existing store. The setup remains the source
 * of truth; fields absent from legacy RecoveryProfile use neutral values.
 */
export function recoveryProfileFromTrackSetup(
  account: RecoveryAccountDraft,
  setup: RecoveryTrackSetup,
  trackOrder: readonly AddictionType[],
  fallbackCurrency = DEFAULT_CURRENCY,
): RecoveryProfile {
  const normalized = normalizeRecoveryTrackDraft(setup);
  return {
    name: account.name.trim(),
    ...(account.age == null ? {} : { age: account.age }),
    addictionType: setup.addictionType,
    selectedAddictions: [...trackOrder],
    ...(normalized.addictionDetail ? { addictionDetail: normalized.addictionDetail } : {}),
    startedAt: normalized.startedAtLocalMidnight,
    expenseAmount: normalized.expense?.amount ?? 0,
    expensePeriod: normalized.expense?.period ?? 'weekly',
    currency: normalized.expense?.currency || fallbackCurrency,
    triggers: [...normalized.triggers],
    reason: normalized.reason,
  };
}

export interface RecoveryProfileSet {
  activeProfile: RecoveryProfile;
  trackOrder: AddictionType[];
  profiles: Partial<Record<AddictionType, RecoveryProfile>>;
}

/** Convert a validated atomic submission into one independent legacy profile per track. */
export function recoveryProfilesFromSubmission(
  submission: RecoverySetupSubmission,
  fallbackCurrency = DEFAULT_CURRENCY,
): RecoveryProfileSet {
  const profiles: Partial<Record<AddictionType, RecoveryProfile>> = {};
  for (const addictionType of submission.trackOrder) {
    const setup = submission.tracks[addictionType];
    if (!setup) {
      throw new Error(`Missing recovery track setup for ${addictionType}`);
    }
    profiles[addictionType] = recoveryProfileFromTrackSetup(
      submission.account,
      setup,
      submission.trackOrder,
      fallbackCurrency,
    );
  }
  const activeProfile = profiles[submission.activeTrack];
  if (!activeProfile) throw new Error('Active recovery track is missing from submission');
  return { activeProfile, trackOrder: [...submission.trackOrder], profiles };
}
