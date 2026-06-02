# Partial Later Collection Is Allowed by Default

**Status:** Accepted  
**Area:** Order Collection  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Retail later collection may be partial.

## Decision

Default `allow_partial_later_collection = true`. Resolution order: branch override, tenant setting, system default true.

## Consequences / Implementation Rule

Recalculate order snapshot after each later collection.
