# DB Integrity Hardening — Findings (input for a new package)

**Found:** 2026-10-31, while building the Reusable Order Financial View read model (P2/P3-02).
**Source of truth for the numbers:** the remote DB (`supabase_remote_db` MCP, read-only), on 2026-10-31. Re-run the queries in §4 before planning; counts change as migrations land.
**Status:** not started. The owner will run this as its own package.

Already handled in the Order Fin View program, so **not** part of this package:
- `0679` receipts tenant-first order index (applied)
- `0680` charge-type catalog + FK, replacing the hard-coded CHECK (applied)
- `0681` tenant-first order indexes on `org_fin_vouchers_mst` and `org_invoice_mst` (written; owner to apply)

---

## 1. Summary

| ID | Severity | Finding | Count |
|---|---|---|---|
| F1 | High | Composite FKs that include the required `tenant_org_id` use `ON DELETE SET NULL` (banned by CLAUDE.md) | 87 |
| F2 | High (tenant isolation) | FKs between two tenant-scoped tables on the id column only, without `tenant_org_id` | 105 |
| F3 | Medium (performance, locking) | FKs with no index whose leading columns match the FK | 318 (most point at small `sys_*` catalogs) |
| F4 | Low (write cost) | Redundant indexes: a leading prefix of another index, or an exact duplicate | 128 prefix-redundant; 36 duplicate sets |
| F5 | Low (code) | Dead charge-type aliases in code, and no screen or API to add delivery, service or other charges | 2 files + one full-cycle gap |
| F6 | Process | Index checks must read `pg_indexes`, not `schema.prisma` | — |

---

## 2. Findings

### F1 — `ON DELETE SET NULL` on composite tenant FKs (87)

**What:** an FK such as `FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL`. On a parent delete, Postgres sets **both** columns to NULL. `tenant_org_id` is NOT NULL, so the delete fails with a not-null violation instead of detaching the child. The intended "detach" never works.

**Where (by parent):**
- `org_branches_mst` (most of them): finance (`org_fin_*` AP, bank, cash, journal, PO, supplier, posting), delivery (`org_dlv_*`, `org_drivers_mst`), `org_asm_*`, `org_invoice_mst`, `org_fin_vouchers_mst`, `org_order_items_dtl`, `org_order_item_pieces_dtl`, `org_order_item_processing_steps`, `org_rcpt_receipts_mst`, `org_pck_packing_lists_mst`, `org_qa_decisions_tr`, `org_gift_card_txn_dtl`, `org_inv_stock_tr`, `org_stng_audit_log_tr`
- `org_fin_vouchers_mst` / `org_fin_voucher_trx_lines_dtl`: the `fin_voucher_id` / `fin_voucher_trx_line_id` links on advance, credit note, gift card, loyalty, wallet transactions; `org_invoice_payments_dtl`, `org_customer_ar_ledger_dtl`, `org_b2b_statement_payments_dtl`, `org_rcpt_receipts_mst`; and the self-links on vouchers (`ref_voucher_id`, `reversed_by_voucher_id`) and voucher lines (`reversed_line_id`)
- `org_orders_mst`: `org_fin_vouchers_mst.fk_fin_voucher_order`, `org_invoice_lines_dtl.fk_oil_ord`
- `org_invoice_mst`, `org_invoice_payments_dtl`, `org_invoice_adjustments_dtl`: AR ledger, dunning, credit allocations, `fk_fin_voucher_invoice`
- Others: `org_fin_period_mst`, `org_fin_journal_mst`, `org_fin_post_log_tr` (self), `org_fin_post_exc_tr`, `org_fin_po_*`, `org_fin_bank_*`, `org_fin_cashbox_mst`, `org_fin_acct_mst`, `org_fin_alloc_rule_mst`, `org_asm_locations_mst`, `org_drivers_mst`, `org_users_mst`, `org_service_category_cf`

Two rows in the raw query are **not** this bug and should be left alone: `sys_audit_log` and `sys_auth_audit_log` reference `org_tenants_mst(id)` with a nullable single `tenant_org_id`.

**Fix (decide per category, then one migration per category):**
- **Reference or master data that may really be removed** (branch, driver, location, user link): `ON DELETE SET NULL (branch_id)`, the PG 15+ column-list form, which nulls only the reference column.
- **Finance records** (vouchers, voucher lines, ledger, AR, journal, posting): usually `RESTRICT`. A voucher or journal should block deleting what it points at, not lose the link silently. Owner decision per table.
- Rebuild each FK with the **same column order** as today (Prisma-safe rule, `/database` skill). Do not flip tenant position.

**Check before writing:** server version (`SHOW server_version;` must be ≥ 15); how `npm run prisma:pull` renders the column-list `SET NULL` (expect `onDelete: SetNull`; CLAUDE.md says that warning is not P1012, but confirm `prisma validate` passes).

### F2 — Single-column FKs between tenant-scoped tables (105)

**What:** for example `org_order_items_dtl.fk_org_items_order FOREIGN KEY (order_id) REFERENCES org_orders_mst(id)`. The DB accepts a child row whose parent belongs to **another tenant**. Code filters by tenant, but the database itself does not stop a cross-tenant link. This is the composite-FK guardrail in CLAUDE.md ("RLS on all `org_*` tables, composite FKs").

**Most important (order money, read by the Order Fin View):**

| Child | FK | Parent |
|---|---|---|
| `org_order_items_dtl` | `fk_org_items_order (order_id)`, `fk_org_items_prod (product_id)`, `override_by` | orders, products, users |
| `org_order_charges_dtl` | `order_id_fkey`, `fk_ocd_tax_profile (tax_profile_id)` | orders, tax profiles |
| `org_order_taxes_dtl` | `order_id_fkey`, `fk_order_taxes_profile` | orders, tax profiles |
| `org_order_discounts_dtl` | `fk_ord_disc_promo (promotion_id)` | promotions |
| `org_order_payments_dtl` | branch payment method, cash drawer, drawer session, payment method, terminal | config / cash tables |
| `org_order_refunds_dtl` | `cash_drawer_session_id` | drawer sessions |
| `org_invoice_mst` | `fk_org_invoice_order`, customer, gift card, promo, B2B contract, statement, `handed_to_by_user` | various |
| `org_loyalty_txn_dtl` | `account_id_fkey (account_id)` | loyalty accounts |
| `org_orders_mst` | `fk_org_order_customer`, parent order, B2B contract, gift card, promo | various |
| `org_tax_documents_mst` | `fk_tax_docs_order`, `fk_tax_docs_supersedes` | orders, self |

Also: the order sub-tables (`org_order_item_pieces_dtl`, `org_order_preferences_dtl`, `org_order_history`, `org_order_status_history`, `org_order_issues`, `org_order_edit_*`, `org_order_piece_hist_tr`, `org_order_item_processing_steps`), customer satellites (addresses, wallets, advances, credit notes, AR), loyalty (accounts, tiers, allocations), notifications, POS and cash, price lists, promotions usage, `org_wf_release_ln`, `org_pln_change_history_tr`, `org_fx_rate_mst`.

**Fix:**
1. For each parent, confirm a unique key on `(id, tenant_org_id)` exists (most `_mst` tables have one; `org_orders_mst` has it). Add one where missing. Use the order the parent already has and never invent one.
2. Data check first: any child row whose `tenant_org_id` differs from its parent's (pre-launch demo data; expect none, but prove it with a query per FK before tightening).
3. Replace each FK with `(col, tenant_org_id) → parent(id, tenant_org_id)`, keeping the delete action, unless F1 says otherwise. 1:1 children also need the matching composite UNIQUE in the same order.
4. One migration per domain (orders, finance, customers, …), each fully commented, `RESTRICT` drops only, then `prisma:pull` + `validate` after each.

**Side effect:** once an FK is composite, an existing tenant-first index `(tenant_org_id, col)` covers it, which removes many F3 entries. The `order_id`-only indexes kept for the single-column FKs (`idx_org_items_order`, `idx_org_invoice_order`) then become redundant (F4).

### F3 — FKs with no supporting index (318)

**What:** no index whose leading columns are exactly the FK's columns. A parent delete or key update scans the child table and holds locks longer.

**Most are low priority:** FKs to small `sys_*` catalogs (`currency_code`, `payment_method_code`, `tax_category_code`, `charge_type`…), which are never deleted.

**The ones that matter:** a large transactional parent with `CASCADE` or `SET NULL`. For example `org_order_charges_dtl.order_id` and `org_order_taxes_dtl.order_id`: the FK is single-column, and the only index is `(tenant_org_id, order_id)`. Fix F2 first; then re-run §4.3 and index only what is left.

### F4 — Redundant indexes

**Prefix-redundant (128 distinct indexes):** a plain index whose columns are the leading columns of another index on the same table. Examples: `org_rcpt_receipts_mst.idx_rcpt_receipts_tenant (tenant_org_id)`, and on `org_order_items_dtl` both `idx_org_items_tenant` and `idx_order_items_tenant` (each covered by `idx_order_items_tenant_order` and four others). After F2: `idx_org_items_order (order_id)`, `idx_org_invoice_order (order_id)`.

**Exact duplicates (36 sets, same columns twice).** Often a UNIQUE constraint plus a plain index on the same columns; keep the UNIQUE one and drop the plain one. Examples: `org_fin_vouchers_mst` `uq_fin_voucher_tenant_no = idx_fin_vouchers_voucher_no`; `org_invoice_mst` `org_invoice_mst_tenant_org_id_invoice_no_key = idx_org_invoice_tenant_no`; `org_users_mst` `idx_org_users_user = uq_org_users_mst_user_id`; `org_gift_cards_mst` `idx_gift_cards_customer = idx_gc_tenant_cust`; `org_order_items_dtl` `idx_org_items_tenant = idx_order_items_tenant`.

Use queries §4.4 and §4.5. Drop with `DROP INDEX … RESTRICT`, one commented migration. Never drop an index that backs a UNIQUE or PK constraint, and keep the one Prisma maps (`@@index(map:)` / `@@unique(map:)`), then `prisma:pull`.

### F5 — Charge types: dead aliases in code and a full-cycle gap

Since `0680`, `org_order_charges_dtl.charge_type` must be a `sys_charge_types_cd` code (`PREFERENCE`, `EXPRESS`, `BULK_SURCHARGE`, `SPECIAL_HANDLING`, `DELIVERY`, `SERVICE`, `OTHER`).
- **Dead aliases:** `web-admin/lib/utils/order-charge-money.ts` (`REAL_MONEY_CHARGE_TYPES`: `EXPRESS_CHARGE`, `SERVICE_CHARGE`, `DELIVERY_CHARGE`) and `web-admin/lib/services/order-financial-write.service.ts` (~L600: string lists `['SERVICE','SERVICE_CHARGE']`, `['DELIVERY','DELIVERY_CHARGE']`, `['EXPRESS','EXPRESS_CHARGE']`). The aliases can no longer be stored. Replace with `CHARGE_TYPES.*` (`lib/constants/order-financial.ts`). `OTHER` belongs in `REAL_MONEY_CHARGE_TYPES`. Covered by the characterization goldens (`__tests__/characterization/create-money/`).
- **Full-cycle gap:** no screen or API adds a `DELIVERY`, `SERVICE` or `OTHER` charge to an order, so `delivery_charge_amount` and `service_charge_amount` stay 0 in practice. Needs a product decision (where a delivery fee comes from: a branch setting, a delivery zone, or manual entry) before building.

### F6 — Process: check indexes in the database, not in Prisma

Phase 0 of the Order Fin View relied on `schema.prisma`, which does not show partial indexes and missed two gaps. Any index or FK audit must query `pg_indexes` and `pg_constraint` (queries below).

---

## 3. Suggested order

1. F2 data check (§4.2 plus a per-FK mismatch query), then F2 migrations by domain, starting with orders and order money.
2. F1 decisions per category (owner), then F1 migrations.
3. Re-run §4.3, then index the remaining F3 entries that matter.
4. F4 drops.
5. F5 code clean-up (small, no migration); the delivery-fee capability as its own feature.

Each migration: next seq, full `COMMENT ON`, `RESTRICT` only, no CASCADE drops, then stop for the owner to apply, then `prisma:pull` + `prisma validate`.

---

## 4. Detection queries (read-only)

### 4.1 F1 — composite tenant FKs with `ON DELETE SET NULL`
```sql
SELECT conrelid::regclass AS child, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype = 'f' AND confdeltype = 'n'
  AND pg_get_constraintdef(oid) ~ 'tenant_org_id'
  AND pg_get_constraintdef(oid) !~ 'SET NULL \('
ORDER BY 1, 2;
```

### 4.2 F2 — single-column FKs between tenant-scoped tables
```sql
SELECT c.conrelid::regclass AS child, c.conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class ch ON ch.oid = c.conrelid
JOIN pg_class pa ON pa.oid = c.confrelid
WHERE c.contype = 'f'
  AND ch.relname LIKE 'org\_%' AND pa.relname LIKE 'org\_%' AND pa.relname <> 'org_tenants_mst'
  AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=pa.relname AND k.column_name='tenant_org_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=ch.relname AND k.column_name='tenant_org_id')
  AND pg_get_constraintdef(c.oid) !~ 'tenant_org_id'
ORDER BY 1, 2;
```

### 4.3 F3 — FKs with no index on exactly their columns (leading)
```sql
WITH fk AS (
  SELECT c.conrelid, c.conname, c.conkey, c.confdeltype, pg_get_constraintdef(c.oid) AS def, ch.relname AS child, pa.relname AS parent
  FROM pg_constraint c
  JOIN pg_class ch ON ch.oid = c.conrelid
  JOIN pg_class pa ON pa.oid = c.confrelid
  JOIN pg_namespace n ON n.oid = ch.relnamespace
  WHERE c.contype = 'f' AND n.nspname = 'public' AND ch.relname LIKE 'org\_%')
SELECT child, conname, parent, confdeltype, def
FROM fk
WHERE def !~ 'REFERENCES org_tenants_mst'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = fk.conrelid
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(fk.conkey, 1)] @> fk.conkey
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(fk.conkey, 1)] <@ fk.conkey)
ORDER BY (parent LIKE 'sys\_%'), confdeltype, child;  -- org parents with CASCADE/SET NULL first
```

### 4.4 F4 — indexes that are a leading prefix of another index on the same table
```sql
SELECT a.indrelid::regclass AS tbl, a.indexrelid::regclass AS redundant, b.indexrelid::regclass AS covered_by
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid AND a.indexrelid <> b.indexrelid
JOIN pg_class t ON t.oid = a.indrelid
WHERE t.relname LIKE 'org\_%'
  AND NOT a.indisunique AND NOT a.indisprimary
  AND a.indpred IS NULL AND b.indpred IS NULL
  AND array_length(string_to_array(a.indkey::text, ' '), 1) < array_length(string_to_array(b.indkey::text, ' '), 1)
  AND (string_to_array(b.indkey::text, ' '))[1:array_length(string_to_array(a.indkey::text, ' '), 1)] = string_to_array(a.indkey::text, ' ')
ORDER BY 1, 2;
```
Before dropping anything from §4.4, check that no single-column FK relies on it (F2/F3).

### 4.5 F4 — exact duplicate indexes (same columns, no predicate)
```sql
SELECT indrelid::regclass AS tbl, string_agg(indexrelid::regclass::text, ' = ') AS same_columns
FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
WHERE t.relname LIKE 'org\_%' AND i.indpred IS NULL
GROUP BY indrelid, indkey::text, indclass::text
HAVING count(*) > 1
ORDER BY 1;
```

---

## 5. Rules to apply (from CLAUDE.md and the `/database` skill)

- Never modify an applied migration; new migration per change, next seq, ≤ 30-char names.
- `DROP … RESTRICT` only; CASCADE needs a dependency manifest and owner approval.
- Prisma-safe composite FKs: FK columns, 1:1 UNIQUE and parent key in the **same order**; parent `(id, tenant_org_id)` → child `(parent_id, tenant_org_id)`.
- Never `ON DELETE SET NULL` on a composite that includes required `tenant_org_id`; use PG 15+ `SET NULL (col)`, `RESTRICT` or `CASCADE`.
- Document every object with `COMMENT ON`.
- Write the SQL, then stop; the owner applies it and regenerates types (both repos) and Prisma.
- Pre-launch: demo data only, so tightening constraints needs no backfill compatibility, but prove there are no violating rows before each tightening.
