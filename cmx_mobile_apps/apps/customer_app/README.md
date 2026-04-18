# Customer App

## Current Status

`customer_app` is in early Milestone 3 implementation.

Current implementation on disk includes:

- app bootstrap entry point
- shared theme and localization wiring
- initial localized customer home shell
- first feature-based home screen structure under `lib/features/home/`

## Current Scope

Implemented today:

- `lib/main.dart`
- `lib/app.dart`
- `lib/features/home/ui/screens/customer_home_screen.dart`
- home feature cards under `lib/features/home/ui/cards/`

Not implemented yet:

- routing layer
- auth and guest entry flow
- order list and order detail features
- repositories, providers, and backend-backed customer journeys

## Guidance

- treat this app as the first production mobile app
- keep implementation aligned with shared packages in `../../packages/`
- update this README when milestone status or real on-disk capabilities change
