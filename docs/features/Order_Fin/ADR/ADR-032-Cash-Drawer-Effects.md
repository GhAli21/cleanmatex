# Cash Drawer Effects from Vouchers

**Status:** Accepted  
**Area:** POS / Cash Drawer / BVM  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Cash payments, refunds, and change affect cash drawer.

## Decision

Completed cash order payment creates drawer IN. Cash refund creates drawer OUT. Change returned is handled by chosen drawer policy.

## Consequences / Implementation Rule

Supported policies: net-retained or tender/change.
