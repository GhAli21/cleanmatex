-- ============================================================================
-- 0321_ar_v2_ops_schema.sql
-- Purpose:
--   Add AR v2 operational foundations for customer credit applications,
--   disputes, dunning activity, statement cycles, and approval policy rules.
-- Notes:
--   - Additive only. Does not modify existing AR v1 objects.
--   - All tables are tenant-scoped and protected with RLS.
--   - Application services own sequence assignment and workflow orchestration.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_ar_credit_allocs_dtl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  source_ledger_id uuid NOT NULL,
  invoice_alloc_id uuid NULL,
  allocation_no integer NOT NULL,
  allocation_status_cd varchar(30) NOT NULL DEFAULT 'APPLIED',
  applied_amount numeric(19,4) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at timestamptz NULL,
  reversed_by varchar(120) NULL,
  reversal_reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oacred_no UNIQUE (tenant_org_id, invoice_id, allocation_no),
  CONSTRAINT ck_oacred_stat CHECK (allocation_status_cd IN ('APPLIED', 'REVERSED')),
  CONSTRAINT ck_oacred_amt CHECK (applied_amount > 0),
  CONSTRAINT fk_oacred_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oacred_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_oacred_alloc FOREIGN KEY (invoice_alloc_id, tenant_org_id)
    REFERENCES public.org_invoice_payments_dtl(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_oacred_led FOREIGN KEY (source_ledger_id, tenant_org_id)
    REFERENCES public.org_customer_ar_ledger_dtl(id, tenant_org_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_oacred_cus ON public.org_ar_credit_allocs_dtl(tenant_org_id, customer_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_oacred_inv ON public.org_ar_credit_allocs_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oacred_led ON public.org_ar_credit_allocs_dtl(tenant_org_id, source_ledger_id);

ALTER TABLE public.org_ar_credit_allocs_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oacred_tenant ON public.org_ar_credit_allocs_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_ar_disputes_mst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  dispute_no varchar(50) NOT NULL,
  status_cd varchar(30) NOT NULL DEFAULT 'OPEN',
  reason_cd varchar(30) NOT NULL,
  title varchar(200) NOT NULL,
  description text NOT NULL,
  description2 text NULL,
  disputed_amount numeric(19,4) NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_by varchar(120) NULL,
  assigned_to varchar(120) NULL,
  assigned_at timestamptz NULL,
  due_by_at timestamptz NULL,
  resolved_at timestamptz NULL,
  resolved_by varchar(120) NULL,
  resolution_summary text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oadisp_no UNIQUE (tenant_org_id, dispute_no),
  CONSTRAINT ck_oadisp_stat CHECK (status_cd IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT ck_oadisp_amt CHECK (disputed_amount >= 0),
  CONSTRAINT fk_oadisp_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_oadisp_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_oadisp_inv ON public.org_ar_disputes_mst(tenant_org_id, invoice_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_oadisp_cus ON public.org_ar_disputes_mst(tenant_org_id, customer_id, status_cd);
CREATE INDEX IF NOT EXISTS idx_oadisp_stat ON public.org_ar_disputes_mst(tenant_org_id, status_cd, opened_at DESC);

ALTER TABLE public.org_ar_disputes_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oadisp_tenant ON public.org_ar_disputes_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_ar_dunning_runs_mst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  invoice_id uuid NULL,
  run_no integer NOT NULL,
  stage_cd varchar(30) NOT NULL,
  action_cd varchar(30) NOT NULL,
  status_cd varchar(30) NOT NULL DEFAULT 'PENDING',
  scheduled_for timestamptz NULL,
  executed_at timestamptz NULL,
  response_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oadrun_no UNIQUE (tenant_org_id, customer_id, run_no),
  CONSTRAINT ck_oadrun_stage CHECK (stage_cd IN ('REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'CREDIT_HOLD')),
  CONSTRAINT ck_oadrun_action CHECK (action_cd IN ('EMAIL', 'SMS', 'HOLD', 'NOTE')),
  CONSTRAINT ck_oadrun_stat CHECK (status_cd IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  CONSTRAINT fk_oadrun_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oadrun_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_oadrun_cus ON public.org_ar_dunning_runs_mst(tenant_org_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oadrun_inv ON public.org_ar_dunning_runs_mst(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oadrun_stat ON public.org_ar_dunning_runs_mst(tenant_org_id, status_cd, created_at DESC);

ALTER TABLE public.org_ar_dunning_runs_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oadrun_tenant ON public.org_ar_dunning_runs_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_ar_stmt_cycles_mst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  cycle_code varchar(50) NOT NULL,
  cycle_name varchar(150) NOT NULL,
  cycle_name2 varchar(150) NULL,
  cadence_cd varchar(30) NOT NULL,
  customer_scope_cd varchar(30) NOT NULL DEFAULT 'ALL_B2B',
  day_of_month smallint NULL,
  day_of_week smallint NULL,
  issue_day_offset smallint NOT NULL DEFAULT 0,
  due_terms_days integer NOT NULL DEFAULT 0,
  last_run_at timestamptz NULL,
  next_run_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  rec_status integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oastcyc_code UNIQUE (tenant_org_id, cycle_code),
  CONSTRAINT uq_oastcyc_ref UNIQUE (id, tenant_org_id),
  CONSTRAINT ck_oastcyc_cad CHECK (cadence_cd IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM')),
  CONSTRAINT ck_oastcyc_scope CHECK (customer_scope_cd IN ('ALL_B2B', 'CUSTOM_LIST')),
  CONSTRAINT ck_oastcyc_dom CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  CONSTRAINT ck_oastcyc_dow CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)),
  CONSTRAINT ck_oastcyc_due CHECK (due_terms_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_oastcyc_act ON public.org_ar_stmt_cycles_mst(tenant_org_id, is_active, next_run_at);

ALTER TABLE public.org_ar_stmt_cycles_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oastcyc_tenant ON public.org_ar_stmt_cycles_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_ar_stmt_cycle_cust_dtl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  b2b_contract_id uuid NULL,
  is_active boolean NOT NULL DEFAULT true,
  rec_status integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oastcc_ref UNIQUE (tenant_org_id, cycle_id, customer_id),
  CONSTRAINT fk_oastcc_cyc FOREIGN KEY (cycle_id, tenant_org_id)
    REFERENCES public.org_ar_stmt_cycles_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT fk_oastcc_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_oastcc_cyc ON public.org_ar_stmt_cycle_cust_dtl(tenant_org_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_oastcc_cus ON public.org_ar_stmt_cycle_cust_dtl(tenant_org_id, customer_id);

ALTER TABLE public.org_ar_stmt_cycle_cust_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oastcc_tenant ON public.org_ar_stmt_cycle_cust_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_ar_appr_policies_cf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  policy_code varchar(50) NOT NULL,
  action_cd varchar(50) NOT NULL,
  branch_id uuid NULL,
  customer_id uuid NULL,
  min_amount numeric(19,4) NULL,
  max_amount numeric(19,4) NULL,
  approver_role_code varchar(50) NOT NULL,
  approvals_required smallint NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  rec_status integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(120) NULL,
  created_by_info text NULL,
  updated_at timestamptz NULL,
  updated_by varchar(120) NULL,
  updated_by_info text NULL,
  CONSTRAINT uq_oaapp_code UNIQUE (tenant_org_id, policy_code),
  CONSTRAINT ck_oaapp_amt CHECK (
    (min_amount IS NULL OR min_amount >= 0)
    AND (max_amount IS NULL OR max_amount >= 0)
    AND (max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount)
  ),
  CONSTRAINT ck_oaapp_need CHECK (approvals_required BETWEEN 1 AND 5),
  CONSTRAINT fk_oaapp_bra FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_oaapp_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_oaapp_act ON public.org_ar_appr_policies_cf(tenant_org_id, action_cd, is_active);

ALTER TABLE public.org_ar_appr_policies_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_oaapp_tenant ON public.org_ar_appr_policies_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
