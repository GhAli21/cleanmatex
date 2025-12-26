# Customer App Architecture - Development Plan & PRD

**Document ID**: 027 | **Version**: 1.0 | **Dependencies**: 003, 049-051  
**Flutter setup, state management, API client, offline support**

## Overview

Set up Flutter customer mobile app with state management (Riverpod/Bloc), API client, offline storage, and push notifications.

## Requirements

- Flutter project structure
- State management (Riverpod)
- API client (Dio)
- Local storage (Hive/Drift)
- Push notifications (FCM)
- Offline queue
- i18n (EN/AR with RTL)

## Structure

```
lib/
├── core/
├── features/
│   ├── auth/
│   ├── orders/
│   ├── profile/
│   └── wallet/
├── shared/
└── main.dart
```

## Implementation (3 days)

1. Project setup (1 day)
2. State management (1 day)
3. API client & storage (1 day)

## Acceptance

- [ ] App runs on iOS/Android
- [ ] State management working
- [ ] API calls functional
- [ ] Offline storage working

**Last Updated**: 2025-10-09
