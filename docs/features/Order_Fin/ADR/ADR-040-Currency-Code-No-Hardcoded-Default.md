# Currency Code Required with No Hardcoded Default

**Status:** Accepted  
**Area:** Currency / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Hardcoded currency defaults can corrupt multi-tenant/multi-country data.

## Decision

`currency_code` is required and must be resolved before insert from order, branch, or tenant settings.

## Consequences / Implementation Rule

Do not rely on hardcoded DB default like OMR.
