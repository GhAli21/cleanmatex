-- =============================================================================
-- Migration 0516 — Cash-control settings audit trail (Wave 0, POS Session &
-- Cash Drawer Hardening, package §3.1.6 W0-4b of
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md)
--
-- Creates org_fin_cash_ctrl_audit_dtl: an append-only before/after log of every
-- write to org_fin_cash_ctrl_stng_cf (migration 0515), written exclusively by
-- lib/services/cash-control-settings.service.ts's updateCashControlSettings.
-- "A control that can be silently turned off is not a control" — §3.1.6 W0-4b.
--
-- Numbering note (D17, STATUS.md): this was originally planned to fold into
-- 0515 itself, but 0515 already applied before this need was finalized in
-- review, and CRITICAL RULE #2 forbids editing an applied migration — so this
-- is its own migration. It also consumes the migration number (0516) that
-- IMPLEMENTATION_PLAN.md §3.2 had reserved for the RBAC permissions seed;
-- that package now lands as 0517. See STATUS.md D17 for the full rationale,
-- including why the existing org_stng_audit_log_tr (general settings audit
-- log) was evaluated and rejected as a reuse target (SELECT-only RLS, no
-- DRAWER scope level, and it would recouple cash-control settings into the
-- general settings system that D3 deliberately keeps separate).
--
-- Shape follows this program's existing immutable ledger-row convention
-- (org_cash_drawer_movements_dtl): created_at/_by/_info only, no updated_*
-- columns — an audit row is never edited, only ever created. A correction is
-- a new settings change, which is a new audit row.
--
-- Reversal (forward-only; this repo forbids editing applied migrations):
-- a future migration would DROP the indexes below, DROP POLICY
-- pol_ofcad_tenant, then DROP TABLE org_fin_cash_ctrl_audit_dtl RESTRICT.
-- Lossy: yes — it is the historical record of who changed which
-- cash-control setting and when. Acceptable only as part of retiring the
-- whole cash-control-settings feature (ADR-056's exit criteria), never as a
-- routine cleanup.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_cash_ctrl_audit_dtl (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID NOT NULL
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,

  -- which row/scope in org_fin_cash_ctrl_stng_cf this entry is about
  scope_level           TEXT NOT NULL,
  scope_id              UUID NULL,

  -- which setting changed and how
  setting_column        TEXT NOT NULL,
  audit_action          TEXT NOT NULL,
  before_value_jsonb     JSONB NULL,
  after_value_jsonb       JSONB NULL,
  change_reason         TEXT NULL,

  -- actor
  changed_by            UUID NULL
    REFERENCES public.org_users_mst (id) ON DELETE SET NULL,
  changed_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- standard tail (immutable row: no updated_* columns, per header note)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            TEXT NULL,
  created_info          TEXT NULL,
  rec_status            SMALLINT NOT NULL DEFAULT 1,
  rec_order             INTEGER NULL,
  rec_notes             TEXT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_ofcad_scope
    CHECK ((scope_level = 'TENANT' AND scope_id IS NULL)
           OR (scope_level <> 'TENANT' AND scope_id IS NOT NULL)),

  CONSTRAINT chk_ofcad_scope_level
    CHECK (scope_level IN ('TENANT', 'BRANCH', 'USER', 'DRAWER')),

  CONSTRAINT chk_ofcad_action
    CHECK (audit_action IN ('CREATE', 'UPDATE', 'CLEAR'))
);

CREATE INDEX IF NOT EXISTS idx_ofcad_tenant
  ON public.org_fin_cash_ctrl_audit_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofcad_scope
  ON public.org_fin_cash_ctrl_audit_dtl (tenant_org_id, scope_level, scope_id);

CREATE INDEX IF NOT EXISTS idx_ofcad_column
  ON public.org_fin_cash_ctrl_audit_dtl (tenant_org_id, setting_column);

CREATE INDEX IF NOT EXISTS idx_ofcad_changed_at
  ON public.org_fin_cash_ctrl_audit_dtl (tenant_org_id, changed_at DESC);

ALTER TABLE public.org_fin_cash_ctrl_audit_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_ofcad_tenant ON public.org_fin_cash_ctrl_audit_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_fin_cash_ctrl_audit_dtl IS
  'Append-only before/after audit trail for every write to org_fin_cash_ctrl_stng_cf (POS Session & Cash Drawer Hardening §3.1.6 W0-4b / D17). Written exclusively by updateCashControlSettings in lib/services/cash-control-settings.service.ts — never written to directly from a route or component. Rows are immutable; a correction is a new settings change, which is a new audit row. Deliberately separate from the general org_stng_audit_log_tr (see ADR-056) so cash-control settings stay decoupled from the general settings system per D3.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.scope_level IS
  'The scope of the org_fin_cash_ctrl_stng_cf row this entry audits: TENANT | BRANCH | USER | DRAWER.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.scope_id IS
  'NULL only when scope_level = TENANT, matching org_fin_cash_ctrl_stng_cf.scope_id.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.setting_column IS
  'The org_fin_cash_ctrl_stng_cf column that changed, e.g. blind_close_enabled or variance_gate_mode. One row per changed column per call to updateCashControlSettings.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.audit_action IS
  'CREATE = first override at this scope for this column; UPDATE = override value changed; CLEAR = override removed (patch value NULL), reverting that field to inherit down the scope chain.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.before_value_jsonb IS
  'The column value before this change, JSON-wrapped so any setting type (boolean/text/number) fits one column. NULL on CREATE (no prior override existed).';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.after_value_jsonb IS
  'The column value after this change. NULL on CLEAR (override removed, field now inherits).';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.change_reason IS
  'Actor-supplied reason for the change. Not enforced NOT NULL here (only force-close/variance-approval/transfer-cancel mandate a reason per §10.9) but the write UI should collect it for every cash-control change given the financial-control nature of this table.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_audit_dtl.changed_by IS
  'The user who made the change. Nullable to allow a future system/migration-driven change to still be logged; every UI-initiated change must supply this.';

COMMIT;
