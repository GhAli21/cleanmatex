---
name: mobile-i18n-rtl
description: Bilingual English/Arabic and RTL implementation rules for CleanMateX mobile apps. Use when adding user-facing text, localization keys, RTL-aware layouts, or localized dates/numbers/currency in cmx_mobile_apps.
user-invocable: true
---

# Mobile i18n and RTL

Use this skill for mobile localization and RTL behavior.

## Read First

Read these before adding or reviewing user-facing text:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Customer_app_01.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`

## Core Rules

1. EN and AR ship together in the same milestone.
2. No hardcoded user-facing strings.
3. RTL must be reviewed, not assumed.
4. User-visible errors must be localized and understandable.
5. Localized copy must fit the shared visual system without ad hoc per-screen styling hacks.

## Key Rules

Use consistent, feature-scoped keys.

Add EN and AR at the same time.

Prefer reusable common keys where applicable, but do not overload vague names.

## RTL Rules

Review:

* spacing and padding direction
* alignment and text flow
* icon direction when meaning depends on direction
* truncation and wrapping under longer Arabic copy

## Content Rules

Customer-facing copy should be:

* short
* clear
* reassuring
* free of backend jargon

## Formatting Rules

Localize or explicitly design handling for:

* dates
* times
* numbers
* money and currency presentation
* status labels

## Anti-Patterns

Reject these:

* English placeholders left in AR flows
* visually mirrored layouts with untranslated copy
* backend error messages exposed directly to the user
* iconography that points the wrong way in RTL

## Required Output

When using this skill, state:

1. the keys or text areas being added or changed
2. how EN and AR are both handled
3. what RTL-sensitive layout areas were reviewed
4. how user-visible formatting is localized

## Validation Checklist

- [ ] No hardcoded user-facing text remains
- [ ] EN and AR are both provided
- [ ] RTL layout was reviewed explicitly
- [ ] User-visible errors are localized
- [ ] Dates, numbers, and currency are intentionally formatted
