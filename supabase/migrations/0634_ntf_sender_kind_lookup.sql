--
-- Notification Hub: lookup of allowed sender kinds per provider ("pick, don't type").
--
-- sys_ntf_prov_send_mst.sender_kind and org_ntf_prov_send_mst.sender_kind were free text (0571) with no list.
-- This adds the source of truth the HQ console uses to offer a pick list filtered by the account's provider, and
-- the capability keys each kind may declare in the sender "capabilities" JSON object.
--
-- Deliberately NOT done here: no foreign key from the sender tables yet. Existing rows may hold other spellings;
-- run the verification query at the end first, align the data, then add the FK in a later migration.
-- The HQ API validates kind vs provider only when this table exists and has rows for the provider (soft rollout).
--
-- Seed (owner decision 2026-10-17; provider and channel codes exactly as in sys_ntf_providers_cd, 0346/0351):
--   TWILIO_WHATSAPP / WHATSAPP -> WHATSAPP_NUMBER   (capabilities: message_types = template | session)
--   META_WHATSAPP   / WHATSAPP -> WHATSAPP_NUMBER   (capabilities: message_types = template | session)
--   TWILIO_SMS      / SMS      -> PHONE_NUMBER, MESSAGING_SERVICE (no capability keys yet)
--   RESEND          / EMAIL    -> EMAIL_ADDRESS     (no capability keys yet)
--
-- Affected: sys_ntf_sender_kind_cd (new).
-- Related:  0571_ntf_provider_account_sender_foundation.sql, 0346_ntf_templates_schema.sql, 0351_notif_push_subscriptions.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_ntf_sender_kind_cd (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  code                  TEXT        NOT NULL,                               -- Stored value of sender_kind (exact case).
  provider_code         TEXT        NOT NULL REFERENCES public.sys_ntf_providers_cd(code) ON DELETE RESTRICT,
  channel_code          TEXT        NOT NULL REFERENCES public.sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  name_en               TEXT        NOT NULL,                               -- English display name.
  name_ar               TEXT        NOT NULL,                               -- Arabic display name.
  allowed_capabilities  JSONB       NOT NULL DEFAULT '{}'::jsonb,           -- Capability keys and allowed values.
  display_order         INTEGER     NOT NULL DEFAULT 0,                     -- Order in the pick list.
  is_active             BOOLEAN     NOT NULL DEFAULT true,                  -- Offered for new senders when true.
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT,
  created_info          TEXT,
  updated_at            TIMESTAMPTZ,
  updated_by            TEXT,
  updated_info          TEXT,
  rec_status            SMALLINT    NOT NULL DEFAULT 1,
  rec_order             INTEGER,
  rec_notes             TEXT,
  CONSTRAINT uq_ntf_sender_kind UNIQUE (provider_code, code),
  CONSTRAINT ck_ntf_sender_kind_caps CHECK (jsonb_typeof(allowed_capabilities) = 'object')
);

COMMENT ON TABLE public.sys_ntf_sender_kind_cd IS 'Allowed sender kinds per provider, with the capability keys each kind may declare. Source of the HQ sender-kind pick list.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.code IS 'Sender kind code stored in sys_ntf_prov_send_mst.sender_kind / org_ntf_prov_send_mst.sender_kind (exact case).';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.provider_code IS 'Provider this kind belongs to (sys_ntf_providers_cd.code).';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.channel_code IS 'Channel of the provider (sys_ntf_channel_cd.code).';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.name_en IS 'English display name.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.name_ar IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.allowed_capabilities IS 'JSON object: capability key -> array of allowed values, e.g. {"message_types":["template","session"]}. Empty object = no keys defined.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.display_order IS 'Order in the pick list.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.is_active IS 'Offered for new senders when true; inactive kinds stay valid for existing rows.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.created_by IS 'Creator.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.created_info IS 'Creator provenance.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.updated_at IS 'Last update time.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.updated_by IS 'Last updater.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.updated_info IS 'Last updater provenance.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.rec_status IS 'Soft-delete status (1 = active).';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.rec_order IS 'Optional ordering value.';
COMMENT ON COLUMN public.sys_ntf_sender_kind_cd.rec_notes IS 'Free-text notes.';
COMMENT ON CONSTRAINT uq_ntf_sender_kind ON public.sys_ntf_sender_kind_cd IS 'One row per provider and kind code.';
COMMENT ON CONSTRAINT ck_ntf_sender_kind_caps ON public.sys_ntf_sender_kind_cd IS 'allowed_capabilities must be a JSON object.';

ALTER TABLE public.sys_ntf_sender_kind_cd ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ntf_sender_kind_cd FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sys_ntf_sender_kind_cd TO service_role;  -- read by the HQ API only; changed by migrations

INSERT INTO public.sys_ntf_sender_kind_cd (code, provider_code, channel_code, name_en, name_ar, allowed_capabilities, display_order, created_by, created_info)
SELECT v.code, v.provider_code, v.channel_code, v.name_en, v.name_ar, v.caps::jsonb, v.display_order, 'migration', '0634'
FROM (VALUES
  ('WHATSAPP_NUMBER',   'TWILIO_WHATSAPP', 'WHATSAPP', 'WhatsApp number',   'رقم واتساب',        '{"message_types":["template","session"]}', 10),
  ('WHATSAPP_NUMBER',   'META_WHATSAPP',   'WHATSAPP', 'WhatsApp number',   'رقم واتساب',        '{"message_types":["template","session"]}', 10),
  ('PHONE_NUMBER',      'TWILIO_SMS',      'SMS',      'Phone number',      'رقم هاتف',          '{}', 10),
  ('MESSAGING_SERVICE', 'TWILIO_SMS',      'SMS',      'Messaging Service', 'خدمة المراسلة',     '{}', 20),
  ('EMAIL_ADDRESS',     'RESEND',          'EMAIL',    'Email address',     'عنوان بريد إلكتروني', '{}', 10)
) AS v(code, provider_code, channel_code, name_en, name_ar, caps, display_order)
-- Skip a provider that does not exist on this database instead of failing the migration.
WHERE EXISTS (SELECT 1 FROM public.sys_ntf_providers_cd p WHERE p.code = v.provider_code)
ON CONFLICT (provider_code, code) DO NOTHING;

COMMIT;

-- Read-only verification (run before adding a foreign key in a later migration):
-- SELECT 'platform' AS owner, a.provider_code, s.sender_kind, count(*)
--   FROM public.sys_ntf_prov_send_mst s JOIN public.sys_ntf_prov_acct_mst a ON a.id = s.account_id
--  GROUP BY a.provider_code, s.sender_kind
-- UNION ALL
-- SELECT 'tenant', a.provider_code, s.sender_kind, count(*)
--   FROM public.org_ntf_prov_send_mst s JOIN public.org_ntf_prov_acct_mst a ON a.id = s.account_id AND a.tenant_org_id = s.tenant_org_id
--  GROUP BY a.provider_code, s.sender_kind
-- ORDER BY 1, 2, 3;
-- Rows whose (provider_code, sender_kind) is not in sys_ntf_sender_kind_cd must be fixed before the FK is added.