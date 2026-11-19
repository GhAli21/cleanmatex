---
name: documentation-audit
description: Audit CleanMateX documentation coverage, pack completeness, stale structure, and missing files across one feature area or the whole repo. Use when the user asks for inventory, readiness tiers, cleanup plans, gap reports, or documentation health review.
---

# Documentation Audit

Inventory first. Rewrite later.

## Use This Skill To

- audit one folder or many folders against the standard pack
- report missing files, stale structure, or readiness tiers
- produce cleanup plans and prioritized next steps

## Workflow

1. Define the audit scope.
2. Inventory current files and structure.
3. Compare against the standard pack or task-specific expectations.
4. Group findings into readiness tiers or priority waves.
5. Recommend the smallest useful next actions.
6. For findings that are stale, historical-only, superseded, or non-primary, write the shared `**Doc Status:**` marker line into the file itself (exact prefix and recognized values in `/documentation-archive-migration` reference.md §1) — don't just report it, flag it in place so `/documentation-archive-migration` can act later without re-judging.

## Guardrails

- Prefer scripted inventories and concise summaries over prose-heavy manual review.
- Separate file-presence audit from content-quality audit.
- Do not silently assume the target folder is canonical if overlap is evident; route to `/documentation-canonicalization`.
- Default the scan to the requested folder(s) only. Do not widen to a full-repo scan unless the user explicitly asked for repo-wide audit.

## Route Findings To

An audit reports, and marks non-canonical files with the shared status header; it doesn't move or rewrite them. Point each finding at the skill that executes it:

- missing pack files → `/documentation` (small gap) or `/documentation-pack-repair` (full pack completion)
- overlapping/duplicate sources of truth → `/documentation-canonicalization`
- stale, historical-only, or superseded docs → mark `**Doc Status:** Legacy/Superseded/Archive Candidate` (step 6), then `/documentation-archive-migration` executes

## Output Contract

Always report:

- scope
- key counts
- readiness tiers or severity buckets
- top risks
- recommended next wave
