# Keep total_paid_amount as the DB Canonical Paid Column

**Status:** Accepted  
**Area:** Order Fin Naming  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

`total_completed_payment_amount` is clearer but would duplicate `total_paid_amount` if both exist in DB.

## Decision

Keep DB column `total_paid_amount`. Use `totalCompletedPaymentAmount` as TypeScript/API naming.

## Consequences / Implementation Rule

Do not add `total_completed_payment_amount` as a DB column unless `total_paid_amount` is removed, which is not recommended.
