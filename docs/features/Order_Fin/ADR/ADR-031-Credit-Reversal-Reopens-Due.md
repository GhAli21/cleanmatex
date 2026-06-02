# Credit Reversal Can Reopen Due

**Status:** Accepted  
**Area:** Credit Applications / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

An applied credit may later be reversed.

## Decision

Track `credit_reversed_amount` and `credit_reversal_reopens_due_amount`.

## Consequences / Implementation Rule

If reversed credit is not replaced by another settlement source, outstanding reopens.
