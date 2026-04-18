---
name: mobile-ui-system
description: Mobile design-system and screen-quality rules for CleanMateX Flutter apps. Use when building themes, reusable widgets, screen layouts, or loading/empty/error/offline/success states in cmx_mobile_apps.
user-invocable: true
---

# Mobile UI System

Use this skill for shared mobile UI, design tokens, and screen state patterns.

## Read First

Read these before building screens or reusable widgets:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
* `cmx_mobile_apps/docs/Customer_app_01.md`

## Core Rules

1. Public-facing mobile UI must feel intentional, simple, and trustworthy.
2. Shared visual rules belong in `mobile_ui`, not scattered across app screens.
3. Every shipped screen must define loading, empty, error, offline, and success behavior when applicable.
4. EN and AR must both look deliberate, not just functional.
5. Use canonical shared widget names and do not create duplicate suffix variants.

## Theme and Token Rules

Centralize:

* spacing
* typography
* colors
* surfaces
* status styles
* common paddings and corner treatments

Do not hardcode these repeatedly in feature screens.

## Reusable UI Rules

Create a shared widget only when it is:

* generic
* reusable
* not tied to one customer flow

Keep feature-specific compositions in the app.

Prefer canonical names such as:

* `AppTextFieldWidget`
* `AppCustomButtonWidget`
* `AppCustomDateField`
* `AppDatePickerButton`
* `AppDropdown`
* `AppFltrMapWidget`
* `AppCardWidget`
* `AppCheckBoxListTileWidget`
* `CustomSwitch`
* `AppHeaderWidget`
* `AppLoadingIndicator`

## State UI Rules

Every meaningful screen should have deliberate treatment for:

* initial loading
* empty state
* recoverable error
* offline or degraded mode if relevant
* success confirmation when an action completes

Do not ship blank placeholders, default spinners with no context, or generic red-error dumps.

## Customer Quality Bar

For `customer_app`:

* first impression must communicate trust
* main actions must be obvious
* card hierarchy must be readable quickly
* status labels must be visually distinct and accessible
* spacing and rhythm must stay coherent in EN and AR

## Anti-Patterns

Reject these:

* raw Material widgets repeated inconsistently across screens
* one-off colors and text styles in feature files
* dense ERP-style layouts in customer screens
* empty states without guidance
* duplicate naming such as `AppCardWidgetWidget`, `AppHeaderWidgetWidget`, or `AppLoadingIndicatorWidget`

## Required Output

When using this skill, state:

1. whether the change belongs in `mobile_ui` or app-local UI
2. which screen states are handled
3. how EN/AR and RTL were considered
4. how the design stays consistent with customer-facing quality goals

## Validation Checklist

- [ ] Shared visual rules are centralized
- [ ] Screen states are complete
- [ ] No placeholder-grade public UI remains
- [ ] EN and AR layouts are both considered
- [ ] The result is consistent with the overall mobile design system
