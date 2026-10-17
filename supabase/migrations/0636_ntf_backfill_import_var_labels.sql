-- 0636_ntf_backfill_import_var_labels.sql
-- Purpose: data-only backfill. Template variables auto-created by earlier Twilio imports were saved
--          without an Arabic label (display_name2) or a sample value (example_value). The importer now
--          fills both for known platform variables; this brings the already-imported rows in line.
-- Scope:   sys_ntf_tpl_var_dtl only (no DDL, no new objects). Touches rows where the value is still NULL,
--          so any operator edit made since the import is never overwritten. Safe to re-run.
-- Source:  curated labels mirror KNOWN_VARIABLES in platform-api template-locale.util.ts (HQ repo).

-- Arabic label: filled only where still empty, for the known event variables.
UPDATE sys_ntf_tpl_var_dtl
SET display_name2 = CASE variable_key
      WHEN 'order_number'       THEN 'رقم الطلب'
      WHEN 'estimated_ready_at' THEN 'موعد الجاهزية المتوقع'
      WHEN 'date'               THEN 'التاريخ'
    END,
    updated_at   = NOW(),
    updated_by   = 'migration_0636',
    updated_info = 'backfill auto-imported variable labels'
WHERE display_name2 IS NULL
  AND created_info = 'hq_twilio_import_auto_variable'  -- only rows the importer created, never operator-authored ones
  AND variable_key IN ('order_number', 'estimated_ready_at', 'date');

-- Sample value used by previews and test sends: filled only where still empty.
UPDATE sys_ntf_tpl_var_dtl
SET example_value = CASE variable_key
      WHEN 'order_number'       THEN 'ORD-1042'
      WHEN 'estimated_ready_at' THEN '25 October 2026'
      WHEN 'date'               THEN '25 October 2026'
    END,
    updated_at   = NOW(),
    updated_by   = 'migration_0636',
    updated_info = 'backfill auto-imported variable samples'
WHERE example_value IS NULL
  AND created_info = 'hq_twilio_import_auto_variable'
  AND variable_key IN ('order_number', 'estimated_ready_at', 'date');
