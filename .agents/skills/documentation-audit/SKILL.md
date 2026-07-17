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

## Guardrails

- Prefer scripted inventories and concise summaries over prose-heavy manual review.
- Separate file-presence audit from content-quality audit.
- Do not silently assume the target folder is canonical if overlap is evident; route to `/documentation-canonicalization`.

## Output Contract

Always report:

- scope
- key counts
- readiness tiers or severity buckets
- top risks
- recommended next wave
