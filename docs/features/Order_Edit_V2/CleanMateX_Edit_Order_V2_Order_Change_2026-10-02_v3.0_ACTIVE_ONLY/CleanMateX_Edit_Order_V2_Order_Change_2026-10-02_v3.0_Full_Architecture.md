# CleanMateX Edit Order V2 / Order Change — Full Architecture Pack

**Version:** 3.0  
**Date:** 2026-10-02  
**Status:** AUTHORITATIVE TARGET ARCHITECTURE  
**Supersedes:** 2026-10-02 v2.0 and 2026-09-22 Edit Order V2 / Order Change packs  
**Scope:** Post-commit commercial editing of orders in CleanMateX

---

## 1. Purpose

This document is the authoritative architecture for Edit Order V2.

The current production codebase remains the implementation source of truth. This document defines the target business and technical architecture that the implementation must converge toward. Where the current codebase has evolved into a stronger implementation, this pack explicitly reuses that newer capability rather than recreating it.

### Terminology

- **Edit** = user-facing process/capability.
- **Change** = committed, auditable business transaction applied to an already committed order.
- **Revision** = the resulting commercial version of the order after a Change.
- **Workflow transition** = operational status movement. It is not a commercial Change.
- **Financial resolution** = payment/refund/credit/wallet/overpayment handling after a Change. It is not the Change itself.

---

## 2. Architecture Goal

The architecture must provide one safe, auditable, future-proof boundary for post-commit commercial order edits while preserving existing mature CleanMateX domains.

### Core target

```text
Shared Order Editor
        |
        +-- Create Controller
        |      -> existing canonical New Order flow
        |
        +-- Edit Controller
               -> Order Change Preview
               -> Review Changes
               -> Order Change Apply
                       |
                       +-- stable-ID operations
                       +-- workflow capability checks
                       +-- pricing/tax/discount reuse
                       +-- financial snapshot reuse
                       +-- audit/change history
                       +-- idempotency
                       +-- outbox
```

### Architecture style

- Modular monolith.
- Transactional database boundary for Change Apply.
- Existing domain services remain authoritative.
- No event sourcing.
- No microservices requirement.
- No Edit-specific duplicate pricing engine.
- No Edit-specific duplicate finance engine.
- No full-order replacement after commitment.

---

## 3. Current Codebase Reconciliation — October 2026

The October 2026 codebase materially improved several domains since the earlier architecture pack.

### Reuse as authoritative existing capabilities

- Canonical New Order submission/orchestration.
- Pricing service.
- Promotion/discount engine.
- Tax engine.
- Order calculation service.
- Preference catalog/resolution and `org_order_preferences_dtl`.
- Workflow semantic runtime, gate evaluation, warning acknowledgement, override decisions, idempotency and workflow OCC.
- Financial aggregation and financial snapshot writer.
- Payment facts.
- Voucher architecture.
- Refund services.
- Stored-value/wallet/gift-card/AR services.
- Overpayment disposition mechanics.
- Idempotency utilities.
- Transactional outbox.
- Shared New Order/Edit Order workspace.

### Current architecture that must be replaced for V2

- Full-replacement committed Edit through `OrderService.updateOrder()`.
- Physical delete/recreate of committed items/pieces/preferences.
- Edit DTOs identified primarily by `productId` / `pieceSeq`.
- `expectedUpdatedAt` as primary commercial OCC.
- Snapshot-oriented `org_order_edit_history` as the authoritative transaction model.
- Hard-coded whole-order `isOrderEditable()` as the final editability authority.
- Product-based audit comparison instead of stable order-item identity.

### Current code confirmed in October

- `order-editability.ts` still uses a hard-coded editable status set and blocks processing/split conditions.
- `workflow-engine.service.ts` already provides semantic workflow policy, `state_version` OCC, row locking, idempotency, gates, warnings, override decisions and transactional composition.
- `edit-order-schemas.ts` explicitly defines item editing as full replacement, uses `productId`, does not carry persisted item/piece identity, and uses `expectedUpdatedAt`.

These findings strengthen—not invalidate—the target architecture.

---

## 4. Commitment Boundary

### Decision

Persist:

```text
committed_at timestamptz
committed_by uuid
```

Derived:

```text
isCommitted = committed_at IS NOT NULL
```

Do not add a redundant mutable `is_committed` source of truth.

### Rules

1. Initial canonical order commit establishes commercial facts, `committed_at`, `committed_by`, and initial `edit_state_version = 1`.
2. Commitment is irreversible.
3. Workflow may decide when initial commitment is allowed, but workflow status does not redefine whether the order is committed.
4. Quick Drop may be committed before detailed itemization.
5. Later commercial detailing of a committed Quick Drop must use the governed Change boundary.

A persisted `committed_status` is not required unless CleanMateX later introduces a genuine multi-state commitment lifecycle.

---

## 5. Versioning and Concurrency

Two independent versions are required.

```text
wf_state_version
edit_state_version
```

### wf_state_version

Owns operational workflow concurrency.

Current `state_version` is workflow-owned. V1 exposes it as `wfStateVersion` in Change DTOs while retaining the single physical `state_version` column. Profile/artifact revisions are different facts. A physical rename is deferred and requires its own consumer audit; do not create a second writable workflow counter.

### edit_state_version

Owns commercial Change revision and optimistic concurrency.

Rules:

- Initial committed order: `edit_state_version = 1`.
- One successful Order Change increments it exactly once.
- Preview does not increment it.
- Failed Apply does not increment it.
- `updated_at` is not primary commercial OCC.
- Apply sends both expected workflow and edit versions where needed.
- V1 uses strict conflicts; no automatic merge.

Preferred display: `Revision N`.

---

## 6. Edit Access Control

Add:

```text
edit_access_status
edit_block_reason_code
edit_block_reason_text
edit_blocked_at
edit_blocked_by
edit_block_until
```

Statuses:

```text
OPEN
TEMPORARILY_BLOCKED
PERMANENTLY_BLOCKED
```

`OPEN` means Edit capability may be evaluated, not that all operations are allowed.

Effective decision order:

1. Order is committed.
2. Edit access status permits evaluation.
3. Actor has `orders:edit`.
4. Workflow allows the specific operation/target.
5. Structural/domain invariants allow it.
6. Financial/fiscal restrictions allow it.
7. Override policy is evaluated if applicable.

Outcome:

```text
ALLOW
ALLOW_WITH_WARNING
REQUIRE_OVERRIDE
DENY
```

No global force-allow may bypass hard invariants.

---

## 7. Order Change Aggregate

Authoritative tables:

```text
org_order_changes_mst
org_order_change_ops_dtl
```

Preferred identifiers:

```text
order_change_id
change_no
change_reason
```

### org_order_changes_mst

Conceptual fields:

- id
- tenant_org_id
- order_id
- change_no
- edit_state_version_before
- edit_state_version_after
- wf_state_version_expected
- source_context
- actor_user_id
- actor_name/snapshot if required
- change_reason
- financial_before summary
- financial_after summary
- commercial_delta
- financial_outcome
- idempotency key/reference
- applied_at
- created_at
- metadata

### org_order_change_ops_dtl

Each semantic operation records:

- operation sequence
- operation code
- target type
- stable target ID or client temporary reference
- before values
- after values
- relevant typed columns where valuable
- audit summary
- created_at

The operation table is the authoritative semantic explanation of what changed.

### Legacy history

`org_order_edit_history` remains for legacy history, migration/backfill, compatibility and historical reporting if needed. It must not be the V2 authoritative transaction model.

---

## 8. API Contract

Preferred endpoints:

```http
POST /api/v1/orders/:orderId/changes/preview
POST /api/v1/orders/:orderId/changes
```

### Preview

Input contains expected edit version, expected workflow version where relevant, semantic operations, optional reason and source context.

Preview creates no pending Change row and performs server-authoritative validation, capability evaluation, commercial recalculation and financial preview.

### Apply

Apply requires `Idempotency-Key`, expected versions, semantic operations and required reason/override data.

Same idempotency key + same payload replays. Same key + different payload conflicts.

---

## 9. Semantic Operations

Representative V1 operations:

```text
ADD_ITEM
REMOVE_ITEM
CHANGE_ITEM_QUANTITY
ADD_PIECE
REMOVE_PIECE
ADD_PREFERENCE
CHANGE_PREFERENCE
REMOVE_PREFERENCE
CHANGE_PRIORITY
CHANGE_SERVICE_SPEED
CHANGE_READY_BY
CHANGE_ORDER_NOTES
CHANGE_CUSTOMER_SNAPSHOT
```

There is no `CHANGE_ITEM_PRODUCT`.

Different product = REMOVE old item + ADD new item.

---

## 10. Stable Identity

### Item identity

Existing committed order item: `lineRef = org_order_items_dtl.id`.

New unsaved item: `lineRef = client UUID`.

`productId` is product identity, not line identity.

### Piece identity

Existing piece: `pieceRef = persisted piece ID`.

New unsaved piece: `pieceRef = client UUID`.

`pieceSeq` is display/order metadata, not identity.

### Preference identity

Existing preference: `prefRef = org_order_preferences_dtl.id`.

New preference: `prefRef = client UUID`.

Current code must stop converting committed pieces to synthetic temp IDs during Edit.

---

## 11. Item and Piece Structural Rules

For piece-tracked items:

- Adding a piece increases item quantity.
- Removing a piece decreases item quantity.
- Decreasing committed quantity requires selecting/removing actual eligible piece(s).
- Never blindly trim committed piece arrays.
- Removing an existing committed piece keeps historical identity.
- New piece added and removed before Apply may disappear locally and create no operation.

Committed item/piece history must not be physically destroyed.

Current items, pieces and preferences already have `rec_status`. Reuse that lifecycle field; active readers must explicitly classify legacy NULL values before rollout and exclude governed removed rows. Do not add a second `is_deleted` source of truth. Add missing removal lineage only:

```text
deleted_at
deleted_by
deleted_order_change_id
```

---

## 12. Preferences Architecture

The current preference model is strong and should be reused.

All configured kinds remain preferences, including stain, damage, material, color, packing, piece notes, service preferences and future custom kinds.

Generic operations only:

```text
ADD_PREFERENCE
CHANGE_PREFERENCE
REMOVE_PREFERENCE
```

Level:

```text
ORDER
ITEM
PIECE
```

For PIECE level, carry and validate `order_id`, `order_item_id`, `order_item_piece_id`.

Existing preference identity must be preserved.

Before/after should support `preference_id`, `preference_code`, `preference_content`, `preference_sys_kind`, `preference_category`, `extra_price`.

Changing preference kind is normally REMOVE old + ADD new.

---

## 13. Pricing, Discounts, Tax, Charges and Rounding

Order Change does not own these engines.

Reuse current authoritative services.

Rules:

- Server authoritative.
- Unchanged committed items are not unnecessarily repriced.
- Changed/new items may require authoritative pricing.
- Client estimates are non-authoritative.
- No Edit-specific price-list versioning/pinning in V1.

`price_per_unit` retains the current owning calculator's persisted meaning: a gross selling amount in TAX_INCLUSIVE mode and a pre-tax selling amount in TAX_EXCLUSIVE mode. The projected contract exposes selling amount, taxable base and tax separately; do not relabel historical inclusive amounts as net. Existing item NUMERIC(10,3) storage and piece NUMERIC(19,4) storage require explicit quantization/range checks.

Preference extras follow the current level-specific accounting contract: ITEM/PIECE extras are already represented in line totals; ORDER PREFERENCE charges are separate addends. Do not sum every preference charge again. Current B18 order-level charges are flat non-taxable addends; taxable-charge expansion requires its owning domain's approved contract.

Discounts, charges, taxes and rounding remain in their owning domains.

---

## 14. Priority vs Service Speed

Separate concepts:

```text
priority
service_speed
```

Priority = operational precedence.

Service speed = commercial turnaround, e.g. STANDARD / EXPRESS / SAME_DAY.

Operations: `CHANGE_PRIORITY`, `CHANGE_SERVICE_SPEED`.

Do not deepen the legacy overlap where `express` doubles as priority/multiplier state.

---

## 15. Workflow Integration

The current workflow engine is a mature capability and must be reused.

It already provides profile-driven semantic transitions, screen membership, gates, warnings, acknowledgements, authorized overrides, required reasons, workflow OCC, row locking, idempotency, history and transaction composition.

Do not duplicate it.

Build a Change capability adapter/policy that asks whether a particular commercial operation on a particular target is currently allowed.

The current hard-coded `isOrderEditable()` is legacy/coarse behavior and must not be the final V2 authority.

---

## 16. Permissions

Preferred commercial Edit permissions:

```text
orders:edit
orders:edit_override
```

Reuse specialized pricing override, discount override, post-settlement, manual charge and refund permissions where applicable.

Current `orders:update` may remain temporarily for legacy/internal paths during migration.

---

## 17. Financial Architecture

Frozen principle:

```text
Commercial Change != payment/refund execution
```

Order Change changes commercial obligation. Finance determines the resulting financial state.

Reuse current mature payment facts, voucher facts, financial aggregation, snapshot writer, stored-value services, refund services, AR and overpayment disposition.

Do not build an Edit-specific financial engine.

### Example

Original:

```text
Order total = 20
Paid        = 20
```

Change reduces obligation to 15.

Historical payment/receipt remains 20.

New financial state: Overpayment = 5.

Never rewrite historical payment/receipt to 15.

Positive delta may increase outstanding. Do not automatically collect.

Negative delta first reduces outstanding. Only when settled value exceeds new obligation does overpayment exist.

---

## 18. Financial Follow-Up

After Change commits, derive a result such as:

```text
NONE
OUTSTANDING_OPTIONAL
OUTSTANDING_REQUIRED
OVERPAYMENT
```

Additional amount owed may use existing Payment Modal V4 capability.

Overpayment uses a focused Financial Resolution / Overpayment Resolution capability.

Possible allowed dispositions depend on source/policy: gateway refund, cash return, customer advance, customer credit, wallet restoration, gift-card restoration.

Reuse current overpayment/refund/stored-value mechanics.

Order Change and later financial resolution are separate transactions. A failed refund/gateway action does not roll back the committed Change.

---

## 19. Fiscal and Receipt Rules

Issued fiscal/payment documents are immutable business facts.

Corrections use Finance/Fiscal domain mechanisms such as credit/correction document, refund/outgoing voucher or restoration/credit transaction.

Order Change must not rewrite historical payment/receipt facts.

---

## 20. Shared UI Architecture

Keep the same familiar workspace.

```text
OrderEditor
  - TopBar
  - ProductCatalog
  - OrderItems
  - PieceEditor
  - PreferenceEditor
  - CustomerSection
  - OrderSummary
  - shared dialogs

NewOrderController
  -> draft/create/checkout

EditOrderController
  -> original/current state
  -> stable refs
  -> capability data
  -> semantic operation builder
  -> preview/apply
```

Shared components must not make API decisions based on a sprawling `isEditMode`.

Edit context bar should show order number, Revision N, status, unsaved change count and Discard Changes.

Primary action: Review Changes.

---

## 21. Review / Preview / Apply UX

While editing show Current Total, Estimated New Total, Estimated Change and pending semantic changes.

Review Changes calls server Preview and displays grouped item, piece, preference, service speed, priority, ready-by, customer snapshot and financial effects.

Apply is the only commit action.

On conflict: reload latest order. No auto-merge in V1.

---

## 22. Customer and Branch Rules

Post-commit customer identity is immutable in V1.

Customer snapshot/contact correction may be permitted as a governed operation according to policy.

Branch change is denied/deferred in V1. There is no V1 branch-reassignment enablement setting.

Cross-currency branch/order changes are prohibited in V1.

---

## 23. Quick Drop

Quick Drop may be committed before detailed items exist.

Later detailing may add item/piece/preference facts through Order Change.

Zero detailed items are valid only in supported modes such as Quick Drop.

---

## 24. Cancellation / Return / Issue / Stop

These remain separate business workflows.

Do not force them into Edit Order.

---

## 25. Idempotency, Audit, Outbox and External Calls

Every Apply Change is idempotent.

Inside the DB transaction: validate versions, lock/revalidate, apply operations, persist canonical commercial facts, recalc financial snapshot, persist Change master and ops, increment edit version, complete idempotency and write outbox.

No external HTTP/gateway/messaging API inside the core transaction.

---

## 26. Transaction Invariants

A Change fully applies or not at all.

If one operation fails, none persist.

Before commit, commercial facts must be coherent, financial snapshot must reconcile, versions must match, permissions/capabilities must remain valid and tenant scope must hold.

---

## 27. Multi-Tenancy / Security

All new org tables carry `tenant_org_id`.

Use existing CleanMateX tenant enforcement/RLS patterns.

Backend is authoritative for permissions, settings, workflow gates and feature entitlements.

---

## 28. Current-Code Migration Strategy

Do not perform a big-bang rewrite.

```text
current production behavior
        -> add V2 foundations
        -> build Preview
        -> build Apply
        -> connect Edit UI
        -> test and shadow-compare
        -> move committed write bypasses
        -> disable legacy committed full-replacement path
```

Protect canonical New Order throughout.

---

## 29. Current Code to Reuse

Keep and integrate, not rewrite:

- canonical New Order submission/orchestrator,
- order calculation,
- pricing,
- promotion/discount,
- tax,
- preference catalog/model,
- semantic workflow engine,
- workflow gate machinery,
- financial aggregation,
- financial snapshot writer,
- payments,
- vouchers,
- refunds,
- stored value,
- AR,
- overpayment mechanics,
- idempotency,
- outbox,
- shared Order UI.

---

## 30. Current Code to Retire or Reduce

After cutover:

- committed use of full-replacement `OrderService.updateOrder()`,
- committed item/piece physical delete/recreate,
- `expectedUpdatedAt` as Edit OCC,
- product-based line identity in committed Edit,
- synthetic committed piece IDs,
- hard-coded whole-order editability as V2 authority,
- `org_order_edit_history` as authoritative V2 transaction,
- simplistic `differenceAmount => charge/refund` Edit contract.

---

## 31. Testing Requirements

Unit: semantic operations, stable IDs, quantity/piece invariants, preference hierarchy, financial-result classification, edit access.

Integration: Preview no-write, Apply atomicity, idempotent replay/conflict, edit/workflow version conflicts, identity preservation, finance reconciliation, overpayment derivation, tenant isolation.

E2E: unpaid/partial/fully paid edits, upward/downward totals, preferences, pieces, conflicts, warnings, overrides, block states, Quick Drop detailing and financial follow-up.

---

## 32. Required Scenario Matrix

The implementation must cover unpaid, partially paid, fully paid, upward/downward totals, piece and preference edits at all levels, discounts/taxes, stored-value/split-tender/B2B AR, Quick Drop, concurrent editors, concurrent workflow transition, idempotent retry, temporary/permanent edit blocks, split-order restrictions, immutable customer identity, branch restrictions and failed downstream financial resolution.

---

## 33. Frozen Architecture Invariants

1. Post-commit commercial mutation uses one governed Change boundary.
2. Create Order remains separate from Change.
3. Edit, Change and Revision are distinct terms.
4. Commitment is irreversible.
5. `committed_at` is the commitment source of truth.
6. Workflow and commercial versions are separate.
7. One successful Change increments `edit_state_version` once.
8. Preview never mutates.
9. Apply is atomic.
10. Apply is idempotent.
11. Existing committed item identity is stable.
12. Existing committed piece identity is stable.
13. Existing preference identity is stable.
14. Product identity is not line identity.
15. Piece sequence is not piece identity.
16. No product-replacement operation.
17. Piece add increases quantity.
18. Piece remove decreases quantity.
19. Generic preference operations are used for all pref kinds.
20. PIECE preferences retain item + piece hierarchy.
21. Server is authoritative for money.
22. Existing pricing/tax/discount engines are reused.
23. Existing finance aggregation is reused.
24. Historical payment/voucher facts are immutable.
25. Commercial delta is not settlement instruction.
26. Overpayment is derived from financial state.
27. Payment Modal V4 is for additional collection, not generic overpayment resolution.
28. Overpayment resolution reuses Finance domain mechanics.
29. Issued fiscal facts are not rewritten.
30. Current workflow engine is reused, not duplicated.
31. Hard-coded whole-order editability is not V2 authority.
32. Tenant isolation is enforced server-side.
33. External calls are outside the core Change transaction.
34. `org_order_edit_history` is legacy/compatibility, not V2 authority.
35. New Order remains working throughout migration.

---

## 33A. Configuration & Policy Ownership

Configuration is a first-class part of Edit Order V2. The authoritative detailed matrix is in **CleanMateX Edit Order V2 — Configuration & Policy Matrix**.

The architecture deliberately avoids a monolithic `org_order_change_policy_cf` / `org_order_amendment_policy_cf` table. Effective policy is composed from:

```text
HQ feature/entitlement
→ small Edit-specific tenant settings
→ branch override only when explicitly supported
→ workflow commercial operation policy
→ existing Pricing/Discount/Tax/Finance/Delivery/Notification policy
→ per-order edit_access_status
→ actor permissions and current target facts
```

### V1 storage map

- **HQ rollout:** existing feature-flag system; dedicated V2 flag, not `order_fin_governed_amendments`.
- **Tenant Edit-specific choices:** use the canonical settings catalog/effective-settings API and its tenant overrides, as reconciled in the Configuration & Policy Matrix; limit additions to proven new/changed-item repricing and automatic-discount behavior. Legacy similarly named tables are not permission to register a parallel settings system.
- **Workflow operation policy:** extend current `sys_wf_*` profile/policy machinery so operation + target + current workflow state resolves to ALLOW / ALLOW_WITH_WARNING / REQUIRE_OVERRIDE / DENY, including reason requirements.
- **Per-order access:** `org_orders_mst.edit_access_status` and block fields.
- **Pricing override:** existing Pricing policy and `pricing:override`.
- **Tax:** existing Tax configuration; no Edit-specific tax rate setting.
- **Remaining due / overpayment / refund / stored value:** Finance-owned configuration and catalogs, including `sys_fin_overpay_res_cd`.
- **Delivery/fulfilment:** existing workflow/Delivery policy.
- **Preferences:** existing preference catalogs and `org_order_preferences_dtl`.
- **Notifications:** existing notification preferences/templates/outbox.
- **Customer identity and branch reassignment:** denied/deferred in V1; do not create enablement settings.
- **Generic maker/checker approval thresholds:** deferred.

### Configuration invariants

1. A tenant setting cannot bypass a hard structural, legal, workflow, fiscal, or Finance invariant.
2. Missing sensitive operation policy fails closed.
3. UI never becomes the policy authority; it renders server-resolved capability.
4. Preview reports the effective policy used for review. Apply reloads/revalidates it.
5. A material configuration or calculation change between Preview and Apply requires re-review instead of silently changing money or authorization.


## 34. Final Architecture Status

Architecture discussion is complete.

Reopen a frozen decision only when implementation discovers a concrete contradiction, missing business rule or superior existing codebase capability that materially changes the architecture.


## 35. Production Completeness Contract

This architecture is not considered implementation-complete merely because the Change transaction exists. The production feature includes the database, backend, APIs, security, configuration, frontend, audit/history, Finance follow-up, observability, rollout, and support behavior described in the companion v3.0 specifications.

The following companion artifacts are normative implementation contracts:

1. **Production Implementation Specification** — end-to-end technical contract; work-package sequence and progress belong only to `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md`.
2. **Database Schema Blueprint** — columns, keys, RLS, migration/backfill and lineage.
3. **API Contract Catalog** — routes, DTOs, responses, errors, idempotency and version behavior.
4. **Operation & Capability Catalog** — allowed semantic operations, target identities, payloads and policy ownership.
5. **Frontend / UI / UX Specification** — pages, controllers, components, loading/error/blocked/conflict/review/financial states and bilingual/RTL behavior.
6. **Service & Module Map** — current modules to reuse plus new modules and transaction boundaries.
7. **Configuration & Policy Matrix** — HQ, tenant, branch, workflow, per-order and domain-owned configuration.
8. **Permissions / Security Specification** — RBAC, RLS, CSRF, tenant validation, immutable facts and direct-DML restrictions.
9. **Events / Observability Specification** — outbox contracts, structured logs, metrics, tracing, alerts and SLOs.
10. **Test Traceability Matrix** — requirement-to-test coverage and release gates.
11. **Migration / Cutover / Operations Runbook** — preflight, additive migration, backfill, pilot, rollback and support procedures.
12. **Open Decisions & Release Gates** — unresolved business facts are explicit blockers; they may never be replaced by hidden developer assumptions.

### 35.1 No-implicit-policy rule

If behavior is configurable or domain-owned, code may not hard-code a fallback merely because configuration is absent. Missing required configuration must either:

- use an explicitly frozen default documented in the Configuration Matrix, or
- fail closed with a documented domain error.

### 35.2 No-hidden-contract rule

A behavior that affects persisted commercial facts, money, authorization, customer-visible UX, audit, or recovery must be represented in at least one normative contract and traced to tests. Comments in source code alone are not sufficient specification.

### 35.3 Production-readiness gate

A work package is not complete until its applicable DB/API/service/UI/security/configuration/test/observability documentation is updated and its acceptance tests pass. “Implemented” cannot mean “happy-path code exists.”
