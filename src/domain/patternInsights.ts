import { journalConfig, journalEntryMatches } from './addictionJournal';
import type { AddictionType } from './gambling';
import type { DailyCheckIn, JournalEntry, UrgeLog } from './records';

export type DailyInsightSource =
  | 'journal'
  | 'manual_urge'
  | 'legacy_checkin'
  | 'combined';

/** One trustworthy pattern input for one recovery track on one local day. */
export interface DailyInsightSample {
  track: AddictionType;
  localDateKey: string;
  mood?: number;
  urgePeak?: number;
  triggerIds: string[];
  journalCompleted: boolean;
  manualUrgeCount: number;
  source: DailyInsightSource;
}

/**
 * Optional metadata understood by the projection. Current persisted records do
 * not yet carry it, so every field is optional and existing arrays remain
 * directly assignable. Explicit tags take precedence over legacy heuristics.
 */
export interface PatternInsightRecordMetadata {
  track?: AddictionType;
  addictionType?: AddictionType;
  source?: string;
  origin?: string;
  synthetic?: boolean;
  isSynthetic?: boolean;
}

export type PatternJournalEntry = JournalEntry & PatternInsightRecordMetadata;
export type PatternUrgeLog = UrgeLog & PatternInsightRecordMetadata;
export type PatternCheckIn = DailyCheckIn & PatternInsightRecordMetadata;

export interface PatternInsightProjectionInput {
  track: AddictionType;
  journal?: readonly PatternJournalEntry[];
  urges?: readonly PatternUrgeLog[];
  checkIns?: readonly PatternCheckIn[];
}

export interface PatternInsightUnlockProgress {
  qualifyingDays: number;
  requiredDays: number;
  remainingDays: number;
  unlocked: boolean;
}

export type InsightTrend = 'improving' | 'declining' | 'stable';

export interface InsightTriggerCount {
  tag: string;
  count: number;
}

export const DEFAULT_PATTERN_INSIGHT_UNLOCK_DAYS = 2;

const LEGACY_JOURNAL_LINK_WINDOW_MS = 5_000;
const LEGACY_DAILY_JOURNAL_TRIGGER = 'daily journal';
const LEGACY_SEED_TEXT = new Set(['clean day.', 'last use before recovery.']);

const SYNTHETIC_SOURCE_TOKENS = new Set([
  'synthetic',
  'system',
  'seed',
  'seeded',
  'generated',
  'journal_generated',
  'journal_derived',
  'daily_journal',
  'recovery_history',
]);

const MANUAL_SOURCE_TOKENS = new Set([
  'manual',
  'manual_urge',
  'user',
  'user_entered',
]);

const REAL_JOURNAL_SOURCE_TOKENS = new Set([
  ...MANUAL_SOURCE_TOKENS,
  'journal',
  'journal_entry',
]);

const JOURNAL_DERIVED_URGE_SOURCE_TOKENS = new Set([
  'journal',
  'journal_entry',
  'journal_projection',
  'automatic_journal',
]);

interface MutableDailySample {
  track: AddictionType;
  localDateKey: string;
  localDateOrdinal: number;
  mood?: number;
  moodAt: number;
  urgePeak?: number;
  triggerIds: Map<string, string>;
  journalCompleted: boolean;
  manualUrgeCount: number;
}

/** YYYY-MM-DD in the user's current local calendar, or null for invalid input. */
export function localDateKey(at: number): string | null {
  if (!Number.isFinite(at)) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Local Y/M/D converted through UTC. Unlike elapsed milliseconds between local
 * midnights, adjacent calendar days always differ by one across DST changes.
 */
export function localDateOrdinal(at: number): number | null {
  if (!Number.isFinite(at)) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/** Parse a canonical local date key into its DST-safe UTC ordinal. */
export function localDateOrdinalFromKey(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return Math.floor(timestamp / 86_400_000);
}

function normalizedToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return token || null;
}

function sourceTokens(record: PatternInsightRecordMetadata): string[] {
  return [record.source, record.origin]
    .map(normalizedToken)
    .filter((value): value is string => value != null);
}

function hasExplicitManualSource(record: PatternInsightRecordMetadata): boolean {
  return sourceTokens(record).some((source) => MANUAL_SOURCE_TOKENS.has(source));
}

function hasExplicitSyntheticSource(record: PatternInsightRecordMetadata): boolean {
  return record.synthetic === true
    || record.isSynthetic === true
    || sourceTokens(record).some((source) => SYNTHETIC_SOURCE_TOKENS.has(source));
}

function belongsToTrack(
  record: PatternInsightRecordMetadata,
  requestedTrack: AddictionType,
): boolean {
  const taggedTracks = [record.track, record.addictionType]
    .filter((track): track is AddictionType => track != null);
  return taggedTracks.length === 0
    || taggedTracks.every((track) => track === requestedTrack);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeTrigger(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === LEGACY_DAILY_JOURNAL_TRIGGER) {
    return null;
  }
  return trimmed;
}

function addTriggers(sample: MutableDailySample, values: readonly unknown[]): void {
  for (const value of values) {
    const trigger = normalizeTrigger(value);
    if (!trigger) continue;
    const identity = trigger.toLowerCase();
    if (!sample.triggerIds.has(identity)) sample.triggerIds.set(identity, trigger);
  }
}

function updateMood(sample: MutableDailySample, mood: unknown, at: number): void {
  const value = finiteNumber(mood);
  if (value == null || at < sample.moodAt) return;
  sample.mood = value;
  sample.moodAt = at;
}

function updateUrgePeak(sample: MutableDailySample, urge: unknown): void {
  const value = finiteNumber(urge);
  if (value == null) return;
  sample.urgePeak = sample.urgePeak == null ? value : Math.max(sample.urgePeak, value);
}

function createMutableSample(
  track: AddictionType,
  key: string,
  ordinal: number,
): MutableDailySample {
  return {
    track,
    localDateKey: key,
    localDateOrdinal: ordinal,
    moodAt: Number.NEGATIVE_INFINITY,
    triggerIds: new Map(),
    journalCompleted: false,
    manualUrgeCount: 0,
  };
}

function sampleFor(
  samples: Map<string, MutableDailySample>,
  track: AddictionType,
  at: number,
): MutableDailySample | null {
  const key = localDateKey(at);
  const ordinal = localDateOrdinal(at);
  if (key == null || ordinal == null) return null;
  let sample = samples.get(key);
  if (!sample) {
    sample = createMutableSample(track, key, ordinal);
    samples.set(key, sample);
  }
  return sample;
}

/** Detect the exact minimal journal rows generated by legacy recovery seeding. */
export function isSyntheticInsightJournal(
  entry: PatternJournalEntry,
  track: AddictionType,
): boolean {
  if (hasExplicitSyntheticSource(entry)) return true;
  if (sourceTokens(entry).some((source) => REAL_JOURNAL_SOURCE_TOKENS.has(source))) {
    return false;
  }
  if (!LEGACY_SEED_TEXT.has(entry.text.trim().toLowerCase())) return false;

  const statusField = journalConfig(track).statusField;
  const seedOnlyKeys = new Set([
    'id',
    'at',
    'text',
    statusField,
    'track',
    'addictionType',
    'source',
    'origin',
    'synthetic',
    'isSynthetic',
  ]);
  return Object.keys(entry).every((key) => seedOnlyKeys.has(key));
}

function journalUrge(entry: JournalEntry, track: AddictionType): number | undefined {
  switch (track) {
    case 'pornography': return finiteNumber(entry.urgeIntensity);
    case 'social_media': return finiteNumber(entry.socialUrgeIntensity ?? entry.urgeIntensity);
    case 'smoking': return finiteNumber(entry.smokeUrgeIntensity);
    case 'alcohol': return finiteNumber(entry.alcoholUrgeIntensity);
    case 'drugs': return finiteNumber(entry.drugUrgeIntensity);
    case 'gaming': return finiteNumber(entry.gamingUrgeIntensity);
    case 'online_shopping': return finiteNumber(entry.shopUrgeIntensity);
    default: return finiteNumber(entry.urgeIntensity);
  }
}

function journalTriggers(entry: JournalEntry, track: AddictionType): unknown[] {
  const common: unknown[] = [entry.trigger];
  switch (track) {
    case 'gambling': return [...common, entry.whyGambled];
    case 'pornography': return [...common, ...(entry.triggersEncountered ?? []), entry.relapseTrigger];
    case 'social_media': return [
      ...common,
      ...(entry.socialTriggersEncountered ?? []),
      ...(entry.triggersEncountered ?? []),
      entry.bingeTrigger,
    ];
    case 'smoking': return [...common, entry.smokeTrigger];
    case 'alcohol': return [...common, ...(entry.triggersEncountered ?? []), entry.drankTrigger];
    case 'drugs': return [...common, entry.drugTrigger];
    case 'gaming': return [...common, entry.gamingTrigger];
    case 'online_shopping': return [...common, entry.shopTrigger];
    default: return common;
  }
}

function urgeTriggers(urge: UrgeLog): unknown[] {
  return [urge.trigger, ...(urge.triggers ?? [])];
}

/**
 * Old addJournal versions wrote a resisted urge within the same synchronous
 * transaction. Proximity to a real journal is the only reliable discriminator
 * when the generated row used a real trigger instead of "Daily journal".
 */
function isLegacyJournalLinkedUrge(
  urge: PatternUrgeLog,
  journals: readonly PatternJournalEntry[],
): boolean {
  if (!urge.resisted) return false;
  return journals.some((journal) =>
    Math.abs(journal.at - urge.at) <= LEGACY_JOURNAL_LINK_WINDOW_MS,
  );
}

/** Detect explicit and legacy synthetic urge rows without deleting old data. */
export function isSyntheticInsightUrge(
  urge: PatternUrgeLog,
  realJournals: readonly PatternJournalEntry[] = [],
): boolean {
  if (urge.synthetic === true || urge.isSynthetic === true) return true;
  if (hasExplicitManualSource(urge)) return false;
  if (hasExplicitSyntheticSource(urge)) return true;
  if (sourceTokens(urge).some((source) => JOURNAL_DERIVED_URGE_SOURCE_TOKENS.has(source))) {
    return true;
  }
  const hasDailyJournalSentinel = [urge.trigger, ...(urge.triggers ?? [])]
    .some((trigger) => normalizedToken(trigger) === 'daily_journal');
  return hasDailyJournalSentinel || isLegacyJournalLinkedUrge(urge, realJournals);
}

function toDailyInsightSample(sample: MutableDailySample): DailyInsightSample {
  const source: DailyInsightSource = sample.journalCompleted && sample.manualUrgeCount > 0
    ? 'combined'
    : sample.journalCompleted
      ? 'journal'
      : sample.manualUrgeCount > 0
        ? 'manual_urge'
        : 'legacy_checkin';
  return {
    track: sample.track,
    localDateKey: sample.localDateKey,
    ...(sample.mood == null ? {} : { mood: sample.mood }),
    ...(sample.urgePeak == null ? {} : { urgePeak: sample.urgePeak }),
    triggerIds: [...sample.triggerIds.values()],
    journalCompleted: sample.journalCompleted,
    manualUrgeCount: sample.manualUrgeCount,
    source,
  };
}

/**
 * Project current journal/urge data plus legacy check-ins into one sample per
 * track/local day. Legacy check-ins fill only dates that have no primary data.
 */
export function projectDailyInsightSamples({
  track,
  journal = [],
  urges = [],
  checkIns = [],
}: PatternInsightProjectionInput): DailyInsightSample[] {
  const primary = new Map<string, MutableDailySample>();
  const realJournals = journal.filter((entry) =>
    belongsToTrack(entry, track)
    && journalEntryMatches(entry, track)
    && !isSyntheticInsightJournal(entry, track),
  );

  for (const entry of realJournals) {
    const sample = sampleFor(primary, track, entry.at);
    if (!sample) continue;
    sample.journalCompleted = true;
    updateMood(sample, entry.mood, entry.at);
    updateUrgePeak(sample, journalUrge(entry, track));
    addTriggers(sample, journalTriggers(entry, track));
  }

  for (const urge of urges) {
    if (!belongsToTrack(urge, track) || isSyntheticInsightUrge(urge, realJournals)) continue;
    const sample = sampleFor(primary, track, urge.at);
    if (!sample) continue;
    sample.manualUrgeCount += 1;
    updateMood(sample, urge.mood, urge.at);
    updateUrgePeak(sample, urge.intensity);
    addTriggers(sample, urgeTriggers(urge));
  }

  const legacy = new Map<string, MutableDailySample>();
  for (const checkIn of checkIns) {
    if (!belongsToTrack(checkIn, track) || hasExplicitSyntheticSource(checkIn)) continue;
    const key = localDateKey(checkIn.at);
    if (key == null || primary.has(key)) continue;
    const sample = sampleFor(legacy, track, checkIn.at);
    if (!sample) continue;
    updateMood(sample, checkIn.mood, checkIn.at);
    updateUrgePeak(sample, checkIn.urgeStrength);
    addTriggers(sample, checkIn.triggers ?? []);
  }

  return [...primary.values(), ...legacy.values()]
    .sort((a, b) => a.localDateOrdinal - b.localDateOrdinal)
    .map(toDailyInsightSample);
}

function isQualifyingInsightSample(sample: DailyInsightSample): boolean {
  return sample.journalCompleted
    || sample.manualUrgeCount > 0
    || sample.source === 'legacy_checkin';
}

/** Count distinct valid local calendar dates for one track. */
export function distinctInsightDayCount(
  samples: readonly DailyInsightSample[],
  track: AddictionType,
): number {
  const dates = new Set<number>();
  for (const sample of samples) {
    if (sample.track !== track || !isQualifyingInsightSample(sample)) continue;
    const ordinal = localDateOrdinalFromKey(sample.localDateKey);
    if (ordinal != null) dates.add(ordinal);
  }
  return dates.size;
}

export function patternInsightUnlockProgress(
  samples: readonly DailyInsightSample[],
  track: AddictionType,
  requiredDays = DEFAULT_PATTERN_INSIGHT_UNLOCK_DAYS,
): PatternInsightUnlockProgress {
  const safeRequiredDays = Number.isFinite(requiredDays)
    ? Math.max(1, Math.floor(requiredDays))
    : DEFAULT_PATTERN_INSIGHT_UNLOCK_DAYS;
  const qualifyingDays = distinctInsightDayCount(samples, track);
  return {
    qualifyingDays,
    requiredDays: safeRequiredDays,
    remainingDays: Math.max(0, safeRequiredDays - qualifyingDays),
    unlocked: qualifyingDays >= safeRequiredDays,
  };
}

export function hasUnlockedPatternInsights(
  samples: readonly DailyInsightSample[],
  track: AddictionType,
  requiredDays = DEFAULT_PATTERN_INSIGHT_UNLOCK_DAYS,
): boolean {
  return patternInsightUnlockProgress(samples, track, requiredDays).unlocked;
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function averageInsightMood(samples: readonly DailyInsightSample[]): number | null {
  return average(samples.flatMap((sample) => sample.mood == null ? [] : [sample.mood]));
}

export function averageInsightUrgePeak(samples: readonly DailyInsightSample[]): number | null {
  return average(samples.flatMap((sample) => sample.urgePeak == null ? [] : [sample.urgePeak]));
}

export function topInsightTriggers(
  samples: readonly DailyInsightSample[],
  limit = 3,
): InsightTriggerCount[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const sample of samples) {
    const seenThisDay = new Set<string>();
    for (const rawTrigger of sample.triggerIds) {
      const trigger = normalizeTrigger(rawTrigger);
      if (!trigger) continue;
      const identity = trigger.toLowerCase();
      if (seenThisDay.has(identity)) continue;
      seenThisDay.add(identity);
      const existing = counts.get(identity);
      if (existing) existing.count += 1;
      else counts.set(identity, { tag: trigger, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(0, Math.floor(limit)));
}

/** Compare the previous three mood-bearing days with the latest three. */
export function insightMoodTrend(samples: readonly DailyInsightSample[]): InsightTrend {
  const moods = [...samples]
    .sort((a, b) =>
      (localDateOrdinalFromKey(a.localDateKey) ?? 0)
      - (localDateOrdinalFromKey(b.localDateKey) ?? 0),
    )
    .flatMap((sample) => sample.mood == null ? [] : [sample.mood])
    .slice(-6);
  if (moods.length < 6) return 'stable';
  const previousAverage = average(moods.slice(0, 3)) ?? 0;
  const latestAverage = average(moods.slice(3)) ?? 0;
  const difference = latestAverage - previousAverage;
  if (difference >= 0.5) return 'improving';
  if (difference <= -0.5) return 'declining';
  return 'stable';
}
