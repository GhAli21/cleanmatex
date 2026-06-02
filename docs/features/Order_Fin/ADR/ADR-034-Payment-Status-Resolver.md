# Canonical Payment Status Resolver

**Status:** Accepted  
**Area:** Order Fin / Status  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Status must follow actual financial snapshot after every recalculation.

## Decision

Resolver priority: cancelled, overpaid, refunded, paid, pending payment, partially paid, pending collection, payment failed, unpaid.

## Consequences / Implementation Rule

Do not leave stale payment status after recalculation/repair.
