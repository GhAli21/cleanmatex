# 12 — Data Integrity & Backfill Previews

**All queries are read-only SELECT previews. Do NOT run UPDATE/DELETE without explicit approval.** The full set lives in [07 §Backfill previews](./07_DATABASE_FINDINGS.md#backfill--data-integrity-select-previews-read-only--do-not-run-updates-without-approval) (P-1…P-6). This file adds the integrity checks tied to the deep-dive findings.

## Already run this session (results)
- **Orphan resolution codes** (P-1): **0 rows** (live). FK integrity clean.
- **`org_fin_overpay_disp_res_fk`**: present + `convalidated=true`; old CHECK gone.
- **`sys_fin_overpay_res_cd`**: all 9 codes present.

## Recommended previews (run before/after the GA fixes)

**D-1 — B2B statement double-application probe (F-02).** Until B2B idempotency lands, look for multiple STATEMENT_PAYMENT lines on one statement with suspicious equal amounts (possible replay):
```sql
SELECT target_id AS statement_id, amount, COUNT(*) n
FROM org_fin_voucher_trx_lines_dtl
WHERE line_role='STATEMENT_PAYMENT' AND target_type='B2B_STATEMENT' AND line_status='POSTED'
GROUP BY target_id, amount HAVING COUNT(*) > 1;
```

**D-2 — B2B statement balance vs voucher lines reconciliation.** Statement `paid_amount` should equal the sum of its STATEMENT_PAYMENT lines (no detail table → reconcile via voucher lines):
```sql
SELECT s.id, s.paid_amount,
  COALESCE((SELECT SUM(l.amount) FROM org_fin_voucher_trx_lines_dtl l
    WHERE l.target_id=s.id AND l.line_role='STATEMENT_PAYMENT' AND l.line_status='POSTED'),0) AS lines_sum
FROM org_b2b_statements_mst s
WHERE ABS(s.paid_amount -
  COALESCE((SELECT SUM(l.amount) FROM org_fin_voucher_trx_lines_dtl l
    WHERE l.target_id=s.id AND l.line_role='STATEMENT_PAYMENT' AND l.line_status='POSTED'),0)) > 0.001;
```

**D-3 — `org_tax_doc_seq_counters` cross-tenant probe (F-01).** Under a tenant-scoped connection this should return only that tenant's rows once RLS is enabled; today (no RLS) it returns all:
```sql
SELECT tenant_org_id, document_type, fiscal_year, last_sequence
FROM org_tax_doc_seq_counters ORDER BY tenant_org_id;
```

**D-4 — collect-payment key collisions (F-10).** Overpayment-disposition rows sharing the default collect key across distinct events:
```sql
SELECT tenant_org_id, idempotency_key, resolution_code, COUNT(*) n
FROM org_fin_overpay_disp_dtl
WHERE idempotency_key LIKE '%\_collect\_%' ESCAPE '\'
GROUP BY 1,2,3 HAVING COUNT(*) > 1;
```

**D-5 — Pending/authorized counted as paid (rule 19).** See [07 P-3]. Expect 0.

**D-6 — AR-invoice-wins violations (rule 12).** See [07 P-4]. Expect 0.

**D-7 — Voucher lines missing their effect row (wiring integrity).** See [07 P-5]. Expect 0.

**D-8 — `overpaid_amount` integrity (rule 13).** See [07 P-2]. Expect 0.

> No destructive correction is recommended at this time; if any preview returns rows, investigate root cause before any approved remediation. The canonical remedy for snapshot drift is to **re-run `recalculateOrderFinancialSnapshotTx`** per affected order, never a raw UPDATE.
