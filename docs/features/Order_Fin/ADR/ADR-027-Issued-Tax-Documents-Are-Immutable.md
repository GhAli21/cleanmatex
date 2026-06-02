# Issued Tax Documents Are Immutable

**Status:** Accepted  
**Area:** Tax Document / Compliance  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Fiscal documents submitted or issued must not be silently changed.

## Decision

Once issued/reported/cleared, do not mutate the original tax document. Use credit note or debit note.

## Consequences / Implementation Rule

Order edits after issue require adjustment documents.
