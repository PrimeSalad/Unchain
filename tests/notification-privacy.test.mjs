import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIVATE_NOTIFICATION_BODY,
  PRIVATE_NOTIFICATION_TITLE,
  containsSensitiveNotificationDetail,
  privateNotificationContent,
} from '../.test-build/notificationPrivacy.js';
import { predictionNotificationMessage } from '../.test-build/urgeAnalytics.js';

test('lock-screen notification copy is neutral and contains no recovery detail', () => {
  const content = privateNotificationContent();
  assert.deepEqual(content, {
    title: PRIVATE_NOTIFICATION_TITLE,
    body: PRIVATE_NOTIFICATION_BODY,
  });
  assert.equal(containsSensitiveNotificationDetail(content), false);
});

test('urge prediction notifications never expose the predicted hour or category', () => {
  const content = predictionNotificationMessage({
    hour: 23,
    dow: 6,
    score: 1,
    count: 8,
    avgIntensity: 9,
    confidence: 'high',
  });
  assert.deepEqual(content, privateNotificationContent());
  assert.equal(content.body.includes('23'), false);
  assert.equal(containsSensitiveNotificationDetail(content), false);
});

test('privacy audit helper catches sensitive future notification copy', () => {
  assert.equal(containsSensitiveNotificationDetail({
    title: 'Recovery reminder',
    body: 'Your lungs and urge log are ready.',
  }), true);
  assert.equal(containsSensitiveNotificationDetail({
    title: 'Purchase follow-up',
    body: 'Did you buy the item for ₱500?',
  }), true);
});
