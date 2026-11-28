-- =============================================================================
-- 0855_customer_sys_org_code_audit.sql
-- Customer Module: Global/Tenant customer_code, Identity Uniqueness, Dual Audit
-- Detail Tables, and Atomic Create/Connect + Profile-Sync RPCs.
--
-- Purpose:
--   1. Add canonical `customer_code` to both `sys_customers_mst` (globally unique)
--      and `org_customers_mst` (unique per `tenant_org_id`), backed by lock-free
--      PostgreSQL sequences.
--   2. Enforce active phone/email uniqueness at both global (`sys_customers_mst`)
--      and tenant (`org_customers_mst`) layers after a non-destructive pre-check.
--   3. Create immutable audit-history detail tables for both layers:
--      - `sys_customer_audit_dtl` (global identity audit, closed to browser roles)
--      - `org_customer_audit_dtl` (tenant customer audit, RLS-enforced)
--   4. Provide atomic, concurrency-safe transactional functions:
--      - `org_cust_create_or_connect(...)`: lookup-first create or branch connect
--      - `org_cust_update_and_sync(...)`: partial update with linked sys sync
--
-- Runtime boundary:
--   `sys_customers_mst`, `sys_customer_audit_dtl`, and the RPC functions are
--   service-role-only. Tenant web-admin API routes authenticate, enforce RBAC
--   and CSRF, and pass the verified `tenant_org_id` explicitly.
--
-- Deployment:
--   Forward-only draft. Review before application. Do not apply through an
--   agent, Supabase CLI, or MCP; the repository owner applies migrations.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- 1. Non-destructive pre-check for duplicate active phones/emails.
-- -----------------------------------------------------------------------------
-- Fails fast with a clear diagnostic message if pre-existing duplicate active
-- phones or emails would violate the new unique indexes. Never auto-deletes.
DO $$
DECLARE
  v_sys_dup_phone INTEGER;
  v_sys_dup_email INTEGER;
  v_org_dup_phone INTEGER;
  v_org_dup_email INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sys_dup_phone
  FROM (
    SELECT phone
    FROM public.sys_customers_mst
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_sys_dup_email
  FROM (
    SELECT lower(btrim(email))
    FROM public.sys_customers_mst
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY lower(btrim(email))
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_org_dup_phone
  FROM (
    SELECT tenant_org_id, phone
    FROM public.org_customers_mst
    WHERE is_active = true AND phone IS NOT NULL AND btrim(phone) <> ''
    GROUP BY tenant_org_id, phone
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_org_dup_email
  FROM (
    SELECT tenant_org_id, lower(btrim(email))
    FROM public.org_customers_mst
    WHERE is_active = true AND email IS NOT NULL AND btrim(email) <> ''
    GROUP BY tenant_org_id, lower(btrim(email))
    HAVING COUNT(*) > 1
  ) d;

  IF v_sys_dup_phone > 0 OR v_sys_dup_email > 0 OR v_org_dup_phone > 0 OR v_org_dup_email > 0 THEN
    RAISE EXCEPTION
      'Migration 0855 pre-check failed: resolve duplicate customer contacts first (sys_phone=%, sys_email=%, org_phone=%, org_email=%)',
      v_sys_dup_phone, v_sys_dup_email, v_org_dup_phone, v_org_dup_email;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Concurrency-safe sequences and customer_code generator functions.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_sys_customer_code
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

COMMENT ON SEQUENCE public.seq_sys_customer_code IS
  'Monotonic sequence generating globally unique customer_code values for sys_customers_mst.';

CREATE SEQUENCE IF NOT EXISTS public.seq_org_local_cust_code
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

COMMENT ON SEQUENCE public.seq_org_local_cust_code IS
  'Monotonic sequence generating tenant-local customer_code values for unlinked guest and B2B rows in org_customers_mst.';

-- Keep sequence grants closed to browser roles; server-side RPCs own code generation.
REVOKE ALL ON SEQUENCE public.seq_sys_customer_code FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.seq_org_local_cust_code FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_sys_customer_code TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_org_local_cust_code TO service_role;

CREATE OR REPLACE FUNCTION public.gen_sys_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.seq_sys_customer_code');
  RETURN 'CUST-' || lpad(v_next::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.gen_sys_customer_code() IS
  'Generates the next globally unique customer_code (CUST-000001 format) for sys_customers_mst using seq_sys_customer_code.';

CREATE OR REPLACE FUNCTION public.gen_org_local_cust_code(p_prefix TEXT DEFAULT 'LOC')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next BIGINT;
  v_clean_prefix TEXT;
BEGIN
  v_clean_prefix := upper(regexp_replace(COALESCE(NULLIF(btrim(p_prefix), ''), 'LOC'), '[^A-Za-z0-9]', '', 'g'));
  IF v_clean_prefix = '' THEN
    v_clean_prefix := 'LOC';
  END IF;
  v_next := nextval('public.seq_org_local_cust_code');
  RETURN v_clean_prefix || '-' || lpad(v_next::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.gen_org_local_cust_code(TEXT) IS
  'Generates a concurrency-safe tenant-local customer_code (e.g. GST-000001 or B2B-000001) for unlinked org_customers_mst rows.';

REVOKE ALL ON FUNCTION public.gen_sys_customer_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_org_local_cust_code(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_sys_customer_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.gen_org_local_cust_code(TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Add customer_code (both tables) and is_active (sys_customers_mst).
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_customers_mst
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.sys_customers_mst.customer_code IS
  'Globally unique human-friendly customer code generated first in sys_customers_mst and propagated to org_customers_mst when connected to a tenant.';
COMMENT ON COLUMN public.sys_customers_mst.is_active IS
  'Soft-active flag for global customer identity records. Inactive records are excluded from active phone/email uniqueness constraints.';

-- Backfill sys_customers_mst.customer_code deterministically before enforcing NOT NULL.
UPDATE public.sys_customers_mst
SET customer_code = public.gen_sys_customer_code()
WHERE customer_code IS NULL OR btrim(customer_code) = '';

ALTER TABLE public.sys_customers_mst
  ALTER COLUMN customer_code SET NOT NULL;

ALTER TABLE public.sys_customers_mst
  ADD CONSTRAINT chk_sys_cust_code_nonblank
    CHECK (btrim(customer_code) <> '');

COMMENT ON CONSTRAINT chk_sys_cust_code_nonblank ON public.sys_customers_mst IS
  'Prevents blank or whitespace-only customer_code values on global customer records.';

ALTER TABLE public.org_customers_mst
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

COMMENT ON COLUMN public.org_customers_mst.customer_code IS
  'Human-friendly customer code unique per tenant_org_id. Copied from sys_customers_mst.customer_code when linked, or generated locally for unlinked guest/B2B records.';

-- Backfill linked org_customers_mst rows from their parent sys_customers_mst.customer_code.
UPDATE public.org_customers_mst o
SET customer_code = s.customer_code
FROM public.sys_customers_mst s
WHERE o.customer_id = s.id
  AND (o.customer_code IS NULL OR btrim(o.customer_code) = '');

-- Backfill remaining unlinked org_customers_mst rows using tenant-local sequence codes.
UPDATE public.org_customers_mst
SET customer_code = public.gen_org_local_cust_code(
  CASE WHEN type = 'b2b' THEN 'B2B' ELSE 'GST' END
)
WHERE customer_code IS NULL OR btrim(customer_code) = '';

ALTER TABLE public.org_customers_mst
  ALTER COLUMN customer_code SET NOT NULL;

ALTER TABLE public.org_customers_mst
  ADD CONSTRAINT chk_org_cust_code_nonblank
    CHECK (btrim(customer_code) <> '');

COMMENT ON CONSTRAINT chk_org_cust_code_nonblank ON public.org_customers_mst IS
  'Prevents blank or whitespace-only customer_code values on tenant customer records.';

-- -----------------------------------------------------------------------------
-- 4. Unique indexes for customer_code, phone, and normalized email.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_sys_cust_code
  ON public.sys_customers_mst (customer_code);

CREATE UNIQUE INDEX uq_sys_cust_phone
  ON public.sys_customers_mst (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '' AND is_active = true;

CREATE UNIQUE INDEX uq_sys_cust_email
  ON public.sys_customers_mst (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '' AND is_active = true;

COMMENT ON INDEX public.uq_sys_cust_code IS
  'Guarantees global uniqueness of customer_code across sys_customers_mst.';
COMMENT ON INDEX public.uq_sys_cust_phone IS
  'Prevents duplicate active global customer identities sharing the same normalized E.164 phone number.';
COMMENT ON INDEX public.uq_sys_cust_email IS
  'Prevents duplicate active global customer identities sharing the same case-insensitive trimmed email address.';

CREATE UNIQUE INDEX uq_org_cust_tenant_code
  ON public.org_customers_mst (tenant_org_id, customer_code);

CREATE UNIQUE INDEX uq_org_cust_tenant_phone
  ON public.org_customers_mst (tenant_org_id, phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '' AND is_active = true;

CREATE UNIQUE INDEX uq_org_cust_tenant_email
  ON public.org_customers_mst (tenant_org_id, lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '' AND is_active = true;

COMMENT ON INDEX public.uq_org_cust_tenant_code IS
  'Enforces uniqueness of customer_code within each tenant organization.';
COMMENT ON INDEX public.uq_org_cust_tenant_phone IS
  'Prevents duplicate active customer accounts with the same phone number within the same tenant organization.';
COMMENT ON INDEX public.uq_org_cust_tenant_email IS
  'Prevents duplicate active customer accounts with the same case-insensitive email within the same tenant organization.';

-- -----------------------------------------------------------------------------
-- 5. Audit detail table for global identities: sys_customer_audit_dtl
-- -----------------------------------------------------------------------------
CREATE TABLE public.sys_customer_audit_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sys_customer_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_values JSONB,
  new_values JSONB,
  actor_user_id UUID,
  actor_tenant_org_id UUID,
  source_channel TEXT NOT NULL DEFAULT 'WEB_ADMIN',
  notes TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_sys_cust_aud_cust
    FOREIGN KEY (sys_customer_id)
    REFERENCES public.sys_customers_mst(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_sys_cust_aud_act
    CHECK (action_type IN ('CREATED', 'PROFILE_UPDATED', 'LINKED_TO_TENANT', 'STATUS_CHANGED'))
);

COMMENT ON TABLE public.sys_customer_audit_dtl IS
  'Immutable audit log of global customer identity lifecycle and profile changes on sys_customers_mst.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.id IS
  'Primary key UUID for the global customer audit entry.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.sys_customer_id IS
  'Foreign key to the audited sys_customers_mst record.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.action_type IS
  'Lifecycle event category: CREATED, PROFILE_UPDATED, LINKED_TO_TENANT, or STATUS_CHANGED.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.changed_fields IS
  'JSON array of column names modified by this event.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.old_values IS
  'JSON snapshot of affected field values before the change (NULL on CREATED).';
COMMENT ON COLUMN public.sys_customer_audit_dtl.new_values IS
  'JSON snapshot of affected field values after the change.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.actor_user_id IS
  'Authenticated staff/system user UUID that triggered the change, when available.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.actor_tenant_org_id IS
  'Tenant organization UUID from which the action originated, for platform audit traceability.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.source_channel IS
  'Originating application channel (e.g. WEB_ADMIN, POS, CUSTOMER_APP, SYSTEM).';
COMMENT ON COLUMN public.sys_customer_audit_dtl.notes IS
  'Optional human-readable operational context for the audit entry.';
COMMENT ON COLUMN public.sys_customer_audit_dtl.changed_at IS
  'UTC timestamp when the audited change was committed.';
COMMENT ON CONSTRAINT fk_sys_cust_aud_cust ON public.sys_customer_audit_dtl IS
  'Links each global audit record to its parent sys_customers_mst row without cascading deletes.';
COMMENT ON CONSTRAINT chk_sys_cust_aud_act ON public.sys_customer_audit_dtl IS
  'Restricts action_type to the canonical set of global customer audit events.';

CREATE INDEX idx_sys_cust_aud_cust
  ON public.sys_customer_audit_dtl (sys_customer_id, changed_at DESC);

COMMENT ON INDEX public.idx_sys_cust_aud_cust IS
  'Supports chronological audit history retrieval per global customer identity.';

-- Global audit table stays closed to anon and authenticated roles; server-side only.
REVOKE ALL ON TABLE public.sys_customer_audit_dtl FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.sys_customer_audit_dtl TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Audit detail table for tenant accounts: org_customer_audit_dtl
-- -----------------------------------------------------------------------------
CREATE TABLE public.org_customer_audit_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  org_customer_id UUID NOT NULL,
  sys_customer_id UUID,
  action_type TEXT NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_values JSONB,
  new_values JSONB,
  actor_user_id UUID,
  source_channel TEXT NOT NULL DEFAULT 'WEB_ADMIN',
  notes TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_org_cust_aud_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_org_cust_aud_cust
    FOREIGN KEY (org_customer_id, tenant_org_id)
    REFERENCES public.org_customers_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_org_cust_aud_sys
    FOREIGN KEY (sys_customer_id)
    REFERENCES public.sys_customers_mst(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_org_cust_aud_act
    CHECK (action_type IN ('CREATED', 'LINKED_FROM_SYS', 'REACTIVATED', 'PROFILE_UPDATED', 'COMMERCIAL_UPDATED', 'DEACTIVATED'))
);

COMMENT ON TABLE public.org_customer_audit_dtl IS
  'Immutable tenant-scoped audit log of customer creation, global linking, reactivation, profile edits, and commercial updates on org_customers_mst.';
COMMENT ON COLUMN public.org_customer_audit_dtl.id IS
  'Primary key UUID for the tenant customer audit entry.';
COMMENT ON COLUMN public.org_customer_audit_dtl.tenant_org_id IS
  'Owning tenant organization UUID enforcing strict multi-tenant isolation.';
COMMENT ON COLUMN public.org_customer_audit_dtl.org_customer_id IS
  'Foreign key to the audited org_customers_mst row within the same tenant.';
COMMENT ON COLUMN public.org_customer_audit_dtl.sys_customer_id IS
  'Optional foreign key to the linked sys_customers_mst identity at the time of the event.';
COMMENT ON COLUMN public.org_customer_audit_dtl.action_type IS
  'Lifecycle event category: CREATED, LINKED_FROM_SYS, REACTIVATED, PROFILE_UPDATED, COMMERCIAL_UPDATED, or DEACTIVATED.';
COMMENT ON COLUMN public.org_customer_audit_dtl.changed_fields IS
  'JSON array of column names modified by this event.';
COMMENT ON COLUMN public.org_customer_audit_dtl.old_values IS
  'JSON snapshot of affected field values before the change (NULL on CREATED/LINKED_FROM_SYS).';
COMMENT ON COLUMN public.org_customer_audit_dtl.new_values IS
  'JSON snapshot of affected field values after the change.';
COMMENT ON COLUMN public.org_customer_audit_dtl.actor_user_id IS
  'Authenticated tenant staff user UUID that performed the change.';
COMMENT ON COLUMN public.org_customer_audit_dtl.source_channel IS
  'Originating application channel (e.g. WEB_ADMIN, POS, SYSTEM).';
COMMENT ON COLUMN public.org_customer_audit_dtl.notes IS
  'Optional operational context or reason for the change.';
COMMENT ON COLUMN public.org_customer_audit_dtl.changed_at IS
  'UTC timestamp when the audited change was committed.';
COMMENT ON CONSTRAINT fk_org_cust_aud_tenant ON public.org_customer_audit_dtl IS
  'Ensures every audit row belongs to a valid tenant organization.';
COMMENT ON CONSTRAINT fk_org_cust_aud_cust ON public.org_customer_audit_dtl IS
  'Prisma-safe composite FK matching uq_org_cust_id_tenant (id, tenant_org_id) to guarantee same-tenant customer ownership.';
COMMENT ON CONSTRAINT fk_org_cust_aud_sys ON public.org_customer_audit_dtl IS
  'Optional reference to the global sys_customers_mst record linked at the time of the event.';
COMMENT ON CONSTRAINT chk_org_cust_aud_act ON public.org_customer_audit_dtl IS
  'Restricts action_type to the canonical set of tenant customer audit events.';

-- Tenant-first index for efficient tenant-scoped customer audit timeline queries.
CREATE INDEX idx_org_cust_aud_tenant
  ON public.org_customer_audit_dtl (tenant_org_id, org_customer_id, changed_at DESC);

COMMENT ON INDEX public.idx_org_cust_aud_tenant IS
  'Tenant-first index supporting paginated audit timeline queries for a specific tenant customer.';

ALTER TABLE public.org_customer_audit_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_oca_read
  ON public.org_customer_audit_dtl
  FOR SELECT
  USING (tenant_org_id = public.current_tenant_id());

CREATE POLICY tenant_iso_oca_write
  ON public.org_customer_audit_dtl
  FOR INSERT
  WITH CHECK (tenant_org_id = public.current_tenant_id());

COMMENT ON POLICY tenant_iso_oca_read ON public.org_customer_audit_dtl IS
  'Restricts tenant customer audit reads to the current authenticated Organization context.';
COMMENT ON POLICY tenant_iso_oca_write ON public.org_customer_audit_dtl IS
  'Allows append-only tenant customer audit inserts only for the current authenticated Organization context.';

-- Append-only for authenticated users; anon has zero access.
REVOKE ALL ON TABLE public.org_customer_audit_dtl FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.org_customer_audit_dtl TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Atomic Create-or-Connect RPC: org_cust_create_or_connect
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_cust_create_or_connect(
  p_tenant_org_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT 'stub',
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_name2 TEXT DEFAULT NULL,
  p_phone_e164 TEXT DEFAULT NULL,
  p_email_norm TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_building TEXT DEFAULT NULL,
  p_floor TEXT DEFAULT NULL,
  p_preferences JSONB DEFAULT '{}'::jsonb,
  p_customer_category_id UUID DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_company_name2 TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_cr_id TEXT DEFAULT NULL,
  p_credit_limit DECIMAL(19, 4) DEFAULT NULL,
  p_payment_terms_days INTEGER DEFAULT NULL,
  p_cost_center_code TEXT DEFAULT NULL,
  p_source_channel TEXT DEFAULT 'WEB_ADMIN',
  p_connect_sys_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  org_customer_id UUID,
  sys_customer_id UUID,
  customer_code TEXT,
  action_result TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone TEXT := NULLIF(btrim(COALESCE(p_phone_e164, '')), '');
  v_email TEXT := NULLIF(lower(btrim(COALESCE(p_email_norm, ''))), '');
  v_type TEXT := COALESCE(NULLIF(btrim(p_type), ''), 'stub');
  v_existing_org RECORD;
  v_sys_by_phone RECORD;
  v_sys_by_email RECORD;
  v_sys_rec RECORD;
  v_sys_id UUID := NULL;
  v_org_id UUID := NULL;
  v_code TEXT := NULL;
  v_first_name TEXT;
  v_last_name TEXT;
  v_display_name TEXT;
  v_name TEXT;
  v_name2 TEXT;
  v_is_global_eligible BOOLEAN;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_org_id IS NULL THEN
    RAISE EXCEPTION 'CMX_TENANT_REQUIRED: tenant_org_id is required';
  END IF;

  -- Serialize concurrent creates for the same normalized phone or email.
  IF v_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cmx_cust_phone:' || v_phone));
  END IF;
  IF v_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cmx_cust_email:' || v_email));
  END IF;

  -- 1. Check whether this tenant already has a customer with the same phone or email.
  IF v_phone IS NOT NULL OR v_email IS NOT NULL THEN
    SELECT o.id, o.customer_id, o.customer_code, o.is_active
    INTO v_existing_org
    FROM public.org_customers_mst o
    WHERE o.tenant_org_id = p_tenant_org_id
      AND (
        (v_phone IS NOT NULL AND o.phone = v_phone)
        OR (v_email IS NOT NULL AND o.email IS NOT NULL AND lower(btrim(o.email)) = v_email)
      )
    ORDER BY o.is_active DESC, o.created_at ASC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_existing_org.id,
        v_existing_org.customer_id,
        v_existing_org.customer_code,
        CASE WHEN v_existing_org.is_active THEN 'ALREADY_EXISTS' ELSE 'INACTIVE_EXISTS' END;
      RETURN;
    END IF;
  END IF;

  v_is_global_eligible := (v_type NOT IN ('guest', 'b2b')) AND (v_phone IS NOT NULL OR v_email IS NOT NULL);

  -- 2. Tenant-local branch (guest without contact or B2B company).
  IF NOT v_is_global_eligible THEN
    v_code := public.gen_org_local_cust_code(CASE WHEN v_type = 'b2b' THEN 'B2B' ELSE 'GST' END);
    v_first_name := COALESCE(NULLIF(btrim(COALESCE(p_first_name, '')), ''), NULLIF(btrim(COALESCE(p_company_name, '')), ''), 'Guest');
    v_last_name := NULLIF(btrim(COALESCE(p_last_name, '')), '');
    v_display_name := COALESCE(NULLIF(btrim(COALESCE(p_display_name, '')), ''), btrim(v_first_name || ' ' || COALESCE(v_last_name, '')));
    v_name := COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), v_display_name);
    v_name2 := NULLIF(btrim(COALESCE(p_name2, '')), '');

    INSERT INTO public.org_customers_mst (
      tenant_org_id,
      customer_id,
      customer_code,
      first_name,
      last_name,
      display_name,
      name,
      name2,
      phone,
      email,
      type,
      address,
      area,
      building,
      floor,
      preferences,
      customer_category_id,
      company_name,
      company_name2,
      tax_id,
      cr_id,
      credit_limit,
      payment_terms_days,
      cost_center_code,
      is_active,
      rec_status,
      created_at,
      created_by
    ) VALUES (
      p_tenant_org_id,
      NULL,
      v_code,
      v_first_name,
      v_last_name,
      v_display_name,
      v_name,
      v_name2,
      v_phone,
      v_email,
      v_type,
      p_address,
      p_area,
      p_building,
      p_floor,
      COALESCE(p_preferences, '{}'::jsonb),
      p_customer_category_id,
      p_company_name,
      p_company_name2,
      p_tax_id,
      p_cr_id,
      p_credit_limit,
      p_payment_terms_days,
      p_cost_center_code,
      true,
      1,
      v_now,
      p_actor_user_id
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.org_customer_audit_dtl (
      tenant_org_id,
      org_customer_id,
      sys_customer_id,
      action_type,
      changed_fields,
      old_values,
      new_values,
      actor_user_id,
      source_channel,
      changed_at
    ) VALUES (
      p_tenant_org_id,
      v_org_id,
      NULL,
      'CREATED',
      jsonb_build_array('customer_code', 'type', 'first_name', 'phone', 'email'),
      NULL,
      jsonb_build_object(
        'customer_code', v_code,
        'type', v_type,
        'first_name', v_first_name,
        'last_name', v_last_name,
        'phone', v_phone,
        'email', v_email
      ),
      p_actor_user_id,
      COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
      v_now
    );

    RETURN QUERY SELECT v_org_id, NULL::UUID, v_code, 'CREATED_NEW'::TEXT;
    RETURN;
  END IF;

  -- 3. Global lookup in sys_customers_mst by exact normalized phone and/or email.
  IF v_phone IS NOT NULL THEN
    SELECT s.*
    INTO v_sys_by_phone
    FROM public.sys_customers_mst s
    WHERE s.is_active = true
      AND (s.phone = v_phone OR s.mobile_e164 = v_phone)
    LIMIT 1;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT s.*
    INTO v_sys_by_email
    FROM public.sys_customers_mst s
    WHERE s.is_active = true
      AND (
        (s.email IS NOT NULL AND lower(btrim(s.email)) = v_email)
        OR s.email_normalized = v_email
      )
    LIMIT 1;
  END IF;

  -- Reject if phone and email resolve to two different global customers.
  IF v_sys_by_phone.id IS NOT NULL AND v_sys_by_email.id IS NOT NULL AND v_sys_by_phone.id <> v_sys_by_email.id THEN
    RAISE EXCEPTION 'CMX_IDENTITY_CONFLICT: Phone and email belong to two different global customer records';
  END IF;

  IF v_sys_by_phone.id IS NOT NULL THEN
    v_sys_rec := v_sys_by_phone;
  ELSIF v_sys_by_email.id IS NOT NULL THEN
    v_sys_rec := v_sys_by_email;
  ELSIF p_connect_sys_customer_id IS NOT NULL THEN
    SELECT s.*
    INTO v_sys_rec
    FROM public.sys_customers_mst s
    WHERE s.id = p_connect_sys_customer_id
      AND s.is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CMX_SYS_CUSTOMER_NOT_FOUND: Requested global customer does not exist';
    END IF;
  END IF;

  IF v_sys_rec.id IS NOT NULL THEN
    -- 3a. Connect existing sys_customers_mst record to this tenant.
    v_sys_id := v_sys_rec.id;
    v_code := v_sys_rec.customer_code;

    -- Guard against duplicate link on (tenant_org_id, customer_id).
    SELECT o.id, o.customer_id, o.customer_code, o.is_active
    INTO v_existing_org
    FROM public.org_customers_mst o
    WHERE o.tenant_org_id = p_tenant_org_id
      AND o.customer_id = v_sys_id
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_existing_org.id,
        v_existing_org.customer_id,
        v_existing_org.customer_code,
        CASE WHEN v_existing_org.is_active THEN 'ALREADY_EXISTS' ELSE 'INACTIVE_EXISTS' END;
      RETURN;
    END IF;

    v_first_name := COALESCE(NULLIF(btrim(COALESCE(v_sys_rec.first_name, '')), ''), NULLIF(btrim(COALESCE(p_first_name, '')), ''), 'Customer');
    v_last_name := COALESCE(NULLIF(btrim(COALESCE(v_sys_rec.last_name, '')), ''), NULLIF(btrim(COALESCE(p_last_name, '')), ''));
    v_display_name := COALESCE(NULLIF(btrim(COALESCE(v_sys_rec.display_name, '')), ''), NULLIF(btrim(COALESCE(p_display_name, '')), ''), btrim(v_first_name || ' ' || COALESCE(v_last_name, '')));
    v_name := COALESCE(NULLIF(btrim(COALESCE(v_sys_rec.name, '')), ''), v_display_name);
    v_name2 := COALESCE(NULLIF(btrim(COALESCE(v_sys_rec.name2, '')), ''), NULLIF(btrim(COALESCE(p_name2, '')), ''));

    INSERT INTO public.org_customers_mst (
      tenant_org_id,
      customer_id,
      customer_code,
      first_name,
      last_name,
      display_name,
      name,
      name2,
      phone,
      email,
      type,
      address,
      area,
      building,
      floor,
      preferences,
      customer_category_id,
      is_active,
      rec_status,
      created_at,
      created_by
    ) VALUES (
      p_tenant_org_id,
      v_sys_id,
      v_code,
      v_first_name,
      v_last_name,
      v_display_name,
      v_name,
      v_name2,
      COALESCE(v_sys_rec.phone, v_phone),
      COALESCE(v_sys_rec.email, v_email),
      v_type,
      p_address,
      p_area,
      p_building,
      p_floor,
      COALESCE(p_preferences, '{}'::jsonb),
      p_customer_category_id,
      true,
      1,
      v_now,
      p_actor_user_id
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.sys_customer_audit_dtl (
      sys_customer_id,
      action_type,
      changed_fields,
      old_values,
      new_values,
      actor_user_id,
      actor_tenant_org_id,
      source_channel,
      changed_at
    ) VALUES (
      v_sys_id,
      'LINKED_TO_TENANT',
      jsonb_build_array('linked_tenant_org_id', 'org_customer_id'),
      NULL,
      jsonb_build_object(
        'linked_tenant_org_id', p_tenant_org_id,
        'org_customer_id', v_org_id,
        'customer_code', v_code
      ),
      p_actor_user_id,
      p_tenant_org_id,
      COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
      v_now
    );

    INSERT INTO public.org_customer_audit_dtl (
      tenant_org_id,
      org_customer_id,
      sys_customer_id,
      action_type,
      changed_fields,
      old_values,
      new_values,
      actor_user_id,
      source_channel,
      changed_at
    ) VALUES (
      p_tenant_org_id,
      v_org_id,
      v_sys_id,
      'LINKED_FROM_SYS',
      jsonb_build_array('customer_id', 'customer_code', 'phone', 'email'),
      NULL,
      jsonb_build_object(
        'customer_id', v_sys_id,
        'customer_code', v_code,
        'first_name', v_first_name,
        'last_name', v_last_name,
        'phone', COALESCE(v_sys_rec.phone, v_phone),
        'email', COALESCE(v_sys_rec.email, v_email)
      ),
      p_actor_user_id,
      COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
      v_now
    );

    RETURN QUERY SELECT v_org_id, v_sys_id, v_code, 'CONNECTED_EXISTING'::TEXT;
    RETURN;
  END IF;

  -- 3b. Create brand new global identity in sys_customers_mst, then org_customers_mst.
  v_code := public.gen_sys_customer_code();
  v_first_name := COALESCE(NULLIF(btrim(COALESCE(p_first_name, '')), ''), 'Customer');
  v_last_name := NULLIF(btrim(COALESCE(p_last_name, '')), '');
  v_display_name := COALESCE(NULLIF(btrim(COALESCE(p_display_name, '')), ''), btrim(v_first_name || ' ' || COALESCE(v_last_name, '')));
  v_name := COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), v_display_name);
  v_name2 := NULLIF(btrim(COALESCE(p_name2, '')), '');

  INSERT INTO public.sys_customers_mst (
    customer_code,
    customer_number,
    first_name,
    last_name,
    display_name,
    name,
    name2,
    phone,
    mobile_e164,
    email,
    email_normalized,
    type,
    profile_status,
    first_tenant_org_id,
    is_active,
    created_at,
    created_by
  ) VALUES (
    v_code,
    v_code,
    v_first_name,
    v_last_name,
    v_display_name,
    v_name,
    v_name2,
    v_phone,
    v_phone,
    v_email,
    v_email,
    v_type,
    v_type,
    p_tenant_org_id,
    true,
    v_now,
    p_actor_user_id::TEXT
  )
  RETURNING id INTO v_sys_id;

  INSERT INTO public.org_customers_mst (
    tenant_org_id,
    customer_id,
    customer_code,
    first_name,
    last_name,
    display_name,
    name,
    name2,
    phone,
    email,
    type,
    address,
    area,
    building,
    floor,
    preferences,
    customer_category_id,
    is_active,
    rec_status,
    created_at,
    created_by
  ) VALUES (
    p_tenant_org_id,
    v_sys_id,
    v_code,
    v_first_name,
    v_last_name,
    v_display_name,
    v_name,
    v_name2,
    v_phone,
    v_email,
    v_type,
    p_address,
    p_area,
    p_building,
    p_floor,
    COALESCE(p_preferences, '{}'::jsonb),
    p_customer_category_id,
    true,
    1,
    v_now,
    p_actor_user_id
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.sys_customer_audit_dtl (
    sys_customer_id,
    action_type,
    changed_fields,
    old_values,
    new_values,
    actor_user_id,
    actor_tenant_org_id,
    source_channel,
    changed_at
  ) VALUES (
    v_sys_id,
    'CREATED',
    jsonb_build_array('customer_code', 'first_name', 'last_name', 'display_name', 'phone', 'email'),
    NULL,
    jsonb_build_object(
      'customer_code', v_code,
      'first_name', v_first_name,
      'last_name', v_last_name,
      'display_name', v_display_name,
      'phone', v_phone,
      'email', v_email
    ),
    p_actor_user_id,
    p_tenant_org_id,
    COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
    v_now
  );

  INSERT INTO public.org_customer_audit_dtl (
    tenant_org_id,
    org_customer_id,
    sys_customer_id,
    action_type,
    changed_fields,
    old_values,
    new_values,
    actor_user_id,
    source_channel,
    changed_at
  ) VALUES (
    p_tenant_org_id,
    v_org_id,
    v_sys_id,
    'CREATED',
    jsonb_build_array('customer_id', 'customer_code', 'type', 'first_name', 'last_name', 'phone', 'email'),
    NULL,
    jsonb_build_object(
      'customer_id', v_sys_id,
      'customer_code', v_code,
      'type', v_type,
      'first_name', v_first_name,
      'last_name', v_last_name,
      'phone', v_phone,
      'email', v_email
    ),
    p_actor_user_id,
    COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
    v_now
  );

  RETURN QUERY SELECT v_org_id, v_sys_id, v_code, 'CREATED_NEW'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.org_cust_create_or_connect(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT, TEXT, UUID
) IS
  'Atomically resolves a customer by normalized phone/email against org_customers_mst and sys_customers_mst, creates or connects the tenant account with a shared customer_code, and writes audit rows to sys_customer_audit_dtl and org_customer_audit_dtl.';

-- -----------------------------------------------------------------------------
-- 8. Atomic Update-and-Sync RPC: org_cust_update_and_sync
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_cust_update_and_sync(
  p_tenant_org_id UUID,
  p_org_customer_id UUID,
  p_patch JSONB,
  p_actor_user_id UUID DEFAULT NULL,
  p_source_channel TEXT DEFAULT 'WEB_ADMIN'
)
RETURNS TABLE (
  org_customer_id UUID,
  sys_customer_id UUID,
  synced_sys BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org public.org_customers_mst%ROWTYPE;
  v_sys public.sys_customers_mst%ROWTYPE;
  v_new_first_name TEXT;
  v_new_last_name TEXT;
  v_new_display_name TEXT;
  v_new_name TEXT;
  v_new_name2 TEXT;
  v_new_phone TEXT;
  v_new_email TEXT;
  v_new_address TEXT;
  v_new_area TEXT;
  v_new_building TEXT;
  v_new_floor TEXT;
  v_new_preferences JSONB;
  v_new_preferred_language TEXT;
  v_new_category_id UUID;
  v_new_is_active BOOLEAN;
  v_new_company_name TEXT;
  v_new_company_name2 TEXT;
  v_new_tax_id TEXT;
  v_new_cr_id TEXT;
  v_new_credit_limit DECIMAL(19, 4);
  v_new_payment_terms INTEGER;
  v_new_cost_center TEXT;
  v_new_credit_hold BOOLEAN;
  v_org_changed TEXT[] := ARRAY[]::TEXT[];
  v_org_old JSONB := '{}'::jsonb;
  v_org_new JSONB := '{}'::jsonb;
  v_sys_changed TEXT[] := ARRAY[]::TEXT[];
  v_sys_old JSONB := '{}'::jsonb;
  v_sys_new JSONB := '{}'::jsonb;
  v_action_type TEXT := 'PROFILE_UPDATED';
  v_synced_sys BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_org_id IS NULL OR p_org_customer_id IS NULL THEN
    RAISE EXCEPTION 'CMX_INVALID_ARGS: tenant_org_id and org_customer_id are required';
  END IF;

  SELECT *
  INTO v_org
  FROM public.org_customers_mst
  WHERE id = p_org_customer_id
    AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CMX_CUSTOMER_NOT_FOUND: Customer not found in tenant';
  END IF;

  -- Resolve patched values without overwriting omitted fields.
  v_new_first_name := CASE WHEN p_patch ? 'first_name' THEN NULLIF(btrim(COALESCE(p_patch->>'first_name', '')), '') ELSE v_org.first_name END;
  v_new_last_name := CASE WHEN p_patch ? 'last_name' THEN NULLIF(btrim(COALESCE(p_patch->>'last_name', '')), '') ELSE v_org.last_name END;
  v_new_display_name := CASE WHEN p_patch ? 'display_name' THEN NULLIF(btrim(COALESCE(p_patch->>'display_name', '')), '') ELSE v_org.display_name END;
  v_new_name := CASE WHEN p_patch ? 'name' THEN NULLIF(btrim(COALESCE(p_patch->>'name', '')), '') ELSE v_org.name END;
  v_new_name2 := CASE WHEN p_patch ? 'name2' THEN NULLIF(btrim(COALESCE(p_patch->>'name2', '')), '') ELSE v_org.name2 END;
  v_new_phone := CASE WHEN p_patch ? 'phone' THEN NULLIF(btrim(COALESCE(p_patch->>'phone', '')), '') ELSE v_org.phone END;
  v_new_email := CASE WHEN p_patch ? 'email' THEN NULLIF(lower(btrim(COALESCE(p_patch->>'email', ''))), '') ELSE v_org.email END;
  v_new_address := CASE WHEN p_patch ? 'address' THEN p_patch->>'address' ELSE v_org.address END;
  v_new_area := CASE WHEN p_patch ? 'area' THEN p_patch->>'area' ELSE v_org.area END;
  v_new_building := CASE WHEN p_patch ? 'building' THEN p_patch->>'building' ELSE v_org.building END;
  v_new_floor := CASE WHEN p_patch ? 'floor' THEN p_patch->>'floor' ELSE v_org.floor END;
  v_new_preferences := CASE WHEN p_patch ? 'preferences' THEN COALESCE(p_patch->'preferences', '{}'::jsonb) ELSE v_org.preferences END;
  v_new_preferred_language := CASE WHEN p_patch ? 'preferred_language' THEN NULLIF(btrim(COALESCE(p_patch->>'preferred_language', '')), '') ELSE v_org.preferred_language END;
  v_new_category_id := CASE WHEN p_patch ? 'customer_category_id' THEN NULLIF(p_patch->>'customer_category_id', '')::UUID ELSE v_org.customer_category_id END;
  v_new_is_active := CASE WHEN p_patch ? 'is_active' THEN (p_patch->>'is_active')::BOOLEAN ELSE v_org.is_active END;
  v_new_company_name := CASE WHEN p_patch ? 'company_name' THEN p_patch->>'company_name' ELSE v_org.company_name END;
  v_new_company_name2 := CASE WHEN p_patch ? 'company_name2' THEN p_patch->>'company_name2' ELSE v_org.company_name2 END;
  v_new_tax_id := CASE WHEN p_patch ? 'tax_id' THEN p_patch->>'tax_id' ELSE v_org.tax_id END;
  v_new_cr_id := CASE WHEN p_patch ? 'cr_id' THEN p_patch->>'cr_id' ELSE v_org.cr_id END;
  v_new_credit_limit := CASE WHEN p_patch ? 'credit_limit' THEN NULLIF(p_patch->>'credit_limit', '')::DECIMAL(19, 4) ELSE v_org.credit_limit END;
  v_new_payment_terms := CASE WHEN p_patch ? 'payment_terms_days' THEN NULLIF(p_patch->>'payment_terms_days', '')::INTEGER ELSE v_org.payment_terms_days END;
  v_new_cost_center := CASE WHEN p_patch ? 'cost_center_code' THEN p_patch->>'cost_center_code' ELSE v_org.cost_center_code END;
  v_new_credit_hold := CASE WHEN p_patch ? 'is_credit_hold' THEN (p_patch->>'is_credit_hold')::BOOLEAN ELSE v_org.is_credit_hold END;

  -- Build tenant-level field diff.
  IF v_new_first_name IS DISTINCT FROM v_org.first_name THEN
    v_org_changed := array_append(v_org_changed, 'first_name');
    v_org_old := v_org_old || jsonb_build_object('first_name', v_org.first_name);
    v_org_new := v_org_new || jsonb_build_object('first_name', v_new_first_name);
  END IF;
  IF v_new_last_name IS DISTINCT FROM v_org.last_name THEN
    v_org_changed := array_append(v_org_changed, 'last_name');
    v_org_old := v_org_old || jsonb_build_object('last_name', v_org.last_name);
    v_org_new := v_org_new || jsonb_build_object('last_name', v_new_last_name);
  END IF;
  IF v_new_display_name IS DISTINCT FROM v_org.display_name THEN
    v_org_changed := array_append(v_org_changed, 'display_name');
    v_org_old := v_org_old || jsonb_build_object('display_name', v_org.display_name);
    v_org_new := v_org_new || jsonb_build_object('display_name', v_new_display_name);
  END IF;
  IF v_new_name IS DISTINCT FROM v_org.name THEN
    v_org_changed := array_append(v_org_changed, 'name');
    v_org_old := v_org_old || jsonb_build_object('name', v_org.name);
    v_org_new := v_org_new || jsonb_build_object('name', v_new_name);
  END IF;
  IF v_new_name2 IS DISTINCT FROM v_org.name2 THEN
    v_org_changed := array_append(v_org_changed, 'name2');
    v_org_old := v_org_old || jsonb_build_object('name2', v_org.name2);
    v_org_new := v_org_new || jsonb_build_object('name2', v_new_name2);
  END IF;
  IF v_new_phone IS DISTINCT FROM v_org.phone THEN
    v_org_changed := array_append(v_org_changed, 'phone');
    v_org_old := v_org_old || jsonb_build_object('phone', v_org.phone);
    v_org_new := v_org_new || jsonb_build_object('phone', v_new_phone);
  END IF;
  IF v_new_email IS DISTINCT FROM v_org.email THEN
    v_org_changed := array_append(v_org_changed, 'email');
    v_org_old := v_org_old || jsonb_build_object('email', v_org.email);
    v_org_new := v_org_new || jsonb_build_object('email', v_new_email);
  END IF;
  IF v_new_address IS DISTINCT FROM v_org.address THEN
    v_org_changed := array_append(v_org_changed, 'address');
    v_org_old := v_org_old || jsonb_build_object('address', v_org.address);
    v_org_new := v_org_new || jsonb_build_object('address', v_new_address);
  END IF;
  IF v_new_area IS DISTINCT FROM v_org.area THEN
    v_org_changed := array_append(v_org_changed, 'area');
    v_org_old := v_org_old || jsonb_build_object('area', v_org.area);
    v_org_new := v_org_new || jsonb_build_object('area', v_new_area);
  END IF;
  IF v_new_building IS DISTINCT FROM v_org.building THEN
    v_org_changed := array_append(v_org_changed, 'building');
    v_org_old := v_org_old || jsonb_build_object('building', v_org.building);
    v_org_new := v_org_new || jsonb_build_object('building', v_new_building);
  END IF;
  IF v_new_floor IS DISTINCT FROM v_org.floor THEN
    v_org_changed := array_append(v_org_changed, 'floor');
    v_org_old := v_org_old || jsonb_build_object('floor', v_org.floor);
    v_org_new := v_org_new || jsonb_build_object('floor', v_new_floor);
  END IF;
  IF v_new_preferences IS DISTINCT FROM v_org.preferences THEN
    v_org_changed := array_append(v_org_changed, 'preferences');
    v_org_old := v_org_old || jsonb_build_object('preferences', v_org.preferences);
    v_org_new := v_org_new || jsonb_build_object('preferences', v_new_preferences);
  END IF;
  IF v_new_preferred_language IS DISTINCT FROM v_org.preferred_language THEN
    v_org_changed := array_append(v_org_changed, 'preferred_language');
    v_org_old := v_org_old || jsonb_build_object('preferred_language', v_org.preferred_language);
    v_org_new := v_org_new || jsonb_build_object('preferred_language', v_new_preferred_language);
  END IF;
  IF v_new_category_id IS DISTINCT FROM v_org.customer_category_id THEN
    v_org_changed := array_append(v_org_changed, 'customer_category_id');
    v_org_old := v_org_old || jsonb_build_object('customer_category_id', v_org.customer_category_id);
    v_org_new := v_org_new || jsonb_build_object('customer_category_id', v_new_category_id);
  END IF;
  IF v_new_is_active IS DISTINCT FROM v_org.is_active THEN
    v_org_changed := array_append(v_org_changed, 'is_active');
    v_org_old := v_org_old || jsonb_build_object('is_active', v_org.is_active);
    v_org_new := v_org_new || jsonb_build_object('is_active', v_new_is_active);
    v_action_type := CASE WHEN v_new_is_active THEN 'REACTIVATED' ELSE 'DEACTIVATED' END;
  END IF;
  IF v_new_company_name IS DISTINCT FROM v_org.company_name
     OR v_new_company_name2 IS DISTINCT FROM v_org.company_name2
     OR v_new_tax_id IS DISTINCT FROM v_org.tax_id
     OR v_new_cr_id IS DISTINCT FROM v_org.cr_id
     OR v_new_credit_limit IS DISTINCT FROM v_org.credit_limit
     OR v_new_payment_terms IS DISTINCT FROM v_org.payment_terms_days
     OR v_new_cost_center IS DISTINCT FROM v_org.cost_center_code
     OR v_new_credit_hold IS DISTINCT FROM v_org.is_credit_hold THEN
    v_org_changed := array_append(v_org_changed, 'commercial_fields');
    v_org_old := v_org_old || jsonb_build_object(
      'company_name', v_org.company_name,
      'tax_id', v_org.tax_id,
      'credit_limit', v_org.credit_limit,
      'is_credit_hold', v_org.is_credit_hold
    );
    v_org_new := v_org_new || jsonb_build_object(
      'company_name', v_new_company_name,
      'tax_id', v_new_tax_id,
      'credit_limit', v_new_credit_limit,
      'is_credit_hold', v_new_credit_hold
    );
    IF v_action_type = 'PROFILE_UPDATED' THEN
      v_action_type := 'COMMERCIAL_UPDATED';
    END IF;
  END IF;

  IF array_length(v_org_changed, 1) IS NULL THEN
    RETURN QUERY SELECT v_org.id, v_org.customer_id, false;
    RETURN;
  END IF;

  -- Update tenant customer record (strictly scoped by id + tenant_org_id).
  UPDATE public.org_customers_mst
  SET
    first_name = v_new_first_name,
    last_name = v_new_last_name,
    display_name = v_new_display_name,
    name = v_new_name,
    name2 = v_new_name2,
    phone = v_new_phone,
    email = v_new_email,
    address = v_new_address,
    area = v_new_area,
    building = v_new_building,
    floor = v_new_floor,
    preferences = v_new_preferences,
    preferred_language = v_new_preferred_language,
    customer_category_id = v_new_category_id,
    is_active = v_new_is_active,
    rec_status = CASE WHEN v_new_is_active THEN 1 ELSE 0 END,
    company_name = v_new_company_name,
    company_name2 = v_new_company_name2,
    tax_id = v_new_tax_id,
    cr_id = v_new_cr_id,
    credit_limit = v_new_credit_limit,
    payment_terms_days = v_new_payment_terms,
    cost_center_code = v_new_cost_center,
    is_credit_hold = v_new_credit_hold,
    updated_at = v_now,
    updated_by = p_actor_user_id
  WHERE id = p_org_customer_id
    AND tenant_org_id = p_tenant_org_id;

  INSERT INTO public.org_customer_audit_dtl (
    tenant_org_id,
    org_customer_id,
    sys_customer_id,
    action_type,
    changed_fields,
    old_values,
    new_values,
    actor_user_id,
    source_channel,
    changed_at
  ) VALUES (
    p_tenant_org_id,
    v_org.id,
    v_org.customer_id,
    v_action_type,
    to_jsonb(v_org_changed),
    v_org_old,
    v_org_new,
    p_actor_user_id,
    COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
    v_now
  );

  -- Sync shared profile fields to sys_customers_mst when linked.
  IF v_org.customer_id IS NOT NULL THEN
    SELECT *
    INTO v_sys
    FROM public.sys_customers_mst
    WHERE id = v_org.customer_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_new_first_name IS DISTINCT FROM v_sys.first_name AND (p_patch ? 'first_name') THEN
        v_sys_changed := array_append(v_sys_changed, 'first_name');
        v_sys_old := v_sys_old || jsonb_build_object('first_name', v_sys.first_name);
        v_sys_new := v_sys_new || jsonb_build_object('first_name', v_new_first_name);
      END IF;
      IF v_new_last_name IS DISTINCT FROM v_sys.last_name AND (p_patch ? 'last_name') THEN
        v_sys_changed := array_append(v_sys_changed, 'last_name');
        v_sys_old := v_sys_old || jsonb_build_object('last_name', v_sys.last_name);
        v_sys_new := v_sys_new || jsonb_build_object('last_name', v_new_last_name);
      END IF;
      IF v_new_display_name IS DISTINCT FROM v_sys.display_name AND (p_patch ? 'display_name') THEN
        v_sys_changed := array_append(v_sys_changed, 'display_name');
        v_sys_old := v_sys_old || jsonb_build_object('display_name', v_sys.display_name);
        v_sys_new := v_sys_new || jsonb_build_object('display_name', v_new_display_name);
      END IF;
      IF v_new_name IS DISTINCT FROM v_sys.name AND (p_patch ? 'name') THEN
        v_sys_changed := array_append(v_sys_changed, 'name');
        v_sys_old := v_sys_old || jsonb_build_object('name', v_sys.name);
        v_sys_new := v_sys_new || jsonb_build_object('name', v_new_name);
      END IF;
      IF v_new_name2 IS DISTINCT FROM v_sys.name2 AND (p_patch ? 'name2') THEN
        v_sys_changed := array_append(v_sys_changed, 'name2');
        v_sys_old := v_sys_old || jsonb_build_object('name2', v_sys.name2);
        v_sys_new := v_sys_new || jsonb_build_object('name2', v_new_name2);
      END IF;
      IF v_new_phone IS DISTINCT FROM v_sys.phone AND (p_patch ? 'phone') THEN
        v_sys_changed := array_append(v_sys_changed, 'phone');
        v_sys_old := v_sys_old || jsonb_build_object('phone', v_sys.phone);
        v_sys_new := v_sys_new || jsonb_build_object('phone', v_new_phone);
      END IF;
      IF v_new_email IS DISTINCT FROM v_sys.email AND (p_patch ? 'email') THEN
        v_sys_changed := array_append(v_sys_changed, 'email');
        v_sys_old := v_sys_old || jsonb_build_object('email', v_sys.email);
        v_sys_new := v_sys_new || jsonb_build_object('email', v_new_email);
      END IF;

      IF array_length(v_sys_changed, 1) IS NOT NULL THEN
        UPDATE public.sys_customers_mst
        SET
          first_name = CASE WHEN p_patch ? 'first_name' THEN v_new_first_name ELSE first_name END,
          last_name = CASE WHEN p_patch ? 'last_name' THEN v_new_last_name ELSE last_name END,
          display_name = CASE WHEN p_patch ? 'display_name' THEN v_new_display_name ELSE display_name END,
          name = CASE WHEN p_patch ? 'name' THEN v_new_name ELSE name END,
          name2 = CASE WHEN p_patch ? 'name2' THEN v_new_name2 ELSE name2 END,
          phone = CASE WHEN p_patch ? 'phone' THEN v_new_phone ELSE phone END,
          mobile_e164 = CASE WHEN p_patch ? 'phone' THEN v_new_phone ELSE mobile_e164 END,
          email = CASE WHEN p_patch ? 'email' THEN v_new_email ELSE email END,
          email_normalized = CASE WHEN p_patch ? 'email' THEN v_new_email ELSE email_normalized END,
          updated_at = v_now,
          updated_by = COALESCE(p_actor_user_id::TEXT, updated_by)
        WHERE id = v_org.customer_id;

        INSERT INTO public.sys_customer_audit_dtl (
          sys_customer_id,
          action_type,
          changed_fields,
          old_values,
          new_values,
          actor_user_id,
          actor_tenant_org_id,
          source_channel,
          changed_at
        ) VALUES (
          v_org.customer_id,
          'PROFILE_UPDATED',
          to_jsonb(v_sys_changed),
          v_sys_old,
          v_sys_new,
          p_actor_user_id,
          p_tenant_org_id,
          COALESCE(NULLIF(btrim(p_source_channel), ''), 'WEB_ADMIN'),
          v_now
        );

        v_synced_sys := true;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_org.id, v_org.customer_id, v_synced_sys;
END;
$$;

COMMENT ON FUNCTION public.org_cust_update_and_sync(UUID, UUID, JSONB, UUID, TEXT) IS
  'Atomically applies a partial JSONB update to org_customers_mst, writes org_customer_audit_dtl, and syncs modified shared profile fields to sys_customers_mst with a corresponding sys_customer_audit_dtl entry when linked.';

-- RPC functions are server-side only; web-admin routes invoke them via service_role after auth/RBAC/CSRF checks.
REVOKE ALL ON FUNCTION public.org_cust_create_or_connect(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_cust_create_or_connect(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT, TEXT, UUID
) TO service_role;

REVOKE ALL ON FUNCTION public.org_cust_update_and_sync(UUID, UUID, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_cust_update_and_sync(UUID, UUID, JSONB, UUID, TEXT) TO service_role;

COMMIT;
