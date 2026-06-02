# Tax Document Timing Is Policy-Driven

**Status:** Accepted  
**Area:** Tax Document / Compliance  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Different countries and flows require tax documents at different events.

## Decision

Support `ON_ORDER_SUBMIT`, `ON_PAYMENT_CONFIRMATION`, `ON_SERVICE_COMPLETION`, `ON_DELIVERY`, and `ON_AR_INVOICE_ISSUE`.

## Consequences / Implementation Rule

Defaults: paid retail on payment confirmation; gateway pending waits for confirmation unless law says otherwise; PAY_ON_COLLECTION on confirmation/delivery; B2B/credit invoice on AR invoice issue.
