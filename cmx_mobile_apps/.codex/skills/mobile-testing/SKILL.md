---
name: mobile-testing
description: Testing and validation standards for CleanMateX mobile apps. Use when planning or writing unit, widget, integration, and release-readiness validation for Flutter code in cmx_mobile_apps.
user-invocable: true
---

# Mobile Testing

Use this skill for mobile test strategy and validation gates.

## Read First

Read these before defining or reviewing validation:

* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`

Use the global `testing` skill as a general companion; this skill defines the mobile-specific bar.

## Core Rules

1. Manual QA is not enough for core customer flows.
2. Validation scope must match milestone risk.
3. Auth, tracking, and booking flows need automated coverage before production.
4. A visually polished screen is not complete if state transitions are untested.
5. Validation must catch banned committed debugging output such as `print()` and `debugPrint()`.

## Coverage Priorities

Focus first on:

* providers and repositories
* auth/session restore behavior
* orders list and detail flow
* booking flow once it exists
* shared widget behavior for core reusable UI

## Test Types

Use:

* unit tests for services, repositories, exception mapping, pure helpers
* widget tests for auth entry, screen states, orders tracking UIs
* integration tests for startup, login/session restore, and primary customer journey

Add visual or golden checks for shared UI only when the widget library is stable enough to justify them.

## Validation by Milestone

* Early scaffold milestones: bootstrap, analyze, basic smoke tests
* Foundation milestones: unit tests for services/helpers and at least one widget test for shared UI
* Customer flow milestones: widget and integration coverage for the shipped journey
* Release milestone: clean analysis, targeted tests, and successful release build

## Anti-Patterns

Reject these:

* relying only on manual device clicking for auth and tracking flows
* treating build success as proof of UX correctness
* shipping restart-sensitive session behavior without automated checks
* large feature work with no validation plan
* leaving committed `print()` or `debugPrint()` statements in mobile code

## Required Output

When using this skill, state:

1. the affected milestone or feature
2. the minimum test layers required
3. the validation commands to run
4. any remaining risk if full validation cannot be completed

## Validation Checklist

- [ ] Test scope matches feature risk
- [ ] Core customer journey has automated coverage where expected
- [ ] Restart/session behavior is validated when affected
- [ ] Analyze/format/test/build expectations are explicit
- [ ] Remaining gaps or residual risks are called out clearly
