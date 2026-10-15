-- Config Registry — convert a STORED value between plain and encrypted storage in place.
--
-- 0615 let an operator choose plain or encrypted storage only while a key held no value (clear, switch,
-- re-enter). Operators asked to flip the storage form of a key that already holds a value without
-- re-typing it. HQ platform-api can do that (it holds the master key): it reads the stored value,
-- re-encodes it in the target form, and calls this function, which swaps the form and the stored
-- column in ONE statement under the row lock. Nothing is ever cleared in between, so a crash cannot
-- lose a secret.
--
-- The database never sees the master key or the plaintext of an encrypted value; it receives either the
-- plain value (when converting to plain) or the envelope (when converting to encrypted), exactly like
-- fn_ops_config_set. The value itself is unchanged, so its SHA-256 fingerprint is unchanged and is used
-- as an optimistic-concurrency check: the call only succeeds if the stored fingerprint still equals the
-- one the API read, so a value changed by someone else in between is never overwritten.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ops_config_convert_encryption(
  p_key                  TEXT,
  p_is_encrypted         BOOLEAN,
  p_value_plain          TEXT,
  p_value_enc            TEXT,
  p_expected_fingerprint TEXT,
  p_actor                TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg   public.sys_ops_config_cf%ROWTYPE;
  v_actor TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_config_cf
  WHERE config_key = p_key AND rec_status = 1 AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Config key is not registered', 'config_key', p_key);
  END IF;
  IF v_cfg.is_bootstrap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOTSTRAP_KEY',
      'message', 'Bootstrap keys hold no stored value', 'config_key', p_key);
  END IF;
  IF p_is_encrypted IS NULL OR v_cfg.is_encrypted = p_is_encrypted THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Storage form is already set', 'config_key', p_key);
  END IF;

  -- No stored value: only the flag changes (same result as fn_ops_config_set_encryption).
  IF v_cfg.db_value IS NULL AND v_cfg.db_value_enc IS NULL THEN
    UPDATE public.sys_ops_config_cf
    SET is_encrypted = p_is_encrypted,
        last_check_status = NULL,
        last_check_at = NULL,
        value_updated_at = now(),
        value_updated_by = v_actor,
        updated_info = 'fn_ops_config_convert_encryption by ' || v_actor
    WHERE config_key = p_key;

    INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, created_info)
    VALUES (p_key, 'ENCRYPTION_CHANGE', v_actor,
            'fn_ops_config_convert_encryption (no value) -> ' || CASE WHEN p_is_encrypted THEN 'encrypted' ELSE 'plain' END);
    RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Storage form updated', 'config_key', p_key);
  END IF;

  -- A stored value exists: it must not have changed since the API read it.
  IF p_expected_fingerprint IS NULL OR p_expected_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_expected_fingerprint <> v_cfg.db_value_fingerprint THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_VALUE',
      'message', 'The stored value changed while it was being converted; reload and retry', 'config_key', p_key);
  END IF;

  -- Exactly the column of the TARGET form may be supplied.
  IF p_is_encrypted THEN
    IF p_value_enc IS NULL OR btrim(p_value_enc) = '' OR p_value_plain IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'Converting to encrypted: supply the envelope only', 'config_key', p_key);
    END IF;
    IF length(p_value_enc) > 16000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
  ELSE
    IF p_value_plain IS NULL OR btrim(p_value_plain) = '' OR p_value_enc IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'Converting to plain: supply the plain value only', 'config_key', p_key);
    END IF;
    IF length(p_value_plain) > 4000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
    -- Converting to plain: the database can verify what it is about to store. The plain value must be
    -- exactly the value the stored fingerprint was made from (SHA-256 of the UTF-8 text, as the API
    -- computes it), so a caller can never change the value through a conversion.
    IF encode(sha256(convert_to(p_value_plain, 'UTF8')), 'hex') <> v_cfg.db_value_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FINGERPRINT',
        'message', 'The plain value does not match the stored fingerprint', 'config_key', p_key);
    END IF;
  END IF;

  -- One statement: the form flag and the stored column change together; the fingerprint is unchanged
  -- because the value is unchanged (ck_sys_ops_config_cf_plain / _enc / _fpset hold before and after).
  UPDATE public.sys_ops_config_cf
  SET is_encrypted     = p_is_encrypted,
      db_value         = CASE WHEN p_is_encrypted THEN NULL ELSE p_value_plain END,
      db_value_enc     = CASE WHEN p_is_encrypted THEN p_value_enc ELSE NULL END,
      last_check_status = NULL,
      last_check_at    = NULL,
      value_updated_at = now(),
      value_updated_by = v_actor,
      updated_info     = 'fn_ops_config_convert_encryption by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
  VALUES (p_key, 'ENCRYPTION_CHANGE', v_actor, v_cfg.db_value_fingerprint, v_cfg.db_value_fingerprint,
          'fn_ops_config_convert_encryption (value converted) -> ' || CASE WHEN p_is_encrypted THEN 'encrypted' ELSE 'plain' END);

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Value converted', 'config_key', p_key);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_convert_encryption(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) IS
  'Switches a non-bootstrap key between plain and encrypted storage in place, converting an existing stored value atomically under the row lock. The caller (HQ platform-api, which holds the master key) supplies the value in the TARGET form plus the fingerprint it read; a changed stored value yields STALE_VALUE. Logs ENCRYPTION_CHANGE with the (unchanged) fingerprint. Service-role only.';

REVOKE ALL ON FUNCTION public.fn_ops_config_convert_encryption(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_convert_encryption(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
