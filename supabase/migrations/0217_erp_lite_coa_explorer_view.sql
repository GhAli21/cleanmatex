-- ==================================================================
-- Migration: 0217_erp_lite_coa_explorer_view.sql
-- Purpose: Add derived COA explorer view with enriched columns.
--          Closes DELTA-OPS-004.
--
-- Why: The raw org_fin_acct_mst table exposes only FK IDs for account
-- type, group, and parent. The COA screen (web-admin) currently joins
-- multiple tables client-side or does N+1 lookups. This view pre-joins
-- and derives the columns the COA Explorer UI needs, including:
--   - Human-readable account type name/code
--   - Human-readable account group name
--   - Parent account code + name (one level)
--   - Full ancestry path string: "Assets > Current Assets > Cash"
--   - Derived status label: ACTIVE, INACTIVE, NOT_POSTABLE, SYSTEM_LOCKED
--   - Usage-mapping count (how many active usage codes point to this account)
--
-- The COA Explorer screen uses this view for:
--   - List / search with filters (type, postable, active, system-linked)
--   - Tree/grid mode toggle (account_level, parent_account_code)
--   - Protected account guardrails (is_system_linked, is_control_account)
--   - Usage map badge (active_usage_map_count > 0)
--
-- This is a read-only view — no DML side effects.
-- No new tables are created in this migration.
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- View: vw_fin_coa_explorer
-- COA Explorer enriched view per tenant.
-- Tenant-scoped via org_fin_acct_mst.tenant_org_id.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_fin_coa_explorer AS
WITH RECURSIVE
-- Recursive CTE: build the full ancestry path for each account.
-- path_str: "Level1 Name > Level2 Name > ... > Account Name"
account_path AS (
  -- anchor: root accounts (no parent)
  SELECT
    a.id,
    a.tenant_org_id,
    a.name::TEXT                                AS path_str,
    COALESCE(a.name2, a.name)::TEXT             AS path_str2
  FROM public.org_fin_acct_mst a
  WHERE a.parent_account_id IS NULL
    AND a.rec_status = 1

  UNION ALL

  -- recursive: append child name to parent path
  SELECT
    c.id,
    c.tenant_org_id,
    p.path_str || ' > ' || c.name              AS path_str,
    p.path_str2 || ' > ' || COALESCE(c.name2, c.name) AS path_str2
  FROM public.org_fin_acct_mst c
  JOIN account_path p
    ON  p.id            = c.parent_account_id
    AND p.tenant_org_id = c.tenant_org_id
  WHERE c.rec_status = 1
),
-- Active usage-map count per account
usage_map_counts AS (
  SELECT
    tenant_org_id,
    account_id,
    COUNT(*) AS active_usage_map_count
  FROM public.org_fin_usage_map_mst
  WHERE status_code = 'ACTIVE'
    AND is_active   = true
    AND rec_status  = 1
    AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
    AND (effective_to   IS NULL OR effective_to   >= CURRENT_DATE)
  GROUP BY tenant_org_id, account_id
)
SELECT
  -- account identity
  a.id                                            AS account_id,
  a.tenant_org_id,
  a.account_code,
  a.name,
  a.name2,
  a.description,
  a.description2,

  -- hierarchy
  a.parent_account_id,
  pa.account_code                                 AS parent_account_code,
  pa.name                                         AS parent_account_name,
  pa.name2                                        AS parent_account_name2,
  COALESCE(a.account_level, 0)                    AS account_level,
  ap.path_str                                     AS full_path,
  ap.path_str2                                    AS full_path2,

  -- type
  a.acc_type_id,
  at.acc_type_code,
  at.name                                         AS acc_type_name,
  at.name2                                        AS acc_type_name2,
  at.normal_balance                               AS normal_balance_side,

  -- group
  a.acc_group_id,
  ag.name                                         AS acc_group_name,
  ag.name2                                        AS acc_group_name2,

  -- posting controls
  a.is_postable,
  a.is_control_account,
  a.is_system_linked,
  a.manual_post_allowed,
  COALESCE(a.is_system_seeded, false)             AS is_system_seeded,
  COALESCE(a.is_locked, false)                    AS is_locked,
  COALESCE(a.allow_tenant_children, true)         AS allow_tenant_children,

  -- effective dates
  a.effective_from,
  a.effective_to,

  -- derived status label (single canonical tag for UI badge)
  CASE
    WHEN a.is_active = false OR a.rec_status <> 1                THEN 'INACTIVE'
    WHEN COALESCE(a.is_locked, false) = true                     THEN 'SYSTEM_LOCKED'
    WHEN a.is_postable = false                                   THEN 'NOT_POSTABLE'
    WHEN a.effective_to IS NOT NULL AND a.effective_to < CURRENT_DATE THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END                                             AS account_status,

  -- usage map linkage
  COALESCE(umc.active_usage_map_count, 0)         AS active_usage_map_count,

  -- template lineage
  a.source_tpl_pkg_id,
  a.source_tpl_line_id,

  -- standard audit
  a.is_active,
  a.rec_status,
  a.created_at,
  a.created_by,
  a.updated_at,
  a.updated_by

FROM public.org_fin_acct_mst a

  -- type name
  LEFT JOIN public.sys_fin_acc_type_cd at
    ON at.acc_type_id = a.acc_type_id

  -- group name
  LEFT JOIN public.sys_fin_acc_group_cd ag
    ON ag.acc_group_id = a.acc_group_id

  -- parent account code + name (one level up only)
  LEFT JOIN public.org_fin_acct_mst pa
    ON  pa.id            = a.parent_account_id
    AND pa.tenant_org_id = a.tenant_org_id

  -- full ancestry path
  LEFT JOIN account_path ap
    ON  ap.id            = a.id
    AND ap.tenant_org_id = a.tenant_org_id

  -- active usage map count
  LEFT JOIN usage_map_counts umc
    ON  umc.account_id    = a.id
    AND umc.tenant_org_id = a.tenant_org_id

WHERE a.rec_status = 1;

COMMENT ON VIEW public.vw_fin_coa_explorer IS
  'Enriched COA explorer view for the tenant Chart of Accounts screen. '
  'Pre-joins account type, group, parent, and derives the full ancestry '
  'path and account_status label. active_usage_map_count shows how many '
  'active usage-code mappings point to this account (protected account '
  'guardrail). Used by COA Explorer list, tree mode, and protected-account '
  'badge logic.';

COMMIT;
