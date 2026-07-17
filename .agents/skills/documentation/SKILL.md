---
name: documentation
description: Create, expand, or update CleanMateX documentation packs for features, screens, services, components, workflows, API surfaces, and release readiness. Use for ordinary documentation work such as writing or filling missing pack files. When overlapping folders, duplicate sources of truth, repo-wide audits, or legacy-to-canonical migration are detected, switch to the specialist documentation skills instead of loading heavy governance logic here.
---

# Documentation

Handle normal documentation work with the lightest useful context.

## Use This Skill To

- Create documentation for a new feature or sub-scope.
- Expand an incomplete feature pack.
- Update existing docs after implementation changes.
- Fill a small number of missing pack files in an already-canonical folder.

## Route To Specialist Skills Only When Needed

- Use `/documentation-canonicalization` when overlapping folders, duplicate active docs, or unclear source of truth are present.
- Use `/documentation-audit` when the task is inventory, readiness scoring, missing-file reporting, or repo-wide documentation review.
- Use `/documentation-pack-repair` when the canonical folder is already known and the main task is completing a full pack safely.
- Use `/documentation-archive-migration` when retiring legacy docs, adding redirect stubs, or converting old folders into historical references.

Do not load those workflows for simple doc edits.

## Operating Rules

- Keep the task scoped to the relevant canonical folder and its directly related docs.
- Prefer `docs/features/<feature-slug>/` for new feature documentation unless the repo already has a clearly canonical location.
- Reuse existing folders and naming where they already exist.
- Reflect repository truth only. Do not invent routes, permissions, settings, migrations, or APIs.
- Mark unknown items as `TBD`, `Pending`, or `N/A` instead of guessing.
- Preserve meaningful existing content and fill gaps rather than replacing everything.

## Default Pack Expectation

Unless the user requests a smaller scope, verify or produce:

- `README.md`
- `development_plan.md`
- `progress_summary.md`
- `current_status.md`
- `developer_guide.md`
- `developer_guide_mermaid.md`
- `user_guide.md`
- `user_guide_mermaid.md`
- `deploy_guide.md`
- `testing_guide_and_scenarios.md`
- `CHANGELOG.md`
- `version.txt`
- `technical_docs/`
- lookup/index files when the folder depth needs them

Read [reference.md](./reference.md) only when the task needs pack details, routing guidance, or file-by-file expectations.

## Workflow

1. Confirm the documentation scope and whether the canonical folder is already clear.
2. If the folder or source of truth is unclear, stop and use `/documentation-canonicalization`.
3. Inspect the target folder and identify only the missing or stale files needed for this task.
4. Update the pack with minimal churn.
5. Cross-link the docs so contributors can move from overview to implementation detail.
6. Validate naming, consistency, and status/progress alignment.

## Final Response Contract

Always report:

- summary
- files changed
- validation performed
- remaining gaps, assumptions, or follow-ups
