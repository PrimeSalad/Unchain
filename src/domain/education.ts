/**
 * Education Hub — pure domain: built-in guides, curated free resources, and
 * the personalization rules that adapt both to the user's addiction type.
 *
 * Content principles:
 *  - Evidence-based and neutral: grounded in CBT, habit science, and the
 *    public-health literature. No moralising, no shame, no scare tactics.
 *  - Fully offline: every guide ships with the app. External resources are
 *    free, legal sources (public-domain books, open-access publications) and
 *    are clearly links — nothing is scraped or embedded.
 *  - Personalized: guides, resources, and categories derive from
 *    profile.addictionType, so changing the profile re-personalizes the hub
 *    automatically.
 */

import type { AddictionType } from './gambling';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GuideSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface Guide {
  id: string;
  title: string;
  subtitle: string;
  /** Ionicons glyph. */
  icon: string;
  audience: AddictionType[] | 'all';
  minutes: number;
  sections: GuideSection[];
}

export interface EduCategory {
  id: string;
  label: string;
  /** Ionicons glyph. */
  icon: string;
}

export interface Resource {
  id: string;
  title: string;
  author: string;
  desc: string;
  category: string;
  audience: AddictionType[] | 'all';
  /** "220 pages" or "~15 min read". */
  length: string;
  readUrl: string;
  /** Only set when a legal, stable PDF download exists. */
  pdfUrl?: string;
  /** Generated cover tint (no remote images — offline + no rights issues). */
  tint: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories — universal set + addiction-specific additions
// ─────────────────────────────────────────────────────────────────────────────

const UNIVERSAL_CATEGORIES: EduCategory[] = [
  { id: 'recovery', label: 'Recovery Basics', icon: 'compass' },
  { id: 'habits', label: 'Habit Formation', icon: 'repeat' },
  { id: 'impulse', label: 'Impulse Control', icon: 'hand-left' },
  { id: 'mindfulness', label: 'Mindfulness & Stress', icon: 'leaf' },
  { id: 'relationships', label: 'Relationships', icon: 'people' },
  { id: 'growth', label: 'Personal Growth', icon: 'trending-up' },
];

const SPECIFIC_CATEGORIES: Partial<Record<AddictionType, EduCategory[]>> = {
  gambling: [
    { id: 'gambling', label: 'Gambling Recovery', icon: 'dice' },
    { id: 'money', label: 'Financial Recovery', icon: 'wallet' },
  ],
  pornography: [
    { id: 'porn', label: 'Pornography Recovery', icon: 'shield-checkmark' },
    { id: 'sexuality', label: 'Healthy Intimacy', icon: 'heart' },
  ],
  social_media: [{ id: 'digital', label: 'Digital Well-Being', icon: 'phone-portrait' }],
  smoking: [{ id: 'smoking', label: 'Quitting Smoking', icon: 'cloud-offline' }],
  alcohol: [{ id: 'alcohol', label: 'Alcohol Recovery', icon: 'wine' }],
  drugs: [{ id: 'substances', label: 'Substance Recovery', icon: 'medkit' }],
};

/** The category set a user of this addiction type sees, specific first. */
export function categoriesFor(type: AddictionType): EduCategory[] {
  return [...(SPECIFIC_CATEGORIES[type] ?? []), ...UNIVERSAL_CATEGORIES];
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in guides — offline, evidence-based, per addiction
// ─────────────────────────────────────────────────────────────────────────────

/** Shared closing section — the same honest guidance for every addiction. */
const SEEK_HELP = (examples: string): GuideSection => ({
  heading: 'When to consider professional help',
  body: [
    'Self-help tools work best alongside support, not instead of it. Reaching out is a practical step, not a last resort — most people who recover well have help at some point.',
    'It is reasonable to talk to a doctor, counsellor, or support group when:',
  ],
  bullets: [
    examples,
    'You have tried to cut down more than once and it has not stuck.',
    'The behavior is affecting work, school, money, sleep, or people you love.',
    'You feel low, anxious, or hopeless more days than not.',
    'You are using the behavior to cope with something painful underneath.',
    'If you ever have thoughts of harming yourself, contact local emergency services or a crisis hotline right away.',
  ],
});

const GUIDES: Guide[] = [
  // ── Gambling ───────────────────────────────────────────────────────────────
  {
    id: 'g-gambling',
    title: 'Understanding Gambling Addiction',
    subtitle: 'Odds, urges, chasing losses — and the way out',
    icon: 'dice',
    audience: ['gambling'],
    minutes: 9,
    sections: [
      {
        heading: 'What gambling addiction is',
        body: [
          'Gambling disorder is a recognised behavioral addiction: the drive to keep betting despite mounting harm. It is not a weakness of character — gambling products are engineered around intermittent rewards, the same reinforcement pattern that trains lab animals fastest and holds humans hardest.',
          'Near-misses, bonus rounds, and fast bet-to-result loops keep the brain\'s reward system firing on possibility rather than payout. Over time the activity stops being about winning money and becomes about escaping discomfort — boredom, stress, shame, or the losses themselves.',
        ],
      },
      {
        heading: 'Why people get pulled in',
        body: [
          'Nobody chooses addiction. Common on-ramps are an early big win (which the brain over-remembers), gambling to cope with stress or loneliness, easy 24/7 access on a phone, payday rituals, and the belief that skill or systems can beat the odds.',
          'Financial pressure is a cruel accelerator: the worse the losses, the stronger the pull to win them back — which is precisely how the losses grow.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "I\'m due for a win." Fact: every spin, draw, and hand is independent. Past losses do not raise your odds — this is the gambler\'s fallacy.',
          'Myth: "Chasing losses can dig me out." Fact: the house edge means longer play loses more on average. Chasing is how debts compound.',
          'Myth: "Near-misses mean I\'m close." Fact: near-misses are designed outcomes that fire reward circuitry without paying anything.',
          'Myth: "I can win it back with a system." Fact: no betting pattern changes the underlying odds of an independent random event.',
          'Myth: "Only weak people get addicted." Fact: these products are optimised by teams of engineers to defeat self-control. Getting hooked is the design working.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'Finances take the visible hit — drained savings, borrowed money, hidden debt, and the constant mental accounting of what could be recovered. But the quieter costs run deeper: secrecy strains relationships, sleep breaks under late sessions and worry, focus at work shrinks to the next chance to play, and mood swings track wins and losses.',
          'Many people describe the worst part not as the money but the shrinking of life — hobbies, friendships, and plans crowded out by one activity.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'Betting more than planned, more often than planned.',
          'Chasing losses, or returning "one last time" to break even.',
          'Hiding gambling or its costs from people close to you.',
          'Borrowing, selling things, or missing bills to fund play.',
          'Restlessness or irritability when trying to cut down.',
          'Gambling to escape stress, sadness, or boredom.',
          'Work, school, sleep, or relationships taking damage.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: [
          'Make gambling harder to reach and money harder to move — friction is your friend.',
        ],
        bullets: [
          'Block gambling sites and apps (this app\'s Focus Protection is built for exactly this).',
          'Add money friction: let a trusted person hold cards, set bank gambling blocks, keep only small cash.',
          'Self-exclude from venues and betting sites — most offer formal programs.',
          'Track honestly: a daily journal entry turns fog into data, and data shows progress.',
          'Plan for triggers: payday, sports events, ads, and free time are predictable — schedule something incompatible with betting.',
          'Treat debt as a project, not a shame: list it, talk to creditors, and consider free debt-advice services.',
          'Expect urges and relapses to be part of recovery, not proof of failure. Each one mapped is one weakened.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: [
          'Urges crest and fall like waves, usually within 15–30 minutes. Your job is not to fight the wave but to outlast it.',
        ],
        bullets: [
          'Delay: tell yourself "not in the next 15 minutes" — then use the SOS tools here.',
          'Breathe: a few minutes of slow, exhale-heavy breathing lowers arousal measurably.',
          'Move: a walk changes body chemistry and location — two triggers gone at once.',
          'Say it out loud: message one person "having an urge." Naming it shrinks it.',
          'Play a no-stakes game (the games in this app exist for this exact moment).',
        ],
      },
      SEEK_HELP('You feel unable to stop despite serious financial harm or growing debt.'),
    ],
  },

  // ── Pornography ───────────────────────────────────────────────────────────
  {
    id: 'g-porn',
    title: 'Understanding Compulsive Pornography Use',
    subtitle: 'Habits, emotional regulation, and rebuilding connection',
    icon: 'shield-checkmark',
    audience: ['pornography'],
    minutes: 8,
    sections: [
      {
        heading: 'What compulsive use is',
        body: [
          'Compulsive pornography use means the habit has moved from a choice to a pull — using more than intended, escalating to stay stimulated, and continuing despite costs to mood, focus, or relationships.',
          'The mechanism is ordinary neuroscience, not moral failure: unlimited novelty on demand trains the reward system to expect intense stimulation with zero effort, which can mute interest in slower, real-world rewards for a while. The good news: this is trainable in both directions.',
        ],
      },
      {
        heading: 'Why the habit forms',
        body: [
          'Most compulsive use is emotional regulation in disguise: a fast, private way to switch off stress, loneliness, boredom, anxiety, or insomnia. Late nights, being alone, and aimless scrolling are the classic on-ramps.',
          'Because the relief is instant and reliable, the brain files it as the go-to answer for any discomfort — which is how a coping shortcut becomes a loop.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "Struggling with this means something is wrong with me." Fact: compulsive use is common and responds well to ordinary habit-change methods.',
          'Myth: "Willpower alone should be enough." Fact: environment design (blockers, phone habits, sleep) beats willpower every time.',
          'Myth: "A slip ruins everything." Fact: a lapse is a data point. The all-or-nothing belief is what turns one slip into a binge.',
          'Myth: "Quitting means never thinking about sex." Fact: recovery is about compulsion, not desire. Healthy sexuality is a goal, not the enemy.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'Heavy use commonly crowds out sleep (late-night sessions), drains next-day focus and motivation, and feeds a shame loop that lowers mood — which then triggers more use. In relationships it can create secrecy and distance, and make real intimacy feel flatter than the screen.',
          'None of this is permanent. People consistently report that mood, energy, focus, and connection recover as the compulsive loop weakens.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'Using longer or more often than you intended, repeatedly.',
          'Escalating content to get the same effect.',
          'Using to escape stress, loneliness, or low mood.',
          'Losing sleep, missing commitments, or hiding use.',
          'Feeling flat, irritable, or foggy afterwards.',
          'It is interfering with a real relationship, or with wanting one.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: [
          'Attack the loop, not yourself: change the cue, add friction, and give the need underneath a better answer.',
        ],
        bullets: [
          'Identify your pattern — this app\'s journal asks exactly the right questions (when, what led up, what you felt before).',
          'Add friction: content blockers, phone out of the bedroom, no aimless scrolling in bed.',
          'Protect sleep: a fixed lights-out time removes the highest-risk window for most people.',
          'Fill the slot: the urge usually arrives at predictable times — put something real there (walk, shower, call, game).',
          'Practise self-compassion deliberately: shame fuels the loop; kindness starves it. Talk to yourself like a friend in recovery.',
          'Track clean days and urges — visible progress is powerful fuel.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: ['Urges are loud but short. Outlast, don\'t out-argue.'],
        bullets: [
          'Get out of the trigger position: stand up, leave the room, lights on.',
          'Do 2 minutes of paced breathing (the SOS orb sets the pace).',
          'Cold water on the face or a quick shower — a hard state-changer.',
          'Message someone, or write an Emergency Reflection right here.',
          'Set a 15-minute timer. Most urges do not survive it.',
        ],
      },
      SEEK_HELP('Use keeps escalating, or it is harming a relationship you value.'),
    ],
  },

  // ── Social media ──────────────────────────────────────────────────────────
  {
    id: 'g-social',
    title: 'Understanding Compulsive Social Media Use',
    subtitle: 'Dopamine-driven scrolling and how to take your attention back',
    icon: 'phone-portrait',
    audience: ['social_media'],
    minutes: 8,
    sections: [
      {
        heading: 'What compulsive use is',
        body: [
          'Compulsive social media use is the loss of control over checking and scrolling: reaching for the phone without deciding to, losing hours to feeds, and feeling unable to stop despite wanting to.',
          'Feeds are built on variable rewards — sometimes the next scroll is great, usually it is not — which is the most habit-forming reinforcement schedule known. Infinite scroll removes every natural stopping point on purpose.',
        ],
      },
      {
        heading: 'Why it hooks us',
        body: [
          'The pull is engineered: notifications interrupt with social promise, likes deliver social validation in measurable doses, and algorithms learn precisely what keeps you watching. Add boredom, awkward silences, and the habit of filling every idle second, and checking becomes automatic.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "It\'s just a bad habit, not a real problem." Fact: excessive use measurably affects sleep, mood, focus, and self-esteem — that is real.',
          'Myth: "I need it for everything." Fact: most people need specific functions (messages, groups), not the feed. The feed is the product; the functions are the excuse.',
          'Myth: "Quitting means deleting everything forever." Fact: most successful changes are structural — removing feeds, not friends.',
          'Myth: "Everyone else\'s life really is like their feed." Fact: feeds are highlight reels; comparing your inside to someone\'s outside is rigged.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'The costs are attention-shaped: fragmented focus, "phantom" checking mid-task, doomscrolling that displaces sleep, and mood dips from comparison. Relationships feel it too — present in body, absent in attention.',
          'Time-use studies keep finding the same thing: heavy users underestimate their screen time by hours. The journal here helps you see the real number without judgment.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'Checking within minutes of waking, or during every pause.',
          'Losing chunks of time you intended to spend elsewhere.',
          'Scrolling in bed and paying for it the next day.',
          'Feeling worse after — envy, agitation, emptiness — yet returning.',
          'Phantom vibrations, or anxiety when the phone is out of reach.',
          'Work, study, or people getting the leftovers of your attention.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: ['You are not fighting yourself — you are re-designing an environment built to defeat you.'],
        bullets: [
          'Kill the feed, keep the function: use messaging directly, unfollow aggressively, try feed-blocker settings.',
          'Turn off every non-human notification. People can interrupt you; algorithms cannot.',
          'Make the phone boring: grayscale mode, home screen with tools only, apps behind a search.',
          'Create phone-free zones and times: bedroom, meals, first hour of the day.',
          'Replace, don\'t just remove: the checking urge is often a boredom or connection need — give it a real answer.',
          'Use this app\'s blocklist for the sites that pull you in hardest.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: ['The reach-for-phone impulse takes seconds to pass if you notice it.'],
        bullets: [
          'Feel the impulse, name it: "urge to check." Wait ten seconds.',
          'Put the phone in another room and let discomfort settle — it does.',
          'Swap the motion: open the breathing tool instead of the feed.',
          'Bored? Boredom is withdrawal from stimulation — it fades and focus returns.',
        ],
      },
      SEEK_HELP('Screen time keeps overriding sleep, work, or relationships despite real attempts to change.'),
    ],
  },

  // ── Smoking ───────────────────────────────────────────────────────────────
  {
    id: 'g-smoking',
    title: 'Understanding Nicotine Addiction',
    subtitle: 'Cigarettes, vapes, and the loop of relief that isn\'t',
    icon: 'cloud-offline',
    audience: ['smoking'],
    minutes: 8,
    sections: [
      {
        heading: 'What nicotine addiction is',
        body: [
          'Nicotine is one of the most dependence-forming substances known — not because the high is big, but because the cycle is fast. Each dose relieves the withdrawal the previous dose created, so smoking feels like stress relief when it is mostly relief from nicotine\'s own absence.',
          'Vaping runs the same loop, often with higher nicotine delivery and fewer natural pauses.',
        ],
      },
      {
        heading: 'Why the habit forms',
        body: [
          'Beyond the chemistry, smoking weaves into daily ritual: with coffee, after meals, on breaks, in stress, in company. Each pairing becomes a trigger, which is why "just one" moments feel everywhere. Most smokers started young, before the risks felt real — dependence did the rest.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "Smoking calms me down." Fact: nicotine relieves nicotine withdrawal. Non-smokers do not carry that background stress at all.',
          'Myth: "The damage is done, no point quitting." Fact: benefits start within hours (heart rate) and compound for years; quitting at any age extends life.',
          'Myth: "Cutting down is as good as quitting." Fact: even light smoking carries major risk; complete cessation is where the health curve bends.',
          'Myth: "I\'ve failed before, so I can\'t." Fact: most successful quitters needed several attempts. Each one teaches the next.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'Health effects are well documented — heart, lungs, cancers, healing, skin. Day to day it also taxes money (count your monthly spend in this app), fitness, taste and smell, sleep quality, and the low-grade anxiety of managing supply and cravings.',
        ],
      },
      {
        heading: 'Signs dependence is deepening',
        body: [],
        bullets: [
          'Smoking within 30 minutes of waking.',
          'Needing more per day, or stronger products, for the same effect.',
          'Irritability, restlessness, or poor focus when you cannot smoke.',
          'Abandoning cut-down plans repeatedly.',
          'Planning your day around chances to smoke or vape.',
        ],
      },
      {
        heading: 'Quitting strategies that work',
        body: ['Quitting is a skill with a strong evidence base — stack the proven pieces.'],
        bullets: [
          'Pick a quit date within two weeks and tell people — commitment works.',
          'Consider nicotine replacement (patches, gum, lozenges) or ask a doctor about cessation medicines; they roughly double success rates.',
          'Break the pairings: change the coffee spot, leave the table after meals, new break routine.',
          'Remove supply and paraphernalia the night before — all of it.',
          'Know the timeline: cravings peak in the first 3 days, ease over 2–4 weeks. It is finite.',
          'Track money not smoked — watch it become something real.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: ['A craving lasts 3–5 minutes whether or not you smoke. Ride it.'],
        bullets: [
          'The 4 Ds: Delay, Deep breathe, Drink water, Do something else.',
          'Hands and mouth busy: toothpick, gum, cold water, walk.',
          'Slow exhale breathing mimics the smoking rhythm — often what the body misses.',
          'Urge-surf with the SOS tools; log it and watch the count of survived cravings grow.',
        ],
      },
      SEEK_HELP('Withdrawal feels unmanageable, or health issues make quitting urgent.'),
    ],
  },

  // ── Alcohol ───────────────────────────────────────────────────────────────
  {
    id: 'g-alcohol',
    title: 'Understanding Alcohol Problems',
    subtitle: 'From habit creep to dependence — honestly, without shame',
    icon: 'wine',
    audience: ['alcohol'],
    minutes: 9,
    sections: [
      {
        heading: 'What problem drinking is',
        body: [
          'Alcohol problems sit on a spectrum, from creeping habit (every evening, a bit more each year) to physical dependence. The line that matters is simple: drinking is a problem when it keeps costing you things — health, mornings, money, trust, memory — and you keep doing it anyway.',
          'Alcohol is a depressant that the brain adapts to; with regular use it recalibrates, so stopping produces rebound anxiety and poor sleep that feel like reasons to drink again.',
        ],
      },
      {
        heading: 'Why drinking escalates',
        body: [
          'Alcohol is legal, social, and marketed as the default answer to both celebration and stress. Tolerance quietly raises the dose; "wine o\'clock" rituals harden into needs; and drinking to sleep or to numb feelings trains the brain to skip other coping entirely.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "I\'m fine because I only drink beer / only at night / never before 5." Fact: pattern rules do not change what the dose does.',
          'Myth: "Alcohol helps me sleep." Fact: it sedates, then fragments sleep — REM suffers and 3 a.m. wakefulness follows.',
          'Myth: "Real alcoholics are falling down. I function." Fact: high-functioning dependence is common and still compounds harm.',
          'Myth: "Quitting cold is the only way." Fact: for heavy daily drinkers, sudden stopping can be medically dangerous — tapering with medical advice is safer. For others, structured cutting down or sobriety both work.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'Beyond liver, heart, and cancer risk, regular drinking erodes the everyday: sleep quality, morning energy, mood stability, judgment, money, and the reliability people feel from you. Many people only see the size of the effect after 30 days without — which is itself a useful experiment.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'Needing more for the same effect, or "pre-drinking" before events.',
          'Drinking earlier, alone, or in secret.',
          'Failed cut-down rules ("weekends only") that keep bending.',
          'Memory gaps, morning shakes, or drinking to steady nerves.',
          'People you trust have raised it, or you hide amounts from them.',
          'Responsibilities, safety, or relationships taking hits.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: [
          'Important safety note: if you drink heavily every day, talk to a doctor before stopping abruptly — withdrawal can be dangerous and is very manageable with help.',
        ],
        bullets: [
          'Make the house dry — distance beats discipline at 9 p.m.',
          'Change the ritual, keep the slot: alcohol-free versions, new glass, new drink, same couch.',
          'Tell people and give the refusal one sentence: "I\'m not drinking at the moment."',
          'Plan the danger windows: Friday night, stress spikes, certain company.',
          'Fix sleep without alcohol — it is the keystone habit that makes everything easier.',
          'Count your streak and money saved here; visible wins carry the boring middle weeks.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: ['Cravings pass. Every one you outlast weakens the wiring.'],
        bullets: [
          'Cold non-alcoholic drink in hand immediately — occupies ritual and thirst.',
          'Change rooms or go outside; state change kills momentum.',
          'Slow breathing or a shower for stress spikes.',
          'Message someone, or log the urge here and watch it pass.',
        ],
      },
      SEEK_HELP('You experience shakes, sweats, or anxiety when not drinking — see a doctor before stopping.'),
    ],
  },

  // ── Drugs / substances ───────────────────────────────────────────────────
  {
    id: 'g-drugs',
    title: 'Understanding Substance Addiction',
    subtitle: 'What dependence does, and how recovery actually goes',
    icon: 'medkit',
    audience: ['drugs'],
    minutes: 8,
    sections: [
      {
        heading: 'What substance addiction is',
        body: [
          'Addiction is a learned, compulsive loop: a substance reliably changes how you feel, the brain over-learns the shortcut, tolerance raises the dose, and eventually the substance is needed to feel normal rather than good. Medicine treats it as a health condition — because that is what the evidence shows it is.',
          'Different substances differ in risk and withdrawal, but the recovery principles below hold across them.',
        ],
      },
      {
        heading: 'Why it develops',
        body: [
          'The strongest predictors are not weakness but exposure and pain: stress, trauma, untreated anxiety or depression, chronic pain, social environment, and genetics. The substance works — briefly — for something real. Recovery means finding better answers for that real thing.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "Addiction is a choice." Fact: the first use may be; the compulsive loop is learned brain adaptation that takes work to unlearn.',
          'Myth: "Rock bottom is required." Fact: people recover at every stage; earlier is easier and safer.',
          'Myth: "Relapse means treatment failed." Fact: relapse rates resemble other chronic conditions; adjusting the plan is normal medicine.',
          'Myth: "Medication-assisted treatment is just substitution." Fact: for opioids especially, it is the strongest-evidence path and saves lives.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'Beyond the substance-specific health risks, dependence reorganises life around supply and recovery from use: money leaks, sleep breaks, work slips, honesty erodes under secrecy, and relationships carry the strain. The fog lifts surprisingly fast for many once use stops — that early clarity is worth protecting.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'Needing more for the same effect.',
          'Using to avoid withdrawal or to feel functional.',
          'Failed attempts to cut down or control use.',
          'Craving that intrudes on work, study, or sleep.',
          'Continuing despite health, money, legal, or relationship harm.',
          'Giving up activities that used to matter.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: [
          'Safety first: withdrawal from some substances (alcohol, benzodiazepines, opioids) needs medical guidance. A doctor is a recovery tool, not a judgment.',
        ],
        bullets: [
          'Change the environment: distance from supply, from using spaces, and where needed from using company.',
          'Structure beats willpower: fill high-risk hours with fixed commitments.',
          'Use support — groups (12-step, SMART Recovery), counselling, or medication-assisted treatment where appropriate.',
          'Sleep, food, movement: boring, and they measurably cut craving intensity.',
          'Track clean days here; plan specifically for the situations that ended previous attempts.',
          'Have a lapse plan written in advance: who you call, what you do next, no spiral.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: ['Cravings are intense but time-limited. Plan to outlast, not out-argue.'],
        bullets: [
          'Leave the situation — physical distance first, debate later.',
          'Call or message your person; isolation is craving\'s best friend.',
          'Slow breathing, cold water, hard exercise burst — pick your state-changer.',
          'Log the urge here. Surviving one is a rep; reps build the muscle.',
        ],
      },
      SEEK_HELP('Withdrawal is physically rough, or use involves opioids, alcohol, or benzodiazepines — medical support makes this far safer.'),
    ],
  },

  // ── Other / general ──────────────────────────────────────────────────────
  {
    id: 'g-other',
    title: 'Understanding Behavioral Addictions',
    subtitle: 'The shared mechanics of any compulsive habit',
    icon: 'infinite',
    audience: ['other'],
    minutes: 7,
    sections: [
      {
        heading: 'What a behavioral addiction is',
        body: [
          'Any behavior that reliably changes how you feel — gaming, shopping, eating, trading, exercise, anything — can become compulsive: repeated more than intended, hard to stop, and continued despite harm. The substance is optional; the loop is the addiction.',
          'The loop is always the same shape: cue → urge → behavior → relief → repetition, with the relief teaching the brain to run it again, faster, next time.',
        ],
      },
      {
        heading: 'Why loops form',
        body: [
          'Compulsive habits are usually solutions that outlived their usefulness — ways of coping with stress, boredom, loneliness, or pain that worked instantly and got over-learned. Availability matters too: what is always within reach gets woven in deepest.',
        ],
      },
      {
        heading: 'Myths and facts',
        body: [],
        bullets: [
          'Myth: "It\'s not a real addiction if there\'s no substance." Fact: behavioral addictions engage the same reward circuitry and respond to the same treatments.',
          'Myth: "I should be able to stop by deciding to." Fact: loops live in environment and routine; redesigning those is what works.',
          'Myth: "One slip means starting from zero." Fact: progress is cumulative — the skills and days you built do not vanish with a lapse.',
        ],
      },
      {
        heading: 'How it affects life',
        body: [
          'The costs depend on the behavior, but the pattern is shared: time and attention drain first, then sleep, then money or health, then honesty (hiding it), then relationships. The tell is narrowing — life organising itself around one activity.',
        ],
      },
      {
        heading: 'Signs it is becoming a problem',
        body: [],
        bullets: [
          'More time or intensity than intended, repeatedly.',
          'Restlessness or low mood when you cannot do it.',
          'Broken personal rules and failed cut-downs.',
          'Hiding the extent from people close to you.',
          'Work, sleep, money, or relationships absorbing damage.',
        ],
      },
      {
        heading: 'Recovery strategies that work',
        body: [],
        bullets: [
          'Map your loop in the journal: cue, feeling, behavior, payoff. Precision beats guilt.',
          'Add friction to the behavior and remove friction from alternatives.',
          'Time-box or fully abstain — pick the rule that fits the behavior and your history with rules.',
          'Fill the vacated time deliberately; empty hours refill themselves with the old habit.',
          'Recruit one accountable person. Secrets feed loops.',
          'Track streaks and urges here — the trend is the motivation.',
        ],
      },
      {
        heading: 'Healthy coping in the moment',
        body: [],
        bullets: [
          'Pause and name the urge — observation weakens automaticity.',
          'Delay 15 minutes and change location.',
          'Breathe slow, move fast, or get cold — any deliberate state change.',
          'Open this app instead: SOS, a game, a walk, a journal line.',
        ],
      },
      SEEK_HELP('The behavior keeps overriding serious commitments, or it is tangled with anxiety, depression, or trauma.'),
    ],
  },

  // ── Universal guides ──────────────────────────────────────────────────────
  {
    id: 'g-urges',
    title: 'Urge Surfing',
    subtitle: 'The core skill: outlasting a craving without a fight',
    icon: 'water',
    audience: 'all',
    minutes: 4,
    sections: [
      {
        heading: 'The idea',
        body: [
          'An urge is a wave: it rises, peaks, and always falls — typically within 15–30 minutes, often faster. Fighting it ("don\'t think about it") feeds it attention; giving in resets the clock harder. Urge surfing is the third option: observe it like weather and let it pass.',
        ],
      },
      {
        heading: 'How to surf',
        body: [],
        bullets: [
          'Notice and name: "This is an urge. It will peak and fade."',
          'Find it in your body — chest, hands, stomach. Describe the sensation neutrally, like a scientist.',
          'Breathe slowly into it. You are not suppressing; you are watching.',
          'Rate it 1–10 every couple of minutes. Watching the number fall is the lesson.',
          'When it passes — and it will — log it. Every surfed urge permanently weakens the loop.',
        ],
      },
      {
        heading: 'Why it works',
        body: [
          'Cravings are conditioned responses. Every time a cue fires and the behavior does NOT follow, the association weakens — extinction, the most reliable finding in learning science. You are not white-knuckling; you are retraining.',
        ],
      },
    ],
  },
  {
    id: 'g-lapse',
    title: 'Lapse vs. Relapse',
    subtitle: 'Why one slip never has to become a spiral',
    icon: 'trending-up',
    audience: 'all',
    minutes: 4,
    sections: [
      {
        heading: 'The most dangerous belief in recovery',
        body: [
          'It is not "one more won\'t hurt." It is "I\'ve ruined everything, so it doesn\'t matter now." Researchers call it the abstinence violation effect: the shame after a slip, not the slip itself, is what powers binges.',
          'A lapse is an event. A relapse is a decision made after the event. That gap is where recovery lives.',
        ],
      },
      {
        heading: 'If you slip',
        body: [],
        bullets: [
          'Stop the moment now — the first hour after a lapse matters most.',
          'Be blunt and kind: "That was a lapse. It does not erase my progress."',
          'Log it honestly here. The streak resets; the skills, insight, and days you built do not.',
          'Mine it: what was the cue, the feeling, the opening? That answer is next time\'s defense.',
          'Tell one person. Shame grows in the dark and dies in the open.',
        ],
      },
      {
        heading: 'The long view',
        body: [
          'Recovery is almost never a straight line, and the data says attempts stack: each one carries learning into the next. The people who make it are rarely the ones who never slipped — they are the ones who kept coming back fast.',
        ],
      },
    ],
  },
  {
    id: 'g-habits',
    title: 'Rebuilding Your Habit Loops',
    subtitle: 'Using habit science to replace, not just remove',
    icon: 'repeat',
    audience: 'all',
    minutes: 5,
    sections: [
      {
        heading: 'Cue, routine, reward',
        body: [
          'Every habit — good or destructive — runs the same circuit: a cue triggers a routine that delivers a reward. Removing a routine while leaving the cue and the need creates a vacuum, and vacuums refill with the old habit. Durable change swaps the routine while honoring the need.',
        ],
      },
      {
        heading: 'The playbook',
        body: [],
        bullets: [
          'Find the cue: time, place, feeling, people, or the previous action. Your journal reveals it within a week.',
          'Name the real reward: relief? stimulation? connection? numbness? The new routine must pay the same bill.',
          'Choose a replacement that is easy, fast, and available at the cue moment — this app\'s Healthy Alternatives are built as drop-in swaps.',
          'Engineer the environment: make the old routine 20 seconds harder and the new one 20 seconds easier.',
          'Stack it: attach the new routine to an existing anchor ("after coffee, I walk").',
          'Expect ~2 months of reps before it feels automatic. Consistency beats intensity.',
        ],
      },
      {
        heading: 'Identity is the endgame',
        body: [
          'The strongest habits are identity-backed. "I\'m trying to quit" fights yourself; "I don\'t gamble / I\'m not a smoker" settles the argument before it starts. Every clean day logged here is a vote for the person you are becoming.',
        ],
      },
    ],
  },
];

/** Guides visible to a user: their addiction's guides first, then universal. */
export function guidesFor(type: AddictionType): Guide[] {
  const specific = GUIDES.filter((g) => g.audience !== 'all' && g.audience.includes(type));
  const universal = GUIDES.filter((g) => g.audience === 'all');
  return [...specific, ...universal];
}

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Free reading — public-domain books and open-access resources. Every link is
// a free, legal source. Gutenberg titles offer full online reading; PDF
// downloads are only listed where the source provides one.
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCES: Resource[] = [
  // Addiction-specific
  {
    id: 'r-gambler',
    title: 'The Gambler',
    author: 'Fyodor Dostoevsky',
    desc: 'The classic novel of compulsive gambling, written by an author who lived it — the psychology of chasing losses has never been drawn sharper.',
    category: 'gambling',
    audience: ['gambling'],
    length: '~190 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/2197',
    tint: '#B23A4B',
  },
  {
    id: 'r-money-getting',
    title: 'The Art of Money Getting',
    author: 'P. T. Barnum',
    desc: 'A short, plain-spoken classic on keeping and growing money — useful scaffolding while rebuilding finances in recovery.',
    category: 'money',
    audience: ['gambling'],
    length: '~60 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/8581',
    tint: '#97591F',
  },
  {
    id: 'r-barleycorn',
    title: 'John Barleycorn',
    author: 'Jack London',
    desc: 'London\'s famous "alcoholic memoirs" — an unflinching first-person account of how drinking weaves into a life, decades ahead of its time.',
    category: 'alcohol',
    audience: ['alcohol'],
    length: '~230 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/search/?query=john+barleycorn+jack+london',
    tint: '#5A2E7A',
  },
  {
    id: 'r-opium',
    title: 'Confessions of an English Opium-Eater',
    author: 'Thomas De Quincey',
    desc: 'The first great addiction memoir — dependence, withdrawal, and relapse described from the inside, still recognisable two centuries later.',
    category: 'substances',
    audience: ['drugs'],
    length: '~120 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/search/?query=confessions+of+an+english+opium+eater',
    tint: '#43265C',
  },
  {
    id: 'r-nida',
    title: 'Drugs, Brains, and Behavior: The Science of Addiction',
    author: 'National Institute on Drug Abuse',
    desc: 'The definitive plain-language, open-access explainer of what addiction does in the brain and why it is treated as a health condition.',
    category: 'substances',
    audience: ['drugs', 'alcohol', 'smoking'],
    length: '~30 pages',
    readUrl: 'https://nida.nih.gov/publications/drugs-brains-behavior-science-addiction',
    tint: '#4A6FA5',
  },
  {
    id: 'r-smokefree',
    title: 'Quit Smoking Resources',
    author: 'Smokefree.gov (U.S. HHS)',
    desc: 'Free, evidence-based quit plans, craving tools, and guides on nicotine replacement — the standard public-health toolkit, open to everyone.',
    category: 'smoking',
    audience: ['smoking'],
    length: 'Guides & tools',
    readUrl: 'https://smokefree.gov',
    tint: '#4E7A5A',
  },
  {
    id: 'r-walden',
    title: 'Walden',
    author: 'Henry David Thoreau',
    desc: 'The original argument for deliberate living and less noise — startlingly relevant to reclaiming attention from feeds and screens.',
    category: 'digital',
    audience: ['social_media', 'pornography'],
    length: '~350 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/205',
    tint: '#4E7A5A',
  },

  // Universal
  {
    id: 'r-meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    desc: 'Two thousand years of field-tested advice on urges, discomfort, and self-command — the Stoic handbook that modern CBT grew from.',
    category: 'mindfulness',
    audience: 'all',
    length: '~250 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/2680',
    tint: '#5A2E7A',
  },
  {
    id: 'r-thinketh',
    title: 'As a Man Thinketh',
    author: 'James Allen',
    desc: 'A one-sitting classic on how thought patterns shape habits and circumstance — short enough to reread whenever resolve dips.',
    category: 'growth',
    audience: 'all',
    length: '~30 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/4507',
    tint: '#D0A070',
  },
  {
    id: 'r-selfhelp',
    title: 'Self-Help',
    author: 'Samuel Smiles',
    desc: 'The 1859 book that named the genre: perseverance, small daily disciplines, and character built one repetition at a time.',
    category: 'habits',
    audience: 'all',
    length: '~380 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/935',
    tint: '#97591F',
  },
  {
    id: 'r-franklin',
    title: 'The Autobiography of Benjamin Franklin',
    author: 'Benjamin Franklin',
    desc: 'Contains history\'s most famous habit-tracking experiment — Franklin\'s thirteen-virtues chart — plus a life built on deliberate self-correction.',
    category: 'habits',
    audience: 'all',
    length: '~230 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/148',
    tint: '#4A6FA5',
  },
  {
    id: 'r-james-habit',
    title: 'Habit',
    author: 'William James',
    desc: 'The founding text of habit psychology: why repetition carves grooves, and how to lay new ones on purpose. Short and remarkably practical.',
    category: 'impulse',
    audience: 'all',
    length: '~70 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/search/?query=habit+william+james',
    tint: '#3E9C9C',
  },
  {
    id: 'r-smart',
    title: 'SMART Recovery Toolbox',
    author: 'SMART Recovery',
    desc: 'Free, science-based worksheets and exercises (CBT-rooted) for urges, beliefs, and lifestyle balance — used by recovery groups worldwide.',
    category: 'recovery',
    audience: 'all',
    length: 'Worksheets & tools',
    readUrl: 'https://smartrecovery.org/toolbox',
    tint: '#E8697A',
  },
  {
    id: 'r-conduct',
    title: 'The Conduct of Life',
    author: 'Ralph Waldo Emerson',
    desc: 'Essays on power, wealth, and behavior — Emerson on ruling appetite rather than being ruled, in prose worth underlining.',
    category: 'growth',
    audience: 'all',
    length: '~280 pages',
    readUrl: 'https://www.gutenberg.org/ebooks/search/?query=conduct+of+life+emerson',
    tint: '#43265C',
  },
];

/** Resources visible to a user: their addiction's items plus universal ones,
 *  restricted to the categories that exist for them. */
export function resourcesFor(type: AddictionType): Resource[] {
  const cats = new Set(categoriesFor(type).map((c) => c.id));
  return RESOURCES.filter(
    (r) => cats.has(r.category) && (r.audience === 'all' || r.audience.includes(type)),
  );
}

export function resourceById(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id);
}
