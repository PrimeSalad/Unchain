/**
 * Healthy Alternatives - interactive recovery actions (pure definitions).
 * Each activity completes at most once per calendar day; completion state
 * lives in the store as `alternatives[id] = timestamp` and "done today" is
 * always derived with sameDay(), so it resets automatically at local midnight.
 */

export type AlternativeId =
  | 'walk'
  | 'breathe'
  | 'stretch'
  | 'water'
  | 'journal'
  | 'music'
  | 'need-or-want'
  | 'catch-your-breath'
  | 'cheers-to-change'
  | 'back-on-track'
  | 'where-did-it-go'
  | 'beyond-the-screen'
  | 'press-pause';

export interface Alternative {
  id: AlternativeId;
  title: string;
  subtitle: string;
  /** Ionicons name. */
  icon: string;
  /** Semantic tint used for the icon chip + completed state. */
  tint: 'primary' | 'success' | 'accent' | 'celebrate';
}

export const ALTERNATIVES: Alternative[] = [
  { id: 'walk',    title: 'Take a Walk',                    subtitle: 'Live steps & distance, on your terms', icon: 'walk',                tint: 'success' },
  { id: 'breathe', title: 'Practice Deep Breathing',        subtitle: 'Slow, guided breathing session',      icon: 'leaf',                 tint: 'primary' },
  { id: 'stretch', title: 'Stretch Your Body',              subtitle: 'A short guided release',              icon: 'body',                 tint: 'celebrate' },
  { id: 'water',   title: 'Drink a Glass of Water',         subtitle: 'Small anchor, real reset',            icon: 'water',                tint: 'primary' },
  { id: 'journal', title: "Write Down What You're Feeling", subtitle: "Today's journal entry",               icon: 'create',               tint: 'primary' },
  { id: 'music',   title: 'Listen to Calming Music',        subtitle: 'A few minutes of built-in calm',      icon: 'musical-notes',        tint: 'celebrate' },
  { id: 'need-or-want', title: 'Need or Want?',             subtitle: 'Pause before you buy',                 icon: 'cart',                 tint: 'accent' },
  { id: 'catch-your-breath', title: 'Catch Your Breath',   subtitle: 'Weekly lung health reflection',        icon: 'fitness',              tint: 'success' },
  { id: 'cheers-to-change', title: 'Cheers to Change',     subtitle: 'Weekly body wellness reflection',      icon: 'wine',                 tint: 'success' },
  { id: 'back-on-track', title: 'Back on Track',          subtitle: 'Weekly recovery check-in',             icon: 'trending-up',          tint: 'primary' },
  { id: 'where-did-it-go', title: 'Where Did It Go?',    subtitle: 'Weekly financial reflection',          icon: 'wallet',               tint: 'primary' },
  { id: 'beyond-the-screen', title: 'Beyond the Screen', subtitle: 'Weekly well-being reflection',         icon: 'eye',                  tint: 'primary' },
  { id: 'press-pause', title: 'Press Pause',            subtitle: 'Weekly balance reflection',             icon: 'pause',                tint: 'primary' },
];

export function alternativeById(id: AlternativeId): Alternative {
  return ALTERNATIVES.find((a) => a.id === id) ?? ALTERNATIVES[0];
}

/** Guided stretch - the user picks how many stretches and how long each runs. */
export interface StretchStep {
  title: string;
  instruction: string;
  /** Ionicons name for the simple illustration chip. */
  icon: string;
}

/** The full stretch library - sessions draw a shuffled subset from here. */
export const STRETCH_STEPS: StretchStep[] = [
  { title: 'Neck Release',   instruction: 'Slowly tilt your ear toward each shoulder. Let gravity do the work - no forcing.', icon: 'person' },
  { title: 'Shoulder Rolls', instruction: 'Roll your shoulders back in big, slow circles. Drop them away from your ears.',    icon: 'sync' },
  { title: 'Forward Fold',   instruction: 'Stand and fold forward with soft knees. Hang loose and breathe into your back.',   icon: 'arrow-down' },
  { title: 'Side Stretch',   instruction: 'Reach one arm overhead and lean gently to the side. Switch halfway through.',      icon: 'resize' },
  { title: 'Hamstring Reach', instruction: 'Reach gently toward your toes with soft knees. Ease in - no bouncing.',           icon: 'trending-down' },
  { title: 'Chest Opener',   instruction: 'Clasp your hands behind your back and lift gently. Open across the chest.',        icon: 'expand' },
  { title: 'Hip Circles',    instruction: 'Hands on hips, draw slow circles. Switch direction halfway through.',              icon: 'refresh' },
  { title: 'Calf Stretch',   instruction: 'Step one foot back and press the heel down. Switch legs halfway through.',         icon: 'walk' },
  { title: 'Seated Twist',   instruction: 'Sit tall and twist gently to one side, then the other. Move with your breath.',    icon: 'sync-circle' },
  { title: 'Wrists & Hands', instruction: 'Circle your wrists, spread your fingers wide, then shake everything loose.',       icon: 'hand-left' },
];

/** How many stretches a session can include. */
export const STRETCH_COUNT_OPTIONS = [3, 5, 8, 10] as const;

/** Seconds the user can choose per stretch. */
export const STRETCH_SECONDS_OPTIONS = [20, 30, 40, 60] as const;

/** Daily hydration goal (glasses). */
export const WATER_GOAL_GLASSES = 8;

// ---------------------------------------------------------------------------
// Healthy-habit achievements - permanent unlocks, mirrored on the game
// achievement system (id → unlockedAt in the store, shareable cards).
// ---------------------------------------------------------------------------

/** Lifetime completion counts per activity. `journal` is derived from the
 *  journal itself at evaluation time; the rest are counted by the store. */
export type AltCounts = Partial<Record<AlternativeId, number>>;

export interface AltAchievement {
  id: string;
  title: string;
  desc: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Live progress for locked achievements (counter-based ones only). */
  progress?: (c: AltCounts) => { current: number; target: number };
  /** `fullDay` = every activity completed on the same calendar day. */
  test: (c: AltCounts, fullDay: boolean) => boolean;
}

const total = (c: AltCounts) =>
  ALTERNATIVES.reduce((sum, a) => sum + (c[a.id] ?? 0), 0);

const countOf = (id: AlternativeId, target: number) => ({
  progress: (c: AltCounts) => ({ current: Math.min(c[id] ?? 0, target), target }),
  test: (c: AltCounts) => (c[id] ?? 0) >= target,
});

export const ALT_ACHIEVEMENTS: AltAchievement[] = [
  {
    id: 'alt-first', title: 'First Step', icon: 'footsteps',
    desc: 'Complete your first healthy alternative.',
    progress: (c) => ({ current: Math.min(total(c), 1), target: 1 }),
    test: (c) => total(c) >= 1,
  },
  { id: 'alt-walk-10',    title: 'Ten Walks',       icon: 'walk',           desc: 'Complete 10 recovery walks.',            ...countOf('walk', 10) },
  { id: 'alt-water-10',   title: 'Hydration Habit', icon: 'water',          desc: 'Log a glass of water on 10 days.',       ...countOf('water', 10) },
  { id: 'alt-breathe-10', title: 'Calm Mind',       icon: 'leaf',           desc: 'Finish 10 deep-breathing sessions.',     ...countOf('breathe', 10) },
  { id: 'alt-stretch-10', title: 'Loose & Limber',  icon: 'body',           desc: 'Finish 10 guided stretch sessions.',     ...countOf('stretch', 10) },
  { id: 'alt-music-10',   title: 'Sound of Calm',   icon: 'musical-notes',  desc: 'Complete 10 calming-music sessions.',    ...countOf('music', 10) },
  { id: 'alt-journal-10', title: 'Honest Pages',    icon: 'create',         desc: 'Write 10 journal entries.',              ...countOf('journal', 10) },
  {
    id: 'alt-total-25', title: 'Habit Builder', icon: 'construct',
    desc: 'Complete 25 healthy alternatives in total.',
    progress: (c) => ({ current: Math.min(total(c), 25), target: 25 }),
    test: (c) => total(c) >= 25,
  },
  {
    id: 'alt-total-100', title: 'Lifestyle Change', icon: 'infinite',
    desc: 'Complete 100 healthy alternatives in total.',
    progress: (c) => ({ current: Math.min(total(c), 100), target: 100 }),
    test: (c) => total(c) >= 100,
  },
  {
    id: 'alt-full-day', title: 'Full Reset', icon: 'sparkles',
    desc: 'Complete every healthy alternative in a single day.',
    test: (_c, fullDay) => fullDay,
  },
  { id: 'alt-catch-breath-5', title: 'Breath Tracker', icon: 'fitness',
    desc: 'Complete 5 Catch Your Breath reflections.', ...countOf('catch-your-breath', 5) },
  { id: 'alt-cheers-5', title: 'Wellness Watcher', icon: 'wine',
    desc: 'Complete 5 Cheers to Change reflections.', ...countOf('cheers-to-change', 5) },
  { id: 'alt-back-on-track-5', title: 'Recovery Watcher', icon: 'trending-up',
    desc: 'Complete 5 Back on Track reflections.', ...countOf('back-on-track', 5) },
  { id: 'alt-where-did-it-go-5', title: 'Financial Tracker', icon: 'wallet',
    desc: 'Complete 5 Where Did It Go? reflections.', ...countOf('where-did-it-go', 5) },
  { id: 'alt-beyond-the-screen-5', title: 'Life Beyond', icon: 'eye',
    desc: 'Complete 5 Beyond the Screen reflections.', ...countOf('beyond-the-screen', 5) },
  { id: 'alt-press-pause-5', title: 'Balance Seeker', icon: 'pause',
    desc: 'Complete 5 Press Pause reflections.', ...countOf('press-pause', 5) },
];

export function altAchievementById(id: string): AltAchievement | undefined {
  return ALT_ACHIEVEMENTS.find((a) => a.id === id);
}

/** Ids whose criteria are currently met. Callers filter out already-unlocked. */
export function evaluateAltAchievements(counts: AltCounts, fullDay: boolean): string[] {
  return ALT_ACHIEVEMENTS.filter((a) => a.test(counts, fullDay)).map((a) => a.id);
}

/** Quick-pick breathing lengths (minutes); the stepper allows 1–30 freely. */
export const BREATHE_MINUTES = [1, 2, 3, 5, 10] as const;
export const BREATHE_MIN_MINUTES = 1;
export const BREATHE_MAX_MINUTES = 30;

/** Listening time that counts as a meaningful calming-music session (seconds). */
export const MUSIC_GOAL_SECONDS = 120;

// ---------------------------------------------------------------------------
// Need or Want? - impulsive purchase interruption (online shopping only)
// ---------------------------------------------------------------------------

export interface NeedOrWantQuestion {
  id: string;
  question: string;
  options: string[];
}

export type NeedOrWantCategory =
  | 'food'
  | 'clothing'
  | 'electronics'
  | 'home'
  | 'beauty'
  | 'entertainment'
  | 'other';

export interface NeedOrWantCategoryMeta {
  label: string;
  icon: string;
  questions: NeedOrWantQuestion[];
}

/** Category selection - the first question. */
export const NEED_OR_WANT_CATEGORY_QUESTION: NeedOrWantQuestion = {
  id: 'category',
  question: 'What type of item is this?',
  options: [
    'Food or Drinks',
    'Clothing or Accessories',
    'Electronics or Gadgets',
    'Home or Furniture',
    'Beauty or Personal Care',
    'Entertainment or Subscriptions',
    'Something Else',
  ],
};

/** Map category option labels to category keys. */
export const CATEGORY_LABEL_TO_KEY: Record<string, NeedOrWantCategory> = {
  'Food or Drinks': 'food',
  'Clothing or Accessories': 'clothing',
  'Electronics or Gadgets': 'electronics',
  'Home or Furniture': 'home',
  'Beauty or Personal Care': 'beauty',
  'Entertainment or Subscriptions': 'entertainment',
  'Something Else': 'other',
};

/** Category-specific follow-up questions. Each category has 4 tailored questions. */
export const NEED_OR_WANT_CATEGORIES: Record<NeedOrWantCategory, NeedOrWantCategoryMeta> = {
  food: {
    label: 'Food or Drinks',
    icon: 'restaurant',
    questions: [
      {
        id: 'food-home',
        question: 'Do you already have food or drinks at home?',
        options: ['Yes, plenty', 'No, almost nothing', 'Some, but not what I want'],
      },
      {
        id: 'food-healthy',
        question: 'Is this a healthy choice, or more of a craving?',
        options: ['Healthy choice', 'Just a craving', 'Somewhere in between'],
      },
      {
        id: 'food-can-cook',
        question: 'Could you make something similar at home for less?',
        options: ['Yes, definitely', 'No, this is unique', 'Maybe, but it would take effort'],
      },
      {
        id: 'food-hunger',
        question: 'Are you actually hungry, or eating out of boredom or stress?',
        options: ['I\'m genuinely hungry', 'It\'s boredom or stress', 'A bit of both'],
      },
    ],
  },
  clothing: {
    label: 'Clothing or Accessories',
    icon: 'shirt',
    questions: [
      {
        id: 'closet-similar',
        question: 'Do you already own something similar in your closet?',
        options: ['Yes, multiple items', 'No, this is different', 'Something close but not exact'],
      },
      {
        id: 'closet-wear',
        question: 'Will you wear this at least 30 times?',
        options: ['Yes, definitely', 'Probably not that many', 'Not sure'],
      },
      {
        id: 'closet-match',
        question: 'Does this match things you already own?',
        options: ['Yes, it goes with many outfits', 'No, it stands alone', 'I\'d need to buy more to match it'],
      },
      {
        id: 'closet-trend',
        question: 'Is this a trend, or a timeless piece you\'ll wear for years?',
        options: ['Timeless classic', 'Just a trend', 'Somewhere in between'],
      },
    ],
  },
  electronics: {
    label: 'Electronics or Gadgets',
    icon: 'laptop',
    questions: [
      {
        id: 'tech-broken',
        question: 'Is your current device broken or not working?',
        options: ['Yes, it\'s broken', 'No, it works fine', 'It\'s slow but functional'],
      },
      {
        id: 'tech替代',
        question: 'Do you already own something that does the same thing?',
        options: ['Yes, I have alternatives', 'No, this is unique', 'I have something but it\'s older'],
      },
      {
        id: 'tech-wait',
        question: 'Could you wait 30 days and still want this?',
        options: ['Yes, I\'d still want it', 'No, the urge would pass', 'Maybe'],
      },
      {
        id: 'tech-research',
        question: 'Have you researched this thoroughly, or is it an impulse?',
        options: ['Done extensive research', 'Pure impulse', 'Looked at it briefly'],
      },
    ],
  },
  home: {
    label: 'Home or Furniture',
    icon: 'home',
    questions: [
      {
        id: 'home-space',
        question: 'Do you have space for this in your home?',
        options: ['Yes, plenty of space', 'No, it would be clutter', 'I\'d have to rearrange'],
      },
      {
        id: 'home-purpose',
        question: 'Does this solve a real problem in your home?',
        options: ['Yes, it fills a real need', 'No, it\'s decorative', 'Somewhere in between'],
      },
      {
        id: 'home-diy',
        question: 'Could you make or find something similar for less?',
        options: ['Yes, easily', 'No, this is one-of-a-kind', 'Maybe with some effort'],
      },
      {
        id: 'home-style',
        question: 'Does this match your home\'s existing style?',
        options: ['Yes, it fits perfectly', 'No, it\'s very different', 'It\'s close but not exact'],
      },
    ],
  },
  beauty: {
    label: 'Beauty or Personal Care',
    icon: 'sparkles',
    questions: [
      {
        id: 'beauty-stock',
        question: 'Do you already have similar products at home?',
        options: ['Yes, I have plenty', 'No, I\'m running low', 'Some, but different brands'],
      },
      {
        id: 'beauty-essential',
        question: 'Is this a daily essential, or a nice-to-have?',
        options: ['Daily essential', 'Just a nice-to-have', 'For special occasions'],
      },
      {
        id: 'beauty-size',
        question: 'Would you use this up completely, or would it go to waste?',
        options: ['I\'d use every drop', 'It would probably expire', 'Not sure'],
      },
      {
        id: 'beauty-similar',
        question: 'Have you tried a similar product before?',
        options: ['Yes, and it didn\'t work', 'No, this is new to me', 'Yes, and I liked it'],
      },
    ],
  },
  entertainment: {
    label: 'Entertainment or Subscriptions',
    icon: 'game-controller',
    questions: [
      {
        id: 'ent-sub-active',
        question: 'Do you already have active subscriptions you\'re not using?',
        options: ['Yes, several', 'No, I use them all', 'One or two I rarely use'],
      },
      {
        id: 'ent-free-alt',
        question: 'Is there a free alternative that does the same thing?',
        options: ['Yes, plenty of free options', 'No, this is unique', 'Free versions exist but are worse'],
      },
      {
        id: 'ent-frequency',
        question: 'How often would you actually use this?',
        options: ['Every day', 'Once in a while', 'Maybe once and forget'],
      },
      {
        id: 'ent-trial',
        question: 'Could you try a free trial first?',
        options: ['Yes, there\'s a trial available', 'No, no trial exists', 'I\'d rather just buy it'],
      },
    ],
  },
  other: {
    label: 'Something Else',
    icon: 'help-circle',
    questions: [
      {
        id: 'other-purpose',
        question: 'What specific problem does this solve for you?',
        options: ['A real daily problem', 'A minor inconvenience', 'No real problem, just want it'],
      },
      {
        id: 'other-similar',
        question: 'Do you already own something similar?',
        options: ['Yes, I do', 'No, this is different', 'Something close but not the same'],
      },
      {
        id: 'other-wait',
        question: 'Could you live without this for the next 7 days?',
        options: ['Yes, I can wait', 'No, I need it now', 'Maybe'],
      },
      {
        id: 'other-regret',
        question: 'How will you feel about this purchase in one week?',
        options: ['Glad I bought it', 'Probably regret it', 'Not sure'],
      },
    ],
  },
};

export type NeedOrWantResponses = Record<string, string>;

/** A persisted need-or-want entry — stores everything the user entered. */
export interface NeedOrWantEntry {
  id: string;
  at: number;
  itemName: string;
  itemPrice: string;
  currency: string;
  itemReason: string;
  category: NeedOrWantCategory;
  categoryLabel: string;
  responses: NeedOrWantResponses;
  summary: string;
  cooldownStart: number;
  /** null = still waiting; true = still want it; false = don't need it anymore */
  decision: boolean | null;
  decidedAt?: number;
}

/** 24-hour cooldown duration in milliseconds. */
export const NEED_OR_WANT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a reflection summary based on the user's responses and category.
 * Discourages unnecessary purchases while avoiding shame.
 */
export function needOrWantSummary(responses: NeedOrWantResponses, category: NeedOrWantCategory): string {
  const feeling = responses['feeling'] || '';
  const emotionalTrigger = feeling === 'Boredom' || feeling === 'Stress' || feeling === 'Fear of missing out';

  // Category-specific impulse signals
  let impulseSignals: boolean[] = [];

  switch (category) {
    case 'food':
      impulseSignals = [
        responses['food-home'] === 'Yes, plenty',
        responses['food-healthy'] === 'Just a craving',
        responses['food-can-cook'] === 'Yes, definitely',
        responses['food-hunger'] === 'It\'s boredom or stress',
        emotionalTrigger,
      ];
      break;
    case 'clothing':
      impulseSignals = [
        responses['closet-similar'] === 'Yes, multiple items',
        responses['closet-wear'] === 'Probably not that many',
        responses['closet-match'] === 'No, it stands alone' || responses['closet-match'] === 'I\'d need to buy more to match it',
        responses['closet-trend'] === 'Just a trend',
        emotionalTrigger,
      ];
      break;
    case 'electronics':
      impulseSignals = [
        responses['tech-broken'] === 'No, it works fine',
        responses['tech替代'] === 'Yes, I have alternatives',
        responses['tech-wait'] === 'No, the urge would pass',
        responses['tech-research'] === 'Pure impulse',
        emotionalTrigger,
      ];
      break;
    case 'home':
      impulseSignals = [
        responses['home-space'] === 'No, it would be clutter',
        responses['home-purpose'] === 'No, it\'s decorative',
        responses['home-diy'] === 'Yes, easily',
        responses['home-style'] === 'No, it\'s very different',
        emotionalTrigger,
      ];
      break;
    case 'beauty':
      impulseSignals = [
        responses['beauty-stock'] === 'Yes, I have plenty',
        responses['beauty-essential'] === 'Just a nice-to-have',
        responses['beauty-size'] === 'It would probably expire',
        responses['beauty-similar'] === 'Yes, and it didn\'t work',
        emotionalTrigger,
      ];
      break;
    case 'entertainment':
      impulseSignals = [
        responses['ent-sub-active'] === 'Yes, several',
        responses['ent-free-alt'] === 'Yes, plenty of free options',
        responses['ent-frequency'] === 'Maybe once and forget',
        responses['ent-trial'] === 'I\'d rather just buy it',
        emotionalTrigger,
      ];
      break;
    case 'other':
      impulseSignals = [
        responses['other-purpose'] === 'No real problem, just want it',
        responses['other-similar'] === 'Yes, I do',
        responses['other-wait'] === 'Yes, I can wait',
        responses['other-regret'] === 'Probably regret it',
        emotionalTrigger,
      ];
      break;
  }

  const impulseScore = impulseSignals.filter(Boolean).length;

  if (impulseScore >= 4) {
    return `This ${category === 'food' ? 'food purchase' : 'purchase'} looks like an impulse, not a need. You have similar items at home, and you can wait. Saving this money today means more freedom tomorrow. Give yourself 24 hours - if you still want it then, it was meant to be.`;
  }

  if (impulseScore >= 2) {
    return `There are some warning signs here. You might already have what you need, or this could stretch your budget. Waiting 24 hours costs nothing but could save you from regret. Your future self will thank you for the pause.`;
  }

  if (impulseScore >= 1) {
    return `This might be worth buying, but the fact that you paused to think shows growth. Take 24 hours to sit with this decision. If it still feels right tomorrow, go for it with confidence.`;
  }

  return `This looks like a genuine need that you've thought through carefully. Taking time to reflect before buying is always the right move - you're building a healthier relationship with your money.`;
}
