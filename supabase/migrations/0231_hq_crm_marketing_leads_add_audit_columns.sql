-- Migration: 0231_hq_crm_marketing_leads_add_audit_columns.sql
-- Purpose: Add missing audit columns (updated_by, created_by) to hq_crm_marketing_leads
--          The table had updated_at but was missing updated_by and created_by columns
--          required by the platform-api update logic.

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(120),
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(120);
