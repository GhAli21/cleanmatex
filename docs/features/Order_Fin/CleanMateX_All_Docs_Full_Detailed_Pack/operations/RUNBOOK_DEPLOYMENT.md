<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Deployment Runbook

## Pre-Deployment

- backup database
- run migrations in staging
- run tests
- run reconciliation dry-run
- verify feature flags disabled by default

## Deployment

- deploy DB migration
- deploy backend
- deploy frontend if needed
- keep new reads disabled
- monitor errors

## Post-Deployment

- run reconciliation
- inspect logs
- verify checkout flow
- verify idempotency
- verify rollback plan

## Rollback

- disable feature flags
- revert backend if needed
- do not drop new tables immediately
