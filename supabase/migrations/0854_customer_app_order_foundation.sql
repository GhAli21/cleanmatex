-- =============================================================================
-- 0854_customer_app_order_foundation.sql
-- Customer App Orders, Phase 1: secure identity, request intake and lineage.
--
-- Purpose:
--   Establish the persistent database contract for a global End Customer mobile
--   identity, tenant-specific customer visibility, customer-app branch
--   availability, fast quick-drop requests, and the one-request-to-one-order
--   source link. This migration deliberately stores only password hashes and
--   opaque session-token hashes; plaintext passwords and plaintext session
--   tokens must never enter this database.
--
-- Runtime boundary:
--   The future customer-app API is service-role-only. Tenant web-admin access
--   remains protected by RLS and permission-checked server actions. No customer
--   mobile client receives direct table access through this migration.
--
-- Deployment:
--   Forward-only draft. Review before application. Do not apply through an
--   agent, Supabase CLI, or MCP; the repository owner applies migrations.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- 1. Global End Customer credential authority.
-- -----------------------------------------------------------------------------
-- Existing org_customers_mst.password_hash remains legacy tenant data during
-- the controlled reset rollout. It is intentionally not copied: a password
-- hash cannot prove the customer's current password in a different authority.
ALTER TABLE public.sys_customers_mst
  ADD COLUMN mobile_e164 TEXT,
  ADD COLUMN email_normalized TEXT,
  ADD COLUMN app_password_hash TEXT,
  ADD COLUMN app_password_changed_at TIMESTAMPTZ,
  ADD COLUMN app_password_must_change BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN app_temp_password_expires_at TIMESTAMPTZ,
  ADD COLUMN app_failed_sign_in_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN app_locked_until TIMESTAMPTZ,
  ADD COLUMN app_session_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.sys_customers_mst
  ADD CONSTRAINT chk_sys_cust_app_fail_count
    CHECK (app_failed_sign_in_count >= 0),
  ADD CONSTRAINT chk_sys_cust_app_session_ver
    CHECK (app_session_version > 0),
  ADD CONSTRAINT chk_sys_cust_app_temp_expiry
    CHECK (
      app_temp_password_expires_at IS NULL
      OR app_password_must_change = true
    );

COMMENT ON COLUMN public.sys_customers_mst.mobile_e164 IS
  'Canonical global End Customer mobile identity in E.164 form. Login country code and local number are normalized to this value; legacy phone remains unchanged during transition.';
COMMENT ON COLUMN public.sys_customers_mst.email_normalized IS
  'Canonical lower-case trimmed global End Customer email identity. It is maintained by the credential service and never inferred from an ambiguous legacy email.';
COMMENT ON COLUMN public.sys_customers_mst.app_password_hash IS
  'Argon2id password hash for the global Customer App credential. Plaintext, reversible encryption, and a password_value column are prohibited.';
COMMENT ON COLUMN public.sys_customers_mst.app_password_changed_at IS
  'UTC instant when the global Customer App password was last set or changed.';
COMMENT ON COLUMN public.sys_customers_mst.app_password_must_change IS
  'Requires the customer to replace the tenant-issued temporary password before accessing Customer App data.';
COMMENT ON COLUMN public.sys_customers_mst.app_temp_password_expires_at IS
  'UTC expiry for the current tenant-issued temporary password. The credential service clears this after a successful password change.';
COMMENT ON COLUMN public.sys_customers_mst.app_failed_sign_in_count IS
  'Consecutive failed global Customer App password attempts since the last successful sign-in or reset.';
COMMENT ON COLUMN public.sys_customers_mst.app_locked_until IS
  'UTC lockout expiry imposed by the credential service after excessive failed sign-ins.';
COMMENT ON COLUMN public.sys_customers_mst.app_session_version IS
  'Positive global session epoch. Incrementing it invalidates every Customer App session after password reset, password change, or account-security action.';
COMMENT ON CONSTRAINT chk_sys_cust_app_fail_count ON public.sys_customers_mst IS
  'Prevents negative failed-sign-in counters, which would break lockout accounting.';
COMMENT ON CONSTRAINT chk_sys_cust_app_session_ver ON public.sys_customers_mst IS
  'Requires a positive session epoch so server-side session invalidation remains well-defined.';
COMMENT ON CONSTRAINT chk_sys_cust_app_temp_expiry ON public.sys_customers_mst IS
  'A temporary-password expiry may exist only while the customer is required to change that password.';

CREATE UNIQUE INDEX uq_sys_cust_mobile_e164
  ON public.sys_customers_mst (mobile_e164)
  WHERE mobile_e164 IS NOT NULL;

CREATE UNIQUE INDEX uq_sys_cust_email_norm
  ON public.sys_customers_mst (email_normalized)
  WHERE email_normalized IS NOT NULL;

COMMENT ON INDEX public.uq_sys_cust_mobile_e164 IS
  'Prevents more than one global End Customer identity using the same canonical E.164 mobile number.';
COMMENT ON INDEX public.uq_sys_cust_email_norm IS
  'Prevents more than one global End Customer identity using the same canonical email address.';

-- -----------------------------------------------------------------------------
-- 2. Opaque Customer App sessions.
-- -----------------------------------------------------------------------------
CREATE TABLE public.sys_cust_app_sessions_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoke_reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  CONSTRAINT fk_scus_customer
    FOREIGN KEY (customer_id) REFERENCES public.sys_customers_mst(id) ON DELETE RESTRICT,
  CONSTRAINT uq_scus_access_hash UNIQUE (access_token_hash),
  CONSTRAINT uq_scus_refresh_hash UNIQUE (refresh_token_hash),
  CONSTRAINT chk_scus_session_ver CHECK (session_version > 0),
  CONSTRAINT chk_scus_expiry_order CHECK (refresh_expires_at > access_expires_at),
  CONSTRAINT chk_scus_revoke_reason CHECK (
    revoked_at IS NULL OR revoke_reason_code IS NOT NULL
  )
);

COMMENT ON TABLE public.sys_cust_app_sessions_mst IS
  'Service-role-only persisted Customer App sessions. Only hashes of opaque access and refresh tokens are stored, enabling secure logout and global invalidation.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.id IS
  'Opaque primary identifier for one Customer App sign-in session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.customer_id IS
  'Global End Customer owning this session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.access_token_hash IS
  'One-way hash of the short-lived opaque access token; the token itself is never persisted.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.refresh_token_hash IS
  'One-way hash of the rotating opaque refresh token; the token itself is never persisted.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.session_version IS
  'Customer session epoch captured at issue time and compared on every authenticated request.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.access_expires_at IS
  'UTC instant after which the access token may no longer authenticate requests.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.refresh_expires_at IS
  'UTC instant after which the refresh token may no longer renew the session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.last_seen_at IS
  'UTC instant of the latest authenticated Customer App activity for this session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.revoked_at IS
  'UTC instant when this session was explicitly invalidated; NULL means not explicitly revoked.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.revoke_reason_code IS
  'Controlled non-secret reason code for explicit invalidation, such as LOGOUT, PASSWORD_RESET, or SECURITY_LOCK.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.created_at IS
  'UTC instant when this session was issued.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.created_by IS
  'Trusted service or authenticated actor that created the session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.created_info IS
  'Non-secret issue provenance, such as app platform and version.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.updated_at IS
  'UTC instant of the last permitted server-side session update.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.updated_by IS
  'Trusted service or authenticated actor that last updated the session.';
COMMENT ON COLUMN public.sys_cust_app_sessions_mst.updated_info IS
  'Non-secret update provenance for session audit investigation.';
COMMENT ON CONSTRAINT fk_scus_customer ON public.sys_cust_app_sessions_mst IS
  'Prevents a Customer App session from outliving or referencing an unknown global End Customer.';
COMMENT ON CONSTRAINT uq_scus_access_hash ON public.sys_cust_app_sessions_mst IS
  'Makes every persisted access-token hash globally unambiguous for constant-time lookup.';
COMMENT ON CONSTRAINT uq_scus_refresh_hash ON public.sys_cust_app_sessions_mst IS
  'Makes every persisted refresh-token hash globally unambiguous for safe rotation.';
COMMENT ON CONSTRAINT chk_scus_session_ver ON public.sys_cust_app_sessions_mst IS
  'Requires a positive captured session epoch for global logout and credential invalidation.';
COMMENT ON CONSTRAINT chk_scus_expiry_order ON public.sys_cust_app_sessions_mst IS
  'Requires the refresh credential to outlive the access credential it renews.';
COMMENT ON CONSTRAINT chk_scus_revoke_reason ON public.sys_cust_app_sessions_mst IS
  'Requires an audit reason whenever a session is explicitly revoked.';

CREATE INDEX ix_scus_customer_active
  ON public.sys_cust_app_sessions_mst (customer_id, refresh_expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON INDEX public.ix_scus_customer_active IS
  'Supports customer-scoped active-session invalidation without scanning expired or revoked sessions.';

REVOKE ALL ON TABLE public.sys_cust_app_sessions_mst FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_cust_app_sessions_mst TO service_role;
COMMENT ON TABLE public.sys_cust_app_sessions_mst IS
  'Service-role-only persisted Customer App sessions. Only hashes of opaque access and refresh tokens are stored, enabling secure logout and global invalidation; anon and authenticated roles have no direct access.';

-- -----------------------------------------------------------------------------
-- 3. Customer-controlled tenant visibility and branch availability.
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_customers_mst
  ADD COLUMN is_hidden_by_customer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.org_customers_mst.is_hidden_by_customer IS
  'Customer-controlled visibility preference for this Organization relationship. Hiding never deactivates the relationship, alters order history, or deletes data.';

ALTER TABLE public.org_branches_mst
  ADD COLUMN is_customer_app_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_pos_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.org_branches_mst.is_customer_app_enabled IS
  'Explicit opt-in for discovery and booking in the Customer App. Existing branches remain hidden until an Organization enables them.';
COMMENT ON COLUMN public.org_branches_mst.is_pos_enabled IS
  'Controls whether this branch is eligible for point-of-sale order creation. Existing operating branches retain POS availability by default.';

-- -----------------------------------------------------------------------------
-- 4. Customer-originated requests. A request never carries money or prices;
--    the future conversion service creates the authoritative commercial order.
-- -----------------------------------------------------------------------------
CREATE TABLE public.org_ord_requests_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  request_no TEXT NOT NULL,
  customer_id UUID NOT NULL,
  requested_branch_id UUID,
  request_type_code TEXT NOT NULL DEFAULT 'FAST_QUICK_DROP',
  request_source_code TEXT NOT NULL DEFAULT 'CUSTOMER_APP',
  request_status_code TEXT NOT NULL DEFAULT 'SUBMITTED',
  branch_verification_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  service_speed_code TEXT,
  collection_method_code TEXT NOT NULL DEFAULT 'DROP_OFF',
  return_delivery_requested BOOLEAN NOT NULL DEFAULT false,
  collection_address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_total_pieces INTEGER NOT NULL DEFAULT 0,
  customer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_orq_tenant
    FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orq_cust_tenant
    FOREIGN KEY (customer_id, tenant_org_id)
    REFERENCES public.org_customers_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orq_branch_tenant
    FOREIGN KEY (requested_branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orq_speed
    FOREIGN KEY (service_speed_code) REFERENCES public.sys_service_speed_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_orq_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_orq_no_tenant UNIQUE (tenant_org_id, request_no),
  CONSTRAINT chk_orq_request_no CHECK (btrim(request_no) <> ''),
  CONSTRAINT chk_orq_type CHECK (request_type_code IN ('FAST_QUICK_DROP')),
  CONSTRAINT chk_orq_source CHECK (request_source_code IN ('CUSTOMER_APP')),
  CONSTRAINT chk_orq_status CHECK (
    request_status_code IN ('SUBMITTED', 'IN_REVIEW', 'AWAITING_CUSTOMER', 'CONVERTED', 'DECLINED', 'CANCELLED')
  ),
  CONSTRAINT chk_orq_branch_verify CHECK (
    branch_verification_status IN ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED')
  ),
  CONSTRAINT chk_orq_collection CHECK (
    collection_method_code IN ('DROP_OFF', 'COLLECT_FROM_ADDRESS')
  ),
  CONSTRAINT chk_orq_piece_count CHECK (estimated_total_pieces >= 0),
  CONSTRAINT chk_orq_cancelled CHECK (
    (request_status_code <> 'CANCELLED' AND cancelled_at IS NULL)
    OR (request_status_code = 'CANCELLED' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT chk_orq_converted CHECK (
    (request_status_code <> 'CONVERTED' AND converted_at IS NULL)
    OR (request_status_code = 'CONVERTED' AND converted_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.org_ord_requests_mst IS
  'Tenant-owned customer order-intake request. It captures customer-declared collection details only; authoritative pricing, taxes, workflow, and payment are created later in org_orders_mst.';
COMMENT ON COLUMN public.org_ord_requests_mst.id IS 'Stable opaque identity for one customer-originated request.';
COMMENT ON COLUMN public.org_ord_requests_mst.tenant_org_id IS 'Immutable Organization owner used for RLS and every tenant-safe reference.';
COMMENT ON COLUMN public.org_ord_requests_mst.request_no IS 'Organization-unique human-readable request number allocated by the request service.';
COMMENT ON COLUMN public.org_ord_requests_mst.customer_id IS 'Organization customer relationship that submitted this request, protected by a tenant-safe composite foreign key.';
COMMENT ON COLUMN public.org_ord_requests_mst.requested_branch_id IS 'Optional Organization branch selected by the customer; it may require staff verification before conversion.';
COMMENT ON COLUMN public.org_ord_requests_mst.request_type_code IS 'Request workflow type. Phase 1 permits only FAST_QUICK_DROP; future types require an explicit schema and API expansion.';
COMMENT ON COLUMN public.org_ord_requests_mst.request_source_code IS 'Provenance channel. Phase 1 permits only CUSTOMER_APP so staff-created requests cannot be misrepresented as customer submissions.';
COMMENT ON COLUMN public.org_ord_requests_mst.request_status_code IS 'Lifecycle projection for request tracking. CONVERTED means a linked real order now exists.';
COMMENT ON COLUMN public.org_ord_requests_mst.branch_verification_status IS 'Staff validation state for the selected branch or collection address. It does not replace customer communication or operational acceptance.';
COMMENT ON COLUMN public.org_ord_requests_mst.service_speed_code IS 'Optional customer-selected service speed from the platform service-speed catalog. It is a preference, not a price commitment.';
COMMENT ON COLUMN public.org_ord_requests_mst.collection_method_code IS 'Whether the customer will drop items at a branch or requests collection from the stored address snapshot.';
COMMENT ON COLUMN public.org_ord_requests_mst.return_delivery_requested IS 'Customer preference to receive the completed work by delivery; fulfilment feasibility and charges are decided during staff conversion.';
COMMENT ON COLUMN public.org_ord_requests_mst.collection_address_snapshot IS 'Customer-entered collection-address snapshot retained for review history. It contains no payment data and is used only when collection is requested.';
COMMENT ON COLUMN public.org_ord_requests_mst.estimated_total_pieces IS 'Customer-estimated total piece count. It is an operational hint and never an authoritative order quantity or price input.';
COMMENT ON COLUMN public.org_ord_requests_mst.customer_notes IS 'Optional customer-facing free-text instructions for staff review.';
COMMENT ON COLUMN public.org_ord_requests_mst.submitted_at IS 'UTC instant when the customer submitted the request.';
COMMENT ON COLUMN public.org_ord_requests_mst.reviewed_at IS 'UTC instant of the latest staff review action.';
COMMENT ON COLUMN public.org_ord_requests_mst.reviewed_by IS 'Authenticated staff actor or trusted service that last reviewed the request.';
COMMENT ON COLUMN public.org_ord_requests_mst.converted_at IS 'UTC instant when the controlled conversion service created the linked commercial order.';
COMMENT ON COLUMN public.org_ord_requests_mst.cancelled_at IS 'UTC instant when the request was cancelled.';
COMMENT ON COLUMN public.org_ord_requests_mst.cancellation_reason IS 'Optional staff- or customer-supplied cancellation explanation retained for customer support.';
COMMENT ON COLUMN public.org_ord_requests_mst.created_at IS 'UTC instant when this request row was created.';
COMMENT ON COLUMN public.org_ord_requests_mst.created_by IS 'Authenticated actor or trusted service that created the request row.';
COMMENT ON COLUMN public.org_ord_requests_mst.created_info IS 'Non-secret creation provenance such as customer app version.';
COMMENT ON COLUMN public.org_ord_requests_mst.updated_at IS 'UTC instant of the latest permitted request update.';
COMMENT ON COLUMN public.org_ord_requests_mst.updated_by IS 'Authenticated actor or trusted service that last updated the request.';
COMMENT ON COLUMN public.org_ord_requests_mst.updated_info IS 'Non-secret latest-update provenance.';
COMMENT ON COLUMN public.org_ord_requests_mst.rec_status IS 'Standard record lifecycle marker; 1 means operationally active.';
COMMENT ON COLUMN public.org_ord_requests_mst.rec_order IS 'Optional administrative display ordering value.';
COMMENT ON COLUMN public.org_ord_requests_mst.rec_notes IS 'Internal non-secret administrative note, never returned to the customer.';
COMMENT ON COLUMN public.org_ord_requests_mst.is_active IS 'Soft-active marker; inactive requests remain auditable and visible according to authorized history rules.';
COMMENT ON CONSTRAINT fk_orq_tenant ON public.org_ord_requests_mst IS 'Requires each request to belong to an existing Organization.';
COMMENT ON CONSTRAINT fk_orq_cust_tenant ON public.org_ord_requests_mst IS 'Prevents a request from naming a customer relationship owned by another Organization.';
COMMENT ON CONSTRAINT fk_orq_branch_tenant ON public.org_ord_requests_mst IS 'Prevents a request from naming a branch owned by another Organization.';
COMMENT ON CONSTRAINT fk_orq_speed ON public.org_ord_requests_mst IS 'Restricts a requested service speed to the platform catalog.';
COMMENT ON CONSTRAINT uq_orq_id_tenant ON public.org_ord_requests_mst IS 'Provides a Prisma-safe composite identity for tenant-scoped child and order references.';
COMMENT ON CONSTRAINT uq_orq_no_tenant ON public.org_ord_requests_mst IS 'Prevents duplicate human-readable request numbers inside one Organization.';
COMMENT ON CONSTRAINT chk_orq_request_no ON public.org_ord_requests_mst IS 'Rejects blank request numbers so tracking and staff handoff remain usable.';
COMMENT ON CONSTRAINT chk_orq_type ON public.org_ord_requests_mst IS 'Limits Phase 1 request types to the approved Fast Quick Drop workflow.';
COMMENT ON CONSTRAINT chk_orq_source ON public.org_ord_requests_mst IS 'Limits Phase 1 request provenance to Customer App submissions.';
COMMENT ON CONSTRAINT chk_orq_status ON public.org_ord_requests_mst IS 'Restricts request lifecycle values to the documented tracking states.';
COMMENT ON CONSTRAINT chk_orq_branch_verify ON public.org_ord_requests_mst IS 'Restricts branch or address verification to explicit review outcomes.';
COMMENT ON CONSTRAINT chk_orq_collection ON public.org_ord_requests_mst IS 'Restricts collection preference to branch drop-off or address collection.';
COMMENT ON CONSTRAINT chk_orq_piece_count ON public.org_ord_requests_mst IS 'Rejects negative customer-estimated item counts.';
COMMENT ON CONSTRAINT chk_orq_cancelled ON public.org_ord_requests_mst IS 'Requires a cancellation timestamp exactly when the request is marked CANCELLED.';
COMMENT ON CONSTRAINT chk_orq_converted ON public.org_ord_requests_mst IS 'Requires a conversion timestamp exactly when the request is marked CONVERTED.';

CREATE INDEX ix_orq_tenant_status
  ON public.org_ord_requests_mst (tenant_org_id, request_status_code, submitted_at DESC);
CREATE INDEX ix_orq_customer_history
  ON public.org_ord_requests_mst (tenant_org_id, customer_id, submitted_at DESC);

COMMENT ON INDEX public.ix_orq_tenant_status IS
  'Supports the tenant request work queue by lifecycle state and newest submission.';
COMMENT ON INDEX public.ix_orq_customer_history IS
  'Supports customer-scoped request tracking history inside one Organization.';

CREATE TABLE public.org_ord_request_lines_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  request_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  service_category_code TEXT,
  product_id UUID,
  item_name TEXT NOT NULL,
  quantity DECIMAL(21,6) NOT NULL,
  customer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_orql_req_tenant
    FOREIGN KEY (request_id, tenant_org_id)
    REFERENCES public.org_ord_requests_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orql_svc_cat_tnt
    FOREIGN KEY (tenant_org_id, service_category_code)
    REFERENCES public.org_service_category_cf(tenant_org_id, service_category_code) ON DELETE RESTRICT,
  CONSTRAINT fk_orql_prod_tenant
    FOREIGN KEY (tenant_org_id, product_id)
    REFERENCES public.org_product_data_mst(tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_orql_line_no UNIQUE (tenant_org_id, request_id, line_no),
  CONSTRAINT chk_orql_line_no CHECK (line_no > 0),
  CONSTRAINT chk_orql_item_name CHECK (btrim(item_name) <> ''),
  CONSTRAINT chk_orql_qty CHECK (quantity > 0)
);

COMMENT ON TABLE public.org_ord_request_lines_dtl IS
  'Customer-declared item rows for a request. These are intake hints, not order lines, price snapshots, tax inputs, or inventory movements.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.id IS 'Stable opaque identity for one request item row.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.tenant_org_id IS 'Immutable Organization owner used for RLS and every tenant-safe reference.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.request_id IS 'Parent customer request, protected by a tenant-safe composite foreign key.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.line_no IS 'One-based stable display sequence unique within the parent request.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.service_category_code IS 'Optional Organization-enabled service category selected by the customer.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.product_id IS 'Optional Organization product selected by the customer. The submitted item_name remains a customer-facing snapshot for review.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.item_name IS 'Customer-declared or catalog-derived item description captured at submission time.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.quantity IS 'Customer-estimated quantity using the item context. It is not a billable or inventory quantity.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.customer_notes IS 'Optional row-specific customer instruction for staff review.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.created_at IS 'UTC instant when the request line was created.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.created_by IS 'Authenticated actor or trusted service that created the request line.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.updated_at IS 'UTC instant of the latest permitted request-line update.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.updated_by IS 'Authenticated actor or trusted service that last updated the request line.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.updated_info IS 'Non-secret latest-update provenance.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.rec_status IS 'Standard record lifecycle marker; 1 means operationally active.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.rec_order IS 'Optional administrative display ordering value.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.rec_notes IS 'Internal non-secret administrative note, never returned to the customer.';
COMMENT ON COLUMN public.org_ord_request_lines_dtl.is_active IS 'Soft-active marker; inactive lines remain auditable with their request.';
COMMENT ON CONSTRAINT fk_orql_req_tenant ON public.org_ord_request_lines_dtl IS 'Prevents a request line from referencing a parent request owned by another Organization.';
COMMENT ON CONSTRAINT fk_orql_svc_cat_tnt ON public.org_ord_request_lines_dtl IS 'Prevents a request line from selecting a service category not enabled for its Organization.';
COMMENT ON CONSTRAINT fk_orql_prod_tenant ON public.org_ord_request_lines_dtl IS 'Prevents a request line from selecting a product owned by another Organization.';
COMMENT ON CONSTRAINT uq_orql_line_no ON public.org_ord_request_lines_dtl IS 'Prevents duplicate display sequence numbers in a request.';
COMMENT ON CONSTRAINT chk_orql_line_no ON public.org_ord_request_lines_dtl IS 'Requires positive one-based request-line sequence numbers.';
COMMENT ON CONSTRAINT chk_orql_item_name ON public.org_ord_request_lines_dtl IS 'Rejects blank item descriptions even when the customer selects a catalog product.';
COMMENT ON CONSTRAINT chk_orql_qty ON public.org_ord_request_lines_dtl IS 'Rejects zero and negative customer-estimated quantities.';

CREATE INDEX ix_orql_request_lines
  ON public.org_ord_request_lines_dtl (tenant_org_id, request_id, line_no);

COMMENT ON INDEX public.ix_orql_request_lines IS
  'Supports ordered request-detail loading without a table scan.';

-- Tenant staff access is governed by existing authentication plus RLS; the
-- Customer App uses service APIs that additionally verify the global customer.
ALTER TABLE public.org_ord_requests_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_ord_request_lines_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_orq_read ON public.org_ord_requests_mst
  FOR SELECT USING (tenant_org_id = public.current_tenant_id());
CREATE POLICY tenant_iso_orq_write ON public.org_ord_requests_mst
  FOR ALL USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());
CREATE POLICY tenant_iso_orql_read ON public.org_ord_request_lines_dtl
  FOR SELECT USING (tenant_org_id = public.current_tenant_id());
CREATE POLICY tenant_iso_orql_write ON public.org_ord_request_lines_dtl
  FOR ALL USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());

COMMENT ON POLICY tenant_iso_orq_read ON public.org_ord_requests_mst IS
  'Allows tenant-scoped request reads only for the current authenticated Organization context.';
COMMENT ON POLICY tenant_iso_orq_write ON public.org_ord_requests_mst IS
  'Allows request writes only when the row owner matches the current authenticated Organization context.';
COMMENT ON POLICY tenant_iso_orql_read ON public.org_ord_request_lines_dtl IS
  'Allows tenant-scoped request-line reads only for the current authenticated Organization context.';
COMMENT ON POLICY tenant_iso_orql_write ON public.org_ord_request_lines_dtl IS
  'Allows request-line writes only when the row owner matches the current authenticated Organization context.';

REVOKE ALL ON TABLE public.org_ord_requests_mst FROM anon;
REVOKE ALL ON TABLE public.org_ord_request_lines_dtl FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_ord_requests_mst TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_ord_request_lines_dtl TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. One real order may originate from one request. The order-side link is the
--    authoritative lineage; request tracking joins through it rather than
--    maintaining a duplicated mutable created_order_id on the request header.
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN source_request_id UUID,
  ADD COLUMN source_request_no TEXT;

ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT fk_oom_src_req_tenant
    FOREIGN KEY (source_request_id, tenant_org_id)
    REFERENCES public.org_ord_requests_mst(id, tenant_org_id) ON DELETE RESTRICT,
  ADD CONSTRAINT chk_oom_src_req_pair
    CHECK (
      (source_request_id IS NULL AND source_request_no IS NULL)
      OR (source_request_id IS NOT NULL AND btrim(source_request_no) <> '')
    );

CREATE UNIQUE INDEX uq_oom_src_request
  ON public.org_orders_mst (tenant_org_id, source_request_id)
  WHERE source_request_id IS NOT NULL;

CREATE INDEX ix_oom_src_req_no
  ON public.org_orders_mst (tenant_org_id, source_request_no)
  WHERE source_request_no IS NOT NULL;

COMMENT ON COLUMN public.org_orders_mst.source_request_id IS
  'Optional customer request that this real commercial order was created from. This is the authoritative request-to-order lineage link.';
COMMENT ON COLUMN public.org_orders_mst.source_request_no IS
  'Immutable request-number snapshot for staff-facing search and audit; it is populated by the controlled conversion service with source_request_id.';
COMMENT ON CONSTRAINT fk_oom_src_req_tenant ON public.org_orders_mst IS
  'Prevents an order from declaring lineage to a customer request owned by another Organization.';
COMMENT ON CONSTRAINT chk_oom_src_req_pair ON public.org_orders_mst IS
  'Requires source_request_id and a nonblank source_request_no to be recorded together, preventing partial customer-request lineage.';
COMMENT ON INDEX public.uq_oom_src_request IS
  'Enforces one commercial order per customer request and supports request-to-order tracking lookup.';
COMMENT ON INDEX public.ix_oom_src_req_no IS
  'Supports Organization-scoped staff lookup by the immutable source request number.';

-- -----------------------------------------------------------------------------
-- 6. Tenant staff permissions. Existing customer read/update permissions do
--    not authorize credential issuance or request conversion.
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('customers:manage_credentials', 'Manage Customer App Credentials', 'إدارة بيانات دخول تطبيق العميل', 'actions',
   'Issue or reset a global Customer App temporary password. The action never reveals an existing password.',
   'إصدار أو إعادة تعيين كلمة مرور مؤقتة لتطبيق العميل. لا يعرض الإجراء كلمة مرور قائمة.',
   'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('order_requests:read', 'View Customer Order Requests', 'عرض طلبات العميل', 'read',
   'View customer-originated order requests and their non-commercial intake details.',
   'عرض طلبات الطلبات الواردة من العميل وتفاصيل الاستلام غير التجارية الخاصة بها.',
   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('order_requests:convert', 'Convert Customer Order Requests', 'تحويل طلبات العميل إلى طلبات', 'actions',
   'Review a customer order request and create its linked authoritative commercial order.',
   'مراجعة طلب العميل وإنشاء الطلب التجاري المعتمد المرتبط به.',
   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active = EXCLUDED.is_active,
  is_enabled = EXCLUDED.is_enabled,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
