-- Migration: 0751_file_util_drop_photo_url_columns.sql
-- Feature: File Util, Phase 6 (docs/features/File_Util/PLAN.md, task 6.5).
--
-- Why: these columns stored photo links as free-text URLs (any outside address
-- was accepted). Photos of issues, assembly exceptions and QA now live in File Util:
-- one org_file_mst row per file, category ORDER_FILE, linked to the sub-record by
-- ref_type_code + ref_id (ORDER_ISSUE, ASM_EXCEPTION, QA_DECISION / ASM_TASK).
-- Order-level photos are ORDER_FILE rows of the order itself.
--
-- Safe to drop (checked on remote 2026-11-17):
--   * every column is empty (0 non-empty rows in each);
--   * no view, function, index or constraint references them;
--   * no code reads or writes them any more (web-admin, cmx-api, mobile, HQ;
--     only generated type files mention them and refresh with type generation).
-- Delivery proof columns on org_dlv_pod_tr are NOT touched here (task 6.4).
-- RESTRICT: fail instead of silently dropping anything that depends on a column.

BEGIN;

-- Issue photo link (issue photos → org_file_mst, ref ORDER_ISSUE).
ALTER TABLE public.org_order_issues DROP COLUMN IF EXISTS photo_url RESTRICT;

-- Assembly exception photo links (→ org_file_mst, ref ASM_EXCEPTION).
ALTER TABLE public.org_asm_exceptions_tr DROP COLUMN IF EXISTS photo_urls RESTRICT;

-- QA photo link on the assembly task (→ org_file_mst, ref ASM_TASK).
ALTER TABLE public.org_asm_tasks_mst DROP COLUMN IF EXISTS qa_photo_url RESTRICT;

-- QA photo link on the QA decision (→ org_file_mst, ref QA_DECISION).
ALTER TABLE public.org_qa_decisions_tr DROP COLUMN IF EXISTS qa_photo_url RESTRICT;

-- Order photo links (→ org_file_mst rows of the order, e.g. BEFORE_IMAGE).
ALTER TABLE public.org_orders_mst DROP COLUMN IF EXISTS photo_urls RESTRICT;

COMMIT;
