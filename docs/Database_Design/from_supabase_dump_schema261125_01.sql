


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."auto_unlock_expired_accounts"() RETURNS TABLE("unlocked_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Unlock accounts where lock has expired
  UPDATE org_users_mst
  SET
    locked_until = NULL,
    lock_reason = NULL,
    updated_at = NOW()
  WHERE locked_until IS NOT NULL
    AND locked_until <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log if any accounts were unlocked
  IF v_count > 0 THEN
    PERFORM log_audit_event(
      NULL,
      NULL,
      'auto_unlock_expired',
      'system',
      NULL,
      NULL,
      jsonb_build_object(
        'unlocked_count', v_count,
        'timestamp', NOW()
      ),
      NULL,
      NULL,
      NULL,
      'success',
      NULL
    );
  END IF;

  RETURN QUERY SELECT v_count;
END;
$$;


ALTER FUNCTION "public"."auto_unlock_expired_accounts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_unlock_expired_accounts"() IS 'Automatically unlock accounts with expired locks (run via cron)';



CREATE OR REPLACE FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) RETURNS TABLE("referencing_table" character varying, "referencing_column" character varying, "reference_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This is a placeholder that will be extended as we add more tables
  -- For now, it returns an empty result set
  -- TODO: Implement reference checking logic based on table_name

  RETURN QUERY
  SELECT
    ''::VARCHAR as referencing_table,
    ''::VARCHAR as referencing_column,
    0::BIGINT as reference_count
  WHERE false; -- Return empty set for now
END;
$$;


ALTER FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) IS 'Checks if a code value is referenced in other tables (prevents orphaned references)';



CREATE OR REPLACE FUNCTION "public"."check_rbac_migration_status"() RETURNS TABLE("user_id" "uuid", "tenant_org_id" "uuid", "old_role" "text", "has_rbac_role" boolean, "rbac_roles" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    oum.user_id,
    oum.tenant_org_id,
    oum.role AS old_role,
    EXISTS (
      SELECT 1
      FROM org_auth_user_roles oaur
      WHERE oaur.user_id = oum.user_id
        AND oaur.tenant_org_id = oum.tenant_org_id
        AND oaur.is_active = true
    ) AS has_rbac_role,
    COALESCE(
      ARRAY_AGG(DISTINCT sr.code ORDER BY sr.code),
      ARRAY[]::TEXT[]
    ) AS rbac_roles
  FROM org_users_mst oum
  LEFT JOIN org_auth_user_roles oaur ON oaur.user_id = oum.user_id
    AND oaur.tenant_org_id = oum.tenant_org_id
    AND oaur.is_active = true
  LEFT JOIN sys_auth_roles sr ON sr.role_id = oaur.role_id
  WHERE oum.is_active = true
    AND oum.role IN ('admin', 'operator', 'viewer')
  GROUP BY oum.user_id, oum.tenant_org_id, oum.role;
$$;


ALTER FUNCTION "public"."check_rbac_migration_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rbac_migration_status"() IS 'Check which users still need RBAC migration';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otp_codes"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM sys_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_otp_codes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_otp_codes"() IS 'Delete OTP codes expired more than 1 hour ago';



CREATE OR REPLACE FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text" DEFAULT NULL::"text", "p_resource_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cmx_effective_permissions ep
    WHERE ep.user_id = auth.uid()
      AND ep.tenant_org_id = current_tenant_id()
      AND ep.permission_code = p_perm
      AND (
        -- Match tenant-wide permissions (resource_type IS NULL)
        (ep.resource_type IS NULL AND p_resource_type IS NULL)
        OR
        -- Match resource-scoped permissions
        (ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
        OR
        -- Match tenant-wide permission when checking resource-scoped (fallback)
        (ep.resource_type IS NULL AND p_resource_type IS NOT NULL)
      )
      AND ep.allow = true
  );
$$;


ALTER FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text", "p_resource_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text", "p_resource_id" "uuid") IS 'Fast permission check using effective_permissions table (O(1) lookup for RLS)';



CREATE OR REPLACE FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_allowed JSONB;
  v_current_status TEXT;
  v_from TEXT:=LOWER(p_from);
  
BEGIN
  -- Get order details
  SELECT 
    o.*,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'transitions', '[]'::jsonb
    );
  END IF;

  v_template_id := v_order.resolved_template_id;
  v_current_status := LOWER(COALESCE(p_from, v_order.current_status));

  -- Fallback to WF_STANDARD
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Get allowed transitions
  SELECT jsonb_agg(
    jsonb_build_object(
      'to', to_stage_code,
      'requires_scan', requires_scan_ok,
      'requires_invoice', requires_invoice,
      'requires_pod', requires_pod,
      'allow_manual', allow_manual,
      'auto_when_done', auto_when_done
    )
  ) INTO v_allowed
  FROM sys_workflow_template_transitions
  WHERE template_id = v_template_id
    AND from_stage_code = v_current_status
    AND is_active = true;

  IF v_allowed IS NULL THEN
    v_allowed := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'from_status', v_current_status,
    'template_id', v_template_id,
    'transitions', v_allowed
  );
END;
$$;


ALTER FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text") IS 'Get all allowed transitions for an order from current status';



CREATE OR REPLACE FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid" DEFAULT NULL::"uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_quality_gate_passed BOOLEAN := true;
  v_error_message TEXT;
  v_result JSONB;
  v_items_updated INTEGER := 0;
  v_rack_location TEXT;
  v_notes TEXT;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  IF v_to = 'ready' THEN
    
	UPDATE org_order_items_dtl
    SET 
      item_status = 'ready',
      item_stage = 'ready'
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) not in( 'ready', 'out_for_delivery', 'delivered', 'closed', 'cancelled')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  ELSIF v_to = 'processing' THEN
    UPDATE org_order_items_dtl
    SET 
      item_status = 'processing',
      item_stage = 'processing'
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) in( 'draft', 'intake', 'preparation')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
	
  ELSIF v_to = 'closed' THEN
    UPDATE org_order_items_dtl
    SET 
      item_status = v_to,
      item_stage = v_to
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) in( 'draft', 'intake', 'preparation', 'processing')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  ELSE 
    UPDATE org_order_items_dtl
    SET 
      item_status = v_to,
      item_stage = v_to
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
	
  END IF;
  
  Return v_items_updated;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    --v_error_message := SQLERRM;
	Return('ERROR:'+SQLERRM);
  
END;
$$;


ALTER FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") IS 'Update Order Items Status ';



CREATE OR REPLACE FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid" DEFAULT NULL::"uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_quality_gate_passed BOOLEAN := true;
  v_error_message TEXT;
  v_result JSONB;
  v_items_updated INTEGER := 0;
  v_rack_location TEXT;
  v_notes TEXT;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  v_item_update_result TEXT;
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  -- Step 1: Get order details
  SELECT 
    o.*,
    otwt.template_id as workflow_template_id,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or access denied',
      'code', 'ORDER_NOT_FOUND'
    );
  END IF;

  -- Set resolved template_id
  v_template_id := v_order.resolved_template_id;

  -- Fallback to WF_STANDARD if no template
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Step 2: Validate transition is allowed in template
  SELECT EXISTS (
    SELECT 1 FROM sys_workflow_template_transitions
    WHERE template_id = v_template_id
      AND LOWER(from_stage_code) = v_from
      AND LOWER(to_stage_code) = v_to
      AND is_active = true
      AND allow_manual = true
  ) INTO v_transition_allowed;

  IF NOT v_transition_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transition from %s to %s not allowed', p_from, p_to),
      'code', 'TRANSITION_NOT_ALLOWED',
      'from', p_from,
      'to', p_to,
      'template_id', v_template_id
    );
  END IF;

  -- Step 3: Quality gate checks
  IF v_to = 'ready' THEN
    -- Check rack_location is set
    v_rack_location := COALESCE(
      (p_payload->>'rack_location')::TEXT,
      v_order.rack_location
    );

    IF v_rack_location IS NULL OR v_rack_location = '' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Rack location is required before moving to READY status',
        'code', 'QUALITY_GATE_FAILED',
        'gate', 'rack_location_required'
      );
    END IF;
  END IF;

  -- Step 4: Extract optional notes from payload
  v_notes := p_payload->>'notes';
  
  
  -- Step 5: Update org_orders_mst
  IF v_to='ready' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		ready_at=now(),
		last_transition_at = now(),
		last_transition_by = p_user,
		rack_location = COALESCE((p_payload->>'rack_location')::TEXT, rack_location),
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='delivered' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		delivered_at=now(),
		--delivered_note=COALESCE((p_payload->>'delivered_note')::TEXT, delivered_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='closed' THEN
      	  
	  UPDATE org_orders_mst
	  SET
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		delivered_at=COALESCE(delivered_at, now()),
		--closed_at=now(),
		--closed_note=COALESCE((p_payload->>'closed_note')::TEXT, closed_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='cancelled' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		--cancelled_at=now(),
		--cancelled_note=COALESCE((p_payload->>'cancelled_note')::TEXT, cancelled_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSE
	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		last_transition_at = now(),
		last_transition_by = p_user,
		rack_location = COALESCE((p_payload->>'rack_location')::TEXT, rack_location),
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
  
  END IF;
  
  -- Step 6: Bulk-update items if transitioning to processing
  v_item_update_result:=cmx_order_items_transition(
	  p_tenant,
	  p_order,
	  p_from,
	  p_to,
	  p_user
  );
  
  IF SUBSTR(v_item_update_result, 1, 5) = 'ERROR' THEN
    v_items_updated:=0;
  END IF;
  
  -- Step 7: Insert into org_order_history
  PERFORM log_order_action(
    p_tenant,
    p_order,
    'STATUS_CHANGE',
    p_from,
    p_to,
    p_user,
    jsonb_build_object(
      'template_id', v_template_id,
      'items_updated', v_items_updated,
      'notes', v_notes,
      'payload', p_payload
    )
  );

  -- Step 8: Build success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order,
    'from_status', p_from,
    'to_status', p_to,
    'template_id', v_template_id,
    'items_updated', v_items_updated,
    'rack_location', v_order.rack_location,
    'transitioned_at', now()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    v_error_message := SQLERRM;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message,
      'code', 'TRANSITION_ERROR',
      'from', p_from,
      'to', p_to
    );
END;
$$;


ALTER FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") IS 'Enforce workflow transitions with template validation and quality gates';



CREATE OR REPLACE FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Clear old effective permissions for this user-tenant combination
  DELETE FROM cmx_effective_permissions
  WHERE user_id = p_user_id
    AND tenant_org_id = p_tenant_id;

  -- 1) Tenant-level roles → permissions (broadest scope)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,                    -- NULL = tenant-wide
    NULL::UUID,                    -- NULL = tenant-wide
    true
  FROM org_auth_user_roles our
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = our.role_id
  JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
  WHERE our.user_id = p_user_id
    AND our.tenant_org_id = p_tenant_id
    AND our.is_active = true
    AND sp.is_active = true;

  -- 2) Resource-level roles → permissions (resource-scoped)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT DISTINCT ON (p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id)
    p_user_id,
    p_tenant_id,
    sp.code,
    urr.resource_type,
    urr.resource_id,
    true
  FROM org_auth_user_resource_roles urr
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = urr.role_id
  JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
  WHERE urr.user_id = p_user_id
    AND urr.tenant_org_id = p_tenant_id
    AND urr.is_active = true
    AND sp.is_active = true
  ORDER BY p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id;

  -- 3) Global user permission overrides (tenant-wide overrides)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = oup.allow,
      created_at = NOW()
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.permission_id = oup.permission_id
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type IS NULL
    AND ep.resource_id IS NULL
    AND oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,
    NULL::UUID,
    oup.allow
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.permission_id = oup.permission_id
  WHERE oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type IS NULL
        AND ep.resource_id IS NULL
    );

  -- 4) Resource-scoped permission overrides (most specific, wins)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = ourp.allow,
      created_at = NOW()
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.permission_id = ourp.permission_id
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type = ourp.resource_type
    AND ep.resource_id = ourp.resource_id
    AND ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    ourp.resource_type,
    ourp.resource_id,
    ourp.allow
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.permission_id = ourp.permission_id
  WHERE ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type = ourp.resource_type
        AND ep.resource_id = ourp.resource_id
    );
END;
$$;


ALTER FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") IS 'Rebuild effective permissions for a user-tenant combination (called on role/permission changes)';



CREATE OR REPLACE FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_result JSONB;
  v_quality_gates JSONB;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  -- Get order details
  SELECT 
    o.*,
    otwt.template_id as workflow_template_id,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Order not found',
      'code', 'ORDER_NOT_FOUND'
    );
  END IF;

  v_template_id := v_order.resolved_template_id;

  -- Fallback to WF_STANDARD
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Check if transition is allowed
  SELECT EXISTS (
    SELECT 1 FROM sys_workflow_template_transitions
    WHERE template_id = v_template_id
      AND LOWER(from_stage_code) = v_from
      AND LOWER(to_stage_code) = v_to
      AND is_active = true
      AND allow_manual = true
  ) INTO v_transition_allowed;

  -- Check quality gates
  v_quality_gates := jsonb_build_object();

  IF p_to = 'ready' THEN
    IF v_order.rack_location IS NULL THEN
      v_quality_gates := jsonb_build_object(
        'passed', false,
        'required', 'rack_location'
      );
    ELSE
      v_quality_gates := jsonb_build_object('passed', true);
    END IF;
  ELSE
    v_quality_gates := jsonb_build_object('passed', true);
  END IF;

  v_result := jsonb_build_object(
    'allowed', v_transition_allowed,
    'template_id', v_template_id,
    'quality_gates', v_quality_gates,
    'from', p_from,
    'to', p_to
  );

  IF NOT v_transition_allowed THEN
    v_result := v_result || jsonb_build_object(
      'error', format('Transition from %s to %s not allowed', p_from, p_to),
      'code', 'TRANSITION_NOT_ALLOWED'
    );
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") IS 'Validate if a workflow transition is allowed without executing it';



CREATE OR REPLACE FUNCTION "public"."create_tenant_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO sys_tenant_lifecycle (
    tenant_org_id,
    lifecycle_stage,
    onboarding_status,
    onboarding_checklist,
    health_score,
    created_at
  ) VALUES (
    NEW.id,
    'trial',
    'not_started',
    jsonb_build_array(
      jsonb_build_object('step', 'setup_business_info', 'completed', false, 'required', true, 'order', 1),
      jsonb_build_object('step', 'configure_branding', 'completed', false, 'required', false, 'order', 2),
      jsonb_build_object('step', 'add_products', 'completed', false, 'required', true, 'order', 3),
      jsonb_build_object('step', 'invite_team', 'completed', false, 'required', false, 'order', 4),
      jsonb_build_object('step', 'create_first_order', 'completed', false, 'required', true, 'order', 5),
      jsonb_build_object('step', 'configure_workflows', 'completed', false, 'required', false, 'order', 6)
    ),
    0.0,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (tenant_org_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_tenant_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'tenant_org_id',
    ''
  )::UUID;
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_tenant_id"() IS 'Extract tenant_org_id from JWT claims';



CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID,
    auth.uid()
  );
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_id"() IS 'Extract user ID (sub claim) from JWT';



CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS character varying
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role
  FROM org_users_mst
  WHERE user_id = auth.uid()
    AND tenant_org_id = current_tenant_id()
    AND is_active = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_role"() IS 'Get current user role within active tenant';



CREATE OR REPLACE FUNCTION "public"."ensure_single_default_address"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default addresses for this customer/tenant
    UPDATE org_customer_addresses
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND tenant_org_id = NEW.tenant_org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_address"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_order_sequence"("p_order_no" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CAST(SUBSTRING(p_order_no FROM 14) AS INTEGER);
$$;


ALTER FUNCTION "public"."extract_order_sequence"("p_order_no" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."extract_order_sequence"("p_order_no" "text") IS 'Extract sequence number from order number (e.g., "ORD-20251025-0001" → 1)';



CREATE OR REPLACE FUNCTION "public"."fn_auto_log_order_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM log_order_action(
    NEW.tenant_org_id,
    NEW.id,
    'ORDER_CREATED',
    NULL,
    NEW.current_status,
    auth.uid(),
    jsonb_build_object(
      'order_no', NEW.order_no,
      'customer_id', NEW.customer_id,
      'is_quick_drop', NEW.is_order_quick_drop,
      'order_type_id', NEW.order_type_id,
      'created_via', 'system_trigger'
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_auto_log_order_created"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_auto_log_order_created"() IS 'Auto-log order creation to history';



CREATE OR REPLACE FUNCTION "public"."fn_create_initial_status_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Create initial status history entry when order is created
  INSERT INTO org_order_status_history (
    order_id,
    tenant_org_id,
    from_status,
    to_status,
    changed_by,
    changed_by_name,
    notes
  ) VALUES (
    NEW.id,
    NEW.tenant_org_id,
    NULL,
    NEW.status,
    auth.uid(),
    'System',
    'Order created'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_create_initial_status_history"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_create_initial_status_history"() IS 'Auto-creates initial status history entry when order is created';



CREATE OR REPLACE FUNCTION "public"."fn_get_setting_value"("p_tenant_org_id" "uuid", "p_setting_code" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r RECORD;
  v_result json;
BEGIN
  -- 1. Try tenant-level record
  SELECT
    s.setting_value,
    s.setting_value_type,
    s.is_active,
    'tenant' AS source
  INTO r
  FROM org_tenant_settings_cf s
  WHERE s.tenant_org_id = p_tenant_org_id
    AND s.setting_code  = p_setting_code
  ORDER BY
    (s.user_id IS NOT NULL) DESC,
    (s.branch_id IS NOT NULL) DESC,
    s.updated_at DESC NULLS LAST,
    s.created_at DESC
  LIMIT 1;

  -- 2. If no tenant record, use system default
  IF NOT FOUND THEN
    SELECT
      s.setting_value,
      s.setting_value_type,
      s.is_active,
      'system' AS source
    INTO r
    FROM sys_tenant_settings_cd s
    WHERE s.setting_code = p_setting_code;
  END IF;

  -- 3. If still null, default false/null result
  IF r.setting_value IS NULL THEN
    RETURN json_build_object(
      'value', NULL,
      'type', NULL,
      'is_active', false,
      'source', 'none'
    );
  END IF;

  -- 4. Coerce value according to type
  CASE r.setting_value_type
    WHEN 'BOOLEAN' THEN
      v_result := json_build_object(
        'value', (r.setting_value::boolean),
        'type', 'BOOLEAN',
        'is_active', r.is_active,
        'source', r.source
      );
    WHEN 'NUMBER' THEN
      v_result := json_build_object(
        'value', (r.setting_value::numeric),
        'type', 'NUMBER',
        'is_active', r.is_active,
        'source', r.source
      );
    WHEN 'DATE' THEN
      v_result := json_build_object(
        'value', (r.setting_value::timestamptz),
        'type', 'DATE',
        'is_active', r.is_active,
        'source', r.source
      );
    ELSE
      v_result := json_build_object(
        'value', r.setting_value,
        'type', 'TEXT',
        'is_active', r.is_active,
        'source', r.source
      );
  END CASE;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."fn_get_setting_value"("p_tenant_org_id" "uuid", "p_setting_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_setting_allowed"("p_tenant_org_id" "uuid", "p_setting_code" "text") RETURNS boolean
    LANGUAGE "sql"
    AS $$
SELECT COALESCE(
  (fn_get_setting_value(p_tenant_org_id, p_setting_code)->>'value')::boolean,
  false
);
$$;


ALTER FUNCTION "public"."fn_is_setting_allowed"("p_tenant_org_id" "uuid", "p_setting_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_next_order_item_srno"("p_tenant" "uuid", "p_order" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_next_num integer;
BEGIN
  SELECT COALESCE(MAX((CASE WHEN order_item_srno ~ '^\\d+$' THEN order_item_srno::int ELSE 0 END)), 0) + 1
    INTO v_next_num
  FROM org_order_items_dtl
  WHERE tenant_org_id = p_tenant
    AND order_id = p_order;

  -- Return zero-padded 3+ width (e.g., 001, 012, 120)
  RETURN lpad(v_next_num::text, 3, '0');
END;
$_$;


ALTER FUNCTION "public"."fn_next_order_item_srno"("p_tenant" "uuid", "p_order" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_order_totals"("p_tenant" "uuid", "p_order" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_items integer := 0;
  v_subtotal numeric(10,3) := 0;
  v_discount numeric(10,3) := 0;
  v_tax numeric(10,3) := 0;
BEGIN
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(total_price), 0)
    INTO v_total_items, v_subtotal
  FROM org_order_items_dtl
  WHERE tenant_org_id = p_tenant
    AND order_id = p_order;

  -- Get existing discount/tax from order; preserve values
  SELECT COALESCE(discount, 0), COALESCE(tax, 0)
    INTO v_discount, v_tax
  FROM org_orders_mst
  WHERE tenant_org_id = p_tenant AND id = p_order;

  UPDATE org_orders_mst
  SET total_items = v_total_items,
      subtotal    = v_subtotal,
      total       = (v_subtotal - v_discount + v_tax),
      updated_at  = NOW()
  WHERE tenant_org_id = p_tenant AND id = p_order;
END;
$$;


ALTER FUNCTION "public"."fn_recalc_order_totals"("p_tenant" "uuid", "p_order" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_next_number INTEGER;
  v_customer_number VARCHAR(50);
BEGIN
  -- Get the next sequential number for this tenant
  -- This is a simplified version - in production, consider using a sequence per tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(customer_number FROM 6) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM sys_customers_mst
  WHERE first_tenant_org_id = p_tenant_org_id
    AND customer_number IS NOT NULL
    AND customer_number ~ '^CUST-[0-9]+$';

  -- Format as CUST-00001
  v_customer_number := 'CUST-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_customer_number;
END;
$_$;


ALTER FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") IS 'Generate sequential customer number per tenant (CUST-00001 format)';



CREATE OR REPLACE FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_date TEXT;
  v_sequence INTEGER;
  v_order_number TEXT;
  v_max_attempts INTEGER := 10;
  v_attempt INTEGER := 0;
BEGIN
  -- Get current date in YYYYMMDD format (tenant's timezone)
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Loop to handle rare race conditions
  LOOP
    v_attempt := v_attempt + 1;

    -- Get next sequence number for this tenant and date
    -- Using FOR UPDATE to prevent race conditions
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM org_orders_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND order_no LIKE 'ORD-' || v_date || '-%';

    -- Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20251025-0001)
    v_order_number := 'ORD-' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');

    -- Verify uniqueness
    IF NOT EXISTS (
      SELECT 1 FROM org_orders_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND order_no = v_order_number
    ) THEN
      RETURN v_order_number;
    END IF;

    -- If we've tried too many times, raise exception
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', v_max_attempts;
    END IF;

    -- Small delay before retry (1ms)
    PERFORM pg_sleep(0.001);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") IS 'Generate unique order number per tenant per day in format ORD-YYYYMMDD-XXXX. Thread-safe with retry logic.';



CREATE OR REPLACE FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "action" character varying, "old_values" "jsonb", "new_values" "jsonb", "changed_fields" "text"[], "changed_by" "uuid", "changed_at" timestamp without time zone, "change_reason" "text", "is_rollback" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.old_values,
    l.new_values,
    l.changed_fields,
    l.changed_by,
    l.changed_at,
    l.change_reason,
    l.is_rollback
  FROM sys_code_table_audit_log l
  WHERE l.table_name = p_table_name
    AND l.record_code = p_record_code
  ORDER BY l.changed_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer) IS 'Retrieves change history for a specific code value, ordered by most recent';



CREATE OR REPLACE FUNCTION "public"."get_order_number_prefix"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
$$;


ALTER FUNCTION "public"."get_order_number_prefix"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_order_number_prefix"() IS 'Get order number prefix for current date (e.g., "ORD-20251025-")';



CREATE OR REPLACE FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") RETURNS TABLE("id" "uuid", "action_type" "text", "from_value" "text", "to_value" "text", "done_by" "uuid", "done_at" timestamp with time zone, "payload" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oh.id,
    oh.action_type,
    oh.from_value,
    oh.to_value,
    oh.done_by,
    oh.done_at,
    oh.payload
  FROM org_order_history oh
  WHERE oh.order_id = p_order_id
  ORDER BY oh.done_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") IS 'Get complete timeline for an order';



CREATE OR REPLACE FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying DEFAULT 'standard'::character varying, "p_quantity" integer DEFAULT 1, "p_effective_date" "date" DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_price NUMERIC(10,3);
BEGIN
  -- Get price from active price list
  SELECT pli.price * (1 - COALESCE(pli.discount_percent, 0) / 100)
  INTO v_price
  FROM org_price_list_items_dtl pli
  JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
  WHERE pli.tenant_org_id = p_tenant_org_id
    AND pli.product_id = p_product_id
    AND pli.is_active = true
    AND pl.is_active = true
    AND pl.price_list_type = p_price_list_type
    AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
    AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
    AND pli.min_quantity <= p_quantity
    AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
  ORDER BY pl.priority DESC, pli.min_quantity DESC
  LIMIT 1;
  
  -- If no price list price found, fall back to product default price
  IF v_price IS NULL THEN
    SELECT 
      CASE 
        WHEN p_price_list_type = 'express' THEN COALESCE(default_express_sell_price, default_sell_price)
        ELSE default_sell_price
      END
    INTO v_price
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND id = p_product_id
      AND is_active = true;
  END IF;
  
  RETURN v_price;
END;
$$;


ALTER FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying, "p_quantity" integer, "p_effective_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying, "p_quantity" integer, "p_effective_date" "date") IS 'Get active price for a product considering price lists and quantity tiers';



CREATE OR REPLACE FUNCTION "public"."get_user_permissions"() RETURNS TABLE("permission_code" "text", "resource_type" "text", "resource_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT
    ep.permission_code,
    ep.resource_type,
    ep.resource_id
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = auth.uid()
    AND ep.tenant_org_id = current_tenant_id()
    AND ep.allow = true;
$$;


ALTER FUNCTION "public"."get_user_permissions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_permissions"() IS 'Get all permissions for current user (tenant-wide and resource-scoped)';



CREATE OR REPLACE FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    -- Try RBAC first
    (SELECT sr.code
     FROM org_auth_user_roles oaur
     JOIN sys_auth_roles sr ON sr.role_id = oaur.role_id
     WHERE oaur.user_id = p_user_id
       AND oaur.tenant_org_id = p_tenant_id
       AND oaur.is_active = true
     ORDER BY CASE sr.code
       WHEN 'tenant_admin' THEN 1
       WHEN 'operator' THEN 2
       WHEN 'viewer' THEN 3
       ELSE 4
     END
     LIMIT 1),
    -- Fallback to old system
    (SELECT role
     FROM org_users_mst
     WHERE user_id = p_user_id
       AND tenant_org_id = p_tenant_id
       AND is_active = true
     LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") IS 'Get user role with backward compatibility (RBAC first, then old system)';



CREATE OR REPLACE FUNCTION "public"."get_user_roles"() RETURNS TABLE("role_id" "uuid", "role_code" "text", "role_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT
    sr.role_id,
    sr.code AS role_code,
    sr.name AS role_name
  FROM org_auth_user_roles our
  JOIN sys_auth_roles sr ON sr.role_id = our.role_id
  WHERE our.user_id = auth.uid()
    AND our.tenant_org_id = current_tenant_id()
    AND our.is_active = true;
$$;


ALTER FUNCTION "public"."get_user_roles"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_roles"() IS 'Get all roles for current user in active tenant';



CREATE OR REPLACE FUNCTION "public"."get_user_tenants"() RETURNS TABLE("tenant_id" "uuid", "tenant_name" character varying, "tenant_slug" character varying, "user_role" character varying, "is_active" boolean, "last_login_at" timestamp without time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    u.role AS user_role,
    u.is_active AS is_active,
    u.last_login_at AS last_login_at
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_user_tenants"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_tenants"() IS 'Get all tenants accessible by current authenticated user';



CREATE OR REPLACE FUNCTION "public"."get_user_workflow_roles"() RETURNS TABLE("workflow_role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT
    uwr.workflow_role
  FROM org_auth_user_workflow_roles uwr
  WHERE uwr.user_id = auth.uid()
    AND uwr.tenant_org_id = current_tenant_id()
    AND uwr.is_active = true;
$$;


ALTER FUNCTION "public"."get_user_workflow_roles"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_workflow_roles"() IS 'Get all workflow roles for current user in active tenant (supports multiple workflow roles)';



CREATE OR REPLACE FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (
    SELECT COUNT(*) = array_length(p_permissions, 1)
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(perm, NULL, NULL)
  );
$$;


ALTER FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) IS 'Check if current user has all of the specified permissions';



CREATE OR REPLACE FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(perm, NULL, NULL)
  );
$$;


ALTER FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) IS 'Check if current user has any of the specified permissions';



CREATE OR REPLACE FUNCTION "public"."has_permission"("p_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT cmx_can(p_permission, NULL, NULL);
$$;


ALTER FUNCTION "public"."has_permission"("p_permission" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_permission"("p_permission" "text") IS 'Check if current user has specific permission (tenant-wide)';



CREATE OR REPLACE FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT cmx_can(p_permission, p_resource_type, p_resource_id);
$$;


ALTER FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") IS 'Check if current user has resource-scoped permission';



CREATE OR REPLACE FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = p_tenant_id
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") IS 'Check if user has access to specified tenant';



CREATE OR REPLACE FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_order_item_issues
    WHERE order_item_id = p_order_item_id
    AND solved_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") IS 'Check if an order item has unresolved issues';



CREATE OR REPLACE FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_auth_user_workflow_roles uwr
    WHERE uwr.user_id = auth.uid()
      AND uwr.tenant_org_id = current_tenant_id()
      AND uwr.workflow_role = p_workflow_role
      AND uwr.is_active = true
  );
$$;


ALTER FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") IS 'Check if current user has specific workflow role';



CREATE OR REPLACE FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_permissions JSONB;
    v_permission_item TEXT;
BEGIN
    -- Get user's role permissions
    SELECT r.permissions INTO v_permissions
    FROM hq_users u
    JOIN hq_roles r ON u.role_code = r.role_code
    WHERE u.id = p_user_id AND u.is_active = true AND r.is_active = true;

    IF v_permissions IS NULL THEN
        RETURN false;
    END IF;

    -- Check for wildcard (super admin)
    IF v_permissions ? '*' THEN
        RETURN true;
    END IF;

    -- Check for exact permission
    IF v_permissions ? p_permission THEN
        RETURN true;
    END IF;

    -- Check for wildcard permissions (e.g., "tenants.*" matches "tenants.view")
    FOR v_permission_item IN SELECT jsonb_array_elements_text(v_permissions)
    LOOP
        IF v_permission_item LIKE '%.*' THEN
            IF p_permission LIKE REPLACE(v_permission_item, '.*', '.%') THEN
                RETURN true;
            END IF;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;


ALTER FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) IS 'Check if HQ user has a specific permission based on their role';



CREATE OR REPLACE FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text" DEFAULT NULL::"text", "p_admin_password" "text" DEFAULT 'Admin123'::"text", "p_admin_display_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tenant RECORD;
  v_subscription_id UUID;
  v_branch_id UUID;
  v_admin_user_id UUID;
  v_service_count INTEGER := 0;
  v_workflow_default_id UUID;
  v_workflow_ironing_id UUID;
  v_category_workflow_count INTEGER := 0;
  v_result JSONB;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Validate tenant exists
  SELECT * INTO v_tenant
  FROM org_tenants_mst
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  RAISE NOTICE E'\n🚀 Initializing tenant: % (%)', v_tenant.name, p_tenant_id;

  -- ==============================================================
  -- 1. CREATE SUBSCRIPTION (Free Plan, 14-day Trial)
  -- ==============================================================
  BEGIN
    INSERT INTO org_subscriptions_mst (
      id,
      tenant_org_id,
      plan,
      status,
      orders_limit,
      orders_used,
      branch_limit,
      user_limit,
      start_date,
      end_date,
      trial_ends,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      p_tenant_id,
      'free',
      'trial',
      50,
      0,
      1,
      2,
      NOW(),
      NOW() + INTERVAL '14 days',
      NOW() + INTERVAL '14 days',
      NOW()
    )
    RETURNING id INTO v_subscription_id;

    RAISE NOTICE '  ✅ Subscription created (ID: %, Plan: free, Trial: 14 days)', v_subscription_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_subscription_id
    FROM org_subscriptions_mst
    WHERE tenant_org_id = p_tenant_id
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Subscription already exists (ID: %)', v_subscription_id;
    v_errors := array_append(v_errors, 'subscription_exists');
  END;

  -- ==============================================================
  -- 2. CREATE MAIN BRANCH (Inherit Tenant Info)
  -- ==============================================================
  BEGIN
    INSERT INTO org_branches_mst (
      id,
      tenant_org_id,
      branch_name,
      address,
      city,
      country,
      phone,
      email,
      is_active,
      created_at,
      created_by,
      created_info
    )
    VALUES (
      gen_random_uuid(),
      p_tenant_id,
      'Main Branch',
      COALESCE(v_tenant.address, ''),
      COALESCE(v_tenant.city, ''),
      COALESCE(v_tenant.country, 'OM'),
      COALESCE(v_tenant.phone, ''),
      COALESCE(v_tenant.email, ''),
      true,
      NOW(),
      'system',
      'Auto-created during tenant initialization'
    )
    RETURNING id INTO v_branch_id;

    RAISE NOTICE '  ✅ Main branch created (ID: %, Name: Main Branch)', v_branch_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_branch_id
    FROM org_branches_mst
    WHERE tenant_org_id = p_tenant_id
    AND branch_name = 'Main Branch'
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Main branch already exists (ID: %)', v_branch_id;
    v_errors := array_append(v_errors, 'branch_exists');
  END;

  -- ==============================================================
  -- 3. ENABLE ALL ACTIVE SERVICE CATEGORIES
  -- ==============================================================
  BEGIN
    INSERT INTO org_service_category_cf (tenant_org_id, service_category_code)
    SELECT
      p_tenant_id,
      service_category_code
    FROM sys_service_category_cd
    WHERE is_active = true
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

    GET DIAGNOSTICS v_service_count = ROW_COUNT;

    RAISE NOTICE '  ✅ Service categories enabled (Count: %)', v_service_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error enabling service categories: %', SQLERRM;
    v_errors := array_append(v_errors, 'service_category_error');
  END;

  -- ==============================================================
  -- 4. CREATE DEFAULT WORKFLOW CONFIGURATIONS
  -- ==============================================================
  BEGIN
    -- Default workflow (all orders)
    INSERT INTO org_workflow_settings_cf (
      tenant_org_id,
      service_category_code,
      workflow_steps,
      status_transitions,
      quality_gate_rules,
      is_active
    )
    VALUES (
      p_tenant_id,
      NULL,
      '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb,
      '{
        "DRAFT": ["INTAKE", "CANCELLED"],
        "INTAKE": ["PREPARATION", "CANCELLED"],
        "PREPARATION": ["SORTING", "CANCELLED"],
        "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
        "WASHING": ["DRYING", "CANCELLED"],
        "DRYING": ["FINISHING", "CANCELLED"],
        "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
        "ASSEMBLY": ["QA", "CANCELLED"],
        "QA": ["PACKING", "WASHING", "CANCELLED"],
        "PACKING": ["READY", "CANCELLED"],
        "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
        "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
        "DELIVERED": ["CLOSED"],
        "CLOSED": [],
        "CANCELLED": []
      }'::jsonb,
      '{
        "READY": {
          "requireAllItemsAssembled": true,
          "requireQAPassed": true,
          "requireNoUnresolvedIssues": true
        }
      }'::jsonb,
      true
    )
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING
    RETURNING id INTO v_workflow_default_id;

    RAISE NOTICE '  ✅ Default workflow created (ID: %)', v_workflow_default_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error creating default workflow: %', SQLERRM;
    v_errors := array_append(v_errors, 'workflow_error');
  END;

  -- Create workflows for all enabled service categories
  BEGIN
    INSERT INTO org_workflow_settings_cf (
      tenant_org_id,
      service_category_code,
      workflow_steps,
      status_transitions,
      quality_gate_rules,
      is_active
    )
    SELECT
      p_tenant_id,
      sc.service_category_code,
      CASE
        -- IRON_ONLY and IRON: Simplified workflow (no washing/drying)
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '["DRAFT","INTAKE","FINISHING","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
        -- All other categories: Full workflow
        ELSE
          '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
      END,
      CASE
        -- IRON_ONLY and IRON: Simplified transitions
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '{
            "DRAFT": ["INTAKE", "CANCELLED"],
            "INTAKE": ["FINISHING", "CANCELLED"],
            "FINISHING": ["PACKING", "CANCELLED"],
            "PACKING": ["READY", "CANCELLED"],
            "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
            "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
            "DELIVERED": ["CLOSED"],
            "CLOSED": [],
            "CANCELLED": []
          }'::jsonb
        -- All other categories: Full transitions
        ELSE
          '{
            "DRAFT": ["INTAKE", "CANCELLED"],
            "INTAKE": ["PREPARATION", "CANCELLED"],
            "PREPARATION": ["SORTING", "CANCELLED"],
            "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
            "WASHING": ["DRYING", "CANCELLED"],
            "DRYING": ["FINISHING", "CANCELLED"],
            "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
            "ASSEMBLY": ["QA", "CANCELLED"],
            "QA": ["PACKING", "WASHING", "CANCELLED"],
            "PACKING": ["READY", "CANCELLED"],
            "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
            "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
            "DELIVERED": ["CLOSED"],
            "CLOSED": [],
            "CANCELLED": []
          }'::jsonb
      END,
      CASE
        -- IRON_ONLY and IRON: Relaxed quality gates
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '{
            "READY": {
              "requireAllItemsAssembled": false,
              "requireQAPassed": false,
              "requireNoUnresolvedIssues": true
            }
          }'::jsonb
        -- All other categories: Full quality gates
        ELSE
          '{
            "READY": {
              "requireAllItemsAssembled": true,
              "requireQAPassed": true,
              "requireNoUnresolvedIssues": true
            }
          }'::jsonb
      END,
      true
    FROM org_service_category_cf sc
    WHERE sc.tenant_org_id = p_tenant_id
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

    GET DIAGNOSTICS v_category_workflow_count = ROW_COUNT;

    RAISE NOTICE '  ✅ Category-specific workflows created (Count: %)', v_category_workflow_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error creating category workflows: %', SQLERRM;
    -- Don't fail initialization if category workflows fail
  END;

  -- ==============================================================
  -- 5. CREATE ADMIN USER (If email provided)
  -- ==============================================================
  IF p_admin_email IS NOT NULL THEN
    BEGIN
      v_admin_user_id := create_and_link_auth_user(
        p_admin_email,
        p_admin_password,
        p_tenant_id,
        COALESCE(p_admin_display_name, split_part(p_admin_email, '@', 1)),
        'admin'
      );

      RAISE NOTICE '  ✅ Admin user created (Email: %, ID: %)', p_admin_email, v_admin_user_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ⚠️  Error creating admin user: %', SQLERRM;
      RAISE NOTICE '  ℹ️  You can create admin user manually later';
      v_errors := array_append(v_errors, 'admin_user_error');
    END;
  ELSE
    RAISE NOTICE '  ⏭️  Admin user creation skipped (no email provided)';
  END IF;

  -- ==============================================================
  -- 6. LOG INITIALIZATION IN AUDIT LOG
  -- ==============================================================
  BEGIN
    PERFORM log_audit_event(
      NULL,
      p_tenant_id,
      'tenant_initialized',
      'tenant',
      p_tenant_id,
      NULL,
      jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', v_tenant.name,
        'subscription_id', v_subscription_id,
        'branch_id', v_branch_id,
        'admin_user_id', v_admin_user_id,
        'service_categories_count', v_service_count,
        'workflow_configs_created', 1 + v_category_workflow_count
      ),
      NULL,
      NULL,
      NULL,
      'success',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error logging to audit: %', SQLERRM;
  END;

  -- ==============================================================
  -- 7. BUILD RESULT OBJECT
  -- ==============================================================
  v_result := jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'tenant_name', v_tenant.name,
    'resources_created', jsonb_build_object(
      'subscription_id', v_subscription_id,
      'branch_id', v_branch_id,
      'admin_user_id', v_admin_user_id,
      'service_categories_count', v_service_count,
      'workflow_configs', jsonb_build_object(
        'default_id', v_workflow_default_id,
        'category_specific_count', v_category_workflow_count
      )
    ),
    'errors', v_errors,
    'initialized_at', NOW()
  );

  RAISE NOTICE E'  \n✅ Tenant initialization complete!';
  RAISE NOTICE '  Results: %', v_result::TEXT;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Tenant initialization failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'tenant_id', p_tenant_id,
    'error', SQLERRM,
    'failed_at', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text", "p_admin_password" "text", "p_admin_display_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text", "p_admin_password" "text", "p_admin_display_name" "text") IS 'Auto-initialize new tenant with subscription, branch, services, workflows, and optional admin user';



CREATE OR REPLACE FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean DEFAULT false, "p_include_cost" boolean DEFAULT false, "p_create_default_price_list" boolean DEFAULT false, "p_seed_filter" character varying DEFAULT 'standard'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_products_created INTEGER := 0;
  v_price_list_id UUID;
  v_result JSONB;
BEGIN
  -- Copy templates to tenant products
  INSERT INTO org_product_data_mst (
    id,
    tenant_org_id,
    service_category_code,
    item_type_code,
    product_code,
    product_name,
    product_name2,
    hint_text,
    is_retail_item,
    product_type,
    price_type,
    product_unit,
    default_sell_price,
    default_express_sell_price,
    product_cost,
    min_sell_price,
    min_quantity,
    pieces_per_product,
    extra_days,
    turnaround_hh,
    turnaround_hh_express,
    multiplier_express,
    product_order,
    tags,
    id_sku,
    is_active,
    product_color1,
    product_color2,
    product_color3,
    product_icon,
    product_image,
    product_group1,
    product_group2,
    product_group3,
    rec_order,
    created_by,
    rec_status
  )
  SELECT
    gen_random_uuid(),
    p_tenant_org_id,
    service_category_code,
    item_type_code,
    template_code,  -- Use template_code as product_code
    name,
    name2,
    hint_text,
    is_retail_item,
    1,  -- Default product_type
    price_type,
    product_unit,
    CASE WHEN p_include_pricing THEN default_sell_price ELSE NULL END,
    CASE WHEN p_include_pricing THEN default_express_sell_price ELSE NULL END,
    CASE WHEN p_include_cost THEN product_cost ELSE NULL END,
    CASE WHEN p_include_pricing THEN min_sell_price ELSE NULL END,
    min_quantity,
    pieces_per_product,
    extra_days,
    turnaround_hh,
    turnaround_hh_express,
    multiplier_express,
    rec_order,
    tags,
    id_sku,
    true,  -- is_active
    product_color1,
    product_color2,
    product_color3,
    product_icon,
    product_image,
    item_type_code,  -- Map to product_group1 for backward compatibility
    NULL,
    NULL,
    seed_priority,
    'system_seed',
    1
  FROM sys_service_prod_templates_cd
  WHERE is_to_seed = true
    AND is_active = true
    AND (
      p_seed_filter = 'all'
      OR (
        seed_options IS NULL
        OR seed_options->>'required_for' IS NULL
        OR seed_options->>'required_for' ? p_seed_filter
      )
    )
  ORDER BY seed_priority ASC;

  GET DIAGNOSTICS v_products_created = ROW_COUNT;

  -- Optionally create default price list
  IF p_create_default_price_list AND p_include_pricing THEN
    INSERT INTO org_price_lists_mst (
      tenant_org_id,
      name,
      name2,
      description,
      price_list_type,
      is_default,
      is_active,
      created_by
    ) VALUES (
      p_tenant_org_id,
      'Standard Price List',
      'قائمة الأسعار القياسية',
      'Default price list created during tenant initialization',
      'standard',
      true,
      true,
      'system_seed'
    )
    RETURNING id INTO v_price_list_id;

    -- Copy prices from products to price list
    INSERT INTO org_price_list_items_dtl (
      tenant_org_id,
      price_list_id,
      product_id,
      price,
      is_active,
      created_by
    )
    SELECT
      p_tenant_org_id,
      v_price_list_id,
      p.id,
      p.default_sell_price,
      true,
      'system_seed'
    FROM org_product_data_mst p
    WHERE p.tenant_org_id = p_tenant_org_id
      AND p.default_sell_price IS NOT NULL
      AND p.is_active = true;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'products_created', v_products_created,
    'price_list_created', p_create_default_price_list,
    'price_list_id', v_price_list_id,
    'tenant_org_id', p_tenant_org_id,
    'seed_filter', p_seed_filter,
    'include_pricing', p_include_pricing
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_include_cost" boolean, "p_create_default_price_list" boolean, "p_seed_filter" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_include_cost" boolean, "p_create_default_price_list" boolean, "p_seed_filter" character varying) IS 'Initialize tenant product catalog from templates with configurable options';



CREATE OR REPLACE FUNCTION "public"."is_account_locked"("p_email" character varying) RETURNS TABLE("is_locked" boolean, "locked_until" timestamp without time zone, "lock_reason" character varying, "user_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_record RECORD;
BEGIN
  -- Get user from auth.users and check lock status in org_users_mst
  SELECT
    au.id,
    ou.locked_until,
    ou.lock_reason
  INTO v_user_record
  FROM auth.users au
  LEFT JOIN org_users_mst ou ON au.id = ou.user_id
  WHERE au.email = p_email
  LIMIT 1;

  IF NOT FOUND THEN
    -- User doesn't exist
    RETURN QUERY SELECT false, NULL::TIMESTAMP, NULL::VARCHAR, NULL::UUID;
    RETURN;
  END IF;

  -- Check if locked and lock hasn't expired
  IF v_user_record.locked_until IS NOT NULL
     AND v_user_record.locked_until > NOW() THEN
    RETURN QUERY SELECT
      true,
      v_user_record.locked_until,
      v_user_record.lock_reason,
      v_user_record.id;
  ELSE
    -- Not locked or lock has expired
    RETURN QUERY SELECT
      false,
      NULL::TIMESTAMP,
      NULL::VARCHAR,
      v_user_record.id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."is_account_locked"("p_email" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_account_locked"("p_email" character varying) IS 'Check if account is currently locked based on email';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Check if current user has admin role in active tenant';



CREATE OR REPLACE FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_expected_steps INTEGER := 5;
  v_completed_steps INTEGER;
BEGIN
  SELECT COUNT(DISTINCT step_code) INTO v_completed_steps
  FROM org_order_item_processing_steps
  WHERE order_item_id = p_order_item_id;

  RETURN v_completed_steps >= v_expected_steps;
END;
$$;


ALTER FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") IS 'Check if all 5 processing steps are completed for an order item';



CREATE OR REPLACE FUNCTION "public"."is_operator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role IN ('admin', 'operator')
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_operator"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_operator"() IS 'Check if current user has operator or admin role';



CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying DEFAULT NULL::character varying, "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_old_values" "jsonb" DEFAULT NULL::"jsonb", "p_new_values" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text", "p_request_id" character varying DEFAULT NULL::character varying, "p_status" character varying DEFAULT 'success'::character varying, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO sys_audit_log (
    user_id,
    tenant_org_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    request_id,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_tenant_org_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    p_request_id,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" character varying, "p_status" character varying, "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" character varying, "p_status" character varying, "p_error_message" "text") IS 'Helper function to log audit events consistently';



CREATE OR REPLACE FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text" DEFAULT NULL::"text", "p_ip_address" character varying DEFAULT NULL::character varying, "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_log_id UUID;
  v_changed_fields TEXT[];
BEGIN
  -- Calculate changed fields for UPDATE actions
  IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT ARRAY_AGG(key)
    INTO v_changed_fields
    FROM jsonb_each(p_new_values)
    WHERE p_old_values->>key IS DISTINCT FROM p_new_values->>key;
  END IF;

  -- Insert audit log entry
  INSERT INTO sys_code_table_audit_log (
    table_name,
    record_code,
    action,
    old_values,
    new_values,
    changed_fields,
    changed_by,
    changed_at,
    change_reason,
    ip_address,
    user_agent
  ) VALUES (
    p_table_name,
    p_record_code,
    p_action,
    p_old_values,
    p_new_values,
    v_changed_fields,
    p_changed_by,
    CURRENT_TIMESTAMP,
    p_change_reason,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text", "p_ip_address" character varying, "p_user_agent" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text", "p_ip_address" character varying, "p_user_agent" "text") IS 'Logs a change to a code table with full audit trail information';



CREATE OR REPLACE FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text" DEFAULT NULL::"text", "p_to_value" "text" DEFAULT NULL::"text", "p_done_by" "uuid" DEFAULT NULL::"uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO org_order_history (
    tenant_org_id,
    order_id,
    action_type,
    from_value,
    to_value,
    payload,
    done_by,
    done_at
  )
  VALUES (
    p_tenant_org_id,
    p_order_id,
    p_action_type,
    p_from_value,
    p_to_value,
    p_payload,
    p_done_by,
    now()
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;


ALTER FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text", "p_to_value" "text", "p_done_by" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text", "p_to_value" "text", "p_done_by" "uuid", "p_payload" "jsonb") IS 'Log an action to order history';



CREATE OR REPLACE FUNCTION "public"."migrate_users_to_rbac"() RETURNS TABLE("user_id" "uuid", "tenant_org_id" "uuid", "old_role" "text", "new_role_code" "text", "migrated" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
  role_id_var UUID;
  migration_count INTEGER := 0;
BEGIN
  -- Loop through all users in org_users_mst
  FOR user_record IN
    SELECT DISTINCT
      oum.user_id,
      oum.tenant_org_id,
      oum.role AS old_role
    FROM org_users_mst oum
    WHERE oum.is_active = true
      AND oum.role IN ('admin', 'operator', 'viewer')
      -- Only migrate users that don't already have RBAC roles
      AND NOT EXISTS (
        SELECT 1
        FROM org_auth_user_roles oaur
        WHERE oaur.user_id = oum.user_id
          AND oaur.tenant_org_id = oum.tenant_org_id
      )
  LOOP
    -- Map old role to new role code
    -- admin -> tenant_admin
    -- operator -> operator
    -- viewer -> viewer
    CASE user_record.old_role
      WHEN 'admin' THEN
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'tenant_admin';
      WHEN 'operator' THEN
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'operator';
      WHEN 'viewer' THEN
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'viewer';
      ELSE
        -- Skip unknown roles
        CONTINUE;
    END CASE;

    -- Insert into org_auth_user_roles
    -- Use explicit column references to avoid ambiguity
    INSERT INTO org_auth_user_roles (
      user_id,
      tenant_org_id,
      role_id,
      is_active,
      created_by
    )
    SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      role_id_var,
      true,
      'system_migration'
    WHERE NOT EXISTS (
      SELECT 1
      FROM org_auth_user_roles oaur
      WHERE oaur.user_id = user_record.user_id
        AND oaur.tenant_org_id = user_record.tenant_org_id
        AND oaur.role_id = role_id_var
    );

    -- Rebuild effective permissions for this user
    PERFORM cmx_rebuild_user_permissions(user_record.user_id, user_record.tenant_org_id);

    migration_count := migration_count + 1;

    -- Return migration result
    RETURN QUERY SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      user_record.old_role::TEXT,
      (CASE user_record.old_role
        WHEN 'admin' THEN 'tenant_admin'
        WHEN 'operator' THEN 'operator'
        WHEN 'viewer' THEN 'viewer'
        ELSE user_record.old_role::TEXT
      END)::TEXT,
      true;
  END LOOP;

  RAISE NOTICE 'Migrated % users to RBAC system', migration_count;
END;
$$;


ALTER FUNCTION "public"."migrate_users_to_rbac"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_users_to_rbac"() IS 'Migrate existing users from org_users_mst.role to org_auth_user_roles';



CREATE OR REPLACE FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer DEFAULT 100) RETURNS TABLE("batch_number" integer, "users_migrated" integer, "total_remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  batch_num INTEGER := 1;
  migrated_count INTEGER;
  remaining_count INTEGER;
BEGIN
  LOOP
    -- Migrate one batch
    SELECT COUNT(*) INTO migrated_count
    FROM migrate_users_to_rbac();

    -- Check remaining users
    SELECT COUNT(*) INTO remaining_count
    FROM check_rbac_migration_status()
    WHERE has_rbac_role = false;

    -- Return batch result
    RETURN QUERY SELECT batch_num, migrated_count, remaining_count;

    -- Exit if no more users to migrate
    EXIT WHEN migrated_count = 0 OR remaining_count = 0;

    batch_num := batch_num + 1;

    -- Safety check: prevent infinite loops
    EXIT WHEN batch_num > 1000;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer) IS 'Migrate users to RBAC in batches';



CREATE OR REPLACE FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_order_history
    WHERE order_id = p_order_id 
    AND action_type = p_action_type
  );
END;
$$;


ALTER FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") IS 'Check if order has a specific action type';



CREATE OR REPLACE FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text", "p_error_message" "text" DEFAULT NULL::"text") RETURNS TABLE("log_id" "uuid", "is_locked" boolean, "locked_until" timestamp without time zone, "lock_reason" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
  v_failed_attempts INTEGER;
  v_lock_until TIMESTAMP;
  v_lock_reason VARCHAR;
  v_is_locked BOOLEAN := false;

  -- Configuration constants
  c_max_failed_attempts CONSTANT INTEGER := 5;
  c_lockout_duration CONSTANT INTERVAL := INTERVAL '15 minutes';
  c_reset_window CONSTANT INTERVAL := INTERVAL '1 hour';
BEGIN
  -- Try to find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- Log the attempt in audit log
  SELECT log_audit_event(
    v_user_id,
    NULL, -- No tenant context yet
    CASE WHEN p_success THEN 'login_success' ELSE 'login_failure' END,
    'user',
    v_user_id,
    NULL,
    jsonb_build_object('email', p_email, 'timestamp', NOW()),
    p_ip_address,
    p_user_agent,
    NULL,
    CASE WHEN p_success THEN 'success' ELSE 'failure' END,
    p_error_message
  ) INTO v_log_id;

  -- If user exists, update login tracking
  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      -- Successful login - reset failed attempts
      UPDATE org_users_mst
      SET
        failed_login_attempts = 0,
        last_failed_login_at = NULL,
        locked_until = NULL,
        lock_reason = NULL,
        last_login_at = NOW(),
        login_count = COALESCE(login_count, 0) + 1,
        updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      -- Failed login - increment counter
      UPDATE org_users_mst
      SET
        failed_login_attempts = CASE
          -- Reset counter if last failure was more than 1 hour ago
          WHEN last_failed_login_at IS NULL
               OR last_failed_login_at < NOW() - c_reset_window
          THEN 1
          ELSE failed_login_attempts + 1
        END,
        last_failed_login_at = NOW(),
        updated_at = NOW()
      WHERE user_id = v_user_id
      RETURNING failed_login_attempts INTO v_failed_attempts;

      -- Check if we should lock the account
      IF v_failed_attempts >= c_max_failed_attempts THEN
        v_lock_until := NOW() + c_lockout_duration;
        v_lock_reason := format('Account locked due to %s failed login attempts', c_max_failed_attempts);
        v_is_locked := true;

        -- Lock the account
        UPDATE org_users_mst
        SET
          locked_until = v_lock_until,
          lock_reason = v_lock_reason,
          updated_at = NOW()
        WHERE user_id = v_user_id;

        -- Log the lockout event
        PERFORM log_audit_event(
          v_user_id,
          NULL,
          'account_locked',
          'user',
          v_user_id,
          NULL,
          jsonb_build_object(
            'locked_until', v_lock_until,
            'reason', v_lock_reason,
            'failed_attempts', v_failed_attempts
          ),
          p_ip_address,
          p_user_agent,
          NULL,
          'success',
          NULL
        );
      END IF;
    END IF;
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_log_id,
    v_is_locked,
    v_lock_until,
    v_lock_reason;
END;
$$;


ALTER FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet", "p_user_agent" "text", "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet", "p_user_agent" "text", "p_error_message" "text") IS 'Record login attempt and handle account lockout logic';



CREATE OR REPLACE FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean DEFAULT false, "p_only_missing" boolean DEFAULT true, "p_template_codes" character varying[] DEFAULT NULL::character varying[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_products_added INTEGER := 0;
  v_templates_found INTEGER := 0;
  v_already_exists INTEGER := 0;
  v_result JSONB;
  v_template RECORD;
BEGIN
  -- Get count of templates to process
  SELECT COUNT(*) INTO v_templates_found
  FROM sys_service_prod_templates_cd
  WHERE is_to_seed = true
    AND is_active = true
    AND (p_template_codes IS NULL OR template_code = ANY(p_template_codes));

  -- Process each template
  FOR v_template IN
    SELECT *
    FROM sys_service_prod_templates_cd
    WHERE is_to_seed = true
      AND is_active = true
      AND (p_template_codes IS NULL OR template_code = ANY(p_template_codes))
    ORDER BY seed_priority ASC
  LOOP
    -- Check if product already exists for this tenant
    IF EXISTS (
      SELECT 1 FROM org_product_data_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND product_code = v_template.template_code
        AND (p_only_missing = false OR is_active = true)  -- Skip if only_missing and exists
    ) THEN
      v_already_exists := v_already_exists + 1;
      CONTINUE;  -- Skip this template
    END IF;

    -- Insert missing product
    INSERT INTO org_product_data_mst (
      id,
      tenant_org_id,
      service_category_code,
      item_type_code,
      product_code,
      product_name,
      product_name2,
      hint_text,
      is_retail_item,
      product_type,
      price_type,
      product_unit,
      default_sell_price,
      default_express_sell_price,
      product_cost,
      min_sell_price,
      min_quantity,
      pieces_per_product,
      extra_days,
      turnaround_hh,
      turnaround_hh_express,
      multiplier_express,
      product_order,
      tags,
      id_sku,
      is_active,
      product_color1,
      product_color2,
      product_color3,
      product_icon,
      product_image,
      product_group1,
      rec_order,
      created_by,
      rec_status
    ) VALUES (
      gen_random_uuid(),
      p_tenant_org_id,
      v_template.service_category_code,
      v_template.item_type_code,
      v_template.template_code,
      v_template.name,
      v_template.name2,
      v_template.hint_text,
      v_template.is_retail_item,
      1,
      v_template.price_type,
      v_template.product_unit,
      CASE WHEN p_include_pricing THEN v_template.default_sell_price ELSE NULL END,
      CASE WHEN p_include_pricing THEN v_template.default_express_sell_price ELSE NULL END,
      NULL,  -- Don't include cost on reseed
      CASE WHEN p_include_pricing THEN v_template.min_sell_price ELSE NULL END,
      v_template.min_quantity,
      v_template.pieces_per_product,
      v_template.extra_days,
      v_template.turnaround_hh,
      v_template.turnaround_hh_express,
      v_template.multiplier_express,
      v_template.rec_order,
      v_template.tags,
      v_template.id_sku,
      true,
      v_template.product_color1,
      v_template.product_color2,
      v_template.product_color3,
      v_template.product_icon,
      v_template.product_image,
      v_template.item_type_code,
      v_template.seed_priority,
      'system_reseed',
      1
    );

    v_products_added := v_products_added + 1;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'templates_found', v_templates_found,
    'products_added', v_products_added,
    'already_exists', v_already_exists,
    'tenant_org_id', p_tenant_org_id
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_only_missing" boolean, "p_template_codes" character varying[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_only_missing" boolean, "p_template_codes" character varying[]) IS 'Restore missing or deleted products from templates for a specific tenant';



CREATE OR REPLACE FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") RETURNS TABLE("tenant_id" "uuid", "tenant_name" character varying, "tenant_slug" character varying, "user_role" character varying, "success" boolean, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_has_access BOOLEAN;
  v_user_record RECORD;
BEGIN
  -- Check if user has access to this tenant
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = p_tenant_id
      AND is_active = true
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN QUERY
    SELECT
      NULL::UUID,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      false,
      'Access denied: User does not have access to this tenant'::TEXT;
    RETURN;
  END IF;

  -- Update last login and increment login count
  UPDATE org_users_mst
  SET
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1,
    updated_at = NOW()
  WHERE user_id = auth.uid()
    AND tenant_org_id = p_tenant_id
  RETURNING * INTO v_user_record;

  -- Log the tenant switch
  PERFORM log_audit_event(
    auth.uid(),
    p_tenant_id,
    'tenant_switch',
    'tenant',
    p_tenant_id,
    NULL,
    jsonb_build_object('tenant_id', p_tenant_id, 'timestamp', NOW()),
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );

  -- Return tenant info
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    v_user_record.role AS user_role,
    true AS success,
    'Tenant context switched successfully'::TEXT AS message
  FROM org_tenants_mst t
  WHERE t.id = p_tenant_id;
END;
$$;


ALTER FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") IS 'Switch active tenant context and update last login timestamp';



CREATE OR REPLACE FUNCTION "public"."sys_bill_generate_invoice_number"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INTEGER;
  invoice_num VARCHAR;
BEGIN
  next_num := nextval('seq_invoice_number');
  invoice_num := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$;


ALTER FUNCTION "public"."sys_bill_generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sys_bill_get_default_payment_method"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN 'cash'; -- Cash is the primary/default payment method
END;
$$;


ALTER FUNCTION "public"."sys_bill_get_default_payment_method"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sys_bill_update_invoice_amount_due"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.amount_due = NEW.total - NEW.amount_paid;

  -- Update status based on amount_due
  IF NEW.amount_due <= 0 THEN
    NEW.status = 'paid';
    NEW.paid_at = CURRENT_TIMESTAMP;
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_due > 0 THEN
    NEW.status = 'overdue';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sys_bill_update_invoice_amount_due"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_after_item_change_recalc"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tenant uuid;
  v_order uuid;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_tenant := NEW.tenant_org_id;
    v_order  := NEW.order_id;
  ELSE
    v_tenant := OLD.tenant_org_id;
    v_order  := OLD.order_id;
  END IF;

  PERFORM fn_recalc_order_totals(v_tenant, v_order);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_after_item_change_recalc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_initialize_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result JSONB;
  v_skip_demo BOOLEAN := false;
BEGIN
  -- Skip auto-initialization for known demo/test tenants
  -- These are seeded manually with specific configurations
  IF NEW.id IN (
    '11111111-1111-1111-1111-111111111111',  -- Demo tenant
    '22222222-2222-2222-2222-222222222222'   -- Test tenant 2
  ) THEN
    RAISE NOTICE 'Skipping auto-initialization for demo/test tenant: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Auto-initialize the tenant
  RAISE NOTICE 'Auto-initializing new tenant: % (%)', NEW.name, NEW.id;

  BEGIN
    v_result := initialize_new_tenant(
      NEW.id,
      NULL,  -- No admin user by default (create separately)
      NULL,
      NULL
    );

    -- Check if initialization was successful
    IF (v_result->>'success')::BOOLEAN THEN
      RAISE NOTICE 'Auto-initialization successful for tenant: %', NEW.id;
    ELSE
      RAISE WARNING 'Auto-initialization had errors for tenant: %', NEW.id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Don't fail the INSERT if auto-initialization fails
    -- Just log the error
    RAISE WARNING 'Auto-initialization failed for tenant %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_auto_initialize_tenant"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trg_auto_initialize_tenant"() IS 'Trigger function to auto-initialize tenants on creation';



CREATE OR REPLACE FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_order_item_srno"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.order_item_srno IS NULL OR NEW.order_item_srno = '' THEN
    NEW.order_item_srno := fn_next_order_item_srno(NEW.tenant_org_id, NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_order_item_srno"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text" DEFAULT 'Manual unlock by administrator'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin has permission (must be admin in same tenant)
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = p_admin_user_id
      AND role = 'admin'
      AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can unlock accounts';
  END IF;

  -- Unlock the account
  UPDATE org_users_mst
  SET
    locked_until = NULL,
    lock_reason = NULL,
    failed_login_attempts = 0,
    last_failed_login_at = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the unlock event
  PERFORM log_audit_event(
    p_admin_user_id,
    NULL,
    'account_unlocked',
    'user',
    p_user_id,
    NULL,
    jsonb_build_object(
      'unlocked_by', p_admin_user_id,
      'reason', p_reason
    ),
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") IS 'Manually unlock a locked account (admin only)';



CREATE OR REPLACE FUNCTION "public"."update_customer_address_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_address_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lifecycle_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lifecycle_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_last_login"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This trigger will be called from application code via function call
  -- when user successfully authenticates
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_last_login"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."org_users_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "display_name" character varying(255),
    "role" character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_login_at" timestamp without time zone,
    "login_count" integer DEFAULT 0,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_notes" character varying(200),
    "failed_login_attempts" integer DEFAULT 0,
    "last_failed_login_at" timestamp without time zone,
    "locked_until" timestamp without time zone,
    "lock_reason" character varying(200),
    "main_branch_id" "uuid",
    "name" "text",
    "name2" "text",
    "first_name" "text",
    "last_name" "text",
    "password_hash" "text",
    "phone" character varying(50),
    "email" character varying(255),
    "type" character varying(120) DEFAULT 'employee'::character varying,
    "address" "text",
    "area" "text",
    "building" "text",
    "floor" "text",
    "is_user" boolean DEFAULT true NOT NULL,
    CONSTRAINT "org_users_mst_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'viewer'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_users_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_users_mst" IS 'Links Supabase auth users to tenants with role-based access control';



COMMENT ON COLUMN "public"."org_users_mst"."user_id" IS 'Reference to auth.users (Supabase managed)';



COMMENT ON COLUMN "public"."org_users_mst"."tenant_org_id" IS 'Reference to tenant organization';



COMMENT ON COLUMN "public"."org_users_mst"."role" IS 'User role within tenant: admin, operator, viewer';



COMMENT ON COLUMN "public"."org_users_mst"."preferences" IS 'User preferences (theme, locale, notifications, etc.)';



COMMENT ON COLUMN "public"."org_users_mst"."failed_login_attempts" IS 'Number of consecutive failed login attempts';



COMMENT ON COLUMN "public"."org_users_mst"."last_failed_login_at" IS 'Timestamp of most recent failed login';



COMMENT ON COLUMN "public"."org_users_mst"."locked_until" IS 'Account locked until this timestamp (NULL if not locked)';



COMMENT ON COLUMN "public"."org_users_mst"."lock_reason" IS 'Reason for account lock (e.g., "Too many failed login attempts")';



CREATE OR REPLACE VIEW "public"."admin_locked_accounts" AS
 SELECT "au"."id" AS "user_id",
    "au"."email",
    "ou"."display_name",
    "ou"."tenant_org_id",
    "ou"."failed_login_attempts",
    "ou"."last_failed_login_at",
    "ou"."locked_until",
    "ou"."lock_reason",
    "ou"."updated_at",
    (EXTRACT(epoch FROM (("ou"."locked_until")::timestamp with time zone - "now"())) / (60)::numeric) AS "minutes_remaining"
   FROM ("auth"."users" "au"
     JOIN "public"."org_users_mst" "ou" ON (("au"."id" = "ou"."user_id")))
  WHERE (("ou"."locked_until" IS NOT NULL) AND ("ou"."locked_until" > "now"()))
  ORDER BY "ou"."locked_until" DESC;


ALTER VIEW "public"."admin_locked_accounts" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_locked_accounts" IS 'View of currently locked accounts for admin monitoring';



CREATE TABLE IF NOT EXISTS "public"."cmx_effective_permissions" (
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "permission_code" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "allow" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cmx_effective_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."cmx_effective_permissions" IS 'Precomputed effective permissions for fast RLS checks (O(1) lookup)';



COMMENT ON COLUMN "public"."cmx_effective_permissions"."permission_code" IS 'Permission code from sys_auth_permissions.code';



COMMENT ON COLUMN "public"."cmx_effective_permissions"."resource_type" IS 'NULL for tenant-wide permissions, or resource type for scoped permissions';



COMMENT ON COLUMN "public"."cmx_effective_permissions"."resource_id" IS 'NULL for tenant-wide permissions, or UUID of resource';



COMMENT ON COLUMN "public"."cmx_effective_permissions"."allow" IS 'Final computed permission result (true = allowed, false = denied)';



CREATE TABLE IF NOT EXISTS "public"."hq_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" character varying(255),
    "action" character varying(100) NOT NULL,
    "resource_type" character varying(50),
    "resource_id" character varying(255),
    "details" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hq_audit_logs_action_not_empty" CHECK ((("action")::"text" <> ''::"text"))
);


ALTER TABLE "public"."hq_audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."hq_audit_logs" IS 'Platform HQ Console - Immutable audit trail of all administrative actions';



COMMENT ON COLUMN "public"."hq_audit_logs"."user_email" IS 'Denormalized email for audit trail even if user is deleted';



COMMENT ON COLUMN "public"."hq_audit_logs"."details" IS 'JSONB with before/after values, request data, etc.';



COMMENT ON COLUMN "public"."hq_audit_logs"."success" IS 'Whether the action completed successfully';



CREATE TABLE IF NOT EXISTS "public"."hq_roles" (
    "role_code" character varying(50) NOT NULL,
    "role_name" character varying(250) NOT NULL,
    "role_name_ar" character varying(250),
    "role_description" "text",
    "role_description_ar" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_system_role" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."hq_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."hq_roles" IS 'Platform HQ Console - Role definitions with permissions';



COMMENT ON COLUMN "public"."hq_roles"."permissions" IS 'JSONB array of permission strings, e.g., ["tenants.*", "plans.view"]';



COMMENT ON COLUMN "public"."hq_roles"."is_system_role" IS 'System roles cannot be deleted or modified';



CREATE TABLE IF NOT EXISTS "public"."hq_session_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_hash" character varying(255) NOT NULL,
    "refresh_token_hash" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hq_session_tokens_expires_future" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."hq_session_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."hq_session_tokens" IS 'Platform HQ Console - JWT session management and refresh tokens';



COMMENT ON COLUMN "public"."hq_session_tokens"."token_hash" IS 'SHA256 hash of the JWT token for revocation';



CREATE TABLE IF NOT EXISTS "public"."hq_tenant_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_status" character varying(50),
    "to_status" character varying(50) NOT NULL,
    "lifecycle_stage_from" character varying(50),
    "lifecycle_stage_to" character varying(50),
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "reason" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."hq_tenant_status_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."hq_tenant_status_history" IS 'Audit trail for tenant status and lifecycle transitions';



CREATE TABLE IF NOT EXISTS "public"."hq_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "full_name_ar" character varying(255),
    "password_hash" character varying(255) NOT NULL,
    "role_code" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_email_verified" boolean DEFAULT false,
    "mfa_enabled" boolean DEFAULT false,
    "mfa_secret" "text",
    "last_login_at" timestamp with time zone,
    "last_login_ip" "inet",
    "password_changed_at" timestamp with time zone DEFAULT "now"(),
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "hq_users_email_format" CHECK ((("email")::"text" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))
);


ALTER TABLE "public"."hq_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."hq_users" IS 'Platform HQ Console - Admin users with separate authentication from tenant users';



COMMENT ON COLUMN "public"."hq_users"."password_hash" IS 'Bcrypt hashed password';



COMMENT ON COLUMN "public"."hq_users"."mfa_secret" IS 'TOTP secret for 2FA (encrypted)';



COMMENT ON COLUMN "public"."hq_users"."failed_login_attempts" IS 'Counter for failed login attempts, reset on successful login';



COMMENT ON COLUMN "public"."hq_users"."locked_until" IS 'Account locked until this timestamp after multiple failed logins';



CREATE TABLE IF NOT EXISTS "public"."org_auth_user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "allow" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" character varying(120),
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120)
);


ALTER TABLE "public"."org_auth_user_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_auth_user_permissions" IS 'Global user permission overrides (tenant-wide, overrides role defaults)';



COMMENT ON COLUMN "public"."org_auth_user_permissions"."allow" IS 'true = allow override, false = explicit deny override';



CREATE TABLE IF NOT EXISTS "public"."org_auth_user_resource_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "allow" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" character varying(120),
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    CONSTRAINT "org_auth_user_resource_permissions_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['branch'::"text", 'store'::"text", 'pos'::"text", 'route'::"text", 'device'::"text"])))
);


ALTER TABLE "public"."org_auth_user_resource_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_auth_user_resource_permissions" IS 'Resource-scoped user permission overrides (most specific, wins)';



COMMENT ON COLUMN "public"."org_auth_user_resource_permissions"."allow" IS 'true = allow override, false = explicit deny override';



CREATE TABLE IF NOT EXISTS "public"."org_auth_user_resource_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" character varying(120),
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    CONSTRAINT "org_auth_user_resource_roles_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['branch'::"text", 'store'::"text", 'pos'::"text", 'route'::"text", 'device'::"text"])))
);


ALTER TABLE "public"."org_auth_user_resource_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_auth_user_resource_roles" IS 'User role assignments on specific resources (branch/store/POS/route/device)';



COMMENT ON COLUMN "public"."org_auth_user_resource_roles"."resource_type" IS 'Type of resource: branch, store, pos, route, device';



COMMENT ON COLUMN "public"."org_auth_user_resource_roles"."resource_id" IS 'UUID of the resource (e.g., branch_id from org_branches_mst)';



CREATE TABLE IF NOT EXISTS "public"."org_auth_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" character varying(120),
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120)
);


ALTER TABLE "public"."org_auth_user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_auth_user_roles" IS 'User role assignments at tenant level (supports multiple roles per user)';



COMMENT ON COLUMN "public"."org_auth_user_roles"."role_id" IS 'Reference to sys_auth_roles - user can have multiple roles';



CREATE TABLE IF NOT EXISTS "public"."org_auth_user_workflow_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "workflow_role" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" character varying(120),
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    CONSTRAINT "org_auth_user_workflow_roles_workflow_role_check" CHECK (("workflow_role" = ANY (ARRAY['ROLE_RECEPTION'::"text", 'ROLE_PREPARATION'::"text", 'ROLE_PROCESSING'::"text", 'ROLE_QA'::"text", 'ROLE_DELIVERY'::"text", 'ROLE_ADMIN'::"text"])))
);


ALTER TABLE "public"."org_auth_user_workflow_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_auth_user_workflow_roles" IS 'Workflow role assignments (separate from user roles, supports multiple workflow roles)';



COMMENT ON COLUMN "public"."org_auth_user_workflow_roles"."workflow_role" IS 'Workflow role code (ROLE_RECEPTION, ROLE_PREPARATION, etc.)';



CREATE TABLE IF NOT EXISTS "public"."org_branches_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "branch_name" "text",
    "s_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "phone" character varying(50),
    "email" character varying(255),
    "type" character varying(20) DEFAULT 'walk_in'::character varying,
    "address" "text",
    "country" "text",
    "city" "text",
    "area" "text",
    "street" "text",
    "building" "text",
    "floor" "text",
    "latitude" double precision,
    "longitude" double precision,
    "rec_order" integer,
    "rec_status" smallint DEFAULT 1,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "name" "text",
    "name2" "text",
    "is_main" boolean DEFAULT false
);


ALTER TABLE "public"."org_branches_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_branches_mst" IS 'Tenant branch locations';



COMMENT ON COLUMN "public"."org_branches_mst"."type" IS 'Branch type (walk_in, warehouse, etc.)';



CREATE TABLE IF NOT EXISTS "public"."org_customer_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "address_type" character varying(20) DEFAULT 'home'::character varying,
    "label" character varying(100),
    "building" character varying(100),
    "floor" character varying(50),
    "apartment" character varying(50),
    "street" character varying(200),
    "area" character varying(100),
    "city" character varying(100),
    "country" character varying(2) DEFAULT 'OM'::character varying,
    "postal_code" character varying(20),
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "is_default" boolean DEFAULT false,
    "delivery_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" character varying(120),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."org_customer_addresses" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_customer_addresses" IS 'Customer addresses with multi-tenant isolation';



COMMENT ON COLUMN "public"."org_customer_addresses"."address_type" IS 'Address type: home, work, other';



COMMENT ON COLUMN "public"."org_customer_addresses"."label" IS 'User-friendly label (e.g., "Home", "Office", "Villa in Muscat")';



COMMENT ON COLUMN "public"."org_customer_addresses"."is_default" IS 'Default address for deliveries';



COMMENT ON COLUMN "public"."org_customer_addresses"."delivery_notes" IS 'Special delivery instructions';



CREATE TABLE IF NOT EXISTS "public"."org_customer_merge_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "source_customer_id" "uuid" NOT NULL,
    "target_customer_id" "uuid" NOT NULL,
    "merged_by" "uuid" NOT NULL,
    "merge_reason" "text",
    "orders_moved" integer DEFAULT 0,
    "loyalty_points_merged" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_customer_merge_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_customer_merge_log" IS 'Audit trail for customer merge operations';



COMMENT ON COLUMN "public"."org_customer_merge_log"."source_customer_id" IS 'Customer being merged (will be deactivated)';



COMMENT ON COLUMN "public"."org_customer_merge_log"."target_customer_id" IS 'Customer to merge into (receives data)';



COMMENT ON COLUMN "public"."org_customer_merge_log"."merged_by" IS 'User ID who performed the merge';



COMMENT ON COLUMN "public"."org_customer_merge_log"."orders_moved" IS 'Number of orders transferred';



COMMENT ON COLUMN "public"."org_customer_merge_log"."loyalty_points_merged" IS 'Loyalty points combined';



CREATE TABLE IF NOT EXISTS "public"."org_customers_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "name" "text",
    "name2" "text",
    "display_name" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "type" "text" DEFAULT 'walk_in'::"text",
    "address" "text",
    "area" "text",
    "building" "text",
    "floor" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "customer_source_type" "text" DEFAULT 'DIRECT'::"text" NOT NULL,
    "s_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "loyalty_points" integer DEFAULT 0,
    "rec_order" integer,
    "rec_status" smallint DEFAULT '1'::smallint,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "updated_info" "text"
);


ALTER TABLE "public"."org_customers_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_customers_mst" IS 'Junction table linking global customers to tenants';



COMMENT ON COLUMN "public"."org_customers_mst"."customer_source_type" IS 'the source type, TENANT, CUSTOMER_APP, MARKET_PLACE, DIRECT, direct is when inserted to this table not from other source';



COMMENT ON COLUMN "public"."org_customers_mst"."loyalty_points" IS 'Tenant-specific loyalty points';



CREATE TABLE IF NOT EXISTS "public"."org_discount_rules_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "rule_code" character varying(50) NOT NULL,
    "rule_name" character varying(250) NOT NULL,
    "rule_name2" character varying(250),
    "description" "text",
    "description2" "text",
    "rule_type" character varying(30) NOT NULL,
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,3) NOT NULL,
    "conditions" "jsonb" NOT NULL,
    "priority" integer DEFAULT 0,
    "can_stack_with_promo" boolean DEFAULT false,
    "can_stack_with_other_rules" boolean DEFAULT false,
    "valid_from" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "valid_to" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(1000),
    CONSTRAINT "org_discount_rules_cf_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying])::"text"[]))),
    CONSTRAINT "org_discount_rules_cf_discount_value_check" CHECK (("discount_value" > (0)::numeric)),
    CONSTRAINT "org_discount_rules_cf_rule_type_check" CHECK ((("rule_type")::"text" = ANY ((ARRAY['bulk_discount'::character varying, 'category_discount'::character varying, 'customer_tier'::character varying, 'seasonal'::character varying, 'first_order'::character varying, 'loyalty'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_discount_rules_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_discount_rules_cf" IS 'Automated discount rules and campaigns';



COMMENT ON COLUMN "public"."org_discount_rules_cf"."conditions" IS 'JSONB object with flexible rule conditions';



COMMENT ON COLUMN "public"."org_discount_rules_cf"."priority" IS 'Higher priority rules evaluated first (0 = lowest)';



CREATE TABLE IF NOT EXISTS "public"."org_gift_card_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "gift_card_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "amount" numeric(10,3) NOT NULL,
    "balance_before" numeric(10,3) NOT NULL,
    "balance_after" numeric(10,3) NOT NULL,
    "order_id" "uuid",
    "invoice_id" "uuid",
    "notes" "text",
    "transaction_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processed_by" character varying(120),
    "metadata" "jsonb",
    CONSTRAINT "org_gift_card_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['redemption'::character varying, 'refund'::character varying, 'adjustment'::character varying, 'cancellation'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_gift_card_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_gift_card_transactions" IS 'Audit trail of all gift card balance changes';



CREATE TABLE IF NOT EXISTS "public"."org_gift_cards_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "card_number" character varying(50) NOT NULL,
    "card_pin" character varying(20),
    "card_name" character varying(250),
    "card_name2" character varying(250),
    "original_amount" numeric(10,3) NOT NULL,
    "current_balance" numeric(10,3) NOT NULL,
    "issued_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiry_date" timestamp with time zone,
    "issued_to_customer_id" "uuid",
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb",
    "rec_notes" character varying(1000),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    CONSTRAINT "org_gift_cards_mst_current_balance_check" CHECK (("current_balance" >= (0)::numeric)),
    CONSTRAINT "org_gift_cards_mst_original_amount_check" CHECK (("original_amount" > (0)::numeric)),
    CONSTRAINT "org_gift_cards_mst_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'used'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_gift_cards_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_gift_cards_mst" IS 'Gift card tracking with balance management';



COMMENT ON COLUMN "public"."org_gift_cards_mst"."status" IS 'active: can be used, used: fully depleted, expired: past expiry date, cancelled: manually cancelled';



CREATE TABLE IF NOT EXISTS "public"."org_invoice_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "tenant_org_id" "uuid" NOT NULL,
    "invoice_no" "text" NOT NULL,
    "subtotal" numeric(10,3) DEFAULT 0,
    "discount" numeric(10,3) DEFAULT 0,
    "tax" numeric(10,3) DEFAULT 0,
    "total" numeric(10,3) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date",
    "payment_method" character varying(50),
    "paid_amount" numeric(10,3) DEFAULT 0,
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "metadata" "jsonb",
    "rec_notes" character varying(1000),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_invoice_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_invoice_mst" IS 'Tenant invoices';



CREATE TABLE IF NOT EXISTS "public"."org_order_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "from_value" "text",
    "to_value" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "done_by" "uuid",
    "done_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_history_action_type" CHECK (("action_type" = ANY (ARRAY['ORDER_CREATED'::"text", 'STATUS_CHANGE'::"text", 'FIELD_UPDATE'::"text", 'SPLIT'::"text", 'QA_DECISION'::"text", 'ITEM_STEP'::"text", 'ISSUE_CREATED'::"text", 'ISSUE_SOLVED'::"text"])))
);


ALTER TABLE "public"."org_order_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_order_history" IS 'Canonical audit trail for all order actions (replaces org_order_status_history)';



COMMENT ON COLUMN "public"."org_order_history"."action_type" IS 'Action type: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED';



COMMENT ON COLUMN "public"."org_order_history"."from_value" IS 'Previous value (e.g., old status, old field value)';



COMMENT ON COLUMN "public"."org_order_history"."to_value" IS 'New value (e.g., new status, new field value)';



COMMENT ON COLUMN "public"."org_order_history"."payload" IS 'Additional context (notes, metadata, user info, etc.)';



COMMENT ON COLUMN "public"."org_order_history"."done_by" IS 'User who performed the action';



COMMENT ON COLUMN "public"."org_order_history"."done_at" IS 'Timestamp when action was performed';



CREATE TABLE IF NOT EXISTS "public"."org_order_item_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "issue_code" "text" NOT NULL,
    "issue_text" "text" NOT NULL,
    "photo_url" "text",
    "priority" "text" DEFAULT 'normal'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "solved_at" timestamp with time zone,
    "solved_by" "uuid",
    "solved_notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "chk_issue_code" CHECK (("issue_code" = ANY (ARRAY['damage'::"text", 'stain'::"text", 'complaint'::"text", 'other'::"text"]))),
    CONSTRAINT "chk_issue_priority" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."org_order_item_issues" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_order_item_issues" IS 'Track issues (damage, stains, complaints) for individual order items';



COMMENT ON COLUMN "public"."org_order_item_issues"."issue_code" IS 'Issue code: damage, stain, complaint, other';



COMMENT ON COLUMN "public"."org_order_item_issues"."issue_text" IS 'Description of the issue';



COMMENT ON COLUMN "public"."org_order_item_issues"."photo_url" IS 'URL to photo evidence (stored in MinIO/S3)';



COMMENT ON COLUMN "public"."org_order_item_issues"."priority" IS 'Priority: low, normal, high, urgent';



COMMENT ON COLUMN "public"."org_order_item_issues"."created_by" IS 'User who created/identified the issue';



COMMENT ON COLUMN "public"."org_order_item_issues"."solved_at" IS 'Timestamp when issue was resolved';



COMMENT ON COLUMN "public"."org_order_item_issues"."solved_by" IS 'User who resolved the issue';



COMMENT ON COLUMN "public"."org_order_item_issues"."solved_notes" IS 'Notes about resolution';



CREATE TABLE IF NOT EXISTS "public"."org_order_item_processing_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "step_code" "text" NOT NULL,
    "step_seq" integer NOT NULL,
    "done_by" "uuid",
    "done_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "chk_step_code" CHECK (("step_code" = ANY (ARRAY['sorting'::"text", 'pretreatment'::"text", 'washing'::"text", 'drying'::"text", 'finishing'::"text"]))),
    CONSTRAINT "chk_step_seq" CHECK ((("step_seq" >= 1) AND ("step_seq" <= 5)))
);


ALTER TABLE "public"."org_order_item_processing_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_order_item_processing_steps" IS 'Track 5-step processing workflow per item';



COMMENT ON COLUMN "public"."org_order_item_processing_steps"."step_code" IS 'Step code: sorting, pretreatment, washing, drying, finishing';



COMMENT ON COLUMN "public"."org_order_item_processing_steps"."step_seq" IS 'Sequence number (1-5)';



COMMENT ON COLUMN "public"."org_order_item_processing_steps"."done_by" IS 'User who completed this step';



COMMENT ON COLUMN "public"."org_order_item_processing_steps"."done_at" IS 'Timestamp when step was completed';



COMMENT ON COLUMN "public"."org_order_item_processing_steps"."notes" IS 'Optional notes for this step';



CREATE TABLE IF NOT EXISTS "public"."org_order_items_dtl" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120),
    "order_item_srno" "text",
    "product_id" "uuid",
    "barcode" "text",
    "quantity" integer DEFAULT 1,
    "price_per_unit" numeric(10,3) NOT NULL,
    "total_price" numeric(10,3) NOT NULL,
    "status" "text" DEFAULT 'processing'::"text",
    "notes" "text",
    "color" character varying(50),
    "brand" character varying(100),
    "has_stain" boolean,
    "has_damage" boolean,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "product_name" character varying(250),
    "product_name2" character varying(250),
    "stain_notes" "text",
    "damage_notes" "text",
    "item_status" "text",
    "item_stage" "text",
    "item_is_rejected" boolean DEFAULT false,
    "item_issue_id" "uuid",
    "item_last_step" "text",
    "item_last_step_at" timestamp with time zone,
    "item_last_step_by" "uuid",
    "quantity_ready" integer DEFAULT 0,
    CONSTRAINT "quantity_ready_check" CHECK ((("quantity_ready" >= 0) AND ("quantity_ready" <= "quantity")))
);


ALTER TABLE "public"."org_order_items_dtl" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_order_items_dtl" IS 'Order line items (detail)';



COMMENT ON COLUMN "public"."org_order_items_dtl"."product_name" IS 'Product name (English) - denormalized from org_product_data_mst';



COMMENT ON COLUMN "public"."org_order_items_dtl"."product_name2" IS 'Product name (Arabic) - denormalized from org_product_data_mst';



COMMENT ON COLUMN "public"."org_order_items_dtl"."stain_notes" IS 'Detailed notes about stains on item (e.g., "Coffee stain on left sleeve")';



COMMENT ON COLUMN "public"."org_order_items_dtl"."damage_notes" IS 'Detailed notes about damage to item (e.g., "Missing button, torn pocket")';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_status" IS 'Current status of this item (intake, processing, ready, etc.)';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_stage" IS 'Current stage of this item';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_is_rejected" IS 'True if this item was rejected';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_issue_id" IS 'Reference to issue for this specific item';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_last_step" IS 'Last completed processing step (sorting, pretreatment, washing, drying, finishing)';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_last_step_at" IS 'Timestamp when last step was completed';



COMMENT ON COLUMN "public"."org_order_items_dtl"."item_last_step_by" IS 'User who completed last step';



COMMENT ON COLUMN "public"."org_order_items_dtl"."quantity_ready" IS 'Number of pieces marked as ready for this item (must be between 0 and quantity). Example: if quantity=3 and quantity_ready=2, then 2 out of 3 pieces are ready for delivery.';



CREATE TABLE IF NOT EXISTS "public"."org_order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "from_status" character varying(50),
    "to_status" character varying(50) NOT NULL,
    "changed_by" "uuid",
    "changed_by_name" character varying(255),
    "changed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_order_status_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_order_status_history" IS 'DEPRECATED: Use org_order_history instead. This table is kept for backward compatibility only. All new status changes should go to org_order_history with action_type = STATUS_CHANGE. Migration completed in 0022_order_history_canonical.sql';



COMMENT ON COLUMN "public"."org_order_status_history"."from_status" IS 'Previous status (NULL for initial status)';



COMMENT ON COLUMN "public"."org_order_status_history"."to_status" IS 'New status after change';



COMMENT ON COLUMN "public"."org_order_status_history"."changed_by" IS 'User ID who made the change';



COMMENT ON COLUMN "public"."org_order_status_history"."changed_by_name" IS 'User display name at time of change';



COMMENT ON COLUMN "public"."org_order_status_history"."notes" IS 'Optional notes explaining the status change';



COMMENT ON COLUMN "public"."org_order_status_history"."metadata" IS 'Additional context (IP address, user agent, etc.)';



CREATE OR REPLACE VIEW "public"."org_order_status_history_legacy" AS
 SELECT "id",
    "order_id",
    "tenant_org_id",
    "from_status" AS "from_value",
    "to_status" AS "to_value",
    "changed_by" AS "done_by",
    "changed_at" AS "done_at",
    "notes",
    "metadata" AS "payload"
   FROM "public"."org_order_status_history";


ALTER VIEW "public"."org_order_status_history_legacy" OWNER TO "postgres";


COMMENT ON VIEW "public"."org_order_status_history_legacy" IS 'Legacy view for backward compatibility. Maps old org_order_status_history to new structure';



CREATE TABLE IF NOT EXISTS "public"."org_orders_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "order_type_id" character varying(30),
    "order_no" character varying(100) NOT NULL,
    "status" "text" DEFAULT 'intake'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "total_items" integer DEFAULT 0,
    "subtotal" numeric(10,3) DEFAULT 0,
    "discount" numeric(10,3) DEFAULT 0,
    "tax" numeric(10,3) DEFAULT 0,
    "total" numeric(10,3) DEFAULT 0,
    "payment_status" character varying(20) DEFAULT 'pending'::character varying,
    "payment_method" character varying(50),
    "paid_amount" numeric(10,3) DEFAULT 0,
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "payment_notes" "text",
    "received_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "ready_by" timestamp without time zone,
    "ready_at" timestamp without time zone,
    "delivered_at" timestamp without time zone,
    "customer_notes" "text",
    "internal_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "preparation_status" character varying(20) DEFAULT 'pending'::character varying,
    "prepared_at" timestamp without time zone,
    "prepared_by" "uuid",
    "ready_by_override" timestamp without time zone,
    "priority_multiplier" numeric(4,2) DEFAULT 1.0,
    "photo_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "bag_count" integer DEFAULT 1,
    "qr_code" "text",
    "barcode" "text",
    "service_category_code" character varying(120),
    "workflow_template_id" "uuid",
    "current_status" "text",
    "current_stage" "text",
    "parent_order_id" "uuid",
    "order_subtype" "text",
    "has_split" boolean DEFAULT false,
    "is_rejected" boolean DEFAULT false,
    "rejected_from_stage" "text",
    "issue_id" "uuid",
    "has_issue" boolean DEFAULT false,
    "ready_by_at_new" timestamp with time zone,
    "last_transition_at" timestamp with time zone,
    "last_transition_by" "uuid",
    "is_order_quick_drop" boolean DEFAULT false,
    "quick_drop_quantity" integer,
    "rack_location" character varying(100),
    CONSTRAINT "chk_bag_count" CHECK ((("bag_count" > 0) AND ("bag_count" <= 100))),
    CONSTRAINT "chk_priority_multiplier" CHECK ((("priority_multiplier" >= 0.1) AND ("priority_multiplier" <= 2.0)))
);


ALTER TABLE "public"."org_orders_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_orders_mst" IS 'Tenant orders (master)';



COMMENT ON COLUMN "public"."org_orders_mst"."order_no" IS 'Tenant-unique order number';



COMMENT ON COLUMN "public"."org_orders_mst"."preparation_status" IS 'Preparation status: pending, in_progress, completed';



COMMENT ON COLUMN "public"."org_orders_mst"."prepared_at" IS 'When preparation was completed';



COMMENT ON COLUMN "public"."org_orders_mst"."prepared_by" IS 'User who completed preparation (references auth.users)';



COMMENT ON COLUMN "public"."org_orders_mst"."ready_by_override" IS 'Manual override for Ready-By date (takes precedence over calculated date)';



COMMENT ON COLUMN "public"."org_orders_mst"."priority_multiplier" IS 'Priority multiplier: normal=1.0, urgent=0.7, express=0.5';



COMMENT ON COLUMN "public"."org_orders_mst"."photo_urls" IS 'Array of photo URLs from MinIO storage: ["https://storage.../photo1.jpg"]';



COMMENT ON COLUMN "public"."org_orders_mst"."bag_count" IS 'Number of bags received during Quick Drop intake';



COMMENT ON COLUMN "public"."org_orders_mst"."qr_code" IS 'QR code data URL (data:image/png;base64,...) for label printing';



COMMENT ON COLUMN "public"."org_orders_mst"."barcode" IS 'Barcode data URL (data:image/png;base64,...) for label printing';



COMMENT ON COLUMN "public"."org_orders_mst"."service_category_code" IS 'Primary service category for order (wash_fold, dry_clean, etc.)';



COMMENT ON COLUMN "public"."org_orders_mst"."workflow_template_id" IS 'Reference to workflow template used for this order';



COMMENT ON COLUMN "public"."org_orders_mst"."current_status" IS 'Current workflow status (intake, preparing, processing, assembly, qa, ready, delivered, etc.)';



COMMENT ON COLUMN "public"."org_orders_mst"."current_stage" IS 'Current workflow stage (synonym for current_status, kept for compatibility)';



COMMENT ON COLUMN "public"."org_orders_mst"."parent_order_id" IS 'Parent order ID for split orders (NULL for main orders)';



COMMENT ON COLUMN "public"."org_orders_mst"."order_subtype" IS 'Order subtype (e.g., split_parent, split_child, issue_resolution)';



COMMENT ON COLUMN "public"."org_orders_mst"."has_split" IS 'True if this order has been split into suborders';



COMMENT ON COLUMN "public"."org_orders_mst"."is_rejected" IS 'True if order was rejected during QA or processing';



COMMENT ON COLUMN "public"."org_orders_mst"."rejected_from_stage" IS 'Stage from which order was rejected';



COMMENT ON COLUMN "public"."org_orders_mst"."issue_id" IS 'Reference to main issue for this order (if any)';



COMMENT ON COLUMN "public"."org_orders_mst"."has_issue" IS 'True if order has unresolved issues';



COMMENT ON COLUMN "public"."org_orders_mst"."ready_by_at_new" IS 'Recalculated ready-by date after preparation or changes';



COMMENT ON COLUMN "public"."org_orders_mst"."last_transition_at" IS 'Timestamp of last workflow transition';



COMMENT ON COLUMN "public"."org_orders_mst"."last_transition_by" IS 'User who performed last transition';



COMMENT ON COLUMN "public"."org_orders_mst"."is_order_quick_drop" IS 'True if order is Quick Drop (items entered later)';



COMMENT ON COLUMN "public"."org_orders_mst"."quick_drop_quantity" IS 'Estimated quantity for Quick Drop (before itemization)';



COMMENT ON COLUMN "public"."org_orders_mst"."rack_location" IS 'Physical rack location where order is stored when ready';



CREATE TABLE IF NOT EXISTS "public"."org_payments_dtl_tr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "paid_amount" numeric(10,3) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date",
    "payment_method" character varying(50),
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "gateway" "text",
    "transaction_id" "text",
    "metadata" "jsonb",
    "rec_notes" character varying(1000),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_payments_dtl_tr" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_payments_dtl_tr" IS 'Payment transactions';



CREATE TABLE IF NOT EXISTS "public"."org_pln_change_history_tr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "from_plan_code" character varying(50),
    "to_plan_code" character varying(50) NOT NULL,
    "change_type" character varying(20) NOT NULL,
    "proration_amount" numeric(10,3),
    "proration_invoice_id" "uuid",
    "change_reason" "text",
    "effective_date" "date" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    CONSTRAINT "org_pln_change_history_tr_change_type_check" CHECK ((("change_type")::"text" = ANY ((ARRAY['upgrade'::character varying, 'downgrade'::character varying, 'initial'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_pln_change_history_tr" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_pln_change_history_tr" IS 'Audit trail of subscription plan changes';



CREATE TABLE IF NOT EXISTS "public"."org_pln_subscriptions_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "plan_code" character varying(50) NOT NULL,
    "plan_name" character varying(250),
    "status" character varying(20) DEFAULT 'trial'::character varying,
    "base_price" numeric(10,3) NOT NULL,
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "billing_cycle" character varying(20) DEFAULT 'monthly'::character varying,
    "current_period_start" "date" NOT NULL,
    "current_period_end" "date" NOT NULL,
    "trial_start" "date",
    "trial_end" "date",
    "activated_at" timestamp without time zone,
    "suspended_at" timestamp without time zone,
    "cancelled_at" timestamp without time zone,
    "cancellation_reason" "text",
    "discount_code" character varying(50),
    "discount_value" numeric(10,3),
    "discount_type" character varying(20),
    "discount_duration_months" integer,
    "discount_applied_at" timestamp without time zone,
    "scheduled_plan_code" character varying(50),
    "scheduled_plan_change_date" "date",
    "plan_change_scheduled_at" timestamp without time zone,
    "plan_changed_at" timestamp without time zone,
    "previous_plan_code" character varying(50),
    "default_payment_method_id" "uuid",
    "subscription_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(200),
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "org_pln_subscriptions_mst_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying, 'free_months'::character varying])::"text"[]))),
    CONSTRAINT "org_pln_subscriptions_mst_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['trial'::character varying, 'active'::character varying, 'past_due'::character varying, 'suspended'::character varying, 'cancelled'::character varying, 'expired'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_pln_subscriptions_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_pln_subscriptions_mst" IS 'Tenant subscription records - which plan each tenant is on';



CREATE TABLE IF NOT EXISTS "public"."org_price_list_items_dtl" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "price_list_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "price" numeric(10,3) NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "min_quantity" integer DEFAULT 1,
    "max_quantity" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "positive_price" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "valid_discount" CHECK ((("discount_percent" >= (0)::numeric) AND ("discount_percent" <= (100)::numeric))),
    CONSTRAINT "valid_quantity_range" CHECK ((("min_quantity" > 0) AND (("max_quantity" IS NULL) OR ("max_quantity" >= "min_quantity"))))
);


ALTER TABLE "public"."org_price_list_items_dtl" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_price_list_items_dtl" IS 'Price list line items linking products to prices';



COMMENT ON COLUMN "public"."org_price_list_items_dtl"."price" IS 'Price for this product in this price list';



COMMENT ON COLUMN "public"."org_price_list_items_dtl"."discount_percent" IS 'Optional discount percentage';



COMMENT ON COLUMN "public"."org_price_list_items_dtl"."min_quantity" IS 'Minimum quantity for this price tier';



COMMENT ON COLUMN "public"."org_price_list_items_dtl"."max_quantity" IS 'Maximum quantity for this price tier (NULL = unlimited)';



CREATE TABLE IF NOT EXISTS "public"."org_price_lists_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "name2" character varying(255),
    "description" "text",
    "description2" "text",
    "price_list_type" character varying(50) NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    "is_default" boolean DEFAULT false,
    "priority" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(200),
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "valid_date_range" CHECK ((("effective_from" IS NULL) OR ("effective_to" IS NULL) OR ("effective_from" <= "effective_to"))),
    CONSTRAINT "valid_price_list_type" CHECK ((("price_list_type")::"text" = ANY ((ARRAY['standard'::character varying, 'express'::character varying, 'vip'::character varying, 'seasonal'::character varying, 'b2b'::character varying, 'promotional'::character varying])::"text"[])))
);


ALTER TABLE "public"."org_price_lists_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_price_lists_mst" IS 'Tenant price list headers for flexible pricing strategies';



COMMENT ON COLUMN "public"."org_price_lists_mst"."name" IS 'Price list name (English)';



COMMENT ON COLUMN "public"."org_price_lists_mst"."name2" IS 'Price list name (Arabic)';



COMMENT ON COLUMN "public"."org_price_lists_mst"."price_list_type" IS 'Type: standard, express, vip, seasonal, b2b, promotional';



COMMENT ON COLUMN "public"."org_price_lists_mst"."effective_from" IS 'Start date for this price list (NULL = always active)';



COMMENT ON COLUMN "public"."org_price_lists_mst"."effective_to" IS 'End date for this price list (NULL = no expiry)';



COMMENT ON COLUMN "public"."org_price_lists_mst"."is_default" IS 'Default price list for this type';



COMMENT ON COLUMN "public"."org_price_lists_mst"."priority" IS 'Priority for overlapping price lists (higher wins)';



CREATE TABLE IF NOT EXISTS "public"."org_product_data_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" "text",
    "product_code" "text" NOT NULL,
    "product_name" "text",
    "product_name2" "text",
    "hint_text" "text",
    "is_retail_item" boolean DEFAULT false,
    "product_group1" "text",
    "product_group2" "text",
    "product_group3" "text",
    "product_type" integer,
    "price_type" "text",
    "product_unit" character varying(60),
    "default_sell_price" numeric(10,3),
    "default_express_sell_price" numeric(10,3),
    "product_cost" numeric(10,3),
    "min_sell_price" numeric(10,3),
    "min_quantity" integer,
    "pieces_per_product" integer,
    "extra_days" integer,
    "turnaround_hh" numeric(4,2),
    "turnaround_hh_express" numeric(4,2),
    "multiplier_express" numeric(4,2),
    "product_order" integer,
    "is_tax_exempt" integer,
    "tags" json,
    "id_sku" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "product_color1" "text",
    "product_color2" "text",
    "product_color3" "text",
    "product_icon" "text",
    "product_image" "text",
    "rec_order" integer,
    "rec_notes" "text",
    "rec_status" smallint DEFAULT 1,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "text",
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" "text",
    "updated_info" "text",
    "item_type_code" character varying(50)
);


ALTER TABLE "public"."org_product_data_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_product_data_mst" IS 'Tenant product/detail service catalog';



COMMENT ON COLUMN "public"."org_product_data_mst"."product_name" IS 'Product name (English)';



COMMENT ON COLUMN "public"."org_product_data_mst"."product_name2" IS 'Product name (Arabic)';



COMMENT ON COLUMN "public"."org_product_data_mst"."item_type_code" IS 'Item type classification (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';



CREATE TABLE IF NOT EXISTS "public"."org_promo_codes_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "promo_code" character varying(50) NOT NULL,
    "promo_name" character varying(250),
    "promo_name2" character varying(250),
    "description" "text",
    "description2" "text",
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,3) NOT NULL,
    "max_discount_amount" numeric(10,3),
    "min_order_amount" numeric(10,3) DEFAULT 0,
    "max_order_amount" numeric(10,3),
    "applicable_categories" "jsonb",
    "max_uses" integer,
    "max_uses_per_customer" integer DEFAULT 1,
    "current_uses" integer DEFAULT 0,
    "valid_from" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "valid_to" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp with time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(1000),
    CONSTRAINT "org_promo_codes_mst_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying])::"text"[]))),
    CONSTRAINT "org_promo_codes_mst_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);


ALTER TABLE "public"."org_promo_codes_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_promo_codes_mst" IS 'Promotional codes/coupons for order discounts';



COMMENT ON COLUMN "public"."org_promo_codes_mst"."discount_type" IS 'percentage: discount as %, fixed_amount: fixed OMR amount';



COMMENT ON COLUMN "public"."org_promo_codes_mst"."applicable_categories" IS 'JSON array of service category codes this promo applies to';



CREATE TABLE IF NOT EXISTS "public"."org_promo_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "promo_code_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "order_id" "uuid",
    "invoice_id" "uuid",
    "discount_amount" numeric(10,3) NOT NULL,
    "order_total_before" numeric(10,3) NOT NULL,
    "order_total_after" numeric(10,3) NOT NULL,
    "used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "used_by" character varying(120),
    "metadata" "jsonb"
);


ALTER TABLE "public"."org_promo_usage_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_promo_usage_log" IS 'Track promotional code usage history for audit and limit enforcement';



CREATE TABLE IF NOT EXISTS "public"."org_service_category_cf" (
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120) NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "rec_order" integer DEFAULT 1,
    "rec_notes" "text",
    "rec_status" smallint DEFAULT 1,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" "text",
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" "text",
    "updated_info" "text"
);


ALTER TABLE "public"."org_service_category_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_service_category_cf" IS 'Tenant-specific service category enablement';



CREATE TABLE IF NOT EXISTS "public"."org_subscriptions_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "plan" character varying(20) DEFAULT 'free'::character varying,
    "status" character varying(20) DEFAULT 'trial'::character varying,
    "orders_limit" integer DEFAULT 20,
    "orders_used" integer DEFAULT 0,
    "branch_limit" integer DEFAULT 1,
    "user_limit" integer DEFAULT 2,
    "start_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "end_date" timestamp without time zone NOT NULL,
    "trial_ends" timestamp without time zone,
    "last_payment_date" timestamp without time zone,
    "last_payment_amount" numeric(10,2),
    "last_payment_method" character varying(50),
    "payment_reference" character varying(100),
    "payment_notes" "text",
    "last_invoice_number" character varying(50),
    "last_invoice_date" timestamp without time zone,
    "is_active" boolean DEFAULT true,
    "is_enabled" boolean DEFAULT true,
    "rec_status" smallint DEFAULT 1,
    "rec_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "text",
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" "text",
    "updated_info" "text",
    "auto_renew" boolean DEFAULT true,
    "cancellation_date" timestamp without time zone,
    "cancellation_reason" "text"
);


ALTER TABLE "public"."org_subscriptions_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_subscriptions_mst" IS 'Tenant subscription plans and limits';



COMMENT ON COLUMN "public"."org_subscriptions_mst"."orders_limit" IS 'Maximum orders per month';



COMMENT ON COLUMN "public"."org_subscriptions_mst"."orders_used" IS 'Orders used this billing cycle';



COMMENT ON COLUMN "public"."org_subscriptions_mst"."auto_renew" IS 'Whether subscription will auto-renew at end of billing period';



COMMENT ON COLUMN "public"."org_subscriptions_mst"."cancellation_date" IS 'Date when subscription was cancelled (null if active)';



COMMENT ON COLUMN "public"."org_subscriptions_mst"."cancellation_reason" IS 'Reason for cancellation (for analytics)';



CREATE TABLE IF NOT EXISTS "public"."org_tenant_service_category_workflow_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120) NOT NULL,
    "workflow_template_id" "uuid",
    "use_preparation_screen" boolean,
    "use_assembly_screen" boolean,
    "use_qa_screen" boolean,
    "track_individual_piece" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."org_tenant_service_category_workflow_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_tenant_service_category_workflow_cf" IS 'Per-category workflow overrides (NULL values inherit from tenant settings)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."service_category_code" IS 'Service category code (e.g., WASH_FOLD, DRY_CLEAN)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."workflow_template_id" IS 'Specific template for this category (NULL = use tenant default)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."use_preparation_screen" IS 'Category-specific override (NULL = inherit from tenant)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."use_assembly_screen" IS 'Category-specific override (NULL = inherit from tenant)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."use_qa_screen" IS 'Category-specific override (NULL = inherit from tenant)';



COMMENT ON COLUMN "public"."org_tenant_service_category_workflow_cf"."track_individual_piece" IS 'Category-specific override (NULL = inherit from tenant)';



CREATE TABLE IF NOT EXISTS "public"."org_tenant_settings_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "setting_code" "text" NOT NULL,
    "setting_name" "text",
    "setting_name2" "text",
    "setting_desc" "text",
    "setting_value_type" "text",
    "setting_value" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "branch_id" "uuid",
    "user_id" "uuid",
    "rec_order" integer,
    "rec_notes" "text",
    "rec_status" smallint DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "created_info" "text",
    "updated_at" timestamp with time zone,
    "updated_by" "text",
    "updated_info" "text",
    CONSTRAINT "org_tenant_settings_cf_setting_value_type_check" CHECK (("setting_value_type" = ANY (ARRAY['BOOLEAN'::"text", 'TEXT'::"text", 'NUMBER'::"text", 'DATE'::"text"])))
);


ALTER TABLE "public"."org_tenant_settings_cf" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_tenant_workflow_settings_cf" (
    "tenant_org_id" "uuid" NOT NULL,
    "use_preparation_screen" boolean DEFAULT false,
    "use_assembly_screen" boolean DEFAULT false,
    "use_qa_screen" boolean DEFAULT false,
    "track_individual_piece" boolean DEFAULT false,
    "orders_split_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."org_tenant_workflow_settings_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_tenant_workflow_settings_cf" IS 'Workflow feature flags enabling/disabling specific screens and features';



COMMENT ON COLUMN "public"."org_tenant_workflow_settings_cf"."use_preparation_screen" IS 'Enable preparation/detailing screen for Quick Drop orders';



COMMENT ON COLUMN "public"."org_tenant_workflow_settings_cf"."use_assembly_screen" IS 'Enable assembly screen before QA/Ready';



COMMENT ON COLUMN "public"."org_tenant_workflow_settings_cf"."use_qa_screen" IS 'Enable quality assurance screen';



COMMENT ON COLUMN "public"."org_tenant_workflow_settings_cf"."track_individual_piece" IS 'Track items individually through processing stages';



COMMENT ON COLUMN "public"."org_tenant_workflow_settings_cf"."orders_split_enabled" IS 'Allow splitting orders into multiple suborders';



CREATE TABLE IF NOT EXISTS "public"."org_tenant_workflow_templates_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "is_default" boolean DEFAULT false,
    "allow_back_steps" boolean DEFAULT false,
    "extra_config" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."org_tenant_workflow_templates_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_tenant_workflow_templates_cf" IS 'Tenant assignments to global workflow templates';



COMMENT ON COLUMN "public"."org_tenant_workflow_templates_cf"."tenant_org_id" IS 'Tenant organization ID';



COMMENT ON COLUMN "public"."org_tenant_workflow_templates_cf"."template_id" IS 'Reference to global workflow template';



COMMENT ON COLUMN "public"."org_tenant_workflow_templates_cf"."is_default" IS 'True if this is the default template for new orders';



COMMENT ON COLUMN "public"."org_tenant_workflow_templates_cf"."allow_back_steps" IS 'Allow users to move orders backward in workflow';



COMMENT ON COLUMN "public"."org_tenant_workflow_templates_cf"."extra_config" IS 'Additional configuration as JSON';



CREATE TABLE IF NOT EXISTS "public"."org_tenants_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "name2" character varying(255),
    "slug" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50) NOT NULL,
    "s_cureent_plan" character varying(120) DEFAULT 'plan_freemium'::character varying,
    "address" "text",
    "city" character varying(100),
    "country" character varying(2) DEFAULT 'OM'::character varying,
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "timezone" character varying(50) DEFAULT 'Asia/Muscat'::character varying,
    "language" character varying(5) DEFAULT 'en'::character varying,
    "is_active" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'trial'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "logo_url" character varying(500),
    "brand_color_primary" character varying(7) DEFAULT '#3B82F6'::character varying,
    "brand_color_secondary" character varying(7) DEFAULT '#10B981'::character varying,
    "business_hours" "jsonb" DEFAULT '{"fri": {"open": "08:00", "close": "18:00"}, "mon": {"open": "08:00", "close": "18:00"}, "sat": {"open": "09:00", "close": "14:00"}, "sun": null, "thu": {"open": "08:00", "close": "18:00"}, "tue": {"open": "08:00", "close": "18:00"}, "wed": {"open": "08:00", "close": "18:00"}}'::"jsonb",
    "feature_flags" "jsonb" DEFAULT '{"printing": false, "api_access": false, "driver_app": false, "white_label": false, "multi_branch": false, "pdf_invoices": false, "b2b_contracts": false, "in_app_receipts": false, "loyalty_programs": false, "whatsapp_receipts": true, "advanced_analytics": false, "marketplace_listings": false}'::"jsonb",
    "business_type" character varying(50),
    "onboarding_completed" boolean DEFAULT false,
    "country_code" character varying(2) DEFAULT 'OM'::character varying,
    "phone_country_code" character varying(5) DEFAULT '+968'::character varying,
    "date_format" character varying(20) DEFAULT 'DD/MM/YYYY'::character varying,
    "time_format" character varying(5) DEFAULT '24h'::character varying,
    "first_day_of_week" integer DEFAULT 6
);


ALTER TABLE "public"."org_tenants_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_tenants_mst" IS 'Tenant organizations (laundry businesses)';



COMMENT ON COLUMN "public"."org_tenants_mst"."slug" IS 'URL-friendly identifier (e.g., demo-laundry)';



COMMENT ON COLUMN "public"."org_tenants_mst"."s_cureent_plan" IS 'Current subscription plan';



COMMENT ON COLUMN "public"."org_tenants_mst"."logo_url" IS 'URL to tenant logo (stored in MinIO/S3)';



COMMENT ON COLUMN "public"."org_tenants_mst"."brand_color_primary" IS 'Primary brand color in hex format (#RRGGBB)';



COMMENT ON COLUMN "public"."org_tenants_mst"."brand_color_secondary" IS 'Secondary brand color in hex format (#RRGGBB)';



COMMENT ON COLUMN "public"."org_tenants_mst"."business_hours" IS 'Weekly business hours in JSON format';



COMMENT ON COLUMN "public"."org_tenants_mst"."feature_flags" IS 'Enabled features for this tenant (based on subscription plan)';



CREATE TABLE IF NOT EXISTS "public"."org_usage_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "orders_count" integer DEFAULT 0,
    "users_count" integer DEFAULT 0,
    "branches_count" integer DEFAULT 0,
    "storage_mb" numeric(10,2) DEFAULT 0,
    "api_calls" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_usage_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_usage_tracking" IS 'Tracks resource usage per tenant per billing period';



COMMENT ON COLUMN "public"."org_usage_tracking"."period_start" IS 'Start of the tracking period (typically 1st of month)';



COMMENT ON COLUMN "public"."org_usage_tracking"."period_end" IS 'End of the tracking period (typically last day of month)';



COMMENT ON COLUMN "public"."org_usage_tracking"."orders_count" IS 'Number of orders created in this period';



COMMENT ON COLUMN "public"."org_usage_tracking"."users_count" IS 'Number of active users in this period';



COMMENT ON COLUMN "public"."org_usage_tracking"."branches_count" IS 'Number of active branches';



COMMENT ON COLUMN "public"."org_usage_tracking"."storage_mb" IS 'Storage used in MB (files, images, etc.)';



COMMENT ON COLUMN "public"."org_usage_tracking"."api_calls" IS 'Number of API calls made (for future usage tracking)';



CREATE TABLE IF NOT EXISTS "public"."org_workflow_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "from_status" character varying(50) NOT NULL,
    "to_status" character varying(50) NOT NULL,
    "is_allowed" boolean DEFAULT true,
    "requires_role" character varying(50),
    "validation_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."org_workflow_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_workflow_rules" IS 'DEPRECATED: Replaced by sys_workflow_template_transitions in PRD-010 system. 
      Use workflow templates for transition rules instead.';



COMMENT ON COLUMN "public"."org_workflow_rules"."requires_role" IS 'Role required to perform this transition (e.g., "manager")';



COMMENT ON COLUMN "public"."org_workflow_rules"."validation_rules" IS 'Custom validation logic for this transition';



CREATE TABLE IF NOT EXISTS "public"."org_workflow_settings_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120),
    "workflow_steps" "jsonb" DEFAULT '["DRAFT", "INTAKE", "PREPARATION", "SORTING", "WASHING", "DRYING", "FINISHING", "ASSEMBLY", "QA", "PACKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CLOSED"]'::"jsonb" NOT NULL,
    "status_transitions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "quality_gate_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."org_workflow_settings_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_workflow_settings_cf" IS 'DEPRECATED: Replaced by sys_workflow_template_* system (PRD-010). New system supports global templates with tenant-level configuration via org_tenant_workflow_templates_cf and org_tenant_workflow_settings_cf';



COMMENT ON COLUMN "public"."org_workflow_settings_cf"."service_category_code" IS 'NULL for default workflow, specific code for category-specific workflow';



COMMENT ON COLUMN "public"."org_workflow_settings_cf"."workflow_steps" IS 'Array of status steps in order';



COMMENT ON COLUMN "public"."org_workflow_settings_cf"."status_transitions" IS 'Map of allowed transitions: {"INTAKE": ["PREPARATION", "CANCELLED"]}';



COMMENT ON COLUMN "public"."org_workflow_settings_cf"."quality_gate_rules" IS 'Rules that must pass before certain transitions';



CREATE SEQUENCE IF NOT EXISTS "public"."seq_invoice_number"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seq_invoice_number" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_org_id" "uuid",
    "action" character varying(100) NOT NULL,
    "entity_type" character varying(100),
    "entity_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "request_id" character varying(120),
    "status" character varying(20) DEFAULT 'success'::character varying,
    "error_message" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."sys_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_audit_log" IS 'Comprehensive audit trail for all system actions';



COMMENT ON COLUMN "public"."sys_audit_log"."action" IS 'Action performed (login, logout, create, update, delete, etc.)';



COMMENT ON COLUMN "public"."sys_audit_log"."old_values" IS 'Previous values before change (JSON)';



COMMENT ON COLUMN "public"."sys_audit_log"."new_values" IS 'New values after change (JSON)';



COMMENT ON COLUMN "public"."sys_audit_log"."request_id" IS 'Correlation ID for distributed tracing';



CREATE TABLE IF NOT EXISTS "public"."sys_auth_permissions" (
    "permission_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text",
    "name2" "text",
    "category" "text",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_permission_code_format" CHECK (("code" ~ '^[a-z_]+:([a-z_]+|\*)$|^\*:\*$'::"text"))
);


ALTER TABLE "public"."sys_auth_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_auth_permissions" IS 'Platform-wide permission definitions';



COMMENT ON COLUMN "public"."sys_auth_permissions"."code" IS 'Permission code in format resource:action (e.g., orders:read, orders:create)';



COMMENT ON COLUMN "public"."sys_auth_permissions"."category" IS 'Permission category for grouping (crud, actions, export, management, workflow)';



CREATE TABLE IF NOT EXISTS "public"."sys_auth_role_default_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sys_auth_role_default_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_auth_role_default_permissions" IS 'Maps default permissions to roles';



CREATE TABLE IF NOT EXISTS "public"."sys_auth_roles" (
    "role_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name2" "text",
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_system_role_code" CHECK (((NOT "is_system") OR ("code" = ANY (ARRAY['super_admin'::"text", 'tenant_admin'::"text", 'branch_manager'::"text", 'operator'::"text", 'viewer'::"text"]))))
);


ALTER TABLE "public"."sys_auth_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_auth_roles" IS 'Role definitions (system and custom)';



COMMENT ON COLUMN "public"."sys_auth_roles"."code" IS 'Role code identifier (e.g., tenant_admin, operator, viewer)';



COMMENT ON COLUMN "public"."sys_auth_roles"."is_system" IS 'true for built-in system roles, false for tenant-created custom roles';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_discount_codes_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "description" "text",
    "description_ar" "text",
    "type" character varying(20) NOT NULL,
    "value" numeric(10,3) NOT NULL,
    "applies_to" character varying(20) DEFAULT 'all_plans'::character varying,
    "plan_codes" "jsonb" DEFAULT '[]'::"jsonb",
    "max_redemptions" integer DEFAULT '-1'::integer,
    "max_per_customer" integer DEFAULT 1,
    "times_redeemed" integer DEFAULT 0,
    "valid_from" "date",
    "valid_until" "date",
    "duration_months" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_notes" character varying(200),
    CONSTRAINT "sys_bill_discount_codes_mst_applies_to_check" CHECK ((("applies_to")::"text" = ANY ((ARRAY['all_plans'::character varying, 'specific_plans'::character varying, 'first_invoice'::character varying, 'recurring'::character varying])::"text"[]))),
    CONSTRAINT "sys_bill_discount_codes_mst_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying, 'free_months'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_discount_codes_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_discount_codes_mst" IS 'Discount codes and promotional offers';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_discount_redemptions_tr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "discount_code" character varying(50) NOT NULL,
    "redeemed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "invoice_id" "uuid",
    "discount_amount" numeric(10,3),
    "created_by" character varying(120)
);


ALTER TABLE "public"."sys_bill_discount_redemptions_tr" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_discount_redemptions_tr" IS 'Tracking of discount code redemptions';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_dunning_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "first_failure_date" "date" NOT NULL,
    "last_retry_date" "date",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 4,
    "emails_sent" integer DEFAULT 0,
    "calls_made" integer DEFAULT 0,
    "resolved_at" timestamp without time zone,
    "resolution_method" character varying(50),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    CONSTRAINT "sys_bill_dunning_mst_resolution_method_check" CHECK ((("resolution_method")::"text" = ANY ((ARRAY['payment_successful'::character varying, 'manual_payment'::character varying, 'plan_change'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "sys_bill_dunning_mst_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'suspended'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_dunning_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_dunning_mst" IS 'Dunning management for failed payments';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_invoice_payments_tr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "payment_date" "date" NOT NULL,
    "amount" numeric(10,3) NOT NULL,
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "payment_method" character varying(50),
    "payment_gateway" character varying(50),
    "payment_gateway_ref" character varying(255),
    "payment_gateway_fee" numeric(10,3),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "failure_reason" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    CONSTRAINT "sys_bill_invoice_payments_tr_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_invoice_payments_tr" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_invoice_payments_tr" IS 'Payment transactions for invoices';



COMMENT ON COLUMN "public"."sys_bill_invoice_payments_tr"."payment_method" IS 'Payment method used: cash (default), bank_transfer, card, check, payment_gateway';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_invoices_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "invoice_no" character varying(100) NOT NULL,
    "invoice_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "billing_period_start" "date" NOT NULL,
    "billing_period_end" "date" NOT NULL,
    "plan_code" character varying(50) NOT NULL,
    "plan_name" character varying(255),
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal" numeric(10,3) NOT NULL,
    "discount_total" numeric(10,3) DEFAULT 0,
    "tax" numeric(10,3) DEFAULT 0,
    "total" numeric(10,3) NOT NULL,
    "amount_paid" numeric(10,3) DEFAULT 0,
    "amount_due" numeric(10,3) NOT NULL,
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "paid_at" timestamp without time zone,
    "payment_method" character varying(50),
    "payment_gateway" character varying(50),
    "payment_gateway_ref" character varying(255),
    "payment_gateway_fee" numeric(10,3),
    "notes" "text",
    "internal_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(200),
    CONSTRAINT "sys_bill_invoices_mst_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'paid'::character varying, 'overdue'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_invoices_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_invoices_mst" IS 'Tenant invoices for subscription and usage charges';



COMMENT ON COLUMN "public"."sys_bill_invoices_mst"."payment_method" IS 'Payment method used: cash (default), bank_transfer, card, check, payment_gateway';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_payment_gateways_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gateway_code" character varying(50) NOT NULL,
    "gateway_name" character varying(250) NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "regions" "jsonb" DEFAULT '["GCC", "INTL"]'::"jsonb",
    "credentials_encrypted" "text",
    "payment_methods" "jsonb" DEFAULT '["card"]'::"jsonb",
    "transaction_fee_percentage" numeric(5,2) DEFAULT 0,
    "transaction_fee_fixed" numeric(10,3) DEFAULT 0,
    "min_amount" numeric(10,3) DEFAULT 0,
    "max_amount" numeric(10,3),
    "auto_capture" boolean DEFAULT true,
    "retry_enabled" boolean DEFAULT true,
    "max_retries" integer DEFAULT 3,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "rec_status" smallint DEFAULT 1,
    "is_active_flag" boolean DEFAULT true
);


ALTER TABLE "public"."sys_bill_payment_gateways_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_payment_gateways_cf" IS 'Payment gateway configurations for online payment_gateway type (Stripe, HyperPay, PayTabs)';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_payment_method_codes_cd" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "method_code" character varying(50) NOT NULL,
    "method_name" character varying(250) NOT NULL,
    "method_name_ar" character varying(250),
    "description" "text",
    "description_ar" "text",
    "type" character varying(20) NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "requires_verification" boolean DEFAULT false,
    "auto_approve" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "method_icon" character varying(120),
    "method_color" character varying(60),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "rec_status" smallint DEFAULT 1,
    "rec_notes" character varying(200),
    CONSTRAINT "sys_bill_payment_method_codes_cd_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['cash'::character varying, 'bank_transfer'::character varying, 'card'::character varying, 'check'::character varying, 'payment_gateway'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_payment_method_codes_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_payment_method_codes_cd" IS 'Payment method codes configuration (Cash, Bank Transfer, Card, Check, Payment Gateway)';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_payment_methods_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "type" character varying(20) NOT NULL,
    "gateway" character varying(50),
    "gateway_customer_id" character varying(255),
    "gateway_payment_method_id" character varying(255),
    "card_brand" character varying(20),
    "card_last4" character varying(4),
    "card_exp_month" integer,
    "card_exp_year" integer,
    "bank_name" character varying(100),
    "bank_account_last4" character varying(4),
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    CONSTRAINT "sys_bill_payment_methods_mst_gateway_check" CHECK (((("gateway")::"text" = ANY ((ARRAY['stripe'::character varying, 'hyperpay'::character varying, 'paytabs'::character varying])::"text"[])) OR ("gateway" IS NULL))),
    CONSTRAINT "sys_bill_payment_methods_mst_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['cash'::character varying, 'bank_transfer'::character varying, 'card'::character varying, 'check'::character varying, 'payment_gateway'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_bill_payment_methods_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_bill_revenue_metrics_monthly" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_month" "date" NOT NULL,
    "mrr" numeric(12,3) DEFAULT 0,
    "arr" numeric(12,3) DEFAULT 0,
    "mrr_growth_percentage" numeric(5,2) DEFAULT 0,
    "new_mrr" numeric(10,3) DEFAULT 0,
    "expansion_mrr" numeric(10,3) DEFAULT 0,
    "contraction_mrr" numeric(10,3) DEFAULT 0,
    "churned_mrr" numeric(10,3) DEFAULT 0,
    "total_customers" integer DEFAULT 0,
    "paying_customers" integer DEFAULT 0,
    "trial_customers" integer DEFAULT 0,
    "new_customers" integer DEFAULT 0,
    "churned_customers" integer DEFAULT 0,
    "arpu" numeric(10,3) DEFAULT 0,
    "arpc" numeric(10,3) DEFAULT 0,
    "ltv" numeric(10,3) DEFAULT 0,
    "cac" numeric(10,3) DEFAULT 0,
    "ltv_cac_ratio" numeric(5,2) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."sys_bill_revenue_metrics_monthly" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_revenue_metrics_monthly" IS 'Monthly revenue metrics (MRR, ARR, etc.)';



CREATE TABLE IF NOT EXISTS "public"."sys_bill_usage_metrics_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "orders_count" integer DEFAULT 0,
    "orders_completed" integer DEFAULT 0,
    "orders_cancelled" integer DEFAULT 0,
    "revenue" numeric(10,3) DEFAULT 0,
    "active_users" integer DEFAULT 0,
    "total_users" integer DEFAULT 0,
    "storage_mb_used" numeric(10,2) DEFAULT 0,
    "api_calls" integer DEFAULT 0,
    "branches_count" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."sys_bill_usage_metrics_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_bill_usage_metrics_daily" IS 'Daily aggregated usage metrics per tenant';



CREATE TABLE IF NOT EXISTS "public"."sys_billing_cycle_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "cycle_type" character varying(20) NOT NULL,
    "months" integer NOT NULL,
    "days" integer DEFAULT 0,
    "discount_percentage" numeric(5,2) DEFAULT 0,
    "is_prepaid" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_billing_cycle_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_billing_cycle_cd" IS 'Billing cycle codes (MONTHLY, QUARTERLY, ANNUAL, etc.)';



COMMENT ON COLUMN "public"."sys_billing_cycle_cd"."code" IS 'Unique cycle code (e.g., MONTHLY, QUARTERLY, ANNUAL)';



COMMENT ON COLUMN "public"."sys_billing_cycle_cd"."months" IS 'Number of months in this billing cycle';



CREATE TABLE IF NOT EXISTS "public"."sys_code_table_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_code" character varying(50) NOT NULL,
    "action" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "change_reason" "text",
    "ip_address" character varying(50),
    "user_agent" "text",
    "is_rollback" boolean DEFAULT false,
    "rollback_of_id" "uuid"
);


ALTER TABLE "public"."sys_code_table_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_code_table_audit_log" IS 'Complete audit trail for all changes to system code tables';



COMMENT ON COLUMN "public"."sys_code_table_audit_log"."old_values" IS 'Complete row values before change (JSON)';



COMMENT ON COLUMN "public"."sys_code_table_audit_log"."new_values" IS 'Complete row values after change (JSON)';



COMMENT ON COLUMN "public"."sys_code_table_audit_log"."changed_fields" IS 'Array of field names that were modified';



COMMENT ON COLUMN "public"."sys_code_table_audit_log"."is_rollback" IS 'True if this change was a rollback of a previous change';



CREATE TABLE IF NOT EXISTS "public"."sys_code_tables_registry" (
    "table_name" character varying(100) NOT NULL,
    "display_name" character varying(250) NOT NULL,
    "display_name2" character varying(250),
    "description" "text",
    "description2" "text",
    "is_editable" boolean DEFAULT true,
    "is_extensible" boolean DEFAULT false,
    "supports_tenant_override" boolean DEFAULT false,
    "code_pattern" character varying(100),
    "max_code_length" integer DEFAULT 50,
    "requires_unique_name" boolean DEFAULT true,
    "category" character varying(50),
    "display_order" integer DEFAULT 0,
    "current_version" integer DEFAULT 1,
    "last_seeded_at" timestamp without time zone,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."sys_code_tables_registry" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_code_tables_registry" IS 'Registry of all system code tables with configuration and metadata';



COMMENT ON COLUMN "public"."sys_code_tables_registry"."table_name" IS 'Physical table name (e.g., sys_order_status_cd)';



COMMENT ON COLUMN "public"."sys_code_tables_registry"."is_editable" IS 'Whether platform admins can modify existing values';



COMMENT ON COLUMN "public"."sys_code_tables_registry"."is_extensible" IS 'Whether platform admins can add new values';



COMMENT ON COLUMN "public"."sys_code_tables_registry"."supports_tenant_override" IS 'Whether tenants can override values via org_*_cf tables';



CREATE TABLE IF NOT EXISTS "public"."sys_country_cd" (
    "code" character varying(2) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "iso_code" character varying(2) NOT NULL,
    "iso_alpha3" character varying(3),
    "iso_numeric" integer,
    "region" character varying(50),
    "subregion" character varying(50),
    "continent" character varying(20),
    "default_currency_code" character varying(3),
    "default_language_code" character varying(2),
    "default_timezone_code" character varying(50),
    "phone_code" character varying(10),
    "address_format" "text",
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_country_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_country_cd" IS 'Country codes following ISO 3166-1 alpha-2 standard';



COMMENT ON COLUMN "public"."sys_country_cd"."code" IS 'ISO 3166-1 alpha-2 country code (e.g., SA, US, GB, AE)';



COMMENT ON COLUMN "public"."sys_country_cd"."iso_alpha3" IS 'ISO 3166-1 alpha-3 country code (e.g., SAU, USA, GBR)';



CREATE TABLE IF NOT EXISTS "public"."sys_currency_cd" (
    "code" character varying(3) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "symbol" character varying(10) NOT NULL,
    "symbol_position" character varying(10) DEFAULT 'after'::character varying,
    "decimal_places" integer DEFAULT 2,
    "thousands_separator" character varying(5) DEFAULT ','::character varying,
    "decimal_separator" character varying(5) DEFAULT '.'::character varying,
    "iso_code" character varying(3) NOT NULL,
    "iso_numeric" integer,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_currency_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_currency_cd" IS 'Currency codes following ISO 4217 standard';



COMMENT ON COLUMN "public"."sys_currency_cd"."code" IS 'ISO 4217 currency code (e.g., SAR, USD, EUR, GBP)';



COMMENT ON COLUMN "public"."sys_currency_cd"."iso_numeric" IS 'ISO 4217 numeric code (e.g., 682 for SAR, 840 for USD)';



CREATE TABLE IF NOT EXISTS "public"."sys_customers_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_source_type" "text" DEFAULT 'DIRECT'::"text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "display_name" "text",
    "name" "text",
    "name2" "text",
    "phone" "text",
    "email" "text",
    "type" "text" DEFAULT 'walk_in'::"text",
    "address" "text",
    "area" "text",
    "building" "text",
    "floor" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "first_tenant_org_id" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "customer_number" character varying(50),
    "profile_status" character varying(20) DEFAULT 'guest'::character varying,
    "phone_verified" boolean DEFAULT false,
    "email_verified" boolean DEFAULT false,
    "avatar_url" character varying(500)
);


ALTER TABLE "public"."sys_customers_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_customers_mst" IS 'Global customer identities (shared across tenants)';



COMMENT ON COLUMN "public"."sys_customers_mst"."first_tenant_org_id" IS 'First tenant that created this customer';



COMMENT ON COLUMN "public"."sys_customers_mst"."customer_number" IS 'Tenant-specific customer number (CUST-00001)';



COMMENT ON COLUMN "public"."sys_customers_mst"."profile_status" IS 'Customer profile type: guest, stub, full';



COMMENT ON COLUMN "public"."sys_customers_mst"."phone_verified" IS 'Phone verified via OTP';



COMMENT ON COLUMN "public"."sys_customers_mst"."email_verified" IS 'Email verified via link';



COMMENT ON COLUMN "public"."sys_customers_mst"."avatar_url" IS 'Profile picture URL';



CREATE TABLE IF NOT EXISTS "public"."sys_fabric_type_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "fabric_category" character varying(50),
    "care_level" character varying(20),
    "temperature_max_celsius" integer,
    "requires_dry_clean" boolean DEFAULT false,
    "requires_hand_wash" boolean DEFAULT false,
    "can_bleach" boolean DEFAULT false,
    "can_iron" boolean DEFAULT true,
    "iron_temperature" character varying(20),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_fabric_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_fabric_type_cd" IS 'Fabric type codes (COTTON, SILK, WOOL, POLYESTER, etc.)';



COMMENT ON COLUMN "public"."sys_fabric_type_cd"."code" IS 'Unique fabric type code (e.g., COTTON, SILK, WOOL, POLYESTER)';



COMMENT ON COLUMN "public"."sys_fabric_type_cd"."fabric_category" IS 'Fabric category (natural, synthetic, blend, leather, other)';



CREATE TABLE IF NOT EXISTS "public"."sys_garment_type_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "garment_category" character varying(50),
    "gender" character varying(20),
    "care_instructions" "text",
    "default_base_price" numeric(10,2),
    "requires_special_handling" boolean DEFAULT false,
    "handling_multiplier" numeric(5,2) DEFAULT 1.0,
    "default_service_types" character varying(50)[],
    "estimated_processing_hours" integer,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_garment_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_garment_type_cd" IS 'Garment type codes (SHIRT, PANTS, SUIT, DRESS, etc.)';



COMMENT ON COLUMN "public"."sys_garment_type_cd"."code" IS 'Unique garment type code (e.g., SHIRT, PANTS, SUIT, DRESS)';



COMMENT ON COLUMN "public"."sys_garment_type_cd"."garment_category" IS 'Garment category (top, bottom, outerwear, accessories, other)';



CREATE TABLE IF NOT EXISTS "public"."sys_issue_type_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "issue_category" character varying(50),
    "severity_level" character varying(20),
    "requires_customer_notification" boolean DEFAULT true,
    "requires_refund" boolean DEFAULT false,
    "requires_replacement" boolean DEFAULT false,
    "default_resolution_action" "text",
    "estimated_resolution_hours" integer,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_issue_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_issue_type_cd" IS 'Issue type codes (STAIN, DAMAGE, MISSING_ITEM, COLOR_BLEED, etc.)';



COMMENT ON COLUMN "public"."sys_issue_type_cd"."code" IS 'Unique issue type code (e.g., STAIN, DAMAGE, MISSING_ITEM)';



COMMENT ON COLUMN "public"."sys_issue_type_cd"."severity_level" IS 'Severity level (low, medium, high, critical)';



CREATE TABLE IF NOT EXISTS "public"."sys_item_type_cd" (
    "item_type_code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "is_garment" boolean DEFAULT true,
    "is_retail" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer
);


ALTER TABLE "public"."sys_item_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_item_type_cd" IS 'Item type classifications (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';



COMMENT ON COLUMN "public"."sys_item_type_cd"."is_garment" IS 'True for garment types (TOPS, BOTTOMS), false for retail goods';



COMMENT ON COLUMN "public"."sys_item_type_cd"."is_retail" IS 'True for retail product types';



COMMENT ON COLUMN "public"."sys_item_type_cd"."is_system" IS 'True for system types that cannot be deleted';



CREATE TABLE IF NOT EXISTS "public"."sys_language_cd" (
    "code" character varying(2) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "iso_code" character varying(2) NOT NULL,
    "iso_639_2" character varying(3),
    "is_rtl" boolean DEFAULT false,
    "locale_code" character varying(10),
    "date_format" character varying(20) DEFAULT 'YYYY-MM-DD'::character varying,
    "time_format" character varying(20) DEFAULT 'HH:mm'::character varying,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_language_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_language_cd" IS 'Language codes following ISO 639-1 standard';



COMMENT ON COLUMN "public"."sys_language_cd"."code" IS 'ISO 639-1 language code (e.g., en, ar, fr, es)';



COMMENT ON COLUMN "public"."sys_language_cd"."is_rtl" IS 'True for right-to-left languages (Arabic, Hebrew, etc.)';



CREATE TABLE IF NOT EXISTS "public"."sys_metric_type_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "category_code" character varying(50),
    "metric_group" character varying(50),
    "data_type" character varying(20) NOT NULL,
    "unit" character varying(20),
    "calculation_formula" "text",
    "aggregation_period" character varying(20),
    "requires_date_range" boolean DEFAULT true,
    "format_pattern" character varying(50),
    "decimal_places" integer DEFAULT 2,
    "show_trend" boolean DEFAULT true,
    "show_percentage" boolean DEFAULT false,
    "target_value" numeric(15,2),
    "warning_threshold" numeric(15,2),
    "critical_threshold" numeric(15,2),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_metric_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_metric_type_cd" IS 'Metric types for analytics, KPIs, and dashboard widgets';



COMMENT ON COLUMN "public"."sys_metric_type_cd"."code" IS 'Unique metric code (e.g., REVENUE, ORDERS_COUNT, CUSTOMER_COUNT)';



COMMENT ON COLUMN "public"."sys_metric_type_cd"."data_type" IS 'Type of metric data (count, sum, average, percentage, currency, duration)';



COMMENT ON COLUMN "public"."sys_metric_type_cd"."calculation_formula" IS 'SQL query or formula for calculating this metric';



COMMENT ON COLUMN "public"."sys_metric_type_cd"."aggregation_period" IS 'How often this metric is calculated (daily, weekly, monthly, yearly, real_time)';



CREATE TABLE IF NOT EXISTS "public"."sys_notification_channel_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "channel_type" character varying(20),
    "requires_configuration" boolean DEFAULT true,
    "supports_rich_content" boolean DEFAULT false,
    "supports_attachments" boolean DEFAULT false,
    "max_length" integer,
    "cost_per_message" numeric(10,4),
    "daily_limit" integer,
    "rate_limit_per_minute" integer,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_notification_channel_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_notification_channel_cd" IS 'Notification channel codes (EMAIL, SMS, WHATSAPP, PUSH, IN_APP)';



COMMENT ON COLUMN "public"."sys_notification_channel_cd"."code" IS 'Unique channel code (e.g., EMAIL, SMS, WHATSAPP, PUSH, IN_APP)';



COMMENT ON COLUMN "public"."sys_notification_channel_cd"."channel_type" IS 'Channel type (email, sms, push, whatsapp, in_app)';



CREATE TABLE IF NOT EXISTS "public"."sys_notification_type_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "notification_category" character varying(50),
    "priority" character varying(20),
    "requires_action" boolean DEFAULT false,
    "auto_send" boolean DEFAULT true,
    "default_template_code" character varying(50),
    "default_subject" "text",
    "default_body_template" "text",
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_notification_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_notification_type_cd" IS 'Notification type codes (ORDER_READY, PAYMENT_RECEIVED, etc.)';



COMMENT ON COLUMN "public"."sys_notification_type_cd"."code" IS 'Unique notification type code (e.g., ORDER_READY, PAYMENT_RECEIVED)';



COMMENT ON COLUMN "public"."sys_notification_type_cd"."priority" IS 'Notification priority (low, normal, high, urgent)';



CREATE TABLE IF NOT EXISTS "public"."sys_order_status_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "is_initial_status" boolean DEFAULT false,
    "is_final_status" boolean DEFAULT false,
    "allowed_next_statuses" character varying(50)[],
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "default_sla_hours" integer,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_order_status_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_order_status_cd" IS 'System-wide order status codes defining the complete order lifecycle';



COMMENT ON COLUMN "public"."sys_order_status_cd"."code" IS 'Unique status code (e.g., DRAFT, INTAKE, WASHING, READY, DELIVERED)';



COMMENT ON COLUMN "public"."sys_order_status_cd"."allowed_next_statuses" IS 'Array of status codes that this status can transition to';



COMMENT ON COLUMN "public"."sys_order_status_cd"."is_system" IS 'True for system-critical statuses that cannot be deleted';



CREATE TABLE IF NOT EXISTS "public"."sys_order_type_cd" (
    "order_type_id" character varying(30) NOT NULL,
    "order_type_name" character varying(250),
    "order_type_name2" character varying(250),
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "order_type_color1" character varying(60),
    "order_type_color2" character varying(60),
    "order_type_color3" character varying(60),
    "order_type_icon" character varying(120),
    "order_type_image" character varying(120)
);


ALTER TABLE "public"."sys_order_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_order_type_cd" IS 'Global order types (POS, pickup, delivery)';



COMMENT ON COLUMN "public"."sys_order_type_cd"."order_type_name" IS 'Order type name (English)';



COMMENT ON COLUMN "public"."sys_order_type_cd"."order_type_name2" IS 'Order type name (Arabic)';



CREATE TABLE IF NOT EXISTS "public"."sys_otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" character varying(50) NOT NULL,
    "code" character varying(6) NOT NULL,
    "purpose" character varying(20) NOT NULL,
    "expires_at" timestamp without time zone NOT NULL,
    "verified_at" timestamp without time zone,
    "attempts" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."sys_otp_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_otp_codes" IS 'OTP verification codes for phone registration';



COMMENT ON COLUMN "public"."sys_otp_codes"."purpose" IS 'OTP purpose: registration, login, verification';



COMMENT ON COLUMN "public"."sys_otp_codes"."expires_at" IS 'OTP expiration time (typically 5 minutes)';



COMMENT ON COLUMN "public"."sys_otp_codes"."verified_at" IS 'Timestamp when OTP was successfully verified';



COMMENT ON COLUMN "public"."sys_otp_codes"."attempts" IS 'Number of verification attempts (max 3)';



CREATE TABLE IF NOT EXISTS "public"."sys_payment_gateway_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "logo_url" character varying(500),
    "gateway_type" character varying(50) NOT NULL,
    "is_online" boolean DEFAULT true,
    "requires_api_key" boolean DEFAULT true,
    "supported_payment_methods" character varying(50)[],
    "supported_currencies" character varying(10)[],
    "has_transaction_fee" boolean DEFAULT false,
    "fee_percentage" numeric(5,2),
    "fee_fixed_amount" numeric(10,3),
    "available_for_plans" character varying(50)[],
    "min_transaction_amount" numeric(10,3),
    "max_transaction_amount" numeric(10,3),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_payment_gateway_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_payment_gateway_cd" IS 'Payment gateway configurations (Stripe, HyperPay, PayTabs, etc.)';



COMMENT ON COLUMN "public"."sys_payment_gateway_cd"."gateway_type" IS 'Type of payment gateway (stripe, hyperpay, paytabs, manual)';



COMMENT ON COLUMN "public"."sys_payment_gateway_cd"."supported_payment_methods" IS 'Array of payment method codes this gateway supports';



CREATE TABLE IF NOT EXISTS "public"."sys_payment_method_cd" (
    "payment_method_code" "text" NOT NULL,
    "payment_method_name" "text",
    "payment_method_name2" "text",
    "is_enabled" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "payment_type_color1" "text",
    "payment_type_color2" "text",
    "payment_type_color3" "text",
    "payment_type_icon" "text",
    "payment_type_image" "text"
);


ALTER TABLE "public"."sys_payment_method_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_payment_method_cd" IS 'ALL payment_methods in the system: Pay on collect, cash, card, paymet gateways...';



CREATE TABLE IF NOT EXISTS "public"."sys_payment_status_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "is_final" boolean DEFAULT false,
    "is_successful" boolean DEFAULT false,
    "is_failed" boolean DEFAULT false,
    "allows_retry" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_payment_status_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_payment_status_cd" IS 'Payment processing status codes (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)';



COMMENT ON COLUMN "public"."sys_payment_status_cd"."is_final" IS 'True if payment cannot transition to another state';



COMMENT ON COLUMN "public"."sys_payment_status_cd"."allows_retry" IS 'True if payment can be retried from this status';



CREATE TABLE IF NOT EXISTS "public"."sys_payment_type_cd" (
    "payment_type_id" "text" NOT NULL,
    "payment_type_name" "text",
    "payment_type_name2" "text",
    "is_enabled" boolean DEFAULT false NOT NULL,
    "has_plan" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "payment_type_color1" "text",
    "payment_type_color2" "text",
    "payment_type_color3" "text",
    "payment_type_icon" "text",
    "payment_type_image" "text"
);


ALTER TABLE "public"."sys_payment_type_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_payment_type_cd" IS 'Payment type such as: Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup';



COMMENT ON COLUMN "public"."sys_payment_type_cd"."is_enabled" IS 'such as Pay on Delivery, Pay on Pickup should be false';



COMMENT ON COLUMN "public"."sys_payment_type_cd"."has_plan" IS 'such as Pay on Delivery, Pay on Pickup should be true';



CREATE TABLE IF NOT EXISTS "public"."sys_permission_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "permission_category" character varying(50),
    "permission_type" character varying(20),
    "resource_name" character varying(50),
    "rbac_permission_code" character varying(100),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_permission_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_permission_cd" IS 'Permission codes (VIEW_ORDERS, CREATE_ORDERS, EDIT_ORDERS, etc.)';



COMMENT ON COLUMN "public"."sys_permission_cd"."code" IS 'Unique permission code (e.g., VIEW_ORDERS, CREATE_ORDERS, EDIT_ORDERS)';



COMMENT ON COLUMN "public"."sys_permission_cd"."rbac_permission_code" IS 'Reference to sys_auth_permissions.code for full RBAC integration (format: resource:action)';



CREATE TABLE IF NOT EXISTS "public"."sys_plan_features_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "feature_category" character varying(50),
    "feature_type" character varying(50),
    "default_value" "text",
    "max_value" integer,
    "unit" character varying(20),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_plan_features_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_plan_features_cd" IS 'Plan feature codes (MULTI_BRANCH, API_ACCESS, CUSTOM_BRANDING, etc.)';



COMMENT ON COLUMN "public"."sys_plan_features_cd"."code" IS 'Unique feature code (e.g., MULTI_BRANCH, API_ACCESS, CUSTOM_BRANDING)';



COMMENT ON COLUMN "public"."sys_plan_features_cd"."feature_type" IS 'Type of feature: boolean (on/off), limit (numeric limit), addon (optional addon)';



CREATE TABLE IF NOT EXISTS "public"."sys_plan_limits" (
    "plan_code" character varying(50) NOT NULL,
    "plan_name" character varying(100) NOT NULL,
    "plan_name2" character varying(100),
    "plan_description" "text",
    "plan_description2" "text",
    "orders_limit" integer NOT NULL,
    "users_limit" integer NOT NULL,
    "branches_limit" integer NOT NULL,
    "storage_mb_limit" integer NOT NULL,
    "price_monthly" numeric(10,2) NOT NULL,
    "price_yearly" numeric(10,2),
    "feature_flags" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT true,
    "display_order" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."sys_plan_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_plan_limits" IS 'Defines subscription plan tiers and their limits';



COMMENT ON COLUMN "public"."sys_plan_limits"."plan_code" IS 'Unique identifier for the plan (e.g., free, starter, growth)';



COMMENT ON COLUMN "public"."sys_plan_limits"."plan_name" IS 'Display name in English';



COMMENT ON COLUMN "public"."sys_plan_limits"."plan_name2" IS 'Display name in Arabic';



COMMENT ON COLUMN "public"."sys_plan_limits"."orders_limit" IS 'Maximum orders per month (-1 for unlimited)';



COMMENT ON COLUMN "public"."sys_plan_limits"."users_limit" IS 'Maximum active users (-1 for unlimited)';



COMMENT ON COLUMN "public"."sys_plan_limits"."branches_limit" IS 'Maximum branches (-1 for unlimited)';



COMMENT ON COLUMN "public"."sys_plan_limits"."storage_mb_limit" IS 'Maximum storage in MB (-1 for unlimited)';



COMMENT ON COLUMN "public"."sys_plan_limits"."price_monthly" IS 'Monthly price in OMR';



COMMENT ON COLUMN "public"."sys_plan_limits"."price_yearly" IS 'Yearly price in OMR (discounted)';



COMMENT ON COLUMN "public"."sys_plan_limits"."feature_flags" IS 'Features enabled in this plan';



COMMENT ON COLUMN "public"."sys_plan_limits"."is_public" IS 'Whether plan is visible to customers';



COMMENT ON COLUMN "public"."sys_plan_limits"."display_order" IS 'Order for displaying plans (lower = shown first)';



CREATE TABLE IF NOT EXISTS "public"."sys_plans_mst" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "plan_tier" character varying(20),
    "max_tenants" integer,
    "max_users_per_tenant" integer,
    "max_storage_gb" integer,
    "base_price_monthly" numeric(15,2),
    "base_price_annual" numeric(15,2),
    "currency_code" character varying(10) DEFAULT 'SAR'::character varying,
    "includes_features" character varying(50)[],
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_plans_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_plans_mst" IS 'Subscription plan type codes (FREE, STARTER, GROWTH, PRO, ENTERPRISE)';



COMMENT ON COLUMN "public"."sys_plans_mst"."code" IS 'Unique plan code (e.g., FREE, STARTER, GROWTH, PRO, ENTERPRISE)';



COMMENT ON COLUMN "public"."sys_plans_mst"."plan_tier" IS 'Plan tier level (free, starter, growth, pro, enterprise)';



CREATE TABLE IF NOT EXISTS "public"."sys_pln_subscription_plans_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_code" character varying(50) NOT NULL,
    "plan_name" character varying(250) NOT NULL,
    "plan_name_ar" character varying(250),
    "description" "text",
    "description_ar" "text",
    "base_price" numeric(10,3) DEFAULT 0 NOT NULL,
    "annual_price" numeric(10,3),
    "setup_fee" numeric(10,3),
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "billing_cycle" character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    "trial_days" integer DEFAULT 0,
    "features" "jsonb" DEFAULT '{"printing": false, "api_access": false, "driver_app": false, "white_label": false, "multi_branch": false, "pdf_invoices": false, "b2b_contracts": false, "in_app_receipts": false, "loyalty_programs": false, "whatsapp_receipts": false, "advanced_analytics": false, "marketplace_listings": false}'::"jsonb" NOT NULL,
    "limits" "jsonb" DEFAULT '{"max_users": 1, "max_branches": 1, "max_storage_mb": 1000, "max_orders_per_month": -1, "max_api_calls_per_month": 0}'::"jsonb" NOT NULL,
    "overage_pricing" "jsonb" DEFAULT '{"per_user": null, "per_order": null, "per_gb_storage": null}'::"jsonb",
    "is_public" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "recommended" boolean DEFAULT false,
    "plan_color" character varying(60),
    "plan_icon" character varying(120),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(200),
    CONSTRAINT "sys_pln_subscription_plans_mst_billing_cycle_check" CHECK ((("billing_cycle")::"text" = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying, 'custom'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_pln_subscription_plans_mst" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_pln_subscription_plans_mst" IS 'System subscription plans available to all tenants';



CREATE TABLE IF NOT EXISTS "public"."sys_quality_check_status_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "status_type" character varying(20),
    "allows_proceed" boolean DEFAULT true,
    "requires_action" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_quality_check_status_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_quality_check_status_cd" IS 'Quality check status codes (PASSED, FAILED, PENDING, NEEDS_REVIEW)';



COMMENT ON COLUMN "public"."sys_quality_check_status_cd"."code" IS 'Unique quality status code (e.g., PASSED, FAILED, PENDING, NEEDS_REVIEW)';



CREATE TABLE IF NOT EXISTS "public"."sys_report_category_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "parent_category_code" character varying(50),
    "report_type" character varying(50),
    "requires_admin_access" boolean DEFAULT false,
    "allowed_user_roles" character varying(50)[],
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_report_category_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_report_category_cd" IS 'Report categories for organizing analytics, dashboards, and reports';



COMMENT ON COLUMN "public"."sys_report_category_cd"."code" IS 'Unique category code (e.g., FINANCIAL, OPERATIONAL, CUSTOMER, INVENTORY)';



COMMENT ON COLUMN "public"."sys_report_category_cd"."report_type" IS 'Type of report category (financial, operational, customer, inventory)';



COMMENT ON COLUMN "public"."sys_report_category_cd"."allowed_user_roles" IS 'Array of user role codes that can access reports in this category';



CREATE TABLE IF NOT EXISTS "public"."sys_service_category_cd" (
    "service_category_code" character varying(120) NOT NULL,
    "ctg_name" character varying(250) NOT NULL,
    "ctg_name2" character varying(250),
    "ctg_desc" character varying(600),
    "turnaround_hh" numeric(4,2),
    "turnaround_hh_express" numeric(4,2),
    "multiplier_express" numeric(4,2),
    "is_builtin" boolean DEFAULT false NOT NULL,
    "has_fee" boolean DEFAULT false NOT NULL,
    "is_mandatory" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_order" integer DEFAULT 1,
    "rec_status" smallint DEFAULT 1,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "service_category_color1" character varying(60),
    "service_category_color2" character varying(60),
    "service_category_color3" character varying(60),
    "service_category_icon" character varying(120),
    "service_category_image" character varying(120),
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "is_system" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."sys_service_category_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_service_category_cd" IS 'Global service categories';



COMMENT ON COLUMN "public"."sys_service_category_cd"."ctg_name" IS 'Category name (English)';



COMMENT ON COLUMN "public"."sys_service_category_cd"."ctg_name2" IS 'Category name (Arabic)';



CREATE TABLE IF NOT EXISTS "public"."sys_service_prod_templates_cd" (
    "template_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "hint_text" "text",
    "hint_text2" "text",
    "service_category_code" character varying(120),
    "item_type_code" character varying(50),
    "is_retail_item" boolean DEFAULT false,
    "product_group1" character varying(60),
    "product_group2" character varying(60),
    "product_group3" character varying(60),
    "price_type" character varying(20),
    "product_unit" character varying(60),
    "default_sell_price" numeric(19,4),
    "default_express_sell_price" numeric(19,4),
    "product_cost" numeric(19,4),
    "min_sell_price" numeric(19,4),
    "min_quantity" integer DEFAULT 1,
    "pieces_per_product" integer DEFAULT 1,
    "turnaround_hh" numeric(4,2),
    "turnaround_hh_express" numeric(4,2),
    "multiplier_express" numeric(4,2) DEFAULT 1.50,
    "extra_days" integer DEFAULT 0,
    "default_workflow_steps" character varying(50)[],
    "requires_item_count" boolean DEFAULT true,
    "requires_weight" boolean DEFAULT false,
    "requires_dimensions" boolean DEFAULT false,
    "is_to_seed" boolean DEFAULT true,
    "seed_priority" integer DEFAULT 100,
    "seed_options" "jsonb",
    "is_express_available" boolean DEFAULT true,
    "is_subscription_available" boolean DEFAULT true,
    "tags" json,
    "id_sku" character varying(100),
    "metadata" "jsonb",
    "product_color1" character varying(60),
    "product_color2" character varying(60),
    "product_color3" character varying(60),
    "product_icon" character varying(120),
    "product_image" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text",
    "rec_status" smallint DEFAULT 1,
    "rec_order" integer,
    "rec_notes" character varying(200),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."sys_service_prod_templates_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_service_prod_templates_cd" IS 'Master catalog of product templates for tenant initialization';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."template_code" IS 'Unique template code (e.g., SHRT_BUS, DETERGENT_500ML)';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."service_category_code" IS 'Service category (DRY_CLEAN, LAUNDRY, RETAIL_ITEMS, etc.)';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."item_type_code" IS 'Item type (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."default_sell_price" IS 'Template price (reference only, NOT used in production)';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."is_to_seed" IS 'Auto-seed this template on new tenant initialization';



COMMENT ON COLUMN "public"."sys_service_prod_templates_cd"."seed_priority" IS 'Seeding priority (lower numbers seed first, range: 10-1000)';



CREATE TABLE IF NOT EXISTS "public"."sys_tenant_lifecycle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "lifecycle_stage" character varying(50) DEFAULT 'trial'::character varying NOT NULL,
    "onboarding_status" character varying(50) DEFAULT 'not_started'::character varying,
    "onboarding_started_at" timestamp with time zone,
    "onboarding_completed_at" timestamp with time zone,
    "onboarding_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "suspension_reason" "text",
    "suspended_at" timestamp with time zone,
    "suspended_by" "uuid",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "data_retention_until" "date",
    "health_score" numeric(5,2) DEFAULT 0.00,
    "churn_prediction_score" numeric(3,2),
    "last_health_calculated_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    "last_order_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sys_tenant_lifecycle_churn_prediction_score_check" CHECK ((("churn_prediction_score" >= (0)::numeric) AND ("churn_prediction_score" <= (1)::numeric))),
    CONSTRAINT "sys_tenant_lifecycle_health_score_check" CHECK ((("health_score" >= (0)::numeric) AND ("health_score" <= (100)::numeric))),
    CONSTRAINT "sys_tenant_lifecycle_lifecycle_stage_check" CHECK ((("lifecycle_stage")::"text" = ANY ((ARRAY['trial'::character varying, 'active'::character varying, 'suspended'::character varying, 'cancelled'::character varying, 'churned'::character varying])::"text"[]))),
    CONSTRAINT "sys_tenant_lifecycle_onboarding_status_check" CHECK ((("onboarding_status")::"text" = ANY ((ARRAY['not_started'::character varying, 'in_progress'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."sys_tenant_lifecycle" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_tenant_lifecycle" IS 'Tracks tenant lifecycle stages, health scores, and onboarding progress';



CREATE TABLE IF NOT EXISTS "public"."sys_tenant_metrics_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "orders_created" integer DEFAULT 0,
    "orders_completed" integer DEFAULT 0,
    "orders_cancelled" integer DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "avg_order_value" numeric(10,2) DEFAULT 0,
    "active_customers" integer DEFAULT 0,
    "new_customers" integer DEFAULT 0,
    "active_users" integer DEFAULT 0,
    "total_logins" integer DEFAULT 0,
    "storage_mb_used" numeric(10,2) DEFAULT 0,
    "api_calls" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."sys_tenant_metrics_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_tenant_metrics_daily" IS 'Daily aggregated metrics for tenant analytics and reporting';



CREATE TABLE IF NOT EXISTS "public"."sys_tenant_settings_cd" (
    "setting_code" "text" NOT NULL,
    "setting_name" "text",
    "setting_name2" "text",
    "setting_desc" "text",
    "setting_value_type" "text",
    "setting_value" "text",
    "is_for_tenants_org" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_per_tenant_org_id" boolean DEFAULT true NOT NULL,
    "is_per_branch_id" boolean DEFAULT false NOT NULL,
    "is_per_user_id" boolean DEFAULT false NOT NULL,
    "rec_order" integer,
    "rec_notes" "text",
    "rec_status" smallint DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "created_info" "text",
    "updated_at" timestamp with time zone,
    "updated_by" "text",
    "updated_info" "text",
    CONSTRAINT "sys_tenant_settings_cd_setting_value_type_check" CHECK (("setting_value_type" = ANY (ARRAY['BOOLEAN'::"text", 'TEXT'::"text", 'NUMBER'::"text", 'DATE'::"text"])))
);


ALTER TABLE "public"."sys_tenant_settings_cd" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_timezone_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "utc_offset_hours" integer NOT NULL,
    "utc_offset_minutes" integer DEFAULT 0,
    "utc_offset_string" character varying(10),
    "uses_dst" boolean DEFAULT false,
    "dst_start_rule" "text",
    "dst_end_rule" "text",
    "region" character varying(50),
    "country_code" character varying(2),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_timezone_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_timezone_cd" IS 'Timezone codes following IANA timezone database';



COMMENT ON COLUMN "public"."sys_timezone_cd"."code" IS 'IANA timezone identifier (e.g., Asia/Riyadh, America/New_York, Europe/London)';



COMMENT ON COLUMN "public"."sys_timezone_cd"."utc_offset_hours" IS 'UTC offset in hours (e.g., 3 for UTC+3, -5 for UTC-5)';



CREATE TABLE IF NOT EXISTS "public"."sys_user_role_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "role_level" character varying(20),
    "access_level" character varying(20),
    "is_platform_role" boolean DEFAULT false,
    "is_tenant_role" boolean DEFAULT true,
    "rbac_role_code" character varying(50),
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_user_role_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_user_role_cd" IS 'User role codes (OWNER, ADMIN, MANAGER, OPERATOR, VIEWER)';



COMMENT ON COLUMN "public"."sys_user_role_cd"."code" IS 'Unique role code (e.g., OWNER, ADMIN, MANAGER, OPERATOR, VIEWER)';



COMMENT ON COLUMN "public"."sys_user_role_cd"."rbac_role_code" IS 'Reference to sys_auth_roles.code for full RBAC integration';



CREATE TABLE IF NOT EXISTS "public"."sys_workflow_step_cd" (
    "code" character varying(50) NOT NULL,
    "name" character varying(250) NOT NULL,
    "name2" character varying(250),
    "description" "text",
    "description2" "text",
    "display_order" integer DEFAULT 0,
    "icon" character varying(100),
    "color" character varying(60),
    "step_category" character varying(50),
    "step_type" character varying(50),
    "is_required" boolean DEFAULT true,
    "estimated_duration_hours" integer,
    "allowed_next_steps" character varying(50)[],
    "requires_scan" boolean DEFAULT false,
    "requires_signature" boolean DEFAULT false,
    "requires_photo" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_at" timestamp without time zone,
    "updated_by" "uuid",
    "rec_status" smallint DEFAULT 1
);


ALTER TABLE "public"."sys_workflow_step_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_workflow_step_cd" IS 'Workflow step codes (INTAKE, SORTING, WASHING, DRYING, PRESSING, PACKAGING, DELIVERY)';



COMMENT ON COLUMN "public"."sys_workflow_step_cd"."code" IS 'Unique workflow step code (e.g., INTAKE, WASHING, PRESSING, DELIVERY)';



COMMENT ON COLUMN "public"."sys_workflow_step_cd"."allowed_next_steps" IS 'Array of step codes that can follow this step';



CREATE TABLE IF NOT EXISTS "public"."sys_workflow_template_cd" (
    "template_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_code" character varying(50) NOT NULL,
    "template_name" character varying(250) NOT NULL,
    "template_name2" character varying(250),
    "template_desc" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_order" integer DEFAULT 0,
    "rec_status" smallint DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."sys_workflow_template_cd" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_workflow_template_cd" IS 'Global workflow template definitions shared across all tenants';



COMMENT ON COLUMN "public"."sys_workflow_template_cd"."template_code" IS 'Template code (WF_SIMPLE, WF_STANDARD, etc.)';



COMMENT ON COLUMN "public"."sys_workflow_template_cd"."template_name" IS 'Template name (English)';



COMMENT ON COLUMN "public"."sys_workflow_template_cd"."template_name2" IS 'Template name (Arabic)';



CREATE TABLE IF NOT EXISTS "public"."sys_workflow_template_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "stage_code" character varying(50) NOT NULL,
    "stage_name" character varying(250) NOT NULL,
    "stage_name2" character varying(250),
    "stage_type" character varying(50) NOT NULL,
    "seq_no" integer NOT NULL,
    "is_terminal" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."sys_workflow_template_stages" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_workflow_template_stages" IS 'Stages per workflow template with sequence and metadata';



COMMENT ON COLUMN "public"."sys_workflow_template_stages"."stage_code" IS 'Stage code (intake, preparing, processing, assembly, qa, ready, delivered)';



COMMENT ON COLUMN "public"."sys_workflow_template_stages"."stage_type" IS 'Stage type: operational, qa, delivery';



COMMENT ON COLUMN "public"."sys_workflow_template_stages"."seq_no" IS 'Sequence number defining order of stages';



COMMENT ON COLUMN "public"."sys_workflow_template_stages"."is_terminal" IS 'True if this is a terminal stage (cannot transition from)';



CREATE TABLE IF NOT EXISTS "public"."sys_workflow_template_transitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "from_stage_code" character varying(50) NOT NULL,
    "to_stage_code" character varying(50) NOT NULL,
    "requires_scan_ok" boolean DEFAULT false,
    "requires_invoice" boolean DEFAULT false,
    "requires_pod" boolean DEFAULT false,
    "allow_manual" boolean DEFAULT true,
    "auto_when_done" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."sys_workflow_template_transitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_workflow_template_transitions" IS 'Allowed transitions between stages with validation rules';



COMMENT ON COLUMN "public"."sys_workflow_template_transitions"."requires_scan_ok" IS 'Require successful scan to allow transition';



COMMENT ON COLUMN "public"."sys_workflow_template_transitions"."requires_invoice" IS 'Require invoice to allow transition';



COMMENT ON COLUMN "public"."sys_workflow_template_transitions"."requires_pod" IS 'Require proof of delivery to allow transition';



COMMENT ON COLUMN "public"."sys_workflow_template_transitions"."allow_manual" IS 'Allow manual transition by user';



COMMENT ON COLUMN "public"."sys_workflow_template_transitions"."auto_when_done" IS 'Auto-transition when all items are done';



CREATE OR REPLACE VIEW "public"."v_effective_tenant_settings" AS
 WITH "ranked" AS (
         SELECT COALESCE("o"."tenant_org_id", NULL::"uuid") AS "tenant_org_id",
            COALESCE("o"."branch_id", NULL::"uuid") AS "branch_id",
            COALESCE("o"."user_id", NULL::"uuid") AS "user_id",
            "s"."setting_code",
            COALESCE("o"."setting_name", "s"."setting_name") AS "setting_name",
            COALESCE("o"."setting_name2", "s"."setting_name2") AS "setting_name2",
            COALESCE("o"."setting_desc", "s"."setting_desc") AS "setting_desc",
            COALESCE("o"."setting_value_type", "s"."setting_value_type") AS "setting_value_type",
            COALESCE("o"."setting_value", "s"."setting_value") AS "setting_value",
            COALESCE("o"."is_active", "s"."is_active") AS "is_active",
                CASE
                    WHEN ("o"."user_id" IS NOT NULL) THEN 'user'::"text"
                    WHEN ("o"."branch_id" IS NOT NULL) THEN 'branch'::"text"
                    WHEN ("o"."tenant_org_id" IS NOT NULL) THEN 'tenant'::"text"
                    ELSE 'system'::"text"
                END AS "source",
            "row_number"() OVER (PARTITION BY COALESCE("o"."tenant_org_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "s"."setting_code" ORDER BY ("o"."user_id" IS NOT NULL) DESC, ("o"."branch_id" IS NOT NULL) DESC, "o"."updated_at" DESC NULLS LAST, "o"."created_at" DESC NULLS LAST) AS "rn"
           FROM ("public"."sys_tenant_settings_cd" "s"
             LEFT JOIN "public"."org_tenant_settings_cf" "o" ON (("s"."setting_code" = "o"."setting_code")))
        )
 SELECT "tenant_org_id",
    "branch_id",
    "user_id",
    "setting_code",
    "setting_name",
    "setting_name2",
    "setting_desc",
    "setting_value_type",
    "setting_value",
    "is_active",
    "source"
   FROM "ranked"
  WHERE ("rn" = 1);


ALTER VIEW "public"."v_effective_tenant_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "ak_global_customer_id_org_cust" UNIQUE ("tenant_org_id", "customer_id");



ALTER TABLE ONLY "public"."hq_audit_logs"
    ADD CONSTRAINT "hq_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hq_roles"
    ADD CONSTRAINT "hq_roles_pkey" PRIMARY KEY ("role_code");



ALTER TABLE ONLY "public"."hq_session_tokens"
    ADD CONSTRAINT "hq_session_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hq_session_tokens"
    ADD CONSTRAINT "hq_session_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."hq_tenant_status_history"
    ADD CONSTRAINT "hq_tenant_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hq_users"
    ADD CONSTRAINT "hq_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."hq_users"
    ADD CONSTRAINT "hq_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_permissions"
    ADD CONSTRAINT "org_auth_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_permissions"
    ADD CONSTRAINT "org_auth_user_permissions_user_id_tenant_org_id_permission__key" UNIQUE ("user_id", "tenant_org_id", "permission_id");



ALTER TABLE ONLY "public"."org_auth_user_resource_permissions"
    ADD CONSTRAINT "org_auth_user_resource_permis_user_id_tenant_org_id_resourc_key" UNIQUE ("user_id", "tenant_org_id", "resource_type", "resource_id", "permission_id");



ALTER TABLE ONLY "public"."org_auth_user_resource_permissions"
    ADD CONSTRAINT "org_auth_user_resource_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_resource_roles"
    ADD CONSTRAINT "org_auth_user_resource_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_resource_roles"
    ADD CONSTRAINT "org_auth_user_resource_roles_user_id_tenant_org_id_resource_key" UNIQUE ("user_id", "tenant_org_id", "resource_type", "resource_id", "role_id");



ALTER TABLE ONLY "public"."org_auth_user_roles"
    ADD CONSTRAINT "org_auth_user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_roles"
    ADD CONSTRAINT "org_auth_user_roles_user_id_tenant_org_id_role_id_key" UNIQUE ("user_id", "tenant_org_id", "role_id");



ALTER TABLE ONLY "public"."org_auth_user_workflow_roles"
    ADD CONSTRAINT "org_auth_user_workflow_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_auth_user_workflow_roles"
    ADD CONSTRAINT "org_auth_user_workflow_roles_user_id_tenant_org_id_workflow_key" UNIQUE ("user_id", "tenant_org_id", "workflow_role");



ALTER TABLE ONLY "public"."org_branches_mst"
    ADD CONSTRAINT "org_branches_mst_pkey" PRIMARY KEY ("id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_customer_addresses"
    ADD CONSTRAINT "org_customer_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_customer_merge_log"
    ADD CONSTRAINT "org_customer_merge_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_discount_rules_cf"
    ADD CONSTRAINT "org_discount_rules_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_discount_rules_cf"
    ADD CONSTRAINT "org_discount_rules_unique" UNIQUE ("tenant_org_id", "rule_code");



ALTER TABLE ONLY "public"."org_gift_card_transactions"
    ADD CONSTRAINT "org_gift_card_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_gift_cards_mst"
    ADD CONSTRAINT "org_gift_cards_mst_card_number_key" UNIQUE ("card_number");



ALTER TABLE ONLY "public"."org_gift_cards_mst"
    ADD CONSTRAINT "org_gift_cards_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "org_invoice_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "org_invoice_mst_tenant_org_id_invoice_no_key" UNIQUE ("tenant_org_id", "invoice_no");



ALTER TABLE ONLY "public"."org_order_history"
    ADD CONSTRAINT "org_order_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "org_order_item_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_order_item_processing_steps"
    ADD CONSTRAINT "org_order_item_processing_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "org_order_items_dtl_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_order_status_history"
    ADD CONSTRAINT "org_order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "org_orders_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "org_orders_mst_tenant_org_id_order_no_key" UNIQUE ("tenant_org_id", "order_no");



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "org_payments_dtl_tr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_pln_change_history_tr"
    ADD CONSTRAINT "org_pln_change_history_tr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_pln_subscriptions_mst"
    ADD CONSTRAINT "org_pln_subscriptions_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_pln_subscriptions_mst"
    ADD CONSTRAINT "org_pln_subscriptions_mst_tenant_org_id_id_key" UNIQUE ("tenant_org_id", "id");



ALTER TABLE ONLY "public"."org_price_list_items_dtl"
    ADD CONSTRAINT "org_price_list_items_dtl_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_price_lists_mst"
    ADD CONSTRAINT "org_price_lists_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "org_product_data_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "org_product_data_mst_tenant_org_id_product_code_key" UNIQUE ("tenant_org_id", "product_code");



ALTER TABLE ONLY "public"."org_promo_codes_mst"
    ADD CONSTRAINT "org_promo_codes_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_promo_codes_mst"
    ADD CONSTRAINT "org_promo_codes_unique" UNIQUE ("tenant_org_id", "promo_code");



ALTER TABLE ONLY "public"."org_promo_usage_log"
    ADD CONSTRAINT "org_promo_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "org_service_category_cf_pkey" PRIMARY KEY ("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_subscriptions_mst"
    ADD CONSTRAINT "org_subscriptions_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenant_service_category_workflow_cf"
    ADD CONSTRAINT "org_tenant_service_category_w_tenant_org_id_service_categor_key" UNIQUE ("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_tenant_service_category_workflow_cf"
    ADD CONSTRAINT "org_tenant_service_category_workflow_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenant_settings_cf"
    ADD CONSTRAINT "org_tenant_settings_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenant_workflow_settings_cf"
    ADD CONSTRAINT "org_tenant_workflow_settings_cf_pkey" PRIMARY KEY ("tenant_org_id");



ALTER TABLE ONLY "public"."org_tenant_workflow_templates_cf"
    ADD CONSTRAINT "org_tenant_workflow_templates_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."org_usage_tracking"
    ADD CONSTRAINT "org_usage_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_usage_tracking"
    ADD CONSTRAINT "org_usage_tracking_tenant_org_id_period_start_key" UNIQUE ("tenant_org_id", "period_start");



ALTER TABLE ONLY "public"."org_users_mst"
    ADD CONSTRAINT "org_users_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_users_mst"
    ADD CONSTRAINT "org_users_mst_user_id_tenant_org_id_key" UNIQUE ("user_id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_workflow_rules"
    ADD CONSTRAINT "org_workflow_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_workflow_rules"
    ADD CONSTRAINT "org_workflow_rules_tenant_org_id_from_status_to_status_key" UNIQUE ("tenant_org_id", "from_status", "to_status");



ALTER TABLE ONLY "public"."org_workflow_settings_cf"
    ADD CONSTRAINT "org_workflow_settings_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_workflow_settings_cf"
    ADD CONSTRAINT "org_workflow_settings_cf_tenant_org_id_service_category_cod_key" UNIQUE ("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "pk_org_customers_mst" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_payment_method_cd"
    ADD CONSTRAINT "pk_sys_payment_method_cd" PRIMARY KEY ("payment_method_code");



ALTER TABLE ONLY "public"."sys_payment_type_cd"
    ADD CONSTRAINT "pk_sys_payment_type_cd" PRIMARY KEY ("payment_type_id");



ALTER TABLE ONLY "public"."sys_audit_log"
    ADD CONSTRAINT "sys_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_auth_permissions"
    ADD CONSTRAINT "sys_auth_permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sys_auth_permissions"
    ADD CONSTRAINT "sys_auth_permissions_pkey" PRIMARY KEY ("permission_id");



ALTER TABLE ONLY "public"."sys_auth_role_default_permissions"
    ADD CONSTRAINT "sys_auth_role_default_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."sys_auth_roles"
    ADD CONSTRAINT "sys_auth_roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sys_auth_roles"
    ADD CONSTRAINT "sys_auth_roles_pkey" PRIMARY KEY ("role_id");



ALTER TABLE ONLY "public"."sys_bill_discount_codes_mst"
    ADD CONSTRAINT "sys_bill_discount_codes_mst_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sys_bill_discount_codes_mst"
    ADD CONSTRAINT "sys_bill_discount_codes_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_discount_redemptions_tr"
    ADD CONSTRAINT "sys_bill_discount_redemptions_tr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_dunning_mst"
    ADD CONSTRAINT "sys_bill_dunning_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_invoice_payments_tr"
    ADD CONSTRAINT "sys_bill_invoice_payments_tr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_invoices_mst"
    ADD CONSTRAINT "sys_bill_invoices_mst_invoice_no_key" UNIQUE ("invoice_no");



ALTER TABLE ONLY "public"."sys_bill_invoices_mst"
    ADD CONSTRAINT "sys_bill_invoices_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_invoices_mst"
    ADD CONSTRAINT "sys_bill_invoices_mst_tenant_org_id_id_key" UNIQUE ("tenant_org_id", "id");



ALTER TABLE ONLY "public"."sys_bill_payment_gateways_cf"
    ADD CONSTRAINT "sys_bill_payment_gateways_cf_gateway_code_key" UNIQUE ("gateway_code");



ALTER TABLE ONLY "public"."sys_bill_payment_gateways_cf"
    ADD CONSTRAINT "sys_bill_payment_gateways_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_payment_method_codes_cd"
    ADD CONSTRAINT "sys_bill_payment_method_codes_cd_method_code_key" UNIQUE ("method_code");



ALTER TABLE ONLY "public"."sys_bill_payment_method_codes_cd"
    ADD CONSTRAINT "sys_bill_payment_method_codes_cd_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_payment_methods_mst"
    ADD CONSTRAINT "sys_bill_payment_methods_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_payment_methods_mst"
    ADD CONSTRAINT "sys_bill_payment_methods_mst_tenant_org_id_id_key" UNIQUE ("tenant_org_id", "id");



ALTER TABLE ONLY "public"."sys_bill_revenue_metrics_monthly"
    ADD CONSTRAINT "sys_bill_revenue_metrics_monthly_metric_month_key" UNIQUE ("metric_month");



ALTER TABLE ONLY "public"."sys_bill_revenue_metrics_monthly"
    ADD CONSTRAINT "sys_bill_revenue_metrics_monthly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_usage_metrics_daily"
    ADD CONSTRAINT "sys_bill_usage_metrics_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_bill_usage_metrics_daily"
    ADD CONSTRAINT "sys_bill_usage_metrics_daily_tenant_org_id_metric_date_key" UNIQUE ("tenant_org_id", "metric_date");



ALTER TABLE ONLY "public"."sys_billing_cycle_cd"
    ADD CONSTRAINT "sys_billing_cycle_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_code_table_audit_log"
    ADD CONSTRAINT "sys_code_table_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_code_tables_registry"
    ADD CONSTRAINT "sys_code_tables_registry_pkey" PRIMARY KEY ("table_name");



ALTER TABLE ONLY "public"."sys_country_cd"
    ADD CONSTRAINT "sys_country_cd_iso_code_key" UNIQUE ("iso_code");



ALTER TABLE ONLY "public"."sys_country_cd"
    ADD CONSTRAINT "sys_country_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_currency_cd"
    ADD CONSTRAINT "sys_currency_cd_iso_code_key" UNIQUE ("iso_code");



ALTER TABLE ONLY "public"."sys_currency_cd"
    ADD CONSTRAINT "sys_currency_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_customers_mst"
    ADD CONSTRAINT "sys_customers_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_fabric_type_cd"
    ADD CONSTRAINT "sys_fabric_type_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_garment_type_cd"
    ADD CONSTRAINT "sys_garment_type_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_issue_type_cd"
    ADD CONSTRAINT "sys_issue_type_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_item_type_cd"
    ADD CONSTRAINT "sys_item_type_cd_pkey" PRIMARY KEY ("item_type_code");



ALTER TABLE ONLY "public"."sys_language_cd"
    ADD CONSTRAINT "sys_language_cd_iso_code_key" UNIQUE ("iso_code");



ALTER TABLE ONLY "public"."sys_language_cd"
    ADD CONSTRAINT "sys_language_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_metric_type_cd"
    ADD CONSTRAINT "sys_metric_type_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_notification_channel_cd"
    ADD CONSTRAINT "sys_notification_channel_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_notification_type_cd"
    ADD CONSTRAINT "sys_notification_type_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_order_status_cd"
    ADD CONSTRAINT "sys_order_status_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_order_type_cd"
    ADD CONSTRAINT "sys_order_type_cd_pkey" PRIMARY KEY ("order_type_id");



ALTER TABLE ONLY "public"."sys_otp_codes"
    ADD CONSTRAINT "sys_otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_payment_gateway_cd"
    ADD CONSTRAINT "sys_payment_gateway_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_payment_status_cd"
    ADD CONSTRAINT "sys_payment_status_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_permission_cd"
    ADD CONSTRAINT "sys_permission_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_plan_features_cd"
    ADD CONSTRAINT "sys_plan_features_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_plan_limits"
    ADD CONSTRAINT "sys_plan_limits_pkey" PRIMARY KEY ("plan_code");



ALTER TABLE ONLY "public"."sys_plans_mst"
    ADD CONSTRAINT "sys_plans_mst_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_pln_subscription_plans_mst"
    ADD CONSTRAINT "sys_pln_subscription_plans_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_pln_subscription_plans_mst"
    ADD CONSTRAINT "sys_pln_subscription_plans_mst_plan_code_key" UNIQUE ("plan_code");



ALTER TABLE ONLY "public"."sys_quality_check_status_cd"
    ADD CONSTRAINT "sys_quality_check_status_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_report_category_cd"
    ADD CONSTRAINT "sys_report_category_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_service_category_cd"
    ADD CONSTRAINT "sys_service_category_cd_pkey" PRIMARY KEY ("service_category_code");



ALTER TABLE ONLY "public"."sys_service_prod_templates_cd"
    ADD CONSTRAINT "sys_service_prod_templates_cd_pkey" PRIMARY KEY ("template_id");



ALTER TABLE ONLY "public"."sys_service_prod_templates_cd"
    ADD CONSTRAINT "sys_service_prod_templates_cd_template_code_key" UNIQUE ("template_code");



ALTER TABLE ONLY "public"."sys_tenant_lifecycle"
    ADD CONSTRAINT "sys_tenant_lifecycle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_tenant_lifecycle"
    ADD CONSTRAINT "sys_tenant_lifecycle_tenant_org_id_key" UNIQUE ("tenant_org_id");



ALTER TABLE ONLY "public"."sys_tenant_metrics_daily"
    ADD CONSTRAINT "sys_tenant_metrics_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_tenant_settings_cd"
    ADD CONSTRAINT "sys_tenant_settings_cd_pkey" PRIMARY KEY ("setting_code");



ALTER TABLE ONLY "public"."sys_timezone_cd"
    ADD CONSTRAINT "sys_timezone_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_user_role_cd"
    ADD CONSTRAINT "sys_user_role_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_workflow_step_cd"
    ADD CONSTRAINT "sys_workflow_step_cd_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sys_workflow_template_cd"
    ADD CONSTRAINT "sys_workflow_template_cd_pkey" PRIMARY KEY ("template_id");



ALTER TABLE ONLY "public"."sys_workflow_template_cd"
    ADD CONSTRAINT "sys_workflow_template_cd_template_code_key" UNIQUE ("template_code");



ALTER TABLE ONLY "public"."sys_workflow_template_stages"
    ADD CONSTRAINT "sys_workflow_template_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_workflow_template_stages"
    ADD CONSTRAINT "sys_workflow_template_stages_template_id_stage_code_key" UNIQUE ("template_id", "stage_code");



ALTER TABLE ONLY "public"."sys_workflow_template_transitions"
    ADD CONSTRAINT "sys_workflow_template_transit_template_id_from_stage_code_t_key" UNIQUE ("template_id", "from_stage_code", "to_stage_code");



ALTER TABLE ONLY "public"."sys_workflow_template_transitions"
    ADD CONSTRAINT "sys_workflow_template_transitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "uk_org_products_tenant_id" UNIQUE ("tenant_org_id", "id");



ALTER TABLE ONLY "public"."org_price_list_items_dtl"
    ADD CONSTRAINT "unique_price_list_product" UNIQUE ("price_list_id", "product_id", "min_quantity");



ALTER TABLE ONLY "public"."sys_tenant_metrics_daily"
    ADD CONSTRAINT "unique_tenant_metric_date" UNIQUE ("tenant_org_id", "metric_date");



CREATE INDEX "idx_addresses_customer" ON "public"."org_customer_addresses" USING "btree" ("customer_id", "tenant_org_id");



CREATE INDEX "idx_addresses_default" ON "public"."org_customer_addresses" USING "btree" ("customer_id", "tenant_org_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_addresses_tenant" ON "public"."org_customer_addresses" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_audit_action" ON "public"."sys_audit_log" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_audit_created" ON "public"."sys_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_entity" ON "public"."sys_audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_record" ON "public"."sys_code_table_audit_log" USING "btree" ("table_name", "record_code", "changed_at" DESC);



CREATE INDEX "idx_audit_status" ON "public"."sys_audit_log" USING "btree" ("status") WHERE (("status")::"text" <> 'success'::"text");



CREATE INDEX "idx_audit_table" ON "public"."sys_code_table_audit_log" USING "btree" ("table_name", "changed_at" DESC);



CREATE INDEX "idx_audit_tenant" ON "public"."sys_audit_log" USING "btree" ("tenant_org_id", "created_at" DESC);



CREATE INDEX "idx_audit_user" ON "public"."sys_audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_billing_cycle_active" ON "public"."sys_billing_cycle_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_billing_cycle_type" ON "public"."sys_billing_cycle_cd" USING "btree" ("cycle_type", "is_active");



CREATE INDEX "idx_churn_score" ON "public"."sys_tenant_lifecycle" USING "btree" ("churn_prediction_score" DESC);



CREATE INDEX "idx_cmx_effective_perms_resource" ON "public"."cmx_effective_permissions" USING "btree" ("resource_type", "resource_id") WHERE ("resource_type" IS NOT NULL);



CREATE INDEX "idx_cmx_effective_perms_tenant_perm" ON "public"."cmx_effective_permissions" USING "btree" ("tenant_org_id", "permission_code");



CREATE UNIQUE INDEX "idx_cmx_effective_perms_unique" ON "public"."cmx_effective_permissions" USING "btree" ("user_id", "tenant_org_id", "permission_code", COALESCE("resource_type", ''::"text"), COALESCE("resource_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_cmx_effective_perms_user_tenant" ON "public"."cmx_effective_permissions" USING "btree" ("user_id", "tenant_org_id");



CREATE INDEX "idx_cmx_effective_perms_user_tenant_perm" ON "public"."cmx_effective_permissions" USING "btree" ("user_id", "tenant_org_id", "permission_code");



CREATE INDEX "idx_code_registry_category" ON "public"."sys_code_tables_registry" USING "btree" ("category", "display_order");



CREATE INDEX "idx_code_registry_editable" ON "public"."sys_code_tables_registry" USING "btree" ("is_editable", "is_extensible");



CREATE INDEX "idx_country_active" ON "public"."sys_country_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_country_continent" ON "public"."sys_country_cd" USING "btree" ("continent", "is_active");



CREATE INDEX "idx_country_currency" ON "public"."sys_country_cd" USING "btree" ("default_currency_code") WHERE ("default_currency_code" IS NOT NULL);



CREATE INDEX "idx_country_region" ON "public"."sys_country_cd" USING "btree" ("region", "is_active");



CREATE INDEX "idx_currency_active" ON "public"."sys_currency_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_currency_iso_numeric" ON "public"."sys_currency_cd" USING "btree" ("iso_numeric") WHERE ("iso_numeric" IS NOT NULL);



CREATE INDEX "idx_customers_email" ON "public"."sys_customers_mst" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_customers_number" ON "public"."sys_customers_mst" USING "btree" ("customer_number") WHERE ("customer_number" IS NOT NULL);



CREATE INDEX "idx_customers_phone" ON "public"."sys_customers_mst" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_customers_search" ON "public"."sys_customers_mst" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("first_name", ''::"text") || ' '::"text") || COALESCE("last_name", ''::"text"))));



CREATE INDEX "idx_customers_status" ON "public"."sys_customers_mst" USING "btree" ("profile_status");



CREATE INDEX "idx_discount_rules_priority" ON "public"."org_discount_rules_cf" USING "btree" ("tenant_org_id", "priority" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_discount_rules_tenant" ON "public"."org_discount_rules_cf" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_discount_rules_type" ON "public"."org_discount_rules_cf" USING "btree" ("tenant_org_id", "rule_type") WHERE ("is_active" = true);



CREATE INDEX "idx_discount_rules_validity" ON "public"."org_discount_rules_cf" USING "btree" ("tenant_org_id", "valid_from", "valid_to") WHERE ("is_active" = true);



CREATE INDEX "idx_fabric_type_active" ON "public"."sys_fabric_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_fabric_type_care_level" ON "public"."sys_fabric_type_cd" USING "btree" ("care_level", "is_active");



CREATE INDEX "idx_fabric_type_category" ON "public"."sys_fabric_type_cd" USING "btree" ("fabric_category", "is_active");



CREATE INDEX "idx_garment_type_active" ON "public"."sys_garment_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_garment_type_category" ON "public"."sys_garment_type_cd" USING "btree" ("garment_category", "is_active");



CREATE INDEX "idx_garment_type_gender" ON "public"."sys_garment_type_cd" USING "btree" ("gender", "is_active");



CREATE INDEX "idx_gift_card_trans_card" ON "public"."org_gift_card_transactions" USING "btree" ("tenant_org_id", "gift_card_id");



CREATE INDEX "idx_gift_card_trans_date" ON "public"."org_gift_card_transactions" USING "btree" ("tenant_org_id", "transaction_date" DESC);



CREATE INDEX "idx_gift_card_trans_order" ON "public"."org_gift_card_transactions" USING "btree" ("tenant_org_id", "order_id");



CREATE INDEX "idx_gift_card_trans_tenant" ON "public"."org_gift_card_transactions" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_gift_cards_customer" ON "public"."org_gift_cards_mst" USING "btree" ("tenant_org_id", "issued_to_customer_id");



CREATE INDEX "idx_gift_cards_number" ON "public"."org_gift_cards_mst" USING "btree" ("card_number") WHERE ("is_active" = true);



CREATE INDEX "idx_gift_cards_status" ON "public"."org_gift_cards_mst" USING "btree" ("tenant_org_id", "status") WHERE ("is_active" = true);



CREATE INDEX "idx_gift_cards_tenant" ON "public"."org_gift_cards_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_health_score" ON "public"."sys_tenant_lifecycle" USING "btree" ("health_score" DESC);



CREATE INDEX "idx_history_action_type" ON "public"."org_order_history" USING "btree" ("tenant_org_id", "action_type", "done_at" DESC);



CREATE INDEX "idx_history_order_action" ON "public"."org_order_history" USING "btree" ("order_id", "action_type", "done_at" DESC);



CREATE INDEX "idx_history_order_timeline" ON "public"."org_order_history" USING "btree" ("order_id", "done_at" DESC);



CREATE INDEX "idx_history_tenant" ON "public"."org_order_history" USING "btree" ("tenant_org_id", "done_at" DESC);



CREATE INDEX "idx_history_tenant_action" ON "public"."org_order_history" USING "btree" ("tenant_org_id", "action_type", "done_at" DESC);



CREATE INDEX "idx_history_user" ON "public"."org_order_history" USING "btree" ("done_by", "done_at" DESC) WHERE ("done_by" IS NOT NULL);



CREATE INDEX "idx_hq_audit_action" ON "public"."hq_audit_logs" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_hq_audit_created" ON "public"."hq_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hq_audit_resource" ON "public"."hq_audit_logs" USING "btree" ("resource_type", "resource_id", "created_at" DESC);



CREATE INDEX "idx_hq_audit_user" ON "public"."hq_audit_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_hq_audit_user_email" ON "public"."hq_audit_logs" USING "btree" ("user_email") WHERE ("user_email" IS NOT NULL);



CREATE INDEX "idx_hq_roles_active" ON "public"."hq_roles" USING "btree" ("is_active");



CREATE INDEX "idx_hq_session_expires" ON "public"."hq_session_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_hq_session_token" ON "public"."hq_session_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_hq_session_user" ON "public"."hq_session_tokens" USING "btree" ("user_id", "expires_at" DESC);



CREATE INDEX "idx_hq_users_active" ON "public"."hq_users" USING "btree" ("is_active");



CREATE INDEX "idx_hq_users_email" ON "public"."hq_users" USING "btree" ("email");



CREATE INDEX "idx_hq_users_last_login" ON "public"."hq_users" USING "btree" ("last_login_at" DESC);



CREATE INDEX "idx_hq_users_role" ON "public"."hq_users" USING "btree" ("role_code");



CREATE INDEX "idx_issue_order" ON "public"."org_order_item_issues" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_issue_order_item" ON "public"."org_order_item_issues" USING "btree" ("order_item_id", "created_at" DESC);



CREATE INDEX "idx_issue_priority" ON "public"."org_order_item_issues" USING "btree" ("tenant_org_id", "priority", "created_at" DESC) WHERE ("solved_at" IS NULL);



CREATE INDEX "idx_issue_tenant" ON "public"."org_order_item_issues" USING "btree" ("tenant_org_id", "created_at" DESC);



CREATE INDEX "idx_issue_type_active" ON "public"."sys_issue_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_issue_type_category" ON "public"."sys_issue_type_cd" USING "btree" ("issue_category", "is_active");



CREATE INDEX "idx_issue_type_severity" ON "public"."sys_issue_type_cd" USING "btree" ("severity_level", "is_active");



CREATE INDEX "idx_issue_unresolved" ON "public"."org_order_item_issues" USING "btree" ("tenant_org_id", "solved_at") WHERE ("solved_at" IS NULL);



CREATE INDEX "idx_item_type_active" ON "public"."sys_item_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_item_type_garment" ON "public"."sys_item_type_cd" USING "btree" ("is_garment") WHERE ("is_garment" = true);



CREATE INDEX "idx_item_type_retail" ON "public"."sys_item_type_cd" USING "btree" ("is_retail") WHERE ("is_retail" = true);



CREATE INDEX "idx_language_active" ON "public"."sys_language_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_language_rtl" ON "public"."sys_language_cd" USING "btree" ("is_rtl", "is_active");



CREATE INDEX "idx_last_activity" ON "public"."sys_tenant_lifecycle" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_lifecycle_stage" ON "public"."sys_tenant_lifecycle" USING "btree" ("lifecycle_stage");



CREATE INDEX "idx_merge_log_date" ON "public"."org_customer_merge_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_merge_log_source" ON "public"."org_customer_merge_log" USING "btree" ("source_customer_id");



CREATE INDEX "idx_merge_log_target" ON "public"."org_customer_merge_log" USING "btree" ("target_customer_id");



CREATE INDEX "idx_merge_log_tenant" ON "public"."org_customer_merge_log" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_metric_type_active" ON "public"."sys_metric_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_metric_type_category" ON "public"."sys_metric_type_cd" USING "btree" ("category_code", "is_active");



CREATE INDEX "idx_metric_type_group" ON "public"."sys_metric_type_cd" USING "btree" ("metric_group", "is_active");



CREATE INDEX "idx_metrics_date" ON "public"."sys_tenant_metrics_daily" USING "btree" ("metric_date" DESC);



CREATE INDEX "idx_metrics_tenant_date" ON "public"."sys_tenant_metrics_daily" USING "btree" ("tenant_org_id", "metric_date" DESC);



CREATE INDEX "idx_notification_channel_active" ON "public"."sys_notification_channel_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_notification_channel_type" ON "public"."sys_notification_channel_cd" USING "btree" ("channel_type", "is_active");



CREATE INDEX "idx_notification_type_active" ON "public"."sys_notification_type_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_notification_type_category" ON "public"."sys_notification_type_cd" USING "btree" ("notification_category", "is_active");



CREATE INDEX "idx_notification_type_priority" ON "public"."sys_notification_type_cd" USING "btree" ("priority", "is_active");



CREATE INDEX "idx_onboarding_status" ON "public"."sys_tenant_lifecycle" USING "btree" ("onboarding_status");



CREATE INDEX "idx_order_items_issue" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "item_issue_id") WHERE ("item_issue_id" IS NOT NULL);



CREATE INDEX "idx_order_items_partially_ready" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "order_id") WHERE (("quantity_ready" > 0) AND ("quantity_ready" < "quantity"));



CREATE INDEX "idx_order_items_quantity_ready" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "quantity_ready") WHERE ("quantity_ready" > 0);



CREATE INDEX "idx_order_items_stage" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "item_stage");



CREATE INDEX "idx_order_items_status" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "item_status");



CREATE INDEX "idx_order_items_tenant" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_order_items_tenant_barcode" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "barcode");



CREATE INDEX "idx_order_items_tenant_order" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "order_id");



CREATE INDEX "idx_order_items_tenant_status" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id", "status");



CREATE INDEX "idx_order_status_active" ON "public"."sys_order_status_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_order_status_final" ON "public"."sys_order_status_cd" USING "btree" ("is_final_status") WHERE ("is_final_status" = true);



CREATE INDEX "idx_order_status_initial" ON "public"."sys_order_status_cd" USING "btree" ("is_initial_status") WHERE ("is_initial_status" = true);



CREATE INDEX "idx_orders_current_status" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "current_status");



CREATE INDEX "idx_orders_has_issue" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "has_issue", "current_status") WHERE ("has_issue" = true);



CREATE INDEX "idx_orders_has_split" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "has_split") WHERE ("has_split" = true);



CREATE INDEX "idx_orders_is_rejected" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "is_rejected") WHERE ("is_rejected" = true);



CREATE INDEX "idx_orders_parent_order" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "parent_order_id");



CREATE INDEX "idx_orders_preparation_status" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "preparation_status");



CREATE INDEX "idx_orders_quick_drop" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "is_order_quick_drop", "current_status") WHERE ("is_order_quick_drop" = true);



CREATE INDEX "idx_orders_ready_by" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "ready_by");



CREATE INDEX "idx_orders_ready_by_new" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "ready_by_at_new") WHERE ("ready_by_at_new" IS NOT NULL);



CREATE INDEX "idx_orders_received_at" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "received_at" DESC);



CREATE INDEX "idx_orders_service_category" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "service_category_code");



CREATE INDEX "idx_orders_status" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "status");



CREATE INDEX "idx_orders_status_received" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "status", "received_at" DESC);



CREATE INDEX "idx_orders_status_transition" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "current_status", "last_transition_at" DESC);



CREATE INDEX "idx_orders_workflow_template" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "workflow_template_id");



CREATE INDEX "idx_org_auth_user_perms_perm" ON "public"."org_auth_user_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_org_auth_user_perms_tenant" ON "public"."org_auth_user_permissions" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_auth_user_perms_user" ON "public"."org_auth_user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_org_auth_user_resource_perms_resource" ON "public"."org_auth_user_resource_permissions" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_org_auth_user_resource_perms_tenant" ON "public"."org_auth_user_resource_permissions" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_auth_user_resource_perms_user" ON "public"."org_auth_user_resource_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_org_auth_user_resource_roles_resource" ON "public"."org_auth_user_resource_roles" USING "btree" ("resource_type", "resource_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_resource_roles_tenant" ON "public"."org_auth_user_resource_roles" USING "btree" ("tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_resource_roles_user" ON "public"."org_auth_user_resource_roles" USING "btree" ("user_id");



CREATE INDEX "idx_org_auth_user_resource_roles_user_tenant" ON "public"."org_auth_user_resource_roles" USING "btree" ("user_id", "tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_roles_role" ON "public"."org_auth_user_roles" USING "btree" ("role_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_roles_tenant" ON "public"."org_auth_user_roles" USING "btree" ("tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_roles_user" ON "public"."org_auth_user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_org_auth_user_roles_user_tenant" ON "public"."org_auth_user_roles" USING "btree" ("user_id", "tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_workflow_roles_role" ON "public"."org_auth_user_workflow_roles" USING "btree" ("workflow_role") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_workflow_roles_tenant" ON "public"."org_auth_user_workflow_roles" USING "btree" ("tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_auth_user_workflow_roles_user" ON "public"."org_auth_user_workflow_roles" USING "btree" ("user_id");



CREATE INDEX "idx_org_auth_user_workflow_roles_user_tenant" ON "public"."org_auth_user_workflow_roles" USING "btree" ("user_id", "tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_customers_tenant" ON "public"."org_customers_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_invoice_order" ON "public"."org_invoice_mst" USING "btree" ("order_id");



CREATE INDEX "idx_org_invoice_tenant_no" ON "public"."org_invoice_mst" USING "btree" ("tenant_org_id", "invoice_no");



CREATE INDEX "idx_org_items_order" ON "public"."org_order_items_dtl" USING "btree" ("order_id");



CREATE INDEX "idx_org_items_tenant" ON "public"."org_order_items_dtl" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_orders_created" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "created_at" DESC);



CREATE INDEX "idx_org_orders_customer" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "customer_id");



CREATE INDEX "idx_org_orders_status" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "status");



CREATE INDEX "idx_org_orders_tenant_no" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "order_no");



CREATE INDEX "idx_org_payments_invoice" ON "public"."org_payments_dtl_tr" USING "btree" ("invoice_id");



CREATE INDEX "idx_org_payments_tenant" ON "public"."org_payments_dtl_tr" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_pln_change_sub" ON "public"."org_pln_change_history_tr" USING "btree" ("subscription_id");



CREATE INDEX "idx_org_pln_change_tenant" ON "public"."org_pln_change_history_tr" USING "btree" ("tenant_org_id", "created_at" DESC);



CREATE INDEX "idx_org_pln_subs_period" ON "public"."org_pln_subscriptions_mst" USING "btree" ("current_period_end");



CREATE INDEX "idx_org_pln_subs_plan" ON "public"."org_pln_subscriptions_mst" USING "btree" ("plan_code");



CREATE INDEX "idx_org_pln_subs_status" ON "public"."org_pln_subscriptions_mst" USING "btree" ("status", "is_active");



CREATE INDEX "idx_org_pln_subs_tenant" ON "public"."org_pln_subscriptions_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_products_category" ON "public"."org_product_data_mst" USING "btree" ("tenant_org_id", "service_category_code");



CREATE INDEX "idx_org_products_tenant" ON "public"."org_product_data_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_org_users_last_login" ON "public"."org_users_mst" USING "btree" ("last_login_at" DESC);



CREATE INDEX "idx_org_users_locked" ON "public"."org_users_mst" USING "btree" ("locked_until") WHERE ("locked_until" IS NOT NULL);



CREATE INDEX "idx_org_users_role" ON "public"."org_users_mst" USING "btree" ("tenant_org_id", "role") WHERE ("is_active" = true);



CREATE INDEX "idx_org_users_tenant" ON "public"."org_users_mst" USING "btree" ("tenant_org_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_users_user" ON "public"."org_users_mst" USING "btree" ("user_id");



CREATE INDEX "idx_otp_expires" ON "public"."sys_otp_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_otp_phone" ON "public"."sys_otp_codes" USING "btree" ("phone", "expires_at");



CREATE INDEX "idx_otp_verified" ON "public"."sys_otp_codes" USING "btree" ("verified_at") WHERE ("verified_at" IS NOT NULL);



CREATE INDEX "idx_payment_gateway_active" ON "public"."sys_payment_gateway_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_payment_gateway_type" ON "public"."sys_payment_gateway_cd" USING "btree" ("gateway_type");



CREATE INDEX "idx_payment_status_active" ON "public"."sys_payment_status_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_payment_status_final" ON "public"."sys_payment_status_cd" USING "btree" ("is_final") WHERE ("is_final" = true);



CREATE INDEX "idx_permission_active" ON "public"."sys_permission_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_permission_category" ON "public"."sys_permission_cd" USING "btree" ("permission_category", "is_active");



CREATE INDEX "idx_permission_rbac" ON "public"."sys_permission_cd" USING "btree" ("rbac_permission_code") WHERE ("rbac_permission_code" IS NOT NULL);



CREATE INDEX "idx_permission_type" ON "public"."sys_permission_cd" USING "btree" ("permission_type", "is_active");



CREATE INDEX "idx_plan_features_active" ON "public"."sys_plan_features_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_plan_features_category" ON "public"."sys_plan_features_cd" USING "btree" ("feature_category", "is_active");



CREATE INDEX "idx_plans_active" ON "public"."sys_plans_mst" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_plans_tier" ON "public"."sys_plans_mst" USING "btree" ("plan_tier", "is_active");



CREATE INDEX "idx_price_list_items_active" ON "public"."org_price_list_items_dtl" USING "btree" ("price_list_id", "is_active");



CREATE INDEX "idx_price_list_items_list" ON "public"."org_price_list_items_dtl" USING "btree" ("price_list_id");



CREATE INDEX "idx_price_list_items_product" ON "public"."org_price_list_items_dtl" USING "btree" ("tenant_org_id", "product_id");



CREATE INDEX "idx_price_list_items_tenant" ON "public"."org_price_list_items_dtl" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_price_lists_dates" ON "public"."org_price_lists_mst" USING "btree" ("tenant_org_id", "effective_from", "effective_to") WHERE ("is_active" = true);



CREATE INDEX "idx_price_lists_default" ON "public"."org_price_lists_mst" USING "btree" ("tenant_org_id", "price_list_type", "is_default") WHERE (("is_active" = true) AND ("is_default" = true));



CREATE INDEX "idx_price_lists_tenant" ON "public"."org_price_lists_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_price_lists_tenant_active" ON "public"."org_price_lists_mst" USING "btree" ("tenant_org_id", "is_active");



CREATE INDEX "idx_price_lists_type" ON "public"."org_price_lists_mst" USING "btree" ("tenant_org_id", "price_list_type", "is_active");



CREATE INDEX "idx_products_item_type" ON "public"."org_product_data_mst" USING "btree" ("tenant_org_id", "item_type_code");



CREATE INDEX "idx_promo_codes_code" ON "public"."org_promo_codes_mst" USING "btree" ("tenant_org_id", "promo_code") WHERE ("is_active" = true);



CREATE INDEX "idx_promo_codes_tenant" ON "public"."org_promo_codes_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_promo_codes_validity" ON "public"."org_promo_codes_mst" USING "btree" ("tenant_org_id", "valid_from", "valid_to") WHERE ("is_active" = true);



CREATE INDEX "idx_promo_usage_customer" ON "public"."org_promo_usage_log" USING "btree" ("tenant_org_id", "customer_id");



CREATE INDEX "idx_promo_usage_order" ON "public"."org_promo_usage_log" USING "btree" ("tenant_org_id", "order_id");



CREATE INDEX "idx_promo_usage_promo" ON "public"."org_promo_usage_log" USING "btree" ("tenant_org_id", "promo_code_id");



CREATE INDEX "idx_promo_usage_tenant" ON "public"."org_promo_usage_log" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_quality_status_active" ON "public"."sys_quality_check_status_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_quality_status_type" ON "public"."sys_quality_check_status_cd" USING "btree" ("status_type", "is_active");



CREATE INDEX "idx_report_category_active" ON "public"."sys_report_category_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_report_category_parent" ON "public"."sys_report_category_cd" USING "btree" ("parent_category_code") WHERE ("parent_category_code" IS NOT NULL);



CREATE INDEX "idx_report_category_type" ON "public"."sys_report_category_cd" USING "btree" ("report_type", "is_active");



CREATE UNIQUE INDEX "idx_service_category_code_unique" ON "public"."sys_service_category_cd" USING "btree" ("code");



CREATE INDEX "idx_service_category_workflow" ON "public"."org_tenant_service_category_workflow_cf" USING "btree" ("tenant_org_id", "service_category_code");



CREATE INDEX "idx_stages_template" ON "public"."sys_workflow_template_stages" USING "btree" ("template_id", "seq_no");



CREATE INDEX "idx_status_history_order" ON "public"."org_order_status_history" USING "btree" ("order_id", "changed_at" DESC);



CREATE INDEX "idx_status_history_tenant" ON "public"."org_order_status_history" USING "btree" ("tenant_org_id", "changed_at" DESC);



CREATE INDEX "idx_status_history_tenant_order" ON "public"."org_order_status_history" USING "btree" ("tenant_org_id", "order_id", "changed_at" DESC);



CREATE INDEX "idx_status_history_to_status" ON "public"."org_order_status_history" USING "btree" ("tenant_org_id", "to_status", "changed_at" DESC);



CREATE INDEX "idx_status_history_user" ON "public"."org_order_status_history" USING "btree" ("changed_by");



CREATE INDEX "idx_step_code" ON "public"."org_order_item_processing_steps" USING "btree" ("tenant_org_id", "step_code", "done_at" DESC);



CREATE INDEX "idx_step_item_sequence" ON "public"."org_order_item_processing_steps" USING "btree" ("order_item_id", "step_seq");



CREATE INDEX "idx_step_order" ON "public"."org_order_item_processing_steps" USING "btree" ("order_id", "done_at" DESC);



CREATE INDEX "idx_step_order_item" ON "public"."org_order_item_processing_steps" USING "btree" ("order_item_id", "done_at" DESC);



CREATE INDEX "idx_step_tenant" ON "public"."org_order_item_processing_steps" USING "btree" ("tenant_org_id", "done_at" DESC);



CREATE INDEX "idx_sys_auth_permissions_category" ON "public"."sys_auth_permissions" USING "btree" ("category") WHERE ("is_active" = true);



CREATE INDEX "idx_sys_auth_permissions_code" ON "public"."sys_auth_permissions" USING "btree" ("code") WHERE ("is_active" = true);



CREATE INDEX "idx_sys_auth_role_perms_perm" ON "public"."sys_auth_role_default_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_sys_auth_role_perms_role" ON "public"."sys_auth_role_default_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_sys_auth_roles_code" ON "public"."sys_auth_roles" USING "btree" ("code");



CREATE INDEX "idx_sys_auth_roles_system" ON "public"."sys_auth_roles" USING "btree" ("is_system") WHERE ("is_system" = true);



CREATE INDEX "idx_sys_bill_disc_active" ON "public"."sys_bill_discount_codes_mst" USING "btree" ("is_active", "valid_until");



CREATE INDEX "idx_sys_bill_disc_code" ON "public"."sys_bill_discount_codes_mst" USING "btree" ("code") WHERE ("is_active" = true);



CREATE INDEX "idx_sys_bill_disc_red_code" ON "public"."sys_bill_discount_redemptions_tr" USING "btree" ("discount_code");



CREATE INDEX "idx_sys_bill_disc_red_tenant" ON "public"."sys_bill_discount_redemptions_tr" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_sys_bill_dun_invoice" ON "public"."sys_bill_dunning_mst" USING "btree" ("invoice_id");



CREATE INDEX "idx_sys_bill_dun_status" ON "public"."sys_bill_dunning_mst" USING "btree" ("status", "first_failure_date");



CREATE INDEX "idx_sys_bill_dun_tenant" ON "public"."sys_bill_dunning_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_sys_bill_gw_active" ON "public"."sys_bill_payment_gateways_cf" USING "btree" ("is_active", "is_default");



CREATE INDEX "idx_sys_bill_gw_code" ON "public"."sys_bill_payment_gateways_cf" USING "btree" ("gateway_code");



CREATE INDEX "idx_sys_bill_inv_no" ON "public"."sys_bill_invoices_mst" USING "btree" ("invoice_no");



CREATE INDEX "idx_sys_bill_inv_period" ON "public"."sys_bill_invoices_mst" USING "btree" ("billing_period_start", "billing_period_end");



CREATE INDEX "idx_sys_bill_inv_status" ON "public"."sys_bill_invoices_mst" USING "btree" ("status", "due_date");



CREATE INDEX "idx_sys_bill_inv_subscription" ON "public"."sys_bill_invoices_mst" USING "btree" ("subscription_id");



CREATE INDEX "idx_sys_bill_inv_tenant" ON "public"."sys_bill_invoices_mst" USING "btree" ("tenant_org_id", "invoice_date" DESC);



CREATE INDEX "idx_sys_bill_pay_invoice" ON "public"."sys_bill_invoice_payments_tr" USING "btree" ("invoice_id");



CREATE INDEX "idx_sys_bill_pay_status" ON "public"."sys_bill_invoice_payments_tr" USING "btree" ("status");



CREATE INDEX "idx_sys_bill_pay_tenant" ON "public"."sys_bill_invoice_payments_tr" USING "btree" ("tenant_org_id", "payment_date" DESC);



CREATE INDEX "idx_sys_bill_pm_codes_active" ON "public"."sys_bill_payment_method_codes_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_sys_bill_pm_codes_type" ON "public"."sys_bill_payment_method_codes_cd" USING "btree" ("type", "is_active");



CREATE INDEX "idx_sys_bill_pm_default" ON "public"."sys_bill_payment_methods_mst" USING "btree" ("tenant_org_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_sys_bill_pm_gateway" ON "public"."sys_bill_payment_methods_mst" USING "btree" ("gateway", "gateway_customer_id");



CREATE INDEX "idx_sys_bill_pm_tenant" ON "public"."sys_bill_payment_methods_mst" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_sys_bill_pm_type" ON "public"."sys_bill_payment_methods_mst" USING "btree" ("type");



CREATE INDEX "idx_sys_bill_rev_month" ON "public"."sys_bill_revenue_metrics_monthly" USING "btree" ("metric_month" DESC);



CREATE INDEX "idx_sys_bill_usage_date" ON "public"."sys_bill_usage_metrics_daily" USING "btree" ("metric_date");



CREATE INDEX "idx_sys_bill_usage_tenant" ON "public"."sys_bill_usage_metrics_daily" USING "btree" ("tenant_org_id", "metric_date" DESC);



CREATE INDEX "idx_sys_pln_plans_active" ON "public"."sys_pln_subscription_plans_mst" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_sys_pln_plans_code" ON "public"."sys_pln_subscription_plans_mst" USING "btree" ("plan_code");



CREATE INDEX "idx_sys_pln_plans_public" ON "public"."sys_pln_subscription_plans_mst" USING "btree" ("is_public", "is_active");



CREATE INDEX "idx_template_active" ON "public"."sys_workflow_template_cd" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_template_code" ON "public"."sys_workflow_template_cd" USING "btree" ("template_code");



CREATE INDEX "idx_templates_active" ON "public"."sys_service_prod_templates_cd" USING "btree" ("is_active", "rec_order");



CREATE INDEX "idx_templates_category" ON "public"."sys_service_prod_templates_cd" USING "btree" ("service_category_code");



CREATE INDEX "idx_templates_item_type" ON "public"."sys_service_prod_templates_cd" USING "btree" ("item_type_code");



CREATE INDEX "idx_templates_retail" ON "public"."sys_service_prod_templates_cd" USING "btree" ("is_retail_item") WHERE ("is_retail_item" = true);



CREATE INDEX "idx_templates_seed" ON "public"."sys_service_prod_templates_cd" USING "btree" ("is_to_seed", "seed_priority") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "idx_tenant_slug" ON "public"."org_tenants_mst" USING "btree" ("slug") WHERE ("is_active" = true);



CREATE INDEX "idx_tenant_status_history_date" ON "public"."hq_tenant_status_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_tenant_status_history_tenant" ON "public"."hq_tenant_status_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_templates_active" ON "public"."org_tenant_workflow_templates_cf" USING "btree" ("tenant_org_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_tenant_templates_tenant" ON "public"."org_tenant_workflow_templates_cf" USING "btree" ("tenant_org_id", "is_default");



CREATE INDEX "idx_timezone_active" ON "public"."sys_timezone_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_timezone_country" ON "public"."sys_timezone_cd" USING "btree" ("country_code") WHERE ("country_code" IS NOT NULL);



CREATE INDEX "idx_timezone_region" ON "public"."sys_timezone_cd" USING "btree" ("region", "is_active");



CREATE INDEX "idx_timezone_utc_offset" ON "public"."sys_timezone_cd" USING "btree" ("utc_offset_hours", "is_active");



CREATE INDEX "idx_transitions_active" ON "public"."sys_workflow_template_transitions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_transitions_template" ON "public"."sys_workflow_template_transitions" USING "btree" ("template_id", "from_stage_code");



CREATE INDEX "idx_usage_tenant_period" ON "public"."org_usage_tracking" USING "btree" ("tenant_org_id", "period_start" DESC);



CREATE INDEX "idx_user_role_active" ON "public"."sys_user_role_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_user_role_level" ON "public"."sys_user_role_cd" USING "btree" ("role_level", "is_active");



CREATE INDEX "idx_user_role_rbac" ON "public"."sys_user_role_cd" USING "btree" ("rbac_role_code") WHERE ("rbac_role_code" IS NOT NULL);



CREATE INDEX "idx_workflow_rules_tenant" ON "public"."org_workflow_rules" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_workflow_rules_transition" ON "public"."org_workflow_rules" USING "btree" ("tenant_org_id", "from_status", "to_status");



CREATE INDEX "idx_workflow_settings_active" ON "public"."org_workflow_settings_cf" USING "btree" ("tenant_org_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_workflow_settings_category" ON "public"."org_workflow_settings_cf" USING "btree" ("tenant_org_id", "service_category_code");



CREATE INDEX "idx_workflow_settings_tenant" ON "public"."org_workflow_settings_cf" USING "btree" ("tenant_org_id");



CREATE INDEX "idx_workflow_step_active" ON "public"."sys_workflow_step_cd" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_workflow_step_category" ON "public"."sys_workflow_step_cd" USING "btree" ("step_category", "is_active");



CREATE INDEX "idx_workflow_step_type" ON "public"."sys_workflow_step_cd" USING "btree" ("step_type", "is_active");



CREATE OR REPLACE TRIGGER "after_del_items_recalc" AFTER DELETE ON "public"."org_order_items_dtl" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_item_change_recalc"();



CREATE OR REPLACE TRIGGER "after_ins_items_recalc" AFTER INSERT ON "public"."org_order_items_dtl" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_item_change_recalc"();



CREATE OR REPLACE TRIGGER "after_upd_items_recalc" AFTER UPDATE ON "public"."org_order_items_dtl" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_item_change_recalc"();



CREATE OR REPLACE TRIGGER "before_ins_set_order_item_srno" BEFORE INSERT ON "public"."org_order_items_dtl" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_order_item_srno"();



CREATE OR REPLACE TRIGGER "cmx_rebuild_from_org_user_permissions" AFTER INSERT OR DELETE OR UPDATE ON "public"."org_auth_user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"();



CREATE OR REPLACE TRIGGER "cmx_rebuild_from_org_user_resource_permissions" AFTER INSERT OR DELETE OR UPDATE ON "public"."org_auth_user_resource_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"();



CREATE OR REPLACE TRIGGER "cmx_rebuild_from_org_user_resource_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."org_auth_user_resource_roles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"();



CREATE OR REPLACE TRIGGER "cmx_rebuild_from_org_user_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."org_auth_user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"();



CREATE OR REPLACE TRIGGER "trg_after_tenant_insert" AFTER INSERT ON "public"."org_tenants_mst" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_initialize_tenant"();



COMMENT ON TRIGGER "trg_after_tenant_insert" ON "public"."org_tenants_mst" IS 'Auto-initialize new tenants with subscription, branch, and services';



CREATE OR REPLACE TRIGGER "trg_ensure_single_default_address" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."org_customer_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_address"();



CREATE OR REPLACE TRIGGER "trg_order_auto_log_created" AFTER INSERT ON "public"."org_orders_mst" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auto_log_order_created"();



COMMENT ON TRIGGER "trg_order_auto_log_created" ON "public"."org_orders_mst" IS 'Automatically create history entry when order is created';



CREATE OR REPLACE TRIGGER "trg_order_initial_status" AFTER INSERT ON "public"."org_orders_mst" FOR EACH ROW EXECUTE FUNCTION "public"."fn_create_initial_status_history"();



CREATE OR REPLACE TRIGGER "trg_update_customer_address_timestamp" BEFORE UPDATE ON "public"."org_customer_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_address_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_create_tenant_lifecycle" AFTER INSERT ON "public"."org_tenants_mst" FOR EACH ROW EXECUTE FUNCTION "public"."create_tenant_lifecycle"();



CREATE OR REPLACE TRIGGER "trigger_update_lifecycle_timestamp" BEFORE UPDATE ON "public"."sys_tenant_lifecycle" FOR EACH ROW EXECUTE FUNCTION "public"."update_lifecycle_timestamp"();



CREATE OR REPLACE TRIGGER "update_hq_roles_updated_at" BEFORE UPDATE ON "public"."hq_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hq_users_updated_at" BEFORE UPDATE ON "public"."hq_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoice_amount_due" BEFORE INSERT OR UPDATE OF "amount_paid", "total" ON "public"."sys_bill_invoices_mst" FOR EACH ROW EXECUTE FUNCTION "public"."sys_bill_update_invoice_amount_due"();



CREATE OR REPLACE TRIGGER "update_subscription_timestamp" BEFORE UPDATE ON "public"."org_pln_subscriptions_mst" FOR EACH ROW EXECUTE FUNCTION "public"."update_subscription_updated_at"();



ALTER TABLE ONLY "public"."cmx_effective_permissions"
    ADD CONSTRAINT "cmx_effective_permissions_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cmx_effective_permissions"
    ADD CONSTRAINT "cmx_effective_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customer_addresses"
    ADD CONSTRAINT "fk_address_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."org_customers_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customer_addresses"
    ADD CONSTRAINT "fk_address_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_history"
    ADD CONSTRAINT "fk_history_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_history"
    ADD CONSTRAINT "fk_history_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_history"
    ADD CONSTRAINT "fk_history_user" FOREIGN KEY ("done_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "fk_issue_created_by" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "fk_issue_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "fk_issue_order_item" FOREIGN KEY ("order_item_id") REFERENCES "public"."org_order_items_dtl"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "fk_issue_solved_by" FOREIGN KEY ("solved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_order_item_issues"
    ADD CONSTRAINT "fk_issue_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_order_parent_order" FOREIGN KEY ("parent_order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_branches_mst"
    ADD CONSTRAINT "fk_org_branch_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "fk_org_ctg_sys" FOREIGN KEY ("service_category_code") REFERENCES "public"."sys_service_category_cd"("service_category_code");



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "fk_org_ctg_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "fk_org_cust_sys" FOREIGN KEY ("customer_id") REFERENCES "public"."sys_customers_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "fk_org_cust_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "fk_org_invoice_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "fk_org_invoice_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_ctg" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_prod" FOREIGN KEY ("product_id") REFERENCES "public"."org_product_data_mst"("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_branch" FOREIGN KEY ("branch_id", "tenant_org_id") REFERENCES "public"."org_branches_mst"("id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."org_customers_mst"("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_type" FOREIGN KEY ("order_type_id") REFERENCES "public"."sys_order_type_cd"("order_type_id");



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "fk_org_payment_invoice" FOREIGN KEY ("invoice_id") REFERENCES "public"."org_invoice_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "fk_org_payment_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "fk_org_prod_ctg" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "fk_org_prod_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_subscriptions_mst"
    ADD CONSTRAINT "fk_org_subs_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_tenant_settings_cf"
    ADD CONSTRAINT "fk_ots_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "fk_product_item_type" FOREIGN KEY ("item_type_code") REFERENCES "public"."sys_item_type_cd"("item_type_code") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_tenant_service_category_workflow_cf"
    ADD CONSTRAINT "fk_service_category_workflow_category" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_status_history"
    ADD CONSTRAINT "fk_status_history_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_status_history"
    ADD CONSTRAINT "fk_status_history_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_status_history"
    ADD CONSTRAINT "fk_status_history_user" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_order_item_processing_steps"
    ADD CONSTRAINT "fk_step_done_by" FOREIGN KEY ("done_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_order_item_processing_steps"
    ADD CONSTRAINT "fk_step_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_item_processing_steps"
    ADD CONSTRAINT "fk_step_order_item" FOREIGN KEY ("order_item_id") REFERENCES "public"."org_order_items_dtl"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_item_processing_steps"
    ADD CONSTRAINT "fk_step_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_service_prod_templates_cd"
    ADD CONSTRAINT "fk_template_category" FOREIGN KEY ("service_category_code") REFERENCES "public"."sys_service_category_cd"("service_category_code") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sys_service_prod_templates_cd"
    ADD CONSTRAINT "fk_template_item_type" FOREIGN KEY ("item_type_code") REFERENCES "public"."sys_item_type_cd"("item_type_code") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_tenant_workflow_templates_cf"
    ADD CONSTRAINT "fk_tenant_workflow_templates_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_workflow_rules"
    ADD CONSTRAINT "fk_workflow_rules_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_workflow_settings_cf"
    ADD CONSTRAINT "fk_workflow_settings_category" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_workflow_settings_cf"
    ADD CONSTRAINT "fk_workflow_settings_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hq_audit_logs"
    ADD CONSTRAINT "hq_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."hq_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hq_session_tokens"
    ADD CONSTRAINT "hq_session_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."hq_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hq_tenant_status_history"
    ADD CONSTRAINT "hq_tenant_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hq_users"
    ADD CONSTRAINT "hq_users_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."hq_roles"("role_code") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."org_auth_user_permissions"
    ADD CONSTRAINT "org_auth_user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."sys_auth_permissions"("permission_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_permissions"
    ADD CONSTRAINT "org_auth_user_permissions_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_permissions"
    ADD CONSTRAINT "org_auth_user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_permissions"
    ADD CONSTRAINT "org_auth_user_resource_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."sys_auth_permissions"("permission_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_permissions"
    ADD CONSTRAINT "org_auth_user_resource_permissions_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_permissions"
    ADD CONSTRAINT "org_auth_user_resource_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_roles"
    ADD CONSTRAINT "org_auth_user_resource_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."sys_auth_roles"("role_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_roles"
    ADD CONSTRAINT "org_auth_user_resource_roles_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_resource_roles"
    ADD CONSTRAINT "org_auth_user_resource_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_roles"
    ADD CONSTRAINT "org_auth_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."sys_auth_roles"("role_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_roles"
    ADD CONSTRAINT "org_auth_user_roles_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_roles"
    ADD CONSTRAINT "org_auth_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_workflow_roles"
    ADD CONSTRAINT "org_auth_user_workflow_roles_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_auth_user_workflow_roles"
    ADD CONSTRAINT "org_auth_user_workflow_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customer_merge_log"
    ADD CONSTRAINT "org_customer_merge_log_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_discount_rules_cf"
    ADD CONSTRAINT "org_discount_rules_tenant_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_gift_card_transactions"
    ADD CONSTRAINT "org_gift_card_trans_card_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."org_gift_cards_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_gift_card_transactions"
    ADD CONSTRAINT "org_gift_card_trans_tenant_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_gift_cards_mst"
    ADD CONSTRAINT "org_gift_cards_tenant_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "org_orders_mst_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."sys_workflow_template_cd"("template_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_pln_change_history_tr"
    ADD CONSTRAINT "org_pln_change_history_tr_proration_invoice_id_fkey" FOREIGN KEY ("proration_invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("id");



ALTER TABLE ONLY "public"."org_pln_change_history_tr"
    ADD CONSTRAINT "org_pln_change_history_tr_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."org_pln_subscriptions_mst"("id");



ALTER TABLE ONLY "public"."org_pln_change_history_tr"
    ADD CONSTRAINT "org_pln_change_history_tr_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_pln_change_history_tr"
    ADD CONSTRAINT "org_pln_change_history_tr_tenant_org_id_subscription_id_fkey" FOREIGN KEY ("tenant_org_id", "subscription_id") REFERENCES "public"."org_pln_subscriptions_mst"("tenant_org_id", "id");



ALTER TABLE ONLY "public"."org_pln_subscriptions_mst"
    ADD CONSTRAINT "org_pln_subscriptions_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_price_list_items_dtl"
    ADD CONSTRAINT "org_price_list_items_dtl_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."org_price_lists_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_price_list_items_dtl"
    ADD CONSTRAINT "org_price_list_items_dtl_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_price_list_items_dtl"
    ADD CONSTRAINT "org_price_list_items_dtl_tenant_org_id_product_id_fkey" FOREIGN KEY ("tenant_org_id", "product_id") REFERENCES "public"."org_product_data_mst"("tenant_org_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_price_lists_mst"
    ADD CONSTRAINT "org_price_lists_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_promo_codes_mst"
    ADD CONSTRAINT "org_promo_codes_tenant_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_promo_usage_log"
    ADD CONSTRAINT "org_promo_usage_promo_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."org_promo_codes_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_promo_usage_log"
    ADD CONSTRAINT "org_promo_usage_tenant_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_tenant_service_category_workflow_cf"
    ADD CONSTRAINT "org_tenant_service_category_workflow__workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "public"."sys_workflow_template_cd"("template_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_tenant_workflow_settings_cf"
    ADD CONSTRAINT "org_tenant_workflow_settings_cf_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_tenant_workflow_templates_cf"
    ADD CONSTRAINT "org_tenant_workflow_templates_cf_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."sys_workflow_template_cd"("template_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."org_usage_tracking"
    ADD CONSTRAINT "org_usage_tracking_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_users_mst"
    ADD CONSTRAINT "org_users_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_users_mst"
    ADD CONSTRAINT "org_users_mst_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_audit_log"
    ADD CONSTRAINT "sys_audit_log_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sys_audit_log"
    ADD CONSTRAINT "sys_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sys_auth_role_default_permissions"
    ADD CONSTRAINT "sys_auth_role_default_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."sys_auth_permissions"("permission_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_auth_role_default_permissions"
    ADD CONSTRAINT "sys_auth_role_default_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."sys_auth_roles"("role_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_discount_redemptions_tr"
    ADD CONSTRAINT "sys_bill_discount_redemptions_tr_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("id");



ALTER TABLE ONLY "public"."sys_bill_discount_redemptions_tr"
    ADD CONSTRAINT "sys_bill_discount_redemptions_tr_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_dunning_mst"
    ADD CONSTRAINT "sys_bill_dunning_mst_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_dunning_mst"
    ADD CONSTRAINT "sys_bill_dunning_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_dunning_mst"
    ADD CONSTRAINT "sys_bill_dunning_mst_tenant_org_id_invoice_id_fkey" FOREIGN KEY ("tenant_org_id", "invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("tenant_org_id", "id");



ALTER TABLE ONLY "public"."sys_bill_invoice_payments_tr"
    ADD CONSTRAINT "sys_bill_invoice_payments_tr_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_invoice_payments_tr"
    ADD CONSTRAINT "sys_bill_invoice_payments_tr_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_invoice_payments_tr"
    ADD CONSTRAINT "sys_bill_invoice_payments_tr_tenant_org_id_invoice_id_fkey" FOREIGN KEY ("tenant_org_id", "invoice_id") REFERENCES "public"."sys_bill_invoices_mst"("tenant_org_id", "id");



ALTER TABLE ONLY "public"."sys_bill_invoices_mst"
    ADD CONSTRAINT "sys_bill_invoices_mst_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."org_pln_subscriptions_mst"("id");



ALTER TABLE ONLY "public"."sys_bill_invoices_mst"
    ADD CONSTRAINT "sys_bill_invoices_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_payment_methods_mst"
    ADD CONSTRAINT "sys_bill_payment_methods_mst_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_bill_usage_metrics_daily"
    ADD CONSTRAINT "sys_bill_usage_metrics_daily_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_code_table_audit_log"
    ADD CONSTRAINT "sys_code_table_audit_log_rollback_of_id_fkey" FOREIGN KEY ("rollback_of_id") REFERENCES "public"."sys_code_table_audit_log"("id");



ALTER TABLE ONLY "public"."sys_tenant_lifecycle"
    ADD CONSTRAINT "sys_tenant_lifecycle_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_tenant_metrics_daily"
    ADD CONSTRAINT "sys_tenant_metrics_daily_tenant_org_id_fkey" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_workflow_template_stages"
    ADD CONSTRAINT "sys_workflow_template_stages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."sys_workflow_template_cd"("template_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sys_workflow_template_transitions"
    ADD CONSTRAINT "sys_workflow_template_transitions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."sys_workflow_template_cd"("template_id") ON DELETE CASCADE;



CREATE POLICY "HQ tables are only accessible via service role" ON "public"."hq_audit_logs" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "HQ tables are only accessible via service role" ON "public"."hq_roles" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "HQ tables are only accessible via service role" ON "public"."hq_session_tokens" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "admin_create_tenant_users" ON "public"."org_users_mst" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND "public"."is_admin"()));



CREATE POLICY "admin_delete_tenant_users" ON "public"."org_users_mst" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND "public"."is_admin"() AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "admin_update_tenant_users" ON "public"."org_users_mst" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND "public"."is_admin"() AND ("user_id" <> "auth"."uid"()))) WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND "public"."is_admin"() AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "admin_view_tenant_details" ON "public"."org_tenants_mst" FOR SELECT USING ((("id" = "public"."current_tenant_id"()) AND "public"."is_admin"()));



CREATE POLICY "admin_view_tenant_users" ON "public"."org_users_mst" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND "public"."is_admin"()));



ALTER TABLE "public"."cmx_effective_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cmx_effective_permissions_select_own" ON "public"."cmx_effective_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "cmx_effective_permissions_select_tenant" ON "public"."cmx_effective_permissions" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."hq_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hq_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hq_session_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hq_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_auth_user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_auth_user_permissions_delete_admin" ON "public"."org_auth_user_permissions" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_permissions_insert_admin" ON "public"."org_auth_user_permissions" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_permissions_select_tenant" ON "public"."org_auth_user_permissions" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true)))))));



CREATE POLICY "org_auth_user_permissions_update_admin" ON "public"."org_auth_user_permissions" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."org_auth_user_resource_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_auth_user_resource_permissions_delete_admin" ON "public"."org_auth_user_resource_permissions" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_resource_permissions_insert_admin" ON "public"."org_auth_user_resource_permissions" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_resource_permissions_select_tenant" ON "public"."org_auth_user_resource_permissions" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true)))))));



CREATE POLICY "org_auth_user_resource_permissions_update_admin" ON "public"."org_auth_user_resource_permissions" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."org_auth_user_resource_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_auth_user_resource_roles_delete_admin" ON "public"."org_auth_user_resource_roles" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_resource_roles_insert_admin" ON "public"."org_auth_user_resource_roles" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_resource_roles_select_own" ON "public"."org_auth_user_resource_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_auth_user_resource_roles_select_tenant" ON "public"."org_auth_user_resource_roles" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_resource_roles_update_admin" ON "public"."org_auth_user_resource_roles" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."org_auth_user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_auth_user_roles_delete_admin" ON "public"."org_auth_user_roles" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_roles_insert_admin" ON "public"."org_auth_user_roles" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_roles_select_own" ON "public"."org_auth_user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_auth_user_roles_select_tenant" ON "public"."org_auth_user_roles" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_roles_update_admin" ON "public"."org_auth_user_roles" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."org_auth_user_workflow_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_auth_user_workflow_roles_delete_admin" ON "public"."org_auth_user_workflow_roles" FOR DELETE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_workflow_roles_insert_admin" ON "public"."org_auth_user_workflow_roles" FOR INSERT WITH CHECK ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_workflow_roles_select_own" ON "public"."org_auth_user_workflow_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_auth_user_workflow_roles_select_tenant" ON "public"."org_auth_user_workflow_roles" FOR SELECT USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



CREATE POLICY "org_auth_user_workflow_roles_update_admin" ON "public"."org_auth_user_workflow_roles" FOR UPDATE USING ((("tenant_org_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_users_mst"
  WHERE (("org_users_mst"."user_id" = "auth"."uid"()) AND ("org_users_mst"."tenant_org_id" = "public"."current_tenant_id"()) AND (("org_users_mst"."role")::"text" = 'admin'::"text") AND ("org_users_mst"."is_active" = true))))));



ALTER TABLE "public"."org_branches_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_customer_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_customer_merge_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_customers_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_discount_rules_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_gift_card_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_gift_cards_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_invoice_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_item_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_item_processing_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_items_dtl" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_orders_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_payments_dtl_tr" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_pln_subscriptions_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_price_list_items_dtl" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_price_lists_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_product_data_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_promo_codes_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_promo_usage_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_service_category_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_subscriptions_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_tenant_service_category_workflow_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_tenant_workflow_settings_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_tenant_workflow_templates_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_tenants_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_users_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_workflow_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_workflow_settings_cf" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_addresses" ON "public"."org_customer_addresses" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_category_workflow" ON "public"."org_tenant_service_category_workflow_cf" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_cmx_effective_perms_full_access" ON "public"."cmx_effective_permissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."org_users_mst" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_history" ON "public"."org_order_history" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_issues" ON "public"."org_order_item_issues" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_merge_log" ON "public"."org_customer_merge_log" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_org_user_perms_full_access" ON "public"."org_auth_user_permissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_org_user_resource_perms_full_access" ON "public"."org_auth_user_resource_permissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_org_user_resource_roles_full_access" ON "public"."org_auth_user_resource_roles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_org_user_roles_full_access" ON "public"."org_auth_user_roles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_org_user_workflow_roles_full_access" ON "public"."org_auth_user_workflow_roles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_policy" ON "public"."org_price_list_items_dtl" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_policy" ON "public"."org_price_lists_mst" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_policy_products_mst" ON "public"."org_product_data_mst" TO "service_role" USING (true);



CREATE POLICY "service_role_rbac_full_access" ON "public"."sys_auth_permissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_rbac_role_perms_full_access" ON "public"."sys_auth_role_default_permissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_rbac_roles_full_access" ON "public"."sys_auth_roles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_status_history" ON "public"."org_order_status_history" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_steps" ON "public"."org_order_item_processing_steps" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_tenants_access" ON "public"."org_tenants_mst" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_workflow_rules" ON "public"."org_workflow_rules" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_workflow_settings" ON "public"."org_tenant_workflow_settings_cf" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_workflow_settings" ON "public"."org_workflow_settings_cf" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_workflow_templates" ON "public"."org_tenant_workflow_templates_cf" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."sys_auth_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sys_auth_permissions_select" ON "public"."sys_auth_permissions" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."sys_auth_role_default_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sys_auth_role_default_permissions_select" ON "public"."sys_auth_role_default_permissions" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."sys_auth_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sys_auth_roles_select" ON "public"."sys_auth_roles" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."sys_bill_invoices_mst" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_access_own_tenant" ON "public"."org_tenants_mst" USING (("id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."org_pln_subscriptions_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_org_id'::"text")));



CREATE POLICY "tenant_isolation" ON "public"."sys_bill_invoices_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_org_id'::"text")));



CREATE POLICY "tenant_isolation_addresses" ON "public"."org_customer_addresses" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_category_workflow" ON "public"."org_tenant_service_category_workflow_cf" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_discount_rules" ON "public"."org_discount_rules_cf" USING (("tenant_org_id" IN ( SELECT "org_users_mst"."tenant_org_id"
   FROM "public"."org_users_mst"
  WHERE ("org_users_mst"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_gift_card_trans" ON "public"."org_gift_card_transactions" USING (("tenant_org_id" IN ( SELECT "org_users_mst"."tenant_org_id"
   FROM "public"."org_users_mst"
  WHERE ("org_users_mst"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_gift_cards" ON "public"."org_gift_cards_mst" USING (("tenant_org_id" IN ( SELECT "org_users_mst"."tenant_org_id"
   FROM "public"."org_users_mst"
  WHERE ("org_users_mst"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_history" ON "public"."org_order_history" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_issues" ON "public"."org_order_item_issues" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_merge_log" ON "public"."org_customer_merge_log" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_branches" ON "public"."org_branches_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_customers" ON "public"."org_customers_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_invoices" ON "public"."org_invoice_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_order_items" ON "public"."org_order_items_dtl" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_orders" ON "public"."org_orders_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_payments" ON "public"."org_payments_dtl_tr" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_products" ON "public"."org_product_data_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_service_category" ON "public"."org_service_category_cf" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_subscriptions_mst" ON "public"."org_subscriptions_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_org_tenants" ON "public"."org_tenants_mst" USING (("id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_policy_products_mst" ON "public"."org_product_data_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_price_list_items" ON "public"."org_price_list_items_dtl" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_price_lists" ON "public"."org_price_lists_mst" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_promo_codes" ON "public"."org_promo_codes_mst" USING (("tenant_org_id" IN ( SELECT "org_users_mst"."tenant_org_id"
   FROM "public"."org_users_mst"
  WHERE ("org_users_mst"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_promo_usage" ON "public"."org_promo_usage_log" USING (("tenant_org_id" IN ( SELECT "org_users_mst"."tenant_org_id"
   FROM "public"."org_users_mst"
  WHERE ("org_users_mst"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_status_history" ON "public"."org_order_status_history" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_steps" ON "public"."org_order_item_processing_steps" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_workflow_rules" ON "public"."org_workflow_rules" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_workflow_settings" ON "public"."org_tenant_workflow_settings_cf" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_workflow_settings_global" ON "public"."org_workflow_settings_cf" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "tenant_isolation_workflow_templates" ON "public"."org_tenant_workflow_templates_cf" USING (("tenant_org_id" IN ( SELECT "get_user_tenants"."tenant_id"
   FROM "public"."get_user_tenants"() "get_user_tenants"("tenant_id", "tenant_name", "tenant_slug", "user_role", "is_active", "last_login_at"))));



CREATE POLICY "user_update_own_profile" ON "public"."org_users_mst" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_view_own_records" ON "public"."org_users_mst" FOR SELECT USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_unlock_expired_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_unlock_expired_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_unlock_expired_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_code_table_references"("p_table_name" character varying, "p_record_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rbac_migration_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_rbac_migration_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rbac_migration_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_otp_codes"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otp_codes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otp_codes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_can"("p_perm" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_get_allowed_transitions"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_order_items_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_order_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text", "p_user" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_rebuild_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmx_validate_transition"("p_tenant" "uuid", "p_order" "uuid", "p_from" "text", "p_to" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tenant_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_tenant_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tenant_lifecycle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_address"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_address"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_address"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_order_sequence"("p_order_no" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_order_sequence"("p_order_no" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_order_sequence"("p_order_no" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auto_log_order_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auto_log_order_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auto_log_order_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_initial_status_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_initial_status_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_initial_status_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_setting_value"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_setting_value"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_setting_value"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_setting_allowed"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_setting_allowed"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_setting_allowed"("p_tenant_org_id" "uuid", "p_setting_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_next_order_item_srno"("p_tenant" "uuid", "p_order" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_next_order_item_srno"("p_tenant" "uuid", "p_order" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_next_order_item_srno"("p_tenant" "uuid", "p_order" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalc_order_totals"("p_tenant" "uuid", "p_order" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalc_order_totals"("p_tenant" "uuid", "p_order" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalc_order_totals"("p_tenant" "uuid", "p_order" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_tenant_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"("p_tenant_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_code_table_history"("p_table_name" character varying, "p_record_code" character varying, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_number_prefix"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_number_prefix"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_number_prefix"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying, "p_quantity" integer, "p_effective_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying, "p_quantity" integer, "p_effective_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_price"("p_tenant_org_id" "uuid", "p_product_id" "uuid", "p_price_list_type" character varying, "p_quantity" integer, "p_effective_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role_compat"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_workflow_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_workflow_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_workflow_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_all_permissions"("p_permissions" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_permission"("p_permissions" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_resource_permission"("p_permission" "text", "p_resource_type" "text", "p_resource_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_tenant_access"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_unresolved_issues"("p_order_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_workflow_role"("p_workflow_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hq_user_has_permission"("p_user_id" "uuid", "p_permission" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text", "p_admin_password" "text", "p_admin_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text", "p_admin_password" "text", "p_admin_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_new_tenant"("p_tenant_id" "uuid", "p_admin_email" "text", "p_admin_password" "text", "p_admin_display_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_include_cost" boolean, "p_create_default_price_list" boolean, "p_seed_filter" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_include_cost" boolean, "p_create_default_price_list" boolean, "p_seed_filter" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_product_catalog"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_include_cost" boolean, "p_create_default_price_list" boolean, "p_seed_filter" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_account_locked"("p_email" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."is_account_locked"("p_email" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_account_locked"("p_email" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_item_all_steps_done"("p_order_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_operator"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_operator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_operator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" character varying, "p_status" character varying, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" character varying, "p_status" character varying, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_tenant_org_id" "uuid", "p_action" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" character varying, "p_status" character varying, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text", "p_ip_address" character varying, "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text", "p_ip_address" character varying, "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_code_table_change"("p_table_name" character varying, "p_record_code" character varying, "p_action" character varying, "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_by" "uuid", "p_change_reason" "text", "p_ip_address" character varying, "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text", "p_to_value" "text", "p_done_by" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text", "p_to_value" "text", "p_done_by" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_action"("p_tenant_org_id" "uuid", "p_order_id" "uuid", "p_action_type" "text", "p_from_value" "text", "p_to_value" "text", "p_done_by" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_users_to_rbac_batch"("p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."order_has_action"("p_order_id" "uuid", "p_action_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet", "p_user_agent" "text", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet", "p_user_agent" "text", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" character varying, "p_success" boolean, "p_ip_address" "inet", "p_user_agent" "text", "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_only_missing" boolean, "p_template_codes" character varying[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_only_missing" boolean, "p_template_codes" character varying[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reseed_missing_products"("p_tenant_org_id" "uuid", "p_include_pricing" boolean, "p_only_missing" boolean, "p_template_codes" character varying[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."switch_tenant_context"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sys_bill_generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."sys_bill_generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sys_bill_generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sys_bill_get_default_payment_method"() TO "anon";
GRANT ALL ON FUNCTION "public"."sys_bill_get_default_payment_method"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sys_bill_get_default_payment_method"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sys_bill_update_invoice_amount_due"() TO "anon";
GRANT ALL ON FUNCTION "public"."sys_bill_update_invoice_amount_due"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sys_bill_update_invoice_amount_due"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_after_item_change_recalc"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_after_item_change_recalc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_after_item_change_recalc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_auto_initialize_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_auto_initialize_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_auto_initialize_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_resource_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cmx_rebuild_from_org_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_order_item_srno"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_order_item_srno"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_order_item_srno"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlock_account"("p_user_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_address_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_address_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_address_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lifecycle_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lifecycle_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lifecycle_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_last_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_last_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_last_login"() TO "service_role";



GRANT ALL ON TABLE "public"."org_users_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_users_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_users_mst" TO "service_role";



GRANT ALL ON TABLE "public"."admin_locked_accounts" TO "anon";
GRANT ALL ON TABLE "public"."admin_locked_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_locked_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."cmx_effective_permissions" TO "anon";
GRANT ALL ON TABLE "public"."cmx_effective_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."cmx_effective_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."hq_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."hq_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."hq_roles" TO "anon";
GRANT ALL ON TABLE "public"."hq_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_roles" TO "service_role";



GRANT ALL ON TABLE "public"."hq_session_tokens" TO "anon";
GRANT ALL ON TABLE "public"."hq_session_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_session_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."hq_tenant_status_history" TO "anon";
GRANT ALL ON TABLE "public"."hq_tenant_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_tenant_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."hq_users" TO "anon";
GRANT ALL ON TABLE "public"."hq_users" TO "authenticated";
GRANT ALL ON TABLE "public"."hq_users" TO "service_role";



GRANT ALL ON TABLE "public"."org_auth_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."org_auth_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."org_auth_user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."org_auth_user_resource_permissions" TO "anon";
GRANT ALL ON TABLE "public"."org_auth_user_resource_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."org_auth_user_resource_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."org_auth_user_resource_roles" TO "anon";
GRANT ALL ON TABLE "public"."org_auth_user_resource_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."org_auth_user_resource_roles" TO "service_role";



GRANT ALL ON TABLE "public"."org_auth_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."org_auth_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."org_auth_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."org_auth_user_workflow_roles" TO "anon";
GRANT ALL ON TABLE "public"."org_auth_user_workflow_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."org_auth_user_workflow_roles" TO "service_role";



GRANT ALL ON TABLE "public"."org_branches_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_branches_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_branches_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_customer_addresses" TO "anon";
GRANT ALL ON TABLE "public"."org_customer_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."org_customer_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."org_customer_merge_log" TO "anon";
GRANT ALL ON TABLE "public"."org_customer_merge_log" TO "authenticated";
GRANT ALL ON TABLE "public"."org_customer_merge_log" TO "service_role";



GRANT ALL ON TABLE "public"."org_customers_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_customers_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_customers_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_discount_rules_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_discount_rules_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_discount_rules_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_gift_card_transactions" TO "anon";
GRANT ALL ON TABLE "public"."org_gift_card_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."org_gift_card_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."org_gift_cards_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_gift_cards_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_gift_cards_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_invoice_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_invoice_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invoice_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_history" TO "anon";
GRANT ALL ON TABLE "public"."org_order_history" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_history" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_item_issues" TO "anon";
GRANT ALL ON TABLE "public"."org_order_item_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_item_issues" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_item_processing_steps" TO "anon";
GRANT ALL ON TABLE "public"."org_order_item_processing_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_item_processing_steps" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "anon";
GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."org_order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_status_history_legacy" TO "anon";
GRANT ALL ON TABLE "public"."org_order_status_history_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_status_history_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."org_orders_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_orders_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_orders_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "anon";
GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "authenticated";
GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "service_role";



GRANT ALL ON TABLE "public"."org_pln_change_history_tr" TO "anon";
GRANT ALL ON TABLE "public"."org_pln_change_history_tr" TO "authenticated";
GRANT ALL ON TABLE "public"."org_pln_change_history_tr" TO "service_role";



GRANT ALL ON TABLE "public"."org_pln_subscriptions_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_pln_subscriptions_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_pln_subscriptions_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_price_list_items_dtl" TO "anon";
GRANT ALL ON TABLE "public"."org_price_list_items_dtl" TO "authenticated";
GRANT ALL ON TABLE "public"."org_price_list_items_dtl" TO "service_role";



GRANT ALL ON TABLE "public"."org_price_lists_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_price_lists_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_price_lists_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_product_data_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_product_data_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_product_data_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_promo_codes_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_promo_codes_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_promo_codes_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_promo_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."org_promo_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."org_promo_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."org_service_category_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_service_category_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_service_category_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenant_service_category_workflow_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_tenant_service_category_workflow_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenant_service_category_workflow_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenant_settings_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_tenant_settings_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenant_settings_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenant_workflow_settings_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_tenant_workflow_settings_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenant_workflow_settings_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenant_workflow_templates_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_tenant_workflow_templates_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenant_workflow_templates_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenants_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_tenants_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenants_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_usage_tracking" TO "anon";
GRANT ALL ON TABLE "public"."org_usage_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."org_usage_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."org_workflow_rules" TO "anon";
GRANT ALL ON TABLE "public"."org_workflow_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."org_workflow_rules" TO "service_role";



GRANT ALL ON TABLE "public"."org_workflow_settings_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_workflow_settings_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_workflow_settings_cf" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seq_invoice_number" TO "anon";
GRANT ALL ON SEQUENCE "public"."seq_invoice_number" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seq_invoice_number" TO "service_role";



GRANT ALL ON TABLE "public"."sys_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."sys_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."sys_auth_permissions" TO "anon";
GRANT ALL ON TABLE "public"."sys_auth_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_auth_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sys_auth_role_default_permissions" TO "anon";
GRANT ALL ON TABLE "public"."sys_auth_role_default_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_auth_role_default_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sys_auth_roles" TO "anon";
GRANT ALL ON TABLE "public"."sys_auth_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_auth_roles" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_discount_codes_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_discount_codes_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_discount_codes_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_discount_redemptions_tr" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_discount_redemptions_tr" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_discount_redemptions_tr" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_dunning_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_dunning_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_dunning_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_invoice_payments_tr" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_invoice_payments_tr" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_invoice_payments_tr" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_invoices_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_invoices_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_invoices_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_payment_gateways_cf" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_payment_gateways_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_payment_gateways_cf" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_payment_method_codes_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_payment_method_codes_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_payment_method_codes_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_payment_methods_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_payment_methods_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_payment_methods_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_revenue_metrics_monthly" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_revenue_metrics_monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_revenue_metrics_monthly" TO "service_role";



GRANT ALL ON TABLE "public"."sys_bill_usage_metrics_daily" TO "anon";
GRANT ALL ON TABLE "public"."sys_bill_usage_metrics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_bill_usage_metrics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."sys_billing_cycle_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_billing_cycle_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_billing_cycle_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_code_table_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."sys_code_table_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_code_table_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."sys_code_tables_registry" TO "anon";
GRANT ALL ON TABLE "public"."sys_code_tables_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_code_tables_registry" TO "service_role";



GRANT ALL ON TABLE "public"."sys_country_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_country_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_country_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_currency_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_currency_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_currency_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_customers_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_customers_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_customers_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_fabric_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_fabric_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_fabric_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_garment_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_garment_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_garment_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_issue_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_issue_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_issue_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_item_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_item_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_item_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_language_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_language_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_language_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_metric_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_metric_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_metric_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_notification_channel_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_notification_channel_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_notification_channel_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_notification_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_notification_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_notification_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_order_status_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_order_status_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_order_status_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."sys_otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_otp_codes" TO "service_role";



GRANT ALL ON TABLE "public"."sys_payment_gateway_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_payment_gateway_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_payment_gateway_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_payment_method_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_payment_method_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_payment_method_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_payment_status_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_payment_status_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_payment_status_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_payment_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_payment_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_payment_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_permission_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_permission_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_permission_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_plan_features_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_plan_features_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_plan_features_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_plan_limits" TO "anon";
GRANT ALL ON TABLE "public"."sys_plan_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_plan_limits" TO "service_role";



GRANT ALL ON TABLE "public"."sys_plans_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_plans_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_plans_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_pln_subscription_plans_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_pln_subscription_plans_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_pln_subscription_plans_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_quality_check_status_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_quality_check_status_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_quality_check_status_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_report_category_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_report_category_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_report_category_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_service_prod_templates_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_service_prod_templates_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_service_prod_templates_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_tenant_lifecycle" TO "anon";
GRANT ALL ON TABLE "public"."sys_tenant_lifecycle" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_tenant_lifecycle" TO "service_role";



GRANT ALL ON TABLE "public"."sys_tenant_metrics_daily" TO "anon";
GRANT ALL ON TABLE "public"."sys_tenant_metrics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_tenant_metrics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."sys_tenant_settings_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_tenant_settings_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_tenant_settings_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_timezone_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_timezone_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_timezone_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_user_role_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_user_role_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_user_role_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_workflow_step_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_workflow_step_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_workflow_step_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_workflow_template_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_workflow_template_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_workflow_template_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_workflow_template_stages" TO "anon";
GRANT ALL ON TABLE "public"."sys_workflow_template_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_workflow_template_stages" TO "service_role";



GRANT ALL ON TABLE "public"."sys_workflow_template_transitions" TO "anon";
GRANT ALL ON TABLE "public"."sys_workflow_template_transitions" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_workflow_template_transitions" TO "service_role";



GRANT ALL ON TABLE "public"."v_effective_tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."v_effective_tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."v_effective_tenant_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
