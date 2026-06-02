# Allocate Order-Level Discounts by Tax Category

**Status:** Accepted  
**Area:** Tax / Discounts  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Order-level discounts across mixed tax lines must be allocated correctly.

## Decision

Allocate commercial order-level discounts proportionally across eligible lines while preserving tax category.

## Consequences / Implementation Rule

Do not allocate stored-value credits as discounts.
