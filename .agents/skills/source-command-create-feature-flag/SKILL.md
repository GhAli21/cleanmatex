---
name: "source-command-create-feature-flag"
description: "Migrated source command `create-feature-flag`"
---

# source-command-create-feature-flag

Use this skill when the user asks to run the migrated source command `create-feature-flag`.

## Command Template

# create-feature-flag

When the user asks to add/create a new feature flag:

1. **Use the Create Feature Flag skill** (`.claude/skills/create-feature-flag/SKILL.md`, full detail in
   `.claude/skills/create-feature-flag/reference.md`): gather requirements (flag key, EN/AR name +
   description, governance category, data type, plan binding type, behavior flags, plan mappings).

2. **Validate against the remote DB first** — check `flag_key` uniqueness in `hq_ff_feature_flags_mst`
   and that any plan codes exist in `sys_pln_subscription_plans_mst`. Real plan codes are uppercase:
   `FREE_TRIAL`, `STARTER`, `GROWTH`, `PRO`, `ENTERPRISE` — never lowercase. Flag keys are flat
   snake_case, no dots (e.g. `erp_lite_gl_enabled`) — matches every existing flag.

3. **Generate the migration file** — insert into `hq_ff_feature_flags_mst` (+ `sys_ff_pln_flag_mappings_dtl`
   plan mappings when `plan_binding_type = 'plan_bound'`) using `ON CONFLICT ... DO UPDATE` (upsert:
   creates on first run, updates in place if the key already exists — not `DO NOTHING`).

4. **Save to** `supabase/migrations/{next_seq}_add_feature_flag_{flag_key}.sql`. Never apply it — stop and
   ask the user to review and apply.

5. **Generate a rollback script and doc** under
   `cleanmatexsaas/docs/Added_Feature_Flags_docs/` (Rollback_Scripts/ + `{flag_key}_README.md`) — this
   project owns the migration, `cleanmatexsaas` owns the flag governance/docs trail.

6. **Required follow-up**: after the user confirms the migration is applied, sync
   `web-admin/lib/constants/feature-flags.ts` (`FLAG_CATALOG`) with the new flag's values — a flag that
   only exists in the DB isn't usable/typed in the tenant app until this is done.

See the `feature-flag-migration` rule for the always-on summary of these requirements.

This command is available in chat with /create-feature-flag.
