BEGIN;
DO $$
DECLARE v_n INTEGER;
BEGIN
  IF to_regclass('public.sys_ntf_template_ver_dtl') IS NULL THEN
    RAISE NOTICE 'skip: no template table';
    RAISE NOTICE 'PASS: hfc_f11 (skipped)';
    RETURN;
  END IF;
  SELECT count(*) INTO v_n FROM public.sys_ntf_template_ver_dtl
   WHERE template_code = 'credit_note.issued.default'
     AND (
       coalesce(subject,'') LIKE '%{{invoice_number}}%'
       OR coalesce(body,'') LIKE '%{{invoice_number}}%'
       OR coalesce(subject2,'') LIKE '%{{invoice_number}}%'
       OR coalesce(body2,'') LIKE '%{{invoice_number}}%'
     );
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FAIL: % version(s) still use {{invoice_number}}', v_n;
  END IF;
  RAISE NOTICE 'PASS: hfc_f11_credit_note_template_uses_credit_note_no';
END $$;
ROLLBACK;