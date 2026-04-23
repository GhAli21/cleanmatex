# Customer App

## Current Status

`customer_app` is now at the repo-scoped release-candidate baseline for the customer journey.

Current implementation on disk includes:

- app bootstrap, routing, guest entry, login entry, OTP verification, and shell state management
- localized customer home, orders, order detail, offline, and full-screen error states
- booking bootstrap and submit flow backed by the public customer booking API
- connectivity-aware offline routing and recovery actions
- shared accessibility hardening for core button and app-bar interactions
- generated `android/` and `ios/` platform folders for release builds
- validated Android release APK output from the current workspace

## Current Scope

Implemented:

- `lib/main.dart`
- `lib/app.dart`
- `lib/core/`
- `lib/features/auth/`
- `lib/features/booking/`
- `lib/features/bootstrap/`
- `lib/features/common/`
- `lib/features/entry/`
- `lib/features/guest/`
- `lib/features/home/`
- `lib/features/orders/`
- `lib/features/system/`

Remaining before store submission:

- tenant branding assets, launcher icons, and splash customization
- final release signing/provisioning setup
- device-level QA across Android and iOS hardware matrices

## Guidance

- treat this app as the first production mobile app
- keep implementation aligned with shared packages in `../../packages/`
- update this README when milestone status or real on-disk capabilities change
