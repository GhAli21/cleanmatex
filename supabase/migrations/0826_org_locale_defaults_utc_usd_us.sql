-- ============================================================
-- Migration: 0826_org_locale_defaults_utc_usd_us.sql
-- Purpose:   New organizations, new customer addresses, and new
--            subscription plans start as United States / USD / UTC
--            instead of Oman / OMR / Asia/Muscat. Existing rows are
--            not rewritten. UTC here is a stored initial zone, not a
--            fallback used when a zone is missing.
-- Affected:  org_tenants_mst, org_customer_addresses,
--            sys_pln_subscription_plans_mst, sys_timezone_cd
-- Related:   0675 (IANA timezone catalog)
-- ============================================================

BEGIN;

-- New organization identity. Language stays English. A missing zone in
-- application code still fails closed; these defaults apply only when
-- an insert omits the column.
ALTER TABLE public.org_tenants_mst
  ALTER COLUMN country SET DEFAULT 'US',
  ALTER COLUMN country_code SET DEFAULT 'US',
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN timezone SET DEFAULT 'UTC',
  ALTER COLUMN phone_country_code SET DEFAULT '+1';

COMMENT ON COLUMN public.org_tenants_mst.country IS
  'ISO 3166-1 alpha-2 country of the organization. New rows default to US. Existing rows are not rewritten.';
COMMENT ON COLUMN public.org_tenants_mst.country_code IS
  'ISO 3166-1 alpha-2 country code paired with phone_country_code. New rows default to US. Existing rows are not rewritten.';
COMMENT ON COLUMN public.org_tenants_mst.currency IS
  'ISO 4217 currency of the organization. New rows default to USD. Existing rows are not rewritten.';
COMMENT ON COLUMN public.org_tenants_mst.timezone IS
  'IANA zone of the organization. New rows default to UTC. This stored value is a chosen zone. Application code must not substitute UTC when the column is null. Existing rows are not rewritten.';
COMMENT ON COLUMN public.org_tenants_mst.phone_country_code IS
  'Dial code for the organization phone, including the leading plus. New rows default to +1. Existing rows are not rewritten.';
COMMENT ON COLUMN public.org_tenants_mst.language IS
  'Default UI language of the organization. Remains en. This migration does not change that default.';

-- Monday–Friday 09:00–17:00. Saturday and Sunday are closed.
-- The check allows only the seven day keys. Existing stored weeks stay.
ALTER TABLE public.org_tenants_mst
  ALTER COLUMN business_hours SET DEFAULT '{
    "mon": {"open": "09:00", "close": "17:00"},
    "tue": {"open": "09:00", "close": "17:00"},
    "wed": {"open": "09:00", "close": "17:00"},
    "thu": {"open": "09:00", "close": "17:00"},
    "fri": {"open": "09:00", "close": "17:00"},
    "sat": null,
    "sun": null
  }'::jsonb;

COMMENT ON COLUMN public.org_tenants_mst.business_hours IS
  'Weekly opening hours for a new organization: Monday through Friday 09:00-17:00, Saturday and Sunday closed. Existing rows keep the week already stored.';

ALTER TABLE public.org_customer_addresses
  ALTER COLUMN country SET DEFAULT 'US';

COMMENT ON COLUMN public.org_customer_addresses.country IS
  'ISO 3166-1 alpha-2 country of the address. New rows default to US when the insert omits the column. Existing addresses are not rewritten.';

ALTER TABLE public.sys_pln_subscription_plans_mst
  ALTER COLUMN currency SET DEFAULT 'USD';

COMMENT ON COLUMN public.sys_pln_subscription_plans_mst.currency IS
  'ISO 4217 currency of a subscription plan. New plan rows default to USD. Existing plan prices and currencies are not rewritten.';

-- One catalog row is the marked default. UTC is that row.
-- Tenant zones are not derived from this flag.
UPDATE public.sys_timezone_cd
SET is_default = (code = 'UTC')
WHERE is_default IS DISTINCT FROM (code = 'UTC');

COMMENT ON COLUMN public.sys_timezone_cd.is_default IS
  'True only for UTC, the catalog row offered as the initial organization zone. Conversion never uses utc_offset_hours. Tenant rows are not updated by this flag.';

COMMIT;
