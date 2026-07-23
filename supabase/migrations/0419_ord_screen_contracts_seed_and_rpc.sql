-- ==================================================================
-- 0419_ord_screen_contracts_seed_and_rpc.sql
-- Purpose: Seed org_ord_screen_contracts_cf system defaults and make
--          cmx_ord_screen_pre_conditions read tenant override → system → fallback
-- ==================================================================

BEGIN;

-- One system row per screen_key (Postgres UNIQUE allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_ord_scr_contracts_sys_key
  ON org_ord_screen_contracts_cf (screen_key)
  WHERE tenant_org_id IS NULL;

-- Seed system defaults from prior hardcoded CASE logic (0130)
INSERT INTO org_ord_screen_contracts_cf (
  tenant_org_id,
  screen_key,
  pre_conditions,
  required_permissions,
  is_active
)
SELECT
  NULL,
  v.screen_key,
  v.pre_conditions,
  v.required_permissions,
  true
FROM (
  VALUES
    (
      'preparation',
      '{"statuses":["preparing","intake"],"additional_filters":{}}'::jsonb,
      '["orders:preparation:complete"]'::jsonb
    ),
    (
      'processing',
      '{"statuses":["processing"],"additional_filters":{}}'::jsonb,
      '["orders:processing:complete"]'::jsonb
    ),
    (
      'assembly',
      '{"statuses":["assembly"],"additional_filters":{}}'::jsonb,
      '["orders:assembly:complete"]'::jsonb
    ),
    (
      'qa',
      '{"statuses":["qa"],"additional_filters":{}}'::jsonb,
      '["orders:qa:approve","orders:qa:reject"]'::jsonb
    ),
    (
      'packing',
      '{"statuses":["packing"],"additional_filters":{}}'::jsonb,
      '["orders:packing:complete"]'::jsonb
    ),
    (
      'ready_release',
      '{"statuses":["ready"],"additional_filters":{}}'::jsonb,
      '["orders:ready:release"]'::jsonb
    ),
    (
      'driver_delivery',
      '{"statuses":["out_for_delivery"],"additional_filters":{}}'::jsonb,
      '["orders:delivery:complete"]'::jsonb
    ),
    (
      'new_order',
      '{"statuses":["draft"],"additional_filters":{}}'::jsonb,
      '["orders:create"]'::jsonb
    ),
    (
      'workboard',
      '{"statuses":["preparing","processing","assembly","qa","packing"],"additional_filters":{}}'::jsonb,
      '[]'::jsonb
    ),
    (
      'canceling',
      '{"statuses":["draft","intake","preparation","processing","sorting","washing","drying","finishing","assembly","qa","packing","ready","out_for_delivery"],"additional_filters":{}}'::jsonb,
      '["orders:cancel"]'::jsonb
    ),
    (
      'returning',
      '{"statuses":["delivered","closed"],"additional_filters":{}}'::jsonb,
      '["orders:return"]'::jsonb
    )
) AS v(screen_key, pre_conditions, required_permissions)
WHERE NOT EXISTS (
  SELECT 1
  FROM org_ord_screen_contracts_cf existing
  WHERE existing.tenant_org_id IS NULL
    AND existing.screen_key = v.screen_key
);

-- Prefer: tenant override → system default → hardcoded fallback
CREATE OR REPLACE FUNCTION cmx_ord_screen_pre_conditions(
  p_screen TEXT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_pre JSONB;
  v_perms JSONB;
BEGIN
  BEGIN
    v_tenant := current_tenant_id();
  EXCEPTION WHEN OTHERS THEN
    v_tenant := NULL;
  END;

  IF v_tenant IS NOT NULL THEN
    SELECT c.pre_conditions, c.required_permissions
      INTO v_pre, v_perms
    FROM org_ord_screen_contracts_cf c
    WHERE c.screen_key = p_screen
      AND c.tenant_org_id = v_tenant
      AND COALESCE(c.is_active, true) = true
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'statuses', COALESCE(v_pre->'statuses', '[]'::jsonb),
        'additional_filters', COALESCE(v_pre->'additional_filters', '{}'::jsonb),
        'required_permissions', COALESCE(v_perms, '[]'::jsonb)
      );
    END IF;
  END IF;

  SELECT c.pre_conditions, c.required_permissions
    INTO v_pre, v_perms
  FROM org_ord_screen_contracts_cf c
  WHERE c.screen_key = p_screen
    AND c.tenant_org_id IS NULL
    AND COALESCE(c.is_active, true) = true
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'statuses', COALESCE(v_pre->'statuses', '[]'::jsonb),
      'additional_filters', COALESCE(v_pre->'additional_filters', '{}'::jsonb),
      'required_permissions', COALESCE(v_perms, '[]'::jsonb)
    );
  END IF;

  -- Hardcoded fallback (preserves prior behavior when table empty)
  RETURN jsonb_build_object(
    'statuses', CASE p_screen
      WHEN 'preparation' THEN to_jsonb(ARRAY['preparing', 'intake']::TEXT[])
      WHEN 'processing' THEN to_jsonb(ARRAY['processing']::TEXT[])
      WHEN 'assembly' THEN to_jsonb(ARRAY['assembly']::TEXT[])
      WHEN 'qa' THEN to_jsonb(ARRAY['qa']::TEXT[])
      WHEN 'packing' THEN to_jsonb(ARRAY['packing']::TEXT[])
      WHEN 'ready_release' THEN to_jsonb(ARRAY['ready']::TEXT[])
      WHEN 'driver_delivery' THEN to_jsonb(ARRAY['out_for_delivery']::TEXT[])
      WHEN 'new_order' THEN to_jsonb(ARRAY['draft']::TEXT[])
      WHEN 'workboard' THEN to_jsonb(ARRAY['preparing', 'processing', 'assembly', 'qa', 'packing']::TEXT[])
      WHEN 'canceling' THEN to_jsonb(ARRAY['draft','intake','preparation','processing','sorting','washing','drying','finishing','assembly','qa','packing','ready','out_for_delivery']::TEXT[])
      WHEN 'returning' THEN to_jsonb(ARRAY['delivered','closed']::TEXT[])
      ELSE '[]'::jsonb
    END,
    'additional_filters', '{}'::jsonb,
    'required_permissions', CASE p_screen
      WHEN 'preparation' THEN to_jsonb(ARRAY['orders:preparation:complete']::TEXT[])
      WHEN 'processing' THEN to_jsonb(ARRAY['orders:processing:complete']::TEXT[])
      WHEN 'assembly' THEN to_jsonb(ARRAY['orders:assembly:complete']::TEXT[])
      WHEN 'qa' THEN to_jsonb(ARRAY['orders:qa:approve', 'orders:qa:reject']::TEXT[])
      WHEN 'packing' THEN to_jsonb(ARRAY['orders:packing:complete']::TEXT[])
      WHEN 'ready_release' THEN to_jsonb(ARRAY['orders:ready:release']::TEXT[])
      WHEN 'driver_delivery' THEN to_jsonb(ARRAY['orders:delivery:complete']::TEXT[])
      WHEN 'new_order' THEN to_jsonb(ARRAY['orders:create']::TEXT[])
      WHEN 'canceling' THEN to_jsonb(ARRAY['orders:cancel']::TEXT[])
      WHEN 'returning' THEN to_jsonb(ARRAY['orders:return']::TEXT[])
      ELSE '[]'::jsonb
    END
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_screen_pre_conditions(TEXT) IS
  'Screen contract: tenant override → system row (org_ord_screen_contracts_cf) → hardcoded fallback';

COMMIT;
