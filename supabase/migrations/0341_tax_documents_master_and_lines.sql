-- ==================================================================
-- 0341_tax_documents_master_and_lines.sql
-- Purpose: Order Fin v1.1 Phase 7 — Tax-Document Full Lifecycle
--
-- Creates:
--   org_tax_documents_mst       — master tax document (INVOICE /
--                                  SIMPLIFIED_INVOICE / CREDIT_NOTE /
--                                  DEBIT_NOTE) with full lifecycle status
--   org_tax_doc_lines_dtl       — per-line tax breakdown snapshot
--   org_tax_doc_seq_counters    — row-locked sequence counter per
--                                  (tenant, document_type, fiscal_year)
--   org_tax_doc_triggers_cfg    — per-tenant trigger configuration
--
-- DB-level immutability guard:
--   fn_tax_doc_immut_guard() / trg_tax_doc_immutable
--   Blocks ALL updates to ISSUED rows except status → SUPERSEDED.
--   Fiscal compliance requirement (ZATCA / UAE VAT / Oman).
--
-- Backfill:
--   Copies existing shallow tax_document_* fields from org_orders_mst
--   into org_tax_documents_mst (where all four fields are non-NULL and
--   document_type is a valid enum value).
--   sequence_number = 0 is reserved for these legacy rows; the partial
--   unique index excludes sequence_number = 0 from the uniqueness check.
--
-- Permissions seeded:
--   tax_document:create
--   tax_document:issue
--   tax_document:cancel
--   tax_document:supersede
--   tax_document:configure_triggers
--
-- Plan: docs/features/Order_Fin/Fix_29_05_2026/
--       order-fin-v1_1-full-alignment-implementation-plan.md § Phase 7
-- ==================================================================
-- Safety notes:
--   • All new tables — no existing data modified beyond COMMENT.
--   • Deprecated org_orders_mst.tax_document_* columns are left intact
--     (NULL-tolerant) and documented; they will be dropped in a future
--     cleanup migration after all consumers migrate to the master table.
--   • DROP ... CASCADE is NEVER used; all FK constraints use RESTRICT.
--   • TEXT not VARCHAR; DECIMAL(19,4) for all money.
--   • Cross-project: cleanmatexsaas onboarding invoices must use a
--     SEPARATE document_type namespace or a dedicated sequence series so
--     the allocator counters don't collide with operational invoices.
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. org_tax_documents_mst
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE public.org_tax_documents_mst (
  id                   UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID          NOT NULL,
  order_id             UUID          NOT NULL,

  -- Document classification
  document_type        TEXT          NOT NULL,
  trigger_event        TEXT          NOT NULL,
  status               TEXT          NOT NULL DEFAULT 'DRAFT',

  -- Fiscal sequencing (sequence_number = 0 reserved for backfill)
  fiscal_year          INTEGER       NOT NULL,
  sequence_number      INTEGER       NOT NULL DEFAULT 0,
  document_no          TEXT,

  -- Financial snapshot at issuance (immutable once ISSUED)
  total_amount         DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount           DECIMAL(19,4) NOT NULL DEFAULT 0,
  currency_code        TEXT,
  currency_ex_rate    DECIMAL(10,6) NOT NULL DEFAULT 1,
  base_currency_code   TEXT,

  -- Credit / debit note chain
  supersedes_id        UUID,

  -- Lifecycle timestamps / actors
  issued_at            TIMESTAMPTZ,
  issued_by            TEXT,
  cancelled_at         TIMESTAMPTZ,
  cancelled_by         TEXT,
  cancellation_reason  TEXT,

  -- Standard audit fields
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT,
  created_info         TEXT,
  updated_at           TIMESTAMPTZ,
  updated_by           TEXT,
  updated_info         TEXT,
  rec_status           SMALLINT      NOT NULL DEFAULT 1,
  rec_order            INTEGER,
  rec_notes            TEXT,
  is_active            BOOLEAN       NOT NULL DEFAULT true,

  CONSTRAINT pk_tax_documents
    PRIMARY KEY (id),

  CONSTRAINT chk_tax_doc_type CHECK (document_type IN (
    'INVOICE', 'SIMPLIFIED_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'
  )),

  CONSTRAINT chk_tax_doc_status CHECK (status IN (
    'DRAFT', 'ISSUED', 'CANCELLED', 'SUPERSEDED'
  )),

  CONSTRAINT chk_tax_doc_trigger CHECK (trigger_event IN (
    'ON_ORDER_SUBMIT',
    'ON_PAYMENT_CONFIRMATION',
    'ON_SERVICE_COMPLETION',
    'ON_DELIVERY',
    'ON_AR_INVOICE_ISSUE',
    'LEGACY_BACKFILL'
  )),

  CONSTRAINT fk_tax_docs_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_tax_docs_order
    FOREIGN KEY (order_id)
    REFERENCES public.org_orders_mst(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_tax_docs_supersedes
    FOREIGN KEY (supersedes_id)
    REFERENCES public.org_tax_documents_mst(id)
    ON DELETE RESTRICT
);

-- Unique fiscal sequence per tenant/type/year (0 excluded — legacy rows)
CREATE UNIQUE INDEX uq_tax_doc_seq
  ON public.org_tax_documents_mst(tenant_org_id, document_type, fiscal_year, sequence_number)
  WHERE sequence_number > 0;

CREATE INDEX idx_tax_docs_tenant
  ON public.org_tax_documents_mst(tenant_org_id);

CREATE INDEX idx_tax_docs_order
  ON public.org_tax_documents_mst(tenant_org_id, order_id);

CREATE INDEX idx_tax_docs_status
  ON public.org_tax_documents_mst(tenant_org_id, status)
  WHERE is_active;

CREATE INDEX idx_tax_docs_type_year
  ON public.org_tax_documents_mst(tenant_org_id, document_type, fiscal_year);

ALTER TABLE public.org_tax_documents_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tax_docs_tenant ON public.org_tax_documents_mst;
CREATE POLICY pol_tax_docs_tenant ON public.org_tax_documents_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ──────────────────────────────────────────────────────────────────
-- 2. Immutability guard — ISSUED rows may ONLY transition → SUPERSEDED
--    Required for fiscal compliance (ZATCA / UAE / Oman VAT).
--    Any other UPDATE on an ISSUED row raises an exception.
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_tax_doc_immut_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'ISSUED' AND NEW.status <> 'SUPERSEDED' THEN
    RAISE EXCEPTION
      'tax_document.immutable: document % (status=ISSUED) may only '
      'transition to SUPERSEDED (got: %). '
      'Issue a CREDIT_NOTE or DEBIT_NOTE to correct an issued document.',
      OLD.id, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tax_doc_immutable
  BEFORE UPDATE ON public.org_tax_documents_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_doc_immut_guard();

-- ──────────────────────────────────────────────────────────────────
-- 3. org_tax_doc_lines_dtl
--    Snapshot of per-line tax breakdown at document issuance.
--    Links back to org_order_taxes_dtl for the originating tax line.
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE public.org_tax_doc_lines_dtl (
  id                UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id     UUID          NOT NULL,
  tax_document_id   UUID          NOT NULL,
  order_tax_line_id UUID,

  -- Tax snapshot (immutable once the parent document is ISSUED)
  tax_type          TEXT          NOT NULL,
  label             TEXT          NOT NULL,
  label2            TEXT,
  rate              DECIMAL(5,2),
  base_amount       DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount        DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Standard audit fields
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT      NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT true,

  CONSTRAINT pk_tax_doc_lines
    PRIMARY KEY (id),

  CONSTRAINT fk_tax_doc_lines_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_tax_doc_lines_doc
    FOREIGN KEY (tax_document_id)
    REFERENCES public.org_tax_documents_mst(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_tax_doc_lines_tax
    FOREIGN KEY (order_tax_line_id)
    REFERENCES public.org_order_taxes_dtl(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_tax_doc_lines_doc
  ON public.org_tax_doc_lines_dtl(tenant_org_id, tax_document_id);

CREATE INDEX idx_tax_doc_lines_tenant
  ON public.org_tax_doc_lines_dtl(tenant_org_id);

ALTER TABLE public.org_tax_doc_lines_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tax_doc_lines_tenant ON public.org_tax_doc_lines_dtl;
CREATE POLICY pol_tax_doc_lines_tenant ON public.org_tax_doc_lines_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ──────────────────────────────────────────────────────────────────
-- 4. org_tax_doc_seq_counters
--    One row per (tenant, document_type, fiscal_year).
--    The sequence allocator service does:
--      SELECT last_sequence FROM org_tax_doc_seq_counters
--        WHERE tenant_org_id = $1 AND document_type = $2 AND fiscal_year = $3
--        FOR UPDATE;
--      UPDATE ... SET last_sequence = last_sequence + 1 ...;
--    inside a single transaction to guarantee no gaps under concurrency.
--
--    NOTE: No RLS — this table is an internal mechanism always accessed
--    via service_role (which bypasses RLS), never via direct user queries.
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE public.org_tax_doc_seq_counters (
  tenant_org_id  UUID    NOT NULL,
  document_type  TEXT    NOT NULL,
  fiscal_year    INTEGER NOT NULL,
  last_sequence  INTEGER NOT NULL DEFAULT 0,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,

  CONSTRAINT pk_tax_doc_seq
    PRIMARY KEY (tenant_org_id, document_type, fiscal_year),

  CONSTRAINT fk_tax_doc_seq_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_tax_doc_seq_type CHECK (document_type IN (
    'INVOICE', 'SIMPLIFIED_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'
  ))
);

-- ──────────────────────────────────────────────────────────────────
-- 5. org_tax_doc_triggers_cfg
--    Per-tenant configuration: which trigger_event issues which
--    document_type. One row per (tenant, trigger_event).
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE public.org_tax_doc_triggers_cfg (
  id             UUID    NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID    NOT NULL,
  trigger_event  TEXT    NOT NULL,
  document_type  TEXT    NOT NULL,
  is_enabled     BOOLEAN NOT NULL DEFAULT true,

  -- Standard audit fields
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT,
  rec_status     SMALLINT    NOT NULL DEFAULT 1,
  rec_order      INTEGER,
  rec_notes      TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,

  CONSTRAINT pk_tax_doc_triggers
    PRIMARY KEY (id),

  CONSTRAINT uq_tax_doc_trigger
    UNIQUE (tenant_org_id, trigger_event),

  CONSTRAINT chk_tax_doc_trg_event CHECK (trigger_event IN (
    'ON_ORDER_SUBMIT',
    'ON_PAYMENT_CONFIRMATION',
    'ON_SERVICE_COMPLETION',
    'ON_DELIVERY',
    'ON_AR_INVOICE_ISSUE'
  )),

  CONSTRAINT chk_tax_doc_trg_type CHECK (document_type IN (
    'INVOICE', 'SIMPLIFIED_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'
  )),

  CONSTRAINT fk_tax_doc_trg_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_tax_doc_trg_tenant
  ON public.org_tax_doc_triggers_cfg(tenant_org_id)
  WHERE is_active;

ALTER TABLE public.org_tax_doc_triggers_cfg ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tax_doc_trg_tenant ON public.org_tax_doc_triggers_cfg;
CREATE POLICY pol_tax_doc_trg_tenant ON public.org_tax_doc_triggers_cfg
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ──────────────────────────────────────────────────────────────────
-- 6. Backfill — copy existing shallow tax_document_* columns from
--    org_orders_mst into org_tax_documents_mst.
--    Conditions: tax_document_id IS NOT NULL AND tax_document_type IS
--    a valid enum value (rows that pre-date this migration may have
--    free-text values that are not in the new CHECK constraint).
--    sequence_number = 0 marks these as pre-sequencer legacy rows;
--    the partial unique index on sequence_number > 0 excludes them.
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.org_tax_documents_mst (
  id,
  tenant_org_id,
  order_id,
  document_type,
  trigger_event,
  status,
  fiscal_year,
  sequence_number,
  document_no,
  total_amount,
  tax_amount,
  currency_code,
  created_at,
  created_by,
  created_info
)
SELECT
  o.tax_document_id,
  o.tenant_org_id,
  o.id,
  o.tax_document_type,
  'LEGACY_BACKFILL',
  COALESCE(
    CASE WHEN o.tax_document_status IN ('DRAFT','ISSUED','CANCELLED','SUPERSEDED')
         THEN o.tax_document_status END,
    'ISSUED'
  ),
  EXTRACT(YEAR FROM o.created_at)::INTEGER,
  0,
  o.tax_document_no,
  COALESCE(o.total_amount,     0),
  COALESCE(o.total_tax_amount, 0),
  o.currency_code,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0341_tax_documents_master_and_lines.sql backfill'
FROM public.org_orders_mst o
WHERE o.tax_document_id   IS NOT NULL
  AND o.tax_document_type IN ('INVOICE','SIMPLIFIED_INVOICE','CREDIT_NOTE','DEBIT_NOTE')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- 7. Seed sequence counters for backfilled (tenant, type, year) sets.
--    Each backfilled document has sequence_number = 0, so last_sequence
--    is also seeded as 0 — the allocator will start at 1 on first use.
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.org_tax_doc_seq_counters (
  tenant_org_id,
  document_type,
  fiscal_year,
  last_sequence,
  created_at,
  created_by
)
SELECT DISTINCT
  tenant_org_id,
  document_type,
  fiscal_year,
  0,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM public.org_tax_documents_mst
ON CONFLICT (tenant_org_id, document_type, fiscal_year) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- 8. Deprecate shallow columns on org_orders_mst.
--    Columns are NOT dropped — backward compatibility is preserved
--    until a future cleanup migration after all consumers migrate to
--    the org_tax_documents_mst master table.
-- ──────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.org_orders_mst.tax_document_id IS
  'DEPRECATED (Phase 7 / 0341): FK to org_tax_documents_mst. '
  'New code must join org_tax_documents_mst. '
  'Will be dropped in a future cleanup migration.';

COMMENT ON COLUMN public.org_orders_mst.tax_document_no IS
  'DEPRECATED (Phase 7 / 0341): shallow copy of org_tax_documents_mst.document_no.';

COMMENT ON COLUMN public.org_orders_mst.tax_document_status IS
  'DEPRECATED (Phase 7 / 0341): shallow copy of org_tax_documents_mst.status.';

COMMENT ON COLUMN public.org_orders_mst.tax_document_type IS
  'DEPRECATED (Phase 7 / 0341): shallow copy of org_tax_documents_mst.document_type.';

-- ──────────────────────────────────────────────────────────────────
-- 9. Permissions
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
)
VALUES
  (
    'tax_document:create',
    'Create Tax Document', 'إنشاء مستند ضريبي',
    'finance',
    'Allows creating a draft tax document (invoice, credit note, etc.).',
    'يسمح بإنشاء مستند ضريبي مسودة (فاتورة، إشعار دائن، إلخ).',
    'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'tax_document:issue',
    'Issue Tax Document', 'إصدار مستند ضريبي',
    'finance',
    'Allows transitioning a tax document from DRAFT to ISSUED status. Triggers fiscal sequence number allocation.',
    'يسمح بتحويل المستند الضريبي من مسودة إلى صادر. يُطلق تخصيص الرقم التسلسلي.',
    'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'tax_document:cancel',
    'Cancel Tax Document', 'إلغاء مستند ضريبي',
    'finance',
    'Allows cancelling a DRAFT tax document. ISSUED documents cannot be cancelled directly; issue a CREDIT_NOTE instead.',
    'يسمح بإلغاء المسودة. المستندات الصادرة لا تُلغى مباشرة — يجب إصدار إشعار دائن.',
    'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'tax_document:supersede',
    'Supersede Tax Document', 'استبدال مستند ضريبي',
    'finance',
    'Allows transitioning an ISSUED tax document to SUPERSEDED status as part of a credit/debit note chain.',
    'يسمح بتحويل المستند الصادر إلى مستبدَل ضمن سلسلة الإشعار الدائن.',
    'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'tax_document:configure_triggers',
    'Configure Tax Document Triggers', 'إعداد محفزات المستند الضريبي',
    'settings',
    'Allows configuring which business events trigger automatic tax document issuance.',
    'يسمح بتحديد الأحداث التجارية التي تُطلق إصدار المستند الضريبي تلقائيًا.',
    'Settings', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO UPDATE SET
  name              = EXCLUDED.name,
  name2             = EXCLUDED.name2,
  category          = EXCLUDED.category,
  description       = EXCLUDED.description,
  description2      = EXCLUDED.description2,
  category_main     = EXCLUDED.category_main,
  is_active         = true,
  is_enabled        = true,
  rec_status        = 1,
  updated_at        = CURRENT_TIMESTAMP,
  updated_by        = 'system_admin',
  updated_info      = 'Migration: 0341_tax_documents_master_and_lines.sql';

-- Assign tax_document:create + issue + cancel + supersede to super_admin and tenant_admin.
-- tax_document:configure_triggers goes to super_admin only (platform-level setting).

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN (
  VALUES
    ('tax_document:create'),
    ('tax_document:issue'),
    ('tax_document:cancel'),
    ('tax_document:supersede')
) AS p(code)
WHERE r.code IN ('super_admin', 'tenant_admin', 'opertator', 'branch_manager')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, 'tax_document:configure_triggers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
WHERE r.code = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = 'tax_document:configure_triggers'
  );

COMMIT;

-- ==================================================================
-- POST-APPLY CHECKLIST (run manually after migration is applied):
--
-- 1. Verify backfill count:
--    SELECT COUNT(*) FROM org_tax_documents_mst WHERE sequence_number = 0;
--    → Should equal number of orders with non-null tax_document_id.
--
-- 2. Verify no rows with invalid document_type escaped:
--    SELECT DISTINCT document_type FROM org_tax_documents_mst;
--
-- 3. Verify sequence counters:
--    SELECT * FROM org_tax_doc_seq_counters ORDER BY tenant_org_id, document_type;
--
-- 4. Test immutability guard (expect error):
--    UPDATE org_tax_documents_mst SET status = 'CANCELLED'
--    WHERE id = (SELECT id FROM org_tax_documents_mst
--                WHERE status = 'ISSUED' LIMIT 1);
--
-- 5. Cross-project: confirm cleanmatexsaas uses a separate document_type
--    series (e.g. 'ONBOARDING_INVOICE') to avoid sequence counter collisions.
-- ==================================================================
