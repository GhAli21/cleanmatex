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
2. The next action should be obvious.
3. Tracking and reassurance are core product value, not secondary polish.
4. Do not expose internal operational noise to customers.
5. Guest and authenticated flows must both feel intentional.
6. UI polish must stay consistent with the shared theme, typography, spacing, and state patterns.

## UX Priorities

Prioritize:

* low-friction entry
* clear order visibility
* trust signals after user actions
* short, readable booking steps
* explicit progress and status messaging

## Home and Entry Rules

Home should answer:

* what is happening now
* what the customer can do next
* whether there is anything urgent to notice

Entry flows should:

* reduce friction
* clearly separate guest and signed-in paths
* avoid trapping the user in unclear auth states

## Order Tracking Rules

Tracking must:

* make the current status obvious quickly
* show what happens next
* avoid vague or internally coded status language
* handle empty and delayed states with reassurance

## Booking Rules

Booking should:

* stay short and progressive
* avoid unnecessary data entry
* show backend-owned pricing clearly
* prevent duplicate submissions
* end with a clear confirmation state

## Anti-Patterns

Reject these:

* dashboard screens with no obvious primary action
* multiple competing CTAs on the same customer screen
* exposing branch/staff/process terminology unnecessarily
* visually polished screens with broken or missing state handling

## Required Output

When using this skill, state:

1. the customer journey being improved
2. the primary user action
3. what reassurance or trust signal is provided
4. how empty, error, and edge states are handled

## Validation Checklist

- [ ] Primary action is obvious
- [ ] Customer language is simple and non-operational
- [ ] Tracking or booking state is understandable quickly
- [ ] Guest and signed-in behavior is intentional
- [ ] UX polish does not outrun functional completeness
