# Historical preference-charge recalc — owner runbook

**Slice:** Unify order commercial totals · Slice 5  
**Date:** 2026-09-19  
**Audience:** owner / HQ operator only. There is **no cashier screen**.

## What this does

Some historical orders (example: `ORD-20260919-0002`) still have active ITEM/PIECE `PREFERENCE` charge rows that were added on top of line totals. Going-forward create/edit no longer writes those charges. This job:

1. Detects leftover ITEM/PIECE (or orphan) `PREFERENCE` charges
2. **Preview** shows current vs proposed `total_amount` / outstanding
3. **Confirm** voids those charges, runs `recalculateOrderFinancialSnapshotTx`, writes edit history with reason `preference double-count correction`

It never changes `total_paid_amount` and never auto-refunds.

## Gates (all required)

| Gate | Value |
|---|---|
| Feature flag | `order_fin_pref_charge_recalc` default **OFF** |
| Migration | `0512_add_feature_flag_order_fin_pref_charge_recalc.sql` — apply yourself, then enable the flag for **one** pilot tenant |
| Permission | `orders:post_settlement_edit` |
| CSRF | required (same as other write APIs) |
| Idempotency | required on confirm (`idempotencyKey` ≥ 8 chars) |
| Batch | default 25, max 50 |
| Issued tax docs | listed as **blocked** (`ISSUED_TAX_DOCUMENT`) and skipped. No B14 correction here. |

## API

`POST /api/v1/orders/recalc-preference-charges`

### Preview

```json
{
  "mode": "preview",
  "orderIds": ["<uuid-of-0002>"],
  "limit": 25
}
```

Omit `orderIds` to scan the tenant (still capped by `limit`).

### Confirm

```json
{
  "mode": "confirm",
  "orderIds": ["<uuid-of-0002>"],
  "limit": 25,
  "idempotencyKey": "pref-recalc-0002-20260919-a"
}
```

Same key + same payload returns the cached batch. Same key + different payload → 409.

## Pilot order

`ORD-20260919-0002` is the known contaminated basket. Preview first. Confirm only if:

- proposed total matches the original cashier confirm (9.500 create / 13.000 after the later add, depending on current stored state)
- the order is **not** in `blocked`
- you accept that outstanding will fall and **no refund is created**

## After confirm

- Charge rows: ITEM/PIECE `PREFERENCE` are `is_voided = true`, reason `preference double-count correction`
- Header `total_amount` / outstanding come from the snapshot writer
- `total_paid_amount` unchanged
- Edit History shows a pricing-only row with that reason

## Rollback

- Do not un-void from this job. If a confirm was a mistake, treat it as a finance correction (manual review), not a silent restore.
- Flag rollback SQL: `cleanmatexsaas/docs/Added_Feature_Flags_docs/Rollback_Scripts/0512_rollback_order_fin_pref_charge_recalc.sql` (only after confirming no tenant override still points at the key)
