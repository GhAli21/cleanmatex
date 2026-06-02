# Closed Period and Issued Document Restrictions

**Status:** Accepted  
**Area:** Accounting Control / AR / Tax  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Financial changes after period close or document issue need control.

## Decision

Closed period: no direct mutation; use adjustment document and elevated permission. Issued AR invoice: no silent rewrite. Issued tax doc: no mutation; use credit/debit note.

## Consequences / Implementation Rule

Provides accounting and compliance safety.
