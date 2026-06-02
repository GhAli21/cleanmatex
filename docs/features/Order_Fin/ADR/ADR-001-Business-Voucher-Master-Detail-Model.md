# Business Voucher Master/Detail Model

**Status:** Accepted  
**Area:** Business Voucher Module (BVM)  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Use `org_fin_vouchers_mst` and `org_fin_voucher_trx_lines_dtl` as the canonical finance transaction document model instead of narrow payment transaction tables.

## Decision

`org_fin_vouchers_mst` is the voucher header/master. `org_fin_voucher_trx_lines_dtl` is the canonical transaction-line table. This model supports receipt vouchers, payment/outgoing vouchers, petty cash, supplier payments, shop rent, employee cash, order payments, stored-value applications, refunds, AR invoice payments, and later ERP-lite flows.

## Consequences / Implementation Rule

Do not build new financial transaction logic on `org_payments_dtl_tr`. Use voucher master/detail for all new settlement and business voucher flows.
