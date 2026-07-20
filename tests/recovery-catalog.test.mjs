import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDICTION_TYPES, RECOVERY_TRACKS, recoveryTrack, isAddictionType, tryRecoveryTrack } from '../.test-build/domain/recoveryTracks.js';
import { RECOVERY_FEATURES, resolveRecoveryFeature } from '../.test-build/application/recoveryFeatureRegistry.js';
import { planRecoveryReminders } from '../.test-build/domain/recoveryReminderPlanner.js';

test('recovery catalog is exhaustive and every definition is complete', () => {
  assert.equal(ADDICTION_TYPES.length, 9);
  assert.deepEqual(Object.keys(RECOVERY_TRACKS).sort(), [...ADDICTION_TYPES].sort());
  for (const type of ADDICTION_TYPES) {
    const track = recoveryTrack(type);
    assert.equal(track.type, type);
    assert.ok(track.label && track.verb && track.freeLabel);
    assert.ok(track.triggers.length > 0);
    assert.ok(track.intake.length > 0);
    assert.ok(track.journal.route && track.journal.primaryQuestion && track.journal.statusField);
    assert.ok(track.heroMetric && track.flagshipFeature && track.sosAnchor.title);
    assert.ok(track.safety.summary);
    assert.ok(RECOVERY_FEATURES[track.flagshipFeature]);
  }
});

test('unknown categories never silently resolve to Gambling', () => {
  assert.equal(isAddictionType('unknown'), false);
  assert.equal(RECOVERY_TRACKS.unknown, undefined);
  assert.equal(tryRecoveryTrack('unknown'), null);
  assert.throws(() => recoveryTrack('unknown'), /Unknown recovery track/);
});

test('feature registry has unique routes or intentional shared internal route and safe gates', () => {
  const ids = Object.keys(RECOVERY_FEATURES);
  assert.equal(new Set(ids).size, ids.length);
  for (const [id, feature] of Object.entries(RECOVERY_FEATURES)) {
    assert.equal(feature.id, id);
    assert.ok(feature.route.startsWith('/'));
    assert.ok(feature.title && feature.subtitle && feature.icon);
    assert.equal(resolveRecoveryFeature(id, true)?.id, id);
    if (feature.release === 'internal') assert.equal(resolveRecoveryFeature(id, false), null);
  }
  assert.equal(resolveRecoveryFeature('not-real', true), null);
});

test('safety-sensitive tracks retain explicit boundaries', () => {
  assert.equal(RECOVERY_TRACKS.alcohol.safety.professionalHelp, true);
  assert.equal(RECOVERY_TRACKS.drugs.safety.professionalHelp, true);
  assert.ok(RECOVERY_TRACKS.pornography.capabilities.includes('discreet'));
  assert.match(RECOVERY_TRACKS.gaming.safety.summary, /never recommended/i);
});

test('reminder planner covers tracks, privacy, quiet hours, dedupe, archive, denial, and cap', () => {
  const candidates = [
    { track: 'smoking', feature: 'catch-your-breath', hour: 9, minute: 0, enabled: true },
    { track: 'smoking', feature: 'catch-your-breath', hour: 9, minute: 0, enabled: true },
    { track: 'alcohol', feature: 'cheers-to-change', hour: 23, minute: 0, enabled: true },
    { track: 'drugs', feature: 'back-on-track', hour: 10, minute: 0, enabled: true, archived: true },
    { track: 'online_shopping', feature: 'need-or-want', hour: 11, minute: 0, enabled: true },
    { track: 'other', feature: 'replacement-plan', hour: 12, minute: 0, enabled: true },
  ];
  assert.deepEqual(planRecoveryReminders(candidates, { permissionGranted: false, quietStartHour: 22, quietEndHour: 7 }), []);
  const planned = planRecoveryReminders(candidates, { permissionGranted: true, quietStartHour: 22, quietEndHour: 7, dailyCap: 2 });
  assert.equal(planned.length, 2);
  assert.equal(planned[0].body, 'Your check-in is ready.');
  assert.deepEqual(planned.map((item) => item.track), ['smoking', 'online_shopping']);
});
