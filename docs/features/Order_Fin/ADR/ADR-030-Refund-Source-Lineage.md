# Refunds Must Preserve Source Lineage

**Status:** Implemented (2026-06-05)  
**Area:** Refund / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

> **STALE-CLAIM CORRECTION (B29 doc sweep, 2026-07-19):** the "Implemented" status above was premature. The frozen [Authoritative Report §13/§21](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) (2026-07-15) found that `refund_source_type`/`reopens_due_amount` were added to the schema by migration 0340 but **never actually written by the refund service** — every refund row was still landing with the pre-migration defaults. The real write-side fix shipped via [B01](../Remediation_Work_Packages/B01_Refund_Lineage_And_Reopen_Due.md) on 2026-07-18 (migration 0404 + `initiateRefund`/`processRefund` classification, per the D002/D003 v2 decisions). This file is retained for history — do not read its status line as current truth; B01's Completion evidence is authoritative for what actually ships.

## Context

Refunding cash and restoring gift card are different events.

## Decision

Refund source types include `REAL_PAYMENT_REFUND`, `GIFT_CARD_RESTORE`, `WALLET_RESTORE`, `CUSTOMER_ADVANCE_RESTORE`, `CUSTOMER_CREDIT_ISSUE`, `CREDIT_NOTE_ISSUE`, and `MANUAL_EXCEPTION`.

## Consequences / Implementation Rule

Manual exception requires permission and reason. Do not refund stored-value redemption as cash unless explicitly approved.
