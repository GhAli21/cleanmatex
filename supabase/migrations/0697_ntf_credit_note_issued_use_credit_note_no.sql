-- =============================================================================
-- 0697_ntf_credit_note_issued_use_credit_note_no.sql
-- Human-Friendly Codes (HFC) follow-up #11 / A-74:
-- Update the seeded credit_note.issued default template (0382) to use
-- {{credit_note_no}} instead of {{invoice_number}} in EN/AR subject + body.
--
-- App emit (web-admin) still also sends invoice_number as an alias so older
-- overridden tenant templates keep working.
--
-- Guards: missing tables / missing template version → NOTICE (idempotent).
-- Undo: restore subject/body from 0382 CASE (invoice_number) from backup.
-- Does NOT send any messages.
-- =============================================================================

DO $$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF to_regclass('public.sys_ntf_template_ver_dtl') IS NULL THEN
    RAISE NOTICE '0697: sys_ntf_template_ver_dtl missing — skip';
    RETURN;
  END IF;

  UPDATE public.sys_ntf_template_ver_dtl v
     SET subject  = replace(v.subject,  '{{invoice_number}}', '{{credit_note_no}}'),
         subject2 = replace(v.subject2, '{{invoice_number}}', '{{credit_note_no}}'),
         body     = replace(v.body,     '{{invoice_number}}', '{{credit_note_no}}'),
         body2    = replace(v.body2,    '{{invoice_number}}', '{{credit_note_no}}'),
         updated_at = CURRENT_TIMESTAMP
   WHERE v.template_code = 'credit_note.issued.default'
     AND (
       coalesce(v.subject,  '') LIKE '%{{invoice_number}}%'
       OR coalesce(v.subject2, '') LIKE '%{{invoice_number}}%'
       OR coalesce(v.body,     '') LIKE '%{{invoice_number}}%'
       OR coalesce(v.body2,    '') LIKE '%{{invoice_number}}%'
     );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE NOTICE '0697: no credit_note.issued.default version still using {{invoice_number}} (already updated or missing)';
  ELSE
    RAISE NOTICE '0697: updated % credit_note.issued.default version row(s) to {{credit_note_no}}', v_n;
  END IF;
END
$$;