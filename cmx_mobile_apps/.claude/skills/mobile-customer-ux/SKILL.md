---
name: mobile-customer-ux
description: Customer-facing product and UX rules for CleanMateX mobile. Use when designing or implementing onboarding, guest mode, login, order tracking, booking, home dashboard, or other customer_app journeys.
user-invocable: true
---

# Mobile Customer UX

Use this skill for `customer_app` flows and product-facing UX decisions.

## Read First

Read these before implementing or reviewing customer journeys:

* `cmx_mobile_apps/docs/Customer_app_01.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`

## Core Rules

1. Customer UX must be simple before it is visually rich.
2. The next action must always be obvious.
3. Tracking and reassurance are core product value, not secondary polish.
4. Do not expose internal operational noise to customers — no branch names, staff names, or internal process labels.
5. Guest and authenticated flows must both feel intentional.
6. UI polish must stay consistent with `AppTheme`, `AppColors`, `AppSpacing`, and `AppTextStyles` from `mobile_ui`.

## Implemented Routes (AppRoute Constants)

```dart
AppRoute.splash          // '/'     — bootstrap entry
AppRoute.home            // '/home' — main home screen
AppRoute.orders          // ...     — orders list
AppRoute.orderDetail     // ...     — single order detail
AppRoute.booking         // ...     — order booking flow
AppRoute.login           // ...     — phone/OTP login entry
AppRoute.otpVerification // ...     — OTP input screen
AppRoute.tenantDiscovery // ...     — tenant lookup
AppRoute.tenantConfirm   // ...     — tenant confirmation
AppRoute.guest           // ...     — guest entry
AppRoute.profile         // ...     — customer profile
AppRoute.error           // ...     — branded error screen
AppRoute.offline         // ...     — offline screen
```

Always use `AppRoute` constants — never hard-code route strings.

## Session and Entry Flow

Bootstrap sequence: `splash` → session restore → tenant resolution → `home` (authenticated) or `login`/`guest` (unauthenticated).

Auth uses phone + OTP. After OTP verification, the session is persisted in `flutter_secure_storage`.

Tenant discovery resolves the tenant org from the phone number or a QR/deep link. The tenant confirm screen shows before home.

Guest flow allows browsing with limited features — guest state is intentional, not a fallback.

## UX Priorities

Prioritize:

* Low-friction entry — minimize steps to reach home or order tracking
* Clear order visibility — status, next step, ETA where available
* Trust signals after user actions — confirmations, receipts, status updates
* Short, progressive booking steps — no long forms
* Explicit progress and status messaging

## Home Screen Rules

Home must answer immediately:

* What is happening now (active orders, their status)
* What the customer can do next (book, view history)
* Whether there is anything urgent (pending payment, pickup ready)

No competing primary CTAs. One clear primary action above the fold.

## Order Tracking Rules

Tracking must:

* Make current status obvious at a glance
* Show what happens next in plain language
* Never show raw internal status codes or backend enum values
* Handle empty state (no active orders) with reassurance and a clear next action
* Handle delayed/stuck states with an explanation and contact path if needed

## Booking Rules

Booking should:

* Stay short and progressive — maximum 3–4 steps
* Avoid unnecessary data entry — reuse known customer address/preferences
* Show backend-owned pricing clearly — never compute or estimate client-side
* Prevent duplicate submissions while the request is in flight
* End with a clear, reassuring confirmation screen with order reference

## Auth and Guest Rules

Login:
* Phone number entry → OTP verification → home
* Clear error messages for invalid phone, expired OTP, rate limiting
* Never trap the user in an unclear auth state

Guest:
* Guest mode is a valid, intentional state — not just "not logged in yet"
* Show what features are unlocked after signing in
* Make the sign-in path easy to find without being pushy

## State Handling Requirements

Every customer screen must handle:

| State | Treatment |
|---|---|
| Loading | `AppLoadingIndicatorWidget` — no blank screens |
| Success | Primary content |
| Empty | Reassuring message + clear next action |
| Error | `AppErrorWidget` with localized `messageKey` + retry |
| Offline | `AppRoute.offline` or inline offline indicator |

## Localization and Accessibility

* All user-facing strings via `AppLocalizations.of(context)` — no hardcoded strings
* EN and AR in the same commit — no EN-only screen releases
* Arabic copy must fit the layout — test AR explicitly, not as an afterthought
* Minimum touch targets: 44×44 logical pixels
* Status labels must be visually distinct — never color-only

## Anti-Patterns

Reject these:

* Dashboard screens with no obvious primary action
* Multiple competing CTAs at the same visual weight
* Exposing branch names, staff names, or process terminology to customers
* Visually polished screens with broken or missing loading/error/empty states
* Booking flows that require excessive data entry
* Tracking screens that show raw enum values or internal order codes
* Guest flow that feels broken or accidental
* Hard-coded route strings — always use `AppRoute` constants

## Required Output

When using this skill, state:

1. The customer journey being implemented or improved
2. The primary user action on the screen
3. What reassurance or trust signal is provided after the action
4. How empty, error, offline, and loading states are handled

## Validation Checklist

- [ ] Primary action is obvious — no competing CTAs at same weight
- [ ] Customer language is simple and non-operational
- [ ] Tracking or booking state is understandable at a glance
- [ ] Guest and signed-in behavior is intentional
- [ ] All screen states handled (loading/empty/error/success/offline)
- [ ] EN and AR both tested
- [ ] Touch targets ≥ 44×44 logical pixels
- [ ] `AppRoute` constants used — no hardcoded route strings
- [ ] UX polish does not outrun functional completeness
