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
| `CANCEL_ORDER` / `HOLD_*` / `STOP_*` / `RETURN_ORDER` | Cancel early only; hold/stop; return V1.1 (no auto Fin) |

POD draft/upload may be a **non-finalizing** upload API; it must not flip fulfilment alone.

Actions live in `sys_wf_actions_cd`. They map to one or more **transitions** via `sys_wf_action_trans_cd` (per screen).

## 4. Transition codes (`sys_wf_transitions_cd.transition_code`)

Stable graph edge IDs. Prefix encodes whether the edge may change operational status.

| Prefix | Meaning | Status change | DB rule | Examples |
|--------|---------|---------------|---------|----------|
| **`TR_*`** | **TR**ansition — normal stage / lifecycle move | **Yes** — `from_status` ≠ `to_status` | Default | `TR_PACK_READY`, `TR_PROC_ASM`, `TR_QA_PROC` |
| **`REL_*`** | **REL**ease — legacy fulfilment / handoff code family | **No** — same status allowed only for legacy records | `CHECK` allows `from = to` only when code `LIKE 'REL_%'` | `REL_READY_PICKUP` (retired by `0447`) |

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
| Operational ready | Status `ready` (often via `TR_PACK_READY` / skip `TR_*`) | Work is complete but is not yet released to a customer |
| Ready for pickup | Status `ready_for_pickup` via `RELEASE_FOR_PICKUP` → `TR_READY_PICKUP` | Released at the counter and awaiting customer collection |
| Release for delivery | Action `RELEASE_FOR_DELIVERY` → transition `TR_READY_OFD` | Status → `out_for_delivery` (status-changing delivery release) |

### Counter pickup handover (P7R)

`RELEASE_FOR_PICKUP` is labelled **Make available for pickup**. It moves an
order from `ready` to `ready_for_pickup`; this makes the collection state
explicit without treating availability as proof that the customer received the
order.

Actual branch-counter handover uses the stage-owned `CONFIRM_PICKUP` action on
the `pickup_handover` screen. The normal staged route uses `TR_PICKUP_DELIV`
(`ready_for_pickup` → `delivered`). When the customer is physically at the
counter before shelf staging, the authenticated staff-only direct route uses
`TR_READY_DELIV` (`ready` → `delivered`) and creates a fulfilled pickup release
in the same transaction. Public tracking may use only the staged route. Both
routes record the authenticated staff actor/time and fulfil the pickup audit.
`delivered` remains the single final fulfilment status for both counter pickup
and home delivery; the release record provides the channel.

Business rule detail: [05_Business_Rules_and_Gates.md](05_Business_Rules_and_Gates.md) §3.

### Related namespaces (do not confuse)

| Namespace | Table / source | Examples |
|-----------|----------------|----------|
| Actions | `sys_wf_actions_cd` | `COMPLETE_PACKING`, `RELEASE_FOR_PICKUP` |
| Transitions | `sys_wf_transitions_cd` | `TR_*`, `REL_*` |
| Gates | `sys_wf_gate_defs_cd` / `gate_set_code` | `rack_required`, `fin_release_eligible` |
| Screens | `sys_wf_screens_cd` | `packing`, `ready_release` |

## 5. Cancel vs hold/stop vs return (canonical)

Authority: [`ADR_CANCEL_RETURN_RULES.md`](./ADR_CANCEL_RETURN_RULES.md) (Accepted 2026-07-25).

These are **different business events**. Do not treat them as synonyms.

| | **Cancel** | **Hold / Resume / Stop** | **Return** |
|---|------------|--------------------------|------------|
| **Meaning** | Abandon early (before real processing) | Temporary halt (`on_hold`) or permanent stop (`stopped`) | Customer return after fulfilment |
| **When (V1.0)** | `draft` / `intake` / `preparing` with prep **not** completed | After work may have started | **V1.1** sub-order (workaround: new order + discount/notes) |
| **Action** | `CANCEL_ORDER` (`canceling`) | `HOLD_ORDER_WORK` / `RESUME_ORDER_WORK` / `STOP_ORDER_WORK` (`order_control`) | `RETURN_ORDER` deferred |
| **Result status** | `cancelled` | `on_hold` → prior via `hold_from_status` / `stopped` | Sub-order (V1.1); not a status flip in V1.0 |
| **Money** | **No auto Fin unwind** — explicit Fin only | None | Explicit Fin later |

### Rules of thumb

1. **Early abandon** (draft / intake / incomplete prep) → **cancel** → `cancelled`.
2. **Need a pause after work started** → **hold** → resume later; or **stop** → `stopped`.
3. **Customer return of goods** → V1.1 sub-order; until then create a normal order with discount/notes.
4. **Never** auto-refund / auto-unwind money on cancel/hold/stop/return in V1.0.

### Restrictions (enforced UI + orchestrator + gates)

| Rule | Cancel | Hold/Stop | Return (V1.0) |
|------|--------|-----------|----------------|
| Allowed from | `draft`, `intake`, `preparing` + `preparation_status` ≠ `completed` | Hold: preparing→OFD; Resume: `on_hold`; Stop: those + `on_hold` | UI hidden (`canReturnOrder` → false) |
| Reason | Required | Hold/Stop required | N/A (deferred) |
| Paid money | Info only; Fin later | — | — |
| Terminal | `cancelled` | Stop → `stopped` | V1.1 |

Code authority: `web-admin/lib/constants/workflow-cancel-return.ts`.

### Legacy drift (flag off)

Enhanced cancel may still require disposition + Fin unwind. When `workflow_engine_v2` is on, ADR lock applies (no auto unwind; narrow cancel).

## 6. Page vs module vs `screen_key`

Status and action codes above are not pages. For **page**, **module**, **`screen_key`**, execution, channel, ActionBar vs stage card, and Ready/pickup/delivery host vs owner, use [future_work_in_wf/00_WF_ENTITY_GLOSSARY.md](future_work_in_wf/00_WF_ENTITY_GLOSSARY.md).

## 7. Initial rules

Every `order_source_code` × modifiers; optional `order_type_id`; retail-only → operationally completed **policy**, not `closed`.
