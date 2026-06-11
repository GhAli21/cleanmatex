# Notification Hub — Channel Settings

**Last Updated:** 2026-06-11  
**Purpose:** Enable channels per tenant and configure quiet hours, daily limits, and per-user preferences via the settings API.

**Prerequisites:**  
- [04_provider_activation.md](./04_provider_activation.md) — at least one provider activated per channel you want to enable  
- Authenticated as tenant admin

---

## Enable a Channel

```bash
PUT /api/v1/notifications/settings
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "EMAIL",
  "is_enabled": true,
  "quiet_hours_enabled": false
}
```

Repeat for each channel: `EMAIL`, `SMS`, `WHATSAPP`, `PUSH`, `IN_APP`.

---

## Get All Channel Settings

```bash
GET /api/v1/notifications/settings
Authorization: Bearer <session-token>
```

Response includes `activeProvider` merged in from `org_ntf_channel_provider_cf`.

---

## Quiet Hours Configuration

Quiet hours prevent non-urgent notifications from being sent during specified hours. Transactional messages (e.g. payment received) still go through.

### Format
- `quiet_hours_start` / `quiet_hours_end`: `HH:MM` in 24-hour format
- `quiet_hours_tz`: IANA timezone string

### GCC Timezone Examples

**Dubai / UAE Standard Time:**
```bash
PUT /api/v1/notifications/settings
{
  "channel_code": "SMS",
  "is_enabled": true,
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "quiet_hours_tz": "Asia/Dubai"
}
```

**Saudi Arabia:**
```bash
PUT /api/v1/notifications/settings
{
  "channel_code": "SMS",
  "is_enabled": true,
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "quiet_hours_tz": "Asia/Riyadh"
}
```

**Kuwait / Qatar:**
```bash
{
  "channel_code": "WHATSAPP",
  "is_enabled": true,
  "quiet_hours_enabled": true,
  "quiet_hours_start": "23:00",
  "quiet_hours_end": "07:00",
  "quiet_hours_tz": "Asia/Kuwait"
}
```

**Oman:**
```bash
{
  "quiet_hours_tz": "Asia/Muscat"
}
```

### How Quiet Hours Work

When the orchestrator dispatches an event during quiet hours, it calculates the next allowed send time and sets `scheduled_at` on the outbox row. The outbox processor respects `scheduled_at ≤ NOW()` and won't pick up rows until that time passes.

---

## Daily Limit

Set maximum number of notifications per user per channel per day:

```bash
PUT /api/v1/notifications/settings
{
  "channel_code": "PUSH",
  "is_enabled": true,
  "quiet_hours_enabled": false,
  "daily_limit": 5
}
```

`null` means unlimited.

---

## Recommended Settings by Channel

| Channel | Quiet hours | Daily limit | Notes |
|---------|------------|-------------|-------|
| IN_APP | No | null | Real-time; user controls via preferences |
| EMAIL | No | null | Transactional; respect user unsubscribe |
| SMS | Yes (22:00–08:00) | 3 | High friction — restrict to transactional |
| WHATSAPP | Yes (22:00–08:00) | 3 | Requires template approval |
| PUSH | Yes (22:00–08:00) | 5 | Browser permission is opt-in |

---

## Per-User Preferences API

Users can opt in/out of channels and specific events. This does not override marketing consent.

### Get user preferences
```bash
GET /api/v1/notifications/user-prefs
Authorization: Bearer <session-token>

# Filter by channel:
GET /api/v1/notifications/user-prefs?channel_code=EMAIL
```

### Set user preference
```bash
PUT /api/v1/notifications/user-prefs
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "EMAIL",
  "event_code": null,
  "is_enabled": true,
  "marketing_consent": false
}
```

- `event_code: null` = applies to all events on this channel (coarse preference)
- `event_code: "order.status_changed"` = applies only to that specific event
- `marketing_consent: true` = user consents to marketing/promotional messages on this channel

### Marketing consent vs transactional

- **Transactional events** (`is_transactional = true` in `sys_notification_events_cd`): sent regardless of marketing consent
- **Marketing events**: blocked unless `marketing_consent = true` for the user on that channel

---

## Verify Channel Settings in DB

```sql
SELECT channel_code, is_enabled, quiet_hours_enabled,
       quiet_hours_start, quiet_hours_end, quiet_hours_tz, daily_limit
FROM org_ntf_settings_cf
WHERE tenant_org_id = 'your-tenant-uuid'
ORDER BY channel_code;
```
