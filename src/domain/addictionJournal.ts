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

export function journalEntryMatches(entry: JournalEntry, addictionType: AddictionType): boolean {
  return entry[journalConfig(addictionType).statusField] !== undefined;
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
