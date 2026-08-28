# Changelog: `/create-feature-flag` Skill

## [1.3.0] - 2026-07-24

### 🔁 Migration now upserts instead of no-op'ing on conflict

Both `INSERT` statements in the generated migration (flag definition into `hq_ff_feature_flags_mst`,
plan mappings into `sys_ff_pln_flag_mappings_dtl`) changed from `ON CONFLICT ... DO NOTHING` to
`ON CONFLICT ... DO UPDATE SET ...`, per explicit request. If `flag_key` (or `plan_code, flag_key`)
already exists, the migration now updates that row's content columns in place instead of silently
skipping it.

- **Preserved on conflict** (not overwritten): `created_at`, `created_by`, `created_info`, `rec_status`,
  `is_active` on both tables — this keeps the original creation audit trail intact and avoids a
  content-only migration accidentally reactivating a flag/mapping that was soft-deleted via the HQ
  admin console.
- **Refreshed on conflict**: all other content columns (name/description, governance, data type,
  default value, plan binding, override controls, UI fields; `plan_specific_value`/`is_enabled`/`notes`
  for mappings), plus `updated_at`/`updated_by`/`updated_info` (newly set to record the update).
- Section 1's validation guard no longer `RETURN`s early when the flag exists (that would have skipped
  the now-desired update) — it just logs an informational notice that the row will be updated.
- Step 2's Decision Logic changed from "flag_key exists → STOP" to "flag_key exists → confirm the
  update is intentional, then proceed" — the upsert makes this a normal, safe path rather than an error.
- Troubleshooting's "duplicate key value violates unique constraint" entry rewritten — that error no
  longer occurs for this template; the real risk is accidentally upserting into an unrelated existing
  flag_key, so the entry now tells you to check what's stored before proceeding.

## [1.2.0] - 2026-07-24

### 🚨 Corrected after copy from `cleanmatexsaas`

This skill was copied verbatim from `cleanmatexsaas/.claude/skills/create-feature-flag/SKILL.md` (the
project that owns the HQ feature-flag admin UI/API). It was then restructured into this repo's
multi-file skill convention (thin `SKILL.md` + `reference.md` + this changelog, matching
`add-setting-db`) and verified against the **live remote DB** and the real
`platform-api/src/modules/feature-flags/` service in `cleanmatexsaas`. Verification surfaced two real
bugs and one real gap in the copied content:

**Bug fixes**:
- ❌ **Flag key format was wrong.** The copied skill instructed dot-namespaced keys
  (`feature.advanced_workflows`, `tenant_limit.max_branches`). Every real flag in
  `hq_ff_feature_flags_mst` and in `web-admin/lib/constants/feature-flags.ts` (100+ entries, including
  the two real migrations `0376`/`0377`) uses flat snake_case with zero dots
  (`customer_receipt_allocation_v1`, `erp_lite_gl_enabled`, …). Fixed to require flat snake_case.
- ❌ **Plan codes were wrong.** The copied skill's examples used lowercase `free`, `starter`, `growth`,
  `pro`, `enterprise`. The real `sys_pln_subscription_plans_mst` table has `FREE_TRIAL`, `STARTER`,
  `GROWTH`, `PRO`, `ENTERPRISE` (uppercase, and `FREE_TRIAL` not `free`). Following the old Example B
  literally would have failed the skill's own plan-code validation step. Fixed all templates/examples
  to the real codes.
- ⚠️ **Verification pointed at local Supabase Studio only.** Per this project's established practice
  (local dev DB has minimal, unrepresentative data), Prerequisites and Step 2 now point at the remote
  DB via `supabase_remote_db` MCP as authoritative; local Studio is for applying/previewing only.

**New (previously missing) step**:
- ✅ **Step 5b: sync `web-admin/lib/constants/feature-flags.ts`.** The copied skill's final "Next
  Steps" said "No type regeneration needed" and stopped there — true for Postgres/Prisma types, but it
  omitted that `FLAG_CATALOG` in `web-admin/lib/constants/feature-flags.ts` is the TypeScript mirror of
  `hq_ff_feature_flags_mst` (per that file's own header comment) and must be updated for the new flag to
  be usable/typed in the tenant app. Added as a required step, referencing the existing
  `scripts/extract-flag-catalog.js` / `scripts/generate-flag-catalog.js` regeneration scripts.

**Structure change**:
- Split the single copied `SKILL.md` into a thin `SKILL.md` (Purpose, Operating Rules, Workflow
  overview, Final Response Contract) + `reference.md` (full templates, worked examples, placeholder
  table, troubleshooting) — matching the `add-setting-db` skill's file layout in this repo.

**Left unchanged (verified correct as originally copied)**:
- Governance category enum, data type enum, plan binding type enum — all match the real DB CHECK
  constraints (`hq_feature_flags_mst_governance_category_check`, `..._data_type_check`,
  `..._plan_binding_type_check`).
- Migration ownership split (migration file in `cleanmatex`, rollback script + doc in
  `cleanmatexsaas/docs/Added_Feature_Flags_docs/`) — intentional per
  `docs/dev/rules/integration-contracts.md` (`cleanmatex` always owns migrations; `cleanmatexsaas` owns
  the flag governance/admin docs trail).
- `ON CONFLICT DO NOTHING` idempotency pattern, verification `DO $$` blocks, rollback template shape.

---

## [1.1.0] / [1.0.0] - 2026-06-18 (as copied from cleanmatexsaas)

- Initial skill: migration template, plan mappings, bilingual doc generation, rollback script moved to
  a dedicated file under `Rollback_Scripts/`.
