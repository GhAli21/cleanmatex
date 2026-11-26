-- Delivery, assembly, packing, and QA event stamps become timestamptz.
-- scheduled_time, estimated_arrival, and actual_time are instants. Screens already read them as instants. Display uses the route branch zone.

BEGIN;


-- org_asm_exceptions_tr.resolved_at
ALTER TABLE public.org_asm_exceptions_tr ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_exceptions_tr.resolved_at IS 'UTC instant (resolved_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_items_dtl.scanned_at
ALTER TABLE public.org_asm_items_dtl ALTER COLUMN scanned_at TYPE timestamptz USING scanned_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_items_dtl.scanned_at IS 'UTC instant (scanned_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_tasks_mst.completed_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.completed_at IS 'UTC instant (completed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_tasks_mst.packed_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN packed_at TYPE timestamptz USING packed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.packed_at IS 'UTC instant (packed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_tasks_mst.qa_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN qa_at TYPE timestamptz USING qa_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.qa_at IS 'UTC instant (qa_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_tasks_mst.started_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.started_at IS 'UTC instant (started_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_pod_tr.verified_at
ALTER TABLE public.org_dlv_pod_tr ALTER COLUMN verified_at TYPE timestamptz USING verified_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_pod_tr.verified_at IS 'UTC instant (verified_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_routes_mst.completed_at
ALTER TABLE public.org_dlv_routes_mst ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_routes_mst.completed_at IS 'UTC instant (completed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_routes_mst.started_at
ALTER TABLE public.org_dlv_routes_mst ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_routes_mst.started_at IS 'UTC instant (started_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_stops_dtl.actual_time
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN actual_time TYPE timestamptz USING actual_time AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_stops_dtl.actual_time IS 'UTC instant (actual_time). Converted from a naive stamp written while the database session was UTC. Delivery stop actual arrival instant. Display uses the route branch zone.';

-- org_dlv_stops_dtl.estimated_arrival
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN estimated_arrival TYPE timestamptz USING estimated_arrival AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_stops_dtl.estimated_arrival IS 'UTC instant (estimated_arrival). Converted from a naive stamp written while the database session was UTC. Delivery stop arrival instant. Display uses the route branch zone.';

-- org_dlv_stops_dtl.scheduled_time
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN scheduled_time TYPE timestamptz USING scheduled_time AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_stops_dtl.scheduled_time IS 'UTC instant (scheduled_time). Converted from a naive stamp written while the database session was UTC. Delivery stop appointment instant. Display uses the route branch zone.';

-- org_pck_packing_lists_mst.generated_at
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN generated_at TYPE timestamptz USING generated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pck_packing_lists_mst.generated_at IS 'UTC instant (generated_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN generated_at SET DEFAULT now();

-- org_pck_packing_lists_mst.printed_at
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN printed_at TYPE timestamptz USING printed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pck_packing_lists_mst.printed_at IS 'UTC instant (printed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_qa_decisions_tr.qa_at
ALTER TABLE public.org_qa_decisions_tr ALTER COLUMN qa_at TYPE timestamptz USING qa_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_qa_decisions_tr.qa_at IS 'UTC instant (qa_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_qa_decisions_tr ALTER COLUMN qa_at SET DEFAULT now();


COMMIT;
