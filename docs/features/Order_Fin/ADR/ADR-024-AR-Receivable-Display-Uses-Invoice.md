# AR Receivable Display Uses Invoice Outstanding When Invoice Exists

**Status:** Accepted  
**Area:** Order Details UI / AR  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

The UI can mix invoice identity from invoice table with amount from order header, causing mismatch.

## Decision

If AR invoice exists, display `org_invoice_mst.outstanding_amount`. Else if AR payment type, display order `ar_receivable_amount`. Otherwise display zero.

## Consequences / Implementation Rule

Show `AR_RECEIVABLE_MISMATCH` if order and invoice disagree.
