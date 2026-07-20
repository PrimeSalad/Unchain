import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRecoverySetupSubmission,
  createRecoveryTrackDraft,
  finalizeRecoveryTrackDraft,
  isLocalMidnight,
  localMidnightDaysAgo,
  normalizeRecoveryTrackDraft,
  recoveryProfilesFromSubmission,
  recoverySetupStepsForTracks,
  recoveryTrackSetupSteps,
  toLocalMidnight,
  validateRecoveryTrackDraft,
  validateRecoveryTrackSetup,
} from '../.test-build/recoveryTrackSetup.js';

const NOW = new Date(2026, 6, 20, 15, 45, 12, 123).getTime();
const ADDICTION_TYPES = [
  'gambling',
  'pornography',
  'social_media',
  'online_shopping',
  'smoking',
  'alcohol',
  'drugs',
  'gaming',
  'other',
];

function codes(issues) {
  return issues.map((item) => item.code);
}

function validDraft(type, patch = {}) {
  const draft = createRecoveryTrackDraft(type, { now: NOW, currency: '₱' });
  const detailRequired = !['pornography', 'drugs'].includes(type);
  return {
    ...draft,
    ...(detailRequired ? { addictionDetail: `${type} detail` } : {}),
    ...(['social_media', 'gaming'].includes(type) ? { timeBaselineMinutes: 120 } : {}),
    reason: `My ${type} recovery matters`,
    ...patch,
  };
}

function completeTrack(type, patch = {}, completedAt = NOW) {
  const result = finalizeRecoveryTrackDraft(validDraft(type, patch), completedAt);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.issues));
  return result.value;
}

test('stable step IDs are category-qualified and conditional per track', () => {
  const gambling = recoveryTrackSetupSteps('gambling');
  const pornography = recoveryTrackSetupSteps('pornography');
  const social = recoveryTrackSetupSteps('social_media');
  const gaming = recoveryTrackSetupSteps('gaming');
  const other = recoveryTrackSetupSteps('other');

  assert.deepEqual(gambling.map((step) => step.id), [
    'gambling:detail',
    'gambling:goal_mode',
    'gambling:started_at',
    'gambling:expense',
    'gambling:triggers',
    'gambling:reason',
    'gambling:review',
  ]);
  assert.equal(pornography.some((step) => step.key === 'expense'), false);
  assert.equal(pornography.find((step) => step.key === 'detail').required, false);
  assert.equal(social.some((step) => step.key === 'expense'), false);
  assert.equal(social.find((step) => step.key === 'time_baseline').required, true);
  assert.equal(gaming.some((step) => step.key === 'expense'), true);
  assert.equal(gaming.some((step) => step.key === 'time_baseline'), true);
  assert.equal(other.find((step) => step.key === 'time_baseline').required, false);
  assert.equal(new Set(gaming.map((step) => step.id)).size, gaming.length);
});

test('multi-track step graphs include every category in either selection order', () => {
  const pornThenGambling = recoverySetupStepsForTracks(['pornography', 'gambling']);
  const gamblingThenPorn = recoverySetupStepsForTracks(['gambling', 'pornography']);
  assert.equal(pornThenGambling[0].id, 'pornography:detail');
  assert.equal(pornThenGambling.at(-1).id, 'gambling:review');
  assert.equal(pornThenGambling.some((step) => step.id === 'gambling:expense'), true);
  assert.equal(gamblingThenPorn[0].id, 'gambling:detail');
  assert.equal(gamblingThenPorn.at(-1).id, 'pornography:review');
  assert.equal(gamblingThenPorn.some((step) => step.id === 'gambling:expense'), true);

  const threeTracks = recoverySetupStepsForTracks(['social_media', 'smoking', 'other']);
  for (const type of ['social_media', 'smoking', 'other']) {
    assert.equal(threeTracks.some((step) => step.id === `${type}:review`), true);
  }
  assert.equal(threeTracks.some((step) => step.id === 'social_media:time_baseline'), true);
  assert.equal(threeTracks.some((step) => step.id === 'smoking:expense'), true);
  assert.equal(threeTracks.some((step) => step.id === 'other:time_baseline'), true);
});

test('all nine categories generate a complete stable graph and can finalize independently', () => {
  for (const addictionType of ADDICTION_TYPES) {
    const steps = recoveryTrackSetupSteps(addictionType);
    assert.equal(steps.length > 0, true);
    assert.equal(steps.every((step) => step.id.startsWith(`${addictionType}:`)), true);
    assert.equal(steps.at(-1).id, `${addictionType}:review`);
    const result = finalizeRecoveryTrackDraft(validDraft(addictionType), NOW);
    assert.equal(result.ok, true, `${addictionType}: ${result.ok ? '' : JSON.stringify(result.issues)}`);
    assert.equal(result.value.addictionType, addictionType);
  }
});

test('local-midnight helpers use calendar dates instead of fixed 24-hour subtraction', () => {
  const midnight = toLocalMidnight(NOW);
  assert.equal(isLocalMidnight(midnight), true);
  const threeDaysAgo = localMidnightDaysAgo(3, NOW);
  const expected = new Date(2026, 6, 17, 0, 0, 0, 0);
  assert.equal(threeDaysAgo, expected.getTime());
  assert.equal(isLocalMidnight(threeDaysAgo), true);
  assert.equal(isLocalMidnight(NOW), false);
  assert.throws(() => localMidnightDaysAgo(-1, NOW), RangeError);
  assert.throws(() => localMidnightDaysAgo(1.5, NOW), RangeError);
  assert.throws(() => toLocalMidnight(Number.NaN), RangeError);
});

test('draft factory creates isolated per-category state and applicable baselines', () => {
  const gambling = createRecoveryTrackDraft('gambling', { now: NOW, currency: '$' });
  const pornography = createRecoveryTrackDraft('pornography', { now: NOW, currency: '$' });
  const secondGambling = createRecoveryTrackDraft('gambling', { now: NOW, currency: '$' });

  assert.deepEqual(gambling.expense, { amount: 0, period: 'weekly', currency: '$' });
  assert.equal(pornography.expense, undefined);
  gambling.triggers.push('Stress');
  gambling.expense.amount = 250;
  assert.deepEqual(secondGambling.triggers, []);
  assert.equal(secondGambling.expense.amount, 0);
});

test('validation follows current category requirements without treating zero or empty triggers as incomplete', () => {
  const gambling = validDraft('gambling', { triggers: [], expense: { amount: 0, period: 'weekly', currency: '₱' } });
  assert.deepEqual(validateRecoveryTrackDraft(gambling, NOW), []);

  const porn = validDraft('pornography');
  assert.deepEqual(validateRecoveryTrackDraft(porn, NOW), []);

  const invalidSocial = validDraft('social_media', {
    addictionDetail: 'TikTok',
    timeBaselineMinutes: undefined,
    expense: { amount: 10, period: 'daily', currency: '₱' },
  });
  const invalidCodes = codes(validateRecoveryTrackDraft(invalidSocial, NOW));
  assert.equal(invalidCodes.includes('time_baseline_required'), true);
  assert.equal(invalidCodes.includes('expense_not_applicable'), true);
});

test('validation rejects missing detail/reason, non-midnight starts, and future dates', () => {
  const tomorrow = new Date(2026, 6, 21, 0, 0, 0, 0).getTime();
  const issues = validateRecoveryTrackDraft(validDraft('smoking', {
    addictionDetail: '   ',
    reason: ' ',
    startedAtLocalMidnight: tomorrow,
  }), NOW);
  assert.deepEqual(
    new Set(codes(issues)),
    new Set(['detail_required', 'started_at_in_future', 'reason_required']),
  );

  const notMidnight = validateRecoveryTrackDraft(validDraft('drugs', {
    startedAtLocalMidnight: NOW,
  }), NOW);
  assert.equal(codes(notMidnight).includes('started_at_not_local_midnight'), true);
});

test('normalization trims text and de-duplicates triggers without sharing arrays', () => {
  const normalized = normalizeRecoveryTrackDraft(validDraft('drugs', {
    addictionDetail: '  optional detail  ',
    reason: '  a clear reason  ',
    triggers: [' Stress ', 'Stress', '', 'Boredom'],
  }));
  assert.equal(normalized.addictionDetail, 'optional detail');
  assert.equal(normalized.reason, 'a clear reason');
  assert.deepEqual(normalized.triggers, ['Stress', 'Boredom']);
});

test('finalization adds explicit version/status/completion only after validation', () => {
  const complete = finalizeRecoveryTrackDraft(validDraft('alcohol'), NOW);
  assert.equal(complete.ok, true);
  assert.equal(complete.value.setupVersion, 1);
  assert.equal(complete.value.setupStatus, 'complete');
  assert.equal(complete.value.setupCompletedAt, NOW);
  assert.deepEqual(validateRecoveryTrackSetup(complete.value, NOW), []);

  const incomplete = finalizeRecoveryTrackDraft(validDraft('gaming', { reason: '' }), NOW);
  assert.equal(incomplete.ok, false);
  assert.equal(codes(incomplete.issues).includes('reason_required'), true);

  for (const invalidCompletedAt of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.doesNotThrow(() => finalizeRecoveryTrackDraft(validDraft('alcohol'), invalidCompletedAt));
    const invalid = finalizeRecoveryTrackDraft(validDraft('alcohol'), invalidCompletedAt);
    assert.equal(invalid.ok, false);
    assert.equal(codes(invalid.issues).includes('setup_completion_time_invalid'), true);
  }
});

test('atomic submission validates exact selected membership and converts independent legacy profiles', () => {
  const gambling = completeTrack('gambling', {
    addictionDetail: 'Sports betting',
    expense: { amount: 700, period: 'weekly', currency: '₱' },
    triggers: ['Payday'],
    reason: 'Protect my finances',
  });
  const pornography = completeTrack('pornography', {
    addictionDetail: 'Private note',
    triggers: ['Stress'],
    reason: 'Protect my attention',
  });
  const result = createRecoverySetupSubmission({
    account: { name: '  Friend  ', age: 24 },
    activeTrack: 'pornography',
    trackOrder: ['pornography', 'gambling'],
    tracks: { pornography, gambling },
  }, NOW);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.issues));
  assert.equal(result.value.account.name, 'Friend');

  const converted = recoveryProfilesFromSubmission(result.value);
  assert.equal(converted.activeProfile.addictionType, 'pornography');
  assert.deepEqual(converted.activeProfile.selectedAddictions, ['pornography', 'gambling']);
  assert.equal(converted.profiles.gambling.expenseAmount, 700);
  assert.equal(converted.profiles.gambling.addictionDetail, 'Sports betting');
  assert.deepEqual(converted.profiles.gambling.triggers, ['Payday']);
  assert.equal(converted.profiles.pornography.expenseAmount, 0);
  assert.equal(converted.profiles.pornography.addictionDetail, 'Private note');
  assert.deepEqual(converted.profiles.pornography.triggers, ['Stress']);

  converted.profiles.gambling.triggers.push('Boredom');
  assert.deepEqual(converted.profiles.pornography.triggers, ['Stress']);
});

test('atomic submission rejects missing active membership, missing tracks, extras, and unconfirmed setup', () => {
  const gambling = completeTrack('gambling');
  const draftStatus = { ...completeTrack('pornography'), setupStatus: 'draft', setupCompletedAt: undefined };
  const result = createRecoverySetupSubmission({
    account: { name: 'Friend' },
    activeTrack: 'alcohol',
    trackOrder: ['gambling', 'pornography'],
    tracks: {
      gambling,
      pornography: draftStatus,
      smoking: completeTrack('smoking'),
      not_real: gambling,
    },
  }, NOW);
  assert.equal(result.ok, false);
  const resultCodes = codes(result.issues);
  assert.equal(resultCodes.includes('active_track_missing'), true);
  assert.equal(resultCodes.includes('track_not_complete'), true);
  assert.equal(resultCodes.includes('track_not_selected'), true);
  assert.equal(resultCodes.includes('unknown_addiction'), true);

  const missing = createRecoverySetupSubmission({
    account: { name: 'Friend' },
    activeTrack: 'gambling',
    trackOrder: ['gambling', 'alcohol'],
    tracks: { gambling },
  }, NOW);
  assert.equal(missing.ok, false);
  assert.equal(codes(missing.issues).includes('track_missing'), true);
});
