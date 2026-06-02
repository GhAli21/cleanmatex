# Order Edit Uses Financial Delta Model

**Status:** Accepted  
**Area:** Order Edit / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Editing submitted/paid/invoiced orders requires controlled financial impact handling.

## Decision

Calculate `delta_amount = new_total_amount - old_total_amount`. Zero = no settlement action; positive = additional collection/debit note; negative = refund/customer credit/credit note.

## Consequences / Implementation Rule

Do not directly mutate posted payments, credits, voucher lines, issued AR invoice lines, or issued tax docs.
