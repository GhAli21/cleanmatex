-- Fix for fn_ntf_rotate_outbox_secret (0616).
--
-- 0616 validated the new secret with the pattern '^[A-Za-z0-9_.~-]{32,256}$'. PostgreSQL's regex
-- engine limits a repetition count to 255, so the function raised "invalid regular expression:
-- invalid repetition count(s)" for EVERY input. This replaces it with a character-class check plus a
-- separate length check (no counted repetition), and additionally refuses the value that was
-- committed in migration 0355 (it is public in git history, so rotating to it protects nothing).
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ntf_rotate_outbox_secret(p_new_secret TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  -- sha256 of the secret committed in migration 0355 (compared by digest so the value is not repeated here).
  c_burned_fp CONSTANT TEXT := '3c011b99e9b96745549354bfe00a86c6e72b364bcb13e37ff2975ab0c3dfb189';
BEGIN
  IF p_new_secret IS NULL
     OR char_length(p_new_secret) NOT BETWEEN 32 AND 256
     OR p_new_secret !~ '^[A-Za-z0-9_.~-]+$' THEN
    RAISE EXCEPTION 'outbox secret must be 32-256 characters from A-Z a-z 0-9 _ . ~ -';
  END IF;

  IF encode(sha256(convert_to(p_new_secret, 'UTF8')), 'hex') = c_burned_fp THEN
    RAISE EXCEPTION 'this value was committed to the repository (migration 0355) and must not be reused; generate a new one';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'ntf_outbox_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      p_new_secret,
      'ntf_outbox_secret',
      'Bearer secret pg_cron presents to the tenant app notification endpoints; must equal NOTIFICATIONS_OUTBOX_SECRET.'
    );
  ELSE
    PERFORM vault.update_secret(v_id, p_new_secret);
  END IF;

  -- Fingerprint prefix only, so the operator can confirm which value is live without exposing it.
  RETURN jsonb_build_object(
    'rotated', true,
    'fingerprint', left(encode(sha256(convert_to(p_new_secret, 'UTF8')), 'hex'), 12)
  );
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) IS
  'Creates or replaces the Vault secret ntf_outbox_secret used by the notification cron jobs. Returns only a 12-hex fingerprint. The same value must be set as NOTIFICATIONS_OUTBOX_SECRET on the tenant web host. Service-role only. (0619: regex repetition-count fix.)';
REVOKE ALL ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) TO service_role;

COMMIT;
