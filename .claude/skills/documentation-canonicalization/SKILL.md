---
name: documentation-canonicalization
description: Choose the canonical CleanMateX documentation folder or document when overlapping, duplicated, or conflicting sources of truth exist. Use when multiple feature folders, PRDs, or active-looking docs appear to cover the same domain and a single maintained source of truth must be selected before further documentation work.
---

# Documentation Canonicalization

Resolve source-of-truth conflicts before generating more docs.

## Use This Skill To

- choose the canonical folder for an overlapping domain
- classify docs as canonical, supporting, legacy, redirect, or archive candidate
- define a safe migration path without rewriting everything at once

## Workflow

1. Identify the overlapping candidate folders or docs.
2. Score each candidate against the rubric in [reference.md](./reference.md).
3. Pick one canonical source of truth.
4. Classify the remaining candidates.
5. Recommend redirect, support-only, or archive outcomes.
6. Update indexes or routing docs only after canon is chosen.

## Guardrails

- Prefer implemented reality over older planning text.
- Prefer the folder most likely to be maintained going forward.
- Do not merge overlapping content blindly.
- Do not delete old docs without leaving redirect context unless the user explicitly wants removal.

## Output Contract

Always provide:

- canonical winner
- losers and their classifications
- rationale
- migration or redirect actions
