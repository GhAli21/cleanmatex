-- ============================================================================
-- Migration: 0608_ntf_customer_preferred_language.sql
-- Purpose: Add an explicit, nullable recipient-language signal on tenant
--          customers so the Notification Hub's route/binding-aware WhatsApp
--          dispatch (production implementation plan sections 4.2, 17.2, 22,
--          23.1, 26.2.1) can resolve ResolveEffectiveNotificationRoute's
--          required `languageCode` argument without inventing, inferring or
--          defaulting a language anywhere in the resolution chain itself.
--
-- Context: confirmed before writing this migration (schema read) that no
-- language/locale field exists anywhere today on org_customers_mst or
-- org_orders_mst. The nearest existing pattern is sys_country_cd's
-- `default_language_code VARCHAR(2)` column (migration 0055), which this
-- migration mirrors exactly for type/width. The non-blank CHECK constraint
-- style mirrors this notification module's own established convention for a
-- language_code column (ck_ntf_route_lang / ck_ntf_tloc_lang in migrations
-- 0579 / 0572) rather than inventing a new validation shape.
--
-- This column is intentionally looser than an enum: this platform is EN/AR
-- only today, but the column stores any sys_language_cd.code so a future
-- language can be enabled without a further migration. An actual FK to
-- sys_language_cd(code) is added (stronger than 0055's column, which only
-- documented the relationship in a comment) because this is a new write
-- path that tenant-facing UI will populate, and referential integrity is
-- the correct default here per CLAUDE.md's correctness-first guardrails.
--
-- Fallback chain (implemented in web-admin/lib/notifications, not in SQL):
--   1. org_customers_mst.preferred_language, when set
--   2. org_tenants_mst.language (tenant's own default-language setting,
--      already exists, default 'en')
--   3. 'en' hard fallback
--
-- No RLS policy change: org_customers_mst RLS already covers every column
-- on the table; adding a nullable column requires no new policy.
-- ============================================================================
BEGIN;

ALTER TABLE org_customers_mst
  ADD COLUMN preferred_language VARCHAR(2);

ALTER TABLE org_customers_mst
  ADD CONSTRAINT ck_cust_pref_lang
  CHECK (preferred_language IS NULL OR btrim(preferred_language) <> '');

ALTER TABLE org_customers_mst
  ADD CONSTRAINT fk_cust_pref_lang
  FOREIGN KEY (preferred_language) REFERENCES sys_language_cd(code)
  ON DELETE RESTRICT;

COMMENT ON COLUMN org_customers_mst.preferred_language IS
  'Optional explicit recipient-language override for this customer (ISO 639-1, references sys_language_cd). '
  'Consumed by the Notification Hub route/binding-aware WhatsApp dispatch to resolve '
  'ResolveEffectiveNotificationRoute''s required languageCode argument. NULL means the customer has not '
  'set an explicit preference; callers fall back to org_tenants_mst.language, then to ''en''. '
  'Never inferred, guessed, or auto-populated by any backend process -- set only by explicit customer-facing '
  'UI input or the customer''s own profile action.';

COMMENT ON CONSTRAINT ck_cust_pref_lang ON org_customers_mst IS
  'Mirrors this notification module''s established language_code convention (migrations 0572/0579): '
  'a non-NULL value must not be blank/whitespace-only. Does not restrict to a fixed language set so a '
  'future language can be enabled without a further migration.';

COMMENT ON CONSTRAINT fk_cust_pref_lang ON org_customers_mst IS
  'Enforces that a set preferred_language is always a real, catalog-known sys_language_cd.code. '
  'ON DELETE RESTRICT: a language code in active use by a customer preference can never be removed '
  'out from under it.';

COMMIT;
