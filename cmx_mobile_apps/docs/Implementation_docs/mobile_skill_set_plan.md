# Mobile Skills Set Plan

## Overview

This document defines the recommended mobile-specific skill set for `cmx_mobile_apps/`.

The goal is not to create many skills. The goal is to create a small set of high-value skills that:

* reduce implementation ambiguity
* protect architecture quality
* enforce UI/UX standards
* prevent repeated mistakes
* help AI assistants and reviewers behave consistently

This plan assumes:

* existing repository state remains authoritative
* current global repo skills continue to exist and remain available
* mobile-specific skills should only be added when they cover mobile rules that are not already enforced well enough by global skills

---

## Where These Skills Should Live

Recommended location:

* `cmx_mobile_apps/.codex/skills/`

Reason:

These skills are specific to the mobile workspace and should not pollute the top-level skill set unless the same rules are intended to govern the entire repository.

---

## Design Principles for Mobile Skills

### Keep the Set Small

Do not create a separate skill for every feature. Only create a skill when the mobile workspace has a distinct rule set, repeated workflow, or fragile implementation pattern.

### Avoid Overlap

If a global skill already covers the topic well enough, do not duplicate it. Instead, the mobile skill should reference the global skill and add only mobile-specific deltas.

### Prefer Guardrails Over Essays

Each skill should be concise and operational:

* when to use it
* hard rules
* anti-patterns
* required outputs
* validation gates

### Follow Progressive Disclosure

Put only the essential workflow in `SKILL.md`. Move examples, templates, and longer references into `references/` when needed.

---

## Existing Global Skills to Reuse

The mobile skill set should reuse these existing repo skills instead of replacing them:

* `documentation`
* `testing`
* `debugging`
* `release-hardening`
* `repo-onboarding`
* `implementation`
* `i18n`
* `architecture`

Mobile-specific skills should add only what those global skills do not already cover for Flutter, mobile UX, package layout, and production hardening.

---

## Recommended Mobile Skills

## Tier 1: Create First

These are the highest-value skills and should be created before major mobile implementation starts.

### 1. `mobile-architecture`

#### Purpose

Govern mobile workspace structure, app/package boundaries, dependency direction, and reuse rules.

#### Use When

* deciding folder layout
* deciding whether code belongs in app or package
* creating or moving shared logic
* reviewing architectural drift
* setting up new mobile modules

#### What It Must Cover

* canonical mobile workspace layout
* responsibilities of `customer_app`, `staff_app`, `driver_app`
* responsibilities of `mobile_core`, `mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`, `mobile_testkit`
* dependency direction rules
* provider -> repository -> data source flow
* anti-patterns such as app-local duplication of shared logic

#### Hard Rules

* no app should become a monolith
* shared logic must move to packages when reused or clearly reusable
* no UI imports inside service or domain layers
* no package may depend on app code

#### Recommended Bundled References

* current workspace inventory
* target package map
* dependency graph examples

---

### 2. `flutter-foundation`

#### Purpose

Define the base Flutter implementation rules for routing, Riverpod, app bootstrap, typed models, error handling, and configuration.

#### Use When

* creating app bootstrap code
* creating providers
* creating repositories or service wiring
* implementing auth/session flow
* setting up navigation or configuration loading

#### What It Must Cover

* Riverpod conventions
* app bootstrap structure
* route setup patterns
* typed models and DTO mapping rules
* exception mapping
* config loading via `dart-define`
* session handling boundaries

#### Hard Rules

* no business logic in widgets
* no raw `dynamic` in feature flows
* no direct API calls from widget callbacks
* no leaking Dio errors to UI

#### Recommended Bundled References

* provider naming patterns
* repository template example
* route guard example
* session restore flow reference

---

### 3. `mobile-ui-system`

#### Purpose

Enforce the reusable mobile design system and screen-quality bar.

#### Use When

* building shared widgets
* creating or reviewing customer-facing screens
* defining theme tokens
* implementing loading, empty, error, and offline states

#### What It Must Cover

* theme token ownership
* typography, spacing, and color rules
* reusable widget rules
* state UI patterns
* responsive phone-first rules
* visual consistency rules

#### Hard Rules

* no hardcoded colors, spacing, or user-facing styles in feature code
* no placeholder-grade empty or loading states
* no duplicate primitives with slightly different names
* no public-facing screen ships without clear hierarchy

#### Recommended Bundled References

* state pattern examples
* base widget catalog
* customer shell visual standards

---

### 4. `mobile-customer-ux`

#### Purpose

Protect the product and UX quality of `customer_app`.

#### Use When

* designing onboarding
* designing guest mode
* designing auth UX
* designing order tracking
* designing booking flow
* reviewing customer-facing screens for clarity and trust

#### What It Must Cover

* trust and reassurance patterns
* low-friction auth
* guest vs signed-in experience
* home-screen action priority
* order tracking clarity
* booking flow simplicity
* customer copy tone rules

#### Hard Rules

* do not expose ERP-style noise to customers
* do not bury the next action
* do not create ambiguous order states
* do not let polish outrun state completeness

#### Recommended Bundled References

* order tracking UX guidance
* booking flow step rules
* home dashboard content priority

---

### 5. `mobile-i18n-rtl`

#### Purpose

Handle bilingual EN/AR implementation and RTL behavior for mobile-specific layouts and interactions.

#### Use When

* adding UI strings
* reviewing layouts in AR
* implementing localization setup
* creating customer-facing forms or timelines

#### What It Must Cover

* message key naming
* EN/AR same-milestone rule
* RTL alignment and spacing rules
* icon direction guidance
* copy length and truncation considerations
* localized dates, numbers, and currency display rules

#### Hard Rules

* no hardcoded strings
* no EN-first implementation with AR later
* no unreviewed RTL layout
* no user-visible backend error text

#### Recommended Bundled References

* key namespace examples
* common mobile copy keys
* RTL QA checklist

---

### 6. `mobile-testing`

#### Purpose

Define how mobile code is validated across unit, widget, integration, and visual tests.

#### Use When

* adding new mobile features
* reviewing milestone readiness
* writing test helpers
* deciding minimum validation scope

#### What It Must Cover

* test pyramid by milestone
* what must be unit tested
* what must be widget tested
* what needs integration coverage
* fake repository and fake session patterns
* visual regression rules for shared UI

#### Hard Rules

* do not treat manual QA as a substitute for core-flow tests
* do not ship auth and tracking flows without automated coverage
* do not skip validation gates because the UI looks finished

#### Recommended Bundled References

* milestone test matrix
* fake object patterns
* widget harness example

---

## Tier 2: Create After Tier 1

These skills are important, but should come after the core six because they depend on the architecture already being defined.

### 7. `mobile-api-contracts`

#### Purpose

Prevent the mobile app from guessing backend behavior and enforce clean contract boundaries.

#### Use When

* wiring APIs
* creating DTOs
* mapping API errors
* reviewing backend dependency assumptions

#### What It Must Cover

* contract-first implementation
* request/response typing
* DTO vs domain mapping
* missing-contract escalation rules
* auth/session contract checks
* idempotency and pagination expectations

#### Hard Rules

* no invented fields
* no silent contract assumptions
* no mixing backend payloads directly into UI state

---

### 8. `mobile-release-hardening`

#### Purpose

Act as the final production-readiness gate for mobile releases.

#### Use When

* preparing a release candidate
* doing final QA pass
* validating accessibility, performance, and security

#### What It Must Cover

* release validation checklist
* accessibility review
* performance review
* logging and secret handling review
* release-build expectations
* rollout readiness

#### Hard Rules

* no production release without a successful release build
* no unresolved blocker in auth or primary customer journey
* no logging of sensitive values

---

## Tier 3: Feature-Specific Skills

Create these only after the first production flows are stable.

### 9. `mobile-order-tracking`

#### Purpose

Provide focused rules for orders list, order detail, timeline, and customer reassurance states.

#### Use When

* building or revising orders tracking flows
* reviewing status language and hierarchy

#### What It Must Cover

* order summary hierarchy
* status timeline clarity
* promised time and exception messaging
* empty and retry behavior

---

### 10. `mobile-order-booking`

#### Purpose

Provide focused rules for service selection, address selection, scheduling, review, and order submission.

#### Use When

* building or revising booking flows
* reviewing progressive form UX

#### What It Must Cover

* short-step booking flow design
* duplicate-submit prevention
* draft preservation
* backend-owned pricing display
* review and confirmation UX

---

## Skills Not Recommended Initially

Do not create these at the beginning:

* one skill per screen
* one skill per widget type
* one skill for general Flutter syntax
* one skill for every package name
* separate customer-auth and customer-home skills before the broader customer UX skill exists

Reason:

That creates overlap, confusion, and maintenance overhead without improving outcomes.

---

## Creation Order

Recommended order:

1. `mobile-architecture`
2. `flutter-foundation`
3. `mobile-ui-system`
4. `mobile-customer-ux`
5. `mobile-i18n-rtl`
6. `mobile-testing`
7. `mobile-api-contracts`
8. `mobile-release-hardening`
9. `mobile-order-tracking`
10. `mobile-order-booking`

Reason:

The first six define structure, implementation behavior, UX, localization, and validation. The later four become more useful after real flows and backend contracts exist.

---

## Mandatory Skill Usage Matrix

Before writing code in these areas, the following mobile skills should be loaded:

| Task Type | Required Skill |
|---|---|
| Workspace layout, package boundaries, app-vs-package decisions | `mobile-architecture` |
| App bootstrap, Riverpod, routing, config, repositories, session flow | `flutter-foundation` |
| Shared widgets, theme, screen composition, state UIs | `mobile-ui-system` |
| Customer onboarding, guest mode, tracking UX, booking UX | `mobile-customer-ux` |
| EN/AR strings, RTL layouts, localization review | `mobile-i18n-rtl` |
| Test strategy, milestone validation, test helper patterns | `mobile-testing` |
| API integration and DTO mapping | `mobile-api-contracts` |
| Release candidate review and production gating | `mobile-release-hardening` |

---

## Recommended SKILL.md Structure

Each mobile skill should include:

1. purpose
2. when to use it
3. hard rules
4. anti-patterns
5. required outputs
6. validation checklist
7. references to bundled files when needed

Keep each `SKILL.md` concise. If it grows beyond a lean operational guide, move detailed examples and checklists into `references/`.

---

## Suggested Bundled References by Skill

### `mobile-architecture`

* `references/workspace-layout.md`
* `references/package-boundaries.md`

### `flutter-foundation`

* `references/provider-patterns.md`
* `references/bootstrap-routing.md`

### `mobile-ui-system`

* `references/state-patterns.md`
* `references/widget-catalog.md`

### `mobile-customer-ux`

* `references/customer-home.md`
* `references/tracking-ux.md`
* `references/booking-ux.md`

### `mobile-i18n-rtl`

* `references/key-conventions.md`
* `references/rtl-review-checklist.md`

### `mobile-testing`

* `references/test-matrix.md`
* `references/fakes-and-fixtures.md`

### `mobile-api-contracts`

* `references/contract-gates.md`
* `references/dto-mapping-rules.md`

### `mobile-release-hardening`

* `references/release-checklist.md`
* `references/mobile-accessibility-checklist.md`

---

## Recommended Immediate Next Action

Create only Tier 1 first:

* `mobile-architecture`
* `flutter-foundation`
* `mobile-ui-system`
* `mobile-customer-ux`
* `mobile-i18n-rtl`
* `mobile-testing`

Do not create Tier 2 or Tier 3 until the first six exist and the workspace scaffold is underway.
