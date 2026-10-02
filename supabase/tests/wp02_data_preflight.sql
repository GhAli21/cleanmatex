-- WP02 read-only data preflight; no schema objects, writes, RPC calls or constraint validation.
-- Bind $1 to one operator-authorized tenant UUID. Execute each SELECT in a read-only transaction.
-- Counts classify current structure and actor compatibility, never historical commitment or timezone.
-- All tenant-bearing source tables and joins carry the same explicit tenant predicate.
WITH
orders AS (SELECT o.* FROM public.org_orders_mst o WHERE o.tenant_org_id = $1::uuid),
items AS (SELECT i.* FROM public.org_order_items_dtl i WHERE i.tenant_org_id = $1::uuid),
pieces AS (SELECT p.* FROM public.org_order_item_pieces_dtl p WHERE p.tenant_org_id = $1::uuid),
prefs AS (SELECT p.* FROM public.org_order_preferences_dtl p WHERE p.tenant_org_id = $1::uuid),
actor_class AS (SELECT o.id,
 CASE WHEN NULLIF(btrim(o.created_by),'') IS NULL THEN 'MISSING'
 WHEN btrim(o.created_by) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'MALFORMED'
 WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=CASE WHEN btrim(o.created_by) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN btrim(o.created_by)::uuid END) THEN 'UUID_NOT_AUTH_USER'
 ELSE 'AUTH_USER_EXISTS_NOT_COMMIT_PROOF' END AS classification
 FROM orders o WHERE o.tenant_org_id=$1::uuid)
SELECT jsonb_build_object(
 'tenant_org_id',$1,
 'orders',(SELECT jsonb_build_object('total',count(*),'committed',count(*) FILTER (WHERE o.committed_at IS NOT NULL),'revision_zero',count(*) FILTER (WHERE o.edit_state_version=0),'unknown_service_speed',count(*) FILTER (WHERE o.service_speed IS NULL),'missing_created_at',count(*) FILTER (WHERE o.created_at IS NULL),'legacy_created_at_without_original_zone',count(*) FILTER (WHERE o.created_at IS NOT NULL),'draft_workflow',count(*) FILTER (WHERE o.status='draft'),'split_child',count(*) FILTER (WHERE o.parent_order_id IS NOT NULL),'quick_drop',count(*) FILTER (WHERE o.is_order_quick_drop IS TRUE),'has_creation_key',count(*) FILTER (WHERE o.idempotency_key IS NOT NULL)) FROM orders o WHERE o.tenant_org_id=$1::uuid),
 'structural_status',(SELECT jsonb_agg(z) FROM (
 SELECT 'items' AS entity,count(*) AS total,count(*) FILTER (WHERE i.rec_status=1) AS active,count(*) FILTER (WHERE i.rec_status=0) AS inactive,count(*) FILTER (WHERE i.rec_status IS NULL) AS unknown,count(*) FILTER (WHERE i.rec_status NOT IN (0,1)) AS unsupported FROM items i WHERE i.tenant_org_id=$1::uuid
 UNION ALL SELECT 'pieces',count(*),count(*) FILTER (WHERE p.rec_status=1),count(*) FILTER (WHERE p.rec_status=0),count(*) FILTER (WHERE p.rec_status IS NULL),count(*) FILTER (WHERE p.rec_status NOT IN (0,1)) FROM pieces p WHERE p.tenant_org_id=$1::uuid
 UNION ALL SELECT 'preferences',count(*),count(*) FILTER (WHERE p.rec_status=1),count(*) FILTER (WHERE p.rec_status=0),count(*) FILTER (WHERE p.rec_status IS NULL),count(*) FILTER (WHERE p.rec_status NOT IN (0,1)) FROM prefs p WHERE p.tenant_org_id=$1::uuid) z),
 'hierarchy',jsonb_build_object(
 'items_missing_order',(SELECT count(*) FROM items i LEFT JOIN orders o ON o.id=i.order_id AND o.tenant_org_id=$1::uuid WHERE i.tenant_org_id=$1::uuid AND o.id IS NULL),
 'pieces_missing_order',(SELECT count(*) FROM pieces p LEFT JOIN orders o ON o.id=p.order_id AND o.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND o.id IS NULL),
 'pieces_missing_item',(SELECT count(*) FROM pieces p LEFT JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND i.id IS NULL),
 'pieces_wrong_item_order',(SELECT count(*) FROM pieces p JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND i.order_id IS DISTINCT FROM p.order_id),
 'active_pieces_nonactive_item',(SELECT count(*) FROM pieces p JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND p.rec_status=1 AND i.rec_status IS DISTINCT FROM 1),
 'preferences_bad_shape',(SELECT count(*) FROM prefs p WHERE p.tenant_org_id=$1::uuid AND ((p.prefs_level='ORDER' AND p.order_item_id IS NULL AND p.order_item_piece_id IS NULL) OR (p.prefs_level='ITEM' AND p.order_item_id IS NOT NULL AND p.order_item_piece_id IS NULL) OR (p.prefs_level='PIECE' AND p.order_item_id IS NOT NULL AND p.order_item_piece_id IS NOT NULL)) IS NOT TRUE),
 'preferences_missing_order',(SELECT count(*) FROM prefs p LEFT JOIN orders o ON o.id=p.order_id AND o.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND o.id IS NULL),
 'preferences_missing_item',(SELECT count(*) FROM prefs p LEFT JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND p.order_item_id IS NOT NULL AND i.id IS NULL),
 'preferences_wrong_item_order',(SELECT count(*) FROM prefs p JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND i.order_id IS DISTINCT FROM p.order_id),
 'preferences_missing_piece',(SELECT count(*) FROM prefs p LEFT JOIN pieces x ON x.id=p.order_item_piece_id AND x.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND p.order_item_piece_id IS NOT NULL AND x.id IS NULL),
 'preferences_wrong_piece_parent',(SELECT count(*) FROM prefs p JOIN pieces x ON x.id=p.order_item_piece_id AND x.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND (x.order_id IS DISTINCT FROM p.order_id OR x.order_item_id IS DISTINCT FROM p.order_item_id)),
 'active_preferences_nonactive_item',(SELECT count(*) FROM prefs p JOIN items i ON i.id=p.order_item_id AND i.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND p.rec_status=1 AND i.rec_status IS DISTINCT FROM 1),
 'active_preferences_nonactive_piece',(SELECT count(*) FROM prefs p JOIN pieces x ON x.id=p.order_item_piece_id AND x.tenant_org_id=$1::uuid WHERE p.tenant_org_id=$1::uuid AND p.rec_status=1 AND x.rec_status IS DISTINCT FROM 1)),
 'actors',(SELECT jsonb_object_agg(classification,n) FROM (SELECT classification,count(*) AS n FROM actor_class GROUP BY classification) a),
 'sources',(SELECT jsonb_agg(s) FROM (SELECT o.order_source_code,count(*) AS orders FROM orders o WHERE o.tenant_org_id=$1::uuid GROUP BY o.order_source_code ORDER BY o.order_source_code) s),
 'changes',(SELECT count(*) FROM public.org_order_changes_mst c WHERE c.tenant_org_id=$1::uuid),
 'ops',(SELECT count(*) FROM public.org_order_change_ops_dtl c WHERE c.tenant_org_id=$1::uuid)
 ) AS preflight;

-- Inspect the actual snapshot token distribution and all fourteen outstanding foundation constraints.
-- Zero violations justify a later operator validation review; they do not validate deployed constraints.
WITH scoped_orders AS (SELECT o.* FROM public.org_orders_mst o WHERE o.tenant_org_id=$1::uuid)
SELECT jsonb_build_object('tenant_org_id',$1,'snapshot_status',(SELECT jsonb_object_agg(status,n) FROM (SELECT o.financial_snapshot_status AS status,count(*) AS n FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid GROUP BY o.financial_snapshot_status) s),'workflow_status',(SELECT jsonb_object_agg(status,n) FROM (SELECT o.status,count(*) AS n FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid GROUP BY o.status) s),'wp02_check_violations',jsonb_build_object(
'commit',(SELECT count(*) FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid AND ((o.committed_at IS NULL AND o.edit_state_version=0 AND o.committed_by IS NULL) OR (o.committed_at IS NOT NULL AND o.edit_state_version>=1)) IS NOT TRUE),
'access',(SELECT count(*) FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid AND ((o.edit_access_status='OPEN' AND o.edit_block_reason_code IS NULL AND o.edit_block_reason_text IS NULL AND o.edit_blocked_at IS NULL AND o.edit_blocked_by IS NULL AND o.edit_block_until IS NULL) OR (o.edit_access_status IN ('TEMPORARILY_BLOCKED','PERMANENTLY_BLOCKED') AND o.edit_blocked_at IS NOT NULL AND (NULLIF(btrim(o.edit_block_reason_code),'') IS NOT NULL OR NULLIF(btrim(o.edit_block_reason_text),'') IS NOT NULL) AND (o.edit_access_status<>'PERMANENTLY_BLOCKED' OR o.edit_block_until IS NULL) AND (o.edit_block_until IS NULL OR o.edit_block_until>o.edit_blocked_at))) IS NOT TRUE),
'speed',(SELECT count(*) FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid AND (o.service_speed IS NULL OR o.service_speed IN ('STANDARD','EXPRESS')) IS NOT TRUE),
'commit_actor',(SELECT count(*) FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid AND o.committed_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=o.committed_by)),
'block_actor',(SELECT count(*) FROM scoped_orders o WHERE o.tenant_org_id=$1::uuid AND o.edit_blocked_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=o.edit_blocked_by))),
'lineage',(SELECT jsonb_agg(x) FROM (SELECT 'items' AS entity,count(*) FILTER (WHERE t.deleted_at IS NOT NULL OR t.deleted_by IS NOT NULL OR t.deleted_order_change_id IS NOT NULL) AS has_any_lineage,count(*) FILTER (WHERE ((t.deleted_order_change_id IS NULL AND t.deleted_at IS NULL AND t.deleted_by IS NULL) OR (t.deleted_order_change_id IS NOT NULL AND t.rec_status IS NOT NULL AND t.rec_status=0 AND t.deleted_at IS NOT NULL AND t.deleted_by IS NOT NULL)) IS NOT TRUE) AS check_violations,count(*) FILTER (WHERE t.deleted_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.deleted_by)) AS actor_fk_violations,count(*) FILTER (WHERE t.deleted_order_change_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.org_order_changes_mst c WHERE c.id=t.deleted_order_change_id AND c.tenant_org_id=$1::uuid)) AS change_fk_violations FROM public.org_order_items_dtl t WHERE t.tenant_org_id=$1::uuid
UNION ALL
SELECT 'pieces' AS entity,count(*) FILTER (WHERE t.deleted_at IS NOT NULL OR t.deleted_by IS NOT NULL OR t.deleted_order_change_id IS NOT NULL) AS has_any_lineage,count(*) FILTER (WHERE ((t.deleted_order_change_id IS NULL AND t.deleted_at IS NULL AND t.deleted_by IS NULL) OR (t.deleted_order_change_id IS NOT NULL AND t.rec_status IS NOT NULL AND t.rec_status=0 AND t.deleted_at IS NOT NULL AND t.deleted_by IS NOT NULL)) IS NOT TRUE) AS check_violations,count(*) FILTER (WHERE t.deleted_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.deleted_by)) AS actor_fk_violations,count(*) FILTER (WHERE t.deleted_order_change_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.org_order_changes_mst c WHERE c.id=t.deleted_order_change_id AND c.tenant_org_id=$1::uuid)) AS change_fk_violations FROM public.org_order_item_pieces_dtl t WHERE t.tenant_org_id=$1::uuid
UNION ALL
SELECT 'preferences' AS entity,count(*) FILTER (WHERE t.deleted_at IS NOT NULL OR t.deleted_by IS NOT NULL OR t.deleted_order_change_id IS NOT NULL) AS has_any_lineage,count(*) FILTER (WHERE ((t.deleted_order_change_id IS NULL AND t.deleted_at IS NULL AND t.deleted_by IS NULL) OR (t.deleted_order_change_id IS NOT NULL AND t.rec_status IS NOT NULL AND t.rec_status=0 AND t.deleted_at IS NOT NULL AND t.deleted_by IS NOT NULL)) IS NOT TRUE) AS check_violations,count(*) FILTER (WHERE t.deleted_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.deleted_by)) AS actor_fk_violations,count(*) FILTER (WHERE t.deleted_order_change_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.org_order_changes_mst c WHERE c.id=t.deleted_order_change_id AND c.tenant_org_id=$1::uuid)) AS change_fk_violations FROM public.org_order_preferences_dtl t WHERE t.tenant_org_id=$1::uuid) x)
) AS supplemental;
