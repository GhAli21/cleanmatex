# CleanMateX Edit Order V2 — Service & Module Map

**Version:** 3.0

## 1. Backend ownership

### Reuse unchanged/with narrow adapters

- canonical Create: `app/api/v1/orders/submit-order/route.ts`, `order-submit-orchestrator.service.ts`;
- calculation/pricing/discount/tax/rounding current services;
- `order-financial-aggregation.ts`, `order-financial-write.service.ts`, financial summary;
- workflow semantic policy/gates/facts/decision infrastructure;
- preference catalogs/resolvers;
- payments/vouchers/refunds/stored value/AR/cash drawer;
- idempotency and outbox infrastructure.

### New coherent module

```text
lib/constants/order-change.ts
lib/types/order-change.ts
lib/validations/order-change/order-change.schemas.ts
lib/services/order-change/
  order-change-context.service.ts
  order-change-capability.service.ts
  order-change-projection.ts
  order-change-calculation.service.ts
  order-change-financial-result.service.ts
  order-change-preview.service.ts
  order-change-mutation.service.ts
  order-change-apply.service.ts
```

Do not make one class/file per operation unless behavior is genuinely domain-complex; operations should primarily dispatch to shared typed adapters.

## 2. Service contracts

### Context service

Read-only; tenant-scoped; loads commitment, both versions, access, workflow binding, active stable identities, preferences, money summary, config and actor capabilities. No DML.

### Capability service

Pure/read-oriented decision service. It does not execute workflow transitions. Inputs are order context + actor + operation + target + policy facts. Returns decision, reason codes, warning/override/reason requirements and proof inputs.

### Projection

Deterministic in-memory transform. No DB writes and no network. Shared by Preview and Apply. Resolves client refs, stable identity, parent/child invariants and normalized operations.

### Calculation adapter

Composes current Pricing/Discount/Tax/Rounding algorithms through explicit inputs/transaction readers. It is not a second calculator. Unchanged committed lines preserve facts unless a frozen policy says otherwise.

### Financial result service

Uses current immutable settlement components plus projected/new commercial obligation to classify `NONE|OUTSTANDING_OPTIONAL|OUTSTANDING_REQUIRED|OVERPAYMENT`. It never creates payment/refund facts during Change.

### Preview service

Read-only orchestration of context → capabilities → projection → calculation → finance result → review proof. No persistent side effects.

### Mutation service

Transaction-only stable inserts/updates/logical removals and canonical detail-fact persistence. Requires a supplied transaction client. No nested transaction/global Prisma/network.

### Apply service

Single owner of committed commercial mutation. Handles replay, lock order, versions, revalidation, mutation, snapshot, Change/ops, audit/outbox/idempotency/version increment in one transaction.

## 3. Transaction rule

Any helper used inside Apply must either:

- accept the caller transaction client, or
- be pure and operate on already-resolved inputs.

A helper that opens its own Prisma transaction/global DB read or performs HTTP is not transaction-safe for Apply and must be adapted before use.

### Verified adapter exceptions (B04; current repository)

| Existing module | Current evidence | Safe reuse boundary |
|---|---|---|
| `order-calculation.service.ts:138` / `pricing.service.ts:123` | Calculator creates Supabase client/settings and uses global Prisma; price lookup uses RPC. Calculator consumes `basePrice` at :196 while pricing also supplies discounted `finalPrice` at :217. | Extract/compose pure algorithms over pre-resolved authoritative inputs and caller-tx readers. Resolve catalog-adjustment semantics with non-zero discount fixture before WP08. Do not call existing network/global wrapper inside Apply. |
| `order-item-preference.service.ts:56`, `:140`; piece preference counterparts | Supabase writes, hard deletes, subsequent cache recalculation; no caller Prisma transaction boundary. | Reuse catalog resolution/pure rules only; implement stable-ID tx-only logical mutations and cache recalculation under WP07/WP11. Current helper is not an atomic Change adapter. |
| `order-piece-service.ts:553`, `:1541` | Create has tx helper; deletion uses Supabase soft removal and later readiness synchronization, not commercial quantity -1. | Create's helper requires audit for inherited tenant predicates and Create defaults. Removal needs dedicated tx adapter that owns quantity, history and descendants. Do not reuse deletePiece as a complete REMOVE_PIECE operation. |
| `lib/utils/idempotency.ts:78`, `:139`, `:213` | Find/store/claim use global Prisma; current cache TTL is seven days. Some header comments name a Tx helper that does not exist. | Reuse canonical JSON/hash; add caller-tx command claim/completion and durable Change response lookup. Claim must roll back with Apply; no pre-transaction global mutation. |
| `order-financial-aggregation.ts:382`, `order-financial-write.service.ts:442` | Pure D005 aggregation exists; snapshot writer accepts caller transaction and derives current active commercial/settlement facts. | Reuse aggregation against projection and writer after detail persistence; require calculation/snapshot equality and source-qualified overpayment. No new settlement ledger or delta-as-payment. |
| `order-settlement.service.ts:418` | Collection locks only `PAY_ON_COLLECTION` orders; separate wrapper owns its transaction. | Payment UI and tx primitives can be reused by a reviewed general receivable adapter; original payment type stays immutable. Adapter is WP16, outside Apply. |
| `tax-document-issuance.service.ts:233` | Current correction prorates original invoice tax ratio and rounds tax to two decimal places. | Not safe general correction for changed tax composition/OMR precision. Freeze Finance/Fiscal correction and AR linkage policy with source lineage; deny unsupported modes until tests prove it. Prevent a later refund from issuing a second correction for the same obligation change. |

### Finance/source concurrency gate (B05; WP09/WP11/WP16/WP18)

Current collection locks order first (`order-settlement.service.ts:420`); payment transition locks payment first (`payment-transition.service.ts:260`); refund execution locks refund first (`order-refund.service.ts:764`). Its remaining source-cap checks at :806–841 read shared payment/credit sums without a common order/source lock. Two different refund rows are not serialized by locking each separate refund. Existing `refund-concurrent-processing.db.test.ts:124` proves only duplicate execution of the **same** refund row.

Before claiming atomic Finance reuse, freeze and implement a common lock protocol across participating collection/transition/refund/credit/AR/source writers and Change, accounting for current voucher/drawer lock ordering. Resolve order ID via a tenant-safe read, then acquire shared order lock before child/source mutation locks, with deterministic child/source ordering; audit callers that already hold child locks before applying this protocol. Shared-source cross-order stored-value/AR operations require their own consistent source order. Record the final lock table/adapter call graph and test two different refunds against one source, Change versus payment verification/refund/credit/AR, deadlock retry, rollback and snapshot equality against a real DB. Generic `FOR UPDATE` presence is not proof. No Finance mutation or protocol implementation is authorized by this documentation review.

Preview reloads immutable settlement components; Apply reloads under the coordinated locks. Review proof includes relevant settlement fingerprint because payments can change financial result without either order counter changing. Source caps and fiscal eligibility must be checked again in their separate Finance execution transaction; an old Preview option is not authorization.

### Finance scenario qualification (WP09/WP16; no duplicate Finance engine)

| Scenario | Current authority and required qualification |
|---|---|
| Unpaid/partial payment; fully paid increase/decrease | Recompute projected obligation through canonical D005 components and snapshot-classified unresolved overpayment, not the sign of delta. Total20/paid10→total15 leaves due5; total20/paid20→total15 leaves overpaid5; total20/paid20→total25 leaves due5. Preserve existing payment/voucher amounts. Required versus optional follow-up comes from Finance/workflow policy after Change. |
| Split tender and pending/authorized legs | Only effective payment lifecycle/nature and APPLIED credits count (`order-financial-aggregation.ts:382`); allocate any later resolution against actual remaining source capacities. Pending/authorized legs do not become cash collected. No blanket refund method based on the order header's last method. |
| Gift/wallet/advance/customer credit | Reuse original credit-application lineage and owning source-ledger primitives. `credit-application-reversal.service.ts:48` reverses a whole APPLIED application via compare-and-set; it is not a proven partial post-Change resolver. `gift-card-service.ts:849` restores with an original-issued cap, while checkout `overpayment-resolution-validator.service.ts:115` denies RESTORE_STORED_VALUE. WP16 must qualify partial restoration/cumulative caps and source/fact linkage; no full reversal for a small decrease and no source conversion invented by Edit. |
| B2B AR | Order due, issued invoice and allocation facts are separate. The current snapshot compares linked invoice due but does not synchronize commercial corrections. Freeze correction/credit-debit document and allocation/receivable handling before enabling affected issued AR edits; never rewrite issued historical invoice/allocation facts. |
| Cash and original-method refund | `order-refund.service.ts:890` always uses cash voucher/drawer gates for CASH; original-method execution is flag-controlled and requires manual reference, not a gateway HTTP refund. Record-only original-method mode cannot be described as actual settlement. Apply creates no drawer movement; later collection/refund uses current ledger voucher wiring exactly once. |
| Issued fiscal, inclusive/exclusive, precision | Preserve original issued documents; an obligation correction is not the same as refund execution. Verify exact tax-line composition, current inclusive extraction, ITEM/PIECE versus ORDER preference addends, currency precision and rounding increments across Preview/detail facts/snapshot/correction. Current two-decimal prorated correction is not sufficient proof for three-decimal currencies or changed tax categories. |

Required tests include paid/partial/credits-only/mixed tender, failed/pending payments, two distinct source-sharing refunds, partial and capped source restoration, later refund after fiscal correction, linked issued AR, tax-inclusive/exclusive/custom/non-taxable-charge composition and currency rounding. Unit/mocked arithmetic can establish formula behavior; real source-ledger/DB/concurrency/fiscal/AR tests must establish executable mode eligibility.

## 4. Legacy boundaries

`OrderService.updateOrder()` remains compatibility only until cutover and may never be the V2 core. `org_order_edit_history` is legacy/timeline input, not Change authority. Hard-coded `isOrderEditable()` becomes compatibility only after capability cutover.
