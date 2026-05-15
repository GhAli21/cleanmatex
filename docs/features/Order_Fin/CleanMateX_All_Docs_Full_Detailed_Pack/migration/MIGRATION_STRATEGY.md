<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Migration Strategy

## 1. Strategy

```text
expand → dual-write → reconcile → switch-read → retire
```

## 2. Expand

Add new tables/columns without changing current behavior.

## 3. Dual-Write

Write both legacy structures and normalized structures in the same transaction.

## 4. Reconcile

Compare:
- old summary
- new detail rows
- ledger rows
- invoice rows
- posting rows

## 5. Switch-Read

Use feature flags to switch reads from old to new.

## 6. Retire

Remove legacy code only after:
- reconciliation passes
- feature flags stable
- tests pass
- historical backfill done

## 7. No-Break Rule

Do not redesign checkout during migration.
