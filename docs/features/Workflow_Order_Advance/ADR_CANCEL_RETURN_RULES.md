# ADR — Cancel vs Hold vs Stop vs Return

**Status:** Accepted · **Date:** 2026-07-25  
**Supersedes:** Broad cancel-from-any-ops-status + automatic Fin unwind on cancel.

## 1. Locked decisions (product confirm 2026-07-25)

1. **Cancel allowlist** = `draft` + `intake` + `preparing` **only if preparation is not completed** and **before real processing starts**.
2. Temporary halt after work started = **`on_hold`** (user can **resume**). Permanent halt = action **`STOP_ORDER_WORK`** → terminal **`stopped`**.
3. **Return sub-order** = **V1.1**. Until then: create a normal order with discount/notes (manual workaround).
4. **No automatic Fin unwind / no auto refund.** Every monetary disposition is **explicit and recorded by users** (Fin screens / future flows).

## 2. Definitions

| Concept | When | Result | Money |
|---------|------|--------|-------|
| **Cancel** | `draft` / `intake` / incomplete `preparing` only | Same order → `cancelled` | User-driven only; engine does **not** auto-unwind |
| **Hold** (`HOLD_ORDER_WORK`) | After real processing may have started | → `on_hold`; resume later | None |
| **Resume** (`RESUME_ORDER_WORK`) | From `on_hold` | → prior status (`hold_from_status`) | None |
| **Stop** (`STOP_ORDER_WORK`) | Permanent stop (from ops or hold) | → `stopped` (terminal) | None (user Fin later) |
| **Return** | Finished / partial customer return | **V1.1 sub-order** + details | Explicit Fin later |

## 3. Cancel rules

**Allowed when:**

| Status | Extra condition |
|--------|-----------------|
| `draft` | — |
| `intake` | — |
| `preparing` (or synonym `preparation`) | `preparation_status` ≠ `completed` |

**Forbidden when:** `processing`, `assembly`, `qa`, `packing`, `ready`, `out_for_delivery`, `delivered`, `closed`, `cancelled`, `returned`, `on_hold`, `stopped`, or preparing with prep already completed.

## 4. Hold / resume / stop

- **Hold:** reason/notes required; persist `hold_from_status` = status before hold.
- **Resume:** only from `on_hold` with non-empty `hold_from_status`.
- **Stop:** permanent; terminal `stopped`; reason/notes required; no auto money.

## 5. Return (V1.1)

Sub-order of parent with return details (reason, notes, preferences, scope, money optional). Out of V1.0 canary scope.

## 6. Decision log

| Date | Decision |
|------|----------|
| 2026-07-25 | Proposal captured |
| 2026-07-25 | Locked: cancel allowlist + hold/resume + STOP_ORDER_WORK + no auto unwind + return V1.1 |
