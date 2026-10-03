# CleanMateX Edit Order V2 — Operation & Capability Catalog

**Version:** 3.0  
**Status:** Normative V1 operation contract

## 1. Rules

- Operations express business intent, not generic PATCH paths.
- `CHANGE_ITEM_PRODUCT` does not exist: remove old + add new.
- Customer ID, branch ID and currency are not V1 operations.
- Operation-specific capability policy fails closed if required policy binding is missing.
- The backend validates every target against tenant/order hierarchy.

## 2. Catalog

| Code | Scope | Identity | Payload | Policy owners | Invariant |
|---|---|---|---|---|---|
| ADD_ITEM | ORDER | none/clientRef | productId, quantity, optional approved commercial input | Pricing/Discount/Tax + Workflow operation policy | creates stable item; preferences/pieces are separate ops |
| REMOVE_ITEM | ITEM | persisted item ID | optional reason metadata only | Workflow/structural/Finance/fiscal | logical removal; descendants handled atomically; no physical delete |
| CHANGE_ITEM_QUANTITY | ITEM | persisted item ID | quantity; selectedPieceIds when piece tracked | Workflow/structural/Pricing if policy relevant | never product replacement; stable item ID |
| ADD_PIECE | ITEM | persisted/new item ref | clientRef, piece attributes permitted by current domain | Workflow/structural | quantity +1 |
| REMOVE_PIECE | PIECE | persisted piece ID | reason metadata if policy requires | Workflow/structural | logical remove; parent quantity -1 |
| ADD_PREFERENCE | ORDER|ITEM|PIECE | target ref | clientRef, preference definition/code/content/extra inputs allowed by domain | Preference catalog + capability + Pricing | generic all kinds |
| CHANGE_PREFERENCE | PREFERENCE | persisted preference ID | allowed content/value fields; kind replacement not allowed | Preference catalog + capability + Pricing | preserve row identity |
| REMOVE_PREFERENCE | PREFERENCE | persisted preference ID | reason metadata if required | Preference capability/Pricing | logical removal; generic all kinds |
| CHANGE_PRIORITY | ORDER | order | priority code | Workflow/operational policy | priority is not service speed |
| CHANGE_SERVICE_SPEED | ORDER | order | serviceSpeed | Pricing + workflow/turnaround policy | may reprice by explicit policy |
| CHANGE_READY_BY | ORDER | order | readyBy timestamp | Workflow/SLA policy | customer commitment override only |
| CHANGE_ORDER_NOTES | ORDER | order | notes/customerNotes allowed fields | Capability/privacy | must define which note field is commercial/audited |
| CHANGE_CUSTOMER_SNAPSHOT | ORDER | order | approved snapshot/contact fields only | Customer snapshot policy | customer_id itself immutable V1 |

### Current-code field and effect contract (B03; WP04/WP06/WP07)

The operation code list is frozen; the loose payload descriptions above require the following strict allowlists and implementation proofs. All operations persist safe before/after data, target identity, actor/source and any required reason/authorized decision in Change operations. Reason/override policy is server-derived; hard structural, fiscal and tenant restrictions cannot be overridden.

| Code | Concrete payload/identity and effect |
|---|---|
| ADD_ITEM | Client UUID, `productId`, positive integer `quantity` (current cap 999). Resolve product/service category and prices server-side. Optional new-line `priceOverride`/`overrideReason` must use existing price-override permission and policy, never accept `overrideBy`, authoritative `totalPrice` or arbitrary metadata. Item catalog names/barcodes/operational state are server-derived. New tracked-item piece materialization is subject to the structural gate below. |
| REMOVE_ITEM | Persisted item UUID; no replacement product or money payload. Logically remove item and active descendants atomically and retain historical UUIDs; re-evaluate processing/assembly/delivery references and fiscal eligibility. Recompute obligation, never delete settlement facts. |
| CHANGE_ITEM_QUANTITY | Persisted item UUID, resulting integer quantity, explicit `selectedPieceIds` on tracked decrease. Zero means remove through REMOVE_ITEM, not an active zero-quantity line. Keep selling facts according to the approved unchanged/changed-line pricing policy; normalize child removals exactly once. |
| ADD_PIECE | Persisted/new local parent item ref and client UUID. Permitted initial physical attributes must be resolved against the unified preference model; no browser-written barcode, operational status/stage, quantity-ready, confirmation or assembly/delivery linkage. Its structural quantity contribution is exactly +1; do not blindly copy the full legacy piece DTO. |
| REMOVE_PIECE | Persisted piece UUID, resolved parent item/order; logical removal and exactly -1 quantity. Require eligible concrete piece, protect operational references, retain history and handle descendants. Removing the final active piece must normalize to item removal or fail the active-item invariant. |
| ADD_PREFERENCE | Target level/ref and client UUID; configured definition UUID/code plus `preference_content` when supported by that kind. Resolve kind/category/owner/source/extra-price from catalog/policy; requested price input requires the owning override policy. ORDER has no item/piece; ITEM has item only; PIECE resolves both item and piece. Catalog definition is polymorphic (service versus packing), so verify the correct owner table and tenant/global visibility, not a universal FK. |
| CHANGE_PREFERENCE | Persisted preference UUID; approved content/value and price request for the same configured kind only. No parent/level/kind move and no browser-confirmation/follow-up-note mutation. Preserve row identity and re-evaluate affected preference caches/obligation once. A changed definition/kind needs explicit remove+add. |
| REMOVE_PREFERENCE | Persisted preference UUID and validated level/hierarchy; logical removal. Preserve append-only follow-up notes/history and invalidate affected active caches; price/tax recalculation follows preference level accounting. |
| CHANGE_PRIORITY | Order target and exact existing priority token; no express multiplier. Operational precedence only; no automatic price impact. Validate actual token catalog, not a new spelling inferred from UI text. |
| CHANGE_SERVICE_SPEED | Order target and approved seeded service-speed token. Preserve distinct priority. Resolve affected prices/SLA through owning policy; no implicit whole-order repricing. New field/tokens are WP02/WP08 dependencies, not existing deployed behavior. |
| CHANGE_READY_BY | Order target and timezone-aware `readyBy` timestamp; map to current `ready_by`/override ownership without editing unrelated actual-ready/delivery timestamps. Override reason/capability applies to customer commitment; pricing unchanged unless a separately approved speed operation is included. |
| CHANGE_ORDER_NOTES | Order target; `notes` maps to `internal_notes`, `customerNotes` to `customer_notes`, within existing bounds. `paymentNotes` is Finance-owned and excluded. No arbitrary field patch or payment receipt rewrite. No pricing/tax effect. |
| CHANGE_CUSTOMER_SNAPSHOT | Order target; bounded `customerName`, `customerMobile`, `customerEmail` only when existing snapshot policy allows them. Customer ID/default-customer identity/branch/currency are immutable. Arbitrary `customerDetails` is excluded until a typed allowlist is approved. No customer-master write and no implicit tax-identity change. |

Evidence: `edit-order-schemas.ts:20`, `:41`, `:88` supplies current legacy fields/bounds; `prisma/schema.prisma:703`, `:777`, `:893` shows actual item/preference/order fields. These are adapters' source evidence, not approval to reuse legacy replacement or trust browser pricing/actor fields.

### Structural quantity gate

`ADD_ITEM(quantity=3)` plus three separate `ADD_PIECE` operations cannot both establish quantity 3 and increment it three more times. The existing catalog did not distinguish initial materialization from quantity growth. Similarly, one `CHANGE_ITEM_QUANTITY` tracked decrease plus its selected `REMOVE_PIECE` operations must not decrement twice. WP06 must freeze one normalized quantity ownership/materialization contract, validate it with new and existing tracked-item examples and keep the frozen +1/-1 piece invariant. Until that contract is approved, tracked new-item/quantity flows are not executable; do not guess a zero-quantity persisted item or introduce an unapproved operation token. ADD_ITEM on non-tracked lines remains unambiguous.

### V1 scope and owning-domain closure

The thirteen frozen codes do **not** authorize changing an existing item's unit price/override, order discount/promotion selection, arbitrary charge/tax line, item notes or payment notes. Current Edit supports some of these inputs and separate committed discount/charge repair routes exist. At cutover, explicitly disable/reject unsupported commercial inputs for V2 orders or approve an owning-domain semantic vocabulary before routing those writers through Change. Do not silently drop requested edits or invent another token during implementation. This gate affects WP04/UI affordances and WP17 writer closure; automated recalculation of approved operations may still use existing Pricing/Discount/Tax rules.

For every code, WP05 freezes supported target-stage/profile bindings (including processing, assembly, ready, delivery/issued states), hard-denial reasons, warnings and override/reason policies. The current transition engine does not supply a complete commercial-operation matrix automatically. Missing bindings fail closed; no operation is allowed merely because the order status is generally editable.

WP05 confirms that `sys_wf_prof_ver_exec_cf` and its child gate configuration are transition records (`from_status`, `to_status`, action and channel); they are not a safe storage source for commercial Change authorization. `profile_policy_json` is also not a supported runtime source because the live semantic resolver does not project it as Change policy. The coordinated HQ-owned contract must instead publish an immutable profile-version capability binding for the exact tuple `(profile_version_id, workflow_status, operation_code, target_type)`, with decision, stable reason/message keys, required reason, specialized permission and override permission. A proposed table name such as `sys_wf_prof_ver_oc_cap_cf` is illustrative only; tenant code must not create or hand-maintain it. The tenant evaluator consumes only published bindings and returns `CAPABILITY_POLICY_BINDING_MISSING` for every absent tuple.

### Money and preference accounting

An operation's commercial/tax/financial impact is computed from the projected facts, not a hardcoded signed-delta shortcut. In current accounting ITEM/PIECE extras are embedded in line totals and only ORDER preference charges are separate addends (`order-charge-money.ts:41`, `order-financial-write.service.ts:591`). Inclusive selling amounts already contain tax. Preserve these facts and apply approved recalculation policy once; do not add extra price or tax twice. Structural/note operations with zero money delta still require Change/audit if they change committed commercial facts.

## 3. Normalization/conflict rules

Reject or normalize before Preview/Apply:

- duplicate remove of same persisted target;
- change after remove of same target;
- item remove plus unrelated child changes unless normalized into the parent removal batch;
- piece quantity decrease without explicit eligible piece selection for tracked pieces;
- client-ref cycles/unresolved refs;
- new local target added then removed before Apply => no operation;
- empty normalized operation batch => no Change/revision;
- product change => explicit remove+add;
- preference kind change => remove+add.

## 4. Capability result

Each normalized operation gets:

```text
ALLOW
ALLOW_WITH_WARNING
REQUIRE_OVERRIDE
DENY
```

Decision proof is bound to tenant, order, actor, expected edit version, expected workflow version, normalized operation digest, relevant workflow/profile policy version/facts, and expiry. Any materially changed review invalidates proof.

## 5. Policy ownership

- Global Edit feature/tenant setting enables capability evaluation; it never authorizes an operation by itself.
- Per-order `edit_access_status` can globally restrict the order.
- Workflow/profile operation policy decides stage/status sensitivity.
- Structural rules are hard invariants.
- Pricing/discount/tax/Finance/fiscal domains own their respective restrictions.
- Override permission cannot bypass permanent block, invalid hierarchy, tenant mismatch, immutable historical facts or unsupported fiscal mode.
