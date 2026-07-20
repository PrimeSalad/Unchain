import type { AddictionType, RecoveryFeatureId } from '../domain/recoveryTracks';

export type FeatureRelease = 'off' | 'internal' | 'beta' | 'stable';
export interface RecoveryFeatureDefinition {
  id: RecoveryFeatureId;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  scope: 'track' | 'global';
  release: FeatureRelease;
  cadence?: 'weekly' | 'on_demand';
  requires?: readonly string[];
  excludedForTracks?: readonly AddictionType[];
}

export const RECOVERY_FEATURES = {
  'need-or-want': { id: 'need-or-want', title: 'Need or Want?', subtitle: 'Pause before you buy', icon: 'cart', route: '/need-or-want', scope: 'track', release: 'stable', cadence: 'on_demand' },
  'catch-your-breath': { id: 'catch-your-breath', title: 'Catch Your Breath', subtitle: 'Weekly wellness reflection', icon: 'fitness', route: '/catch-your-breath', scope: 'track', release: 'stable', cadence: 'weekly' },
  'cheers-to-change': { id: 'cheers-to-change', title: 'Cheers to Change', subtitle: 'Weekly well-being reflection', icon: 'wine', route: '/cheers-to-change', scope: 'track', release: 'stable', cadence: 'weekly' },
  'back-on-track': { id: 'back-on-track', title: 'Back on Track', subtitle: 'Weekly recovery reflection', icon: 'trending-up', route: '/back-on-track', scope: 'track', release: 'stable', cadence: 'weekly' },
  'bet-breaker': { id: 'bet-breaker', title: 'Bet Breaker', subtitle: 'Pause an intended bet', icon: 'pause-circle', route: '/recovery-plan', scope: 'track', release: 'internal' },
  'private-shield': { id: 'private-shield', title: 'Private Shield Plan', subtitle: 'Plan for a risky window', icon: 'shield-checkmark', route: '/recovery-plan', scope: 'track', release: 'internal' },
  'scroll-reclaim': { id: 'scroll-reclaim', title: 'Scroll Reclaim', subtitle: 'Set an intentional stop time', icon: 'timer', route: '/recovery-plan', scope: 'track', release: 'internal' },
  'session-exit-plan': { id: 'session-exit-plan', title: 'Session Exit Plan', subtitle: 'Plan a clear exit', icon: 'exit', route: '/recovery-plan', scope: 'track', release: 'internal', excludedForTracks: ['gambling'] },
  'replacement-plan': { id: 'replacement-plan', title: 'My Replacement Plan', subtitle: 'Choose a replacement action', icon: 'swap-horizontal', route: '/recovery-plan', scope: 'track', release: 'internal' },
} as const satisfies Record<RecoveryFeatureId, RecoveryFeatureDefinition>;

export function resolveRecoveryFeature(id: string, allowInternal = false): RecoveryFeatureDefinition | null {
  const feature = RECOVERY_FEATURES[id as RecoveryFeatureId] as RecoveryFeatureDefinition | undefined;
  if (!feature || feature.release === 'off' || (feature.release === 'internal' && !allowInternal)) return null;
  return feature;
}
