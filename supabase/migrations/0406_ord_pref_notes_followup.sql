-- ==================================================================
-- Migration: 0406_ord_pref_notes_followup.sql
-- Purpose: Add notes_followup JSONB on org_order_preferences_dtl +
--          atomic append helper for Processing / Prepare follow-up notes.
-- Do NOT apply from agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

ALTER TABLE org_order_preferences_dtl
  ADD COLUMN IF NOT EXISTS notes_followup JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN org_order_preferences_dtl.notes_followup IS
  'Append-only follow-up notes array: [{note_seq, note_user_id, note_datetime, note_source, note_text}, ...]. Sources: ORDER_CREATE, ORDER_EDIT, ORDER_PREPARE, ORDER_PROCESSING, etc.';

ALTER TABLE org_order_preferences_dtl
  DROP CONSTRAINT IF EXISTS chk_ord_pref_notes_followup_array;

ALTER TABLE org_order_preferences_dtl
  ADD CONSTRAINT chk_ord_pref_notes_followup_array
  CHECK (jsonb_typeof(notes_followup) = 'array');

-- Atomic append: computes next note_seq server-side; avoids RMW races.
CREATE OR REPLACE FUNCTION cmx_ord_pref_append_notes_followup(
  p_tenant_org_id UUID,
  p_pref_id UUID,
  p_note_user_id TEXT,
  p_note_source TEXT,
  p_note_text TEXT,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_notes JSONB;
  v_next_seq INT;
  v_entry JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_note_text IS NULL OR btrim(p_note_text) = '' THEN
    RAISE EXCEPTION 'note_text is required';
  END IF;

  IF p_note_source IS NULL OR btrim(p_note_source) = '' THEN
    RAISE EXCEPTION 'note_source is required';
  END IF;

  SELECT COALESCE(notes_followup, '[]'::jsonb)
  INTO v_notes
  FROM org_order_preferences_dtl
  WHERE id = p_pref_id
    AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'preference not found';
  END IF;

  SELECT COALESCE(MAX((elem->>'note_seq')::INT), 0) + 1
  INTO v_next_seq
  FROM jsonb_array_elements(v_notes) AS elem;

  v_entry := jsonb_build_object(
    'note_seq', v_next_seq,
    'note_user_id', p_note_user_id,
    'note_datetime', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'note_source', p_note_source,
    'note_text', btrim(p_note_text)
  );

  UPDATE org_order_preferences_dtl
  SET
    notes_followup = v_notes || jsonb_build_array(v_entry),
    updated_at = v_now,
    updated_by = COALESCE(p_updated_by, p_note_user_id)
  WHERE id = p_pref_id
    AND tenant_org_id = p_tenant_org_id
  RETURNING notes_followup INTO v_notes;

  RETURN v_notes;
END;
$$;

COMMENT ON FUNCTION cmx_ord_pref_append_notes_followup(UUID, UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Append one follow-up note to org_order_preferences_dtl.notes_followup atomically.';

COMMIT;
