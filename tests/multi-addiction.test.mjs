import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADDICTION_JOURNAL_CONFIGS,
  completedAddictionCount,
  isDailyJournalComplete,
  journalCompletedToday,
  journalConfig,
  journalEntryMatches,
  journalEntryOutcome,
  journalStatsForAddiction,
  nextIncompleteAddiction,
} from '../.test-build/addictionJournal.js';
import { normalizeSelectedAddictions } from '../.test-build/multiAddiction.js';

const TODAY = new Date(2026, 6, 19, 12).getTime();
const YESTERDAY = new Date(2026, 6, 18, 12).getTime();

function entry(id, fields, at = TODAY) {
  return { id, at, text: '', ...fields };
}

test('legacy profiles normalize to a non-empty single selection', () => {
  assert.deepEqual(normalizeSelectedAddictions('gambling'), ['gambling']);
  assert.deepEqual(normalizeSelectedAddictions('pornography', []), ['pornography']);
});

test('normalization de-duplicates selections and retains the active addiction first when missing', () => {
  assert.deepEqual(
    normalizeSelectedAddictions('gambling', ['pornography', 'gambling', 'pornography']),
    ['pornography', 'gambling'],
  );
  assert.deepEqual(
    normalizeSelectedAddictions('smoking', ['alcohol', 'gaming']),
    ['smoking', 'alcohol', 'gaming'],
  );
});

test('every dedicated addiction journal has the expected route, question, and isolated status field', () => {
  const expected = {
    gambling: ['/journal-entry', 'gambled', 'Did you gamble today?'],
    pornography: ['/porn-journal-entry', 'watched', 'Did you watch pornography today?'],
    social_media: ['/social-journal-entry', 'binged', 'Did you binge social media today?'],
    online_shopping: ['/online-shopping-journal-entry', 'shopped', 'Did you shop online today?'],
    smoking: ['/smoke-journal-entry', 'smoked', 'Did you smoke today?'],
    alcohol: ['/alcohol-journal-entry', 'drank', 'Did you drink alcohol today?'],
    drugs: ['/drug-journal-entry', 'used', 'Did you use substances today?'],
    gaming: ['/game-journal-entry', 'played', 'Did you play games compulsively today?'],
    other: ['/journal-entry', 'otherActed', 'Did you return to the habit today?'],
  };

  const statusFields = [];
  for (const [addictionType, [route, statusField, primaryQuestion]] of Object.entries(expected)) {
    const config = journalConfig(addictionType);
    assert.equal(config.addictionType, addictionType);
    assert.equal(config.route, route);
    assert.equal(config.statusField, statusField);
    assert.equal(config.primaryQuestion, primaryQuestion);
    statusFields.push(statusField);
  }
  assert.equal(new Set(statusFields).size, statusFields.length);
  assert.equal(Object.keys(ADDICTION_JOURNAL_CONFIGS).length, Object.keys(expected).length);
});

test('an entry only completes the section represented by its status field', () => {
  const gambling = entry('g', { gambled: false });
  const porn = entry('p', { watched: false });

  assert.equal(journalEntryMatches(gambling, 'gambling'), true);
  assert.equal(journalEntryMatches(gambling, 'pornography'), false);
  assert.equal(journalEntryMatches(porn, 'pornography'), true);
  assert.equal(journalEntryMatches(porn, 'gambling'), false);
});

test('active journal summaries use only the configured addiction field', () => {
  const journal = [
    entry('g1', { gambled: false, mood: 4 }),
    entry('g2', { gambled: true, mood: 2 }),
    entry('p1', { watched: false, mood: 5 }),
  ];

  assert.equal(journalEntryOutcome(journal[0], 'gambling'), false);
  assert.equal(journalEntryOutcome(journal[0], 'pornography'), undefined);
  assert.deepEqual(journalStatsForAddiction(journal, 'gambling'), {
    total: 2,
    cleanDays: 1,
    relapseDays: 1,
    averageMood: 3,
  });
  assert.deepEqual(journalStatsForAddiction(journal, 'pornography'), {
    total: 1,
    cleanDays: 1,
    relapseDays: 0,
    averageMood: 5,
  });
});

test('all selected sections are required before the daily journal is complete', () => {
  const selected = ['gambling', 'pornography', 'gaming'];
  const partial = [
    entry('g', { gambled: false }),
    entry('p', { watched: true }),
  ];

  assert.equal(completedAddictionCount(partial, selected, TODAY), 2);
  assert.equal(isDailyJournalComplete(partial, selected, TODAY), false);
  assert.equal(nextIncompleteAddiction(partial, selected, TODAY), 'gaming');

  const complete = [...partial, entry('v', { played: false })];
  assert.equal(completedAddictionCount(complete, selected, TODAY), 3);
  assert.equal(isDailyJournalComplete(complete, selected, TODAY), true);
  assert.equal(nextIncompleteAddiction(complete, selected, TODAY), undefined);
});

test('next incomplete follows selection order and ignores duplicate selections', () => {
  const selected = ['gaming', 'pornography', 'gaming', 'gambling'];
  const journal = [entry('p', { watched: false })];

  assert.equal(nextIncompleteAddiction(journal, selected, TODAY), 'gaming');
  assert.equal(completedAddictionCount(journal, selected, TODAY), 1);

  journal.push(entry('v', { played: false }));
  assert.equal(nextIncompleteAddiction(journal, selected, TODAY), 'gambling');
});

test('entries from another calendar day do not complete today', () => {
  const journal = [entry('old', { drank: false }, YESTERDAY)];
  assert.equal(journalCompletedToday(journal, 'alcohol', TODAY), false);
  assert.equal(isDailyJournalComplete(journal, ['alcohol'], TODAY), false);
});

test('single-selection users retain the original one-section behavior', () => {
  const selected = normalizeSelectedAddictions('smoking');
  assert.equal(nextIncompleteAddiction([], selected, TODAY), 'smoking');
  assert.equal(isDailyJournalComplete([], selected, TODAY), false);

  const journal = [entry('s', { smoked: false })];
  assert.equal(completedAddictionCount(journal, selected, TODAY), 1);
  assert.equal(isDailyJournalComplete(journal, selected, TODAY), true);
  assert.equal(nextIncompleteAddiction(journal, selected, TODAY), undefined);
});

test('an empty invalid selection is never reported as complete', () => {
  assert.equal(completedAddictionCount([], [], TODAY), 0);
  assert.equal(isDailyJournalComplete([], [], TODAY), false);
  assert.equal(nextIncompleteAddiction([], [], TODAY), undefined);
});
