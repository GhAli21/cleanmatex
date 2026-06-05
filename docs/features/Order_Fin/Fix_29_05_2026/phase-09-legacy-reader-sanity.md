# Phase 9 — Legacy Reader Sanity Grep (Passive CI Gate)

**Date:** 2026-06-05  
**Migration:** none  
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md § Phase 9](order-fin-v1_1-full-alignment-implementation-plan.md)

---

## Goal

Prevent re-introduction of column names that were dropped from `org_orders_mst` in migration 0335 (Canonical Semantics v4, 2026-06-04). The gate is passive — it runs in CI as a separate `npm run check:legacy` step and does not modify build output.

---

## DB confirmation

MCP query against the local Supabase instance (`information_schema.columns`) confirmed that none of the banned column names exist in `org_orders_mst`:

| Column | Removed in | Canonical replacement |
|---|---|---|
| `vat_amount` | 0335 | `total_tax_amount` |
| `promo_discount_amount` | 0335 | n/a (promotions now tracked via `org_order_credit_apps_dtl`) |
| `gift_card_applied_amount` | 0335 | n/a (stored-value tracked via credit-app lifecycle) |
| `net_receivable_amount` | 0335 | `ar_receivable_amount` |
| `service_charge_type` | 0335 | `service_charge_amount` (type tracked via line-item role) |
| `subtotal` (alias) | 0335 | `subtotal_amount` |
| `paid_amount` (alias) | 0335 | `total_paid_amount` |

---

## Deliverables

### `web-admin/scripts/check-legacy-columns.js` (new)

Node.js script — no external dependencies, runs under Node 18+.

**Detection strategy:**

1. Walk all `.ts`, `.tsx`, `.js`, `.mjs` files under `web-admin/` (skips `node_modules`, `.next`, `dist`, `docs`, `.storybook`, test/story/generated files).
2. Filter to files that contain the string `org_orders_mst` — avoids scanning unrelated services.
3. For each qualifying file, use a balanced-brace extractor to locate every Prisma call block targeting `org_orders_mst` (regex: `\borg_orders_mst\s*\.\s*\w+\s*\(`).
4. Within each extracted block, search for banned identifiers.

**Why balanced-brace extraction?**  
Other tables (`org_ar_invoices_mst`, `org_order_payment_transactions_dtl`) legitimately still carry some of these column names (e.g., `vat_amount` on AR invoices). Scoping to `org_orders_mst` Prisma call blocks eliminates false positives from those tables — confirmed by running the script against the full codebase before shipping.

**Banned patterns inside org_orders_mst blocks:**

| Pattern | Rule ID |
|---|---|
| `\bvat_amount\b` | `vat_amount` |
| `\bpromo_discount_amount\b` | `promo_discount_amount` |
| `\bgift_card_applied_amount\b` | `gift_card_applied_amount` |
| `\bnet_receivable_amount\b` | `net_receivable_amount` |
| `\bservice_charge_type\b` | `service_charge_type` |
| `\bsubtotal(?!_)\s*:` | `subtotal (column key)` — only as object key, not local variable value |
| `\bpaid_amount\b` | `paid_amount` |

**Known limitation:** `tax`, `total`, `discount`, `service_charge` (without prefix) are intentionally excluded — they're too common across the codebase to distinguish statically without type information. TypeScript inference against the generated Prisma client is the primary gate for these; `npm run typecheck` covers them.

### `web-admin/package.json` (modified)

Added script:
```json
"check:legacy": "node scripts/check-legacy-columns.js"
```

---

## Validation

```
node scripts/check-legacy-columns.js
→ Legacy column check passed: no dropped org_orders_mst columns found in source.
```

Exit code 0 on clean codebase.

---

## Remaining phases

| Phase | Status |
|---|---|
| 11 — Documentation refresh + Codex deferred coverage | Pending |
