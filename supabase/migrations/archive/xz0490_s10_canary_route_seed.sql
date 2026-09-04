-- ============================================================================
-- Migration: 0490_s10_canary_route_seed.sql
-- Purpose: Seed one delivery route + stop for the existing out_for_delivery
--          order ORD-20260903-0005 (tenant 11111111-1111-1111-1111-111111111111,
--          WF_V2_SIMPLE v4, already actively assigned) so the operator can run
--          the real S10 staff routed POD canary via the Delivery Stop Detail
--          page. Route/stop creation is bypassed here because
--          STAFF_DELIVERY_WRITES_ENABLED=false blocks it through the normal
--          UI/API (web-admin/lib/config/delivery-safety.ts) pending a separate,
--          explicit decision to reopen that path generally. The isolated stop
--          COMPLETION path (STAFF_DELIVERY_COMPLETION_ENABLED=true) is already
--          live and is what this canary actually needs to prove.
-- ============================================================================
-- Do not apply automatically. Review before running. Creates no route-create
-- API precedent — this is a one-off manual seed for one canary order.

BEGIN;

DO $$
DECLARE
  v_order_id UUID := 'f444b679-2134-4059-bcba-6b480eed090d'::UUID;
  v_tenant_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_route_id UUID;
  v_stop_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.org_dlv_stops_dtl WHERE order_id = v_order_id
  ) THEN
    RAISE EXCEPTION '0489: order % already has a delivery stop; not reseeding', v_order_id;
  END IF;

  INSERT INTO public.org_dlv_routes_mst (
    tenant_org_id, route_number, route_status_code, total_stops, completed_stops
  ) VALUES (
    v_tenant_id, 'S10-CANARY-01', 'in_progress', 1, 0
  )
  RETURNING id INTO v_route_id;

  INSERT INTO public.org_dlv_stops_dtl (
    tenant_org_id, route_id, order_id, sequence, address, stop_status_code
  ) VALUES (
    v_tenant_id, v_route_id, v_order_id, 1, 'S10 canary stop (seeded 0489)', 'in_transit'
  )
  RETURNING id INTO v_stop_id;

  RAISE NOTICE '0489: route_id=%, stop_id=% — open /dashboard/delivery/routes/%/stops/%', v_route_id, v_stop_id, v_route_id, v_stop_id;
END $$;

COMMIT;
