# Customer App Orders

This feature pack is the planning authority for the customer mobile identity, tenant access, branch eligibility, Fast Quick Drop requests, staff conversion, and Detailed Order journeys.

## Status

Planning complete; implementation has not started. See [STATUS.md](STATUS.md) and [PLAN.md](PLAN.md).

## Scope

- Global customer sign-in by verified mobile number or email.
- Customer-controlled tenant visibility.
- Customer-app and POS branch availability.
- Fast Quick Drop request lifecycle and staff conversion to an order.
- Detailed Order booking using authoritative tenant catalog and commercial services.
- Customer request/order tracking on the mobile application.

## Out of scope

- Applying database migrations.
- Payment gateway onboarding, delivery routing optimization, loyalty, and notifications beyond the contracts needed by this feature.
- HQ changes unless a later plan/feature-flag decision proves they are required.

## Reading order

1. [DESIGN.md](DESIGN.md) — domain decisions and invariants.
2. [PLAN.md](PLAN.md) — sequenced implementation work and gates.
3. [TESTING.md](TESTING.md) — verification requirements.
4. [STATUS.md](STATUS.md) — current implementation progress.
