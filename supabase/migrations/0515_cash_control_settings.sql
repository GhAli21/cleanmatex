-- =============================================================================
-- Migration 0515 — Cash-control settings (Wave 0, POS Session & Cash Drawer
-- Hardening, package §3.1 of
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md)
--
-- Creates org_fin_cash_ctrl_stng_cf: one row per (tenant, scope_level, scope_id)
-- holding the 13 tenant-configurable cash-control policy settings (D1, D2, D16,
-- and the drawer-custody / POS-session settings in §3.1.4). Every column is
-- nullable — NULL means "not set at this scope, inherit down the chain
-- DRAWER -> USER -> BRANCH -> TENANT -> TypeScript default"
-- (lib/constants/cash-control.ts, §3.1.3). The table stores overrides only and
-- ships with zero rows by design (§10.12) — a tenant with no row is fully
-- configured via defaults.
--
-- Decisions this migration implements: D1 (blind close), D2/D5 (variance gate
-- mode, WARN_ONLY), D3 (dedicated table, not sys_tenant_settings_cd — see
-- ADR-055, W0-2b), D4 (explicit typed columns, not code/value rows), D16
-- (cash-change rounding is tenant policy; tender rounding stays HQ-owned).
--
-- Naming: org_fin_cash_ctrl_stng_cf is 25 chars (limit 30); "stng" is the
-- established house abbreviation for "setting" (sys_stng_profiles_mst,
-- fn_stng_resolve_all_settings). Derived object names use the abbreviation
-- "ofccs" (org_fin_cash_ctrl_stng), since the conventional
-- tenant_isolation_<table> policy name would be 42 chars here.
--
-- uuid_nil(): a read-only MCP session showed it resolvable (schema
-- "extensions", on that session's search_path), but `supabase db push`
-- runs the migration under a different role/search_path where
-- extensions.uuid_nil() is NOT resolvable unqualified — confirmed by an
-- actual failed apply attempt (SQLSTATE 42883). Per the plan's documented
-- fallback (§3.1.6 W0-1), the unique expression index below uses the
-- explicit sentinel UUID '00000000-0000-0000-0000-000000000000' instead,
-- which has no extension/search_path dependency at all.
--
-- No seed rows (§10.12 explicitly calls this out): defaults live in
-- lib/constants/cash-control.ts, never in the DB.
--
-- Reversal (forward-only; this repo forbids editing applied migrations):
-- a future migration would DROP INDEX uq_ofccs_scope, DROP POLICY
-- pol_ofccs_tenant, then DROP TABLE org_fin_cash_ctrl_stng_cf RESTRICT.
-- Lossy only if override rows have been written by then — every value in
-- this table is a policy override with a TypeScript default fallback, so
-- the loss is "tenants revert to default behaviour", not data loss of
-- anything computed from money.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_cash_ctrl_stng_cf (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                 UUID NOT NULL
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,

  -- scope: which level of the DRAWER -> USER -> BRANCH -> TENANT chain
  -- this row overrides
  scope_level                   TEXT NOT NULL,
  scope_id                      UUID NULL,

  -- drawer close controls
  blind_close_enabled           BOOLEAN NULL,
  variance_gate_mode            TEXT NULL,
  variance_threshold_amount     DECIMAL(19, 4) NULL,
  variance_reason_amount        DECIMAL(19, 4) NULL,
  variance_tolerance_amount     DECIMAL(19, 4) NULL,
  cash_tracking_mode            TEXT NULL,
  opening_count_mode            TEXT NULL,
  closing_count_mode            TEXT NULL,

  -- cash-change rounding policy (D16) — who absorbs the un-tenderable
  -- fraction of change; tender-side rounding is HQ-owned and not here
  cash_change_bearer            TEXT NULL,
  cash_change_round_to_minor    INTEGER NULL,

  -- drawer custody controls
  drawer_assignment_mode        TEXT NULL,
  shared_session_mode           TEXT NULL,
  max_cash_enforce_mode         TEXT NULL,
  cash_drop_requires_dest       BOOLEAN NULL,

  -- POS session controls
  pos_session_req_for_cash      BOOLEAN NULL,
  pos_session_req_all_tenders   BOOLEAN NULL,
  pos_session_rollover_mode     TEXT NULL,
  pos_session_stale_hours       INTEGER NULL,
  shift_z_report_required       BOOLEAN NULL,

  -- standard tail
  metadata                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                    TEXT NULL,
  created_info                  TEXT NULL,
  updated_at                    TIMESTAMPTZ NULL,
  updated_by                    TEXT NULL,
  updated_info                  TEXT NULL,
  rec_status                    SMALLINT NOT NULL DEFAULT 1,
  rec_order                     INTEGER NULL,
  rec_notes                     TEXT NULL,
  is_active                     BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_ofccs_scope
    CHECK ((scope_level = 'TENANT' AND scope_id IS NULL)
           OR (scope_level <> 'TENANT' AND scope_id IS NOT NULL)),

  CONSTRAINT chk_ofccs_scope_level
    CHECK (scope_level IN ('TENANT', 'BRANCH', 'USER', 'DRAWER')),

  CONSTRAINT chk_ofccs_variance_gate
    CHECK (variance_gate_mode IS NULL
           OR variance_gate_mode IN ('OFF', 'WARN_ONLY', 'APPROVAL_REQUIRED')),

  CONSTRAINT chk_ofccs_tracking
    CHECK (cash_tracking_mode IS NULL
           OR cash_tracking_mode IN ('TOTAL_ONLY', 'COUNT_BY_DENOMINATION',
                                      'FULL_DENOMINATION_TRACKING')),

  CONSTRAINT chk_ofccs_open_count
    CHECK (opening_count_mode IS NULL
           OR opening_count_mode IN ('TOTAL_ONLY', 'OPTIONAL_DENOMINATION',
                                      'DENOMINATION')),

  CONSTRAINT chk_ofccs_close_count
    CHECK (closing_count_mode IS NULL
           OR closing_count_mode IN ('TOTAL_ONLY', 'OPTIONAL_DENOMINATION',
                                      'DENOMINATION')),

  CONSTRAINT chk_ofccs_chg_bearer
    CHECK (cash_change_bearer IS NULL
           OR cash_change_bearer IN ('BUSINESS', 'CUSTOMER', 'NEAREST')),

  CONSTRAINT chk_ofccs_chg_incr
    CHECK (cash_change_round_to_minor IS NULL OR cash_change_round_to_minor > 0),

  CONSTRAINT chk_ofccs_assignment
    CHECK (drawer_assignment_mode IS NULL
           OR drawer_assignment_mode IN ('OPEN', 'ASSIGNED_ONLY')),

  CONSTRAINT chk_ofccs_shared_session
    CHECK (shared_session_mode IS NULL
           OR shared_session_mode IN ('SHARED', 'EXCLUSIVE')),

  CONSTRAINT chk_ofccs_max_cash
    CHECK (max_cash_enforce_mode IS NULL
           OR max_cash_enforce_mode IN ('OFF', 'WARN', 'BLOCK')),

  CONSTRAINT chk_ofccs_rollover
    CHECK (pos_session_rollover_mode IS NULL
           OR pos_session_rollover_mode IN ('OFF', 'PAUSE_AT_ROLLOVER',
                                             'FORCE_CLOSE_AT_ROLLOVER')),

  CONSTRAINT chk_ofccs_threshold
    CHECK ((variance_threshold_amount IS NULL OR variance_threshold_amount >= 0)
           AND (variance_reason_amount IS NULL OR variance_reason_amount >= 0)
           AND (variance_tolerance_amount IS NULL OR variance_tolerance_amount >= 0)),

  -- A reason band above the approval band (or a tolerance band above the
  -- reason band) would silently disable the stricter gate, so the three
  -- bands must be non-decreasing wherever more than one is supplied.
  CONSTRAINT chk_ofccs_thr_order
    CHECK (
      (variance_tolerance_amount IS NULL OR variance_reason_amount IS NULL
        OR variance_tolerance_amount <= variance_reason_amount)
      AND (variance_reason_amount IS NULL OR variance_threshold_amount IS NULL
        OR variance_reason_amount <= variance_threshold_amount)
      AND (variance_tolerance_amount IS NULL OR variance_threshold_amount IS NULL
        OR variance_tolerance_amount <= variance_threshold_amount)
    ),

  CONSTRAINT chk_ofccs_stale_hours
    CHECK (pos_session_stale_hours IS NULL OR pos_session_stale_hours > 0)
);

-- One row per scope. NULL scope_id (TENANT level) never collides under a
-- plain UNIQUE constraint, so the expression index folds it to a sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofccs_scope
  ON public.org_fin_cash_ctrl_stng_cf (
    tenant_org_id,
    scope_level,
    COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.org_fin_cash_ctrl_stng_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_ofccs_tenant ON public.org_fin_cash_ctrl_stng_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_fin_cash_ctrl_stng_cf IS
  'Tenant-configurable cash-control policy overrides (D3/D4, POS Session & Cash Drawer Hardening §3.1). One row per (tenant_org_id, scope_level, scope_id); every setting column is nullable and NULL means "inherit". Resolved via the single lib/services/cash-control-settings.service.ts resolver, DRAWER -> USER -> BRANCH -> TENANT -> lib/constants/cash-control.ts default. Stores overrides only — ships with zero rows; a tenant with no row is fully configured by defaults. Deliberately outside sys_tenant_settings_cd (ADR-055); do not add a second read path.';

COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.scope_level IS
  'TENANT | BRANCH | USER | DRAWER. Resolution order is DRAWER -> USER -> BRANCH -> TENANT, declared once in the resolver service.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.scope_id IS
  'NULL only when scope_level = TENANT. Otherwise the id of the branch/user/drawer this override applies to.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.blind_close_enabled IS
  'D1 — hide the expected-cash figure from the cashier until the physical count is submitted. NULL inherits; TS default false.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.variance_gate_mode IS
  'D2/D5 — OFF | WARN_ONLY | APPROVAL_REQUIRED. NULL inherits; TS default WARN_ONLY (renamed from the legacy FLAG behaviour).';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.variance_threshold_amount IS
  'Approval band (highest of the three). At/above this amount, APPROVAL_REQUIRED blocks close pending sign-off. Per-drawer variance_approval_threshold, when set on the drawer itself, wins over this tenant/branch/user default.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.variance_reason_amount IS
  'Reason-required band, below the approval band. At/above this amount a reason is mandatory but no approval is required.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.variance_tolerance_amount IS
  'Auto-accept band, the lowest of the three. Below this amount a variance is accepted silently with no reason and no approval.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.cash_tracking_mode IS
  'TOTAL_ONLY | COUNT_BY_DENOMINATION | FULL_DENOMINATION_TRACKING. Governs whether checkout tenders capture denomination detail; counts always may regardless of this setting.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.opening_count_mode IS
  'TOTAL_ONLY | OPTIONAL_DENOMINATION | DENOMINATION. Controls the opening float count on drawer open.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.closing_count_mode IS
  'TOTAL_ONLY | OPTIONAL_DENOMINATION | DENOMINATION. Controls the closing count required to close a drawer session.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.cash_change_bearer IS
  'D16 — BUSINESS (default, CEILING) | CUSTOMER (FLOOR) | NEAREST (HALF_UP). Who absorbs the un-tenderable fraction of change owed. Business policy, not currency physics — CASH_TENDER rounding is HQ-owned and never resolves from this column.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.cash_change_round_to_minor IS
  'D16 — round change to the nearest N minor units. NULL inherits the HQ sys_currency_rounding_rules_cf CASH_CHANGE rounding_increment_minor for the currency.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.drawer_assignment_mode IS
  'OPEN | ASSIGNED_ONLY. Per-drawer assignment_mode column, when set, wins over this default.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.shared_session_mode IS
  'SHARED | EXCLUSIVE. Whether more than one POS session may run against the same open drawer session.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.max_cash_enforce_mode IS
  'OFF | WARN | BLOCK. Enforcement level applied when a drawer''s cash balance exceeds its configured max_cash_limit.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.cash_drop_requires_dest IS
  'When true, a cash drop/transfer out of a drawer must name a destination (safe, bank, another drawer) — forbids a one-legged transfer.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_req_for_cash IS
  'When true, a cash tender is refused unless an open POS session exists (POS_SESSION_REQUIRED).';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_req_all_tenders IS
  'Extends pos_session_req_for_cash to every tender type (card, wallet, etc.), not only cash.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_rollover_mode IS
  'OFF | PAUSE_AT_ROLLOVER | FORCE_CLOSE_AT_ROLLOVER. Behaviour applied to a still-open POS session when the tenant/branch business date rolls over.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_stale_hours IS
  'Operational alert threshold: hours a POS session may remain open before it is flagged stale. NULL inherits; TS default 12.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.shift_z_report_required IS
  'When true, a Z-report must be generated as part of closing the POS session.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.metadata IS
  'Free-form JSONB extension point. Not read by the resolver; reserved for future non-typed annotations.';

COMMIT;
