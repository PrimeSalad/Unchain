import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultUrgeTriggers,
  resolveUrgeDestination,
  triggerOptionsForAddiction,
} from '../.test-build/urgeLogging.js';

const TRACKS = [
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

test('every recovery category exposes non-empty Log Urge defaults', () => {
  for (const track of TRACKS) {
    assert.ok(defaultUrgeTriggers(track).length > 0, `${track} must have trigger options`);
  }
  assert.ok(defaultUrgeTriggers('pornography').includes('Explicit content online'));
});

test('saved triggers appear first and options de-duplicate without losing casing', () => {
  const options = triggerOptionsForAddiction(
    'gambling',
    ['My custom trigger', ' Stress ', 'my custom trigger', ''],
    ['Legacy value', 'stress'],
  );

  assert.deepEqual(options.slice(0, 2), ['My custom trigger', 'Stress']);
  assert.equal(options.filter((value) => value.toLowerCase() === 'stress').length, 1);
  assert.equal(options.at(-1), 'Legacy value');
});

test('an edited legacy value remains selectable even when it is not a default', () => {
  const options = triggerOptionsForAddiction('pornography', [], ['Old imported value']);
  assert.ok(options.includes('Old imported value'));
});

test('edit ownership wins over route context and invalid route context falls back active', () => {
  assert.equal(resolveUrgeDestination({
    activeTrack: 'gambling',
    selectedTracks: ['gambling', 'smoking'],
    requestedTrack: 'smoking',
    editOwnerTrack: 'pornography',
  }), 'pornography');

  assert.equal(resolveUrgeDestination({
    activeTrack: 'gambling',
    selectedTracks: ['gambling', 'smoking'],
    requestedTrack: 'alcohol',
  }), 'gambling');

  assert.equal(resolveUrgeDestination({
    activeTrack: 'gambling',
    selectedTracks: ['gambling', 'smoking'],
    requestedTrack: 'smoking',
  }), 'smoking');

  assert.equal(resolveUrgeDestination({
    activeTrack: 'gambling',
    selectedTracks: ['smoking'],
  }), 'smoking');

  assert.equal(resolveUrgeDestination({
    activeTrack: 'gambling',
    selectedTracks: [],
  }), null);
});
