--
-- Migration 0669_doc_seq_counters.sql
-- Human-Friendly Codes, P1 (DB engine), migration 4 of 7.
--
-- Purpose: counter tables for the shared document-number engine (GENERAL doc types only).
--   org_doc_seq_mst  per tenant:   PK (tenant_org_id, doc_type_code, period_key)
--   sys_doc_seq_mst  platform SYS: PK (doc_type_code, period_key)
--   hq_doc_seq_mst   platform HQ:  PK (doc_type_code, period_key)
-- period_key is '' (NEVER), YYYY, YYYYMM, YYYYMMDD or FY<year> (fiscal year, tenant start month).
-- Only the SECURITY DEFINER engine functions write; nobody else may read or write except service_role (SELECT).
-- fillfactor 70 keeps hot counter rows on HOT updates.
-- Indexes: only the PKs, plus idx_org_doc_seq_type for the doc type FK. The sys/hq PKs lead with doc_type_code,
-- so they already serve that FK. The engine updates only unindexed columns, so every counter update can be HOT.
-- Tenant deletes: the FK to org_tenants_mst is RESTRICT. Tenant cleanup never resets or deletes counters
-- (approved 2026-10-30, T1.9: the only tenant delete path is the signup rollback, which runs before any number is issued).
--
-- Affected: org_doc_seq_mst, sys_doc_seq_mst, hq_doc_seq_mst (new).
-- Related:  migration doc_seq_type_config (FK doc_type_code).
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.4.
-- APPLY ORDER: 4 of 7 in P1. Next: doc_seq_engine_fns.
-- ROLLBACK PLAN (forward-only repo; write a new migration). Roll back doc_seq_engine_fns first:
--   DROP TABLE public.hq_doc_seq_mst RESTRICT; DROP TABLE public.sys_doc_seq_mst RESTRICT; DROP TABLE public.org_doc_seq_mst RESTRICT;
--
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE public.org_doc_seq_mst (
  tenant_org_id   UUID    NOT NULL,                  -- Owning tenant (FK org_tenants_mst).
  doc_type_code   TEXT    NOT NULL,                  -- FK sys_doc_seq_type_cd.
  period_key      TEXT    NOT NULL DEFAULT '',       -- '' | YYYY | YYYYMM | YYYYMMDD | FY<year>.
  last_value      BIGINT  NOT NULL,                  -- Last number issued in this period.
  prefix_override TEXT,                              -- Reserved; always NULL.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_org_doc_seq_mst PRIMARY KEY (tenant_org_id, doc_type_code, period_key),
  CONSTRAINT fk_org_doc_seq_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_org_doc_seq_type FOREIGN KEY (doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT ck_org_doc_seq_last CHECK (last_value >= 0),
  CONSTRAINT ck_org_doc_seq_period CHECK (period_key ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8}|FY[0-9]{4})?$'),
  CONSTRAINT ck_org_doc_seq_prefix_off CHECK (prefix_override IS NULL)
) WITH (fillfactor = 70);
CREATE INDEX idx_org_doc_seq_type ON public.org_doc_seq_mst (doc_type_code);
COMMENT ON TABLE public.org_doc_seq_mst IS 'Per-tenant counters for GENERAL document types. Written only by fn_doc_seq_next (row lock until commit).';
COMMENT ON COLUMN public.org_doc_seq_mst.tenant_org_id IS 'Owning tenant. FK RESTRICT: counters are never reset or deleted by tenant cleanup.';
COMMENT ON COLUMN public.org_doc_seq_mst.doc_type_code IS 'GENERAL document type (sys_doc_seq_type_cd).';
COMMENT ON COLUMN public.org_doc_seq_mst.period_key IS 'Counter period from the reset policy: empty (NEVER), YYYY, YYYYMM, YYYYMMDD or FY<fiscal year>, in the owner local time zone.';
COMMENT ON COLUMN public.org_doc_seq_mst.last_value IS 'Last number issued for this period; the next call returns last_value + 1. The increment is part of the caller transaction: a rollback also undoes it (the number is reused). Gaps appear only when the number is taken in a separate transaction from the document, or the document is deleted later.';
COMMENT ON COLUMN public.org_doc_seq_mst.prefix_override IS 'Reserved for tenant prefix overrides; always NULL in this version.';
COMMENT ON COLUMN public.org_doc_seq_mst.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.org_doc_seq_mst.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.org_doc_seq_mst.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.org_doc_seq_mst.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.org_doc_seq_mst.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_doc_seq_mst.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.org_doc_seq_mst.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.org_doc_seq_mst.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.org_doc_seq_mst.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.org_doc_seq_mst.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT fk_org_doc_seq_tenant ON public.org_doc_seq_mst IS 'Tenant; RESTRICT.';
COMMENT ON CONSTRAINT fk_org_doc_seq_type ON public.org_doc_seq_mst IS 'Doc type; RESTRICT.';
COMMENT ON CONSTRAINT ck_org_doc_seq_last ON public.org_doc_seq_mst IS 'Counter is never negative.';
COMMENT ON CONSTRAINT ck_org_doc_seq_period ON public.org_doc_seq_mst IS 'Known period key shapes only.';
COMMENT ON CONSTRAINT ck_org_doc_seq_prefix_off ON public.org_doc_seq_mst IS 'Prefix override is reserved and off.';
COMMENT ON INDEX public.idx_org_doc_seq_type IS 'Supports the doc type FK and per-type reports.';
ALTER TABLE public.org_doc_seq_mst ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER engine functions write; service_role may read for checks and HQ screens.
REVOKE ALL ON TABLE public.org_doc_seq_mst FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.org_doc_seq_mst TO service_role;
CREATE TRIGGER trg_org_doc_seq_upd
  BEFORE UPDATE ON public.org_doc_seq_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_org_doc_seq_upd ON public.org_doc_seq_mst IS 'Sets updated_at on every update.';

CREATE TABLE public.sys_doc_seq_mst (
  doc_type_code   TEXT    NOT NULL,                  -- FK sys_doc_seq_type_cd.
  period_key      TEXT    NOT NULL DEFAULT '',       -- '' | YYYY | YYYYMM | YYYYMMDD | FY<year>.
  last_value      BIGINT  NOT NULL,                  -- Last number issued in this period.
  prefix_override TEXT,                              -- Reserved; always NULL.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_doc_seq_mst PRIMARY KEY (doc_type_code, period_key),
  CONSTRAINT fk_sys_doc_seq_type FOREIGN KEY (doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sys_doc_seq_last CHECK (last_value >= 0),
  CONSTRAINT ck_sys_doc_seq_period CHECK (period_key ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8}|FY[0-9]{4})?$'),
  CONSTRAINT ck_sys_doc_seq_prefix_off CHECK (prefix_override IS NULL)
) WITH (fillfactor = 70);
COMMENT ON TABLE public.sys_doc_seq_mst IS 'Platform-wide (SYS scope) counters for GENERAL document types. Written only by fn_sys_doc_seq_next.';
COMMENT ON COLUMN public.sys_doc_seq_mst.doc_type_code IS 'GENERAL document type (sys_doc_seq_type_cd).';
COMMENT ON COLUMN public.sys_doc_seq_mst.period_key IS 'Counter period from the reset policy: empty (NEVER), YYYY, YYYYMM, YYYYMMDD or FY<fiscal year>, in the owner local time zone.';
COMMENT ON COLUMN public.sys_doc_seq_mst.last_value IS 'Last number issued for this period; the next call returns last_value + 1. The increment is part of the caller transaction: a rollback also undoes it (the number is reused). Gaps appear only when the number is taken in a separate transaction from the document, or the document is deleted later.';
COMMENT ON COLUMN public.sys_doc_seq_mst.prefix_override IS 'Reserved for tenant prefix overrides; always NULL in this version.';
COMMENT ON COLUMN public.sys_doc_seq_mst.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_doc_seq_mst.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_doc_seq_mst.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_doc_seq_mst.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_doc_seq_mst.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_doc_seq_mst.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_doc_seq_mst.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_doc_seq_mst.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_doc_seq_mst.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_doc_seq_mst.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT fk_sys_doc_seq_type ON public.sys_doc_seq_mst IS 'Doc type; RESTRICT.';
COMMENT ON CONSTRAINT ck_sys_doc_seq_last ON public.sys_doc_seq_mst IS 'Counter is never negative.';
COMMENT ON CONSTRAINT ck_sys_doc_seq_period ON public.sys_doc_seq_mst IS 'Known period key shapes only.';
COMMENT ON CONSTRAINT ck_sys_doc_seq_prefix_off ON public.sys_doc_seq_mst IS 'Prefix override is reserved and off.';
ALTER TABLE public.sys_doc_seq_mst ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER engine functions write; service_role may read for checks and HQ screens.
REVOKE ALL ON TABLE public.sys_doc_seq_mst FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sys_doc_seq_mst TO service_role;
CREATE TRIGGER trg_sys_doc_seq_upd
  BEFORE UPDATE ON public.sys_doc_seq_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_sys_doc_seq_upd ON public.sys_doc_seq_mst IS 'Sets updated_at on every update.';

CREATE TABLE public.hq_doc_seq_mst (
  doc_type_code   TEXT    NOT NULL,                  -- FK sys_doc_seq_type_cd.
  period_key      TEXT    NOT NULL DEFAULT '',       -- '' | YYYY | YYYYMM | YYYYMMDD | FY<year>.
  last_value      BIGINT  NOT NULL,                  -- Last number issued in this period.
  prefix_override TEXT,                              -- Reserved; always NULL.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_hq_doc_seq_mst PRIMARY KEY (doc_type_code, period_key),
  CONSTRAINT fk_hq_doc_seq_type FOREIGN KEY (doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT ck_hq_doc_seq_last CHECK (last_value >= 0),
  CONSTRAINT ck_hq_doc_seq_period CHECK (period_key ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8}|FY[0-9]{4})?$'),
  CONSTRAINT ck_hq_doc_seq_prefix_off CHECK (prefix_override IS NULL)
) WITH (fillfactor = 70);
COMMENT ON TABLE public.hq_doc_seq_mst IS 'HQ scope counters for GENERAL document types. Written only by fn_hq_doc_seq_next.';
COMMENT ON COLUMN public.hq_doc_seq_mst.doc_type_code IS 'GENERAL document type (sys_doc_seq_type_cd).';
COMMENT ON COLUMN public.hq_doc_seq_mst.period_key IS 'Counter period from the reset policy: empty (NEVER), YYYY, YYYYMM, YYYYMMDD or FY<fiscal year>, in the owner local time zone.';
COMMENT ON COLUMN public.hq_doc_seq_mst.last_value IS 'Last number issued for this period; the next call returns last_value + 1. The increment is part of the caller transaction: a rollback also undoes it (the number is reused). Gaps appear only when the number is taken in a separate transaction from the document, or the document is deleted later.';
COMMENT ON COLUMN public.hq_doc_seq_mst.prefix_override IS 'Reserved for tenant prefix overrides; always NULL in this version.';
COMMENT ON COLUMN public.hq_doc_seq_mst.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.hq_doc_seq_mst.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.hq_doc_seq_mst.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.hq_doc_seq_mst.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.hq_doc_seq_mst.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.hq_doc_seq_mst.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.hq_doc_seq_mst.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.hq_doc_seq_mst.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.hq_doc_seq_mst.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.hq_doc_seq_mst.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT fk_hq_doc_seq_type ON public.hq_doc_seq_mst IS 'Doc type; RESTRICT.';
COMMENT ON CONSTRAINT ck_hq_doc_seq_last ON public.hq_doc_seq_mst IS 'Counter is never negative.';
COMMENT ON CONSTRAINT ck_hq_doc_seq_period ON public.hq_doc_seq_mst IS 'Known period key shapes only.';
COMMENT ON CONSTRAINT ck_hq_doc_seq_prefix_off ON public.hq_doc_seq_mst IS 'Prefix override is reserved and off.';
ALTER TABLE public.hq_doc_seq_mst ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER engine functions write; service_role may read for checks and HQ screens.
REVOKE ALL ON TABLE public.hq_doc_seq_mst FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hq_doc_seq_mst TO service_role;
CREATE TRIGGER trg_hq_doc_seq_upd
  BEFORE UPDATE ON public.hq_doc_seq_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_hq_doc_seq_upd ON public.hq_doc_seq_mst IS 'Sets updated_at on every update.';

COMMIT;
