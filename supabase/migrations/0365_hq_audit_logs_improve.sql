-- =============================================================================
-- Migration: 0365_hq_audit_logs_improve.sql
-- Purpose:   Comprehensively improve `hq_audit_logs` (created 0038) to support
--            a powerful HQ audit screen: rich filtering, cross-service tracing,
--            session/batch grouping, API context, performance tracking,
--            compliance flags, and human-readable display labels.
--
-- All 18 new columns are nullable so existing rows need no backfill.
-- Seq: 0365 (next after 0364_ntf_unify_table_names.sql)
--
-- Column groups:
--   A. Actor & scope        → actor_type, tenant_org_id
--   B. Change tracking      → old_value, new_value
--   C. Module & routing     → source_module, severity, request_id
--   D. Display & search     → action_category, resource_label
--   E. Session & bulk trace → session_id, batch_id, parent_audit_id
--   F. API context          → http_method, http_path, http_status_code
--   G. Performance          → duration_ms
--   H. Compliance           → change_reason, tags, is_sensitive
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A. Actor & scope
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='actor_type') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN actor_type TEXT
      CHECK (actor_type IN ('hq_admin','service_role','system'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='tenant_org_id') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN tenant_org_id UUID;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.actor_type    IS 'hq_admin = HQ console session; service_role = internal S2S call; system = automated job';
COMMENT ON COLUMN hq_audit_logs.tenant_org_id IS 'Affected tenant; NULL = platform-wide operation';

-- ---------------------------------------------------------------------------
-- B. Change tracking — structured before/after state
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='old_value') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN old_value JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='new_value') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN new_value JSONB;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.old_value IS 'Resource state before the change (structured; prefer over details for diffs)';
COMMENT ON COLUMN hq_audit_logs.new_value IS 'Resource state after the change (structured; prefer over details for diffs)';

-- ---------------------------------------------------------------------------
-- C. Module, severity, cross-service tracing
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='source_module') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN source_module TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='severity') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN severity TEXT DEFAULT 'info'
      CHECK (severity IN ('info','warning','error','critical'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='request_id') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN request_id TEXT;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.source_module IS 'HQ module: notifications-hq, billing, tenants, auth, etc. — for per-module views';
COMMENT ON COLUMN hq_audit_logs.severity      IS 'info | warning | error | critical — for alerting and severity filter';
COMMENT ON COLUMN hq_audit_logs.request_id    IS 'Correlation/trace ID propagated from the caller for cross-service tracing';

-- ---------------------------------------------------------------------------
-- D. Display & search — human-readable labels for the audit screen rows
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  -- action_category: coarse grouping of actions for dashboard widgets/filters
  -- Values: create | update | delete | read | auth | dispatch | config | admin
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='action_category') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN action_category TEXT
      CHECK (action_category IN ('create','update','delete','read','auth','dispatch','config','admin'));
  END IF;

  -- resource_label: display name of the resource ("Resend Email Provider" vs "resend")
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='resource_label') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN resource_label TEXT;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.action_category IS 'Coarse action group for dashboard widgets: create|update|delete|read|auth|dispatch|config|admin';
COMMENT ON COLUMN hq_audit_logs.resource_label  IS 'Human-readable resource name for UI display, e.g. "Resend Email Provider" vs resource_id "resend"';

-- ---------------------------------------------------------------------------
-- E. Session & bulk operation tracing
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  -- session_id: groups all actions within one admin's browser session
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='session_id') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN session_id TEXT;
  END IF;

  -- batch_id: groups entries from one bulk operation
  -- (e.g. platform broadcast → N dispatch entries all share the same batch_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='batch_id') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN batch_id UUID;
  END IF;

  -- parent_audit_id: parent→child link for nested operations
  -- (e.g. template approval → version creation + state-change both point to approval row)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='parent_audit_id') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN parent_audit_id UUID
      REFERENCES hq_audit_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.session_id      IS 'HQ admin browser session ID — groups all actions within one session for timeline view';
COMMENT ON COLUMN hq_audit_logs.batch_id        IS 'Groups entries from one bulk operation (e.g. broadcast dispatch to N tenants)';
COMMENT ON COLUMN hq_audit_logs.parent_audit_id IS 'Self-referencing FK: parent audit row that triggered this entry (for nested action trees)';

-- ---------------------------------------------------------------------------
-- F. API context — full request signature for API-originated entries
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='http_method') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN http_method TEXT
      CHECK (http_method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='http_path') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN http_path TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='http_status_code') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN http_status_code SMALLINT;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.http_method      IS 'HTTP method of the triggering request: GET|POST|PUT|PATCH|DELETE';
COMMENT ON COLUMN hq_audit_logs.http_path        IS 'API path that triggered this entry, e.g. /api/hq/v1/notifications/dispatch';
COMMENT ON COLUMN hq_audit_logs.http_status_code IS 'HTTP response status code — enables error-rate tracking on audit screen';

-- ---------------------------------------------------------------------------
-- G. Performance
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='duration_ms') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN duration_ms INT;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.duration_ms IS 'Operation wall-clock time in ms — enables slow-operation monitoring on audit screen';

-- ---------------------------------------------------------------------------
-- H. Compliance & flexible filtering
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  -- change_reason: why the admin made this change (free text or ticket ref)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='change_reason') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN change_reason TEXT;
  END IF;

  -- tags: flexible labels for filter chips (e.g. ['dispatch','email','byo'])
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='tags') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN tags TEXT[];
  END IF;

  -- is_sensitive: true when logSecure() was used — compliance filter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='hq_audit_logs' AND column_name='is_sensitive') THEN
    ALTER TABLE hq_audit_logs ADD COLUMN is_sensitive BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN hq_audit_logs.change_reason IS 'Admin-provided reason or ticket reference for this change (shown in audit detail view)';
COMMENT ON COLUMN hq_audit_logs.tags          IS 'Free-form tags for filter chips, e.g. ARRAY[''dispatch'',''email'',''byo'']';
COMMENT ON COLUMN hq_audit_logs.is_sensitive  IS 'true = logSecure() was used; entry involved credential-adjacent data — compliance filter';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- A. Tenant-scoped audit history
CREATE INDEX IF NOT EXISTS idx_hq_audit_tenant_created
  ON hq_audit_logs (tenant_org_id, created_at DESC)
  WHERE tenant_org_id IS NOT NULL;

-- C. Per-module view
CREATE INDEX IF NOT EXISTS idx_hq_audit_module_created
  ON hq_audit_logs (source_module, created_at DESC)
  WHERE source_module IS NOT NULL;

-- C. Severity alerting (only non-info rows)
CREATE INDEX IF NOT EXISTS idx_hq_audit_severity_created
  ON hq_audit_logs (severity, created_at DESC)
  WHERE severity IN ('warning','error','critical');

-- C. Cross-service trace lookup
CREATE INDEX IF NOT EXISTS idx_hq_audit_request_id
  ON hq_audit_logs (request_id)
  WHERE request_id IS NOT NULL;

-- C. Actor type timeline
CREATE INDEX IF NOT EXISTS idx_hq_audit_actor_type_created
  ON hq_audit_logs (actor_type, created_at DESC)
  WHERE actor_type IS NOT NULL;

-- D. Action category dashboard widgets
CREATE INDEX IF NOT EXISTS idx_hq_audit_category_created
  ON hq_audit_logs (action_category, created_at DESC)
  WHERE action_category IS NOT NULL;

-- E. Session timeline
CREATE INDEX IF NOT EXISTS idx_hq_audit_session_created
  ON hq_audit_logs (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- E. Batch operation lookup
CREATE INDEX IF NOT EXISTS idx_hq_audit_batch
  ON hq_audit_logs (batch_id)
  WHERE batch_id IS NOT NULL;

-- E. Parent→child traversal
CREATE INDEX IF NOT EXISTS idx_hq_audit_parent
  ON hq_audit_logs (parent_audit_id)
  WHERE parent_audit_id IS NOT NULL;

-- F. Non-2xx API error monitoring
CREATE INDEX IF NOT EXISTS idx_hq_audit_http_errors
  ON hq_audit_logs (http_status_code, created_at DESC)
  WHERE http_status_code >= 400;

-- G. Slow operation monitoring
CREATE INDEX IF NOT EXISTS idx_hq_audit_slow_ops
  ON hq_audit_logs (duration_ms DESC, created_at DESC)
  WHERE duration_ms IS NOT NULL;

-- H. Compliance: sensitive-only filter
CREATE INDEX IF NOT EXISTS idx_hq_audit_sensitive
  ON hq_audit_logs (created_at DESC)
  WHERE is_sensitive = true;

-- H. GIN index for tags array — enables @> (contains) queries efficiently
CREATE INDEX IF NOT EXISTS idx_hq_audit_tags_gin
  ON hq_audit_logs USING GIN (tags)
  WHERE tags IS NOT NULL;

COMMIT;
