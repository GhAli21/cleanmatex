# Documentation Map

Use `docs/README.md` as the main documentation index for humans.

Use `.claude/skills/documentation/` as the execution guidance for AI-driven documentation work.

## Main Repo Areas

- main documentation hub: `docs/README.md`
- feature documentation root: `docs/features/`
- feature folder lookup index: `docs/folders_lookup.md`
- implementation plans: `docs/plan/`
- development rules and technical references: `docs/dev/`
- shared database docs: `supabase/README.md`
- web admin module docs: `web-admin/README.md`
- API module docs: `cmx-api/README.md`

## Documentation Pack Model

For a feature or meaningful sub-scope, the target pack is:

- overview: `README.md`
- planning: `development_plan.md`
- progress tracking: `progress_summary.md`
- status snapshot: `current_status.md`
- developer guide: `developer_guide.md`
- developer flow diagram: `developer_guide_mermaid.md`
- user guide: `user_guide.md`
- user flow diagram: `user_guide_mermaid.md`
- deployment/operations notes: `deploy_guide.md`
- testing coverage: `testing_guide_and_scenarios.md`
- change history: `CHANGELOG.md`
- current version marker: `version.txt`
- deeper technical references: `technical_docs/`

## AI Guidance In `.claude`

- `skills/documentation/SKILL.md` — lean default router for ordinary documentation work
- `skills/documentation/reference.md` — pack rules and lightweight routing guidance
- `skills/documentation-canonicalization/SKILL.md` — choose canonical docs when overlap or duplication exists
- `skills/documentation-audit/SKILL.md` — audit pack completeness, stale structure, and cleanup priorities
- `skills/documentation-pack-repair/SKILL.md` — complete missing pack files in a canonical folder
- `skills/documentation-archive-migration/SKILL.md` — convert legacy docs into redirect or archive-safe state
- `skills/code-documentation/SKILL.md` — inline code comments, JSDoc/TSDoc, SQL comments, Tailwind and config documentation
- `docs/settings-reference.md` — settings guidance
- `docs/web-admin-ui-imports.md` — required web-admin UI imports
- `docs/ui-general-rules.md` — UI naming and frontend guardrails

## Quick Routing

- Need to write or improve feature docs: start with `docs/features/` and the documentation skill.
- Need to resolve duplicate or overlapping doc sources: use `skills/documentation-canonicalization/`.
- Need repo-wide doc health or cleanup planning: use `skills/documentation-audit/`.
- Need to fill missing standard files in one known canonical folder: use `skills/documentation-pack-repair/`.
- Need repo-wide navigation context: open `docs/README.md`.
- Need implementation planning context: check `docs/plan/`.
- Need code comment standards instead of feature docs: use `skills/code-documentation/`.

## Rule

Do not rely on older duplicate maps or stale helper files when `docs/README.md` and the active documentation skill already describe the current structure.
