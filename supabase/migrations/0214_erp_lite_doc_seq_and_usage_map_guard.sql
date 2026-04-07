-- ==================================================================
-- Migration: 0214_erp_lite_doc_seq_and_usage_map_guard.sql
-- Purpose: (1) Add DB-backed document sequence table to replace
--              random journal number generation. Closes DELTA-INT-001.
--          (2) Add trigger to prevent overlapping active effective-date
--              windows for usage mappings. Closes DELTA-INT-002.
--
-- Problem 1 (PB-C4): generateJournalNo uses random+timestamp which
-- causes concurrency collisions and opaque SYSTEM_ERRORs at month-end.
-- The sequence table lets the posting engine call a safe DB function
-- that atomically increments and returns the next document number.
--
-- Problem 2: org_fin_usage_map_mst unique indexes prevent duplicate
-- ACTIVE global/branch rows, but they do not prevent two rows with
-- overlapping effective_from/effective_to windows, which creates
-- runtime ambiguity when both are ACTIVE and dates overlap.
--
-- New objects:
--   public.org_fin_doc_seq_mst         -- per-tenant document sequences
--   public.fn_next_fin_doc_no()        -- safe sequence increment function
--   public.fn_chk_ofum_date_overlap()  -- usage map date overlap trigger fn
--   trigger on org_fin_usage_map_mst   -- enforces no overlap on ACTIVE rows
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Table: org_fin_doc_seq_mst
-- Tenant-scoped sequence counters for finance document numbers.
-- Supports journals, AP invoices, POs, expenses, petty cash, etc.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_fin_doc_seq_mst (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  -- doc_type_code: 'JOURNAL', 'EXPENSE', 'PETTY_CASH', 'AP_INV', 'PO', etc.
  doc_type_code   VARCHAR(40) NOT NULL,
  -- prefix prepended to formatted number, e.g. 'JV-', 'EXP-'
  prefix          VARCHAR(20),
  -- monotonically incrementing counter; updated atomically via fn_next_fin_doc_no
  last_no         BIGINT      NOT NULL DEFAULT 0,
  -- total zero-padded width of the numeric part, e.g. 6 → '000001'
  padding_len     SMALLINT    NOT NULL DEFAULT 6,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      VARCHAR(120),
  created_info    TEXT,
  updated_at      TIMESTAMP,
  updated_by      VARCHAR(120),
  updated_info    TEXT,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       VARCHAR(200),
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  CONSTRAINT fk_ofds_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT uq_ofds_type UNIQUE (tenant_org_id, doc_type_code),
  CONSTRAINT chk_ofds_last_no CHECK (last_no >= 0),
  CONSTRAINT chk_ofds_padding CHECK (padding_len BETWEEN 1 AND 20)
);

COMMENT ON TABLE public.org_fin_doc_seq_mst IS
  'Tenant-scoped document sequence counters. Use fn_next_fin_doc_no() to '
  'atomically increment and format the next number. Never update last_no '
  'directly from application code.';
COMMENT ON COLUMN public.org_fin_doc_seq_mst.doc_type_code IS
  'Finance document type: JOURNAL, EXPENSE, PETTY_CASH, AP_INV, PO, etc.';
COMMENT ON COLUMN public.org_fin_doc_seq_mst.prefix IS
  'Optional prefix prepended to the zero-padded number, e.g. JV-.';
COMMENT ON COLUMN public.org_fin_doc_seq_mst.last_no IS
  'Last issued sequence number. Updated atomically by fn_next_fin_doc_no().';

CREATE INDEX IF NOT EXISTS idx_ofds_tenant
  ON public.org_fin_doc_seq_mst(tenant_org_id, is_active);

-- RLS: tenant-scoped
ALTER TABLE public.org_fin_doc_seq_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofds ON public.org_fin_doc_seq_mst;
CREATE POLICY tenant_isolation_ofds ON public.org_fin_doc_seq_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ------------------------------------------------------------------
-- Function: fn_next_fin_doc_no(p_tenant_org_id, p_doc_type_code)
-- Atomically increments last_no and returns the formatted document
-- number string. Uses FOR UPDATE to be concurrency-safe.
-- Creates the sequence row with defaults if it does not yet exist.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_next_fin_doc_no(
  p_tenant_org_id UUID,
  p_doc_type_code VARCHAR
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix      VARCHAR(20);
  v_last_no     BIGINT;
  v_padding_len SMALLINT;
  v_next_no     BIGINT;
  v_formatted   TEXT;
BEGIN
  -- Lock the sequence row; insert default if missing
  INSERT INTO public.org_fin_doc_seq_mst (
    tenant_org_id, doc_type_code, prefix, last_no, padding_len,
    created_by, created_info
  ) VALUES (
    p_tenant_org_id, p_doc_type_code, NULL, 0, 6,
    'system', 'auto-created by fn_next_fin_doc_no'
  )
  ON CONFLICT (tenant_org_id, doc_type_code) DO NOTHING;

  SELECT prefix, last_no, padding_len
  INTO   v_prefix, v_last_no, v_padding_len
  FROM   public.org_fin_doc_seq_mst
  WHERE  tenant_org_id = p_tenant_org_id
    AND  doc_type_code = p_doc_type_code
    AND  is_active = true
    AND  rec_status = 1
  FOR UPDATE;                          -- row-level lock prevents concurrent races

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_next_fin_doc_no: no active sequence for tenant % doc_type %',
      p_tenant_org_id, p_doc_type_code;
  END IF;

  v_next_no := v_last_no + 1;

  UPDATE public.org_fin_doc_seq_mst
  SET    last_no    = v_next_no,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = 'system'
  WHERE  tenant_org_id = p_tenant_org_id
    AND  doc_type_code = p_doc_type_code;

  -- Format: optional prefix + zero-padded number
  v_formatted := COALESCE(v_prefix, '') ||
                 LPAD(v_next_no::TEXT, v_padding_len, '0');

  RETURN v_formatted;
END;
$$;

COMMENT ON FUNCTION public.fn_next_fin_doc_no(UUID, VARCHAR) IS
  'Atomically increments and returns the next formatted document number for a '
  'tenant and document type. Row-level locking prevents duplicate numbers '
  'under concurrent load. Replaces the random-string approach in the engine.';

-- ------------------------------------------------------------------
-- Trigger: prevent overlapping effective date windows in usage maps
-- Applies only to ACTIVE rows. DRAFT and INACTIVE rows may coexist.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chk_ofum_date_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_id UUID;
BEGIN
  -- Only enforce on ACTIVE rows
  IF NEW.status_code <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  -- Look for another ACTIVE row for same tenant + usage code + branch scope
  -- whose effective window overlaps with NEW's window.
  -- Two ranges [a,b] and [c,d] overlap when: a <= d AND c <= b
  -- NULL effective_from means -infinity; NULL effective_to means +infinity.
  SELECT id INTO v_conflict_id
  FROM   public.org_fin_usage_map_mst
  WHERE  tenant_org_id  = NEW.tenant_org_id
    AND  usage_code_id  = NEW.usage_code_id
    -- same branch scope (both global OR same branch)
    AND  (branch_id IS NOT DISTINCT FROM NEW.branch_id)
    AND  status_code = 'ACTIVE'
    AND  is_active   = true
    AND  rec_status  = 1
    AND  id <> NEW.id         -- exclude self on UPDATE
    -- overlap check: NEW starts before other ends AND other starts before NEW ends
    AND  COALESCE(NEW.effective_from, '1900-01-01'::DATE)
           <= COALESCE(effective_to,  '9999-12-31'::DATE)
    AND  COALESCE(effective_from,     '1900-01-01'::DATE)
           <= COALESCE(NEW.effective_to, '9999-12-31'::DATE)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Usage map effective date overlap: tenant % usage_code_id % branch % '
      'conflicts with existing ACTIVE mapping id %',
      NEW.tenant_org_id, NEW.usage_code_id,
      COALESCE(NEW.branch_id::TEXT, 'global'), v_conflict_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_chk_ofum_date_overlap() IS
  'Trigger function: prevents overlapping ACTIVE effective-date windows for the '
  'same tenant + usage code + branch scope in org_fin_usage_map_mst. Ensures '
  'the posting engine can always resolve exactly one valid mapping by date.';

DROP TRIGGER IF EXISTS trg_ofum_date_overlap ON public.org_fin_usage_map_mst;
CREATE TRIGGER trg_ofum_date_overlap
  BEFORE INSERT OR UPDATE ON public.org_fin_usage_map_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_chk_ofum_date_overlap();

COMMENT ON TRIGGER trg_ofum_date_overlap ON public.org_fin_usage_map_mst IS
  'Prevents two ACTIVE usage map rows from having overlapping effective date '
  'windows for the same tenant + usage code + branch scope.';

COMMIT;
