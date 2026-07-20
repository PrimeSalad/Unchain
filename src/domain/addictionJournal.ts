import type { AddictionType } from './gambling';
import type { JournalEntry } from './records';

export type JournalStatusField =
  | 'gambled'
  | 'watched'
  | 'binged'
  | 'shopped'
  | 'smoked'
  | 'drank'
  | 'used'
  | 'played'
  | 'otherActed';

export interface AddictionJournalConfig {
  addictionType: AddictionType;
  route: string;
  primaryQuestion: string;
  statusField: JournalStatusField;
}

export const ADDICTION_JOURNAL_CONFIGS: Record<AddictionType, AddictionJournalConfig> = {
  gambling: { addictionType: 'gambling', route: '/journal-entry', statusField: 'gambled', primaryQuestion: 'Did you gamble today?' },
  pornography: { addictionType: 'pornography', route: '/porn-journal-entry', statusField: 'watched', primaryQuestion: 'Did you watch pornography today?' },
  social_media: { addictionType: 'social_media', route: '/social-journal-entry', statusField: 'binged', primaryQuestion: 'Did you binge social media today?' },
  online_shopping: { addictionType: 'online_shopping', route: '/online-shopping-journal-entry', statusField: 'shopped', primaryQuestion: 'Did you shop online today?' },
  smoking: { addictionType: 'smoking', route: '/smoke-journal-entry', statusField: 'smoked', primaryQuestion: 'Did you smoke today?' },
  alcohol: { addictionType: 'alcohol', route: '/alcohol-journal-entry', statusField: 'drank', primaryQuestion: 'Did you drink alcohol today?' },
  drugs: { addictionType: 'drugs', route: '/drug-journal-entry', statusField: 'used', primaryQuestion: 'Did you use substances today?' },
  gaming: { addictionType: 'gaming', route: '/game-journal-entry', statusField: 'played', primaryQuestion: 'Did you play games compulsively today?' },
  other: { addictionType: 'other', route: '/journal-entry', statusField: 'otherActed', primaryQuestion: 'Did you return to the habit today?' },
};

export function journalConfig(addictionType: AddictionType): AddictionJournalConfig {
  return ADDICTION_JOURNAL_CONFIGS[addictionType];
}

/** A journal session belongs only to the recovery track active when it starts. */
export function dailyJournalAddictions(activeAddiction: AddictionType): [AddictionType] {
  return [activeAddiction];
}

export function journalEntryMatches(entry: JournalEntry, addictionType: AddictionType): boolean {
  return entry[journalConfig(addictionType).statusField] !== undefined;
}

/** The active addiction's outcome, without hard-coding a particular journal field. */
export function journalEntryOutcome(
  entry: JournalEntry,
  addictionType: AddictionType,
): boolean | undefined {
  return entry[journalConfig(addictionType).statusField] as boolean | undefined;
}

/** Summary derived only from entries belonging to the requested addiction. */
export function journalStatsForAddiction(
  journal: readonly JournalEntry[],
  addictionType: AddictionType,
) {
  const entries = journal.filter((entry) => journalEntryMatches(entry, addictionType));
  const moods = entries.flatMap((entry) => entry.mood == null ? [] : [entry.mood]);
  return {
    total: entries.length,
    cleanDays: entries.filter((entry) => journalEntryOutcome(entry, addictionType) === false).length,
    relapseDays: entries.filter((entry) => journalEntryOutcome(entry, addictionType) === true).length,
    averageMood: moods.length === 0
      ? null
      : Math.round((moods.reduce((sum, mood) => sum + mood, 0) / moods.length) * 10) / 10,
  };
}

export function journalCompletedToday(
  journal: readonly JournalEntry[],
  addictionType: AddictionType,
  now = Date.now(),
): boolean {
  const today = new Date(now);
  return journal.some((entry) => {
    const at = new Date(entry.at);
    return at.getFullYear() === today.getFullYear()
      && at.getMonth() === today.getMonth()
      && at.getDate() === today.getDate()
      && journalEntryMatches(entry, addictionType);
  });
}

/** Number of distinct selected addiction sections completed on the given day. */
export function completedAddictionCount(
  journal: readonly JournalEntry[],
  selected: readonly AddictionType[],
  now = Date.now(),
): number {
  return Array.from(new Set(selected)).filter((addictionType) =>
    journalCompletedToday(journal, addictionType, now),
  ).length;
}

/** A daily journal is complete only after every selected section is complete. */
export function isDailyJournalComplete(
  journal: readonly JournalEntry[],
  selected: readonly AddictionType[],
  now = Date.now(),
): boolean {
  const uniqueSelected = Array.from(new Set(selected));
  return uniqueSelected.length > 0
    && uniqueSelected.every((addictionType) => journalCompletedToday(journal, addictionType, now));
}

/** First incomplete section, preserving the user's selected-addiction order. */
export function nextIncompleteAddiction(
  journal: readonly JournalEntry[],
  selected: readonly AddictionType[],
  now = Date.now(),
): AddictionType | undefined {
  return Array.from(new Set(selected)).find(
    (addictionType) => !journalCompletedToday(journal, addictionType, now),
  );
}
