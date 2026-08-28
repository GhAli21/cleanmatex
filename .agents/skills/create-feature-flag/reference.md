# create-feature-flag — Full Reference (v1.3.0)

**Purpose**: Add a new feature flag to the CleanMateX platform via a migration file.

This is the detailed reference for the `/create-feature-flag` skill. `SKILL.md` is the thin entry
point — read this file whenever you need the actual templates, examples, or troubleshooting.

---

## Overview

This skill generates a complete, idempotent **upsert** migration file (`ON CONFLICT ... DO UPDATE` —
creates on first run, updates in place on any re-run or later edit) that writes into:

- `hq_ff_feature_flags_mst` — global flag definition **(REQUIRED)**
- `sys_ff_pln_flag_mappings_dtl` — per-plan value/enable mappings **(required when `plan_binding_type = 'plan_bound'`)**

It also updates the web-admin TypeScript mirror of the catalog and never applies migrations automatically.

**Ownership note**: per `docs/dev/rules/integration-contracts.md`, `cleanmatex` always owns migrations —
even though `cleanmatexsaas` owns the HQ admin UI/API for managing flags day-to-day. That's why this
migration is authored here, while the flag's documentation/rollback trail lives in `cleanmatexsaas`
(the platform HQ project), matching how `docs/features/Order_Fin/technical_docs/fin_feature_flags_seed.sql`
already documents flags there.

---

## Prerequisites

- [ ] You have read access to the **remote** Supabase DB via whichever remote Supabase MCP server your
      harness exposes (in this repo: `supabase_remote_db` for Claude Code, `supabase_remote` for Codex —
      see each tool's config) — treat it as authoritative. The local dev DB (`http://localhost:54323`)
      has minimal, unrepresentative data; use it only to apply/preview the migration locally, never to
      validate flag_key/plan_code uniqueness.
- [ ] You know which governance category and plan binding type apply
- [ ] You have checked for a duplicate `flag_key` in `hq_ff_feature_flags_mst` (remote)
- [ ] Plans referenced in plan mappings exist in `sys_pln_subscription_plans_mst` (remote)

---

## Workflow

### Step 1: Gather Requirements

Ask the user for the following:

**Required**:

1. **Flag Key** — lowercase, flat **snake_case**, no dots.
   Format: `{domain}_{feature}[_v{n}]`
   Examples: `customer_receipt_allocation_v1`, `erp_lite_gl_enabled`, `order_fin_refund_ui`
   Must be unique in `hq_ff_feature_flags_mst`.
   > Every existing flag in the DB and in `web-admin/lib/constants/feature-flags.ts` (100+ entries)
   > uses this flat snake_case form — none use dot-namespacing (`domain.feature`). Do not introduce dots.

2. **Flag Name (EN)** — clear, user-facing name
   Example: `Customer Receipt Allocation`

3. **Flag Name (AR)** — Arabic translation (`flag_name2`)
   Example: `تخصيص إيصال العميل`

4. **Flag Description (EN)** — what this flag controls (`flag_description`)
5. **Flag Description (AR)** — Arabic description (`flag_description2`)

6. **Governance Category** — choose one (DB CHECK constraint `hq_feature_flags_mst_governance_category_check`):
   - `tenant_feature` — standard tenant-facing feature
   - `tenant_limit` — a numeric/quota limit per tenant
   - `hq_feature` — internal HQ-only feature
   - `hq_config` — HQ configuration parameter
   - `experimental` — unstable, not for production tenants
   - `beta` — stable but early-access

7. **Data Type** — choose one (DB CHECK constraint `hq_feature_flags_mst_data_type_check`):
   - `boolean` — on/off toggle
   - `integer` — whole number (e.g., max branches)
   - `float` — decimal number
   - `string` — text value
   - `number` — alias for numeric
   - `date` / `datetime`
   - `object` — JSON object
   - `array` — JSON array

8. **Default Value** — JSONB-safe default
   Examples: `true`, `false`, `10`, `"standard"`, `["a","b"]`, `{"limit":5}`

9. **Plan Binding Type** (DB CHECK constraint `hq_feature_flags_mst_plan_binding_type_check`):
   - `independent` — flag applies equally to all plans (or HQ-only)
   - `plan_bound` — different value/enablement per plan → must add plan mappings

10. **Behavior Flags**:
    - `is_billable` — tied to paid plan or add-on? (default `false`)
    - `is_kill_switch` — can HQ globally disable this? (default `false`)
    - `is_sensitive` — hide from tenant UI, HQ-only display? (default `false`)
    - `allows_tenant_override` — can tenants override value? (default `true`)
    - `override_requires_approval` — needs HQ approval for override? (default `false`)

11. **Validation Rules** (optional, JSONB `validation_rules`):
    - Boolean: `'[]'::jsonb`
    - Number: `{"min": 1, "max": 100}`
    - String with options: `{"enum": ["opt1", "opt2"]}`
    - Array: `{"minItems": 1, "maxItems": 10}`

12. **Allowed Values** (optional JSONB array, `allowed_values`):
    `["standard", "premium", "enterprise"]` or `NULL`

13. **UI Group** — logical grouping in UI (`ui_group`)
    Examples: `Order Processing`, `Finance`, `Billing Features`, `ERP-Lite`

14. **UI Display Order** — integer sort order (`ui_display_order`, default `0`)

15. **Plan Mappings** (only when `plan_binding_type = 'plan_bound'`):
    For each plan: `plan_code`, `is_enabled`, `plan_specific_value` (or `NULL`)
    **Real plan codes** (verified in `sys_pln_subscription_plans_mst`, uppercase):
    `FREE_TRIAL`, `STARTER`, `GROWTH`, `PRO`, `ENTERPRISE`
    > Do not use lowercase (`free`, `starter`, …) — those rows do not exist and the plan-code
    > validation in Step 2 will correctly reject them.

**Optional extended columns** (nullable — omit unless the flag needs them):
`min_value`, `max_value`, `json_schema`, `comp_code`, `ui_icon`, `ui_color`.

---

### Step 2: Validate Prerequisites

Run these read-only queries against the **remote** DB (via your harness's remote Supabase MCP execute-SQL
tool) before generating the migration:

```sql
-- 1. Check flag_key uniqueness (MUST be unique)
SELECT flag_key, flag_name, governance_category
FROM hq_ff_feature_flags_mst
WHERE flag_key = '<FLAG_KEY>';
-- Expected: 0 rows

-- 2. Verify plan codes exist (when plan_bound)
SELECT plan_code, plan_name
FROM sys_pln_subscription_plans_mst
WHERE plan_code IN ('FREE_TRIAL','STARTER','GROWTH','PRO','ENTERPRISE');
-- Expected: 5 rows (or the subset you're mapping)
```

**Decision Logic**:
- ℹ️ `flag_key` already exists → not fatal. The generated migration UPSERTs (`ON CONFLICT ... DO UPDATE`),
  so re-running it, or targeting an existing key on purpose, safely updates that flag's config instead of
  erroring or silently no-op'ing. Confirm with the user that overwriting the existing flag's values is
  intentional before proceeding — if it isn't, pick a different key.
- ❌ Plan code missing → STOP, list available plans (`SELECT plan_code, plan_name FROM sys_pln_subscription_plans_mst`) and confirm with the user

---

### Step 3: Detect Next Migration Number

```bash
ls -1 supabase/migrations/ | grep -E '^[0-9]{4}_' | sort -n | tail -1
# Increment the number by 1
```

Migration filename format:
`{NNNN}_add_feature_flag_{flag_key}.sql`

Example: latest is `0429_...` → flag key `customer_notification_prefs_v1` →
`0430_add_feature_flag_customer_notification_prefs_v1.sql`

---

### Step 4: Generate Migration SQL

Use this complete template. Replace all `{PLACEHOLDERS}`.

```sql
-- ================================================================
-- Migration: Add Feature Flag — {FLAG_KEY}
-- ================================================================
-- Purpose     : {BRIEF_PURPOSE}
-- Governance  : {GOVERNANCE_CATEGORY}
-- Data Type   : {DATA_TYPE}
-- Plan Binding: {PLAN_BINDING_TYPE}
--
-- Created     : {CURRENT_DATE}
-- Created by  : {CREATED_BY}
-- Migration   : {MIGRATION_FILE}
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   {PLAN_MAPPINGS_COMPONENT_STATUS}
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  -- Informational only: flag may already exist — Section 2 UPSERTs, it does not skip.
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = '{FLAG_KEY}'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: {FLAG_KEY} — this migration will UPDATE it in place';
  END IF;

  {PLAN_CODE_VALIDATION_SQL}

  RAISE NOTICE '✅ Prerequisites validated for: {FLAG_KEY}';
END $$;

-- ================================================================
-- SECTION 2: FLAG DEFINITION
-- ================================================================

INSERT INTO hq_ff_feature_flags_mst (
  -- Identity
  flag_key,
  flag_name,
  flag_name2,
  flag_description,
  flag_description2,

  -- Governance
  governance_category,
  is_billable,
  is_kill_switch,
  is_sensitive,

  -- Validation
  allowed_values,
  validation_rules,

  -- Data
  data_type,
  default_value,

  -- Plan integration
  plan_binding_type,
  enabled_plan_codes,

  -- Override control
  allows_tenant_override,
  override_requires_approval,

  -- UI
  ui_group,
  ui_display_order,

  -- Audit
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Identity
  '{FLAG_KEY}',
  '{FLAG_NAME_EN}',
  '{FLAG_NAME_AR}',
  '{FLAG_DESC_EN}',
  '{FLAG_DESC_AR}',

  -- Governance
  '{GOVERNANCE_CATEGORY}',
  {IS_BILLABLE},
  {IS_KILL_SWITCH},
  {IS_SENSITIVE},

  -- Validation
  {ALLOWED_VALUES}::jsonb,     -- NULL or '["opt1","opt2"]'::jsonb
  {VALIDATION_RULES}::jsonb,   -- '[]'::jsonb or '{"min":1,"max":100}'::jsonb

  -- Data
  '{DATA_TYPE}',
  {DEFAULT_VALUE}::jsonb,

  -- Plan integration
  '{PLAN_BINDING_TYPE}',
  {ENABLED_PLAN_CODES}::jsonb, -- '[]'::jsonb or '["STARTER","PRO"]'::jsonb

  -- Override control
  {ALLOWS_TENANT_OVERRIDE},
  {OVERRIDE_REQUIRES_APPROVAL},

  -- UI
  '{UI_GROUP}',
  {UI_DISPLAY_ORDER},

  -- Audit
  CURRENT_TIMESTAMP,
  '{CREATED_BY}',
  'Migration: {MIGRATION_FILE}',
  1,
  true
)
ON CONFLICT (flag_key) DO UPDATE SET
  -- Content columns are refreshed on every run (upsert). created_at/created_by/created_info,
  -- rec_status, and is_active are intentionally NOT overwritten — this preserves the original
  -- creation audit trail and any soft-delete/reactivation state set later via the HQ admin console.
  flag_name                  = EXCLUDED.flag_name,
  flag_name2                 = EXCLUDED.flag_name2,
  flag_description           = EXCLUDED.flag_description,
  flag_description2          = EXCLUDED.flag_description2,
  governance_category        = EXCLUDED.governance_category,
  is_billable                = EXCLUDED.is_billable,
  is_kill_switch              = EXCLUDED.is_kill_switch,
  is_sensitive                = EXCLUDED.is_sensitive,
  allowed_values              = EXCLUDED.allowed_values,
  validation_rules            = EXCLUDED.validation_rules,
  data_type                   = EXCLUDED.data_type,
  default_value               = EXCLUDED.default_value,
  plan_binding_type           = EXCLUDED.plan_binding_type,
  enabled_plan_codes          = EXCLUDED.enabled_plan_codes,
  allows_tenant_override      = EXCLUDED.allows_tenant_override,
  override_requires_approval  = EXCLUDED.override_requires_approval,
  ui_group                    = EXCLUDED.ui_group,
  ui_display_order            = EXCLUDED.ui_display_order,
  updated_at                  = CURRENT_TIMESTAMP,
  updated_by                  = '{CREATED_BY}',
  updated_info                = 'Migration: {MIGRATION_FILE}';
-- Upsert: creates the flag on first run, updates it in place on any re-run or later migration
-- that targets the same flag_key.

-- Verify insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = '{FLAG_KEY}'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: {FLAG_KEY}';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: {FLAG_KEY}';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS (only when plan_binding_type = plan_bound)
-- ================================================================

{PLAN_MAPPINGS_SQL}

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists    BOOLEAN;
  v_mapping_count  INTEGER := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = '{FLAG_KEY}'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = '{FLAG_KEY}';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: {FLAG_KEY}';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies: supabase migration up (or reviews via remote MCP apply_migration)';
  RAISE NOTICE '  2. Verify on the REMOTE db (authoritative) — local Studio has unrepresentative data';
  RAISE NOTICE '  3. No Postgres type regeneration needed — data-only insert, not a schema change';
  RAISE NOTICE '  4. Sync web-admin/lib/constants/feature-flags.ts (FLAG_CATALOG) — see Step 5b, REQUIRED';
  RAISE NOTICE '  5. Test flag resolution via hq_ff_get_effective_value()';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = '{FLAG_KEY}';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = '{FLAG_KEY}';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = '{FLAG_KEY}'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
```

---

### Step 4a: Plan Mappings SQL Block (when `plan_binding_type = 'plan_bound'`)

Replace `{PLAN_MAPPINGS_SQL}` with (real plan codes, uppercase):

```sql
INSERT INTO sys_ff_pln_flag_mappings_dtl (
  id,
  plan_code,
  flag_key,
  plan_specific_value,
  is_enabled,
  notes,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  (gen_random_uuid(), 'FREE_TRIAL', '{FLAG_KEY}', {VALUE_FREE_TRIAL}::jsonb, {ENABLED_FREE_TRIAL}, 'Enabled by default', CURRENT_TIMESTAMP, '{CREATED_BY}', 'Migration: {MIGRATION_FILE}', 1, true),
  (gen_random_uuid(), 'STARTER',    '{FLAG_KEY}', {VALUE_STARTER}::jsonb,    {ENABLED_STARTER},    'Enabled by default', CURRENT_TIMESTAMP, '{CREATED_BY}', 'Migration: {MIGRATION_FILE}', 1, true),
  (gen_random_uuid(), 'GROWTH',     '{FLAG_KEY}', {VALUE_GROWTH}::jsonb,     {ENABLED_GROWTH},     'Enabled by default', CURRENT_TIMESTAMP, '{CREATED_BY}', 'Migration: {MIGRATION_FILE}', 1, true),
  (gen_random_uuid(), 'PRO',        '{FLAG_KEY}', {VALUE_PRO}::jsonb,        {ENABLED_PRO},        'Enabled by default', CURRENT_TIMESTAMP, '{CREATED_BY}', 'Migration: {MIGRATION_FILE}', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', '{FLAG_KEY}', {VALUE_ENTERPRISE}::jsonb, {ENABLED_ENTERPRISE}, 'Enabled by default', CURRENT_TIMESTAMP, '{CREATED_BY}', 'Migration: {MIGRATION_FILE}', 1, true)
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled          = EXCLUDED.is_enabled,
  notes               = EXCLUDED.notes,
  updated_at          = CURRENT_TIMESTAMP,
  updated_by          = EXCLUDED.created_by,
  updated_info        = EXCLUDED.created_info;
-- Upsert: same pattern as the flag definition above — id/created_*/rec_status/is_active are
-- preserved on conflict, only the mapping's value/enablement/notes are refreshed.

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = '{FLAG_KEY}';
  RAISE NOTICE '✅ Plan mappings created: % rows', v_count;
END $$;
```

Only include the plan rows the user actually wants gated (it doesn't have to be all 5).

When `plan_binding_type = 'independent'`, replace `{PLAN_MAPPINGS_SQL}` with:
```sql
-- No plan mappings — flag is independent of plan
```

---

### Step 4b: JSONB Formatting Rules

```sql
-- ✅ CORRECT
default_value = 'true'::jsonb                   -- boolean
default_value = 'false'::jsonb
default_value = '10'::jsonb                     -- integer/number
default_value = '"standard"'::jsonb             -- string (double quotes inside)
default_value = '["a","b","c"]'::jsonb          -- array
default_value = '{"limit": 5}'::jsonb           -- object

-- NULL fields
allowed_values    = NULL
validation_rules  = '[]'::jsonb

-- Plan-specific values
plan_specific_value = NULL                       -- disabled or inherits default
plan_specific_value = '5'::jsonb                -- numeric override
plan_specific_value = 'true'::jsonb             -- boolean override

-- ❌ WRONG
default_value = true                             -- missing ::jsonb
default_value = 'hello'::jsonb                  -- string not quoted: use '"hello"'::jsonb
```

---

### Step 5: Save Migration File

Write the generated SQL to:
```
supabase/migrations/{MIGRATION_FILE}
```

**NEVER apply the migration** (CRITICAL RULE #3 / CLAUDE.md). Stop and hand off to the user for review + apply.

---

### Step 5a: Generate Rollback Script (in cleanmatexsaas)

Write a standalone rollback script to:
```
F:/jhapp/cleanmatexsaas/docs/Added_Feature_Flags_docs/Rollback_Scripts/{ROLLBACK_FILE}
```
where `{ROLLBACK_FILE}` = `{NNNN}_rollback_{FLAG_KEY}.sql`. This mirrors where the sibling project already
keeps flag governance docs (see `docs/features/Order_Fin/technical_docs/` in `cleanmatexsaas`). Create the
`Added_Feature_Flags_docs/Rollback_Scripts/` folder if it does not exist yet — check first (file search /
list-directory tool).

Template:
```sql
-- ================================================================
-- Rollback: Feature Flag — {FLAG_KEY}
-- ================================================================
-- Migration : {MIGRATION_FILE}
-- Created   : {CURRENT_DATE}
-- Created by: {CREATED_BY}
--
-- WARNING: Run this ONLY to undo migration {NNNN}.
--          Do NOT run this if other migrations depend on this flag.
-- ================================================================

DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = '{FLAG_KEY}';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = '{FLAG_KEY}';

DO $$
DECLARE
  v_flag_count    INTEGER;
  v_mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_flag_count    FROM hq_ff_feature_flags_mst       WHERE flag_key = '{FLAG_KEY}';
  SELECT COUNT(*) INTO v_mapping_count FROM sys_ff_pln_flag_mappings_dtl  WHERE flag_key = '{FLAG_KEY}';

  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '🔁 ROLLBACK COMPLETE: {FLAG_KEY}';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition rows : %', v_flag_count;
  RAISE NOTICE '  Plan Mapping rows    : %', v_mapping_count;

  IF v_flag_count > 0 OR v_mapping_count > 0 THEN
    RAISE EXCEPTION 'Rollback incomplete — rows still exist for {FLAG_KEY}';
  END IF;

  RAISE NOTICE '✅ All rows removed successfully';
END $$;
```

> When `plan_binding_type = 'independent'`, omit the `sys_ff_pln_flag_mappings_dtl` delete.

---

### Step 5b: Sync `web-admin/lib/constants/feature-flags.ts` (REQUIRED)

`web-admin/lib/constants/feature-flags.ts` is the single-source-of-truth TypeScript mirror of
`hq_ff_feature_flags_mst` (its own file header says so). Per CLAUDE.md's DB-mirror rule (constants
must mirror DB values exactly), this file **must** be updated whenever a flag is added — it is not
optional, and it is not covered by "no type regeneration needed" (that note only means no Postgres/Prisma
type regen, not this file).

**After the user confirms the migration is applied**, regenerate the catalog:

```bash
# 1. Query the flag row(s) from the remote DB (via MCP execute_sql), save the JSON array result
# 2. node scripts/extract-flag-catalog.js <path-to-saved-json>   → writes scripts/flag-catalog-db.json
# 3. node scripts/generate-flag-catalog.js                       → writes scripts/flag-catalog-ts.txt
# 4. Merge the new entries from flag-catalog-ts.txt into FLAG_CATALOG in
#    web-admin/lib/constants/feature-flags.ts (append, keep alphabetical/grouped ordering as-is)
```

Or, for a single flag, just hand-add one `FlagCatalogEntry` line to `FLAG_CATALOG` matching the exact
values inserted in Section 2 of the migration (`flag_key`, `flag_name`, `plan_binding_type`, `data_type`,
`default_value`, `ui_group`, `governance_category`, `ui_display_order`) — this is what the scripts do
mechanically anyway.

If the flag also needs a typed field on `FeatureFlags` (`lib/types/tenant.ts`) for `FeatureFlagKey` to
pick it up, add it there too.

---

### Step 6: Generate Documentation (in cleanmatexsaas)

Create a markdown doc at:
```
F:/jhapp/cleanmatexsaas/docs/Added_Feature_Flags_docs/{FLAG_KEY}_README.md
```

Template:
```markdown
## Feature Flag: `{FLAG_KEY}`

**Governance**: {GOVERNANCE_CATEGORY}
**Data Type**: {DATA_TYPE}
**Default Value**: {DEFAULT_VALUE}
**Plan Binding**: {PLAN_BINDING_TYPE}
**Created**: {CURRENT_DATE}
**Created by**: {CREATED_BY}
**Migration**: {MIGRATION_FILE}

### Description
{FLAG_DESC_EN}
{FLAG_DESC_AR}

### Behavior
| Property | Value |
|---|---|
| Is Billable | {IS_BILLABLE} |
| Is Kill Switch | {IS_KILL_SWITCH} |
| Is Sensitive | {IS_SENSITIVE} |
| Allows Tenant Override | {ALLOWS_TENANT_OVERRIDE} |
| Override Requires Approval | {OVERRIDE_REQUIRES_APPROVAL} |

### Plan Mappings
{TABLE_OF_PLAN_MAPPINGS or "Independent — same for all plans"}

### Testing
​```sql
SELECT * FROM hq_ff_get_effective_value(p_tenant_id := '<TENANT_UUID>', p_flag_key := '{FLAG_KEY}');
​```

### Changelog
- {CURRENT_DATE}: Created by {CREATED_BY}
```

---

## Common Examples

### Example A — Boolean tenant feature (independent)

```sql
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, validation_rules, data_type, default_value,
  plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'whatsapp_order_notifications_v1',
  'WhatsApp Order Notifications', 'إشعارات الطلبات عبر واتساب',
  'Enable WhatsApp order notifications for tenants',
  'تفعيل إشعارات الطلبات عبر واتساب للمستأجرين',
  'tenant_feature', false, false, false,
  NULL, '[]'::jsonb, 'boolean', 'false'::jsonb,
  'independent', '[]'::jsonb,
  true, false,
  'Notifications', 10,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430_add_feature_flag_whatsapp_order_notifications_v1.sql', 1, true
) ON CONFLICT (flag_key) DO UPDATE SET
  flag_name = EXCLUDED.flag_name, flag_name2 = EXCLUDED.flag_name2,
  flag_description = EXCLUDED.flag_description, flag_description2 = EXCLUDED.flag_description2,
  governance_category = EXCLUDED.governance_category, is_billable = EXCLUDED.is_billable,
  is_kill_switch = EXCLUDED.is_kill_switch, is_sensitive = EXCLUDED.is_sensitive,
  allowed_values = EXCLUDED.allowed_values, validation_rules = EXCLUDED.validation_rules,
  data_type = EXCLUDED.data_type, default_value = EXCLUDED.default_value,
  plan_binding_type = EXCLUDED.plan_binding_type, enabled_plan_codes = EXCLUDED.enabled_plan_codes,
  allows_tenant_override = EXCLUDED.allows_tenant_override,
  override_requires_approval = EXCLUDED.override_requires_approval,
  ui_group = EXCLUDED.ui_group, ui_display_order = EXCLUDED.ui_display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
  updated_info = 'Migration: 0430_add_feature_flag_whatsapp_order_notifications_v1.sql';
```

### Example B — Integer limit (plan_bound)

```sql
-- Flag definition
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, validation_rules, data_type, default_value,
  plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'tenant_limit_max_branches_v1',
  'Max Branches', 'الحد الأقصى للفروع',
  'Maximum number of branches a tenant can create',
  'الحد الأقصى لعدد الفروع التي يمكن للمستأجر إنشاؤها',
  'tenant_limit', true, false, false,
  NULL, '{"min": 1, "max": 9999}'::jsonb, 'integer', '1'::jsonb,
  'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb,
  false, false,
  'Tenant Limits', 5,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430_add_feature_flag_tenant_limit_max_branches_v1.sql', 1, true
) ON CONFLICT (flag_key) DO UPDATE SET
  flag_name = EXCLUDED.flag_name, flag_name2 = EXCLUDED.flag_name2,
  flag_description = EXCLUDED.flag_description, flag_description2 = EXCLUDED.flag_description2,
  governance_category = EXCLUDED.governance_category, is_billable = EXCLUDED.is_billable,
  is_kill_switch = EXCLUDED.is_kill_switch, is_sensitive = EXCLUDED.is_sensitive,
  allowed_values = EXCLUDED.allowed_values, validation_rules = EXCLUDED.validation_rules,
  data_type = EXCLUDED.data_type, default_value = EXCLUDED.default_value,
  plan_binding_type = EXCLUDED.plan_binding_type, enabled_plan_codes = EXCLUDED.enabled_plan_codes,
  allows_tenant_override = EXCLUDED.allows_tenant_override,
  override_requires_approval = EXCLUDED.override_requires_approval,
  ui_group = EXCLUDED.ui_group, ui_display_order = EXCLUDED.ui_display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
  updated_info = 'Migration: 0430_add_feature_flag_tenant_limit_max_branches_v1.sql';

-- Plan mappings
INSERT INTO sys_ff_pln_flag_mappings_dtl (
  id, plan_code, flag_key, plan_specific_value, is_enabled, notes,
  created_at, created_by, created_info, rec_status, is_active
) VALUES
  (gen_random_uuid(), 'FREE_TRIAL', 'tenant_limit_max_branches_v1', '1'::jsonb,  false, 'Not available on trial',   CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430', 1, true),
  (gen_random_uuid(), 'STARTER',    'tenant_limit_max_branches_v1', '3'::jsonb,  true,  'Enabled by default',       CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430', 1, true),
  (gen_random_uuid(), 'GROWTH',     'tenant_limit_max_branches_v1', '10'::jsonb, true,  'Enabled by default',       CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430', 1, true),
  (gen_random_uuid(), 'PRO',        'tenant_limit_max_branches_v1', '50'::jsonb, true,  'Enabled by default',       CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'tenant_limit_max_branches_v1', NULL,        true,  'Unlimited (NULL = no cap)', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0430', 1, true)
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled          = EXCLUDED.is_enabled,
  notes               = EXCLUDED.notes,
  updated_at          = CURRENT_TIMESTAMP,
  updated_by          = EXCLUDED.created_by,
  updated_info        = EXCLUDED.created_info;
```

---

## Placeholder Reference

| Placeholder | Description |
|---|---|
| `{FLAG_KEY}` | Flat snake_case key, e.g. `whatsapp_order_notifications_v1` — no dots |
| `{MIGRATION_FILE}` | Full filename, e.g. `0430_add_feature_flag_whatsapp_order_notifications_v1.sql` |
| `{BRIEF_PURPOSE}` | One-line purpose statement |
| `{FLAG_NAME_EN/AR}` | Bilingual flag name |
| `{FLAG_DESC_EN/AR}` | Bilingual description |
| `{GOVERNANCE_CATEGORY}` | One of the 6 allowed values |
| `{DATA_TYPE}` | One of the 9 allowed data types |
| `{DEFAULT_VALUE}` | JSONB-formatted default |
| `{PLAN_BINDING_TYPE}` | `plan_bound` or `independent` |
| `{ENABLED_PLAN_CODES}` | JSONB array of real plan codes, or `'[]'` |
| `{IS_BILLABLE}` etc. | `true` / `false` |
| `{ALLOWED_VALUES}` | JSONB array or `NULL` |
| `{VALIDATION_RULES}` | JSONB object or `'[]'::jsonb` |
| `{UI_GROUP}` | UI grouping label |
| `{UI_DISPLAY_ORDER}` | Integer |
| `{CREATED_BY}` | `system_admin` or actual user |
| `{CURRENT_DATE}` | ISO date, e.g. `2026-07-24` |
| `{PLAN_CODE_VALIDATION_SQL}` | SQL to check plan codes exist (plan_bound only) |
| `{PLAN_MAPPINGS_SQL}` | Plan mappings INSERT block or empty comment |
| `{PLAN_MAPPINGS_COMPONENT_STATUS}` | `[X] Plan Mappings (sys_ff_pln_flag_mappings_dtl)` or `[ ] Plan Mappings — N/A (independent)` |
| `{ROLLBACK_FILE}` | Rollback filename, e.g. `0430_rollback_whatsapp_order_notifications_v1.sql` |

---

## Troubleshooting

### Flag key already exists — is that an error?
No. The template's `ON CONFLICT (flag_key) DO UPDATE SET ...` means an existing `flag_key` is not a
"duplicate key" error — the migration updates that row's content columns in place instead (see Step 2).
Check what's currently stored before assuming a collision:
```sql
SELECT * FROM hq_ff_feature_flags_mst WHERE flag_key = 'your_flag_key';
```
If the existing row is unrelated to what you're adding, choose a different `flag_key` — upserting into
someone else's flag by accident is the real risk here, not a duplicate-key error.

### "invalid input syntax for type jsonb"
Ensure `::jsonb` cast is present, and string values use inner double quotes:
```sql
'"hello"'::jsonb   -- ✅ correct
'hello'::jsonb     -- ❌ invalid
```

### "new row ... violates check constraint" on governance_category / data_type / plan_binding_type
Value isn't one of the allowed enum strings — see Step 1 items 6/7/9 for the exact allowed lists
(DB CHECK constraints, not just convention).

### Plan code not found / plan mapping silently missing
The plan code is wrong-cased or doesn't exist. List available plans:
```sql
SELECT plan_code, plan_name FROM sys_pln_subscription_plans_mst ORDER BY plan_code;
```
Real codes are `FREE_TRIAL`, `STARTER`, `GROWTH`, `PRO`, `ENTERPRISE` — uppercase, not `free`/`starter`/etc.

### Flag not resolving for tenant
```sql
SELECT * FROM hq_ff_get_effective_value(
  p_tenant_id := '<TENANT_UUID>',
  p_flag_key  := 'your_flag_key'
);
```
Check tenant's plan assignment and whether `org_ff_overrides_cf` has an override.

### Flag exists in DB but web-admin code can't find it
`web-admin/lib/constants/feature-flags.ts` (`FLAG_CATALOG`) wasn't synced — see Step 5b. The migration
alone does not make the flag usable/typed in the tenant app.

---

## Related Skills & References

- **add-setting-db** — add a setting that may depend on this flag via `stng_depends_on_flags`
- **database** — DB architecture guidance, migration conventions
- **i18n** — EN/AR bilingual content rules
- **rebuild-platform-info-inventories** — run `Mode: refresh · surface=feature-flag` after wiring flag
  *enforcement* into code (not needed for just registering the flag)
