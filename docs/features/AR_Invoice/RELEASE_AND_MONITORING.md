# AR Invoice v1 / v1.5 / v2 — Release And Monitoring Notes

**Feature:** AR Invoice  
**Last Updated:** 2026-05-22

## Release Notes

AR Invoice ships as an additive extension of `internal_fin` with:

- canonical AR invoice hub
- multi-step invoice issuance wizard
- invoice detail financial action dialogs
- customer balance, ledger, aging, and statement routes
- invoice and statement print surfaces
- CSV export for the invoice hub
- legacy invoice/payment path bridging into canonical AR allocation and ledger helpers
- AR credits, disputes, dunning, and statement-cycle operations pages

## Migration Ledger

Database work associated with this rollout includes:

- previously applied AR migrations `0313` through `0316`
- additive safety migration `0317_ar_invoice_header_defaults_fix.sql`
- additive navigation alignment migration `0320_ar_invoice_ledger_navigation.sql`
- V2 operations schema migration `0321_ar_v2_ops_schema.sql`
- V2 permissions seed migration `0322_ar_v2_ops_permissions.sql`
- V2 navigation seed migration `0323_ar_v2_ops_navigation.sql`

Assistant rule reminder:

- migrations are created only
- migrations are never applied by the assistant

## Observability Expectations

The implementation assumes monitoring on:

- invoice issuance failures
- sensitive approval failures
- payment allocation and reversal failures
- customer credit application and reversal failures
- dispute open/resolve failures
- dunning execution failures
- statement-cycle creation and preview failures
- print/export route errors
- tenant isolation exceptions

## Outbox And Audit Expectations

Implemented finance events include:

- invoice issued
- payment allocated
- payment allocation reversed
- overpayment credit created
- customer credit applied
- customer credit application reversed
- credit memo posted
- debit note posted
- write-off posted
- invoice voided
- dispute opened
- dispute resolved
- dunning action executed

Each operationally significant status change also writes AR status history.

## Feature Flags And Settings

No new AR-specific feature flags were introduced in this slice.

Assumptions remain:

- B2B-specific filtering is only exposed when the existing `b2b_contracts` flag is available
- shared finance settings and feature flags continue to be consumed through HQ-owned APIs when needed

## Remaining Operational Watchpoints

- any future change to DB-stored AR statuses or types must update constants and Zod enums in lockstep
- future GL integration should consume canonical AR ledger and status-history facts rather than re-reading legacy invoice fields only
