/**
 * Migration 0261 — Custom Tenant Preference Codes
 *
 * Drops the FK constraints that tie org_service_preference_cf.preference_code
 * and org_packing_preference_cf.packing_pref_code to their sys_* catalog tables.
 *
 * After this migration tenants can create custom preference codes
 * (is_system_code = false) that have no corresponding platform catalog entry.
 * Application-level validation still prevents accidental invalid inserts for
 * system codes; the FK drop is scoped to enabling the custom-code path only.
 *
 * Affected tables:
 *   org_service_preference_cf   — preference_code FK removed
 *   org_packing_preference_cf   — packing_pref_code FK removed
 *
 * No data change; no RLS change; no index change.
 */

-- Drop FK: org_service_preference_cf.preference_code → sys_service_preference_cd(code)
ALTER TABLE org_service_preference_cf
  DROP CONSTRAINT IF EXISTS org_service_preference_cf_preference_code_fkey;

-- Drop FK: org_packing_preference_cf.packing_pref_code → sys_packing_preference_cd(code)
ALTER TABLE org_packing_preference_cf
  DROP CONSTRAINT IF EXISTS org_packing_preference_cf_packing_pref_code_fkey;
