# Deprecate org_payments_dtl_tr

**Status:** Accepted  
**Area:** Business Voucher / Payment Architecture  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

`org_payments_dtl_tr` is too narrow for CleanMateX finance needs and cannot cover outgoing payments, petty cash, source-document lineage, credit application effects, AR invoice payments, refunds, and voucher posting.

## Decision

Block/deprecate `org_payments_dtl_tr` for new development. `org_fin_voucher_trx_lines_dtl` becomes the canonical transaction-line table.

## Consequences / Implementation Rule

If historical rows exist, migrate them or keep them read-only. No new writes should target `org_payments_dtl_tr`.
