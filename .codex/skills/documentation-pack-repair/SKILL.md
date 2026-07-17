---
name: documentation-pack-repair
description: Repair or complete a CleanMateX documentation pack inside an already-chosen canonical feature folder. Use when the source-of-truth folder is known and the main task is to fill missing standard files, normalize pack structure, and improve internal consistency without resolving larger overlap disputes.
---

# Documentation Pack Repair

Complete the pack without reopening canon decisions.

## Use This Skill To

- fill missing pack files in a canonical folder
- normalize file names toward the standard pack
- improve pack consistency and cross-links

## Workflow

1. Confirm the canonical folder is already chosen.
2. Inventory the standard pack against what exists.
3. Create or update only the missing or stale pack files.
4. Cross-link overview, status, guides, and technical references.
5. Validate consistency across the pack.

## Guardrails

- If canon is unclear, stop and use `/documentation-canonicalization`.
- Prefer minimal churn and reuse of current truthful content.
- Do not convert legacy neighboring folders into active sources of truth from inside this skill.

## Output Contract

Always report:

- repaired folder
- files created or updated
- remaining gaps
- validation notes
