# Notification Hub — Zero-Downtime Provider Switching

**Last Updated:** 2026-06-11  
**Purpose:** Switch a channel's delivery provider without interrupting outbox processing or losing in-flight messages.

**Prerequisites:** The new provider must be configured and tested before switching in production.

---

## How Switching Works

The `org_ntf_channel_provider_cf` table holds one row per (tenant, channel, provider). The `PUT /api/v1/notifications/settings/providers` endpoint performs an **atomic two-step DB update**:

1. `UPDATE ... SET is_active = false WHERE tenant_org_id = X AND channel_code = Y` — deactivate all current providers
2. `UPDATE ... SET is_active = true WHERE ... AND provider_code = Z` — activate the new one

Both updates happen in the same DB transaction. Between the two steps, the channel briefly has no active provider (typically < 1ms). The `NotificationSettingsService` caches per-tenant data for 30 seconds, so the new provider takes effect for all outbox workers within 30 seconds of the API call.

---

## Pre-Switch Checklist

- [ ] New provider ENV vars set and deployed (e.g. `FCM_SERVICE_ACCOUNT_JSON`, `FCM_PROJECT_ID`)
- [ ] New provider row registered via `POST /api/v1/notifications/settings/providers` (inactive)
- [ ] Verified new provider works in staging / with a smoke test outbox row
- [ ] For PUSH switch: new subscription type registered — ensure users have active subscriptions for the new provider (see note below)

---

## Switch Procedure

### Step 1 — Verify current state

```bash
GET /api/v1/notifications/settings/providers?channel_code=PUSH
```

Note the currently active `provider_code`.

### Step 2 — Register new provider (if not already done)

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "PUSH",
  "provider_code": "FCM",
  "display_name": "Firebase Cloud Messaging",
  "config": { "project_id": "my-project" }
}
```

Returns 409 if already registered (skip this step if so).

### Step 3 — Activate new provider

```bash
PUT /api/v1/notifications/settings/providers
{
  "channel_code": "PUSH",
  "provider_code": "FCM"
}
```

This is the atomic switch. Takes effect for outbox workers within 30 seconds (cache TTL).

### Step 4 — Verify

```bash
GET /api/v1/notifications/settings/providers?channel_code=PUSH
```

Confirm `is_active: true` on FCM and `is_active: false` on the previous provider.

```sql
-- Verify in DB
SELECT provider_code, is_active, updated_at
FROM org_ntf_channel_provider_cf
WHERE tenant_org_id = '<tenant_id>' AND channel_code = 'PUSH'
ORDER BY is_active DESC;
```

### Step 5 — Monitor delivery log after switch

```sql
SELECT channel_code, status, COUNT(*), MAX(logged_at) as last_delivery
FROM org_ntf_delivery_log_dtl
WHERE channel_code = 'PUSH'
  AND logged_at > NOW() - INTERVAL '5 minutes'
GROUP BY channel_code, status;
```

Wait 2–3 outbox cycles (2–3 minutes) and confirm `SENT` deliveries are appearing.

---

## Rollback Procedure

If the new provider fails and you need to revert:

```bash
PUT /api/v1/notifications/settings/providers
{
  "channel_code": "PUSH",
  "provider_code": "VAPID"   # or whatever the previous provider was
}
```

This immediately reverts. The cache invalidates and the outbox processor uses the previous provider on the next cycle.

**Rollback takes < 30 seconds** (one cache TTL).

---

## Special Case: Switching PUSH Provider

When switching the PUSH channel provider (e.g. VAPID → FCM), note that:

- Subscriptions in `org_ntf_push_subs_dtl` are per `(user, device, provider_code)`
- Users with VAPID subscriptions but no FCM subscriptions will receive 0 push notifications after the switch
- The outbox processor fetches subscriptions matching the **active** provider only

**Recommended PUSH migration approach:**

1. Register and activate FCM as the PUSH provider
2. Simultaneously ship a new mobile app version that registers FCM tokens on launch
3. Run both providers during the transition period:
   - The DB enforces only one `is_active` per channel — not per subscription
   - Workaround: temporarily fan out manually during migration by calling both adapters from a custom batch script
4. After 90% of users have re-subscribed with FCM tokens, the old VAPID subscriptions will expire naturally via the weekly sweep
5. Clean up: `UPDATE org_ntf_push_subs_dtl SET is_active = false WHERE provider_code = 'VAPID'`

---

## Common Switch Scenarios

| From | To | Notes |
|------|----|-------|
| Resend → SendGrid | EMAIL | Set `SENDGRID_API_KEY`, activate `SENDGRID`. No client changes. |
| TWILIO_SMS → different Twilio number | SMS | Update `TWILIO_SMS_FROM` env var + re-register provider with new `config.from_number`. |
| VAPID → FCM | PUSH | Requires client app update to register FCM tokens. Plan migration window. |
| FCM → OneSignal | PUSH | Same as above — users need new OneSignal player IDs. |
| TWILIO_WHATSAPP → META_WHATSAPP | WHATSAPP | Ensure META templates are approved before switching. |

---

## Cache TTL Consideration

The `NotificationSettingsService` caches active provider data for **30 seconds** per tenant. During this window after a switch:
- Running outbox workers may still use the old provider for up to 30 seconds
- No messages are lost — QUEUED rows will be retried on the next cycle using the new provider
- If the old provider's ENV vars were removed before the cache expires, that 30-second window will produce `FAILED_TEMPORARY` rows (they retry automatically)

**Best practice:** Keep old provider ENV vars in place for at least 60 seconds after switching, then remove them.
