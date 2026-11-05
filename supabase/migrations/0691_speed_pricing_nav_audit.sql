-- =============================================================================
-- 0691_speed_pricing_nav_audit.sql
-- Line-Level Money Snapshot, P7-01 (M9): Speed Pricing screen.
--
-- WHY:
--   (1) Navigation dual-write (CLAUDE.md rule 10): the other half is
--       web-admin/config/navigation.ts, entry `catalog_speed_pricing`.
--   (2) Every change to a speed rule is recorded in org_price_history_audit
--       (PLAN section 6.6). The Speed Pricing service is the first writer, so
--       the entity_type CHECK deferred by 0640 is widened here. The value is
--       lowercase, like the column's existing values (DB-mirror rule).
--   (3) old_price / new_price were NUMERIC(10,3): a 4-decimal rule value would
--       be rounded in the audit. Money columns are DECIMAL(19,4).
--   (4) This org_* table had RLS off, so its rows were not limited to a tenant
--       for a direct database client. It now follows the standard tenant policy.
--
-- NO new permission (P0-05): the screen uses the existing pricing:read / create /
-- update / delete / bulk codes, already seeded and granted to roles.
--
-- ICON: `Tags`, the same as the other Catalog entries; it is in the sidebar
-- icon registry.
--
-- ROLLBACK (forward-only): a later migration would delete the
-- `catalog_speed_pricing` row, move the shifted display orders back, drop
-- pol_org_price_hist_tenant and disable RLS. Narrowing the CHECK would first
-- need the speed_rule audit rows removed; the columns stay wide (narrowing could
-- lose precision).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- (2) Accept speed-rule audit rows. The replaced constraint had the same rule
-- without 'speed_rule'; it is dropped so the wider rule can take its place.
ALTER TABLE public.org_price_history_audit
  DROP CONSTRAINT IF EXISTS org_price_history_audit_entity_type_check RESTRICT;

ALTER TABLE public.org_price_history_audit
  ADD CONSTRAINT chk_pha_entity_type
  CHECK (entity_type IN ('price_list_item', 'product_default', 'speed_rule'));

COMMENT ON CONSTRAINT chk_pha_entity_type ON public.org_price_history_audit IS
  'The kind of record that changed. speed_rule added by 0691 for Speed Pricing (org_speed_price_rules_cf).';

COMMENT ON COLUMN public.org_price_history_audit.entity_type IS
  'Type of entity: price_list_item, product_default or speed_rule (entity_id is then org_speed_price_rules_cf.id).';

-- (3) Keep every rule value exact. Only widens, so no stored value changes.
ALTER TABLE public.org_price_history_audit
  ALTER COLUMN old_price TYPE DECIMAL(19, 4),
  ALTER COLUMN new_price TYPE DECIMAL(19, 4);

COMMENT ON COLUMN public.org_price_history_audit.old_price IS
  'Value before the change; NULL when the record was created. For speed_rule: the sell price, multiplier fraction or fixed amount, whichever the rule type uses (the type is in change_reason).';

COMMENT ON COLUMN public.org_price_history_audit.new_price IS
  'Value after the change; NULL when the record was deleted. For speed_rule: the sell price, multiplier fraction or fixed amount, whichever the rule type uses (the type is in change_reason).';

-- (4) Tenant isolation. The price-history triggers run as the calling user and
-- write that user's tenant, so WITH CHECK allows them; service_role bypasses RLS.
ALTER TABLE public.org_price_history_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_org_price_hist_tenant ON public.org_price_history_audit;
CREATE POLICY pol_org_price_hist_tenant ON public.org_price_history_audit
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY pol_org_price_hist_tenant ON public.org_price_history_audit IS
  'Each organization reads and writes only its own price history.';

-- (1) Place Speed Pricing right after Pricing: make room at display order 2.
UPDATE public.sys_components_cd
SET display_order = display_order + 1,
    updated_at    = NOW(),
    updated_info  = 'Migration 0691: room for Speed Pricing after Pricing'
WHERE parent_comp_code = 'catalog'
  AND comp_code <> 'catalog_speed_pricing'
  AND display_order >= 2;

-- New leaf under Catalog & Pricing. Same roles as its Pricing sibling in
-- navigation.ts; gated by the permission the list API enforces.
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_id,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  main_permission_code,
  display_order,
  comp_level,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  permissions,
  feature_flag,
  badge,
  rec_status,
  created_info
)
VALUES (
  'catalog_speed_pricing',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'catalog'),
  'catalog',
  'Speed Pricing',
  'تسعير السرعة',
  '/dashboard/catalog/speed-pricing',
  'Tags',
  'pricing:read',
  2,
  1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin","operator"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'Migration 0691: Speed Pricing rules screen (Line-Level P7-01). Gated by pricing:read.'
)
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  updated_at           = NOW(),
  updated_info         = EXCLUDED.created_info;

COMMIT;
