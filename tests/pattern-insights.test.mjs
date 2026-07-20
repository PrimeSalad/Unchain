import assert from 'node:assert/strict';
import test from 'node:test';

import {
  averageInsightMood,
  averageInsightUrgePeak,
  distinctInsightDayCount,
  hasUnlockedPatternInsights,
  insightMoodTrend,
  localDateKey,
  localDateOrdinal,
  patternInsightUnlockProgress,
  projectDailyInsightSamples,
  topInsightTriggers,
} from '../.test-build/patternInsights.js';

// Exercise the spring-forward boundary even when the developer machine is in
// a timezone without daylight-saving transitions.
process.env.TZ = 'America/New_York';

function localAt(year, month, day, hour = 12, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function journal(id, at, fields = {}) {
  return { id, at, text: 'A real journal entry', gambled: false, ...fields };
}

function urge(id, at, fields = {}) {
  return { id, at, intensity: 5, resisted: true, ...fields };
}

function checkIn(id, at, fields = {}) {
  return { id, at, gambled: false, ...fields };
}

test('local date helpers use calendar ordinals rather than elapsed local-midnight time', () => {
  const beforeDst = localAt(2024, 3, 10, 0);
  const afterDst = localAt(2024, 3, 11, 0);
  assert.equal(localDateKey(beforeDst), '2024-03-10');
  assert.equal(afterDst - beforeDst, 23 * 60 * 60 * 1_000);
  assert.equal(localDateOrdinal(afterDst) - localDateOrdinal(beforeDst), 1);
});

test('journal-only data projects by track while legacy recovery seed rows are excluded', () => {
  const day1 = localAt(2026, 1, 2);
  const day2 = localAt(2026, 1, 3);
  const seeded = {
    id: 'seed',
    at: localAt(2026, 1, 1),
    text: 'Clean day.',
    gambled: false,
  };
  const samples = projectDailyInsightSamples({
    track: 'gambling',
    journal: [
      seeded,
      journal('j1', day1, { mood: 4, whyGambled: 'Stress' }),
      journal('j2', day2, { mood: 8 }),
      { id: 'porn', at: day2, text: 'Porn entry', watched: false, mood: 2 },
    ],
  });

  assert.deepEqual(samples, [
    {
      track: 'gambling',
      localDateKey: '2026-01-02',
      mood: 4,
      triggerIds: ['Stress'],
      journalCompleted: true,
      manualUrgeCount: 0,
      source: 'journal',
    },
    {
      track: 'gambling',
      localDateKey: '2026-01-03',
      mood: 8,
      triggerIds: [],
      journalCompleted: true,
      manualUrgeCount: 0,
      source: 'journal',
    },
  ]);
  assert.equal(hasUnlockedPatternInsights(samples, 'gambling'), true);
});

test('manual urges qualify, while old Daily journal and explicitly synthetic urges do not', () => {
  const at = localAt(2026, 2, 4);
  const samples = projectDailyInsightSamples({
    track: 'gaming',
    urges: [
      urge('manual', at, { intensity: 7, mood: 3, trigger: 'Boredom' }),
      urge('sentinel', at + 1, { intensity: 1, trigger: 'Daily journal' }),
      urge('tagged', at + 2, { intensity: 10, trigger: 'Stress', source: 'synthetic' }),
      urge('journal-source', at + 3, { intensity: 9, trigger: 'Loneliness', source: 'journal' }),
    ],
  });

  assert.equal(samples.length, 1);
  assert.equal(samples[0].source, 'manual_urge');
  assert.equal(samples[0].manualUrgeCount, 1);
  assert.equal(samples[0].urgePeak, 7);
  assert.deepEqual(samples[0].triggerIds, ['Boredom']);
});

test('journal and manual urge activity on the same date combine into one richer sample', () => {
  const at = localAt(2026, 3, 5, 9);
  const samples = projectDailyInsightSamples({
    track: 'pornography',
    journal: [{
      id: 'journal',
      at,
      text: 'Stayed honest today',
      watched: false,
      mood: 5,
      urgeIntensity: 4,
      triggersEncountered: ['Stress'],
    }],
    urges: [urge('urge', at + 60_000, {
      source: 'manual_urge',
      intensity: 8,
      mood: 6,
      triggers: ['Stress', 'Loneliness'],
    })],
  });

  assert.equal(samples.length, 1);
  assert.deepEqual(samples[0], {
    track: 'pornography',
    localDateKey: '2026-03-05',
    mood: 6,
    urgePeak: 8,
    triggerIds: ['Stress', 'Loneliness'],
    journalCompleted: true,
    manualUrgeCount: 1,
    source: 'combined',
  });
});

test('legacy journal-linked urge rows with real-looking triggers are not counted as manual', () => {
  const at = localAt(2026, 4, 6, 20);
  const samples = projectDailyInsightSamples({
    track: 'alcohol',
    journal: [{
      id: 'journal',
      at,
      text: 'I stayed alcohol-free',
      drank: false,
      mood: 7,
      alcoholUrgeIntensity: 3,
      triggersEncountered: ['After work'],
    }],
    urges: [
      urge('generated', at + 3, { intensity: 3, trigger: 'After work' }),
      urge('explicit-manual', at + 4, { intensity: 7, trigger: 'Loneliness', source: 'manual' }),
      urge('manual', at + 60_000, { intensity: 6, trigger: 'Social pressure' }),
    ],
  });

  assert.equal(samples.length, 1);
  assert.equal(samples[0].manualUrgeCount, 2);
  assert.equal(samples[0].source, 'combined');
  assert.equal(samples[0].urgePeak, 7);
  assert.deepEqual(samples[0].triggerIds, ['After work', 'Loneliness', 'Social pressure']);
});

test('same-day duplicates enrich one day and cannot unlock until a second date exists', () => {
  const day1 = localAt(2026, 5, 1);
  const firstDayOnly = projectDailyInsightSamples({
    track: 'smoking',
    urges: [
      urge('u1', day1, { intensity: 3, trigger: 'Coffee' }),
      urge('u2', day1 + 3_600_000, { intensity: 8, trigger: 'Stress' }),
    ],
  });
  assert.equal(firstDayOnly.length, 1);
  assert.equal(firstDayOnly[0].manualUrgeCount, 2);
  assert.equal(firstDayOnly[0].urgePeak, 8);
  assert.equal(distinctInsightDayCount(firstDayOnly, 'smoking'), 1);
  assert.equal(hasUnlockedPatternInsights(firstDayOnly, 'smoking'), false);

  const twoDays = projectDailyInsightSamples({
    track: 'smoking',
    urges: [
      urge('u1', day1, { intensity: 3 }),
      urge('u2', day1 + 3_600_000, { intensity: 8 }),
      urge('u3', localAt(2026, 5, 2), { intensity: 4 }),
    ],
  });
  assert.deepEqual(patternInsightUnlockProgress(twoDays, 'smoking'), {
    qualifyingDays: 2,
    requiredDays: 2,
    remainingDays: 0,
    unlocked: true,
  });
});

test('legacy check-ins fill missing dates but never override a primary sample on that date', () => {
  const primaryDay = localAt(2026, 6, 7, 9);
  const legacyDay = localAt(2026, 6, 8, 9);
  const samples = projectDailyInsightSamples({
    track: 'gambling',
    journal: [journal('journal', primaryDay, { mood: 8 })],
    checkIns: [
      checkIn('same-day', primaryDay + 60_000, {
        mood: 1,
        urgeStrength: 10,
        triggers: ['Should not leak'],
      }),
      checkIn('legacy-a', legacyDay, { mood: 4, urgeStrength: 3, triggers: ['Payday'] }),
      checkIn('legacy-b', legacyDay + 60_000, { mood: 6, urgeStrength: 7, triggers: ['Stress'] }),
    ],
  });

  assert.equal(samples.length, 2);
  assert.deepEqual(samples[0], {
    track: 'gambling',
    localDateKey: '2026-06-07',
    mood: 8,
    triggerIds: [],
    journalCompleted: true,
    manualUrgeCount: 0,
    source: 'journal',
  });
  assert.deepEqual(samples[1], {
    track: 'gambling',
    localDateKey: '2026-06-08',
    mood: 6,
    urgePeak: 7,
    triggerIds: ['Payday', 'Stress'],
    journalCompleted: false,
    manualUrgeCount: 0,
    source: 'legacy_checkin',
  });
});

test('explicit track tags and category journal fields keep recovery tracks isolated', () => {
  const day1 = localAt(2026, 7, 1);
  const day2 = localAt(2026, 7, 2);
  const gambling = projectDailyInsightSamples({
    track: 'gambling',
    journal: [
      journal('gambling', day1),
      { id: 'porn', at: day2, text: 'Porn only', watched: false },
    ],
    urges: [
      urge('wrong-track', day2, { addictionType: 'gaming', source: 'manual_urge' }),
    ],
  });
  assert.equal(distinctInsightDayCount(gambling, 'gambling'), 1);
  assert.equal(hasUnlockedPatternInsights(gambling, 'gambling'), false);

  const mixed = [
    ...gambling,
    {
      track: 'gaming',
      localDateKey: '2026-07-02',
      triggerIds: [],
      journalCompleted: false,
      manualUrgeCount: 1,
      source: 'manual_urge',
    },
  ];
  assert.equal(distinctInsightDayCount(mixed, 'gambling'), 1);
  assert.equal(distinctInsightDayCount(mixed, 'gaming'), 1);
});

test('pure mood, urge, trigger, and trend helpers calculate from daily samples', () => {
  const samples = [1, 2, 3, 7, 8, 9].map((mood, index) => ({
    track: 'gaming',
    localDateKey: `2026-08-0${index + 1}`,
    mood,
    urgePeak: index + 1,
    triggerIds: index < 2 ? ['Stress', 'stress'] : ['Boredom'],
    journalCompleted: false,
    manualUrgeCount: 1,
    source: 'manual_urge',
  }));

  assert.equal(averageInsightMood(samples), 5);
  assert.equal(averageInsightUrgePeak(samples), 3.5);
  assert.equal(insightMoodTrend(samples), 'improving');
  assert.deepEqual(topInsightTriggers(samples), [
    { tag: 'Boredom', count: 4 },
    { tag: 'Stress', count: 2 },
  ]);
});
