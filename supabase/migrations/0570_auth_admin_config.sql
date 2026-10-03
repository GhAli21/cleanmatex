-- ============================================================
-- Migration: 0570_auth_admin_config.sql
-- Purpose:   Authentication / session policy configuration for the User Session Lifecycle program,
--            stored in two dedicated tables (not the generic settings system):
--              sys_auth_admin_config_cf  — global catalog, one row per config item. Holds the
--                                          platform value, the allowed range/values and whether
--                                          tenants may override the item (is_allow_tenant_change).
--              org_auth_admin_config_cf  — per-tenant override rows, accepted only for items the
--                                          catalog allows tenants to change and only within bounds.
--            Also moves the sign-in lockout thresholds (previously hardcoded in
--            record_login_attempt) into the catalog as platform-only items.
-- Affected:  new: sys_auth_admin_config_cf, org_auth_admin_config_cf, fn_auth_cfg_value_ok(),
--            fn_auth_cfg_sys_guard(), fn_auth_cfg_org_guard(), fn_auth_cfg_sys_audit(), fn_auth_cfg_org_audit(),
--            fn_auth_cfg_platform_int(), fn_auth_config_effective();
--            changed: record_login_attempt() (reads lockout thresholds from the catalog)
-- Related:   0561 (sys_auth_audit_log / fn_auth_log_event / CONFIG_CHANGED event),
--            0563 (user_code, membership-only current_tenant_id())
-- ============================================================

-- ------------------------------------------------------------
-- Pure value validator
-- ------------------------------------------------------------
-- Single definition of "is this text a valid value for an item of this type/bounds", shared by the
-- catalog guard (platform value) and the override guard (tenant value) so both obey identical rules.
-- INTEGER: whole number within [min,max]; BOOLEAN: 'true'|'false'; ENUM: one of allowed_values.
CREATE OR REPLACE FUNCTION fn_auth_cfg_value_ok(
  p_value_type     TEXT,
  p_value          TEXT,
  p_min_value      INTEGER,
  p_max_value      INTEGER,
  p_allowed_values TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_value_type
    WHEN 'INTEGER' THEN
      -- CASE (not AND): SQL does not guarantee AND short-circuit order, and the cast must only run on digits.
      CASE
        WHEN p_value ~ '^-?[0-9]{1,9}$'
          THEN p_value::INTEGER >= COALESCE(p_min_value, p_value::INTEGER)
           AND p_value::INTEGER <= COALESCE(p_max_value, p_value::INTEGER)
        ELSE false
      END
    WHEN 'BOOLEAN' THEN
      p_value IN ('true', 'false')
    WHEN 'ENUM' THEN
      p_allowed_values IS NOT NULL AND p_value = ANY (p_allowed_values)
    ELSE false
  END;
$$;

COMMENT ON FUNCTION fn_auth_cfg_value_ok(TEXT, TEXT, INTEGER, INTEGER, TEXT[]) IS
  'Pure validator: is p_value a valid INTEGER (within min/max), BOOLEAN (true/false) or ENUM (in allowed_values) value. Shared by the catalog and override guards.';

-- Deliberately NOT revoked from PUBLIC: it is a pure, side-effect-free function and Postgres checks EXECUTE on
-- functions used inside CHECK constraints for the role performing the write (service_role).

-- ------------------------------------------------------------
-- sys_auth_admin_config_cf: global catalog (platform-owned)
-- ------------------------------------------------------------
-- One row per configurable authentication/session item. HQ edits platform values and bounds, and
-- decides per item whether tenants may override it. Adding a new item later = inserting a row
-- (no schema change). Not tenant-scoped: no tenant_org_id.
CREATE TABLE sys_auth_admin_config_cf (
  config_code            TEXT PRIMARY KEY,                  -- Stable item code (AUTH_*), mirrored by lib/constants/auth-admin-config.ts.
  name                   TEXT NOT NULL,                     -- English label shown in the security settings UI.
  name2                  TEXT,                              -- Arabic label shown in the security settings UI.
  description            TEXT,                              -- English explanation of the item's effect.
  description2           TEXT,                              -- Arabic explanation of the item's effect.
  config_group           TEXT NOT NULL
                         CHECK (config_group IN ('SESSION', 'DEVICE', 'LOCKOUT')),   -- UI grouping.
  value_type             TEXT NOT NULL
                         CHECK (value_type IN ('INTEGER', 'BOOLEAN', 'ENUM')),       -- How config_value is parsed/validated.
  unit                   TEXT NOT NULL DEFAULT 'NONE'
                         CHECK (unit IN ('SECONDS', 'MINUTES', 'HOURS', 'DAYS', 'COUNT', 'NONE')), -- Display unit for INTEGER items.
  config_value           TEXT NOT NULL,                     -- Platform value, stored as text and validated per value_type.
  min_value              INTEGER,                           -- INTEGER items: inclusive lower bound (applies to platform AND tenant values).
  max_value              INTEGER,                           -- INTEGER items: inclusive upper bound (applies to platform AND tenant values).
  allowed_values         TEXT[],                            -- ENUM items: permitted values (applies to platform AND tenant values).
  is_allow_tenant_change BOOLEAN NOT NULL DEFAULT false,    -- true = tenants may store an override in org_auth_admin_config_cf; false = platform-managed.
  display_order          INTEGER NOT NULL DEFAULT 0,        -- Sort order inside the UI group.
  is_active              BOOLEAN NOT NULL DEFAULT true,     -- false = retired item (ignored by the resolver).
  rec_status             SMALLINT NOT NULL DEFAULT 1,       -- 1 = active, 0 = soft-deleted (never hard-delete).
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),-- Row creation time.
  created_by             TEXT,                              -- Creator identifier (user id / migration tag).
  created_info           TEXT,                              -- Free-form creation context.
  updated_at             TIMESTAMPTZ,                       -- Last modification time (set by trigger).
  updated_by             TEXT,                              -- Last modifier identifier.
  updated_info           TEXT,                              -- Free-form modification context.
  CONSTRAINT chk_auth_cfg_type_shape CHECK (
    (value_type = 'INTEGER' AND min_value IS NOT NULL AND max_value IS NOT NULL AND allowed_values IS NULL AND min_value <= max_value)
    OR (value_type = 'BOOLEAN' AND min_value IS NULL AND max_value IS NULL AND allowed_values IS NULL)
    OR (value_type = 'ENUM' AND min_value IS NULL AND max_value IS NULL AND allowed_values IS NOT NULL AND cardinality(allowed_values) > 0)
  ),
  CONSTRAINT chk_auth_cfg_value_valid CHECK (
    fn_auth_cfg_value_ok(value_type, config_value, min_value, max_value, allowed_values)
  )
);

COMMENT ON TABLE sys_auth_admin_config_cf IS
  'Global catalog of authentication/session policy items: platform value, bounds and whether tenants may override (is_allow_tenant_change). Platform-managed; tenants read it and override via org_auth_admin_config_cf.';
COMMENT ON COLUMN sys_auth_admin_config_cf.config_code IS 'Stable item code (AUTH_*); referenced by org_auth_admin_config_cf and mirrored in TypeScript constants.';
COMMENT ON COLUMN sys_auth_admin_config_cf.name IS 'English label.';
COMMENT ON COLUMN sys_auth_admin_config_cf.name2 IS 'Arabic label.';
COMMENT ON COLUMN sys_auth_admin_config_cf.description IS 'English description of what the item controls.';
COMMENT ON COLUMN sys_auth_admin_config_cf.description2 IS 'Arabic description of what the item controls.';
COMMENT ON COLUMN sys_auth_admin_config_cf.config_group IS 'UI grouping: SESSION, DEVICE or LOCKOUT.';
COMMENT ON COLUMN sys_auth_admin_config_cf.value_type IS 'INTEGER, BOOLEAN or ENUM; decides how config_value is validated.';
COMMENT ON COLUMN sys_auth_admin_config_cf.unit IS 'Display unit for INTEGER items (SECONDS, MINUTES, HOURS, DAYS, COUNT) or NONE.';
COMMENT ON COLUMN sys_auth_admin_config_cf.config_value IS 'Platform value as text (INTEGER digits, true/false, or an ENUM member).';
COMMENT ON COLUMN sys_auth_admin_config_cf.min_value IS 'INTEGER items: inclusive minimum for platform and tenant values.';
COMMENT ON COLUMN sys_auth_admin_config_cf.max_value IS 'INTEGER items: inclusive maximum for platform and tenant values.';
COMMENT ON COLUMN sys_auth_admin_config_cf.allowed_values IS 'ENUM items: permitted values for platform and tenant values.';
COMMENT ON COLUMN sys_auth_admin_config_cf.is_allow_tenant_change IS 'true = tenants may override this item; false = platform-managed (overrides are rejected).';
COMMENT ON COLUMN sys_auth_admin_config_cf.display_order IS 'Sort order within the UI group.';
COMMENT ON COLUMN sys_auth_admin_config_cf.is_active IS 'false = retired item, ignored by the resolver.';
COMMENT ON COLUMN sys_auth_admin_config_cf.rec_status IS '1 = active, 0 = soft-deleted.';
COMMENT ON COLUMN sys_auth_admin_config_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN sys_auth_admin_config_cf.created_by IS 'Creator identifier.';
COMMENT ON COLUMN sys_auth_admin_config_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN sys_auth_admin_config_cf.updated_at IS 'Last modification time.';
COMMENT ON COLUMN sys_auth_admin_config_cf.updated_by IS 'Last modifier identifier.';
COMMENT ON COLUMN sys_auth_admin_config_cf.updated_info IS 'Modification context.';
COMMENT ON CONSTRAINT chk_auth_cfg_type_shape ON sys_auth_admin_config_cf IS
  'INTEGER items need min/max (min<=max) and no allowed_values; BOOLEAN items need none of them; ENUM items need allowed_values only.';
COMMENT ON CONSTRAINT chk_auth_cfg_value_valid ON sys_auth_admin_config_cf IS
  'The platform value must itself be valid for the item type and bounds.';

ALTER TABLE sys_auth_admin_config_cf ENABLE ROW LEVEL SECURITY;

-- Catalog is non-sensitive reference data: signed-in users may read active items (UI shows the
-- platform default and allowed range next to the tenant override).
CREATE POLICY auth_admin_cfg_read ON sys_auth_admin_config_cf
  FOR SELECT TO authenticated
  USING (is_active = true AND rec_status = 1);
COMMENT ON POLICY auth_admin_cfg_read ON sys_auth_admin_config_cf IS
  'Authenticated users may read active catalog items; writes are platform-only (service role / HQ).';

REVOKE ALL ON TABLE sys_auth_admin_config_cf FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE sys_auth_admin_config_cf FROM authenticated;
GRANT SELECT ON TABLE sys_auth_admin_config_cf TO authenticated;
GRANT ALL ON TABLE sys_auth_admin_config_cf TO service_role;

-- ------------------------------------------------------------
-- org_auth_admin_config_cf: tenant overrides
-- ------------------------------------------------------------
-- A tenant's override of one catalog item. Only accepted when the item has is_allow_tenant_change
-- = true and the value is valid for the item's bounds (enforced by trigger). "Reset to platform
-- default" soft-deactivates the row (is_active=false, rec_status=0); overriding again reactivates it.
CREATE TABLE org_auth_admin_config_cf (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),      -- Override row identifier.
  tenant_org_id UUID NOT NULL
                REFERENCES org_tenants_mst(id) ON DELETE CASCADE, -- Owning tenant; overrides are deleted with the tenant.
  config_code   TEXT NOT NULL
                REFERENCES sys_auth_admin_config_cf(config_code) ON DELETE RESTRICT, -- Catalog item being overridden; RESTRICT because items are retired via is_active, never deleted.
  config_value  TEXT NOT NULL,                                    -- Tenant value as text; validated against the catalog item's type and bounds.
  rec_notes     TEXT,                                             -- Optional admin note explaining the override.
  is_active     BOOLEAN NOT NULL DEFAULT true,                    -- false = override reset to the platform default.
  rec_status    SMALLINT NOT NULL DEFAULT 1,                      -- 1 = active, 0 = soft-deleted (reset).
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),               -- Row creation time.
  created_by    TEXT,                                             -- Creator identifier (user id).
  created_info  TEXT,                                             -- Free-form creation context.
  updated_at    TIMESTAMPTZ,                                      -- Last modification time (set by trigger).
  updated_by    TEXT,                                             -- Last modifier identifier.
  updated_info  TEXT,                                             -- Free-form modification context.
  CONSTRAINT uq_org_auth_cfg_tenant_code UNIQUE (tenant_org_id, config_code)  -- One override per tenant per item (tenant-first: also the tenant list index).
);

COMMENT ON TABLE org_auth_admin_config_cf IS
  'Per-tenant overrides of sys_auth_admin_config_cf items. Accepted only where is_allow_tenant_change = true and within the catalog bounds; reset = soft-deactivate.';
COMMENT ON COLUMN org_auth_admin_config_cf.id IS 'Override row identifier.';
COMMENT ON COLUMN org_auth_admin_config_cf.tenant_org_id IS 'Owning tenant (cascade-deleted with the tenant).';
COMMENT ON COLUMN org_auth_admin_config_cf.config_code IS 'Catalog item overridden (FK to sys_auth_admin_config_cf, RESTRICT).';
COMMENT ON COLUMN org_auth_admin_config_cf.config_value IS 'Tenant value as text; validated against the item type and bounds.';
COMMENT ON COLUMN org_auth_admin_config_cf.rec_notes IS 'Optional note explaining why the tenant overrides the platform value.';
COMMENT ON COLUMN org_auth_admin_config_cf.is_active IS 'false = override reset; the platform value applies again.';
COMMENT ON COLUMN org_auth_admin_config_cf.rec_status IS '1 = active, 0 = soft-deleted (reset).';
COMMENT ON COLUMN org_auth_admin_config_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN org_auth_admin_config_cf.created_by IS 'Creator identifier.';
COMMENT ON COLUMN org_auth_admin_config_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN org_auth_admin_config_cf.updated_at IS 'Last modification time.';
COMMENT ON COLUMN org_auth_admin_config_cf.updated_by IS 'Last modifier identifier.';
COMMENT ON COLUMN org_auth_admin_config_cf.updated_info IS 'Modification context.';
COMMENT ON CONSTRAINT uq_org_auth_cfg_tenant_code ON org_auth_admin_config_cf IS
  'One override per tenant per catalog item; also serves tenant-scoped lookups (tenant_org_id first).';

-- Item-side lookups (e.g. HQ "which tenants override this item", FK maintenance on the catalog).
CREATE INDEX idx_org_auth_cfg_code ON org_auth_admin_config_cf (config_code);
COMMENT ON INDEX idx_org_auth_cfg_code IS 'Supports per-item lookups across tenants and the FK to the catalog.';

ALTER TABLE org_auth_admin_config_cf ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation for reads; all writes go through the server API (service role) which
-- filters on tenant_org_id explicitly.
CREATE POLICY tenant_isolation_org_auth_cfg ON org_auth_admin_config_cf
  FOR SELECT TO authenticated
  USING (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_isolation_org_auth_cfg ON org_auth_admin_config_cf IS
  'Users read only their own tenant overrides; no write policy (writes via service role).';

REVOKE ALL ON TABLE org_auth_admin_config_cf FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE org_auth_admin_config_cf FROM authenticated;
GRANT SELECT ON TABLE org_auth_admin_config_cf TO authenticated;
GRANT ALL ON TABLE org_auth_admin_config_cf TO service_role;

-- ------------------------------------------------------------
-- Guards
-- ------------------------------------------------------------
-- Catalog guard: stamps updated_at on change. Value validity is already enforced by the
-- chk_auth_cfg_* CHECK constraints.
CREATE OR REPLACE FUNCTION fn_auth_cfg_sys_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION fn_auth_cfg_sys_guard() IS 'BEFORE UPDATE on sys_auth_admin_config_cf: stamps updated_at.';
REVOKE EXECUTE ON FUNCTION fn_auth_cfg_sys_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_auth_cfg_sys_guard
  BEFORE UPDATE ON sys_auth_admin_config_cf
  FOR EACH ROW EXECUTE FUNCTION fn_auth_cfg_sys_guard();
COMMENT ON TRIGGER trg_auth_cfg_sys_guard ON sys_auth_admin_config_cf IS 'Stamps updated_at on catalog changes.';

-- Override guard: the DB-level gate that makes "tenant may only override what HQ allows" true for
-- every write path (API, SQL, HQ). Deactivating an override (reset) is always allowed; creating or
-- changing an ACTIVE override requires an active catalog item with is_allow_tenant_change = true and
-- a value valid for the item's type/bounds.
CREATE OR REPLACE FUNCTION fn_auth_cfg_org_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item sys_auth_admin_config_cf%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_item FROM sys_auth_admin_config_cf WHERE config_code = NEW.config_code;

  IF NOT FOUND OR v_item.is_active = false OR v_item.rec_status <> 1 THEN
    RAISE EXCEPTION 'auth config item % is not available', NEW.config_code USING ERRCODE = '23514';
  END IF;

  IF v_item.is_allow_tenant_change = false THEN
    RAISE EXCEPTION 'auth config item % is managed by the platform and cannot be overridden', NEW.config_code
      USING ERRCODE = '42501';
  END IF;

  IF NOT fn_auth_cfg_value_ok(v_item.value_type, NEW.config_value, v_item.min_value, v_item.max_value, v_item.allowed_values) THEN
    RAISE EXCEPTION 'value % is not valid for auth config item %', NEW.config_value, NEW.config_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION fn_auth_cfg_org_guard() IS
  'BEFORE INSERT/UPDATE on org_auth_admin_config_cf: active overrides require an active catalog item with is_allow_tenant_change and a value valid for its bounds; stamps updated_at.';
REVOKE EXECUTE ON FUNCTION fn_auth_cfg_org_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_auth_cfg_org_guard
  BEFORE INSERT OR UPDATE ON org_auth_admin_config_cf
  FOR EACH ROW EXECUTE FUNCTION fn_auth_cfg_org_guard();
COMMENT ON TRIGGER trg_auth_cfg_org_guard ON org_auth_admin_config_cf IS
  'Enforces is_allow_tenant_change and the catalog bounds on tenant overrides.';

-- ------------------------------------------------------------
-- Seed: catalog items
-- ------------------------------------------------------------
-- Seeded BEFORE the audit trigger exists so the initial seed does not flood the audit trail.
INSERT INTO sys_auth_admin_config_cf
  (config_code, name, name2, description, description2, config_group, value_type, unit,
   config_value, min_value, max_value, allowed_values, is_allow_tenant_change, display_order, created_by, created_info)
VALUES
  ('AUTH_IDLE_TIMEOUT_MIN', 'Idle timeout', 'مهلة عدم النشاط',
   'Minutes without activity after which a session is signed out automatically. 0 turns the idle timeout off.',
   'عدد الدقائق دون نشاط التي تنتهي بعدها الجلسة تلقائياً. القيمة 0 تعطّل المهلة.',
   'SESSION', 'INTEGER', 'MINUTES', '30', 0, 480, NULL, true, 10, 'migration', '0570'),
  ('AUTH_IDLE_WARNING_SEC', 'Idle warning period', 'مدة تنبيه انتهاء الجلسة',
   'Seconds before the idle timeout when the user is warned and can choose to stay signed in.',
   'عدد الثواني قبل انتهاء المهلة التي يُنبَّه فيها المستخدم ويمكنه البقاء متصلاً.',
   'SESSION', 'INTEGER', 'SECONDS', '60', 15, 300, NULL, true, 20, 'migration', '0570'),
  ('AUTH_SESSION_MAX_HOURS', 'Maximum session length', 'الحد الأقصى لمدة الجلسة',
   'Hours after sign-in when a session ends regardless of activity.',
   'عدد الساعات بعد تسجيل الدخول التي تنتهي بعدها الجلسة بغض النظر عن النشاط.',
   'SESSION', 'INTEGER', 'HOURS', '12', 1, 72, NULL, true, 30, 'migration', '0570'),
  ('AUTH_REMEMBER_ME_DAYS', 'Remember-me duration', 'مدة «تذكرني»',
   'Days a "Remember me" sign-in stays valid. 0 disables the Remember me option.',
   'عدد الأيام التي يبقى فيها تسجيل الدخول بخيار «تذكرني» صالحاً. القيمة 0 تعطّل الخيار.',
   'SESSION', 'INTEGER', 'DAYS', '7', 0, 30, NULL, true, 40, 'migration', '0570'),
  ('AUTH_MAX_SESSIONS_PER_USER', 'Concurrent sessions per user', 'الجلسات المتزامنة لكل مستخدم',
   'Maximum simultaneous sessions for one user. 0 means unlimited.',
   'الحد الأقصى للجلسات المتزامنة للمستخدم الواحد. القيمة 0 تعني بلا حد.',
   'SESSION', 'INTEGER', 'COUNT', '0', 0, 20, NULL, true, 50, 'migration', '0570'),
  ('AUTH_SESSION_LIMIT_POLICY', 'When the session limit is reached', 'عند بلوغ حد الجلسات',
   'REVOKE_OLDEST signs out the least recently active session; BLOCK_NEW refuses the new sign-in.',
   'REVOKE_OLDEST ينهي أقدم جلسة نشاطاً؛ BLOCK_NEW يمنع تسجيل الدخول الجديد.',
   'SESSION', 'ENUM', 'NONE', 'REVOKE_OLDEST', NULL, NULL, ARRAY['REVOKE_OLDEST', 'BLOCK_NEW'], true, 60, 'migration', '0570'),
  ('AUTH_NEW_DEVICE_ALERT', 'New device sign-in alert', 'تنبيه الدخول من جهاز جديد',
   'Notify the user when their account signs in from a device or browser not seen before.',
   'إشعار المستخدم عند تسجيل الدخول إلى حسابه من جهاز أو متصفح جديد.',
   'DEVICE', 'BOOLEAN', 'NONE', 'true', NULL, NULL, NULL, true, 70, 'migration', '0570'),
  ('AUTH_LOCKOUT_MAX_ATTEMPTS', 'Failed sign-ins before lockout', 'محاولات الدخول الفاشلة قبل القفل',
   'Failed sign-in attempts within the counting window that lock the account. Platform-wide (sign-in happens before a tenant is known).',
   'عدد محاولات الدخول الفاشلة ضمن نافذة الاحتساب التي تقفل الحساب. على مستوى المنصة (يحدث الدخول قبل معرفة المنشأة).',
   'LOCKOUT', 'INTEGER', 'COUNT', '5', 3, 20, NULL, false, 80, 'migration', '0570'),
  ('AUTH_LOCKOUT_MINUTES', 'Account lock duration', 'مدة قفل الحساب',
   'Minutes an account stays locked after too many failed sign-ins.',
   'عدد الدقائق التي يبقى فيها الحساب مقفلاً بعد كثرة المحاولات الفاشلة.',
   'LOCKOUT', 'INTEGER', 'MINUTES', '15', 1, 1440, NULL, false, 90, 'migration', '0570'),
  ('AUTH_LOCKOUT_WINDOW_MIN', 'Failed-attempt counting window', 'نافذة احتساب المحاولات الفاشلة',
   'Minutes after the last failure at which the failed-attempt counter starts over.',
   'عدد الدقائق بعد آخر محاولة فاشلة التي يبدأ بعدها عدّاد المحاولات من جديد.',
   'LOCKOUT', 'INTEGER', 'MINUTES', '60', 5, 1440, NULL, false, 100, 'migration', '0570');

-- ------------------------------------------------------------
-- Audit of configuration changes (after the seed)
-- ------------------------------------------------------------
-- Logs CONFIG_CHANGED for every insert/update on either table, whatever the write path. One trigger
-- function per table because the two tables have different columns (a single shared function cannot
-- reference both shapes). Tenant overrides carry their tenant; catalog (platform) changes have
-- tenant_org_id NULL. No-op updates (nothing audit-relevant changed) are not events.
CREATE OR REPLACE FUNCTION fn_auth_cfg_sys_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.config_value IS NOT DISTINCT FROM NEW.config_value
     AND OLD.is_allow_tenant_change IS NOT DISTINCT FROM NEW.is_allow_tenant_change
     AND OLD.min_value IS NOT DISTINCT FROM NEW.min_value
     AND OLD.max_value IS NOT DISTINCT FROM NEW.max_value
     AND OLD.allowed_values IS NOT DISTINCT FROM NEW.allowed_values
     AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
    RETURN NEW;
  END IF;

  PERFORM fn_auth_log_event(
    'CONFIG_CHANGED', 'SUCCESS', auth.uid(), NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'config_code', NEW.config_code,
      'scope', 'PLATFORM',
      'action', CASE WHEN TG_OP = 'INSERT' THEN 'SET' ELSE 'CHANGE' END,
      'old_value', CASE WHEN TG_OP = 'UPDATE' THEN OLD.config_value END,
      'new_value', NEW.config_value,
      'is_allow_tenant_change', NEW.is_allow_tenant_change,
      'actor_auth_user_id', auth.uid()
    )
  );
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION fn_auth_cfg_sys_audit() IS
  'AFTER INSERT/UPDATE on sys_auth_admin_config_cf: logs CONFIG_CHANGED (scope PLATFORM, tenant NULL) to sys_auth_audit_log.';
REVOKE EXECUTE ON FUNCTION fn_auth_cfg_sys_audit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fn_auth_cfg_org_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_action TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.config_value IS NOT DISTINCT FROM NEW.config_value
       AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
      RETURN NEW;
    END IF;
    v_action := CASE
      WHEN OLD.is_active AND NOT NEW.is_active THEN 'RESET'
      WHEN NOT OLD.is_active AND NEW.is_active THEN 'SET'
      ELSE 'CHANGE' END;
  ELSE
    v_action := CASE WHEN NEW.is_active THEN 'SET' ELSE 'RESET' END;
  END IF;

  PERFORM fn_auth_log_event(
    'CONFIG_CHANGED', 'SUCCESS', auth.uid(), NEW.tenant_org_id, NULL, NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'config_code', NEW.config_code,
      'scope', 'TENANT',
      'action', v_action,
      'old_value', CASE WHEN TG_OP = 'UPDATE' THEN OLD.config_value END,
      'new_value', NEW.config_value,
      'actor_auth_user_id', auth.uid()
    )
  );
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION fn_auth_cfg_org_audit() IS
  'AFTER INSERT/UPDATE on org_auth_admin_config_cf: logs CONFIG_CHANGED (scope TENANT, action SET/CHANGE/RESET) with the tenant to sys_auth_audit_log.';
REVOKE EXECUTE ON FUNCTION fn_auth_cfg_org_audit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_auth_cfg_sys_audit
  AFTER INSERT OR UPDATE ON sys_auth_admin_config_cf
  FOR EACH ROW EXECUTE FUNCTION fn_auth_cfg_sys_audit();
COMMENT ON TRIGGER trg_auth_cfg_sys_audit ON sys_auth_admin_config_cf IS 'Audits platform-level config changes (CONFIG_CHANGED, tenant NULL).';

CREATE TRIGGER trg_auth_cfg_org_audit
  AFTER INSERT OR UPDATE ON org_auth_admin_config_cf
  FOR EACH ROW EXECUTE FUNCTION fn_auth_cfg_org_audit();
COMMENT ON TRIGGER trg_auth_cfg_org_audit ON org_auth_admin_config_cf IS 'Audits tenant override changes (CONFIG_CHANGED with tenant).';
-- ------------------------------------------------------------
-- Effective-config resolver
-- ------------------------------------------------------------
-- Effective value per item for one tenant:
--   TENANT            active override that is still allowed and still valid for the current bounds
--   PLATFORM_ENFORCED an override exists but HQ has since disallowed it or tightened the bounds, so the
--                     platform value applies (the UI flags it so the admin can reset/fix it)
--   PLATFORM          no (active) override
-- Explicit tenant predicate on the org_* table (never relies on RLS). Service role / definer callers only,
-- so a signed-in user cannot ask about another tenant.
CREATE OR REPLACE FUNCTION fn_auth_config_effective(p_tenant_org_id UUID)
RETURNS TABLE (
  config_code            TEXT,
  config_group           TEXT,
  value_type             TEXT,
  unit                   TEXT,
  name                   TEXT,
  name2                  TEXT,
  description            TEXT,
  description2           TEXT,
  display_order          INTEGER,
  platform_value         TEXT,
  tenant_value           TEXT,
  effective_value        TEXT,
  source                 TEXT,
  is_allow_tenant_change BOOLEAN,
  min_value              INTEGER,
  max_value              INTEGER,
  allowed_values         TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.config_code,
    s.config_group,
    s.value_type,
    s.unit,
    s.name,
    s.name2,
    s.description,
    s.description2,
    s.display_order,
    s.config_value AS platform_value,
    o.config_value AS tenant_value,
    CASE
      WHEN o.id IS NOT NULL AND s.is_allow_tenant_change
           AND fn_auth_cfg_value_ok(s.value_type, o.config_value, s.min_value, s.max_value, s.allowed_values)
        THEN o.config_value
      ELSE s.config_value
    END AS effective_value,
    CASE
      WHEN o.id IS NULL THEN 'PLATFORM'
      WHEN s.is_allow_tenant_change
           AND fn_auth_cfg_value_ok(s.value_type, o.config_value, s.min_value, s.max_value, s.allowed_values)
        THEN 'TENANT'
      ELSE 'PLATFORM_ENFORCED'
    END AS source,
    s.is_allow_tenant_change,
    s.min_value,
    s.max_value,
    s.allowed_values
  FROM sys_auth_admin_config_cf s
  LEFT JOIN org_auth_admin_config_cf o
    ON o.config_code = s.config_code
   AND o.tenant_org_id = p_tenant_org_id
   AND o.is_active = true
   AND o.rec_status = 1
  WHERE s.is_active = true
    AND s.rec_status = 1
  ORDER BY s.config_group, s.display_order, s.config_code;
$$;

COMMENT ON FUNCTION fn_auth_config_effective(UUID) IS
  'Effective auth config per catalog item for one tenant: TENANT override (if allowed and valid), PLATFORM_ENFORCED (override ignored after HQ change) or PLATFORM. Service role / definer callers only.';

REVOKE EXECUTE ON FUNCTION fn_auth_config_effective(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_config_effective(UUID) TO service_role;

-- Platform-only integer lookup used by pre-tenant code paths (sign-in lockout). Falls back to the
-- given default if the item is missing/retired so a catalog mishap can never disable lockout.
CREATE OR REPLACE FUNCTION fn_auth_cfg_platform_int(p_config_code TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s.config_value::INTEGER
     FROM sys_auth_admin_config_cf s
     WHERE s.config_code = p_config_code
       AND s.value_type = 'INTEGER'
       AND s.is_active = true
       AND s.rec_status = 1),
    p_default
  );
$$;
COMMENT ON FUNCTION fn_auth_cfg_platform_int(TEXT, INTEGER) IS
  'Platform value of an INTEGER catalog item, or the supplied default when the item is missing/retired. Used by pre-tenant paths (lockout).';
REVOKE EXECUTE ON FUNCTION fn_auth_cfg_platform_int(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_cfg_platform_int(TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- record_login_attempt: lockout thresholds now come from the catalog
-- ------------------------------------------------------------
-- Same signature, return shape and behaviour as 0561 except the three formerly hardcoded constants
-- (5 attempts / 15 minutes / 60-minute counting window) are read from AUTH_LOCKOUT_* catalog items,
-- with the old values as safe defaults.
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email         VARCHAR,
  p_success       BOOLEAN,
  p_ip_address    INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(log_id UUID, is_locked BOOLEAN, locked_until TIMESTAMP, lock_reason VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id         UUID;
  v_tenant_id       UUID;
  v_log_id          UUID;
  v_failed_attempts INTEGER;
  v_lock_until      TIMESTAMP;
  v_lock_reason     VARCHAR;
  v_is_locked       BOOLEAN := false;

  v_max_failed_attempts INTEGER  := fn_auth_cfg_platform_int('AUTH_LOCKOUT_MAX_ATTEMPTS', 5);
  v_lockout_duration    INTERVAL := make_interval(mins => fn_auth_cfg_platform_int('AUTH_LOCKOUT_MINUTES', 15));
  v_reset_window        INTERVAL := make_interval(mins => fn_auth_cfg_platform_int('AUTH_LOCKOUT_WINDOW_MIN', 60));
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF p_success AND v_user_id IS NOT NULL THEN
    SELECT ou.tenant_org_id INTO v_tenant_id
    FROM org_users_mst ou
    WHERE ou.user_id = v_user_id AND ou.is_active = true
    ORDER BY ou.last_login_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_log_id := fn_auth_log_event(
    CASE WHEN p_success THEN 'LOGIN_SUCCESS' ELSE 'LOGIN_FAILURE' END,
    CASE WHEN p_success THEN 'SUCCESS' ELSE 'FAILURE' END,
    v_user_id, v_tenant_id, NULL, p_email::TEXT, p_ip_address, p_user_agent, NULL,
    CASE WHEN p_success THEN NULL ELSE left(p_error_message, 200) END,
    '{}'::jsonb
  );

  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE org_users_mst
      SET failed_login_attempts = 0,
          last_failed_login_at  = NULL,
          locked_until          = NULL,
          lock_reason           = NULL,
          last_login_at         = NOW(),
          login_count           = COALESCE(login_count, 0) + 1,
          updated_at            = NOW()
      WHERE user_id = v_user_id;
    ELSE
      UPDATE org_users_mst
      SET failed_login_attempts = CASE
            WHEN last_failed_login_at IS NULL OR last_failed_login_at < NOW() - v_reset_window THEN 1
            ELSE failed_login_attempts + 1
          END,
          last_failed_login_at = NOW(),
          updated_at           = NOW()
      WHERE user_id = v_user_id
      RETURNING failed_login_attempts INTO v_failed_attempts;

      IF v_failed_attempts >= v_max_failed_attempts THEN
        v_lock_until  := NOW() + v_lockout_duration;
        v_lock_reason := format('Account locked due to %s failed login attempts', v_max_failed_attempts);
        v_is_locked   := true;

        UPDATE org_users_mst
        SET locked_until = v_lock_until,
            lock_reason  = v_lock_reason,
            updated_at   = NOW()
        WHERE user_id = v_user_id;

        PERFORM fn_auth_log_event(
          'ACCOUNT_LOCKED', 'SUCCESS', v_user_id, NULL, NULL, p_email::TEXT, p_ip_address, p_user_agent, NULL,
          'TOO_MANY_FAILED_ATTEMPTS',
          jsonb_build_object('locked_until', v_lock_until, 'failed_attempts', v_failed_attempts)
        );
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_log_id, v_is_locked, v_lock_until, v_lock_reason;
END;
$$;

COMMENT ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) IS
  'Records a sign-in attempt in sys_auth_audit_log and applies the failed-attempt lockout using the AUTH_LOCKOUT_* catalog items. Service role only.';

-- ROLLBACK PLAN:
--   restore record_login_attempt() from 0561; DROP TRIGGER trg_auth_cfg_org_audit / trg_auth_cfg_sys_audit /
--   trg_auth_cfg_org_guard / trg_auth_cfg_sys_guard; DROP FUNCTION fn_auth_config_effective(UUID),
--   fn_auth_cfg_platform_int(TEXT,INTEGER), fn_auth_cfg_sys_audit(), fn_auth_cfg_org_audit(), fn_auth_cfg_org_guard(), fn_auth_cfg_sys_guard(),
--   fn_auth_cfg_value_ok(...); DROP TABLE org_auth_admin_config_cf; DROP TABLE sys_auth_admin_config_cf;
