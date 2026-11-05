# P10 backfill runbook — suppliers first, then others

**Date:** 2026-11-05 (Asia/Muscat). **FOLLOWUPS #14** started; **no destructive supplier migration shipped**.

## Why no `069x` supplier rewrite was written

Live Prisma/schema knowledge (no DB connection used):

| Fact | Evidence |
|---|---|
| Code column already exists | `org_fin_supp_mst.supplier_code String @db.VarChar(40)` (NOT NULL) |
| Unique already exists | `@@unique([tenant_org_id, supplier_code], map: "uq_ofs_code")` |
| Doc-seq type already seeded | `0667` row `ERP_SUPPLIER` / prefix `SUP` / DOMAIN |
| App still uses COUNT+1 | `erp-lite-v2.service.ts` `PREFIX_SUPPLIER = 'SUP'` + `generateSequentialNo` |

§5.13 steps 1 (add nullable code), 4 (CONCURRENTLY unique), 5 (NOT NULL) are **already done** for suppliers. A blind 5k-row rewrite of existing `supplier_code` values without seeing live formats risks breaking PO/AP FKs that store the human code.

**Blocked until you run (test tenant first):**

```sql
-- Sample formats (share anonymized output)
SELECT length(supplier_code) AS len,
       left(supplier_code, 12) AS sample_prefix,
       count(*) AS n
  FROM org_fin_supp_mst
 GROUP BY 1, 2
 ORDER BY n DESC
 LIMIT 30;

SELECT count(*) AS blank_or_null
  FROM org_fin_supp_mst
 WHERE supplier_code IS NULL OR btrim(supplier_code) = '';
```

Only after that sample can we safely choose: (A) leave DOMAIN forever, (B) engine cutover for **new** rows only (trigger assign when `''`), or (C) rewrite to `SUP-YYYYMM-#####` with batched UPDATE + counter seed.

## Suppliers wave — recommended safe sequence (after samples)

1. **Decide format** from the sample (keep current vs `SUP-YYYYMM-#####`).
2. If rewrite: one migration file for batched UPDATE (5k) + seed `org_doc_seq_mst` from max; **separate** file only if a new unique index is needed (not today).
3. Attach `fn_doc_seq_assign_code` / guard only after blanks are impossible and format is locked.
4. Flip app `erp-lite-v2` create path to insert `''` (ENGINE) like store credit notes.
5. Safety test: uniqueness, no blanks, consistency view 0 ERROR for `ERP_SUPPLIER`.

## Subsequent tables (prepare only — do not migrate now)

Order from FOLLOWUPS #14 / DOMAIN registry:

| # | Table | Type | Prefix | Notes |
|---|---|---|---|---|
| 2 | employees (`org_…`) | `EMPLOYEE` | `EMP` | Confirm column name in registry before drafting |
| 3 | delivery routes | `DELIVERY_ROUTE` | `RT` | Same |
| 4+ | products, stock, B2B, vouchers | see `DOMAIN_CODES_REGISTRY.md` | | One approval + one migration wave each |

For each: inventory whether code col / unique / NOT NULL already exist (like suppliers) before writing SQL. Prefer "engine for new rows only" when existing codes are heterogeneous.

## User checklist before approving a supplier rewrite

- [ ] Paste sample `GROUP BY` result from test tenant
- [ ] Confirm no blank `supplier_code`
- [ ] Confirm PO/AP screens key by `supplier_code` vs UUID only
- [ ] Approve format choice A / B / C above