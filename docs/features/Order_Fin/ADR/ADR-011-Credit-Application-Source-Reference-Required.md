# Credit Application Source Reference Is Required

**Status:** Accepted  
**Area:** Credit Applications / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Credit redemption without a source reference is unsafe and caused dead-code risk.

## Decision

Each credit application must have a source reference: gift card id, wallet id, advance id, credit note id, customer credit id, loyalty id, or approved manual source.

## Consequences / Implementation Rule

Validate source exists, tenant/customer ownership, status, expiry/blocking, and sufficient balance.
