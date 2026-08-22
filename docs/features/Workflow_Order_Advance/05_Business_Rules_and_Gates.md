# 05 — Business Rules and Gates

**Status:** P0 correction pass · **Date:** 2026-07-24

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
| `delivery_stop_active` | pending/in-transit delivery stop |
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

`CONFIRM_DELIVERY` payload includes POD evidence (or reference to prepared upload). Persist atomically:

- delivery attempt result
- release/fulfilment updates as configured
- custody hooks if present
- `current_status` / `state_version`
- history + central outbox event

No separate `CAPTURE_POD` that finalizes business state alone.

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
