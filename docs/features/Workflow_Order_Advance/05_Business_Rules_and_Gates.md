# 05 — Business Rules and Gates

**Status:** P7R floor complete + HQ gate binding · **Date:** 2026-08-27

## 1. Gates (V1.0)

| Gate | Reads |
|------|--------|
| `rack_required` | order rack |
| `all_pieces_scanned` / `all_items_ready` / `all_pieces_ready` | items/pieces (piece gates apply only when tracking is enabled) |
| `qa_passed` | assembly QA task + open issues |
| `prep_stage_complete` | preparation stage execution **or** bridge `preparation_status` |
| `fin_release_eligible` | Order Fin outstanding balance; B2B credit uses the payment-hold seam |
| `pickup_collection_settled` / `delivery_collection_settled` | pay-on-collection outstanding amount |
| `pickup_release_valid` | open pickup release for staged `ready_for_pickup` |
| `delivery_stop_active` | pending/in-transit delivery stop; **optional HQ bind** on `CONFIRM_DELIVERY` for routed profiles only |
| `pod_evidence_valid` | command POD method + signature/photo evidence at execute; OTP unsupported |
| `unpaid_cancel_disposition` | outstanding balance (disposition service not yet wired; unpaid cancel fails closed) |
| `partial_fulfilment_supported` / `return_service_available` | always fail closed until owning services exist |

## 2. Preparation

- V1.0 bridge: `COMPLETE_PREPARATION` updates operational status + `preparation_status=completed` in one TX.
- V1.1 target: `org_ord_stage_exec_tr` (`stage_code=preparation`, `execution_status=completed`, `attempt_no`).
- Ban writing `status='sorting'`.

## 3. Ready ≠ release

`MARK_READY` vs `RELEASE_*` with `fin_release_eligible`. Partial via release records; no double-release.

## 4. Delivery (atomic)

`CONFIRM_DELIVERY` is the only engine action that marks an order delivered. Staff never submit it through generic `/actions`. Floor writers:

- **No planned stop (simple):** `POST /api/v1/delivery/orders/{orderId}/complete` with optional notes. Catalog transition `TR_OFD_DELIV` has no `gate_set_code`. Do not bind `delivery_stop_active` on this action for simple tenants.
- **Active stop (routed):** `POST /api/v1/delivery/stops/{stopId}/complete` with compiled POD evidence. Bind `delivery_stop_active` and `pod_evidence_valid` on the published profile, then compile.

The floor never creates a dummy route or stop. If a pending/in-transit stop already exists, the order-keyed command returns `USE_STOP_COMPLETE_COMMAND`.

Persist atomically with the chosen writer:

- delivery attempt / stop / POD as configured
- `PAY_ON_COLLECTION` remaining-balance block (collect through Order Fin first)
- `current_status` / `state_version`
- history + central outbox event

No separate `CAPTURE_POD` that finalizes business state alone. Fail/cancel delivery attempts remain out of V1.0 staff commands.

Catalog seed is already complete (`0427` action/screen/transition, `0463` optional gate codes). No new `sys_wf_*_cd` row is required for the floor screen. Simple vs routed is profile execution/gate/evidence binding plus a compiled artifact.

## 5. Retail

Retail-only create:

- Resolve operational status per initial rules (typically skip laundry stages)
- Payment/fulfilment/receipt follow Fin + release policy
- Assign `closed` **only** when closure policy succeeds (all obligations done)

## 6. Cancel / return

See vocabulary: [04_Status_and_Vocabulary.md](04_Status_and_Vocabulary.md) §5 (**cancel ≠ return**).

- **Cancel** → `cancelled` only from draft/intake/incomplete preparing; **no** auto Fin unwind (ADR).
- **Hold / resume / stop** → `on_hold` / prior / `stopped`; notes required for hold/stop.
- **Return** → V1.1 sub-order (deferred); workaround: new order + discount/notes.
- Keyed idempotency on engine execute.

## 7. Items / pieces

Gates only; no silent order→item cascade; auto-ready via `executeAction` only.
