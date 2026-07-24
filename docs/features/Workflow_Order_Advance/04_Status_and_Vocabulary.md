# 04 — Status and Vocabulary

**Status:** P0 correction pass · **Date:** 2026-07-24

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

## 4. Initial rules

Every `order_source_code` × modifiers; optional `order_type_id`; retail-only → operationally completed **policy**, not `closed`.
