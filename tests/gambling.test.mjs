import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { recoveryFreeLabel } = require('../.test-build/domain/gambling.js');

test('Home recovery label identifies every built-in addiction', () => {
  const expected = {
    gambling: 'Gambling-Free',
    pornography: 'Porn-Free',
    social_media: 'Social Media-Free',
    smoking: 'Smoke-Free',
    alcohol: 'Alcohol-Free',
    drugs: 'Substance-Free',
  };

  for (const [addictionType, label] of Object.entries(expected)) {
    assert.equal(recoveryFreeLabel(addictionType), label);
  }
});

test('Home recovery label uses the saved custom addiction detail', () => {
  assert.equal(recoveryFreeLabel('other', 'Gaming'), 'Gaming-Free');
  assert.equal(recoveryFreeLabel('other', '  Compulsive shopping  '), 'Compulsive shopping-Free');
  assert.equal(recoveryFreeLabel('other'), 'Habit-Free');
});
