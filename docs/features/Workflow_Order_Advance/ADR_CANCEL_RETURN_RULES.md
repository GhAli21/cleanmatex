# ADR — Cancel vs Return vs Stop (proposed product lock)

**Status:** Proposed (awaiting your confirm) · **Date:** 2026-07-25  
**Supersedes (when accepted):** broad cancel-from-any-ops-status + auto Fin unwind on cancel; return as status-only flip.

## 1. Problem

Current V1 cutover allows cancel from many floor statuses and runs Fin unwind automatically after cancel. Return flips terminal status (`returned`) without a commercial/ops child document. Product intent is stricter:

- Cancel only before real processing starts.
- After that, a different action (“stop”) — money decided by the user, **no auto refund**.
- Customer return of a finished (or partial) order creates a **sub-order** with full return details.

## 2. Definitions (target)

| Concept | Meaning | Creates |
|---------|---------|---------|
| **Cancel** | Abandon order **before laundry work truly starts** | Terminal `cancelled` on the **same** order |
| **Stop** (working name; confirm) | Halt an order that **already entered real processing** — not a customer return | Ops outcome TBD (`on_hold` or dedicated stop path); **no auto money movement** |
| **Return** | Accept goods back from customer for a **finished** order (full or **partial**) | **Sub-order** linked to parent + return detail records; money optional / user-decided |

## 3. Cancel — restrictions

**Allowed only when** operational status is in:

- `draft`
- `intake`
- optionally `preparing` **only if** preparation has **not** completed / processing not started  

**Not allowed when** status is: `processing`, `assembly`, `qa`, `packing`, `ready`, `out_for_delivery`, `delivered`, `closed`, `cancelled`, `returned`, `on_hold` (or use Stop instead).

**Money:** Operator chooses what to do with any collected funds (refund / store credit / keep / none). **No automatic refund** as a silent side effect. Disposition UI may still be offered; defaults to **manual / operator decision**, not engine auto-unwind.

## 4. Stop — after processing started (confirm name)

When cancel is forbidden because work started:

- Offer **Stop** (not Cancel, not Return).
- Requires reason/notes.
- Suggested status: `on_hold` (reuse) **or** new terminal/ops code later — **TBD**.
- **No auto Fin unwind / no auto refund.**

## 5. Return — sub-order model

When customer returns a finished order (or part of it) and staff **accept** the return:

1. Parent order stays the commercial/fulfilment anchor (status policy TBD — often stays `delivered` / `closed` with return linkage).
2. System creates a **sub-order** (`parent_order_id` / return link) — with or without money lines.
3. Persist return details: reason, notes, preferences, scope (full vs which items/pieces), accepted_by, timestamps.
4. Downstream Fin (refund/credit) is **explicit operator/Fin flow**, not silent on accept.

This is larger than a status flip to `returned`; treat as **V1.1 feature package** unless we thin-slice a stub.

## 6. Mapping to current code (gap)

| Area | Today | Target |
|------|-------|--------|
| `canCancelOrder` | Many ops statuses | Only draft / intake / (prep not started) |
| Fin on cancel | Auto `unwindOrderFinancialsOnCancel` | User decides; no auto refund |
| Return UI/engine | `RETURN_ORDER` → `returned` | Sub-order + return detail pack |
| Stop | Missing | New action after processing started |

## 7. Confirm before implement (need your OK)

Reply with yes/no (or edit):

1. **Cancel allowlist** = `draft` + `intake` only? Or also `preparing` while prep incomplete?
2. **“Stop enforce”** = put order **`on_hold`** with reason, no money side effects? (Or different name/status?)
3. **Return sub-order** = schedule as **next build (V1.1)** after narrowing cancel + stop? Or block canary until sub-order exists?
4. **Paid cancel in allowlist** = show disposition UI but **do not** call auto unwind unless user explicitly confirms a refund action?

## 8. Decision log

| Date | Decision |
|------|----------|
| 2026-07-25 | Proposal captured from product suggestion; not yet locked |
