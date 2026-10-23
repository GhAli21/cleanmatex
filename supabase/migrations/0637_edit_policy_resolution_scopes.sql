-- ============================================================================
-- Migration: 0637_edit_policy_resolution_scopes.sql
-- Purpose: Reuse Edit Policies through organization/profile overrides and
--          published version defaults, with one fail-closed SQL resolver.
-- Affected: Edit Policy catalogs, headers, rules, assignments, defaults and guards.
-- Related: 0597 foundation, 0599 atomic save, 0606 promotion, 0622 residual history.
-- Preflight: supabase_local, 2026-10-23, read-only section 6.1: zero collisions.
-- Live assignments: 0; distinct live assigned policies: 0; policy headers: 5.
-- Total assignments: 0; unresolved versions (including inactive): 0.
-- Inactive fallback count: 0; unresolved history raises instead of inventing scope.
-- Catalog: 13 existing operations / 15 pairs; seed adds 17 operations / 20 pairs.
-- No default, assignment, policy promotion or ALLOW rule is seeded here.
-- Trusted tenant server: Prisma DATABASE_URL uses postgres (owner); HQ uses
-- service_role. Owner privileges remain; only service_role receives new grants.
-- Application and behavioral DB verification are reserved for the operator.
-- Rollback: any failure rolls back this entire transaction. After application,
-- use a reviewed forward migration; never erase policy/default/override history.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Serialize conversion against assignments while repeating the collision check
-- at application time; the earlier read-only snapshot is not rollout authority.
LOCK TABLE public.org_wf_edit_policy_asg_cf IN ACCESS EXCLUSIVE MODE;
DO $preflight$
DECLARE
  v_tenant_id UUID;
  v_profile_id UUID;
  v_assignment_id UUID;
  v_count BIGINT;
BEGIN
  -- Enumerate organizations, then inspect each assignment with an explicit tenant
  -- predicate. Never silently choose a winner when versions collapse to a profile.
  FOR v_tenant_id IN SELECT tenant.id FROM public.org_tenants_mst AS tenant LOOP
    SELECT assignment.id INTO v_assignment_id
    FROM public.org_wf_edit_policy_asg_cf AS assignment
    LEFT JOIN public.sys_wf_profile_ver_mst AS version
      ON version.version_id = assignment.workflow_profile_version_id
    WHERE assignment.tenant_org_id = v_tenant_id AND version.version_id IS NULL
    ORDER BY assignment.id LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Edit Policy backfill: unresolved version for tenant_org_id=%, assignment_id=%', v_tenant_id, v_assignment_id
        USING ERRCODE = '23514';
    END IF;
    SELECT version.profile_id, COUNT(*) INTO v_profile_id, v_count
    FROM public.org_wf_edit_policy_asg_cf AS assignment
    JOIN public.sys_wf_profile_ver_mst AS version
      ON version.version_id = assignment.workflow_profile_version_id
    WHERE assignment.tenant_org_id = v_tenant_id
      AND assignment.rec_status = 1 AND assignment.is_active = true
    GROUP BY version.profile_id HAVING COUNT(*) > 1
    ORDER BY version.profile_id LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Edit Policy backfill collision: tenant_org_id=%, profile_id=%, live_assignments=%', v_tenant_id, v_profile_id, v_count
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$preflight$;

-- Remove only the frozen grammar triggers and their now-unreferenced function;
-- catalog rows and rule foreign keys survive. RESTRICT rejects unknown dependents.
-- Replace the operation freeze with identity-preserving catalog validation below.
DROP TRIGGER trg_wf_edit_ops_grammar ON public.sys_wf_order_edit_ops_cd RESTRICT;
-- Replace the pair freeze while retaining every existing operation/target row.
DROP TRIGGER trg_wf_edit_tgt_grammar ON public.sys_wf_order_edit_op_tgt_cd RESTRICT;
-- Both known callers are removed; RESTRICT preserves any unexpected dependency.
DROP FUNCTION public.sys_wf_edit_grammar_guard() RESTRICT;

-- Reviewed migrations may extend the catalog while identities and history stay
-- protected. Browser roles retain no catalog write privileges.
CREATE FUNCTION public.sys_wf_edit_catalog_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '%: deactivate catalog history instead of deleting it', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF NEW.operation_code IS NULL OR NEW.operation_code !~ '^[A-Z][A-Z0-9_]{2,63}$' THEN
    RAISE EXCEPTION '%: invalid operation code', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.operation_code IS DISTINCT FROM OLD.operation_code THEN
    RAISE EXCEPTION '%: operation_code is immutable', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'sys_wf_order_edit_op_tgt_cd' THEN
    IF NEW.target_type IS NULL OR NEW.target_type NOT IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE') THEN
      RAISE EXCEPTION '%: invalid target type', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.target_type IS DISTINCT FROM OLD.target_type THEN
      RAISE EXCEPTION '%: pair identity is immutable; deactivate and insert', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sys_wf_order_edit_ops_cd AS operation WHERE operation.operation_code = NEW.operation_code) THEN
      RAISE EXCEPTION '%: operation does not exist', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_catalog_guard() IS 'Allows migration-owned catalog expansion; protects code and pair identities, four target types and retained history.';
-- New trigger names distinguish extensible validation from the removed freeze.
CREATE TRIGGER trg_wf_edit_ops_catalog BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_wf_order_edit_ops_cd FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_catalog_guard();
COMMENT ON TRIGGER trg_wf_edit_ops_catalog ON public.sys_wf_order_edit_ops_cd IS 'Validates extensible reviewed operation codes and prevents identity changes or hard deletion.';
CREATE TRIGGER trg_wf_edit_tgt_catalog BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_wf_order_edit_op_tgt_cd FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_catalog_guard();
COMMENT ON TRIGGER trg_wf_edit_tgt_catalog ON public.sys_wf_order_edit_op_tgt_cd IS 'Validates four-target catalog pairs and preserves their historical identity without freezing additions.';

-- Only the specified new codes are upserted. Existing operation names and pairs
-- are retained; catalog registration supplies no executable writer or permission.
INSERT INTO public.sys_wf_order_edit_ops_cd
  (operation_code, name, name2, description, description2, created_info, is_active, rec_status)
VALUES
  ('CHANGE_CUSTOMER', 'Change Customer', 'تغيير العميل', 'Change the customer reference; separate from the customer snapshot.', 'تغيير مرجع العميل؛ مستقل عن لقطة العميل.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_BRANCH', 'Change Branch', 'تغيير الفرع', 'Change the order branch.', 'تغيير فرع الطلب.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ORDER_TYPE', 'Change Order Type', 'تغيير نوع الطلب', 'Change the order type reference.', 'تغيير مرجع نوع الطلب.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_EXPRESS', 'Change Express', 'تغيير المستعجل', 'Change the express indicator.', 'تغيير مؤشر الطلب المستعجل.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_QUICK_DROP', 'Change Quick Drop', 'تغيير التسليم السريع', 'Change quick-drop mode and quantity.', 'تغيير وضع التسليم السريع وكميته.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PAYMENT_NOTES', 'Change Payment Notes', 'تغيير ملاحظات الدفع', 'Change payment notes only; no collection or refund.', 'تغيير ملاحظات الدفع فقط؛ دون تحصيل أو استرداد.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ORDER_SOURCE', 'Change Order Source', 'تغيير مصدر الطلب', 'Change the order source code.', 'تغيير رمز مصدر الطلب.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PHYSICAL_INTAKE', 'Change Physical Intake', 'تغيير الاستلام الفعلي', 'Change physical-intake status and receipt information.', 'تغيير حالة الاستلام الفعلي ومعلوماته.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_B2B_REFERENCE', 'Change B2B Reference', 'تغيير مرجع المنشأة التجارية', 'Change contract, cost center and purchase-order references.', 'تغيير مراجع العقد ومركز التكلفة وأمر الشراء.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_DISCOUNT', 'Change Discount', 'تغيير الخصم', 'Change governed discount, promotion or gift-card inputs; never silently rewrite money.', 'تغيير مدخلات الخصم أو العرض أو بطاقة الهدية المحكومة؛ دون تغيير صامت للمبالغ.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PAYMENT_TYPE', 'Change Payment Type', 'تغيير نوع الدفع', 'Change the payment type; does not collect payment.', 'تغيير نوع الدفع؛ دون تحصيل دفعة.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_PRODUCT', 'Change Item Product', 'تغيير منتج الصنف', 'Change the product of a persisted item.', 'تغيير منتج صنف محفوظ.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_SERVICE', 'Change Item Service', 'تغيير خدمة الصنف', 'Change the service category of a persisted item.', 'تغيير فئة خدمة صنف محفوظ.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_PRICE', 'Change Item Price', 'تغيير سعر الصنف', 'Change item unit price and override reason; preference charges remain preferences.', 'تغيير سعر وحدة الصنف وسبب التجاوز؛ رسوم التفضيلات تبقى ضمن التفضيلات.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PIECE_BRAND', 'Change Piece Brand', 'تغيير ماركة القطعة', 'Change the brand of a persisted piece.', 'تغيير ماركة قطعة محفوظة.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PIECE_RACK', 'Change Piece Rack', 'تغيير رف القطعة', 'Change the rack location of a persisted piece.', 'تغيير موقع رف قطعة محفوظة.', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_UNLISTED', 'Change Other Field', 'تغيير حقل آخر', 'Residual field change; a missing policy rule denies, and catalog registration supplies no writer.', 'تغيير حقل آخر؛ غياب قاعدة السياسة يمنع التغيير، وتسجيل الرمز لا يوفر تنفيذ التعديل.', 'Extend Order Edit Policy catalog', true, 1)
ON CONFLICT (operation_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

-- Pair labels live on the operation master; the pair table has no label columns.
INSERT INTO public.sys_wf_order_edit_op_tgt_cd
  (operation_code, target_type, created_info, is_active, rec_status)
VALUES
  ('CHANGE_CUSTOMER', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_BRANCH', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ORDER_TYPE', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_EXPRESS', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_QUICK_DROP', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PAYMENT_NOTES', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ORDER_SOURCE', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PHYSICAL_INTAKE', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_B2B_REFERENCE', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_DISCOUNT', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PAYMENT_TYPE', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_PRODUCT', 'ITEM', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_SERVICE', 'ITEM', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_ITEM_PRICE', 'ITEM', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PIECE_BRAND', 'PIECE', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_PIECE_RACK', 'PIECE', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_UNLISTED', 'ORDER', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_UNLISTED', 'ITEM', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_UNLISTED', 'PIECE', 'Extend Order Edit Policy catalog', true, 1),
  ('CHANGE_UNLISTED', 'PREFERENCE', 'Extend Order Edit Policy catalog', true, 1)
ON CONFLICT (operation_code, target_type) DO UPDATE SET
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

-- Temporarily remove the identity guard within this locked transaction only;
-- converting old keys would otherwise be rejected by either guard generation.
DROP TRIGGER trg_org_wf_edit_asg_guard ON public.org_wf_edit_policy_asg_cf RESTRICT;
-- Scope separates broad organization authority from a profile-family override.
ALTER TABLE public.org_wf_edit_policy_asg_cf
  ADD COLUMN scope TEXT, -- Distinguishes organization-wide authority from a profile-family slot.
  ADD COLUMN workflow_profile_id UUID, -- NULL is reserved for organization-wide authority.
  ADD COLUMN gap_acknowledged BOOLEAN NOT NULL DEFAULT false; -- Broad coverage gaps require explicit acceptance.
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.scope IS 'Immutable ORGANIZATION or PROFILE override scope; backfill preserves prior assignments as PROFILE.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.workflow_profile_id IS 'Profile family required only for PROFILE scope; applies across its versions.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.gap_acknowledged IS 'Explicit acknowledgement required before an organization-wide override becomes live; uncovered statuses deny.';

-- Fill both live and inactive rows without reactivation. Every version must
-- resolve; no inactive row is silently turned into an organization override.
DO $backfill$
DECLARE v_tenant_id UUID;
BEGIN
  FOR v_tenant_id IN SELECT tenant.id FROM public.org_tenants_mst AS tenant LOOP
    UPDATE public.org_wf_edit_policy_asg_cf AS assignment
    SET scope = 'PROFILE', workflow_profile_id = version.profile_id, gap_acknowledged = false
    FROM public.sys_wf_profile_ver_mst AS version
    WHERE assignment.tenant_org_id = v_tenant_id
      AND version.version_id = assignment.workflow_profile_version_id;
  END LOOP;
END;
$backfill$;
-- Enforce shape only after all historical rows have acquired a real profile.
ALTER TABLE public.org_wf_edit_policy_asg_cf
  ALTER COLUMN scope SET NOT NULL,
  ADD CONSTRAINT ck_wf_edit_asg_scope CHECK (
    (scope = 'ORGANIZATION' AND workflow_profile_id IS NULL
      AND (rec_status <> 1 OR is_active = false OR gap_acknowledged = true))
    OR (scope = 'PROFILE' AND workflow_profile_id IS NOT NULL)),
  ADD CONSTRAINT fk_wf_edit_asg_prof FOREIGN KEY (workflow_profile_id)
    REFERENCES public.sys_wf_profiles_cd(profile_id) ON UPDATE RESTRICT ON DELETE RESTRICT;
COMMENT ON CONSTRAINT ck_wf_edit_asg_scope ON public.org_wf_edit_policy_asg_cf IS 'Requires a profile for PROFILE, forbids it for ORGANIZATION and requires acknowledgement for a live broad override.';
COMMENT ON CONSTRAINT fk_wf_edit_asg_prof ON public.org_wf_edit_policy_asg_cf IS 'Retains the real workflow profile family of historical and live overrides; deletion is restricted.';

-- Version equality no longer defines assignment identity. The simple policy FK
-- replaces this composite dependency before its parent unique constraint drops.
ALTER TABLE public.org_wf_edit_policy_asg_cf DROP CONSTRAINT fk_wf_edit_asg_policy RESTRICT;
-- Replace exact-version exclusivity with independent organization/profile slots.
DROP INDEX public.uq_wf_edit_asg_active RESTRICT;
-- Retain the source-version column as history, not as resolution authority.
ALTER TABLE public.org_wf_edit_policy_asg_cf ALTER COLUMN workflow_profile_version_id DROP NOT NULL;
DO $history$
DECLARE v_tenant_id UUID;
BEGIN
  FOR v_tenant_id IN SELECT tenant.id FROM public.org_tenants_mst AS tenant LOOP
    UPDATE public.org_wf_edit_policy_asg_cf AS assignment
    SET created_info = concat_ws(E'\n', NULLIF(assignment.created_info, ''),
          'backfill_version_id=' || assignment.workflow_profile_version_id::text),
        workflow_profile_version_id = NULL
    WHERE assignment.tenant_org_id = v_tenant_id
      AND assignment.rec_status = 1 AND assignment.is_active = true;
  END LOOP;
END;
$history$;
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.workflow_profile_version_id IS 'Historical source version, ignored by resolution; null on new and converted live rows, with old live key appended to created_info.';
COMMENT ON COLUMN public.org_wf_edit_policy_asg_cf.created_info IS 'Non-secret creation provenance; converted live rows append backfill_version_id without erasing original evidence.';
-- The policy primary key already supplies reusable identity, with no composite
-- column order or nullable tenant foreign-key ambiguity for Prisma.
ALTER TABLE public.org_wf_edit_policy_asg_cf ADD CONSTRAINT fk_wf_edit_asg_pol
  FOREIGN KEY (edit_policy_id) REFERENCES public.sys_wf_edit_policy_mst(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_wf_edit_asg_pol ON public.org_wf_edit_policy_asg_cf IS 'References reusable policy identity without binding the override to its authored-against version; retains audit evidence.';
-- Each level has one live slot; inactive history never blocks replacement.
CREATE UNIQUE INDEX uq_wf_edit_asg_org ON public.org_wf_edit_policy_asg_cf(tenant_org_id)
  WHERE scope = 'ORGANIZATION' AND rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.uq_wf_edit_asg_org IS 'Prevents competing live organization-wide overrides for one tenant.';
-- Tenant-first lookup enforces one live profile-family winner without hiding history.
CREATE UNIQUE INDEX uq_wf_edit_asg_prof ON public.org_wf_edit_policy_asg_cf(tenant_org_id, workflow_profile_id)
  WHERE scope = 'PROFILE' AND rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.uq_wf_edit_asg_prof IS 'Prevents competing live profile-family overrides inside one tenant; tenant-first lookup supports resolution.';

-- Overrides retain immutable identities and deletions remain forbidden. Current
-- workflow assignment is checked by family rather than by a version number.
CREATE OR REPLACE FUNCTION public.org_wf_edit_asg_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: deactivate assignments instead of deleting audit evidence' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.workflow_profile_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: new overrides must leave the historical version null' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_org_id IS DISTINCT FROM OLD.tenant_org_id
    OR NEW.scope IS DISTINCT FROM OLD.scope
    OR NEW.workflow_profile_id IS DISTINCT FROM OLD.workflow_profile_id
    OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id
    OR (OLD.scope = 'ORGANIZATION' AND OLD.rec_status = 1 AND OLD.is_active = true
      AND NEW.gap_acknowledged IS DISTINCT FROM OLD.gap_acknowledged)
  ) THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: assignment identity is immutable; deactivate and insert' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.sys_wf_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id AND policy.lifecycle_status IN ('PILOT', 'PUBLISHED')
    AND policy.rec_status = 1 AND policy.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: live override requires an active PILOT or PUBLISHED policy' USING ERRCODE = '23514';
  END IF;
  IF NEW.scope = 'PROFILE' THEN
    PERFORM 1 FROM public.org_wf_profile_assign_cf AS workflow_assignment
    WHERE workflow_assignment.tenant_org_id = NEW.tenant_org_id
      AND workflow_assignment.wf_profile_id = NEW.workflow_profile_id
      AND workflow_assignment.rec_status = 1 AND workflow_assignment.is_active = true FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: profile override requires an active organization profile assignment' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.scope = 'ORGANIZATION' AND NEW.gap_acknowledged IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'org_wf_edit_policy_asg_cf: organization override requires gap acknowledgement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.org_wf_edit_asg_guard() IS 'Preserves override identity/history and requires a usable policy, profile-family assignment or explicit organization acknowledgement for live links.';
CREATE TRIGGER trg_org_wf_edit_asg_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.org_wf_edit_policy_asg_cf FOR EACH ROW EXECUTE FUNCTION public.org_wf_edit_asg_guard();
COMMENT ON TRIGGER trg_org_wf_edit_asg_guard ON public.org_wf_edit_policy_asg_cf IS 'Guards scope identity and live override eligibility; inactive retirement skips lifecycle checks.';
COMMENT ON TABLE public.org_wf_edit_policy_asg_cf IS 'Organization/profile-family Edit Policy overrides with immutable identity and retained inactive history; existing tenant RLS stays in force.';

-- Authored-against version becomes optional provenance. Existing headers retain
-- their original value and the original FK; published immutability is preserved.
ALTER TABLE public.sys_wf_edit_policy_mst ALTER COLUMN workflow_profile_version_id DROP NOT NULL;
COMMENT ON COLUMN public.sys_wf_edit_policy_mst.workflow_profile_version_id IS 'Optional authored-against workflow version, ignored by resolution; null identifies a reusable catalog policy without a version note.';
-- No FK now depends on this composite UNIQUE constraint; id is the policy key.
ALTER TABLE public.sys_wf_edit_policy_mst DROP CONSTRAINT uq_wf_edit_policy_ver RESTRICT;
COMMENT ON TABLE public.sys_wf_edit_policy_mst IS 'Reusable HQ-owned Edit Policy aggregate; overrides and defaults choose authority independently of its authored-against version.';

-- Reusable rules require an active global status, not membership of the optional
-- authored-against version. Preserve 0599 atomic-save revision suppression.
CREATE OR REPLACE FUNCTION public.sys_wf_edit_rule_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE v_policy_id UUID; v_lifecycle TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: rule policy identity is immutable' USING ERRCODE = '23514';
  END IF;
  v_policy_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.edit_policy_id ELSE NEW.edit_policy_id END;
  SELECT policy.lifecycle_status INTO v_lifecycle
  FROM public.sys_wf_edit_policy_mst AS policy WHERE policy.id = v_policy_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: policy % does not exist', v_policy_id USING ERRCODE = '23514';
  END IF;
  IF v_lifecycle IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: % policy rules are immutable', v_lifecycle USING ERRCODE = '23514';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.sys_wf_statuses_cd AS status
    WHERE status.status_code = NEW.workflow_status AND status.rec_status = 1 AND status.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: workflow status % is not active', NEW.workflow_status USING ERRCODE = '23514';
  END IF;
  IF current_setting('cmx.edit_policy_save', true) IS DISTINCT FROM 'on' THEN
    -- Direct rule mutations invalidate reviews once; the atomic save command
    -- advances the aggregate once after replacing its entire matrix instead.
    UPDATE public.sys_wf_edit_policy_mst SET policy_revision = policy_revision + 1,
      updated_at = CURRENT_TIMESTAMP, updated_info = 'Edit Policy rule matrix changed'
    WHERE id = v_policy_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_rule_guard() IS 'Protects immutable published matrices, validates active global statuses and retains exactly-once aggregate revisions for the atomic save command.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.workflow_status IS 'Active global workflow status; default binding checks profile-version coverage instead of restricting reusable rules to one version.';
COMMENT ON TABLE public.sys_wf_edit_policy_rule_dtl IS 'Explicit reusable status/operation/target decisions; missing live cells deny and published matrices remain immutable.';

-- Coverage is evaluated dynamically over distinct statuses (screen membership
-- can repeat them) and the live catalog, without a fixed pair count.
CREATE FUNCTION public.sys_wf_edit_cov_status(policy_id UUID, version_id UUID)
RETURNS TABLE(status_code TEXT, operation_code TEXT, target_type TEXT)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT DISTINCT membership.status_code, pair.operation_code, pair.target_type
  FROM public.sys_wf_prof_ver_mod_st_cf AS membership
  CROSS JOIN public.sys_wf_order_edit_op_tgt_cd AS pair
  WHERE membership.version_id = $2 AND membership.rec_status = 1 AND membership.is_active = true
    AND pair.rec_status = 1 AND pair.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.sys_wf_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = $1 AND rule.workflow_status = membership.status_code
        AND rule.operation_code = pair.operation_code AND rule.target_type = pair.target_type
        AND rule.rec_status = 1 AND rule.is_active = true
    )
  ORDER BY membership.status_code, pair.operation_code, pair.target_type;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_cov_status(UUID, UUID) IS 'Returns missing live status/operation/target triples for a version default; deduplicates screen membership and never assumes a fixed catalog size.';

-- Defaults are global configuration with no tenant column or RLS. Explicit
-- privilege revocation below keeps the Data API browser roles outside this table.
CREATE TABLE public.sys_wf_edit_policy_def_cf (
  id UUID NOT NULL DEFAULT gen_random_uuid(), -- Stable history link, never replaced in place.
  workflow_profile_version_id UUID NOT NULL, -- Exact version whose statuses require coverage.
  edit_policy_id UUID NOT NULL, -- Published reusable policy serving as the lowest authority.
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Link creation time.
  created_by UUID, -- HQ actor when known.
  created_info TEXT, -- Non-secret provenance.
  updated_at TIMESTAMPTZ, -- Last lifecycle edit time.
  updated_by UUID, -- HQ actor of the last edit.
  updated_info TEXT, -- Non-secret update provenance.
  rec_status SMALLINT NOT NULL DEFAULT 1, -- 1=active, 0=soft-deleted.
  rec_order INTEGER, -- Optional administration ordering.
  rec_notes TEXT, -- Non-secret operator note.
  is_active BOOLEAN NOT NULL DEFAULT true, -- Live only together with rec_status=1.
  CONSTRAINT pk_wf_edit_def PRIMARY KEY(id), -- Replacement links keep separate audit identities.
  -- Preserve referenced version evidence; lifecycle changes never cascade-delete links.
  CONSTRAINT fk_wf_edit_def_ver FOREIGN KEY(workflow_profile_version_id)
    REFERENCES public.sys_wf_profile_ver_mst(version_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- Reusable policy identity is independent of its optional authored-against version.
  CONSTRAINT fk_wf_edit_def_pol FOREIGN KEY(edit_policy_id)
    REFERENCES public.sys_wf_edit_policy_mst(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_wf_edit_def_status CHECK(rec_status IN (0, 1)) -- Reject ambiguous lifecycle values.
);
COMMENT ON TABLE public.sys_wf_edit_policy_def_cf IS 'HQ-only published Edit Policy default for one workflow version; no tenant data, no browser grants, no seeded authority.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.id IS 'Stable default-link identity retained when a replacement deactivates this row.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.workflow_profile_version_id IS 'Exact workflow version whose distinct active statuses must be fully covered.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.edit_policy_id IS 'Reusable policy identity; only active PUBLISHED policies may be live defaults.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.created_at IS 'Creation timestamp, defaulted to the transaction time for audit consistency.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.created_by IS 'HQ actor that created the link when known.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.created_info IS 'Non-secret provenance of the default link.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.updated_at IS 'Timestamp of the most recent permitted lifecycle update.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.updated_by IS 'HQ actor responsible for the most recent permitted update.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.updated_info IS 'Non-secret provenance for the most recent permitted update.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.rec_status IS '1=active, 0=soft-deleted; live authority also requires is_active=true.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.rec_order IS 'Optional administrative ordering; never resolution precedence.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.rec_notes IS 'Optional non-secret operator note retained with link history.';
COMMENT ON COLUMN public.sys_wf_edit_policy_def_cf.is_active IS 'Deactivation releases the default slot without deleting evidence.';
COMMENT ON CONSTRAINT pk_wf_edit_def ON public.sys_wf_edit_policy_def_cf IS 'Keeps each default-link history row independently addressable.';
COMMENT ON CONSTRAINT fk_wf_edit_def_ver ON public.sys_wf_edit_policy_def_cf IS 'Restricts deletion of workflow versions referenced by retained default evidence.';
COMMENT ON CONSTRAINT fk_wf_edit_def_pol ON public.sys_wf_edit_policy_def_cf IS 'Restricts deletion of policies referenced by retained default evidence.';
COMMENT ON CONSTRAINT ck_wf_edit_def_status ON public.sys_wf_edit_policy_def_cf IS 'Permits only explicit active or soft-deleted record lifecycle states.';
-- Unique live slot preserves inactive history while allowing replacement.
CREATE UNIQUE INDEX uq_wf_edit_def_ver ON public.sys_wf_edit_policy_def_cf(workflow_profile_version_id)
  WHERE rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.uq_wf_edit_def_ver IS 'Allows at most one live default per exact workflow version.';
-- Supports finding defaults that reference a policy before controlled retirement.
CREATE INDEX idx_wf_edit_def_pol ON public.sys_wf_edit_policy_def_cf(edit_policy_id)
  WHERE rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.idx_wf_edit_def_pol IS 'Locates live defaults for a policy during retirement and HQ configuration inspection.';

-- Inactive links skip eligibility so broken authority can always be deactivated.
-- SHARE locks serialize activation with policy and workflow lifecycle changes.
CREATE FUNCTION public.sys_wf_edit_def_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: deactivate defaults instead of deleting history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id
    OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: default identity is immutable; deactivate and insert' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.sys_wf_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id AND policy.lifecycle_status = 'PUBLISHED'
    AND policy.rec_status = 1 AND policy.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: default requires an active PUBLISHED Edit Policy' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.sys_wf_profile_ver_mst AS version
  WHERE version.version_id = NEW.workflow_profile_version_id
    AND version.version_status IN ('PILOT', 'PUBLISHED')
    AND version.rec_status = 1 AND version.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: default requires an active PILOT or PUBLISHED workflow version' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS membership
    WHERE membership.version_id = NEW.workflow_profile_version_id
      AND membership.rec_status = 1 AND membership.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: profile version has no active statuses' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_wf_edit_cov_status(NEW.edit_policy_id, NEW.workflow_profile_version_id)) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_def_cf: default is missing live status/operation/target decisions' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_def_guard() IS 'Preserves default history and permits live links only for usable workflow versions, published policies and complete dynamic coverage; zero active statuses fail.';
CREATE TRIGGER trg_wf_edit_def_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_wf_edit_policy_def_cf FOR EACH ROW EXECUTE FUNCTION public.sys_wf_edit_def_guard();
COMMENT ON TRIGGER trg_wf_edit_def_guard ON public.sys_wf_edit_policy_def_cf IS 'Checks immutable identity and full coverage when activating a default; deactivation remains possible after authority breaks.';

-- One resolver for both trusted servers. Each authority level is counted before
-- policy filtering, so broken links deny instead of revealing a lower level.
-- A deny or uncovered status returns one sentinel row with NULL operation/target;
-- callers must deny missing cells rather than treating an empty matrix as ALLOW.
CREATE FUNCTION public.sys_wf_resolve_edit_policy(
  p_tenant_org_id UUID, p_profile_id UUID, p_profile_version_id UUID, p_workflow_status TEXT
)
RETURNS TABLE (
  resolution_level TEXT, deny_reason TEXT, edit_policy_id UUID, policy_revision INTEGER,
  policy_code TEXT, workflow_status TEXT, operation_code TEXT, target_type TEXT,
  decision TEXT, reason_code TEXT, message_key TEXT, requires_reason BOOLEAN,
  required_permission_code TEXT, override_permission_code TEXT
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_count BIGINT;
  v_policy_id UUID;
  v_ids UUID[];
  v_policy public.sys_wf_edit_policy_mst%ROWTYPE;
BEGIN
  workflow_status := p_workflow_status;
  resolution_level := 'DENY';
  deny_reason := 'NO_AUTHORITY';
  -- Organization authority deliberately precedes every narrower authority.
  SELECT COUNT(*), array_agg(assignment.edit_policy_id) INTO v_count, v_ids
  FROM public.org_wf_edit_policy_asg_cf AS assignment
  WHERE assignment.tenant_org_id = p_tenant_org_id AND assignment.scope = 'ORGANIZATION'
    AND assignment.rec_status = 1 AND assignment.is_active = true;
  IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_ORGANIZATION'; RETURN NEXT; RETURN; END IF;
  IF v_count = 1 THEN
    resolution_level := 'ORGANIZATION'; v_policy_id := v_ids[1];
  ELSIF p_profile_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(assignment.edit_policy_id) INTO v_count, v_ids
    FROM public.org_wf_edit_policy_asg_cf AS assignment
    WHERE assignment.tenant_org_id = p_tenant_org_id AND assignment.scope = 'PROFILE'
      AND assignment.workflow_profile_id = p_profile_id
      AND assignment.rec_status = 1 AND assignment.is_active = true;
    IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_PROFILE'; RETURN NEXT; RETURN; END IF;
    IF v_count = 1 THEN resolution_level := 'PROFILE'; v_policy_id := v_ids[1]; END IF;
  END IF;
  IF v_policy_id IS NULL AND p_profile_version_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(default_link.edit_policy_id) INTO v_count, v_ids
    FROM public.sys_wf_edit_policy_def_cf AS default_link
    WHERE default_link.workflow_profile_version_id = p_profile_version_id
      AND default_link.rec_status = 1 AND default_link.is_active = true;
    IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_DEFAULT'; RETURN NEXT; RETURN; END IF;
    IF v_count = 1 THEN resolution_level := 'VERSION_DEFAULT'; v_policy_id := v_ids[1]; END IF;
  END IF;
  IF v_policy_id IS NULL THEN RETURN NEXT; RETURN; END IF;
  SELECT policy.* INTO v_policy FROM public.sys_wf_edit_policy_mst AS policy WHERE policy.id = v_policy_id;
  IF NOT FOUND OR v_policy.rec_status <> 1 OR v_policy.is_active <> true
    OR v_policy.lifecycle_status NOT IN ('PILOT', 'PUBLISHED')
    OR (resolution_level = 'VERSION_DEFAULT' AND v_policy.lifecycle_status <> 'PUBLISHED') THEN
    resolution_level := 'DENY'; deny_reason := 'POLICY_NOT_USABLE'; RETURN NEXT; RETURN;
  END IF;
  edit_policy_id := v_policy.id; policy_revision := v_policy.policy_revision; policy_code := v_policy.policy_code;
  deny_reason := 'NONE';
  RETURN QUERY SELECT resolution_level, deny_reason, v_policy.id, v_policy.policy_revision,
    v_policy.policy_code, p_workflow_status, rule.operation_code, rule.target_type,
    rule.decision, rule.reason_code, rule.message_key, rule.requires_reason,
    rule.required_permission_code, rule.override_permission_code
  FROM public.sys_wf_edit_policy_rule_dtl AS rule
  WHERE rule.edit_policy_id = v_policy.id AND rule.workflow_status = p_workflow_status
    AND rule.rec_status = 1 AND rule.is_active = true
  ORDER BY rule.operation_code, rule.target_type;
  IF NOT FOUND THEN deny_reason := 'STATUS_NOT_COVERED'; RETURN NEXT; END IF;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_resolve_edit_policy(UUID, UUID, UUID, TEXT) IS 'Fail-closed organization > profile > published version default resolution; ambiguous/broken links stop, missing status preserves winner identity, and every tenant read has an explicit predicate.';

-- Preserve the existing lifecycle and published-field immutability checks from
-- 0606; only promotion coverage moves to published default activation.
CREATE OR REPLACE FUNCTION public.sys_wf_edit_policy_guard()
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

  -- Reusable policies may intentionally cover only selected statuses. Full
  -- version coverage belongs to default activation, not policy promotion.
  IF NEW.lifecycle_status IN ('PILOT', 'PUBLISHED') AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sys_wf_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = NEW.id AND rule.rec_status = 1 AND rule.is_active = true
    ) THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: promotion requires at least one live rule' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.sys_wf_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = NEW.id AND rule.rec_status = 1 AND rule.is_active = true
        AND (NOT EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd AS status
          WHERE status.status_code = rule.workflow_status AND status.rec_status = 1 AND status.is_active = true
        ) OR NOT EXISTS (
          SELECT 1 FROM public.sys_wf_order_edit_op_tgt_cd AS pair
          JOIN public.sys_wf_order_edit_ops_cd AS operation ON operation.operation_code = pair.operation_code
          WHERE pair.operation_code = rule.operation_code AND pair.target_type = rule.target_type
            AND pair.rec_status = 1 AND pair.is_active = true
            AND operation.rec_status = 1 AND operation.is_active = true
        ))
    ) THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: promotion requires active statuses and catalog pairs' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_policy_guard() IS 'Preserves controlled lifecycle, revision progression and published immutability; promotion needs nonempty valid live rules, while complete version coverage is enforced on defaults.';

-- Refresh stale frozen/version-bound catalog documentation in this forward
-- migration only; historical migration text and existing evidence stay intact.
COMMENT ON TABLE public.sys_wf_order_edit_ops_cd IS 'Migration-owned extensible Order Change catalog with bilingual labels; registration never ships a writer or grants permission.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.operation_code IS 'Immutable reviewed operation token matching the uppercase catalog grammar; browser input cannot invent commands.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.description IS 'English scope description of the reviewed operation, independent of writer availability.';
COMMENT ON COLUMN public.sys_wf_order_edit_ops_cd.description2 IS 'Arabic scope description of the reviewed operation, independent of writer availability.';
COMMENT ON TABLE public.sys_wf_order_edit_op_tgt_cd IS 'Extensible reviewed operation/target pairs; defaults require decisions for every live pair and missing rules deny.';
COMMENT ON COLUMN public.sys_wf_order_edit_op_tgt_cd.operation_code IS 'Reviewed immutable operation identity whose permitted target is recorded by this pair.';
COMMENT ON CONSTRAINT pk_wf_edit_ops ON public.sys_wf_order_edit_ops_cd IS 'Provides immutable operation identity for reviewed catalog extensions and retained decisions.';
COMMENT ON CONSTRAINT pk_wf_edit_op_tgt ON public.sys_wf_order_edit_op_tgt_cd IS 'Provides one immutable operation/target identity for rule foreign keys.';
COMMENT ON CONSTRAINT fk_wf_edit_op_tgt_op ON public.sys_wf_order_edit_op_tgt_cd IS 'Requires a real catalog operation and restricts deletion to preserve pair history.';
COMMENT ON COLUMN public.sys_wf_edit_policy_rule_dtl.operation_code IS 'Reviewed extensible operation constrained with target_type by the catalog pair foreign key.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_status ON public.sys_wf_edit_policy_rule_dtl IS 'Requires a known global workflow status; the rule guard checks active state without authored-version membership.';
COMMENT ON CONSTRAINT fk_wf_edit_rule_op_tgt ON public.sys_wf_edit_policy_rule_dtl IS 'Prevents a rule from inventing a pair outside the migration-owned extensible catalog.';
COMMENT ON TRIGGER trg_sys_wf_edit_policy_guard ON public.sys_wf_edit_policy_mst IS 'Preserves controlled lifecycle and immutable published evidence without requiring authored-version coverage on promotion.';
COMMENT ON TRIGGER trg_sys_wf_edit_rule_guard ON public.sys_wf_edit_policy_rule_dtl IS 'Protects published matrices and active global statuses while preserving atomic-save revision semantics.';

-- New public-schema tables/functions can inherit default ACLs. Explicitly revoke
-- browser/PUBLIC access, including EXECUTE inherited from PostgreSQL defaults.
REVOKE ALL ON TABLE public.sys_wf_edit_policy_def_cf FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_wf_resolve_edit_policy(UUID, UUID, UUID, TEXT),
  public.sys_wf_edit_cov_status(UUID, UUID), public.sys_wf_edit_catalog_guard(),
  public.sys_wf_edit_def_guard(), public.org_wf_edit_asg_guard(),
  public.sys_wf_edit_rule_guard(), public.sys_wf_edit_policy_guard()
FROM PUBLIC, anon, authenticated;
-- HQ authoring and tenant resolution run only through trusted server roles.
-- DELETE remains in the established table grant shape; its trigger rejects it.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_wf_edit_policy_def_cf TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_wf_resolve_edit_policy(UUID, UUID, UUID, TEXT),
  public.sys_wf_edit_cov_status(UUID, UUID), public.sys_wf_edit_catalog_guard(),
  public.sys_wf_edit_def_guard(), public.org_wf_edit_asg_guard(),
  public.sys_wf_edit_rule_guard(), public.sys_wf_edit_policy_guard()
TO service_role;

COMMIT;
