# Collect Payment — Testing Guide & Scenarios

## Automated status (2026-08-15)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint . --quiet` | exit 0 on all touched areas |
| `npm run check:i18n` | passed |
| `npx jest` (full) | **259 suites / 2423 tests passed** |
| `npm run build` | compiled successfully |
| `npm run check:platform-info-inventories` | drift 0; access-contract suites 10/10 |

**The modal still has no dedicated test file.** It is covered indirectly (service, route, wiring, payment-utils, and 630 payment/UI-component tests) but the focused matrix below is an open follow-up.

## Proposed unit/integration matrix

| Area | Cases |
|---|---|
| Permission | trigger inactive + reason without `orders:collect_payment`; modal returns null; API rejects |
| State contract | loading skeletons; catalog error + Retry recovers; empty method list; submit error persists inline; success closes + calls `onCollected` |
| Cash | tendered < amount blocks submit with message; change-due appears above epsilon; quick-tender chip sets tendered only, never amount; tenant `decimalPlaces` respected (2-decimal tenant shows 2) |
| Reference | `requires_reference` blocks submit for CHECK (number) and non-cash (reference); check due-date rule rejected server-side |
| Stale balance | authoritative value re-prefills when untouched; **preserved** when dirty, with notice; submit failure triggers refetch |
| Idempotency | same key across a network retry; new key on reopen; **new key on Delivery remount** |
| Notes | reaches `org_order_payments_dtl.rec_notes`; different note under same key ⇒ `IDEMPOTENCY_CONFLICT` |
| Surface props | `onPrintReceipt` fires only where passed; `handoverIntent` changes the CTA label |
| a11y | dialog has `aria-describedby`; amount autofocused; tendered `aria-invalid` when below amount; RTL |
| Regression | single-leg CASH produces the same voucher + drawer movement as before |

## Manual scenarios

Owner-runnable scenarios are maintained in
[`../Remediation_Work_Packages/QA_TEST_GUIDE.md`](../Remediation_Work_Packages/QA_TEST_GUIDE.md) **§11 — Collect Payment Enhancement**, with sidebar path, URL, and what to click.

**Manual QA has not yet been run on any surface.**

### The one that matters most

`/dashboard/delivery` — collect on one row, close, then open a **different** row. Confirm nothing leaked: amount, reference, check fields, notes, and the idempotency key must all be fresh. This mount **remounts** rather than toggling `open`, so it exercises a different reset path from the other two surfaces.

## Prerequisites

- An order with `payment_type_code = PAY_ON_COLLECTION` and a non-zero balance.
- A user holding `orders:collect_payment` (and a second **without** it, to check the gate).
- An open cash drawer session for cash methods.
- A method configured with `requires_reference = true` to exercise the reference gate.
- For the 2-decimal precision check, a tenant whose currency uses 2 decimals (AED/SAR/QAR).
