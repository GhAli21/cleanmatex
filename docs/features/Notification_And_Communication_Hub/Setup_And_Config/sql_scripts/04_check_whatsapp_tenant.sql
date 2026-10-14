-- =============================================================================
-- WhatsApp diagnostic checks (read-only)
-- =============================================================================
-- Replace the tenant UUID below, then run each block in the SQL editor.
-- Do not log or SELECT encrypted_config / secret runtime values.
-- =============================================================================

-- SET THE TENANT TO INSPECT
-- :tenant_org_id := 'c9ac29d1-219c-4a3a-8887-f860550c32be';

-- 1) Channel enabled?  org_ntf_settings_cf.WHATSAPP.is_enabled
SELECT
  tenant_org_id,
  channel_code,
  is_enabled,
  is_active AS settings_row_active,
  quiet_hours_enabled,
  daily_limit,
  updated_at,
  updated_by
FROM org_ntf_settings_cf
WHERE channel_code = 'WHATSAPP'
  AND tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'::uuid
ORDER BY tenant_org_id;

-- 2) Provider active?  org_ntf_channel_provider_cf.TWILIO_WHATSAPP.is_active
SELECT
  id,
  tenant_org_id,
  channel_code,
  provider_code,
  display_name,
  is_active,
  dispatch_mode,
  config,
  (encrypted_config IS NOT NULL) AS has_encrypted_creds,
  updated_at,
  updated_by
FROM org_ntf_channel_provider_cf
WHERE channel_code = 'WHATSAPP'
  AND tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'::uuid
ORDER BY provider_code;

-- 3) Event map: does order.created (and related) route to WHATSAPP?
SELECT
  event_code,
  channel_code,
  is_default,
  can_override,
  is_active
FROM sys_ntf_event_chan_map
WHERE channel_code = 'WHATSAPP'
  AND event_code IN ('order.created', 'order.ready', 'order.cancelled', 'order.status_changed')
ORDER BY event_code;

-- 4) Runtime flags that affect WhatsApp (Config Registry, migration 0618; secrets never shown)
SELECT
  config_key,
  source_policy,
  env_var_name,
  CASE WHEN is_secret OR is_encrypted THEN '***' ELSE db_value END AS stored_value,
  is_wired,
  value_updated_at
FROM sys_ops_config_cf
WHERE config_key IN (
  'ntf.app.whatsapp_fallback_email',
  'ntf.app.order_transition_notify',
  'ntf.app.wa_use_sandbox_template',
  'ntf.app.wa_sandbox_content_sid',
  'ntf.app.wa_sandbox_to_phone',
  'ntf.app.outbox_inline_dispatch',
  'ntf.app.twilio_whatsapp_from',
  'ntf.app.twilio_sms_from',
  'ntf.app.dispatch_via_hq',
  'ntf.app.hq_dispatch_url'
)
ORDER BY config_key;

-- 5) Recent outbox: WhatsApp vs email fallback for this tenant
SELECT
  created_at,
  event_code,
  channel_code,
  provider_code,
  status,
  skip_reason,
  error_message,
  recipient_address,
  source_entity_type,
  source_entity_id,
  retry_count
FROM org_ntf_outbox_dtl
WHERE tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'::uuid
  AND (
    channel_code IN ('WHATSAPP', 'EMAIL')
    OR event_code IN ('order.created', 'order.ready', 'order.cancelled')
  )
ORDER BY created_at DESC
LIMIT 50;

-- 6) Latest orders and the mobile used for WhatsApp
SELECT
  id,
  order_no,
  status,
  customer_mobile_number,
  created_at
FROM org_orders_mst
WHERE tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'::uuid
ORDER BY created_at DESC
LIMIT 20;

-- 7) All tenants at a glance (WhatsApp ready?)
SELECT
  t.id AS tenant_org_id,
  t.name AS tenant_name,
  s.is_enabled AS whatsapp_channel_enabled,
  p.provider_code,
  p.is_active AS provider_active,
  p.config->>'from_number' AS from_number,
  p.config->>'use_sandbox_template' AS use_sandbox_template,
  p.config->>'sandbox_content_sid' AS sandbox_content_sid
FROM org_tenants_mst t
LEFT JOIN org_ntf_settings_cf s
  ON s.tenant_org_id = t.id
 AND s.channel_code = 'WHATSAPP'
LEFT JOIN org_ntf_channel_provider_cf p
  ON p.tenant_org_id = t.id
 AND p.channel_code = 'WHATSAPP'
WHERE t.is_active = true
ORDER BY t.name, p.provider_code;

-- Ready-to-send check for one tenant (both flags must be true)
SELECT
  (s.is_enabled IS TRUE) AS channel_enabled,
  (p.is_active IS TRUE AND p.provider_code = 'TWILIO_WHATSAPP') AS twilio_whatsapp_active,
  (s.is_enabled IS TRUE AND p.is_active IS TRUE) AS ready_to_attempt_whatsapp
FROM org_ntf_settings_cf s
FULL OUTER JOIN org_ntf_channel_provider_cf p
  ON p.tenant_org_id = s.tenant_org_id
 AND p.channel_code = s.channel_code
WHERE COALESCE(s.tenant_org_id, p.tenant_org_id) = 'c9ac29d1-219c-4a3a-8887-f860550c32be'::uuid
  AND COALESCE(s.channel_code, p.channel_code) = 'WHATSAPP';
