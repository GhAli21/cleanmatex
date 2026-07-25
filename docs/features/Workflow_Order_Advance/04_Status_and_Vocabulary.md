# 04 — Status and Vocabulary

**Status:** P0 correction pass · **Date:** 2026-07-25

## 1. V1.0 operational worklist

Physical SoT for lists/transitions: `org_orders_mst.current_status`.

Seed operational codes used by screens (not a dump of every commercial/finance concept into one enum forever):

`draft`, `intake`, `preparing`, `processing`, `assembly`, `qa`, `packing`, `ready`, `out_for_delivery`, `delivered`, `cancelled`, `returned`, `on_hold`, …

### Synonyms / repairs

| Drift | Canonical / action |
|-------|-------------------|
| screen `ready` | `ready_release` |
| screen `delivery` | `driver_delivery` |
| status `sorting` | repair; never write again |
| retail create → `closed` | **Forbidden** in V1.0 |

## 2. Multidimensional model (V1.1 direction)

Target ownership (projections or columns — not all in `current_status`):

| Dimension | Owner |
|-----------|--------|
| Operational summary | Workflow engine / `current_status` → later `operational_status` via contract migration |
| Commercial | Order commercial lifecycle |
| Fulfilment | Release + delivery records |
| Exception | Issues / holds |
| Custody | Custody events (when introduced) |
| Payment / invoice | Order Fin |
| Customer milestone | Projection for notifications (V1.1/V1.2) |

## 3. Action catalog (V1.0)

| Action | Notes |
|--------|--------|
| `CONFIRM_PHYSICAL_INTAKE` | Remote → received |
| `SEND_TO_PREPARATION` | |
| `COMPLETE_PREPARATION` | Sets stage completion; bridge `preparation_status` |
| `COMPLETE_PROCESSING` / `COMPLETE_ASSEMBLY` / `PASS_QA` / `FAIL_QA` / `COMPLETE_PACKING` | Profile-gated |
| `MARK_READY` | Operational ready |
| `RELEASE_FOR_PICKUP` / `RELEASE_FOR_DELIVERY` | Fin gate |
| `CONFIRM_DELIVERY` | **Atomic** finalize: POD + attempt + release/custody hooks + status + history + outbox |
| `CANCEL_ORDER` / `RETURN_ORDER` | After Fin unwind |

POD draft/upload may be a **non-finalizing** upload API; it must not flip fulfilment alone.

Actions live in `sys_wf_actions_cd`. They map to one or more **transitions** via `sys_wf_action_trans_cd` (per screen).

## 4. Transition codes (`sys_wf_transitions_cd.transition_code`)

Stable graph edge IDs. Prefix encodes whether the edge may change operational status.

| Prefix | Meaning | Status change | DB rule | Examples |
|--------|---------|---------------|---------|----------|
| **`TR_*`** | **TR**ansition — normal stage / lifecycle move | **Yes** — `from_status` ≠ `to_status` | Default | `TR_PACK_READY`, `TR_PROC_ASM`, `TR_QA_PROC` |
| **`REL_*`** | **REL**ease — fulfilment / handoff without advancing stage | **No** — same status allowed | `CHECK` allows `from = to` only when code `LIKE 'REL_%'` | `REL_READY_PICKUP` (`ready` → `ready`) |

Authority: migration `0427_sys_wf_catalogs_and_state_version.sql` (`chk_sys_wf_tr_from_to`).

### Naming pattern

- `TR_{FROM_ABBR}_{TO_ABBR}` — e.g. packing → ready → `TR_PACK_READY`
- `REL_{CONTEXT}_{CHANNEL}` — e.g. ready pickup release → `REL_READY_PICKUP`
- Skip / template alternate edges still use **`TR_*`** (they change status), e.g. `TR_PROC_READY`, `TR_QA_READY` (`0434`)

### Not used (do not invent)

| Prefix | Status |
|--------|--------|
| `GEL_*` | **Not** in catalog — do not use |
| Other ad-hoc prefixes | Prefer extending `TR_*` / `REL_*` only after ADR |

### Ready ≠ release (vocabulary)

| Concept | Code layer | Effect |
|---------|------------|--------|
| Operational ready | Status `ready` (often via `TR_PACK_READY` / skip `TR_*`) | Order appears on Ready worklist |
| Release for pickup | Action `RELEASE_FOR_PICKUP` → transition `REL_READY_PICKUP` | Release record; status stays `ready` |
| Release for delivery | Action `RELEASE_FOR_DELIVERY` → transition `TR_READY_OFD` | Status → `out_for_delivery` (status-changing delivery release) |

Business rule detail: [05_Business_Rules_and_Gates.md](05_Business_Rules_and_Gates.md) §3.

### Related namespaces (do not confuse)

| Namespace | Table / source | Examples |
|-----------|----------------|----------|
| Actions | `sys_wf_actions_cd` | `COMPLETE_PACKING`, `RELEASE_FOR_PICKUP` |
| Transitions | `sys_wf_transitions_cd` | `TR_*`, `REL_*` |
| Gates | `sys_wf_gate_defs_cd` / `gate_set_code` | `rack_required`, `fin_release_eligible` |
| Screens | `sys_wf_screens_cd` | `packing`, `ready_release` |

## 5. Cancel vs return (canonical)

These are **different business events**. Do not treat them as synonyms.

| | **Cancel** | **Return** |
|---|------------|------------|
| **Meaning** | Stop / abandon the order **before** (or instead of) successful customer fulfilment | Customer **brings goods back** after fulfilment (or after commercial close) |
| **Typical when** | Order still in ops: draft → ready (and OFD if aborting delivery) | Order already **`delivered`** or **`closed`** |
| **Action** | `CANCEL_ORDER` (screen `canceling`) | `RETURN_ORDER` (screen `returning`) |
| **Terminal status (V1 engine)** | **`cancelled`** | **`returned`** |
| **Audit columns** | `cancelled_at`, `cancelled_by`, `cancelled_note` | `returned_at`, `returned_by`, `return_reason` (+ optional reason code) |
| **Money (Fin)** | If money was collected: **disposition required** (REFUND / STORE_CREDIT / KEEP_ON_ACCOUNT) then unwind | **No auto Fin unwind in V1.0** — refunds/credits follow Order Fin separately |
| **UI** | Cancel Order dialog (reason + disposition when paid) | Customer Return dialog (reason) |

### Rules of thumb

1. **Not yet handed to the customer as fulfilled** → **cancel** → `cancelled`.
2. **Already delivered / closed, customer returns items** → **return** → `returned`.
3. **Ready ≠ cancel:** releasing for pickup/delivery is not cancel; aborting an OFD run may be cancel (graph allows `out_for_delivery` → `cancelled`).
4. **Do not** map customer return onto status `cancelled` under Workflow Engine V2 (legacy Enhanced RPC historically wrote `cancelled` + `returned_*` — V2 corrects that to terminal **`returned`**).

### Restrictions (enforced UI + orchestrator)

| Rule | Cancel | Return |
|------|--------|--------|
| Allowed from | `draft`, `intake`, `preparing`, `processing`, `assembly`, `qa`, `packing`, `ready`, `on_hold`, `out_for_delivery` | **`delivered`**, **`closed`** only |
| Forbidden from | `delivered`, `closed`, `cancelled`, `returned` | All other statuses (incl. ops + terminal) |
| Reason | Required (min length) | Required (min length) |
| Paid money | Disposition required (REFUND / STORE_CREDIT / KEEP_ON_ACCOUNT); KEEP needs `orders:approve_refund` | No auto Fin unwind (V1.0) |
| Terminal result | Must be `cancelled` | Must be `returned` |
| Mutual exclusion | Cancel button hidden when return applies | Return button hidden when cancel applies |

Code authority: `web-admin/lib/constants/workflow-cancel-return.ts` (`canCancelOrder` / `canReturnOrder`).

### Legacy drift (flag off)

Enhanced `cmx_ord_returning_transition` still ends at `cancelled` while setting `returned_*`. When `workflow_engine_v2` is on, authority is this table (`returned`).

## 6. Initial rules

Every `order_source_code` × modifiers; optional `order_type_id`; retail-only → operationally completed **policy**, not `closed`.
