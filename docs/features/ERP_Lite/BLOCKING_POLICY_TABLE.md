---
document_id: ERP_LITE_BLOCKING_POLICY_TABLE_001
title: ERP-Lite Auto-Post Blocking Policy Table
version: "1.0"
status: Approved
approved_date: 2026-03-28
last_updated: 2026-03-28
author: CleanMateX AI Assistant
owner: HQ Governance (`cleanmatexsaas`)
applies_to: All ERP-Lite tenants
---

# ERP-Lite Auto-Post Blocking Policy Table

## 1. Purpose

This document defines the auto-post blocking policy for each transaction event code in ERP-Lite across v1, v2, and v3 scopes.

The blocking policy determines what happens when auto-posting fails for a given transaction type:
- **BLOCKING:** The business transaction cannot complete if posting fails. The failure must surface immediately as an error.
- **NON_BLOCKING:** The business transaction may complete even if posting fails. The failure enters the finance exception queue for later resolution.

This table is the authoritative reference for:
- HQ auto-post policy configuration (cleanmatexsaas)
- Runtime exception handling behavior (cleanmatex)
- Finance team review before Phase 5 implementation

> **Gate:** V1 policies in §3 must be human-approved before Phase 5 auto-post integration begins. V2 and V3 policies require a separate ADR approval.

---

## 2. Policy Definitions

### BLOCKING

When `blocking_mode = BLOCKING`:
- If posting fails, the triggering business transaction must **not complete**
- The failure must surface as an immediate exception/error to the caller
- The transaction enters an error state visible to operations
- Retry and repost flows apply after the failure is visible

**Default v1 critical transactions:** Invoice, payment, and refund posting are BLOCKING by default. Any deviation requires explicit policy approval.

### NON_BLOCKING

When `blocking_mode = NON_BLOCKING`:
- If posting fails, the business transaction **may complete** in its own domain
- The posting failure is captured in the finance exception queue
- The failure must be visible, queryable, and resolvable — silent failure is prohibited
- Retry and repost flows apply from the exception queue

---

## 3. V1 Event Blocking Policy

> These are the approved default policies for all 9 v1 locked events (Runtime Domain Contract §5).
> Any deviation from the defaults below requires explicit policy approval before Phase 5.

| `txn_event_code` | `blocking_mode` | `required_success` | `retry_allowed` | `repost_allowed` | `failure_action` |
|---|---|---|---|---|---|
| `ORDER_INVOICED` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `ORDER_SETTLED_CASH` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `ORDER_SETTLED_CARD` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `ORDER_SETTLED_WALLET` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `PAYMENT_RECEIVED` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `REFUND_ISSUED` | `BLOCKING` | `true` | `true` | `true` | Raise exception — transaction blocked |
| `EXPENSE_RECORDED` | `NON_BLOCKING` | `false` | `true` | `true` | Enter FINANCE_EXCEPTION queue |
| `PETTY_CASH_TOPUP` | `NON_BLOCKING` | `false` | `true` | `true` | Enter FINANCE_EXCEPTION queue |
| `PETTY_CASH_SPENT` | `NON_BLOCKING` | `false` | `true` | `true` | Enter FINANCE_EXCEPTION queue |

### Policy Rationale

**BLOCKING events (invoice, settlement, payment, refund):** These are revenue-impacting and AR-impacting transactions. A missing or failed journal entry for these events would create an immediate accounting discrepancy that cannot be silently tolerated. The business transaction must not complete if the finance effect is not safely recorded.

**NON_BLOCKING events (expense, petty cash):** These are internal operational transactions where the operational action (recording the expense or petty cash movement) may need to proceed even if the GL posting temporarily fails. Finance team can resolve these via the exception queue without blocking operations.

---

## 4. V2 Planned Blocking Policies

> **Status: Planned — not locked for implementation.**
> Anticipated default policies for v2 events. Each must be confirmed in a v2 ADR before implementation.

| `txn_event_code` | Proposed `blocking_mode` | Proposed Rationale |
|---|---|---|
| `DISCOUNT_APPLIED` | `BLOCKING` | Discount affects net revenue — must be safely recorded if discount changes the AR balance |
| `LOYALTY_POINTS_REDEEMED` | `BLOCKING` | Loyalty redemption reduces AR — revenue-impacting, should be BLOCKING |
| `DELIVERY_CHARGE_INVOICED` | `BLOCKING` | Delivery is a revenue line — same rationale as ORDER_INVOICED |
| `TIP_COLLECTED` | `NON_BLOCKING` | Tips are pass-through operational items — operational flow should not be blocked if tip posting fails |
| `ADVANCE_PAYMENT_RECEIVED` | `BLOCKING` | Advance receipt creates a liability — must be recorded safely; failure should block confirmation of receipt |

> **Gate:** Proposed policies above are indicative. A v2 ADR must confirm or revise each before Phase 2 auto-post integration.

---

## 5. V3 Planned Blocking Policies

> **Status: Planned — subject to v3 scope confirmation.**
> Highly speculative until v3 scope is formally locked. Do not configure without explicit approval.

| `txn_event_code` | Proposed `blocking_mode` | Proposed Rationale |
|---|---|---|
| `ADVANCE_PAYMENT_APPLIED` | `BLOCKING` | Applying an advance reduces liability and AR — financial integrity critical |
| `INTERCOMPANY_CHARGE` | `BLOCKING` | Intercompany transactions affect multiple entity ledgers — must be safely and symmetrically recorded |
| `SUBSCRIPTION_INVOICED` | `BLOCKING` | Subscription invoicing creates AR — same rationale as ORDER_INVOICED |
| `COGS_RECORDED` | `NON_BLOCKING` | COGS may follow a best-effort posting model for operational flow continuity — subject to v3 ADR decision |

> **Gate:** All v3 blocking policies require a v3 scope document and ADR. Do not implement without explicit written approval.

---

## 6. Approval Note

- V1 blocking policies in §3 are approved as part of the v1.0 canonical document pack (2026-03-28)
- V1 policies must be reviewed by the project owner before Phase 5 auto-post integration
- Any deviation from the BLOCKING default for revenue-impacting events requires explicit approval
- V2 and V3 entries are planning guides only — each requires a separate ADR approval before configuration

---

## 7. Related Documents

- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md) — Auto-post policy decision and retry/repost model
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md) — §4 Auto-Post Control Rules, §4.3 BLOCKING defaults
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md) — §5 V1 locked event catalog, §15 Retry vs Repost contract, §16 Exception Queue contract
- [V1_POSTING_RULES_CATALOG.md](V1_POSTING_RULES_CATALOG.md) — DR/CR rules per event that this policy governs
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md) — Ownership split for auto-post policy
