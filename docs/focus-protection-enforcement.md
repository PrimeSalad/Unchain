# Focus Protection — Real Website Blocking (Native Enforcement Guide)

## Where things stand

The app-level blocklist is complete and permanent: websites are added
explicitly by the user, protected the moment they're added, persisted
offline, de-duplicated and normalized (`stake.com` == `https://www.Stake.com/x`),
and only removable through a destructive confirmation. There are no timers,
no sessions, and no early-exit.

**What JavaScript alone cannot do:** iOS sandboxing means no React Native /
Expo code can block Safari or other apps from opening a website. Real,
bypass-resistant blocking requires one of Apple's native mechanisms below.
The domain function `activeBlockedDomains()` in `src/domain/protection.ts`
returns exactly the list any of these layers should enforce.

## Option A — Screen Time API (recommended)

Blocks the user's chosen domains **system-wide in Safari** with Apple's own
shield screen. This is what first-party wellbeing apps use.

1. **Module**: add [`react-native-device-activity`](https://github.com/kingstinct/react-native-device-activity)
   (ships an Expo config plugin). It wraps `FamilyControls`,
   `ManagedSettings`, and `DeviceActivity`.
2. **Build**: requires a development/EAS build (`npx expo prebuild` /
   `eas build`) — it will NOT run in Expo Go.
3. **Entitlement**: `com.apple.developer.family-controls`.
   - Development builds work immediately.
   - **Distribution requires applying to Apple**:
     https://developer.apple.com/contact/request/family-controls-distribution
     State clearly that this is a gambling-addiction recovery app where users
     voluntarily shield gambling websites they chose themselves. Legitimate
     wellbeing apps are routinely approved; expect a few weeks.
4. **Flow in code**:
   - Ask consent: `AuthorizationCenter.requestAuthorization(for: .individual)`
     (the module exposes this) — explain why before asking.
   - Enforce: write `activeBlockedDomains(store.blockedSites)` into
     `ManagedSettingsStore.shield.webDomains` whenever the blocklist changes.
   - Remove: when the user deletes a site, rewrite the shield set — the
     domain is unblocked immediately.
5. **App protection** (optional later): the same module exposes Apple's
   `FamilyActivityPicker` so users can select apps to shield — the picker
   guarantees the app never chooses for them.

## Option B — Safari Content Blocker extension

A native extension target that gives Safari a JSON rule list
(`{"trigger":{"url-filter":"stake\\.com"},"action":{"type":"block"}}` per
domain). No special entitlement needed, but:
- Only affects Safari (not Chrome/other browsers).
- The user must enable it manually in Settings → Safari → Extensions.
- Requires a custom Expo config plugin to add the extension target and an
  App Group to share the JSON with the main app.

## App Review notes (Guideline 2.3.1, 2.5.1, 5.1.1)

- Never claim blocking the app can't perform — current UI copy says sites
  are "protected", which is accurate for the commitment model and becomes
  literally true once Option A ships.
- Only public APIs above; both options are fully App Store legal.
- Keep the consent flow: explain the Screen Time permission before
  requesting it, and never add domains the user didn't choose.
- Privacy answers for App Store Connect: no browsing history collected, no
  tracking, blocklist stored on-device only.
