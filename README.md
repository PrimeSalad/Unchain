# Unchain

A shame-free recovery companion. React Native (Expo · SDK 57) + Clean Architecture.
Design system and product spec: [`docs/plan.md`](docs/plan.md).

## Run it

```bash
npm install
npm start          # then press i (iOS), a (Android), or w (web)
npm run ios        # open directly in the iOS simulator (macOS)
npm run typecheck  # tsc --noEmit
```

Use **Expo Go** (or a dev client) on a phone: run `npm start` and scan the QR.

## What's built (MVP slice)

- **Onboarding** — value-first welcome → choose your chain → goal (quit/reduce/break) → hold-to-commit ritual.
- **Today** — Maria the mascot, Recovery Strength ring, clean-days, money-saved (₱), healing timeline, check-in.
- **SOS** — full-screen, always-dark crisis flow: 4-2-6 haptic breathing orb, urge wave, escalation ladder, designed exits (no red).
- **Relapse** — compassion-first, shame-free re-entry that never resets progress to zero.
- **Journey / Journal / You** — stage track, milestone chain wall, craving log, privacy-first settings.
- Custom floating **tab bar** with a raised center SOS button.

## Architecture (Clean)

```
src/
├─ domain/          entities, value-objects, services — pure TS, zero framework deps
│                   (RecoveryStrength enforces "never resets to zero")
├─ application/     store (use-case-shaped actions) + repository ports
└─ presentation/    theme (Wool & Chain tokens), components, screens, hooks
app/                thin expo-router routes → presentation screens
```

Business rules live in `domain/`. UI reads them through the application store — never mutates state directly. Colours all come from `src/presentation/theme/tokens.ts` (sampled from `/assets`, WCAG-verified).

> **Note:** local persistence uses Zustand + AsyncStorage for the MVP. The plan (§7.1) recommends WatermelonDB for richer local-first data — swap the store's persistence adapter when journals/logs grow.
