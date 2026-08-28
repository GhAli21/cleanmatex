---
name: create-feature-flag
description: Add a new feature flag to hq_ff_feature_flags_mst via a new CleanMateX migration file (plus plan mappings and the web-admin FLAG_CATALOG sync). Use only when explicitly working on create-feature-flag-related tasks.
user-invocable: true
version: 1.3.0
deprecated: false
effort: low
references:
  - @.Codex/skills/create-feature-flag/reference.md
  - AGENTS.md
agents:
---

# Create Feature Flag Skill

## Purpose

Generate a complete, idempotent **upsert** migration file (`ON CONFLICT ... DO UPDATE` — creates the
flag on first run, updates it in place if the `flag_key` already exists) that registers a feature flag
in `hq_ff_feature_flags_mst` (plus `sys_ff_pln_flag_mappings_dtl` plan mappings when
`plan_binding_type = 'plan_bound'`), then sync the web-admin TypeScript catalog. Keep the active
prompt small; read `reference.md` for the full templates, examples, and troubleshooting.

**Provenance**: this skill was originally copied verbatim from `cleanmatexsaas` (which owns the HQ
feature-flag admin UI/API). It has been corrected here against the live remote DB and the real
`platform-api/src/modules/feature-flags/` service — see `CHANGELOG.md` for what changed and why.

## Operating Rules

- Do not use subagents unless explicitly requested.
- Do not scan the whole repo.
- Treat the **remote** Supabase DB as authoritative for schema/uniqueness checks (`supabase_remote_db`
  MCP) — the local dev DB is minimal and unrepresentative.
- Flag keys are flat **snake_case**, no dots (e.g. `erp_lite_gl_enabled`) — matches 100% of existing
  flags in `hq_ff_feature_flags_mst` and `web-admin/lib/constants/feature-flags.ts`.
- Plan codes are uppercase real codes from `sys_pln_subscription_plans_mst`: `FREE_TRIAL`, `STARTER`,
  `GROWTH`, `PRO`, `ENTERPRISE` — never lowercase.
- **NEVER apply the migration** (CRITICAL RULE #3) — create the `.sql` file, then STOP and ask the user
  to review and apply.
- Modify only files required by the task.
- Keep output concise.

## Workflow

```text
1. Gather flag requirements (key, name/desc EN+AR, governance, data type, plan binding, behavior flags).
2. Validate against the remote DB: flag_key uniqueness, plan_code existence.
3. Detect next migration number (supabase/migrations/, highest {NNNN} + 1).
4. Generate the migration file (flag definition + plan mappings if plan_bound) — see reference.md Step 4.
5. Save to supabase/migrations/{NNNN}_add_feature_flag_{flag_key}.sql. STOP — do not apply.
5a. Generate a rollback script under cleanmatexsaas/docs/Added_Feature_Flags_docs/Rollback_Scripts/.
5b. REQUIRED: after the user confirms the migration is applied, sync FLAG_CATALOG in
    web-admin/lib/constants/feature-flags.ts — this is not covered by "no type regen needed".
6. Generate a doc under cleanmatexsaas/docs/Added_Feature_Flags_docs/{flag_key}_README.md.
7. Report files changed, validation results, and risks.
```

## Detailed Reference

Full workflow, SQL templates, worked examples, placeholder table, and troubleshooting are in:

```text
reference.md
```

Read it before generating any migration SQL — the templates there are the source of truth, not this file.

## Final Response Contract

```text
- Summary
- Files changed (migration path, rollback path, doc path, FLAG_CATALOG diff)
- Validation result (flag_key uniqueness check, plan_code check)
- Risks / follow-ups (e.g. FLAG_CATALOG sync still pending user's migration apply)
```
