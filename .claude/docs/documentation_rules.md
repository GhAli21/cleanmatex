# Documentation Rules

## Authority Note

Use `docs/README.md` as the primary documentation hub for repo-facing navigation.

Use `.claude/skills/documentation/SKILL.md` and `.claude/skills/documentation/reference.md` as the active AI workflow authority for creating, auditing, and repairing documentation packs.

This file is a concise policy bridge so repo guidance and skill guidance stay aligned.

## Core Rule

Treat documentation as a complete pack for a feature or meaningful sub-scope, not as isolated markdown files.

When asked to create, improve, or repair documentation, default to checking whether the target scope has a complete pack, unless the task explicitly asks for a smaller slice.

## Full Documentation Pack

For a feature or independently meaningful scope, verify or produce:

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
- lookup/index files appropriate to that folder depth

If the user wants a smaller subset, make that partial scope explicit in the docs or in the task outcome.

## Folder Rules

- Prefer `docs/features/<feature-slug>/` for new feature documentation unless the repo already has a canonical folder for that feature elsewhere.
- Reuse existing canonical folders instead of creating duplicates.
- Keep parent `README.md` files and lookup/index files updated so contributors can navigate the pack.
- Use nested folders such as `components/`, `services/`, `screens/`, `workflows/`, and `technical_docs/` only when they improve maintainability.

## Content Rules

- Reflect real repo state only. Do not invent APIs, permissions, migrations, settings, routes, or feature status.
- Mark unknown items as `TBD`, `Pending`, or `N/A`.
- Cross-link related docs instead of duplicating large blocks of content.
- Keep user-facing and developer-facing documentation separate when both are needed.
- Update status, progress, and changelog content when implementation state changes.

## Required Feature Coverage

When documenting a feature, explicitly cover these areas when they apply:

- permissions and RBAC impact
- navigation and route placement
- tenant settings and system settings
- feature flags and plan limits
- i18n keys and bilingual implications
- API routes and contracts
- migrations, schema changes, and RLS impact
- constants, types, and validation rules
- environment variables and external integrations
- testing scenarios, rollout notes, and operational risks

## Validation Rule

Before considering documentation complete, verify:

- the folder structure is coherent
- the intended files exist
- links are not obviously broken
- progress/status/changelog docs do not contradict each other
- documented technical facts match code or migrations

## Current Repo References

- `../../docs/README.md`
- `../../docs/folders_lookup.md`
- `../../docs/plan/master_plan_cc_01.md`
- `../skills/documentation/SKILL.md`
- `../skills/documentation/reference.md`
- `../../CLAUDE.md`

## Conflict Rule

If older guidance conflicts with the current repo structure or the active documentation skill, prefer:

1. real current repo structure
2. active documentation skill reference
3. older helper notes
