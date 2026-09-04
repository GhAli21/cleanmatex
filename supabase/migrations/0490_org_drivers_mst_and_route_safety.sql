-- ============================================================================
-- Migration: 0490_org_drivers_mst_and_route_safety.sql
-- Purpose: Delivery feature completion, Phase 1 (schema only).
--   1. org_drivers_mst — tenant driver master data (was entirely missing;
--      org_dlv_routes_mst.driver_id was a bare UUID with no backing table).
--   2. Composite FK org_dlv_routes_mst.driver_id -> org_drivers_mst.
--   3. org_dlv_route_seq_cf — small per-tenant/year counter for safe,
--      race-free route-number generation (atomic UPSERT-increment; no
--      general-purpose document-sequence utility exists in this codebase to
--      reuse — org_tax_doc_seq_counters is fiscal-grade and the wrong fit).
--   4. Partial unique index on org_dlv_stops_dtl — the existing constraint is
--      UNIQUE (tenant_org_id, route_id, order_id), unique per (route, order)
--      only. Nothing stops the same order being double-booked onto two
--      different routes today. This adds the real backstop.
--   5. Nullable linked_user_id on org_drivers_mst — unused until the
--      (separately planned, driver_app-flagged) driver mobile app ships;
--      avoids a future migration/backfill for that transition.
-- Both orphan pre-checks RAISE instead of silently resolving data problems.
-- ============================================================================
-- Do not apply automatically. Operator reviews and applies.

BEGIN;

-- 1. org_drivers_mst -----------------------------------------------------

CREATE TABLE public.org_drivers_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  linked_user_id UUID,

  name TEXT NOT NULL,
  name2 TEXT,
  phone TEXT,
  vehicle_type TEXT,
  vehicle_plate_no TEXT,
  license_no TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,

  CONSTRAINT pk_org_drivers_mst PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT fk_drivers_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_drivers_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_drivers_user FOREIGN KEY (linked_user_id, tenant_org_id)
    REFERENCES public.org_users_mst(user_id, tenant_org_id) ON DELETE SET NULL
);

CREATE INDEX idx_drivers_tenant ON public.org_drivers_mst(tenant_org_id);
CREATE INDEX idx_drivers_tenant_active ON public.org_drivers_mst(tenant_org_id, is_active);
CREATE INDEX idx_drivers_branch ON public.org_drivers_mst(tenant_org_id, branch_id);

ALTER TABLE public.org_drivers_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_drivers_mst ON public.org_drivers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- 2. Composite FK org_dlv_routes_mst.driver_id -> org_drivers_mst --------

DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  -- org_drivers_mst was just created empty, so any non-null driver_id today
  -- is by definition orphaned.
  SELECT count(*) INTO v_orphans
  FROM public.org_dlv_routes_mst
  WHERE driver_id IS NOT NULL;

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      '0490: % org_dlv_routes_mst row(s) already have driver_id set with no org_drivers_mst backing them. Resolve manually (create the matching driver rows, or null the stale driver_id) before this migration can add the FK.',
      v_orphans;
  END IF;
END $$;

ALTER TABLE public.org_dlv_routes_mst
  ADD CONSTRAINT fk_dlv_route_driver FOREIGN KEY (driver_id, tenant_org_id)
    REFERENCES public.org_drivers_mst(id, tenant_org_id) ON DELETE SET NULL;

-- 3. org_dlv_route_seq_cf — safe route-number generation -----------------

CREATE TABLE public.org_dlv_route_seq_cf (
  tenant_org_id UUID NOT NULL,
  year_code TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_dlv_route_seq_cf PRIMARY KEY (tenant_org_id, year_code),
  CONSTRAINT fk_dlv_route_seq_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE
);

ALTER TABLE public.org_dlv_route_seq_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_dlv_route_seq_cf ON public.org_dlv_route_seq_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Usage from application code (single atomic statement, race-safe via the
-- UPSERT's own row lock — no separate SELECT ... FOR UPDATE needed):
--   INSERT INTO org_dlv_route_seq_cf (tenant_org_id, year_code, last_seq)
--   VALUES ($1, $2, 1)
--   ON CONFLICT (tenant_org_id, year_code)
--   DO UPDATE SET last_seq = org_dlv_route_seq_cf.last_seq + 1, updated_at = now()
--   RETURNING last_seq;

-- 4. Partial unique index — one active stop per order, across ALL routes -

DO $$
DECLARE
  v_conflicts INTEGER;
BEGIN
  SELECT count(*) INTO v_conflicts
  FROM (
    SELECT order_id
    FROM public.org_dlv_stops_dtl
    WHERE stop_status_code NOT IN ('cancelled', 'failed')
    GROUP BY tenant_org_id, order_id
    HAVING count(*) > 1
  ) dupes;

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION
      '0490: % order(s) already have more than one active (non-cancelled/failed) delivery stop across different routes. Resolve manually before this migration can add the uniqueness backstop.',
      v_conflicts;
  END IF;
END $$;

CREATE UNIQUE INDEX uq_dlv_stops_active_order
  ON public.org_dlv_stops_dtl (tenant_org_id, order_id)
  WHERE stop_status_code NOT IN ('cancelled', 'failed');

COMMIT;
