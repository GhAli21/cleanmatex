-- Migration: 0311_add_missing_voucher_line_columns.sql
-- Purpose: Add columns to org_fin_voucher_trx_lines_dtl that exist in the
--          Prisma schema and BVM service but were omitted from migration 0301.
--          Fixes: "column does not exist" errors on findMany / create.

ALTER TABLE org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS target_id              UUID,
  ADD COLUMN IF NOT EXISTS card_brand_code        TEXT,
  ADD COLUMN IF NOT EXISTS auth_code              TEXT,
  ADD COLUMN IF NOT EXISTS gateway_code           TEXT,
  ADD COLUMN IF NOT EXISTS gateway_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_reference      TEXT,
  ADD COLUMN IF NOT EXISTS party_name             TEXT;
