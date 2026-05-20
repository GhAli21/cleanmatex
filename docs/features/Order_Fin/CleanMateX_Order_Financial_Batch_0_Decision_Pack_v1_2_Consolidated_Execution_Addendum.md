# CleanMateX Order Financial Platform - Batch 0 Decision Pack v1.2 Consolidated Execution Addendum

**Document Type:** Consolidated Execution Addendum  
**Version:** v1.2 Consolidated  
**Status:** Drafted for Approval  
**Project:** CleanMateX Business / SaaS Platform  
**Module:** Order Financial Platform / Order Fin  
**Base Document:** `CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_Approved.md`  
**Related Consolidated Review Inputs:**  
- `CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_1_Addendum.md`
- `CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_1_2_Execution_Addendum.md`

**Prepared Date:** 2026-05-20  
**Purpose:** Replace layered corrective addenda with one execution-safe Batch 0 baseline that preserves the approved strategic direction, aligns to the live repo contracts, and removes conflicting status, RBAC, and snapshot guidance.

---

# 0. Supersession Rule

This document is the intended replacement for the layered Batch 0 addenda.

Supersession intent:

```text
Base strategic authority remains:
  CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_Approved.md

Execution addenda to be treated as superseded review history once this document is approved:
  CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_1_Addendum.md
  CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_1_2_Execution_Addendum.md
```

Execution rule after approval:

```text
Engineering should use:
  v1.0 approved decision pack
  + this v1.2 consolidated execution addendum

Engineering should not combine multiple older addenda with this document.
```

---

# 1. Executive Summary

The Batch 0 strategic direction remains approved:

```text
Business Voucher
= business-finance source-document foundation

Order Fin
= order-specific operational finance domain
```

This consolidated execution addendum freezes the implementation details that were still ambiguous or conflicting across the layered addenda:

```text
1. Canonical Batch 0 order payment_status values are limited to the current DB-safe set.
2. New writes must use uppercase status values; legacy lowercase values must be normalized on read.
3. Refund RBAC must remain compatible with the current live permission and route contract.
4. Manual-exception refunds require a single new additive permission and mandatory controls.
5. Partial later collection is allowed by default and may be overridden only by HQ-managed tenant settings.
6. Snapshot columns must align to existing live schema names.
7. Missing per-credit header values must be derived from org_order_credit_apps_dtl, not added blindly.
8. Existing gateway and payment-config stabilization blockers remain mandatory pre-production fixes.
```

---

# 2. Final Consolidated Decisions

| ID | Decision | Consolidated Execution Outcome |
|---|---|---|
| C-001 | Batch 0 order payment status scope | Limit `org_orders_mst.payment_status` to values already allowed by the current DB constraint. |
| C-002 | Legacy status compatibility | Use uppercase for new writes; normalize lowercase legacy values during transition. |
| C-003 | Refund RBAC contract | Keep current live refund permission codes; add only `orders:refunds:manual_exception`. |
| C-004 | Manual-exception refund rule | Allow only with explicit permission, mandatory reason, and audit trail. |
| C-005 | Partial later collection ownership | Default allowed in app logic; HQ tenant setting may override; branch override is deferred. |
| C-006 | Snapshot naming | Use existing live schema names where they already carry the correct meaning. |
| C-007 | Per-credit header behavior | Keep lean header snapshot; derive missing per-type credit values from detail rows. |
| C-008 | Gateway and payment-config blockers | Keep both as required stabilization work before production sign-off. |

---

# 3. C-001 - Canonical Batch 0 Order Payment Status Scope

## Approved Rule

For Batch 0 stabilization, `org_orders_mst.payment_status` must stay within the values already supported by the current database constraint.

Approved canonical values:

```text
UNPAID
PENDING_COLLECTION
PARTIALLY_PAID
PAID
OVERPAID
```

## Explicit Non-Approval for Batch 0 Header Status

Do not add these values to `org_orders_mst.payment_status` in the stabilization batch:

```text
REFUND_PENDING
PARTIALLY_REFUNDED
REFUNDED
CANCELLED
FAILED
```

Use other existing fields instead:

```text
refund progress -> org_order_refunds_dtl.refund_status
order cancellation -> existing order/workflow lifecycle fields
payment-row failure -> org_order_payments_dtl.payment_status
```

## Why

The current migration constraint already supports:

```text
UNPAID
PENDING_COLLECTION
PARTIALLY_PAID
PAID
OVERPAID
```

Expanding the header status set without a dedicated reviewed migration would create a contract mismatch between documentation and the live database.

---

# 4. C-002 - Legacy Status Compatibility and Normalization

## Approved Rule

All new writes must use uppercase canonical values.

Legacy lowercase values must be tolerated through normalization during transition.

## Legacy Compatibility Mapping

| Legacy Value | Canonical Value | Rule |
|---|---|---|
| `pending` | `PENDING_COLLECTION` or `UNPAID` | Use `PENDING_COLLECTION` only when deferred pickup/collection context is present; otherwise `UNPAID`. |
| `unpaid` | `UNPAID` | Direct mapping |
| `partial` | `PARTIALLY_PAID` | Direct mapping |
| `partially_paid` | `PARTIALLY_PAID` | Direct mapping |
| `paid` | `PAID` | Direct mapping |
| `overpaid` | `OVERPAID` | Direct mapping |
| unknown value | `UNPAID` | Fail safe plus audit/logging |

## Required Utilities

Batch 0 implementation must provide or centralize:

```text
normalizeOrderPaymentStatus(value, context)
isOrderPaidStatus(value, context)
isOrderOutstandingStatus(value, context)
```

## Execution Rule

```text
Do not compare raw 'paid', 'partial', or 'pending' strings in UI or services.
Always normalize first.
```

## Deferred Work

Optional data backfill from lowercase to uppercase may be done later through a separate reviewed migration. It is not required to freeze this execution baseline.

---

# 5. C-003 - Refund RBAC Must Stay Compatible with the Live Repo

## Approved Rule

Batch 0 must preserve the current live refund permission namespace and route contract.

Primary live permission codes:

```text
orders:view_financial_breakdown
orders:process_refund
orders:approve_refund
orders:collect_payment
```

## Exact Usage

```text
view refund and order finance data -> orders:view_financial_breakdown
create/initiate normal refund -> orders:process_refund
approve refund -> orders:approve_refund
collect later payment -> orders:collect_payment
manual exception refund without valid lineage -> orders:refunds:manual_exception
```

## Explicit Non-Approval

Do not introduce a full new Batch 0 refund namespace such as:

```text
orders:refunds:view
orders:refunds:create
orders:refunds:approve
orders:refunds:cancel
orders:refunds:reverse
```

Any future migration to a fully namespaced refund RBAC model is out of scope for Batch 0 stabilization.

---

# 6. C-004 - Manual-Exception Refund Contract

## Approved New Additive Permission

Batch 0 may add exactly one new refund permission:

```text
orders:refunds:manual_exception
```

This permission must be seeded through a new DB migration before the feature is enabled.

## Manual-Exception Rules

Manual-exception refund requires all of the following:

```text
refund_scope = MANUAL_EXCEPTION
orders:refunds:manual_exception permission
non-empty reason
audit log and outbox event
approval when refund approval workflow is enabled
```

Manual exception is not allowed as a silent fallback when valid lineage exists.

If valid source rows exist:

```text
original_payment_id -> must be used for real-payment refund
original_credit_app_id -> must be used for credit-application reversal
original_fin_voucher_trx_line_id -> future wiring support when available
```

## Recommended Role Exposure

| Role | Recommendation |
|---|---|
| Cashier | No |
| Branch Manager | Optional by tenant policy |
| Tenant Admin | Yes |
| Finance User | Yes |
| Platform Support | Optional if support process requires it |

---

# 7. C-005 - Partial Later Collection Source of Truth

## Baseline Batch 0 Behavior

```text
allow_partial_later_collection = true
require_full_collection_on_pickup = false
```

Later collection is allowed to be partial by default.

## Settings Governance Rule

Settings ownership must follow the project governance model:

```text
settings are HQ-managed
settings are consumed here via HQ API
this project must not query sys_stng_* directly
```

## Approved Setting Keys

Recommended HQ-managed tenant settings:

```text
orders.payments.allow_partial_later_collection
orders.payments.require_full_collection_on_pickup
```

## Resolution Order for Batch 0

```text
1. HQ tenant setting override if available
2. otherwise hardcoded tenant-app default
```

Branch override is explicitly deferred from Batch 0.

## Business Rules

```text
If allow_partial_later_collection = true:
  later collection payment may be less than outstanding_amount.

If require_full_collection_on_pickup = true:
  later collection payment must equal outstanding_amount unless an approved override rule exists.

If both conflict:
  require_full_collection_on_pickup wins.
```

## Validation Rules

```text
collection_amount > 0
collection_amount <= outstanding_amount unless overpayment is explicitly allowed
each completed collection reduces outstanding_amount
payment_status remains PARTIALLY_PAID or PENDING_COLLECTION until fully settled
payment_status becomes PAID only when outstanding_amount reaches zero
```

---

# 8. C-006 - Snapshot Naming Must Align to the Live Schema

## Approved Rule

Use existing live schema names where they already represent the approved business meaning.

Do not add duplicate semantic columns only because the decision pack used cleaner conceptual names.

## Approved Mapping

| Approved Concept | Use Existing Live Schema Name | Do Not Add Duplicate |
|---|---|---|
| payment status | `payment_status` | `payment_status_code` |
| total charges | `total_charges_amount` | `charges_amount` |
| total paid | `total_paid_amount` | `paid_amount` |
| total credit applied | `total_credit_applied_amount` | `credit_applied_amount` |
| outstanding amount | `outstanding_amount` | replacement field |
| pay-on-collection amount | `pay_on_collection_amount` | duplicate deferred field |
| gift card applied | `gift_card_applied_amount` | replacement field |

## Execution Rule

Before adding any Order Fin snapshot column:

```text
1. Inspect Prisma schema and DB shape.
2. Reuse a live column when meaning already matches.
3. Add a new column only when a real semantic gap exists.
4. Defer renaming to a dedicated normalization migration, not Batch 0 stabilization.
```

---

# 9. C-007 - Per-Credit Snapshot Column Matrix

## Approved Header Snapshot Rule

For Batch 0 stabilization, header snapshot must remain lean.

Approved existing header values:

```text
total_credit_applied_amount
gift_card_applied_amount
```

## Concrete Matrix

| Concept | Current Handling | Batch 0 Rule |
|---|---|---|
| total credit applied | existing header column | keep on header |
| gift card applied | existing header column | keep on header |
| wallet applied | derive from detail | do not add blindly |
| advance applied | derive from detail | do not add blindly |
| credit note applied | derive from detail | do not add blindly |
| loyalty value applied | derive from detail | do not add blindly |
| customer credit applied | derive from detail | do not add blindly |

## Reporting Rule

Per-type credit breakdown must come from:

```text
org_order_credit_apps_dtl.credit_type
```

aggregated by type in API/reporting logic.

## Explicit Non-Approval

Do not add these header columns in Batch 0 stabilization unless a separate approved migration is later justified by performance or reporting:

```text
wallet_applied_amount
advance_applied_amount
credit_note_applied_amount
loyalty_value_applied_amount
customer_credit_applied_amount
```

---

# 10. C-008 - Preserve Mandatory Stabilization Blockers

## Gateway Payment Blocker

Keep the existing gateway correction as mandatory Batch 0 stabilization work:

```text
gateway-capable methods start as PENDING or PROCESSING
only confirmed success becomes COMPLETED
only COMPLETED real payments contribute to total_paid_amount
failed or cancelled gateway rows do not reduce outstanding amount
```

## Payment Configuration Blocker

Keep the current payment-config route/schema issue as mandatory Batch 0 stabilization work:

```text
do not filter org_payment_methods_cf by nonexistent branch_id
tenant-level method retrieval must remain valid
branch-specific behavior must come from an approved branch-scoped source, not a fake column assumption
```

---

# 11. Required Stabilization Backlog

| ID | Title | Priority | Required Action |
|---|---|---|---|
| ADD-001 | Align snapshot contract to live schema names | P0 | Reuse existing schema names and avoid duplicate semantic columns. |
| ADD-002 | Freeze canonical payment_status values | P0 | Use DB-safe uppercase set only; add normalization utilities and compatibility tests. |
| ADD-003 | Define per-credit snapshot behavior | P0 | Keep `total_credit_applied_amount` and existing `gift_card_applied_amount`; derive the rest from detail rows. |
| BUG-OF-001 | Fix gateway completion behavior | P0 | Gateway-capable methods remain pending until provider confirmation. |
| BUG-OF-002 | Add refund lineage contract | P0 | Capture original payment/credit references and future voucher-line linkage support. |
| BUG-OF-003 | Support incremental partial later collection | P0 | Default partial later collection to allowed; respect HQ tenant override if available. |
| BUG-OF-004 | Fix payment config route/schema mismatch | P0 | Remove invalid branch filter or use approved branch-scoped configuration source. |
| SEC-OF-001 | Seed manual-exception refund permission | P0 | Add `orders:refunds:manual_exception` and enforce it. |
| SET-OF-001 | Integrate optional HQ tenant settings for later collection | P1 | Resolve via HQ API as override layer, not prerequisite. |

---

# 12. Test Plan

## Status Compatibility

```text
legacy lowercase rows normalize correctly
new writes are uppercase only
UI and services do not compare raw 'paid'/'partial'/'pending' strings
```

## Refund RBAC and Lineage

```text
normal refund uses orders:process_refund
refund approval uses orders:approve_refund
manual exception requires orders:refunds:manual_exception
manual exception requires reason
normal refund with valid lineage does not require manual-exception permission
```

## Partial Later Collection

```text
default partial later collection succeeds
HQ tenant override can require full collection
outstanding amount reduces correctly across multiple collection events
```

## Snapshot and Per-Credit Behavior

```text
no duplicate header columns are introduced
per-credit breakdown is derived from org_order_credit_apps_dtl
header snapshot remains lean
```

## Gateway Behavior

```text
pending gateway does not increase total_paid_amount
failed gateway does not reduce outstanding_amount
confirmed gateway does increase total_paid_amount
```

## Payment Configuration

```text
route no longer filters org_payment_methods_cf by nonexistent branch_id
tenant-level retrieval works with and without branch context in the request
```

---

# 13. Final Execution Baseline

After approval, engineering should use this baseline:

```text
CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_Approved.md
+ CleanMateX_Order_Financial_Batch_0_Decision_Pack_v1_2_Consolidated_Execution_Addendum.md
```

Older layered addenda should be treated as historical review artifacts, not active execution baseline.

## Final Rule

```text
The strategic direction is approved.
The implementation must align to the live schema.
Canonical Batch 0 header payment statuses are limited to the current DB-safe uppercase set.
Legacy lowercase values must be tolerated through normalization during transition.
Refund RBAC must stay compatible with the current live permission and route contract.
Manual-exception refunds require orders:refunds:manual_exception.
Partial later collection is allowed by default and may be overridden only by HQ-managed tenant settings.
Per-credit snapshot columns must not be added blindly; derive missing per-type values from detail rows.
```

---

# 14. Final Recommendation

Recommended engineering sequence after approval:

```text
1. Implement payment_status constants and normalization against the DB-safe canonical set.
2. Align snapshot contract to the current Prisma schema.
3. Fix gateway payment completion behavior.
4. Add refund lineage fields and service/API contract support.
5. Seed and enforce orders:refunds:manual_exception.
6. Support partial later collection as default-allowed behavior, with optional HQ tenant setting override.
7. Fix the payment configuration route/schema mismatch.
8. Add required tests.
9. Then proceed to UI and reporting improvements.
```
