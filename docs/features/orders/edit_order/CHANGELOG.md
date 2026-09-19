# Edit Order / commercial totals — changelog

## 2026-09-19

- Slices 1–4: one commercial total. Item/piece extras stay in line totals; only ORDER-level PREFERENCE extras add as money charges. Edit posts `orderServicePrefs`, voids leftover ITEM/PIECE charges, rewrites tax, unique taxable base, pref chips use persisted `extra_price`.
- Edit History now records preference kind / content / code (before and after) and `prefs_level` (`ORDER` / `ITEM` / `PIECE`), plus piece changes. Customer name is no longer rewritten from live customer master.
- Slice 5: opt-in historical recalc. Flag `order_fin_pref_charge_recalc` default OFF (migration `0512` — owner applies). `POST /api/v1/orders/recalc-preference-charges` preview/confirm. Permission `orders:post_settlement_edit`. ISSUED tax documents blocked. Never changes `total_paid_amount`. Runbook: `docs/features/Order_Fin/Remediation_Work_Packages/HISTORICAL_PREF_CHARGE_RECALC_RUNBOOK.md`. QA: §32.

## Residual

- Preparation item PATCH can still stale headers (B12 out of scope).
- Contaminated historical orders stay as stored until an owner runs slice 5.
- Edit Pay / Collect button is still out of scope.
