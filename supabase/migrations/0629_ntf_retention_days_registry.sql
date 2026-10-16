-- Notification Hub: make the retention window an operator setting (registry key) instead of a number in a cron command.
--
-- Until now the daily job ntf-retention-sweep ran `fn_ntf_retention_sweep(180)`: changing the window meant a new
-- migration. The owner asked for it to be changeable from the HQ UI (Operations -> Configuration Registry).
--
-- Design:
--   * registry key ntf.retention.days (NUMBER, DB_ONLY, edited in the UI, default 180, allowed 30-3650);
--   * fn_ntf_retention_run() reads the key INSIDE the database (a cron job cannot read host environments),
--     refuses anything outside 30-3650 by falling back to the 180-day default (a typo can never delete more
--     history than the safe default), and calls the existing fn_ntf_retention_sweep(days);
--   * the cron job ntf-retention-sweep (same name, same schedule 04:00 daily) now calls fn_ntf_retention_run().
-- fn_ntf_retention_sweep itself is NOT changed (what is purged stays exactly as in 0609/0623).
--
-- Affected: sys_ops_config_cf (one row), sys_ops_config_chg_log (one row), new function fn_ntf_retention_run,
--           cron job ntf-retention-sweep (re-scheduled).
-- Related:  0609_ntf_retention_sweep.sql, 0623_ntf_quota_reservation_ledger.sql, 0615_ops_config_registry_v2.sql
BEGIN;

-- The value is not a secret, so it is seeded with the current policy (180 days); the UI changes it afterwards.
-- db_value_fingerprint is the plain SHA-256 of the value, like every other stored non-secret value.
INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2, value_type, is_secret, is_encrypted, source_policy,
  env_var_name, db_value, db_value_fingerprint, value_updated_at, value_updated_by, validation_rule,
  is_bootstrap, is_wired, requires_restart, manage_via, guidance, guidance2, applies_to_app, env_var_scope_val,
  created_info, is_active, rec_status
) VALUES (
  'ntf.retention.days', 'ntf', 'Notification retention (days)', 'مدة الاحتفاظ بالإشعارات (أيام)',
  'Terminal notification rows (outbox, delivery log, receipts, in-app inbox, HQ dispatch log, usage-apply ledger) older than this many days are deleted by the daily job ntf-retention-sweep. Allowed 30-3650, default 180. Pending, queued and unread rows are never deleted.',
  'تُحذف صفوف الإشعارات المنتهية (الصندوق، سجل التسليم، الإيصالات، صندوق التطبيق، سجل HQ، دفتر الاستخدام) الأقدم من هذا العدد من الأيام بواسطة المهمة اليومية ntf-retention-sweep. المسموح 30-3650 والافتراضي 180. لا تُحذف أبدًا الصفوف المعلّقة أو المصطفّة أو غير المقروءة.',
  'NUMBER', false, false, 'DB_ONLY',
  NULL, '180', encode(sha256(convert_to('180', 'UTF8')), 'hex'), now(), 'migration:0629',
  '^([3-9][0-9]|[1-9][0-9]{2}|[12][0-9]{3}|3[0-5][0-9]{2}|36[0-4][0-9]|3650)$',
  false, true, false, 'UI',
  'Whole days between 30 and 3650. Applies at the next daily run (04:00). A value outside the range is ignored and 180 is used. Lowering it makes the next run delete more history: check your legal retention obligations first.',
  'أيام صحيحة بين 30 و3650. يسري عند التشغيل اليومي التالي (04:00). تُتجاهل القيمة خارج النطاق ويُستخدم 180. خفضها يجعل التشغيل التالي يحذف تاريخًا أكثر: راجع التزامات الاحتفاظ القانونية أولًا.',
  '[{"app":"DATABASE","is_still_used":true}]'::jsonb, '[]'::jsonb, '0629_ntf_retention_days_registry', true, 1
)
ON CONFLICT (config_key) DO NOTHING;

-- History row for the seeded value, like the other seeded values (never contains the value itself).
INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
SELECT c.config_key, 'SET', 'migration:0629', NULL, c.db_value_fingerprint, '0629 seed of the retention window'
  FROM public.sys_ops_config_cf c
 WHERE c.config_key = 'ntf.retention.days'
   AND NOT EXISTS (SELECT 1 FROM public.sys_ops_config_chg_log l WHERE l.config_key = c.config_key);

-- Entry point of the daily job. Reads the registry value and runs the sweep with it.
CREATE OR REPLACE FUNCTION public.fn_ntf_retention_run()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_default CONSTANT INTEGER := 180;   -- used when the key is missing, empty or invalid
  c_min     CONSTANT INTEGER := 30;    -- shortest window an operator may set
  c_max     CONSTANT INTEGER := 3650;  -- longest window an operator may set (10 years)
  v_raw  TEXT;
  v_days INTEGER := c_default;
BEGIN
  SELECT btrim(db_value) INTO v_raw
    FROM public.sys_ops_config_cf
   WHERE config_key = 'ntf.retention.days' AND is_active AND rec_status = 1;

  -- Only plain whole numbers inside the allowed range are used; anything else keeps the default.
  IF v_raw ~ '^[0-9]{1,4}$' AND v_raw::INTEGER BETWEEN c_min AND c_max THEN
    v_days := v_raw::INTEGER;
  END IF;

  RETURN public.fn_ntf_retention_sweep(v_days);
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_retention_run() IS
  'Daily retention entry point: reads registry key ntf.retention.days (30-3650, default 180 when missing or invalid) and runs fn_ntf_retention_sweep with it. Returns the number of rows deleted.';
-- Executed only by pg_cron (postgres) and the service role; never by tenants or anonymous callers.
REVOKE EXECUTE ON FUNCTION public.fn_ntf_retention_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_retention_run() TO service_role;

-- Re-schedule the existing job (same name and schedule) so it calls the registry-driven entry point.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-retention-sweep';
SELECT cron.schedule('ntf-retention-sweep', '0 4 * * *', $$ SELECT public.fn_ntf_retention_run() $$);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ntf-retention-sweep') THEN
    RAISE EXCEPTION '0629: ntf-retention-sweep cron job was not registered';
  END IF;
END $$;

COMMIT;
