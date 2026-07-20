export const ADDICTION_TYPES = [
  'gambling', 'pornography', 'social_media', 'online_shopping', 'smoking',
  'alcohol', 'drugs', 'gaming', 'other',
] as const;

export type AddictionType = (typeof ADDICTION_TYPES)[number];
export type RecoveryBaseline = 'money' | 'time' | 'money_and_time' | 'custom';
export type HeroMetricId =
  | 'bet_free_days' | 'private_streak' | 'time_reclaimed' | 'paused_purchases'
  | 'smoke_free_time' | 'wellbeing_trend' | 'recovery_time' | 'custom_metric';
export type RecoveryFeatureId =
  | 'bet-breaker' | 'private-shield' | 'scroll-reclaim' | 'need-or-want'
  | 'catch-your-breath' | 'cheers-to-change' | 'back-on-track'
  | 'session-exit-plan' | 'replacement-plan';
export type TrackCapability = 'expense' | 'time_baseline' | 'discreet' | 'professional_support';
export type IntakeFieldDefinition = {
  id: 'detail' | 'goal_mode' | 'started_at' | 'expense' | 'time_baseline' | 'triggers' | 'reason';
  required: boolean;
};
export type AddictionJournalDefinition = {
  route: string;
  statusField: 'gambled' | 'watched' | 'binged' | 'shopped' | 'smoked' | 'drank' | 'used' | 'played' | 'otherActed';
  primaryQuestion: string;
};
export interface RecoveryTrackDefinition {
  type: AddictionType;
  label: string;
  verb: string;
  freeLabel: string;
  detailQuestion: string;
  detailOptions?: readonly string[];
  triggers: readonly string[];
  intake: readonly IntakeFieldDefinition[];
  baseline: RecoveryBaseline;
  journal: AddictionJournalDefinition;
  heroMetric: HeroMetricId;
  flagshipFeature: RecoveryFeatureId;
  capabilities: readonly TrackCapability[];
  safety: { summary: string; professionalHelp?: boolean };
  sosAnchor: { title: string; prompt: string };
}

const common = (expense: boolean, time = false): IntakeFieldDefinition[] => [
  { id: 'detail', required: true }, { id: 'goal_mode', required: true },
  { id: 'started_at', required: true }, ...(expense ? [{ id: 'expense' as const, required: true }] : []),
  ...(time ? [{ id: 'time_baseline' as const, required: true }] : []),
  { id: 'triggers', required: false }, { id: 'reason', required: true },
];
const otherTriggers = ['Stress', 'Boredom', 'Loneliness', 'Anxiety', 'Emotional pain', 'Peer / social pressure', 'Idle time', 'Habit / routine', 'Other'];

export const RECOVERY_TRACKS = {
  gambling: {
    type: 'gambling', label: 'Gambling', verb: 'gamble', freeLabel: 'Gambling-Free',
    detailQuestion: 'What do you gamble on?', detailOptions: ['Sports betting', 'Casino games', 'Online slots', 'Poker', 'Lottery', 'Bingo', 'Sabong', 'Other'],
    triggers: ['Stress', 'Boredom', 'Payday', 'Watching sports', 'Casino / betting ads', 'Friends who gamble', 'Financial problems', 'After drinking', 'Other'],
    intake: common(true), baseline: 'money', journal: { route: '/journal-entry', statusField: 'gambled', primaryQuestion: 'Did you gamble today?' },
    heroMetric: 'bet_free_days', flagshipFeature: 'bet-breaker', capabilities: ['expense'],
    safety: { summary: 'Recovery support only; no wagering, odds, prizes, or betting advice.' },
    sosAnchor: { title: 'Bet Breaker', prompt: 'Pause before acting on an intended stake.' },
  },
  pornography: {
    type: 'pornography', label: 'Pornography', verb: 'watch porn', freeLabel: 'Porn-Free',
    detailQuestion: 'Anything you want to note? (optional)', triggers: ['Stress', 'Boredom', 'Loneliness', 'Late at night', 'Being alone', 'Social media', 'Anxiety', 'Habit / routine', 'Other'],
    intake: common(false), baseline: 'custom', journal: { route: '/porn-journal-entry', statusField: 'watched', primaryQuestion: 'Did you watch pornography today?' },
    heroMetric: 'private_streak', flagshipFeature: 'private-shield', capabilities: ['discreet'],
    safety: { summary: 'Private, text-only self-help with discreet wording.' }, sosAnchor: { title: 'Private Shield Plan', prompt: 'Choose a private replacement action.' },
  },
  social_media: {
    type: 'social_media', label: 'Social Media', verb: 'binge social media', freeLabel: 'Social Media-Free',
    detailQuestion: 'Which platform type pulls you in most?', detailOptions: ['Short-form video', 'Photo and story feeds', 'Video platforms', 'Discussion feeds', 'Messaging communities', 'Other'],
    triggers: ['Boredom', 'Procrastinating tasks', 'Waking up / before bed', 'FOMO', 'Loneliness', 'Waiting (queues, commute)', 'Anxiety or stress', 'Seeking validation', 'Other'],
    intake: common(false, true), baseline: 'time', journal: { route: '/social-journal-entry', statusField: 'binged', primaryQuestion: 'Did you binge social media today?' },
    heroMetric: 'time_reclaimed', flagshipFeature: 'scroll-reclaim', capabilities: ['time_baseline'],
    safety: { summary: 'Time is estimated only from user-entered sessions.' }, sosAnchor: { title: 'Scroll Reclaim', prompt: 'Set an intentional stop time.' },
  },
  online_shopping: {
    type: 'online_shopping', label: 'Online Shopping', verb: 'shop online', freeLabel: 'Shop-Free',
    detailQuestion: 'Where do you mostly shop?', detailOptions: ['Online marketplace', 'Social shopping feed', 'Brand or retailer app', 'Second-hand marketplace', 'Livestream shopping', 'Other'],
    triggers: ['Boredom', 'Stress', 'Sale / flash deals', 'Social media ads', 'FOMO / limited stock', 'Emotional spending', 'Payday / extra cash', 'Other'],
    intake: common(true), baseline: 'money', journal: { route: '/online-shopping-journal-entry', statusField: 'shopped', primaryQuestion: 'Did you shop online today?' },
    heroMetric: 'paused_purchases', flagshipFeature: 'need-or-want', capabilities: ['expense'],
    safety: { summary: 'Paused intentions are not counted automatically as savings.' }, sosAnchor: { title: 'Need or Want?', prompt: 'Pause this purchase decision.' },
  },
  smoking: {
    type: 'smoking', label: 'Smoking', verb: 'smoke', freeLabel: 'Smoke-Free', detailQuestion: 'What do you smoke?',
    detailOptions: ['Cigarettes', 'Vape', 'Cigar', 'Roll-your-own', 'Other'], triggers: ['Stress', 'After a meal', 'Morning coffee / tea', 'Drinking alcohol', 'Boredom', 'Work break', 'Driving', 'Around other smokers', 'Other'],
    intake: common(true), baseline: 'money', journal: { route: '/smoke-journal-entry', statusField: 'smoked', primaryQuestion: 'Did you smoke today?' },
    heroMetric: 'smoke_free_time', flagshipFeature: 'catch-your-breath', capabilities: ['expense'],
    safety: { summary: 'Wellness reflection only; no lung diagnosis or measured health claim.' }, sosAnchor: { title: 'Catch Your Breath', prompt: 'Pause and reflect on how you feel.' },
  },
  alcohol: {
    type: 'alcohol', label: 'Alcohol', verb: 'drink', freeLabel: 'Alcohol-Free', detailQuestion: 'What do you usually drink?',
    detailOptions: ['Beer', 'Wine', 'Spirits / Hard liquor', 'Mixed drinks', 'Other'], triggers: ['Stress', 'Social pressure', 'Celebrations / parties', 'Loneliness', 'Boredom', 'After work', 'Negative emotions', 'Other'],
    intake: common(true), baseline: 'money', journal: { route: '/alcohol-journal-entry', statusField: 'drank', primaryQuestion: 'Did you drink alcohol today?' },
    heroMetric: 'wellbeing_trend', flagshipFeature: 'cheers-to-change', capabilities: ['expense', 'professional_support'],
    safety: { summary: 'Never encourages drinking or provides withdrawal guidance.', professionalHelp: true }, sosAnchor: { title: 'Cheers to Change', prompt: 'Choose support instead of drinking.' },
  },
  drugs: {
    type: 'drugs', label: 'Drugs / Substances', verb: 'use', freeLabel: 'Substance-Free', detailQuestion: 'What substance? (optional)',
    triggers: ['Stress', 'Peer pressure', 'Emotional pain', 'Boredom', 'Withdrawal symptoms', 'Past trauma', 'Availability / easy access', 'Loneliness', 'Other'],
    intake: common(true), baseline: 'money', journal: { route: '/drug-journal-entry', statusField: 'used', primaryQuestion: 'Did you use substances today?' },
    heroMetric: 'recovery_time', flagshipFeature: 'back-on-track', capabilities: ['expense', 'professional_support'],
    safety: { summary: 'No dosage, detox, diagnosis, or withdrawal triage.', professionalHelp: true }, sosAnchor: { title: 'Back on Track', prompt: 'Reach out for safe, qualified support.' },
  },
  gaming: {
    type: 'gaming', label: 'Gaming', verb: 'play', freeLabel: 'Gaming-Free', detailQuestion: 'What do you mostly play?',
    detailOptions: ['Mobile games', 'Console', 'PC games', 'Online multiplayer', 'Browser / web games', 'Other'], triggers: ['Boredom', 'Stress', 'Loneliness', 'Friends online', 'FOMO / missing events', 'Daily login rewards', 'Competitive streak / rank', 'Late night / can’t sleep', 'Other'],
    intake: common(true, true), baseline: 'money_and_time', journal: { route: '/game-journal-entry', statusField: 'played', primaryQuestion: 'Did you play games compulsively today?' },
    heroMetric: 'time_reclaimed', flagshipFeature: 'session-exit-plan', capabilities: ['expense', 'time_baseline'],
    safety: { summary: 'Recreational games are never recommended automatically.' }, sosAnchor: { title: 'Session Exit Plan', prompt: 'Plan a clear and intentional exit.' },
  },
  other: {
    type: 'other', label: 'Other', verb: 'do it', freeLabel: 'Habit-Free', detailQuestion: 'Describe the habit you want to change',
    triggers: otherTriggers, intake: common(true, true), baseline: 'custom', journal: { route: '/journal-entry', statusField: 'otherActed', primaryQuestion: 'Did you return to the habit today?' },
    heroMetric: 'custom_metric', flagshipFeature: 'replacement-plan', capabilities: ['expense', 'time_baseline'],
    safety: { summary: 'Editable self-help plan with no automation claim.' }, sosAnchor: { title: 'My Replacement Plan', prompt: 'Choose what you will do when the trigger appears.' },
  },
} as const satisfies Record<AddictionType, RecoveryTrackDefinition>;

export function recoveryTrack(type: AddictionType): RecoveryTrackDefinition {
  const definition = RECOVERY_TRACKS[type];
  if (!definition) throw new Error(`Unknown recovery track: ${String(type)}`);
  return definition;
}

export function isAddictionType(value: unknown): value is AddictionType {
  return typeof value === 'string' && (ADDICTION_TYPES as readonly string[]).includes(value);
}

/** Runtime-safe resolver for persisted data and route parameters. */
export function tryRecoveryTrack(value: unknown): RecoveryTrackDefinition | null {
  return isAddictionType(value) ? RECOVERY_TRACKS[value] : null;
}
