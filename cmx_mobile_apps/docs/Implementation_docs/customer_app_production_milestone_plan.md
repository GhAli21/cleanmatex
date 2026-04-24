# Customer App Production Milestone Plan

## Overview

This plan turns the current mobile documentation into an execution sequence for building `customer_app` first without compromising long-term architecture, code quality, or production readiness.

The plan assumes:

* existing repository state is authoritative
* Flutter is the mobile stack
* `customer_app` is the first app to ship
* shared packages are still to be created
* every milestone must leave the workspace in a buildable, reviewable state

This is not a brainstorming document. It is the recommended delivery plan.

---

## Delivery Principles

### Engineering Principles

* build shared foundations before feature-specific shortcuts
* keep diffs small and mergeable
* no hidden magic or premature abstraction
* every milestone ends with passing validation
* no milestone may introduce placeholder architecture that will need a rewrite immediately after

### Product Principles

* customer experience must feel simple, fast, and trustworthy
* EN and AR are mandatory from the first interactive screen
* guest-first entry should reduce friction without weakening account flows
* tracking and reassurance matter as much as visual polish
* no public-facing screen should ship with unresolved loading, empty, or error states

### UI/UX Principles

* phone-first design
* strong hierarchy and clear next actions
* readable timelines and order states
* low-friction form flows
* touch-friendly controls
* RTL-safe spacing, alignment, and icon direction
* polished states: loading, empty, offline, error, success

### Production-Readiness Principles

* no hardcoded strings
* no direct business-rule authority in the app
* typed models and typed service boundaries only
* no unsecured token handling
* no unstable dependency sprawl
* no milestone is complete until it is analyzable, testable, and buildable

---

## Scope Decision

### App Order

`customer_app` is the first app to implement.

### Why This Is Acceptable

Building `customer_app` first is valid if the team still creates the shared mobile foundation correctly instead of embedding all logic directly into the app.

### Non-Negotiable Rule

Even though `customer_app` ships first, the following must still be built as shared assets where appropriate:

* `mobile_core`
* `mobile_l10n`
* `mobile_ui`
* `mobile_domain`
* `mobile_services`
* `mobile_testkit`

Do not let `customer_app` become a one-off codebase that blocks `staff_app` and `driver_app` reuse later.

---

## Target Deliverables

## Milestone Status Tracker

| Milestone | Status | Started | Completed | Notes |
|---|---|---|---|---|
| 0. Rules, Instructions, and Skills Preparation | Completed | 2026-04-18 | 2026-04-18 | Mobile instruction layer aligned, Tier 1 local mobile skills created, governance docs updated |
| 1. Workspace Bootstrap | Completed | 2026-04-18 | 2026-04-21 | Real `apps/` and `packages/` scaffold, manifests, and reproducible Flutter workspace are in place |
| 2. Shared Foundation Packages | Completed | 2026-04-18 | 2026-04-21 | `mobile_core`, `mobile_l10n`, `mobile_ui`, `mobile_domain`, `mobile_services`, and `mobile_testkit` are wired into the current customer flow baseline |
| 3. Customer App Shell | Completed | 2026-04-18 | 2026-04-18 | Route shell now includes splash, entry, guest, login, offline, error, and home placeholder screens, plus locale switching access and an app-local README |
| 4. Authentication and Session | Completed | 2026-04-18 | 2026-04-21 | OTP request/verify now integrate with web-admin APIs, customer session resolution is backed by a public session contract, and app runtime uses secure session persistence wiring |
| 5. Customer Orders Tracking Journey | Completed | 2026-04-18 | 2026-04-21 | Customer-scoped orders list plus order detail/timeline now run through localized mobile repositories and real web-admin public APIs, with automated list/detail coverage in place |
| 6. Customer Order Creation Journey | Completed | 2026-04-18 | 2026-04-21 | Booking now uses a real public customer-booking API, fulfillment/address/slot/review UX, localized success handling, and automated booking coverage |
| 7. Hardening and Production Readiness | Completed | 2026-04-18 | 2026-04-22 | Connectivity-aware offline routing, accessibility touch-target semantics, native Android and iOS platform targets, clean analysis, passing tests, `web-admin` production build, and Android release APK validation are now in place |
| PR-0. Foundation — Riverpod deps + AppConfig fail-fast | Completed | 2026-04-18 | 2026-04-24 | `flutter_riverpod` in `customer_app`, `ProviderScope` in `main.dart`, `assertProductionReady()` on `AppConfig` (prod requires `API_BASE_URL` only; no `TENANT_ORG_ID` dart-define) |
| PR-0b. Tenant Discovery — runtime multi-tenancy | Completed | 2026-04-18 | 2026-04-24 | `sessionManagerProvider` + `tenantProvider` + `GET /api/v1/public/tenant/resolve`; splash → discovery/confirm → entry; `customer_tenant_*` screens; `clearSession` on “different laundry”. Migration 0244 applied ✓ 2026-04-23 |
| PR-1. Shell Controller — Riverpod core | Completed | 2026-04-18 | 2026-04-24 | `CustomerApp` is `ConsumerStatefulWidget`; `customerSessionFlowProvider` + `CustomerSessionFlowState` + `customerLocaleProvider`; `CustomerAppScope` / `CustomerAppController` removed; route guards in `onGenerateCustomerRoute` |
| PR-2. Feature Providers — Riverpod rewrite | Completed | 2026-04-18 | 2026-04-24 | `customerOrdersProvider`, `customerOrderDetailProvider` (autoDispose family), `customerOrderBookingNotifier` + `BookingState`; screens are `ConsumerWidget` / `ConsumerStatefulWidget` with `ref.watch`; router uses `WidgetRef` in `onGenerateCustomerRoute` |
| PR-3. Token Refresh + HTTP Layer | Completed | 2026-04-18 | 2026-04-24 | `MobileHttpClient.onSessionRefresh` + `POST /api/v1/public/customer/auth/refresh` via `CustomerAuthRepository.refreshSession`; `customerApiHttpClientProvider` for orders/booking; `applyRefreshedSession`; l10n `common.sessionExpired`; `plainHttpClient` for auth to avoid refresh recursion; parallel with PR-4 |
| PR-4. Test Migration — ProviderScope + overrides | Completed | 2026-04-18 | 2026-04-24 | `TestAppWrapper` + `ProviderScope` + `overrides`; 9 `flutter test` in `apps/customer_app` + `dart analyze` clean |
| PR-5. Home Screen — real data + booking CTA | Completed | 2026-04-24 | 2026-04-24 | Greeting (name/phone/guest), active orders count from `customerOrdersProvider`, "Book a new order" CTA, profile AppBar icon, logout confirmation dialog; `CustomerHomeActiveOrdersCard` extended with `activeCount` + new l10n keys |
| PR-6. Profile Feature | Completed | 2026-04-24 | 2026-04-24 | `CustomerProfileScreen` (name + phone cards, sign-out confirmation); `AppRoute.profile` wired in router; 4 new l10n keys (EN + AR) |
| PR-7. Polish — colors + l10n audit | Completed | 2026-04-24 | 2026-04-24 | Zero raw `Colors.`/`Color(0x` outside theme files; all 110+ l10n keys cross-checked against app_localizations.dart — no missing keys; `flutter analyze` 0 issues |
| 8. Password Login Feature | Completed | 2026-04-24 | 2026-04-24 | Migration 0243 applied ✓. 3 new API routes (auth-options, login, password) + `customer-password.service.ts` (scrypt). `CustomerSessionModel.hasPassword`. `customerPasswordLoginProvider` + `customerSetPasswordProvider`. `CustomerPasswordLoginScreen` + `CustomerSetPasswordScreen`. Router wired. Login entry shows password button when `hasPassword=true`. OTP screen offers set-password after first login. Profile shows password status. 19 new l10n keys (EN+AR). `flutter analyze` 0 issues. `npm run build` ✓ |

### Pending Database Migrations (must be applied before PR-0b and Milestone 8)

| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/0243_org_customers_password.sql` | Adds `password_hash` + `password_updated_at` to `org_customers_mst` | Applied ✓ 2026-04-23 |
| `supabase/migrations/0244_org_tenants_slug.sql` | Adds `slug` column + unique index on tenant table (`org_tenants_mst`) for discovery | Applied ✓ 2026-04-23 |

---

### Milestone Outcome

At the end of this plan, the repository should have:

* a real mobile workspace layout
* working shared packages
* a buildable `customer_app`
* customer auth and guest entry
* one complete production-grade customer journey
* validation commands and release-quality guardrails

### First Production Journey

Recommended first production journey:

1. app launch
2. guest or authenticated entry
3. orders list
4. order detail
5. order status tracking timeline

Reason:

This flow delivers visible customer value with lower complexity and lower backend coupling than full order creation and payment.

### Second Production Journey

After tracking is stable:

1. service selection
2. address selection
3. pickup or delivery scheduling
4. order review
5. order submission

---

## Milestone Plan

## Milestone 0: Rules, Instructions, and Skills Preparation

### Goal

Prepare the mobile workspace governance layer before implementation starts so coding, reviews, and future automation follow one consistent standard.

### Deliverables

* finalize the authoritative mobile instruction sources
* align `cmx_mobile_apps/README.md`, `CLAUDE.md`, `AGENTS.md`, and `MOBILE_FOUNDATION_DECISIONS.md`
* separate current-state facts from target-state architecture
* define the implementation order explicitly: `customer_app` first
* create and align the Tier 1 mobile skills needed for architecture, Flutter code generation, UI work, localization, testing, and documentation
* document the validation commands the mobile workspace will use once scaffolded
* define the canonical review checklist for mobile PRs

### Required Output

* no contradiction between mobile instruction files
* mobile foundation document clearly marked truth-first and target-state where appropriate
* implementation plan approved for `customer_app` first
* Tier 1 local mobile skills created and referenced by the instruction layer
* clear guidance for how AI assistants and reviewers should behave before and during implementation

### Skills and Instruction Areas To Prepare

#### Architecture and Structure

* workspace layout rules
* package responsibility boundaries
* provider -> repository -> data source flow
* target dependency direction

#### Flutter Development

* widget composition rules
* state management rules
* typed model rules
* routing and app bootstrap rules

#### UI/UX

* theme and design-token rules
* loading, empty, offline, error, success state rules
* customer-facing screen quality bar
* EN/AR and RTL design requirements

#### Localization

* message-key conventions
* EN/AR same-milestone requirement
* no hardcoded text rule

#### Testing and Validation

* analyze, format, test, and build expectations
* minimum test types by milestone
* production-readiness validation gate definitions

#### Documentation and Review

* where implementation plans live
* where architecture decisions live
* what each milestone must document
* what reviewers must reject immediately

### Validation Gate

* mobile documentation has no known contradiction about current repo state
* instruction files point to the same architectural direction
* local mobile skills exist and are consistent with the instruction files
* target workspace, package, and app strategy are explicit enough to scaffold without guesswork
* milestone plan, validation rules, and review expectations are written down before coding starts

### Exit Criteria

The team can begin implementation without ambiguity about rules, structure, quality bar, review standards, or AI guidance.

---

## Milestone 1: Workspace Bootstrap

### Goal

Create the real mobile workspace so implementation can start on stable ground.

### Deliverables

* finalize the workspace folder strategy
* create actual Flutter app directories and package directories
* create `pubspec.yaml` for each app and package
* update `melos.yaml` to match the chosen layout
* establish baseline analyzer and formatter behavior
* ensure the workspace can bootstrap consistently

### Required Output

* `customer_app` exists as a real Flutter project
* `staff_app` and `driver_app` exist as minimal Flutter shells or placeholders with valid manifests
* shared packages exist with valid manifests and minimal exports

### Validation Gate

* `melos bootstrap` passes
* `melos analyze` passes
* `dart format --set-exit-if-changed .` passes or equivalent Melos format check
* `customer_app` can compile and launch into a minimal shell

### Risks

* choosing a temporary folder structure and changing it later
* copying starter code into the app instead of packages

### Exit Criteria

The repo contains a real, reproducible mobile workspace rather than documentation-only structure.

### Implementation Status

Current status: In Progress

Started on: 2026-04-18

Immediate scope:

* create real `apps/customer_app`, `apps/staff_app`, and `apps/driver_app`
* create real `packages/mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, and `mobile_testkit`
* create valid manifests and minimal bootstrap files
* align workspace docs with the new scaffold

### Implementation Status

Current status: In Progress

Started on: 2026-04-18

Immediate scope:

* create real `apps/customer_app`, `apps/staff_app`, and `apps/driver_app`
* create real `packages/mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, and `mobile_testkit`
* create valid manifests and minimal bootstrap files
* align workspace docs with the new scaffold

---

## Milestone 2: Shared Foundation Packages

### Goal

Build the reusable foundation once so `customer_app` can stay thin and production-safe.

### Deliverables by Package

#### `mobile_core`

* `AppConfig`
* `AppException` hierarchy
* `AppLogger`
* shared enums and constants
* format helpers
* result and error mapping primitives if needed

#### `mobile_l10n`

* EN and AR localization setup
* app localization delegate
* locale provider
* RTL helpers
* common shared message keys

#### `mobile_ui`

* app theme
* typography scale
* spacing tokens
* color tokens
* core primitives: button, text field, card, loading, empty state, error state, section header
* responsive helpers for phone-first layouts

#### `mobile_domain`

* only shared entities needed by customer flows
* shared value objects where cross-app reuse is likely
* no HTTP, storage, or Flutter framework leakage

#### `mobile_services`

* Dio client
* auth interceptor
* tenant/session interceptor strategy if needed
* secure token storage
* session manager
* connectivity service
* API error mapping into typed exceptions

#### `mobile_testkit`

* provider wrappers
* fake session manager
* fake repositories
* widget pump helpers
* starter test fixtures for customer flows

### Validation Gate

* package exports are clean and minimal
* EN and AR both render
* at least one shared widget test passes
* at least one service test passes
* one integration path proves config -> services -> typed result flow

### Exit Criteria

`customer_app` can depend on packages for config, l10n, UI, services, and typed domain structures without app-local duplication.

---

## Milestone 3: Customer App Shell

### Goal

Create the production shell of `customer_app`.

### Deliverables

* `main.dart` and app bootstrap
* splash and initialization flow
* router and route guards
* app shell with public and authenticated areas
* global error boundary strategy
* offline/no-connection baseline experience
* locale switching access
* theme wiring
* app-level navigation patterns

### Minimum Screens

* splash
* welcome or entry screen
* login entry
* guest entry
* home placeholder
* generic full-screen error page
* generic offline page or offline banner pattern

### UI/UX Requirements

* no placeholder-grade layout
* first screen must communicate trust and simplicity
* bilingual copy must fit visually in EN and AR
* spacing, card rhythm, and hierarchy must feel intentional
* navigation must remain clear in RTL

### Validation Gate

* app launches in EN and AR
* router handles startup correctly
* shell screens support loading, empty, and error patterns
* no hardcoded strings
* no raw Material components scattered without theme alignment

### Exit Criteria

`customer_app` has a credible production shell and is ready for real auth and data flows.

---

## Milestone 4: Authentication and Session

### Goal

Implement a complete customer entry flow that supports both guest browsing and authenticated usage.

### Deliverables

* phone entry
* OTP request flow if backend is ready
* OTP verification flow
* guest mode entry
* session restore
* logout
* protected route handling
* auth error handling
* user bootstrap state after login

### Business Rules

* backend is the authority for authentication
* app only orchestrates input, validation, session persistence, and route transitions
* no auth decision logic duplicated in widgets

### UI/UX Requirements

* minimum friction for login
* clear trust messaging around OTP and device/session behavior
* resend and retry states must be explicit
* loading and failure states must not trap the user
* guest path must be clearly separated from signed-in path

### Validation Gate

* session restore works after restart
* logout clears secure state
* protected routes reject unauthenticated users correctly
* auth failures are typed and user-friendly
* auth flow is covered by widget or integration tests

### Exit Criteria

The app can reliably enter public and authenticated customer states without leaking session bugs.

---

## Milestone 5: Customer Orders Tracking Journey

### Goal

Ship the first real customer value path: view orders, open an order, and understand current status clearly.

### Deliverables

* orders list screen
* order cards with high-signal summary
* order detail screen
* order status timeline
* promised time / delivery status area
* pull-to-refresh or equivalent refresh path
* empty state for first-time users
* error and retry handling

### Data Requirements

* typed order summary model
* typed order detail model
* repository and remote data source separation
* pagination or scalable loading strategy if needed

### UI/UX Requirements

* customer should know the current state in under three seconds
* timeline copy must be readable and reassuring
* status badges must be theme-driven, accessible, and localized
* detail page must prioritize what happens next, not raw operational noise

### Validation Gate

* list -> detail journey works against real or contract-stable APIs
* loading, empty, error, offline, and success states are complete
* screen-reader labels exist on primary interactive controls
* EN and AR layouts are both reviewed

### Exit Criteria

A customer can meaningfully track an order end-to-end in a production-quality flow.

---

## Milestone 6: Customer Order Creation Journey

### Goal

Add the first revenue-driving customer flow after tracking is stable.

### Deliverables

* service selection
* address selection or management
* pickup/delivery choice
* slot selection if backend supports it
* notes and preferences
* review and confirmation
* order submission success state

### Preconditions

Do not start this milestone until:

* tracking journey is stable
* required API contracts are confirmed
* pricing and scheduling rules are backend-owned and documented

### UI/UX Requirements

* keep the flow short and progressive
* show pricing as backend-provided, not client-authored
* preserve draft data safely between steps when appropriate
* prevent confusing back-navigation or duplicate submissions

### Validation Gate

* submission is idempotent or protected against accidental repeat taps
* form validation is clear and localized
* draft recovery or controlled discard behavior is defined
* success state clearly tells the customer what happens next

### Exit Criteria

The app supports a reliable first booking flow without shifting business logic into the client.

---

## Milestone 7: Hardening and Production Readiness

### Goal

Take the customer app from functional to release-ready.

### Workstreams

#### Accessibility

* screen reader pass
* touch target review
* color contrast review
* text scaling review
* reduced motion review where relevant

#### Performance

* startup profiling
* list rendering review
* image loading review
* unnecessary rebuild review
* network retry and timeout review

#### Security

* secure token storage verification
* release build settings
* crash-safe logging review
* no secrets in source
* no sensitive payload leakage in logs

#### Reliability

* flaky-state review
* offline handling review
* retry behavior review
* API exception mapping audit
* route recovery and restart behavior audit

#### Release Operations

* flavor configuration
* app icons and splash assets
* build scripts
* CI validation path
* release checklist

### Validation Gate

* static analysis clean
* targeted tests pass
* release build succeeds
* high-priority UX defects closed
* no open blocker in auth, tracking, or order creation

### Exit Criteria

`customer_app` is production-ready for controlled rollout.

### Implementation Status

Current status: Completed

Completed on: 2026-04-22

Delivered in this milestone:

* connectivity-aware app-shell recovery into and out of offline mode
* accessibility hardening for shared buttons and app-bar actions
* customer-app native `android/` and `ios/` platform scaffolds
* validated Android release APK build
* refreshed app-local and mobile-foundation documentation to match the on-disk state

---

---

## Production-Readiness Phases (PR-0 through PR-7) and Milestone 8

These phases address architectural gaps identified after Milestones 0–7 were marked complete. They must be executed before the app is considered truly production-ready.

### Execution Order

```
PR-0  (Riverpod deps + AppConfig)
  ↓
PR-0b (Tenant Discovery — slug API + QR screens)
  ↓
PR-1  (Shell Controller → Riverpod)
  ↓
PR-2  (Feature Providers → Riverpod)
  ↓
PR-3 + PR-4 (Token Refresh & Test Migration — parallel)
  ↓
PR-5 (Home Screen — real data)
PR-6 (Profile Screen)
  ↓
PR-7 (Polish — colors + l10n audit)
  ↓
Milestone 8 (Password Login)
```

### Milestone 8: Password Login Feature

**Goal:** Let customers set an optional password after OTP verification for faster future logins. OTP remains the primary registration and password-reset path.

**Architecture:** Hybrid — OTP mandatory for first login and recovery; password is opt-in for returning customers. Password stored as bcrypt hash (cost ≥ 12) in `org_customers_mst.password_hash` (nullable). Backend is the authority — no password logic in the app.

**Key Deliverables:**
- Migration 0243: `password_hash` + `password_updated_at` on `org_customers_mst`
- New API routes: `POST /public/customer/password`, `POST /public/customer/login`, `GET /public/customer/auth-options`
- `CustomerPasswordLoginNotifier` + `CustomerSetPasswordNotifier` (Riverpod)
- `customer_password_login_screen.dart` + `customer_set_password_screen.dart`
- Profile screen: shows password status, links to change-password flow
- 14 new l10n keys (EN + AR)
- Security: rate limit 5 failures/phone/15 min; `password_hash` never in API response; no default passwords

**Depends on:** PR-6 (Profile screen), migration 0243 applied.

**Milestone 4 extension note:** Authentication (Milestone 4) covers OTP-only entry. Password login is an opt-in extension that does not change the OTP flow — it adds a faster alternative path for returning customers who choose to set one.

---

## Cross-Milestone Standards

## Architecture Standards

* widgets call providers, not repositories or services directly
* repositories isolate API and cache concerns
* app code stays thin when shared code belongs in packages
* avoid app-local utilities that should live in shared packages

## Code Quality Standards

* no `dynamic` in core feature flows
* no raw map-based app state crossing layers
* typed exceptions only
* cohesive files and predictable naming
* no duplicate UI primitives

## UI State Standards

Every shipped screen must define:

* initial loading
* refresh loading if applicable
* empty state
* recoverable error state
* offline state if affected
* success state

## Localization Standards

* EN and AR must ship together
* no English-only fallback UI
* error messages shown to users must map to localization keys
* layout review is required in RTL, not assumed

## Testing Standards

Minimum by the time Milestone 7 completes:

* unit tests for services and repositories
* widget tests for auth entry and orders tracking screens
* integration coverage for startup, login, and tracking flow
* golden or visual regression checks for shared UI primitives if adopted

---

## Dependency and Risk Controls

## Backend Dependency Gates

The mobile team must not guess missing contracts. Before the related milestone begins, confirm:

### Before Milestone 4

* OTP request and verify endpoints exist or are contract-approved
* session payload shape is agreed
* token refresh or session restore behavior is agreed
* guest-mode capabilities and limits are defined

### Before Milestone 5

* orders list endpoint is stable
* order detail endpoint is stable
* status and timeline vocabulary are finalized enough for localization
* empty-state conditions are defined intentionally, not inferred ad hoc

### Before Milestone 6

* service catalog endpoint is stable
* address and scheduling contracts are stable
* booking validation and pricing authority are backend-owned
* order submission idempotency behavior is defined

## Dependency Approval Rules

Only add a new package when:

* the use case is real and current
* existing approved packages cannot solve it
* it does not undermine architecture consistency
* it does not weaken testability or maintenance

## Major Risks

### Risk 1: Building customer UI before shared foundations

Impact:

Fast initial progress, followed by expensive rework.

Control:

Do not skip Milestones 0 and 1.

### Risk 2: Shipping a polished shell with weak data behavior

Impact:

Looks good in demos, fails in production.

Control:

Every milestone must include loading, error, retry, offline, and restart behavior.

### Risk 3: Putting business logic in the app

Impact:

Pricing, workflow, and permissions drift from backend truth.

Control:

Keep backend as authority and audit feature flows before merge.

### Risk 4: EN-first implementation with AR added later

Impact:

RTL regressions and layout rewrites.

Control:

EN and AR must be reviewed in the same milestone before signoff.

---

## Suggested PR Breakdown

1. workspace scaffold and Melos alignment
2. `mobile_core` + `mobile_l10n`
3. `mobile_ui` primitives and theme
4. `mobile_services` + `mobile_domain` baseline
5. `customer_app` shell
6. auth and session flow
7. orders list and detail tracking flow
8. order creation flow
9. hardening, test expansion, release preparation

Each PR should stay narrowly scoped and leave the workspace passing its validation gate.

---

## Acceptance Checklist

Before calling the first customer app release candidate ready:

- [ ] Workspace structure is real and reproducible
- [ ] Shared packages exist and are used
- [ ] `customer_app` shell is polished and bilingual
- [ ] Auth and guest flows are stable
- [ ] Orders tracking journey is production-ready
- [ ] Order creation journey is production-ready
- [ ] No hardcoded strings or style values in shipped screens
- [ ] Error handling is typed and localized
- [ ] Release build succeeds
- [ ] Core flows are covered by tests
- [ ] Accessibility review completed
- [ ] Security and logging review completed

---

## Recommended Immediate Next Action

Start with Milestone 0 and treat it as an implementation project, not a documentation exercise.

The first concrete coding target should be:

* real mobile workspace scaffold
* shared package manifests
* `customer_app` Flutter shell
* `mobile_core`, `mobile_l10n`, and `mobile_ui` minimum viable foundations

Do not begin customer feature screens before that foundation exists.
