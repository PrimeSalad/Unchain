import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOVERY_STATE_SCHEMA_VERSION,
  migrateRecoveryState,
  migrateRecoveryStateToV4,
} from '../.test-build/recoveryStateMigration.js';

function localDateParts(timestamp) {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

function legacyProfile(type, selected, startedAt) {
  return {
    name: 'Kai',
    age: 29,
    addictionType: type,
    selectedAddictions: selected,
    addictionDetail: `${type} detail`,
    startedAt,
    expenseAmount: 125,
    expensePeriod: 'weekly',
    currency: 'PHP',
    triggers: ['Stress'],
    reason: `${type} reason`,
  };
}

test('v4 migration preserves data and makes top-level active recovery state authoritative', () => {
  const startedAt = new Date(2026, 6, 18, 19, 42, 11).getTime();
  const original = {
    onboarded: true,
    profile: legacyProfile(
      'gambling',
      ['social_media', 'gambling', 'social_media', 'not-real'],
      startedAt,
    ),
    journal: [{ id: 'top-journal', at: 20, gambled: false }],
    urges: [{ id: 'top-urge', at: 21, intensity: 3 }],
    points: 42,
    unknownGlobal: { future: true },
    recoveryByAddiction: {
      gambling: {
        profile: legacyProfile('gambling', ['gambling'], startedAt),
        journal: [{ id: 'stale-journal' }],
        urges: [{ id: 'stale-urge' }],
        points: 2,
        snapshotFuture: 'keep me',
      },
      social_media: {
        profile: legacyProfile('social_media', ['gambling', 'social_media'], startedAt + 1_000),
        journal: [{ id: 'social-history' }],
      },
      smoking: {
        profile: legacyProfile('smoking', ['gambling'], startedAt + 2_000),
        relapses: [{ id: 'archived-history' }],
      },
      future_track: { opaque: true },
    },
  };

  const migrated = migrateRecoveryState(original, 0);
  const recovery = migrated.recoveryByAddiction;

  assert.equal(RECOVERY_STATE_SCHEMA_VERSION, 4);
  assert.deepEqual(migrated.unknownGlobal, { future: true });
  assert.deepEqual(recovery.future_track, { opaque: true });
  assert.equal(recovery.gambling.snapshotFuture, 'keep me');
  assert.deepEqual(recovery.gambling.journal, original.journal);
  assert.deepEqual(recovery.gambling.urges, original.urges);
  assert.equal(recovery.gambling.points, 42);
  assert.deepEqual(recovery.social_media.journal, [{ id: 'social-history' }]);
  assert.deepEqual(recovery.smoking.relapses, [{ id: 'archived-history' }]);

  assert.deepEqual(migrated.profile.selectedAddictions, ['social_media', 'gambling']);
  assert.deepEqual(recovery.social_media.profile.selectedAddictions, ['social_media', 'gambling']);
  assert.equal(recovery.gambling.setup.setupStatus, 'complete');
  assert.equal(recovery.social_media.setup.setupStatus, 'needs_review');
  assert.equal(recovery.smoking.setup.setupStatus, 'needs_review');
  assert.equal(recovery.smoking.setup.setupCompletedAt, undefined);
  assert.equal(recovery.gambling.setup.setupVersion, 1);

  assert.deepEqual(localDateParts(migrated.profile.startedAt), localDateParts(startedAt));
  assert.equal(new Date(migrated.profile.startedAt).getHours(), 0);
  assert.equal(recovery.gambling.setup.startedAtLocalMidnight, migrated.profile.startedAt);
  assert.notEqual(migrated, original);
  assert.equal(original.recoveryByAddiction.gambling.journal[0].id, 'stale-journal');
});

test('a missing selected secondary receives a neutral shell without synthetic history', () => {
  const startedAt = new Date(2026, 6, 20, 13, 0).getTime();
  const state = {
    profile: legacyProfile('gambling', ['gambling', 'gaming'], startedAt),
    journal: [{ id: 'active-only' }],
    recoveryByAddiction: {},
  };

  const migrated = migrateRecoveryState(state, 3);
  const gaming = migrated.recoveryByAddiction.gaming;

  assert.equal(gaming.profile.addictionType, 'gaming');
  assert.equal(gaming.profile.name, 'Kai');
  assert.equal(gaming.profile.reason, '');
  assert.deepEqual(gaming.profile.triggers, []);
  assert.equal(gaming.setup.setupStatus, 'needs_review');
  assert.deepEqual(gaming.checkIns, []);
  assert.deepEqual(gaming.urges, []);
  assert.deepEqual(gaming.relapses, []);
  assert.deepEqual(gaming.journal, []);
  assert.deepEqual(gaming.timeline, []);
});

test('malformed snapshot fields are repaired without dropping unknown metadata', () => {
  const startedAt = new Date(2026, 6, 20, 13, 0).getTime();
  const state = {
    profile: legacyProfile('gambling', ['gambling', 'smoking'], startedAt),
    recoveryByAddiction: {
      smoking: {
        profile: legacyProfile('smoking', ['gambling', 'smoking'], startedAt),
        journal: 'not-an-array',
        urges: null,
        points: Number.NaN,
        alternatives: [],
        waterToday: { day: 42, glasses: 'many' },
        dailyMissions: [],
        lastCheckedIn: 'yesterday',
        futureSnapshotMetadata: { keep: true },
      },
    },
  };

  const migrated = migrateRecoveryState(state, 0);
  const smoking = migrated.recoveryByAddiction.smoking;
  assert.deepEqual(smoking.journal, []);
  assert.deepEqual(smoking.urges, []);
  assert.equal(smoking.points, 0);
  assert.deepEqual(smoking.alternatives, {});
  assert.deepEqual(smoking.waterToday, { day: '', glasses: 0 });
  assert.deepEqual(smoking.dailyMissions, { day: '', completed: [] });
  assert.equal(smoking.lastCheckedIn, null);
  assert.deepEqual(smoking.futureSnapshotMetadata, { keep: true });
});

test('valid completed secondary setup survives while an unselected setup is archived', () => {
  const startedAt = new Date(2026, 3, 5, 9, 15).getTime();
  const completeSocial = {
    addictionType: 'social_media',
    addictionDetail: 'TikTok',
    goalMode: 'reduce',
    startedAtLocalMidnight: startedAt,
    timeBaselineMinutes: 90,
    triggers: ['Boredom'],
    reason: 'More focus',
    setupVersion: 1,
    setupStatus: 'complete',
    setupCompletedAt: startedAt + 10_000,
    futureSetupField: 'preserved',
  };
  const state = {
    profile: legacyProfile('gambling', ['gambling', 'social_media'], startedAt),
    recoveryByAddiction: {
      social_media: {
        profile: legacyProfile('social_media', ['gambling', 'social_media'], startedAt),
        setup: completeSocial,
      },
      smoking: {
        profile: legacyProfile('smoking', ['gambling'], startedAt),
        setup: { ...completeSocial, addictionType: 'smoking' },
      },
    },
  };

  const migrated = migrateRecoveryStateToV4(state, 4);
  assert.equal(migrated.recoveryByAddiction.social_media.setup.setupStatus, 'complete');
  assert.equal(migrated.recoveryByAddiction.social_media.setup.goalMode, 'reduce');
  assert.equal(migrated.recoveryByAddiction.social_media.setup.futureSetupField, 'preserved');
  assert.equal(migrated.recoveryByAddiction.smoking.setup.setupStatus, 'archived');
});

test('an active v4 needs-review track stays needs-review across backup migration', () => {
  const startedAt = new Date(2026, 6, 20).getTime();
  const profile = legacyProfile('social_media', ['social_media', 'gambling'], startedAt);
  const state = {
    profile,
    recoveryByAddiction: {
      social_media: {
        profile,
        setup: {
          addictionType: 'social_media',
          addictionDetail: 'TikTok',
          goalMode: 'quit',
          startedAtLocalMidnight: startedAt,
          triggers: [],
          reason: '',
          setupVersion: 1,
          setupStatus: 'needs_review',
        },
      },
    },
  };

  const migrated = migrateRecoveryState(state, 4);
  assert.equal(migrated.recoveryByAddiction.social_media.setup.setupStatus, 'needs_review');
  assert.equal(migrated.recoveryByAddiction.social_media.setup.setupCompletedAt, undefined);
});

test('migration is synchronous, nonthrowing, and idempotent', () => {
  assert.deepEqual(migrateRecoveryState(null), {});
  assert.deepEqual(migrateRecoveryState('bad persisted value'), {});
  assert.doesNotThrow(() => migrateRecoveryState(new Proxy({}, {
    ownKeys() {
      throw new Error('hostile persisted object');
    },
  })));
  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  assert.doesNotThrow(() => migrateRecoveryState(revocable.proxy));

  const state = {
    profile: legacyProfile(
      'gambling',
      ['gambling', 'gaming'],
      new Date(2026, 6, 20, 18, 45).getTime(),
    ),
    points: 9,
    recoveryByAddiction: {},
  };
  const once = migrateRecoveryState(state, 0);
  const twice = migrateRecoveryState(once, 4);
  assert.deepEqual(twice, once);
  assert.equal(typeof once.then, 'undefined');
});
