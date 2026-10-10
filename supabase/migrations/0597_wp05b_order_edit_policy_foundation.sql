-- ============================================================================
-- Migration: 0597_wp05b_order_edit_policy_foundation.sql
-- Purpose: Establish the HQ-owned, fail-closed Edit Policy authority for Edit
-- Order V2 without enabling any tenant, feature flag, role, Preview, Apply,
-- or commercial writer.
-- Why: Workflow transitions cannot safely decide commercial mutations. These
-- explicit rules never bypass hard finance, fiscal, tenancy or structural guards.
-- Affected: sys_wf_order_edit_ops_cd, sys_wf_order_edit_op_tgt_cd,
-- sys_wf_edit_policy_mst, sys_wf_edit_policy_rule_dtl, org_wf_edit_policy_asg_cf.
-- Security: Browser roles have no table privileges; trusted servers still use
-- explicit tenant predicates for every org_* access.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Frozen V1 grammar. It contains no generic condition, facts, SQL, or
-- expression engine; server handlers remain explicit and fail closed.
CREATE TABLE public.sys_wf_order_edit_ops_cd (
  operation_code TEXT NOT NULL,
  name TEXT NOT NULL,
  name2 TEXT NOT NULL,
  description TEXT NOT NULL,
  description2 TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT pk_wf_edit_ops PRIMARY KEY (operation_code),
  CONSTRAINT ck_wf_edit_op_code CHECK (NULLIF(btrim(operation_code), '') IS NOT NULL),
  CONSTRAINT ck_wf_edit_op_status CHECK (rec_status IN (0, 1))
);

CREATE TABLE public.sys_wf_order_edit_op_tgt_cd (
  operation_code TEXT NOT NULL,
  target_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT pk_wf_edit_op_tgt PRIMARY KEY (operation_code, target_type),
  CONSTRAINT fk_wf_edit_op_tgt_op FOREIGN KEY (operation_code)
    REFERENCES public.sys_wf_order_edit_ops_cd (operation_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_wf_edit_op_tgt_type CHECK (target_type IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE')),
  CONSTRAINT ck_wf_edit_op_tgt_status CHECK (rec_status IN (0, 1))
);

COMMENT ON TABLE public.sys_wf_order_edit_ops_cd IS 'Frozen V1 Order Change operation catalog; it prevents policy rows from introducing arbitrary commercial commands or executable expressions.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.operation_code IS 'Stable server-owned Order Change operation token; browser input never invents it.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.name IS 'English administrative operation label.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.name2 IS 'Arabic administrative operation label.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.description IS 'English scope description for the frozen operation.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.description2 IS 'Arabic scope description for the frozen operation.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.is_system IS 'Marks the grammar platform-defined so tenant users cannot create unreviewed operations.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.is_active IS 'Controls future authoring eligibility without erasing historical policy grammar.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.created_at IS 'UTC timestamp when the catalog entry was recorded.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.created_by IS 'Authenticated HQ actor that recorded the catalog entry when applicable.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.updated_at IS 'UTC timestamp of the last permitted administrative update.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.updated_by IS 'HQ actor responsible for the last permitted update.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.updated_info IS 'Non-secret provenance for the last permitted update.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.rec_status IS 'Record lifecycle marker; value 1 is the only governed active catalog state.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.rec_order IS 'Optional stable administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON CONSTRAINT pk_wf_edit_ops ON public.sys_wf_order_edit_ops_cd IS 'Provides the stable frozen operation identity referenced by the permitted target vocabulary.';
COMMENT ON CONSTRAINT ck_wf_edit_op_code ON public.sys_wf_order_edit_ops_cd IS 'Rejects blank operation identifiers because policy identity must be stable and explicit.';
COMMENT ON CONSTRAINT ck_wf_edit_op_status ON public.sys_wf_order_edit_ops_cd IS 'Restricts catalog lifecycle to active or retired values without treating NULL as active.';

COMMENT ON TABLE public.sys_wf_order_edit_op_tgt_cd IS 'Permitted frozen V1 Order Change operation-target pairs; this narrow map replaces a generic policy expression engine.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.operation_code IS 'Frozen operation whose permitted policy targets are listed by this row.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.target_type IS 'Server-derived policy target; ADD_PREFERENCE targets its validated parent scope before a preference exists.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.is_active IS 'Controls future authoring eligibility without erasing historical policy grammar.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.created_at IS 'UTC timestamp when this permitted pair was recorded.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.created_by IS 'HQ actor that recorded this permitted pair when applicable.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.updated_at IS 'UTC timestamp of the last permitted administrative update.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.updated_by IS 'HQ actor responsible for the last permitted update.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.updated_info IS 'Non-secret provenance for the last permitted update.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.rec_status IS 'Record lifecycle marker; value 1 is the only governed active pair state.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.rec_order IS 'Optional stable administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON CONSTRAINT pk_wf_edit_op_tgt ON public.sys_wf_order_edit_op_tgt_cd IS 'Allows each frozen operation-target pair exactly once for composite rule validation.';
COMMENT ON CONSTRAINT fk_wf_edit_op_tgt_op ON public.sys_wf_order_edit_op_tgt_cd IS 'Prevents an operation-target pair from outliving or bypassing the frozen operation catalog.';
COMMENT ON CONSTRAINT ck_wf_edit_op_tgt_type ON public.sys_wf_order_edit_op_tgt_cd IS 'Restricts target grammar to the four V1 server-derived commercial subjects.';
COMMENT ON CONSTRAINT ck_wf_edit_op_tgt_status ON public.sys_wf_order_edit_op_tgt_cd IS 'Restricts pair lifecycle to active or retired values without treating NULL as active.';

INSERT INTO public.sys_wf_order_edit_ops_cd (operation_code,name,name2,description,description2,rec_order,created_info) VALUES
('ADD_ITEM','Add Item','إضافة صنف','Add a new commercial order item.','إضافة صنف تجاري جديد إلى الطلب.',10,'Migration 0597 WP05-B frozen grammar'),
('REMOVE_ITEM','Remove Item','إزالة صنف','Governed removal of an existing commercial order item.','إزالة محكومة لصنف تجاري موجود في الطلب.',20,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_ITEM_QUANTITY','Change Item Quantity','تغيير كمية الصنف','Change the commercial quantity of an existing order item.','تغيير الكمية التجارية لصنف طلب موجود.',30,'Migration 0597 WP05-B frozen grammar'),
('ADD_PIECE','Add Piece','إضافة قطعة','Add a piece under an existing order item.','إضافة قطعة تحت صنف طلب موجود.',40,'Migration 0597 WP05-B frozen grammar'),
('REMOVE_PIECE','Remove Piece','إزالة قطعة','Governed removal of an existing order item piece.','إزالة محكومة لقطعة صنف طلب موجودة.',50,'Migration 0597 WP05-B frozen grammar'),
('ADD_PREFERENCE','Add Preference','إضافة تفضيل','Add a preference at its validated order, item, or piece parent scope.','إضافة تفضيل على نطاق الطلب أو الصنف أو القطعة الذي تم التحقق منه.',60,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_PREFERENCE','Change Preference','تغيير تفضيل','Change a persisted order preference.','تغيير تفضيل طلب محفوظ.',70,'Migration 0597 WP05-B frozen grammar'),
('REMOVE_PREFERENCE','Remove Preference','إزالة تفضيل','Governed removal of a persisted order preference.','إزالة محكومة لتفضيل طلب محفوظ.',80,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_PRIORITY','Change Priority','تغيير الأولوية','Change the governed order priority.','تغيير أولوية الطلب المحكومة.',90,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_SERVICE_SPEED','Change Service Speed','تغيير سرعة الخدمة','Change the governed commercial service speed.','تغيير سرعة الخدمة التجارية المحكومة.',100,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_READY_BY','Change Ready By','تغيير موعد الجاهزية','Change the governed ready-by commitment.','تغيير التزام موعد الجاهزية المحكوم.',110,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_ORDER_NOTES','Change Order Notes','تغيير ملاحظات الطلب','Change allowed commercial or customer order notes only.','تغيير ملاحظات الطلب التجارية أو ملاحظات العميل المسموح بها فقط.',120,'Migration 0597 WP05-B frozen grammar'),
('CHANGE_CUSTOMER_SNAPSHOT','Change Customer Snapshot','تغيير لقطة العميل','Change the governed order customer snapshot.','تغيير لقطة عميل الطلب المحكومة.',130,'Migration 0597 WP05-B frozen grammar');

INSERT INTO public.sys_wf_order_edit_op_tgt_cd (operation_code,target_type,rec_order,created_info) VALUES
('ADD_ITEM','ORDER',10,'Migration 0597 WP05-B frozen grammar'),('REMOVE_ITEM','ITEM',20,'Migration 0597 WP05-B frozen grammar'),('CHANGE_ITEM_QUANTITY','ITEM',30,'Migration 0597 WP05-B frozen grammar'),('ADD_PIECE','ITEM',40,'Migration 0597 WP05-B frozen grammar'),('REMOVE_PIECE','PIECE',50,'Migration 0597 WP05-B frozen grammar'),('ADD_PREFERENCE','ORDER',60,'Migration 0597 WP05-B frozen grammar'),('ADD_PREFERENCE','ITEM',61,'Migration 0597 WP05-B frozen grammar'),('ADD_PREFERENCE','PIECE',62,'Migration 0597 WP05-B frozen grammar'),('CHANGE_PREFERENCE','PREFERENCE',70,'Migration 0597 WP05-B frozen grammar'),('REMOVE_PREFERENCE','PREFERENCE',80,'Migration 0597 WP05-B frozen grammar'),('CHANGE_PRIORITY','ORDER',90,'Migration 0597 WP05-B frozen grammar'),('CHANGE_SERVICE_SPEED','ORDER',100,'Migration 0597 WP05-B frozen grammar'),('CHANGE_READY_BY','ORDER',110,'Migration 0597 WP05-B frozen grammar'),('CHANGE_ORDER_NOTES','ORDER',120,'Migration 0597 WP05-B frozen grammar'),('CHANGE_CUSTOMER_SNAPSHOT','ORDER',130,'Migration 0597 WP05-B frozen grammar');

-- The grammar is migration-owned after the finite V1 seed. New executable
-- operations require a separately reviewed forward migration and server handler.
CREATE FUNCTION public.sys_wf_edit_grammar_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION '%: the frozen V1 Edit Policy grammar is migration-owned', TG_TABLE_NAME USING ERRCODE = '23514';
  RETURN NULL;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_grammar_guard() IS 'Prevents any post-seed insert, update, or delete of the finite V1 Edit Policy operation grammar; expansion needs a reviewed forward migration and server implementation.';

-- HQ policy aggregate and explicit decision matrix.
CREATE TABLE public.sys_wf_edit_policy_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  workflow_profile_version_id UUID NOT NULL,
  policy_code TEXT NOT NULL,
  name TEXT NOT NULL,
  name2 TEXT NOT NULL,
  description TEXT,
  description2 TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'DRAFT',
  policy_revision INTEGER NOT NULL DEFAULT 1,
  pilot_started_at TIMESTAMPTZ,
  pilot_started_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID,
  retired_at TIMESTAMPTZ,
  retired_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT pk_wf_edit_policy PRIMARY KEY (id),
  CONSTRAINT fk_wf_edit_pol_profile FOREIGN KEY (workflow_profile_version_id) REFERENCES public.sys_wf_profile_ver_mst (version_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_pol_pilot_by FOREIGN KEY (pilot_started_by) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_pol_pub_by FOREIGN KEY (published_by) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_pol_ret_by FOREIGN KEY (retired_by) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT uq_wf_edit_policy_code UNIQUE (policy_code),
  CONSTRAINT uq_wf_edit_policy_ver UNIQUE (id, workflow_profile_version_id),
  CONSTRAINT ck_wf_edit_pol_code CHECK (NULLIF(btrim(policy_code), '') IS NOT NULL),
  CONSTRAINT ck_wf_edit_pol_rev CHECK (policy_revision >= 1),
  CONSTRAINT ck_wf_edit_pol_status CHECK (rec_status IN (0, 1)),
  CONSTRAINT ck_wf_edit_pol_life CHECK (
    (lifecycle_status = 'DRAFT' AND pilot_started_at IS NULL AND pilot_started_by IS NULL AND published_at IS NULL AND published_by IS NULL AND retired_at IS NULL AND retired_by IS NULL)
    OR (lifecycle_status = 'PILOT' AND pilot_started_at IS NOT NULL AND pilot_started_by IS NOT NULL AND published_at IS NULL AND published_by IS NULL AND retired_at IS NULL AND retired_by IS NULL)
    OR (lifecycle_status = 'PUBLISHED' AND pilot_started_at IS NOT NULL AND pilot_started_by IS NOT NULL AND published_at IS NOT NULL AND published_by IS NOT NULL AND retired_at IS NULL AND retired_by IS NULL)
    OR (lifecycle_status = 'RETIRED' AND pilot_started_at IS NOT NULL AND pilot_started_by IS NOT NULL AND published_at IS NOT NULL AND published_by IS NOT NULL AND retired_at IS NOT NULL AND retired_by IS NOT NULL)
  )
);

CREATE TABLE public.sys_wf_edit_policy_rule_dtl (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  edit_policy_id UUID NOT NULL,
  workflow_status TEXT NOT NULL,
  operation_code TEXT NOT NULL,
  target_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  message_key TEXT NOT NULL,
  requires_reason BOOLEAN NOT NULL DEFAULT false,
  required_permission_code TEXT,
  override_permission_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT pk_wf_edit_rule PRIMARY KEY (id),
  CONSTRAINT fk_wf_edit_rule_policy FOREIGN KEY (edit_policy_id) REFERENCES public.sys_wf_edit_policy_mst (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_rule_status FOREIGN KEY (workflow_status) REFERENCES public.sys_wf_statuses_cd (status_code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_rule_req_perm FOREIGN KEY (required_permission_code) REFERENCES public.sys_auth_permissions(code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_rule_ovr_perm FOREIGN KEY (override_permission_code) REFERENCES public.sys_auth_permissions(code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT uq_wf_edit_rule_key UNIQUE (edit_policy_id, workflow_status, operation_code, target_type),
  CONSTRAINT fk_wf_edit_rule_op_tgt FOREIGN KEY (operation_code, target_type) REFERENCES public.sys_wf_order_edit_op_tgt_cd (operation_code, target_type) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_wf_edit_rule_decision CHECK (decision IN ('ALLOW', 'ALLOW_WITH_WARNING', 'REQUIRE_OVERRIDE', 'DENY')),
  CONSTRAINT ck_wf_edit_rule_reason CHECK (NULLIF(btrim(reason_code), '') IS NOT NULL AND NULLIF(btrim(message_key), '') IS NOT NULL),
  CONSTRAINT ck_wf_edit_rule_override CHECK ((decision = 'REQUIRE_OVERRIDE' AND requires_reason = true AND override_permission_code IS NOT NULL) OR (decision <> 'REQUIRE_OVERRIDE' AND override_permission_code IS NULL)),
  CONSTRAINT ck_wf_edit_rule_status CHECK (rec_status IN (0, 1))
);

CREATE TABLE public.org_wf_edit_policy_asg_cf (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  workflow_profile_version_id UUID NOT NULL,
  edit_policy_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT pk_wf_edit_asg PRIMARY KEY (id),
  CONSTRAINT fk_wf_edit_asg_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_wf_edit_asg_policy FOREIGN KEY (edit_policy_id, workflow_profile_version_id) REFERENCES public.sys_wf_edit_policy_mst (id, workflow_profile_version_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_wf_edit_asg_status CHECK (rec_status IN (0, 1))
);

COMMENT ON TABLE public.sys_wf_edit_policy_mst IS 'HQ-owned Edit Policy header linked to one exact workflow profile version; it is separate from transition policy and never bypasses hard order-domain guards.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.id IS 'Stable opaque Edit Policy identity for rules, tenant assignment, review identity, and audit.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.workflow_profile_version_id IS 'Exact workflow profile version whose configured statuses define this policy matrix.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.policy_code IS 'Immutable machine code for the policy lineage; correction uses lifecycle control or a new policy, never identity rename.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.name IS 'English HQ policy display name.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.name2 IS 'Arabic HQ policy display name.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.description IS 'English explanation of the policy family and operating intent.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.description2 IS 'Arabic explanation of the policy family and operating intent.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.lifecycle_status IS 'DRAFT is unassignable, PILOT is editable and selectively assignable, PUBLISHED is immutable and assignable, RETIRED is historical only.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.policy_revision IS 'Positive freshness value incremented by the controlled HQ save path; it invalidates stale review without checksums.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.pilot_started_at IS 'UTC evidence that a reviewed Draft entered pilot use.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.pilot_started_by IS 'Authenticated actor that promoted this policy to Pilot.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.published_at IS 'UTC evidence that the policy became immutable production authority.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.published_by IS 'Authenticated actor that published this policy.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.retired_at IS 'UTC evidence that the immutable policy stopped receiving new assignments.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.retired_by IS 'Authenticated actor that retired this policy.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.created_at IS 'UTC timestamp when the policy header was created.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.created_by IS 'HQ actor that created the policy header when known.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.updated_at IS 'UTC timestamp of the latest permitted Draft or Pilot save.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.updated_by IS 'HQ actor responsible for the latest permitted save.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.updated_info IS 'Non-secret latest-save provenance.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.rec_status IS 'Record lifecycle marker; runtime accepts only explicit value 1 with is_active true.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.is_active IS 'Future eligibility marker; inactive policies remain auditable and deny future resolution.';
COMMENT ON CONSTRAINT pk_wf_edit_policy ON public.sys_wf_edit_policy_mst IS 'Provides the immutable Edit Policy identity used by rules, tenant assignment, review proof, and audit.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_profile ON public.sys_wf_edit_policy_mst IS 'Requires a policy to govern one existing exact workflow profile version.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_pilot_by ON public.sys_wf_edit_policy_mst IS 'Preserves the authenticated actor who first approved limited Pilot use.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_pub_by ON public.sys_wf_edit_policy_mst IS 'Preserves the authenticated actor who made the policy immutable production authority.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_ret_by ON public.sys_wf_edit_policy_mst IS 'Preserves the authenticated actor who stopped new assignments while retaining audit history.';
COMMENT ON CONSTRAINT uq_wf_edit_policy_code ON public.sys_wf_edit_policy_mst IS 'Prevents two policies claiming the same stable policy lineage code.';
COMMENT ON CONSTRAINT uq_wf_edit_policy_ver ON public.sys_wf_edit_policy_mst IS 'Provides the composite identity that prevents assignment to another workflow profile version.';
COMMENT ON CONSTRAINT ck_wf_edit_pol_code ON public.sys_wf_edit_policy_mst IS 'Rejects blank policy machine codes because runtime and audit identity must be stable.';
COMMENT ON CONSTRAINT ck_wf_edit_pol_rev ON public.sys_wf_edit_policy_mst IS 'Requires positive revision so stale-review detection never has an unversioned policy.';
COMMENT ON CONSTRAINT ck_wf_edit_pol_status ON public.sys_wf_edit_policy_mst IS 'Restricts policy lifecycle to active or retired values without treating NULL as active.';
COMMENT ON CONSTRAINT ck_wf_edit_pol_life ON public.sys_wf_edit_policy_mst IS 'Requires lifecycle actor/time evidence and forbids skipping Draft, Pilot, and Published.';

COMMENT ON TABLE public.sys_wf_edit_policy_rule_dtl IS 'Explicit matrix for one workflow status and frozen operation-target pair; it is not a generic commercial rules engine.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.id IS 'Stable opaque rule identity for HQ audit and editor conflict handling.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.edit_policy_id IS 'Edit Policy header that owns this explicit decision.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.workflow_status IS 'Workflow status governed by this rule; trigger validation requires active membership in the policy profile version.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.operation_code IS 'Frozen V1 operation constrained with target_type by the narrow catalog map.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.target_type IS 'Server-derived target category; browser data never chooses an arbitrary policy target.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.decision IS 'Explicit ALLOW, ALLOW_WITH_WARNING, REQUIRE_OVERRIDE, or DENY; hard domain guards may only make it stricter.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.reason_code IS 'Stable nonblank machine explanation for support and audit analysis.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.message_key IS 'Stable nonblank localized-message key resolved by trusted application code.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.requires_reason IS 'Requires an operator-entered reason; overrides always require it.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.required_permission_code IS 'Optional additional tenant permission beyond orders:edit, checked server-side.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.override_permission_code IS 'Required only for REQUIRE_OVERRIDE and never overrides hard domain denial.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.created_at IS 'UTC timestamp when this rule was recorded.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.created_by IS 'HQ actor that created this rule when known.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.updated_at IS 'UTC timestamp of the latest permitted Draft or Pilot update.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.updated_by IS 'HQ actor responsible for the latest permitted update.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.updated_info IS 'Non-secret latest-update provenance.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.rec_status IS 'Record lifecycle marker; runtime accepts only explicit value 1 with is_active true.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.rec_order IS 'Optional matrix/editor display ordering value.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.rec_notes IS 'Optional non-secret HQ administrative note.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.is_active IS 'Future eligibility marker; inactive rules are treated as missing/deny by runtime.';
COMMENT ON CONSTRAINT pk_wf_edit_rule ON public.sys_wf_edit_policy_rule_dtl IS 'Provides the stable rule identity used by HQ audit and editor conflict handling.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_policy ON public.sys_wf_edit_policy_rule_dtl IS 'Prevents an explicit decision from outliving its policy header.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_status ON public.sys_wf_edit_policy_rule_dtl IS 'Requires a known workflow status before the profile-status guard verifies membership.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_req_perm ON public.sys_wf_edit_policy_rule_dtl IS 'Prevents a policy from referencing a nonexistent specialized tenant permission.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_ovr_perm ON public.sys_wf_edit_policy_rule_dtl IS 'Prevents a required override from naming a nonexistent tenant permission.';
COMMENT ON CONSTRAINT uq_wf_edit_rule_key ON public.sys_wf_edit_policy_rule_dtl IS 'Requires one explicit decision for each policy/status/operation/target tuple.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_op_tgt ON public.sys_wf_edit_policy_rule_dtl IS 'Prevents a rule from inventing a pair outside the frozen V1 catalog.';
COMMENT ON CONSTRAINT ck_wf_edit_rule_decision ON public.sys_wf_edit_policy_rule_dtl IS 'Restricts decisions to the four reviewed V1 outcomes.';
COMMENT ON CONSTRAINT ck_wf_edit_rule_reason ON public.sys_wf_edit_policy_rule_dtl IS 'Requires stable nonblank support and localization identifiers for every decision.';
COMMENT ON CONSTRAINT ck_wf_edit_rule_override ON public.sys_wf_edit_policy_rule_dtl IS 'Requires reason and permission only for REQUIRE_OVERRIDE, preventing unused override data.';
COMMENT ON CONSTRAINT ck_wf_edit_rule_status ON public.sys_wf_edit_policy_rule_dtl IS 'Restricts rule lifecycle to active or retired values without treating NULL as active.';

COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.id IS 'Stable tenant assignment identity retained for audit and support.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.tenant_org_id IS 'Tenant owner used by RLS and mandatory explicit server-side tenant predicates.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.workflow_profile_version_id IS 'Exact workflow version resolved for the order; composite FK must match the assigned policy header.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.edit_policy_id IS 'Assigned Edit Policy whose lifecycle and active state are checked by the assignment guard.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.created_at IS 'UTC timestamp when the tenant assignment was created.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.created_by IS 'HQ actor that created the assignment when known.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.created_info IS 'Non-secret assignment creation provenance.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.updated_at IS 'UTC timestamp of the latest permitted assignment lifecycle update.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.updated_by IS 'HQ actor responsible for the latest permitted assignment update.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.updated_info IS 'Non-secret latest-update provenance.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.rec_status IS 'Record lifecycle marker; only explicit value 1 with is_active true is live.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.is_active IS 'Controlled assignment activation marker; inactive assignment is ignored by runtime resolution.';
COMMENT ON CONSTRAINT pk_wf_edit_asg ON public.org_wf_edit_policy_asg_cf IS 'Provides stable tenant assignment identity retained for HQ audit and support.';
COMMENT ON CONSTRAINT fk_wf_edit_asg_tenant ON public.org_wf_edit_policy_asg_cf IS 'Prevents an Edit Policy assignment from naming a nonexistent tenant.';
COMMENT ON CONSTRAINT fk_wf_edit_asg_policy ON public.org_wf_edit_policy_asg_cf IS 'Forces every tenant assignment to use the policy matching its exact workflow version.';
COMMENT ON CONSTRAINT ck_wf_edit_asg_status ON public.org_wf_edit_policy_asg_cf IS 'Restricts assignment lifecycle to active or retired values without treating NULL as active.';

CREATE INDEX idx_wf_edit_pol_profile ON public.sys_wf_edit_policy_mst (workflow_profile_version_id, lifecycle_status, policy_revision DESC) WHERE rec_status = 1 AND is_active = true;
CREATE INDEX idx_wf_edit_rule_live ON public.sys_wf_edit_policy_rule_dtl (edit_policy_id, workflow_status, operation_code, target_type) WHERE rec_status = 1 AND is_active = true;
CREATE UNIQUE INDEX uq_wf_edit_asg_active ON public.org_wf_edit_policy_asg_cf (tenant_org_id, workflow_profile_version_id) WHERE rec_status = 1 AND is_active = true;
CREATE INDEX idx_wf_edit_asg_tenant ON public.org_wf_edit_policy_asg_cf (tenant_org_id, workflow_profile_version_id, edit_policy_id) WHERE rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.idx_wf_edit_pol_profile IS 'Supports effective policy lookup by exact profile version and lifecycle.';
COMMENT ON INDEX public.idx_wf_edit_rule_live IS 'Supports a fail-closed live rule lookup without scanning retired rows.';
COMMENT ON INDEX public.uq_wf_edit_asg_active IS 'Prevents two live policies authorizing the same tenant and workflow profile version.';
COMMENT ON INDEX public.idx_wf_edit_asg_tenant IS 'Supports explicit tenant-scoped resolver lookup while retaining policy identity.';

-- Storage guards protect lifecycle and profile compatibility. HQ API authorization,
-- audit, and expected-revision conflict handling remain application concerns.
CREATE FUNCTION public.sys_wf_edit_policy_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lifecycle_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: only DRAFT policies may be deleted; retire published policy evidence instead' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.policy_code IS DISTINCT FROM OLD.policy_code THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: policy_code is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status = 'DRAFT' THEN
    IF NEW.lifecycle_status NOT IN ('DRAFT', 'PILOT') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: Draft must remain Draft or enter Pilot and increment policy_revision by one' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'PILOT' THEN
    IF NEW.lifecycle_status NOT IN ('PILOT', 'PUBLISHED') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: Pilot must remain Pilot or become Published and increment policy_revision by one' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'PUBLISHED' THEN
    IF NEW.lifecycle_status <> 'RETIRED'
      OR NEW.policy_revision IS DISTINCT FROM OLD.policy_revision
      OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
      OR NEW.name IS DISTINCT FROM OLD.name OR NEW.name2 IS DISTINCT FROM OLD.name2
      OR NEW.description IS DISTINCT FROM OLD.description OR NEW.description2 IS DISTINCT FROM OLD.description2
      OR NEW.pilot_started_at IS DISTINCT FROM OLD.pilot_started_at OR NEW.pilot_started_by IS DISTINCT FROM OLD.pilot_started_by
      OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_info IS DISTINCT FROM OLD.created_info OR NEW.rec_status IS DISTINCT FROM OLD.rec_status
      OR NEW.rec_order IS DISTINCT FROM OLD.rec_order OR NEW.rec_notes IS DISTINCT FROM OLD.rec_notes
      OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: PUBLISHED policy is immutable except controlled retirement' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'RETIRED' THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: RETIRED policy is immutable' USING ERRCODE = '23514';
  ELSE
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: unknown existing lifecycle %', OLD.lifecycle_status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.sys_wf_edit_rule_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_policy_id UUID;
  v_lifecycle TEXT;
  v_profile_version_id UUID;
BEGIN
  v_policy_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.edit_policy_id ELSE NEW.edit_policy_id END;
  SELECT policy.lifecycle_status, policy.workflow_profile_version_id
    INTO v_lifecycle, v_profile_version_id
  FROM public.sys_wf_edit_policy_mst AS policy
  WHERE policy.id = v_policy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: policy % does not exist', v_policy_id USING ERRCODE = '23514';
  END IF;
  IF v_lifecycle IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: % policy rules are immutable', v_lifecycle USING ERRCODE = '23514';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS profile_status
    WHERE profile_status.version_id = v_profile_version_id
      AND profile_status.status_code = NEW.workflow_status
      AND profile_status.rec_status = 1
      AND profile_status.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: workflow status % is not active in profile version %', NEW.workflow_status, v_profile_version_id USING ERRCODE = '23514';
  END IF;
  -- Every individual Pilot or Draft rule mutation advances the policy identity.
  -- A later Preview/Apply re-evaluates it, so stale review material cannot survive.
  UPDATE public.sys_wf_edit_policy_mst
  SET policy_revision = policy_revision + 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = 'Edit Policy rule matrix changed'
  WHERE id = v_policy_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.org_wf_edit_asg_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_policy_lifecycle TEXT;
  v_policy_active BOOLEAN;
  v_policy_rec_status SMALLINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: deactivate assignments instead of deleting audit evidence' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.tenant_org_id IS DISTINCT FROM OLD.tenant_org_id
    OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id
  ) THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: assignment identity is immutable; deactivate it and create a new assignment' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN RETURN NEW; END IF;

  SELECT policy.lifecycle_status, policy.is_active, policy.rec_status
    INTO v_policy_lifecycle, v_policy_active, v_policy_rec_status
  FROM public.sys_wf_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id
    AND policy.workflow_profile_version_id = NEW.workflow_profile_version_id
  FOR KEY SHARE;

  IF NOT FOUND OR v_policy_lifecycle NOT IN ('PILOT', 'PUBLISHED')
    OR v_policy_active <> true OR v_policy_rec_status <> 1 THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: live assignment requires an active matching PILOT or PUBLISHED policy' USING ERRCODE = '23514';
  END IF;
  -- A policy may stay assigned for orders already stamped to an earlier exact
  -- version, but its workflow profile family must remain actively assigned to
  -- this tenant. Runtime resolution still matches the order's exact version.
  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_profile_ver_mst AS profile_version
    JOIN public.org_wf_profile_assign_cf AS workflow_assignment
      ON workflow_assignment.tenant_org_id = NEW.tenant_org_id
     AND workflow_assignment.wf_profile_id = profile_version.profile_id
     AND (workflow_assignment.wf_version_no IS NULL OR workflow_assignment.wf_version_no = profile_version.version_no)
    WHERE profile_version.version_id = NEW.workflow_profile_version_id
      AND workflow_assignment.rec_status = 1
      AND workflow_assignment.is_active = true
  ) THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: active assignment requires a matching active tenant workflow-profile assignment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sys_wf_edit_policy_guard() IS 'Protects immutable policy code, Draft-to-Pilot-to-Published-to-Retired lifecycle, revision increments, and retirement-only updates after publication.';
COMMENT ON FUNCTION public.sys_wf_edit_rule_guard() IS 'Blocks Published or Retired rule mutation, accepts only active profile statuses, serializes Draft/Pilot edits, and advances proof freshness on each matrix mutation.';
COMMENT ON FUNCTION public.org_wf_edit_asg_guard() IS 'Makes assignment identity/audit immutable and permits a live assignment only to an active matching Pilot or Published policy and tenant workflow profile family.';

-- RLS is defense in depth. No browser role receives a table grant; the future
-- resolver uses trusted server access and an explicit tenant_org_id predicate.
ALTER TABLE public.org_wf_edit_policy_asg_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_wf_edit_asg_tenant_read ON public.org_wf_edit_policy_asg_cf
  FOR SELECT TO authenticated USING (tenant_org_id = public.current_tenant_id());
COMMENT ON POLICY org_wf_edit_asg_tenant_read ON public.org_wf_edit_policy_asg_cf IS 'Defense-in-depth tenant predicate for any future approved read grant; browser table privileges remain revoked until membership-safe access is approved.';

-- Browser/Data API roles cannot manufacture policy authority or query global
-- HQ policy data. service_role is only for trusted HQ/server boundaries.
REVOKE ALL ON TABLE public.sys_wf_order_edit_ops_cd, public.sys_wf_order_edit_op_tgt_cd, public.sys_wf_edit_policy_mst, public.sys_wf_edit_policy_rule_dtl, public.org_wf_edit_policy_asg_cf FROM PUBLIC, anon, authenticated;
-- The frozen grammar is read-only even to trusted services; policy administration
-- needs mutation rights only over headers, rules, and controlled assignment.
GRANT SELECT ON TABLE public.sys_wf_order_edit_ops_cd, public.sys_wf_order_edit_op_tgt_cd TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_wf_edit_policy_mst, public.sys_wf_edit_policy_rule_dtl, public.org_wf_edit_policy_asg_cf TO service_role;
COMMENT ON TABLE public.org_wf_edit_policy_asg_cf IS 'Tenant-scoped Edit Policy assignment. RLS is enabled and browser/Data API roles have no table privileges; trusted code must still filter every read/write by tenant_org_id.';

-- Unassigned Draft starter policies. No UUID is assumed: only the verified
-- system profile families present with active configured statuses are seeded.
-- They cannot enable V2 because Draft policies are unassignable.
WITH seed_profiles AS (
  SELECT profile_version.version_id, profile.profile_code,
    CASE profile.profile_code
      WHEN 'WF_V2_STANDARD' THEN 'ORDER_CHANGE_STANDARD_V1'
      WHEN 'WF_V2_ASSEMBLY_QA' THEN 'ORDER_CHANGE_ASSEMBLY_QA_V1'
      WHEN 'WF_V2_PICKUP_DELIVERY' THEN 'ORDER_CHANGE_PICKUP_DELIVERY_V1'
      WHEN 'WF_V2_OUTSOURCE' THEN 'ORDER_CHANGE_OUTSOURCE_V1'
      WHEN 'WF_V2_ISSUE_REPROCESS' THEN 'ORDER_CHANGE_ISSUE_REPROCESS_V1'
    END AS policy_code,
    CASE profile.profile_code
      WHEN 'WF_V2_STANDARD' THEN 'Standard Order Change V1'
      WHEN 'WF_V2_ASSEMBLY_QA' THEN 'Assembly and QA Order Change V1'
      WHEN 'WF_V2_PICKUP_DELIVERY' THEN 'Pickup and Delivery Order Change V1'
      WHEN 'WF_V2_OUTSOURCE' THEN 'Outsource Order Change V1'
      WHEN 'WF_V2_ISSUE_REPROCESS' THEN 'Issue and Reprocess Order Change V1'
    END AS name,
    CASE profile.profile_code
      WHEN 'WF_V2_STANDARD' THEN 'تعديل الطلب القياسي الإصدار الأول'
      WHEN 'WF_V2_ASSEMBLY_QA' THEN 'تعديل طلب التجميع والفحص الإصدار الأول'
      WHEN 'WF_V2_PICKUP_DELIVERY' THEN 'تعديل طلب الاستلام والتوصيل الإصدار الأول'
      WHEN 'WF_V2_OUTSOURCE' THEN 'تعديل طلب التعهيد الإصدار الأول'
      WHEN 'WF_V2_ISSUE_REPROCESS' THEN 'تعديل طلب المشكلات وإعادة المعالجة الإصدار الأول'
    END AS name2
  FROM public.sys_wf_profiles_cd AS profile
  JOIN public.sys_wf_profile_ver_mst AS profile_version ON profile_version.profile_id = profile.profile_id
  WHERE profile.profile_code IN ('WF_V2_STANDARD','WF_V2_ASSEMBLY_QA','WF_V2_PICKUP_DELIVERY','WF_V2_OUTSOURCE','WF_V2_ISSUE_REPROCESS')
    AND profile.is_system = true AND profile.is_active = true AND profile.rec_status = 1
    AND profile_version.version_status IN ('PILOT','PUBLISHED')
    AND profile_version.is_active = true AND profile_version.rec_status = 1
    AND EXISTS (
      SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS profile_status
      WHERE profile_status.version_id = profile_version.version_id
        AND profile_status.is_active = true AND profile_status.rec_status = 1
    )
)
INSERT INTO public.sys_wf_edit_policy_mst (
  workflow_profile_version_id,policy_code,name,name2,description,description2,
  lifecycle_status,policy_revision,rec_order,created_info
)
SELECT version_id,policy_code,name,name2,
  'Unassigned Draft starter matrix. HQ must review, promote, and assign it before any tenant can use it.',
  'مصفوفة بداية مسودة غير معيّنة. يجب على HQ مراجعتها وترقيتها وتعيينها قبل أن يستخدمها أي مستأجر.',
  'DRAFT',1,10,'Migration 0597 WP05-B unassigned Draft seed'
FROM seed_profiles;

-- The mixed starter matrix is explicit by documented system profile/status,
-- never by a tenant-specific guess. Finance/fiscal/payment/delivery hard
-- guards remain authoritative even where the seed says ALLOW.
WITH seed_policy AS (
  SELECT policy.id,policy.workflow_profile_version_id,profile.profile_code
  FROM public.sys_wf_edit_policy_mst AS policy
  JOIN public.sys_wf_profile_ver_mst AS profile_version ON profile_version.version_id = policy.workflow_profile_version_id
  JOIN public.sys_wf_profiles_cd AS profile ON profile.profile_id = profile_version.profile_id
  WHERE policy.created_info = 'Migration 0597 WP05-B unassigned Draft seed'
    AND policy.lifecycle_status = 'DRAFT' AND policy.is_active = true AND policy.rec_status = 1
), effective_status AS (
  SELECT DISTINCT policy.id,policy.profile_code,profile_status.status_code
  FROM seed_policy AS policy
  JOIN public.sys_wf_prof_ver_mod_st_cf AS profile_status ON profile_status.version_id = policy.workflow_profile_version_id
  WHERE profile_status.is_active = true AND profile_status.rec_status = 1
), matrix AS (
  SELECT policy.id AS edit_policy_id,policy.profile_code,policy.status_code,pair.operation_code,pair.target_type,
    CASE
      -- Release, delivery, terminal, finance-sensitive handoff contexts stay denied.
      WHEN policy.status_code IN ('ready','out_for_delivery','delivered','cancelled','returned') THEN 'DENY'
      -- Outsource changes are limited to controlled intake before supplier work can exist.
      WHEN policy.profile_code = 'WF_V2_OUTSOURCE' AND policy.status_code NOT IN ('draft','intake') THEN 'DENY'
      -- A held issue/reprocess order permits documentary correction; structural work needs override.
      WHEN policy.profile_code = 'WF_V2_ISSUE_REPROCESS' AND policy.status_code = 'on_hold'
        AND pair.operation_code IN ('CHANGE_ORDER_NOTES','CHANGE_PRIORITY','CHANGE_READY_BY') THEN 'ALLOW_WITH_WARNING'
      WHEN policy.profile_code = 'WF_V2_ISSUE_REPROCESS' AND policy.status_code = 'on_hold' THEN 'REQUIRE_OVERRIDE'
      -- Intake is the commercial correction window; removal and quantity change are acknowledged.
      WHEN policy.status_code IN ('draft','intake')
        AND pair.operation_code IN ('REMOVE_ITEM','REMOVE_PIECE','CHANGE_ITEM_QUANTITY') THEN 'ALLOW_WITH_WARNING'
      WHEN policy.status_code IN ('draft','intake') THEN 'ALLOW'
      -- Assembly/QA protects in-process structure more tightly than standard flows.
      WHEN policy.profile_code = 'WF_V2_ASSEMBLY_QA'
        AND policy.status_code IN ('preparing','processing','assembly','qa','packing')
        AND pair.operation_code IN ('ADD_ITEM','REMOVE_ITEM','CHANGE_ITEM_QUANTITY','ADD_PIECE','REMOVE_PIECE','ADD_PREFERENCE','CHANGE_PREFERENCE','REMOVE_PREFERENCE') THEN 'REQUIRE_OVERRIDE'
      WHEN policy.profile_code = 'WF_V2_ASSEMBLY_QA'
        AND policy.status_code IN ('preparing','processing','assembly','qa','packing') THEN 'ALLOW_WITH_WARNING'
      -- Later operational stages permit acknowledged documentary planning only.
      WHEN policy.status_code IN ('preparing','processing','assembly','qa','packing')
        AND pair.operation_code IN ('CHANGE_ORDER_NOTES','CHANGE_PRIORITY','CHANGE_READY_BY','CHANGE_CUSTOMER_SNAPSHOT') THEN 'ALLOW_WITH_WARNING'
      WHEN policy.status_code IN ('preparing','processing','assembly','qa','packing') THEN 'REQUIRE_OVERRIDE'
      ELSE 'DENY'
    END AS decision
  FROM effective_status AS policy
  CROSS JOIN public.sys_wf_order_edit_op_tgt_cd AS pair
  WHERE pair.is_active = true AND pair.rec_status = 1
)
INSERT INTO public.sys_wf_edit_policy_rule_dtl (
  edit_policy_id,workflow_status,operation_code,target_type,decision,reason_code,message_key,
  requires_reason,required_permission_code,override_permission_code,rec_order,created_info
)
-- Qualify every matrix projection because the ordered catalog join supplies
-- the same operation_code/target_type names for deterministic display order.
SELECT matrix.edit_policy_id,matrix.status_code,matrix.operation_code,matrix.target_type,matrix.decision,
  CASE matrix.decision
    WHEN 'ALLOW' THEN 'CAPABILITY_POLICY_ALLOWED'
    WHEN 'ALLOW_WITH_WARNING' THEN 'CAPABILITY_POLICY_WARNING'
    WHEN 'REQUIRE_OVERRIDE' THEN 'CAPABILITY_POLICY_OVERRIDE_REQUIRED'
    ELSE 'CAPABILITY_POLICY_NOT_ENABLED'
  END,
  CASE matrix.decision
    WHEN 'ALLOW' THEN 'orderChange.policy.allowed'
    WHEN 'ALLOW_WITH_WARNING' THEN 'orderChange.policy.warning'
    WHEN 'REQUIRE_OVERRIDE' THEN 'orderChange.policy.overrideRequired'
    ELSE 'orderChange.policy.notEnabled'
  END,
  matrix.decision = 'REQUIRE_OVERRIDE',NULL,
  CASE WHEN matrix.decision = 'REQUIRE_OVERRIDE' THEN 'orders:edit_override' ELSE NULL END,
  ordered_pair.rec_order,'Migration 0597 WP05-B unassigned Draft seed'
FROM matrix
JOIN public.sys_wf_order_edit_op_tgt_cd AS ordered_pair
  ON ordered_pair.operation_code = matrix.operation_code AND ordered_pair.target_type = matrix.target_type;

-- Deployment fails instead of leaving a Draft seed that an administrator could
-- later mistake for a complete Pilot policy. No tenant assignment is inserted.
DO $block$
DECLARE
  v_operation_count INTEGER;
  v_pair_count INTEGER;
  v_incomplete_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_operation_count FROM public.sys_wf_order_edit_ops_cd WHERE rec_status = 1 AND is_active = true;
  SELECT COUNT(*) INTO v_pair_count FROM public.sys_wf_order_edit_op_tgt_cd WHERE rec_status = 1 AND is_active = true;
  IF v_operation_count <> 13 OR v_pair_count <> 15 THEN
    RAISE EXCEPTION 'WP05-B Edit Policy frozen grammar is incomplete (% operations, % pairs)',v_operation_count,v_pair_count USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_incomplete_policy_count
  FROM public.sys_wf_edit_policy_mst AS policy
  CROSS JOIN LATERAL (
    SELECT COUNT(DISTINCT profile_status.status_code) AS status_count
    FROM public.sys_wf_prof_ver_mod_st_cf AS profile_status
    WHERE profile_status.version_id = policy.workflow_profile_version_id
      AND profile_status.rec_status = 1 AND profile_status.is_active = true
  ) AS status_set
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS rule_count
    FROM public.sys_wf_edit_policy_rule_dtl AS rule
    WHERE rule.edit_policy_id = policy.id AND rule.rec_status = 1 AND rule.is_active = true
  ) AS rule_set
  WHERE policy.created_info = 'Migration 0597 WP05-B unassigned Draft seed'
    AND rule_set.rule_count <> status_set.status_count * 15;
  IF v_incomplete_policy_count <> 0 THEN
    RAISE EXCEPTION 'WP05-B Edit Policy Draft seed has % incomplete policy matrices',v_incomplete_policy_count USING ERRCODE = '23514';
  END IF;
END;
$block$;

-- Enable immutability only after the one-time catalog and Draft-matrix seed.
-- The policy/rule/assignment guards then govern every later HQ mutation.
CREATE TRIGGER trg_wf_edit_ops_grammar BEFORE INSERT OR UPDATE OR DELETE
  ON public.sys_wf_order_edit_ops_cd
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_grammar_guard();
CREATE TRIGGER trg_wf_edit_tgt_grammar BEFORE INSERT OR UPDATE OR DELETE
  ON public.sys_wf_order_edit_op_tgt_cd
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_grammar_guard();
CREATE TRIGGER trg_sys_wf_edit_policy_guard BEFORE UPDATE OR DELETE
  ON public.sys_wf_edit_policy_mst
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_policy_guard();
CREATE TRIGGER trg_sys_wf_edit_rule_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.sys_wf_edit_policy_rule_dtl
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_rule_guard();
CREATE TRIGGER trg_org_wf_edit_asg_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.org_wf_edit_policy_asg_cf
  FOR EACH ROW EXECUTE FUNCTION public.org_wf_edit_asg_guard();
COMMENT ON TRIGGER trg_wf_edit_ops_grammar ON public.sys_wf_order_edit_ops_cd IS 'Freezes V1 operation grammar after the migration seed so policy administration cannot invent executable operations.';
COMMENT ON TRIGGER trg_wf_edit_tgt_grammar ON public.sys_wf_order_edit_op_tgt_cd IS 'Freezes valid V1 operation-target pairs after the migration seed so policy administration cannot widen target scope.';
COMMENT ON TRIGGER trg_sys_wf_edit_policy_guard ON public.sys_wf_edit_policy_mst IS 'Enforces header lifecycle and revision invariants before policy rows can change or be deleted.';
COMMENT ON TRIGGER trg_sys_wf_edit_rule_guard ON public.sys_wf_edit_policy_rule_dtl IS 'Enforces rule immutability after publication, profile-status compatibility, and freshness revision advancement before persistence.';
COMMENT ON TRIGGER trg_org_wf_edit_asg_guard ON public.org_wf_edit_policy_asg_cf IS 'Prevents a tenant assignment activating an unapproved, inactive, mismatched, unassigned, or erasable policy.';

COMMIT;

