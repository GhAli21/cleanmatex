-- Migration 0545: drop the orphaned sys_stng_settings_cd / org_stng_settings_cf
-- table pair. Follow-up to the Currency Setup & FX program closure, per
-- owner go-ahead ("do what you recommend").
--
-- These are NOT the live HQ settings catalog/override tables (those are
-- sys_tenant_settings_cd / org_tenant_settings_cf — no "stng" infix — and
-- are untouched by this migration). sys_stng_settings_cd / org_stng_settings_cf
-- appear to be leftovers from an abandoned rename/redesign: they have real
-- DDL (columns, FKs, RLS) and even live-looking seed data (sys_stng_settings_cd
-- had an active TENANT_CURRENCY row), but confirmed by grepping both repos'
-- application source (not generated types, not docs/PRD seed files) that
-- zero services, controllers, or UI reference either table name. The live
-- resolver (platform-api stng-resolver.service.ts / stng-catalog.service.ts
-- / stng-tenant-overrides.service.ts) reads sys_tenant_settings_cd and
-- org_tenant_settings_cf exclusively.
--
-- Verified on the live remote DB before writing this migration (2026-10-02):
--   - org_stng_settings_cf: 0 rows.
--   - Only FK relationship: org_stng_settings_cf.setting_code ->
--     sys_stng_settings_cd.setting_code (dropped together, child first).
--   - sys_stng_profiles_mst / sys_stng_profile_values_dtl / sys_stng_categories_cd
--     / org_stng_effective_cache_cf / org_stng_audit_log_tr are LIVE (used by
--     the resolver) and are NOT touched by this migration.
--   - Only RI (foreign-key) constraint triggers exist on either table; no
--     custom business logic depends on them.
--
-- DROP ... RESTRICT (not CASCADE): child dropped before parent, so RESTRICT
-- succeeds without cascading. No recreate statements needed since nothing
-- references these tables.

BEGIN;

DROP TABLE IF EXISTS public.org_stng_settings_cf RESTRICT;
DROP TABLE IF EXISTS public.sys_stng_settings_cd RESTRICT;

COMMIT;
