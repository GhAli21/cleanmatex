# 15 — Open Questions

Decisions or data checks only the user/business can resolve. Each blocks or sizes a specific finding.

## Q1 — How much does FN-01 hurt in production today? (sizing — run before Must-Fix 1)

Read-only queries (local + remote), e.g.:
```sql
-- Orders with canonical payments but no _tr rows (the invisible-payments set)
SELECT count(DISTINCT p.order_id)
FROM org_order_payments_dtl p
LEFT JOIN org_payments_dtl_tr t
  ON t.order_id = p.order_id AND t.tenant_org_id = p.tenant_org_id
WHERE t.id IS NULL;

-- _tr rows created after the orchestrator removal (who still writes it, per flow)
SELECT date_trunc('month', created_at) AS m, count(*),
       count(*) FILTER (WHERE order_id IS NOT NULL)   AS order_rows,
       count(*) FILTER (WHERE invoice_id IS NOT NULL) AS invoice_rows
FROM org_payments_dtl_tr GROUP BY 1 ORDER BY 1 DESC;
```
Also decide: should historical `_tr` rows appear in the repointed displays (union with a "legacy" badge) or be cut off at a stated date?

## Q2 — End state for `org_payments_dtl_tr` writers

The invoice/customer payment flows (`app/dashboard/customers/[id]`, `b2b/customers/[id]`, `ready/[id]`, `internal_fin/payments/new`) still write `_tr`. Move them onto the voucher/AR path (recommended, completes ADR-002) — in this program or a follow-up? Is the `internal_fin/payments` screen still an intended production surface?

## Q3 — Cancellation disposition policy (blocks FN-02 full fix)

For a paid order being cancelled, which dispositions do you want, and per role?
- refund only? refund + store credit? keep-on-account behind which permission?
- Does cancellation of an order with consumed gift-card/wallet credit restore it automatically, or by staff choice?
- Cancellation fee/partial-forfeit support (common in GCC laundry ops for started work) — in scope or explicitly not?
- Interim guard (block cancel of paid orders until the flow ships) — acceptable operationally?

## Q4 — Print-route permission strictness (FN-04)

Gate order payment prints with `orders:read` only, or additionally `orders:view_financial_breakdown` (stricter — hides payment history from basic operators)? Pick per role matrix.

## Q5 — Cash-up module fate (FN-06)

Retire `cashup-history` in favor of cash-drawer sessions + D-09 recon, or repoint it? Is anyone using cash-up in production today (see Q1 second query — cash `_tr` rows)?

## Q6 — E-invoice target jurisdiction + timing (FN-05 scheduling)

Which jurisdiction first (KSA ZATCA Phase 2? Oman? UAE?) and target date — this decides when the decomposition phase must start and which adapter is built first. Also: cleanmatexsaas HQ toggle UI (writes the 0383 columns) — when is it scheduled?

## Q7 — Multi-currency reality check (R-07)

Do any live tenants run `currency_ex_rate ≠ 1` order flows today? If yes, the multi-currency recalc fixture ([11 §gap 4](./11_TEST_COVERAGE_FINDINGS.md)) moves up sharply in priority.

## Q8 — Migrations after 0384 on remote (R-04)

Confirm which of 0385–0392 are applied to remote/prod. (Local state per the v4 program log: through 0392, next free seq 0393.)

## Q9 — Duplicate route pairs

`orders/[id]/refund` vs `orders/[id]/refunds`, and `financial-reconcile` vs `financial-reconciliation` — is one of each an intentional alias? If not, mark one deprecated to stop new clients binding to it.
