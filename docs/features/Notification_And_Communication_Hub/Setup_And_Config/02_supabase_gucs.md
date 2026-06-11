# Notification Hub — Supabase GUC Configuration

**Last Updated:** 2026-06-11  
**Purpose:** Set the two PostgreSQL GUC settings required by the outbox processor. These are not in any migration file — they must be set manually in the Supabase SQL Editor.

**Prerequisites:** [01_migrations.md](./01_migrations.md) applied.

---

## What Are GUCs?

GUCs (Grand Unified Configuration) are PostgreSQL session variables accessible inside functions and triggers via `current_setting()`. The notification outbox cron uses them to call the Next.js API with the correct URL and secret.

---

## The Two Required GUCs

### 1. `app.next_js_base_url`

Used by the pg_cron job to construct the outbox processor URL:
```
{app.next_js_base_url}/api/notifications/process-outbox
```

### 2. `app.outbox_secret_key`

The secret passed as `Authorization: Bearer {secret}` in the pg_net HTTP call. Must match the `NOTIFICATIONS_OUTBOX_SECRET` environment variable in your Next.js app.

---

## How to Set Them

Open the Supabase SQL Editor and run:

```sql
-- Set the base URL of your deployed Next.js app (no trailing slash)
ALTER DATABASE postgres SET app.next_js_base_url = 'https://your-app-domain.com';

-- Set a strong random secret (minimum 32 characters)
ALTER DATABASE postgres SET app.outbox_secret_key = 'your-strong-random-secret-here';
```

For local development:
```sql
ALTER DATABASE postgres SET app.next_js_base_url = 'http://localhost:3000';
ALTER DATABASE postgres SET app.outbox_secret_key = 'local-dev-secret-change-in-prod';
```

> These settings persist across Supabase restarts.

---

## Generate a Strong Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: e.g. a3f8c2d1b4e7f0a9c6d3b2e1f4a7c0d9b6e3f0a9c6d3b2e1f4a7c0d9b6e3f0a9
```

Use this value for **both** the GUC and the `NOTIFICATIONS_OUTBOX_SECRET` env var.

---

## Verify the GUCs Are Set

```sql
SELECT current_setting('app.next_js_base_url', true)  AS base_url,
       current_setting('app.outbox_secret_key', true) AS secret_key_set;
```

Expected output:
```
base_url                          | secret_key_set
https://your-app-domain.com       | your-strong-random-secret-here
```

If either returns `NULL`, the GUC was not set — re-run the `ALTER DATABASE` command.

---

## Verify the pg_cron Jobs Use the Correct URL

```sql
SELECT jobname, command FROM cron.job WHERE jobname LIKE 'ntf%';
```

You should see the `ntf-outbox-processor` command contains `current_setting('app.next_js_base_url')`. This is evaluated at runtime each time the job fires, so updating the GUC takes effect immediately for the next cron run.

---

## What Breaks If These Are Missing

| Missing GUC | Symptom |
|-------------|---------|
| `app.next_js_base_url` | pg_cron job calls `null/api/notifications/process-outbox` → HTTP 0 error → all outbox rows stay in QUEUED forever |
| `app.outbox_secret_key` | The HTTP call is made but returns 401 Unauthorized → outbox processor does nothing → same symptom as above |

Check `cron.job_run_details` if the outbox is not processing:
```sql
SELECT jobid, jobname, status, return_message, start_time
FROM cron.job_run_details
WHERE jobname = 'ntf-outbox-processor'
ORDER BY start_time DESC
LIMIT 10;
```

---

## Updating After Deployment URL Change

If you redeploy to a new domain:
```sql
ALTER DATABASE postgres SET app.next_js_base_url = 'https://new-domain.com';
```

The next cron execution (within 1 minute) will automatically use the new URL. No restart required.
