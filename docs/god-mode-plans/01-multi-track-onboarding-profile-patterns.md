# Plan 1 of 3 — Multi-Track Onboarding, Profile Add, and Pattern Integrity

> Standalone execution plan for correct multi-category intake, an explicit Profile Add flow, safe legacy migration, and a trustworthy “Unlock your patterns” experience.

| Field | Value |
|---|---|
| Status | Core implementation complete; iPhone device and App Store release proof pending |
| Priority | P0 data integrity |
| Baseline | main at 54fd97e |
| Verified current build | npm run typecheck passes; npm test passes 53/53; Expo production web export passes (2026-07-20) |
| Platform posture | iPhone-first, local-only, no account, no analytics |
| Related plans | [Plan 2](02-iphone-log-urge-all-games-apple-ready.md) · [Plan 3](03-category-specific-recovery-engine.md) |

## Outcome

A user who selects several recovery categories answers the correct questions for every category. A user who adds a recovery track later does so through one visible Add button and a complete setup flow. Pattern insights unlock from real journal and urge evidence rather than an unused legacy array.

This plan protects existing history and keeps today’s DailyJournalPlan frozen.

## Implementation checkpoint — 2026-07-20

The core Plan 1 product flow is now initialized and implemented:

- `recoveryTrackSetup.ts` owns per-category drafts, stable step IDs, goal/money/time rules, local-midnight validation, and atomic submissions.
- Onboarding now builds and confirms one independent setup for every selected category.
- Profile now has explicit Add, Finish setup, Switch, Archive, and Resume actions; generic profile edits cannot mutate membership.
- Persisted recovery state is schema v4 with lossless active-snapshot repair and honest `needs_review` legacy secondaries.
- Backup export/import is v4-aware and materializes the current active snapshot before export.
- Pattern insights now aggregate real journals, manually logged urges, and legacy check-ins by track and distinct local date.
- New journals no longer create synthetic low-intensity urge records.

Automated domain coverage increased from 27 to 53 passing tests. Physical iPhone, VoiceOver, Larger Text, privacy-manifest, public Privacy/Support URL, and App Store Connect proof remain release work rather than claimed complete.

## Confirmed defects

| Severity | Defect | Evidence |
|---|---|---|
| P0 | Multi-select changes only the selector, not the questionnaire | src/presentation/screens/OnboardingScreen.tsx:64-88 uses atypes[0] for category metadata and step generation |
| P0 | All follow-up answers are shared scalars | OnboardingScreen.tsx:65-71 has one detail, date, amount, period, trigger list, and reason |
| P0 | Conditional questions depend only on the first category | OnboardingScreen.tsx:83-88; Pornography first plus Gambling second skips Gambling expense |
| P0 | Secondary tracks are fabricated instead of configured | src/application/store.ts:520-541 and 1436-1445 create zero expense, empty triggers, current timestamp, and copied reason |
| P0 | Secondary startedAt violates the local-midnight contract | store.ts uses Date.now while src/domain/gambling.ts:263-268 requires local-calendar midnight |
| P0 | Profile adds/removes tracks through incidental chip taps | ProfileScreen.tsx:167-174 and 656-687 immediately mutate selectedAddictions |
| P0 | Generic updateProfile silently creates blank tracks | store.ts:1641-1660 |
| P0 | “Unlock your patterns” is disconnected from current Check In | CheckInInsightsCard.tsx checks checkIns; app/checkin.tsx redirects to journal; addJournal never writes checkIns |
| P1 | Current tests miss the user regression | tests/multi-addiction.test.mjs covers normalization and daily-journal completion, not forms or track creation |

At the original baseline, docs/improvements.md incorrectly called multi-category onboarding complete: only the selector was multi-select and intake was first-category-only. The implementation checkpoint above closes that specific gap.

## Non-negotiable product contract

1. A track does not exist as active recovery state until its required setup is valid and confirmed.
2. Shared identity and per-track recovery answers have explicit ownership.
3. N selected categories produce N independent drafts and N configured snapshots.
4. Opening, switching, adding, archiving, and resuming are different actions.
5. Cancel or dismiss produces no persisted track mutation.
6. Today’s DailyJournalPlan remains unchanged; membership changes apply to the next plan.
7. Existing journal, urge, relapse, streak, points, timeline, feature, and archived-track records are preserved.
8. Setup completeness is explicit. Empty triggers or zero expense cannot imply “incomplete.”
9. Insight samples are isolated by recovery track and local calendar day.
10. No synthetic or duplicate record may unlock insights.

## Target data contract

Add a pure module at src/domain/recoveryTrackSetup.ts.

~~~ts
type TrackSetupStatus = "draft" | "needs_review" | "complete" | "archived";
type GoalMode = "quit" | "reduce" | "take_a_break";

interface RecoveryTrackDraft {
  addictionType: AddictionType;
  addictionDetail?: string;
  goalMode: GoalMode;
  startedAtLocalMidnight: number;
  expense?: {
    amount: number;
    period: ExpensePeriod;
    currency: string;
  };
  timeBaselineMinutes?: number;
  triggers: string[];
  reason: string;
}

interface RecoveryTrackSetup extends RecoveryTrackDraft {
  setupVersion: 1;
  setupStatus: TrackSetupStatus;
  setupCompletedAt?: number;
}

interface RecoverySetupSubmission {
  account: { name: string; age?: number };
  activeTrack: AddictionType;
  trackOrder: AddictionType[];
  tracks: Record<AddictionType, RecoveryTrackSetup>;
}
~~~

Long-term state target:

~~~ts
interface RecoveryStateV4 {
  account: AccountState;
  activeTrack: AddictionType;
  trackOrder: AddictionType[];
  tracks: Partial<Record<AddictionType, RecoveryTrackState>>;
  global: GlobalAppState;
}
~~~

Do this through versioned migration and compatibility selectors. src/application/store.ts is already large and mixes global with active-track data; one giant rewrite is too risky.

## Reusable setup engine

Build RecoveryTrackSetupFlow once and use it in onboarding and Profile.

### Onboarding journey

1. Ask shared nickname and optional age once.
2. Select one or more recovery categories.
3. Create one draft per category, keyed by AddictionType.
4. Show “Track 1 of N · Category” before each track section.
5. Ask that category’s applicable:
   - description;
   - goal mode;
   - last-use/start date;
   - money baseline;
   - time baseline;
   - triggers;
   - recovery reason.
6. Offer “Use the same reason” explicitly; never silently copy it.
7. Review every track.
8. Atomically commit all valid tracks or none.

The field definitions come from Plan 3’s exhaustive category catalog. The wizard must not create a second category switch.

Use stable step IDs such as alcohol:triggers. Numeric-only step indices break when selected categories change after Back navigation.

If a populated category is deselected, confirm discarding that draft. Preserve drafts on Back and app interruption; clear only after explicit discard or successful commit.

### Profile journey

| User action | Correct result | Never do |
|---|---|---|
| Tap existing track card | Switch active track or open its details | Toggle membership |
| Tap “+ Add recovery track” | Open unselected-category picker | Mutate the store |
| Choose new category | Open one-track setup flow | Create default snapshot |
| Confirm final Add CTA | Validate and atomically add once | Double-submit |
| Cancel/back | Confirm only when dirty; persist nothing | Leave partial state |
| Archive inactive track | Confirm and remove from future plans | Delete history |
| Archive active track | Require another active track first | Leave zero active tracks |
| Re-add archived track | Offer Resume or Start fresh | Overwrite history |

Add app/recovery-track-setup.tsx and register it in app/_layout.tsx. The final CTA reads the category, for example “Add Alcohol recovery track.”

## Purpose-built store actions

Remove track membership changes from generic updateProfile.

~~~ts
completeSetupV2(submission: RecoverySetupSubmission): Result;
addRecoveryTrack(track: RecoveryTrackSetup): Result;
resumeRecoveryTrack(type: AddictionType, setup?: RecoveryTrackSetup): Result;
archiveRecoveryTrack(type: AddictionType): Result;
completeLegacyTrackSetup(track: RecoveryTrackSetup): Result;
~~~

Every action enforces:

- category uniqueness;
- valid setup version/status;
- local-midnight date semantics;
- one active selected track;
- atomic commit;
- synchronized membership;
- frozen current-day journal requirements;
- no overwrite of historical data;
- single-flight UI submission.

Reuse createAddictionSnapshot for primary and secondary initialization instead of duplicating seeding logic.

## Pattern integrity repair

### Root cause

- CheckInInsightsCard unlocks from checkIns.length at least two.
- The current Check In screen redirects to journal-sequence.
- addJournal writes journal/urge data but not checkIns.
- New users can journal forever and remain locked.

### Canonical projection

Create src/domain/patternInsights.ts:

~~~ts
interface DailyInsightSample {
  track: AddictionType;
  localDateKey: string;
  mood?: number;
  urgePeak?: number;
  triggerIds: string[];
  journalCompleted: boolean;
  manualUrgeCount: number;
  source: "journal" | "manual_urge" | "legacy_checkin" | "combined";
}
~~~

Rules:

- At most one aggregate sample per track per local date.
- Current journals and manually logged urges are primary sources.
- Legacy checkIns are fallback only.
- Unlock after two distinct qualifying days, not two raw rows.
- Duplicate same-day activity enriches one day.
- Track A never contributes to Track B.
- Date comparison uses a UTC ordinal derived from the user’s local year/month/day, avoiding DST duplicate/skip errors.
- Trend, trigger, mood, and urge calculations are pure and testable.

addJournal currently generates low-intensity “Daily journal” urge rows for many clean entries. Add a source discriminator, stop creating an urge when no urge was reported, and exclude legacy synthetic rows from unlock/trend thresholds. Preserve old rows; do not delete them in migration.

## Migration and backup

Add explicit persisted schema version 4 and route hydration plus backup import through the same validator/migrator.

| Existing state | Required result |
|---|---|
| Legacy single track | Preserve data and mark active setup complete |
| Current active track in multi-track profile | Preserve data and mark complete |
| Synthesized secondary track | Preserve records and mark needs_review |
| Arbitrary-time secondary startedAt | Preserve its local date and normalize date representation deterministically |
| Archived/removed snapshot | Keep history and make Resume available |
| Existing DailyJournalPlan | Preserve today’s frozen track list |
| Legacy checkIns | Retain as insight fallback |
| Backup v1-v3 | Validate, preview, migrate, then restore |
| Backup v4 | Round-trip setup status, ordering, and archived history |
| Missing/malformed snapshot | Repair conservatively; never erase unrelated data |

Surface a non-blocking “Finish setup” action for migrated needs_review tracks. Do not lock users out of their existing recovery tools.

## iPhone-native UX contract

This plan uses the shared form shell from Plan 2.

- Exactly one keyboard-inset owner.
- System-safe top and bottom insets, including Dynamic Island and home indicator.
- One clear primary CTA per step.
- Visible Back, Cancel, track progress, and field progress.
- Minimum 44 by 44 point interactive areas with at least 8 points between adjacent targets.
- Visible labels; placeholders are never the only labels.
- Inline error beside the field plus focus to the first invalid field.
- VoiceOver role, label, hint, value, selected/disabled state, and logical reading order.
- Dynamic Type without clipped controls or hidden content.
- Color is never the only state indicator.
- Reduced Motion removes decorative transitions.
- Standard iOS swipe-back remains predictable; dirty forms receive discard confirmation.
- Light and dark mode use semantic tokens and verified contrast.

These are quality/HIG gates. They help review readiness but do not guarantee App Store approval.

## Apple approval-readiness for this plan

### Required or high-risk review items

- Position the product as self-help/wellness. Do not claim diagnosis, treatment, cure, relapse prevention guarantees, or clinically validated measurement without evidence. Apple gives medical apps greater scrutiny under Guideline 1.4.1.
- Keep “consult a qualified professional” and emergency help accessible; a disclaimer does not excuse unsafe feature copy.
- Keep the no-account path. If account creation is introduced later, Apple requires in-app account deletion.
- Publish a real, public privacy-policy URL and link it both in App Store Connect and inside Settings/Profile. The current in-app disclaimer alone is not enough for submission.
- Add a working public Support URL and reachable support contact; “support channels” without a real channel is incomplete.
- Verify the release binary and all SDKs before selecting “No data collected” in App Store Connect. Local-only access is not off-device collection, but any SDK transmission changes the answer.
- Audit the archive’s PrivacyInfo.xcprivacy entries and required-reason APIs. An invalid or missing required reason can block App Store Connect upload.
- Treat recovery journals as sensitive. Confirm they are excluded from iCloud/device backup where Apple health-data rules apply; user-initiated exported backup remains explicit.
- Use fictional data in screenshots and review recordings.
- Submit only after every selectable category is complete. Blank secondary tracks and dead flows create Guideline 2.1 completeness risk.

### Reviewer note for this workstream

~~~text
Unchainly is a local-only self-help and wellness app. It has no user account,
cloud sync, ads, analytics, real-money gambling, medical diagnosis, or treatment.

To review multi-track setup:
1. Complete onboarding and select Gambling plus Pornography.
2. Observe that each category receives its own questions and review card.
3. Open Profile and tap “Add recovery track.”
4. Cancel once to confirm no track is created, then complete the flow.
5. Complete journals on two distinct local dates to unlock Patterns.

All entered recovery data remains on device. Notifications and device permissions
are optional and requested only when their related feature is used.
~~~

## Work packages

- [ ] **P1-01 — Characterization tests**
  - Pornography + Gambling in both orders.
  - Social Media + Smoking + Other.
  - Existing completeSetup, updateProfile, switching, and DailyJournalPlan behavior.

- [x] **P1-02 — Schema v4 and migration**
  - Setup model, status, sanitization, local date helper, compatibility selectors.
  - No generic membership mutation.

- [x] **P1-03 — Setup domain engine**
  - Draft creation, stable steps, category-aware validation, review, atomic conversion.

- [x] **P1-04 — Shared setup UI**
  - Progressive multi-track wizard using Plan 2’s iPhone form shell.

- [x] **P1-05 — Onboarding conversion**
  - Independent drafts and every applicable question per selected category.

- [x] **P1-06 — Profile Add/Archive/Resume**
  - Track cards, explicit Add button, no mutation before confirmation.

- [x] **P1-07 — Pattern projector**
  - Journal/manual-urge canonical samples, legacy fallback, no synthetic unlocks.

- [x] **P1-08 — Backup v4**
  - Shared import/hydration migration, old backup support, safe preview.

- [ ] **P1-09 — Apple/iPhone release pass**
  - Privacy/support URLs, backup exclusion audit, archive privacy manifest, metadata/reviewer notes, accessibility and device proof.

## Automated and device tests

| Layer | Required coverage |
|---|---|
| Domain | Step generation, validation, category isolation, local-midnight and DST semantics |
| Store | Atomic complete/add, cancel, archive, resume, active invariant, A → B → A preservation |
| Daily plan | Add/remove before plan, after plan, and next-day rollover |
| Insights | Journal-only, urge-only, combined, duplicate day, two dates, legacy fallback, track isolation |
| Migration | Single, malformed multi, needs_review secondary, archived track, v1-v3 import, v4 round trip |
| Component | Onboarding orders, Profile Add/cancel, dirty discard, first-invalid focus, rapid submit |
| iPhone | 375 by 667, notched 375 by 812, standard Dynamic Island, large iPhone |
| Accessibility | VoiceOver, Larger Text to 200 percent where practical, Reduce Motion, Bold Text, light/dark |

## Release gate

- [x] N selected categories produce N complete and independent configurations.
- [x] Every conditional money/time question appears regardless of selection order.
- [x] Cancel produces zero persisted track mutation.
- [x] Profile uses a visible Add button; track-card taps never add/remove.
- [x] Archive and resume preserve all history.
- [x] Today’s DailyJournalPlan remains frozen.
- [x] Two distinct real-data days unlock patterns; same-day duplicates do not.
- [x] Legacy states and backups preserve recovery records in automated migration coverage.
- [ ] All iPhone-native UX gates pass.
- [ ] Public privacy/support URLs, binary privacy audit, App Privacy answers, and review notes are ready.
- [ ] No medical, cure, clinical accuracy, or guaranteed-outcome claim exists.

## Official Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
- [Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Manage app privacy in App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
