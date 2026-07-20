# Plan 2 of 3 — iPhone-Standard Log Urge and All Five Games

> Standalone execution plan for an Apple-native iPhone experience, a reliable Log Urge flow, and release-grade Clarity, Checkers, Sudoku, Go / No-Go, and Blocks.

| Field | Value |
|---|---|
| Status | Core implementation complete; physical iPhone and App Store archive proof pending |
| Priority | P0 Log Urge and confirmed game correctness; P1 full hardening |
| Platform posture | iPhone-first and App-Review-friendly |
| Baseline | main at c850099 |
| Verified current build | npm run typecheck passes; npm test passes 77/77; Expo Doctor passes 18/18; Expo production web export passes (2026-07-20) |
| Platform decision | iPhone-only v1; app.json now declares supportsTablet: false |
| Related plans | [Plan 1](01-multi-track-onboarding-profile-patterns.md) · [Plan 3](03-category-specific-recovery-engine.md) |

## Outcome

Log Urge works correctly with the iPhone keyboard, safe areas, multiple recovery tracks, custom triggers, and VoiceOver. Every game passes named correctness, lifecycle, performance, accessibility, and device gates.

“Apple-ready” means reducing predictable rejection risk; Apple explicitly does not guarantee approval from a checklist.

## Implementation checkpoint — 2026-07-20

The source-level Plan 2 pass is initialized and implemented:

- iOS now declares an iPhone-only v1, and shared sheets, game overlays, and keyboard forms use safe-area-aware, scrollable layouts with at least 44-point primary targets.
- Log Urge has one keyboard owner, explicit recovery-track context, selected-track trigger options, custom triggers first, atomic inactive-track writes, guarded dirty dismissal, invalid-edit recovery, single-flight saving, and a VoiceOver-adjustable slider.
- The active-addiction switch popup now remains open on failure, routes incomplete tracks back through setup, avoids stacked reminder modals, and gives Profile edits explicit Save, Discard, or Keep editing choices before switching.
- Clarity now locks delayed reveals and uses generation-safe timers, local-calendar challenge IDs, and consecutive-day streak rules.
- Checkers now enforces mandatory capture, binds difficulty to the round, cancels stale AI work, and uses time-budgeted iterative deepening.
- Sudoku now excludes tutorial time, uses timestamp-based elapsed time, ships a fast prevalidated unique-puzzle bank, and raises core controls to the iPhone touch minimum.
- Go / No-Go now pauses hidden trials, restarts with a fresh countdown/stimulus, rejects stale resolutions, and uses the shared local-calendar ordinal.
- Blocks now uses full-slot gesture targets, measured board coordinates, a drag threshold, and a complete tap-to-place alternative.
- Lock-screen notification text is neutral, and passive scheduling no longer triggers a permission prompt during startup or onboarding.

Automated coverage increased from 53 to 77 passing tests. TypeScript, Expo Doctor, production web export, and whitespace validation pass. Physical iPhone layout/performance, VoiceOver/Larger Text/Reduce Motion runs, the final iOS archive privacy report, public Privacy/Support URLs, submission metadata, and App Store Connect evidence remain release work rather than claimed complete.

## Lowest-risk iPhone submission posture

### Platform declaration decision

The original baseline declared ios.supportsTablet: true. The implementation now uses the lowest-risk requested posture for v1:

- **Implemented:** ios.supportsTablet is false, so this release does not advertise uncertified iPad support.
- If supportsTablet remains true, native iPad layout, resizing, modal, keyboard, screenshot, and accessibility coverage becomes a release gate.
- Keep portrait orientation only if every screen works in portrait and no feature implies landscape. Apple HIG encourages adaptability but permits a purposeful orientation choice.
- Continue respecting safe areas; portrait-only is not permission to overlap the Dynamic Island or home indicator.

This avoids advertising an iPad experience that the team has not certified.

### iPhone reference matrix

Use adaptive layout, not device-name conditionals:

| Class | Reference purpose |
|---|---|
| 375 by 667 points | Small/home-button stress case |
| 375 by 812 points | Small notched safe-area case |
| About 393 by 852 points | Standard Dynamic Island design reference |
| About 430 by 930 points | Large-screen width and spacing |
| Display Zoom + Larger Text | Real constrained-content case |

Do not hardcode screen height assumptions. Test usable space after safe areas, keyboard, status bar, and measured headers/footers.

## iPhone-native screen system

### Required shared primitives

1. **Screen**
   - Owns top/bottom safe areas.
   - Exactly one keyboard adjustment strategy.
   - Does not clip overflowing form content.

2. **KeyboardFormScreen**
   - One KeyboardAvoidingView.
   - ScrollView with keyboardShouldPersistTaps.
   - iOS interactive keyboard dismissal.
   - Automatically adjusted keyboard inset where supported.
   - Scrolls the focused field into view.
   - Reserves measured space for the sticky footer.

3. **SafeActionFooter**
   - One primary action.
   - Bottom inset equals content spacing plus the safe-area requirement.
   - Remains reachable with keyboard open/closing.
   - Single-flight loading state and accessible progress announcement.

4. **AccessibleModalSurface**
   - Safe-area container and maximum height.
   - Scrollable content body plus fixed safe footer.
   - Modal focus semantics, initial focus, and focus restoration.
   - Clear Close/Cancel route and dirty-dismiss confirmation.

5. **GameSessionController**
   - Explicit loading, ready, playing, paused, and finished phases.
   - Generation-scoped timers/tasks.
   - Pause on background, route blur, help, or confirmation.
   - finishOnce for idempotent results.

### iPhone HIG quality gates

- Minimum 44 by 44 point interactive areas; at least 8 points between adjacent actions.
- System margins; avoid edge-to-edge full-width buttons unless intentionally aligned with safe areas.
- System-native navigation/back behavior and visible dismissal for modals.
- Dynamic Type; no fixed-height text container that clips at large sizes.
- VoiceOver labels, hints, values, selected/disabled state, logical order, and live result announcements.
- Voice Control-compatible labels that match visible action text.
- Color never carries meaning alone.
- Semantic light/dark tokens with verified contrast.
- Reduced Motion removes confetti, looping loaders, shakes, flips, pulses, and unnecessary countdown animation.
- Press feedback appears quickly without layout shift.
- Standard gestures remain available; critical tasks always have visible non-gesture alternatives.
- No structural emoji icons. Use the existing consistent vector icon system.

These HIG items are design-quality requirements. App Review can reject poor/broken UI under completeness/quality rules, but HIG is not itself a promise of approval.

## Log Urge: confirmed defects

1. **Double keyboard avoidance**
   - src/presentation/components/Screen.tsx already wraps scroll=false content in an iOS KeyboardAvoidingView.
   - app/log-urge.tsx adds a second KeyboardAvoidingView with the same padding behavior.
   - Screen’s inner non-scroll View clips overflow.

2. **Pornography trigger list is empty**
   - Log Urge calls triggersForAddiction.
   - src/domain/gambling.ts returns an empty pornography list.
   - Profile works around it with PORN_TRIGGERS, proving the source is fragmented.

3. **Saved/custom triggers are omitted**
   - profile.triggers exists, but Log Urge renders generic defaults only.

4. **Slider accessibility contract is invalid**
   - Segments claim accessibilityRole adjustable without accessibilityValue or increment/decrement actions.

5. **Destination track is implicit**
   - Multi-track users can accidentally file an urge under the currently active track.

These are baseline findings. The implementation checkpoint closes them in source and automated domain coverage; the keyboard and assistive-technology behavior still requires the physical-device matrix below.

## Log Urge target behavior

- Remove the nested KeyboardAvoidingView; Screen/KeyboardFormScreen is the only owner.
- Replace overflow clipping with scrollable, inset-aware content.
- Show “Logging for [track]” before the form.
- When multiple tracks exist, provide a visible track selector or enter through an explicit route parameter.
- Use logUrgeForTrack; never rely only on ambient active state.
- Centralize triggerOptionsForAddiction through Plan 3’s category catalog.
- Order triggers:
  1. saved/custom triggers for the selected track;
  2. remaining category defaults;
  3. deduplicated legacy/edit value.
- Make Save single-flight.
- Preserve dirty input and confirm dismissal.
- Provide a clear recovery path for invalid edit ID.
- Remove unused MoodPicker code if Slider remains canonical.
- Expose one adjustable Slider with accessibilityValue and increment/decrement actions; segment taps remain optional shortcuts.

### Log Urge release gate

- [ ] Notes focus never double-lifts, clips content, or hides Save.
- [ ] Save remains tappable above the keyboard and after interactive dismissal.
- [x] Every category has correct non-empty trigger options in automated coverage.
- [x] Custom/onboarding triggers appear first and survive edit.
- [x] Destination track is visible and writes atomically without ambient switching.
- [x] Rapid Save taps are protected by a single-flight guard.
- [ ] VoiceOver can read and change every adjustable value.
- [x] Back/close protects a dirty draft.

## Shared defects across all five games

| Surface | Confirmed issue | Fix contract |
|---|---|---|
| GameTutorial | Fixed bottom padding ignores home indicator | Safe-area footer with no CTA collision |
| GameCelebration | Absolute overlay can clip stats/actions and lacks modal focus semantics | Accessible modal, max height, scroll body, safe footer |
| useSquareBoardSize | Raw window height minus magic chrome ignores usable safe-area height | Measured content plus safe-area inputs; board may shrink |
| Session lifecycle | Help/background/route blur does not consistently pause | One shared phase/lifecycle controller |
| Timers/tasks | Several timeouts survive restart or unmount | Generation tokens and cancellation registry |
| Motion | Games ignore useReducedMotion | Immediate/crossfade alternative; suppress decorative motion |
| Accessibility | Core boards/grids lack semantics; Blocks is drag-only | Labels, states, announcements, tap alternative |
| Tests | Current npm test excludes game modules | Add all game domains and state transitions |

These are baseline findings. The shared surfaces and each game now contain the source-level fixes described below; lifecycle, layout, performance, and accessibility claims remain conditional on the physical iPhone matrix.

## Shared game session contract

~~~ts
interface GameSessionController {
  phase: "loading" | "ready" | "playing" | "paused" | "finished";
  generation: number;
  pause(reason: PauseReason): void;
  resume(): void;
  restart(): void;
  finishOnce(result: GameResult): boolean;
  registerTimeout(callback: () => void, delayMs: number): Cancel;
  cancelGeneration(): void;
}
~~~

Rules:

- AppState inactive/background, route blur, tutorial, and blocking confirmation pause the session.
- Timer/AI/reveal callbacks capture generation and become no-ops after cancellation.
- Clear intervals, animations, haptics, and audio on restart/unmount.
- Resume with a countdown only where surprise input would be unfair.
- Scores, XP, achievements, streaks, and results write exactly once.
- Fake loading delay is removed when content is ready.
- Challenge dates use local calendar parts converted with Date.UTC; never divide local-midnight milliseconds by 86,400,000.

## Clarity

### Confirmed defects

- Input and mode switching remain active while delayed reveal callbacks run.
- Reveal/message/celebration timeouts are untracked.
- Stale callbacks can mutate a new round.
- Daily streak increments after any later win instead of requiring consecutive days.
- Daily IDs can duplicate or skip across DST.

### Work and gates

- Lock submit/mode change during reveal.
- Add round generation token and timer registry.
- Cancel stale reveal, message, and celebration work.
- Consecutive streak: N+1 continues; N+2 resets to one.
- Use the shared calendar ordinal.
- Keep Daily and Practice results separate.
- Add duplicate-letter fixtures and accessible row/keyboard announcements.

- [x] One pending reveal maximum.
- [x] Old callbacks cannot affect a new round.
- [x] Skipped date resets streak.
- [x] Manila and DST boundaries advance one challenge day in automated coverage.
- [x] Daily/Practice stats cannot contaminate each other.

## Checkers

### Confirmed defects

- Difficulty can change mid-round, allowing an Easy game to be recorded as Hard.
- The American/English engine allows simple moves when a capture exists.
- Depth-six Hard AI runs synchronously and has shown roughly 200 ms desktop stalls.

### Work and gates

- Bind difficulty to round creation; changing it confirms restart.
- Enforce mandatory capture.
- Verify multi-jump, promotion, no-legal-move, and draw rules with fixtures.
- Use cancellable, time-budgeted iterative deepening and yield between root branches.
- Cancel AI on help/background/blur/restart/surrender.
- Record result and achievement once using round-bound difficulty.

- [x] Difficulty switching cannot unlock Hard achievements.
- [x] Mandatory capture, multi-jump, and promotion fixtures pass.
- [x] AI returns only a legal move or terminal result.
- [ ] No AI slice blocks JS longer than 50 ms on the lowest test iPhone.
- [x] Generation checks prevent a late AI move after exit/restart in source.

## Sudoku

### Confirmed defects

- Timer starts while first-run tutorial is visible.
- Background suspension silently excludes elapsed time, enabling unfair records.
- Expert recursive generation/uniqueness checks are synchronous; a desktop sample exceeded three seconds.
- Difficulty controls can be 30 points and number keys 38 points.

### Work and gates

- Start time only after tutorial dismissal.
- Define an explicit timestamp-based background/pause policy.
- Use a prevalidated offline puzzle bank or bounded off-input-path generator.
- Verify solvability and uniqueness at every difficulty.
- Keep givens immutable.
- Make completion and achievements idempotent.
- Validate notes, hints, mistakes, abandon confirmation, and large-text layout.
- Increase all primary controls to 44 points minimum.

- [x] Tutorial time never counts.
- [x] Background cannot create an artificial fast record.
- [x] Every shipped puzzle is solvable and unique in automated coverage.
- [ ] Expert selection p95 is below 100 ms on the lowest test iPhone.
- [x] Results write once.
- [ ] Core controls pass touch and VoiceOver requirements.

## Go / No-Go

### Confirmed defects

- Trial timers continue behind tutorial/background, causing unseen misses and corrupt reaction times.
- Daily challenge date has the same DST bug as Clarity.

### Work and gates

- Model one trial as a single-resolution state machine.
- Cancel/pause stimulus on overlay, background, blur, restart, and unmount.
- Resume with a fair countdown and fresh stimulus.
- Reject late and duplicate taps.
- Exclude hidden/background duration from reaction stats.
- Use shared calendar ordinal.

- [x] No invisible life loss or stale stimulus in covered lifecycle paths.
- [x] One resolution per trial.
- [x] Withhold, false-tap, late-tap, and reaction-time fixtures pass.
- [x] Challenge ID advances once per local date in Manila and DST fixtures.

## Blocks

### Confirmed defects

- PanResponder wraps only the visible piece; a one-cell piece can have an 18 by 18 point target inside a 92-point slot.
- Drag is the only placement path.

### Work and gates

- Make the whole tray slot the gesture target.
- Add drag activation threshold.
- Add “select piece, then select board origin” as a complete path.
- Measure board bounds and remeasure after layout change.
- Cancel active drag on background, blur, and restart.
- Pure-test canPlace, placement, line clear, scoring, combo, no-move, and finish-once.

- [x] Every tray target is at least 44 by 44 points in source layout.
- [x] Full game is playable without dragging.
- [x] Preview and placement share one measured coordinate model.
- [x] Stale/cancelled gesture cannot place.
- [x] Scoring and no-move result are deterministic in automated coverage.

## Apple App Review readiness

### Mandatory/high-risk items

1. **App completeness — Guidelines 2.1 and 2.3**
   - No crash, dead CTA, clipped Save, hidden game action, placeholder, or inaccessible feature.
   - New functionality is named specifically in Review Notes.
   - Screenshots show the real app with fictional recovery data.

2. **No misleading gambling functionality**
   - The app supports recovery from gambling; it does not offer real-money betting, simulated casino play, odds tools, currency wagering, contest prizes, or card counting.
   - Keep the five wellness games visually and mechanically separate from Gambling recovery.
   - State this plainly in Review Notes to avoid unnecessary Guideline 5.3 confusion.

3. **Notifications**
   - Baseline reminder bodies exposed “Back on Track,” lung/breathing recovery, and shopping item/price details.
   - The implementation now uses neutral lock-screen copy: “Your check-in is ready.”
   - Notifications are optional and requested in context, never required for core use.
   - Per-feature in-app controls and opt-out remain required before submission.
   - No promotional notification without explicit opt-in.

4. **Permissions**
   - Do not request Photos, Media Library, Location, Motion, or Notifications during launch/onboarding.
   - Ask only when the user starts Share/Save Card, Walk, step count, or reminder setup.
   - Denial keeps a useful fallback path.
   - Purpose strings must exactly match the shipped behavior.

5. **Privacy manifest and SDK audit**
   - Inspect the final EAS/Xcode archive, not just source.
   - Validate PrivacyInfo.xcprivacy and every third-party SDK signature/required-reason declaration.
   - Confirm no analytics, tracking, ad, or unexpected networking SDK is present.

6. **Public privacy and support**
   - Provide a working public privacy-policy URL and Support URL with real contact information.
   - Keep Help & Legal permanently reachable inside Profile/Settings after onboarding.
   - Select “No data collected” only after binary verification confirms no off-device collection.

7. **Accessibility claims**
   - App Store Accessibility Nutrition Labels must be truthful.
   - Claim VoiceOver, Larger Text, Dark Interface, Sufficient Contrast, Reduced Motion, or Differentiate Without Color only if users can complete all common tasks with that feature.

8. **iPad declaration**
   - If supportsTablet stays true, test iPad as a first-class platform and supply required metadata/screenshots.
   - Otherwise set it false before the release build and keep the submission scoped to iPhone.

### Reviewer note template

~~~text
Unchainly is a local-only self-help/wellness app. It contains five embedded
offline cognitive/puzzle games: Clarity, Checkers, Sudoku, Go / No-Go, and
Blocks. None includes real-money gambling, simulated casino wagering, paid
currency, contests, prizes, or online multiplayer.

No login is required. There are no ads or analytics.

Suggested review:
1. Complete onboarding.
2. Open Log Urge, focus Notes, dismiss the keyboard interactively, and Save.
3. Open each game from Games, view its tutorial, play/restart, and return.
4. Notification, location, motion, and photo permissions are optional and
   requested only when their related feature is invoked.
~~~

## Work packages

- [x] **P2-01 — Platform scope and iPhone design tokens**
  - Decide supportsTablet.
  - Standard margins, safe-area/footer, type, touch, motion, and modal contracts.

- [x] **P2-02 — Shared KeyboardFormScreen**
  - One keyboard owner, focused-field scrolling, safe sticky footer.

- [x] **P2-03 — Log Urge**
  - Track context, trigger catalog, slider accessibility, dirty dismissal, single-save.

- [x] **P2-03A — Active recovery-track switch sheet**
  - Validate setup before activation, preserve unsaved Profile edits, keep failures visible, and prevent stacked modals.

- [x] **P2-04 — Shared game infrastructure**
  - Safe tutorial/celebration, measured layout, session lifecycle, reduced motion, announcements.

- [x] **P2-05 — Clarity**
  - Reveal lock, cancellation, calendar and consecutive streak.

- [x] **P2-06 — Checkers**
  - Round-bound difficulty, rules, cancellable time-budgeted AI.

- [x] **P2-07 — Sudoku**
  - Fair timing, bounded puzzles, uniqueness, accessible controls.

- [x] **P2-08 — Go / No-Go**
  - Trial state machine, pause/resume, DST-safe challenge.

- [x] **P2-09 — Blocks**
  - Full-slot hit target, tap placement, measured coordinates.

- [ ] **P2-10 — App Review preflight**
  - Archive privacy report, permissions, metadata, age rating, accessibility labels, review notes, device evidence.

## Test matrix

| Class | Required coverage |
|---|---|
| Small iPhone | Log Urge keyboard; every game action and overlay visible |
| Notched iPhone | Home indicator, sheet/footer, safe-area composition |
| Standard Dynamic Island | Primary design regression in light/dark |
| Large iPhone | Capped widths and board sizing |
| Accessibility | VoiceOver, Voice Control labels, 200 percent text where supported, Bold Text, Reduce Motion |
| Lifecycle | Help/confirmation mid-round, background 5/30 seconds, route blur, rapid restart |
| Performance | Checkers Hard budget, 20+ Expert Sudoku loads, rapid Clarity input |
| Calendar | Asia/Manila midnight and DST spring/fall transitions |
| Submission | Release archive install, offline launch, permission denial, privacy manifest report |

## Final release gate

- [x] iPhone platform declaration matches actual support.
- [ ] Shared screen primitives pass every iPhone class.
- [ ] Log Urge passes keyboard, track, triggers, save, edit, and accessibility gates.
- [x] All five games pass their automated domain-correctness gates.
- [ ] All games pause/cancel hidden work and write results once.
- [x] No common task depends on a gesture-only interaction.
- [ ] Reduced Motion and Larger Text produce no clipped critical actions.
- [ ] Notifications are optional and privacy-safe.
- [ ] Permission requests are contextual with denial fallbacks.
- [ ] Real archive privacy/SDK validation passes.
- [ ] Metadata and Review Notes accurately describe recovery context and non-gambling games.
- [ ] App Store accessibility claims match tested behavior.

## Official Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
- [Human Interface Guidelines — Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- [Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games)
- [Manage Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/manage-accessibility-nutrition-labels/)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
