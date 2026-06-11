-- =============================================================================
-- CMX-PRD-019 Notification Hub — Step 1: Set Supabase GUCs
-- =============================================================================
-- Paste this into: Supabase Dashboard > SQL Editor
-- Run ONCE per database (local + production separately).
--
-- app.next_js_base_url   — pg_cron uses this to call the outbox processor endpoint
-- app.outbox_secret_key  — must EXACTLY match NOTIFICATIONS_OUTBOX_SECRET in .env.local
--
-- WARNING: The secret below was generated 2026-06-11 and already written to .env.local.
--          Do NOT change it unless you update the env var simultaneously.
-- =============================================================================

-- Supabase hosted restricts ALTER DATABASE — use ALTER ROLE postgres instead.
-- pg_cron executes all jobs as the postgres role, so this is equivalent.
ALTER ROLE postgres
  SET app.next_js_base_url = 'https://cmx.cleanmatex.com/';

ALTER ROLE postgres
  SET app.outbox_secret_key = '4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf';

-- Apply to the current session immediately (ALTER ROLE takes effect on next connection):
SET app.next_js_base_url = 'https://cmx.cleanmatex.com/';
SET app.outbox_secret_key = '4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf';

-- Verify both are set:
SELECT
  current_setting('app.next_js_base_url', true)  AS next_js_base_url,
  current_setting('app.outbox_secret_key', true)  AS outbox_secret_key;
-- Expected:
--   next_js_base_url             | outbox_secret_key
--   https://cmx.cleanmatex.com/  | 4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf

-- Verify pg_cron jobs are registered:
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'ntf%'
ORDER BY jobname;
-- Expected:
--   ntf-outbox-processor        | * * * * *   | t
--   ntf-outbox-retry            | */5 * * * * | t
--   ntf-sweep-stale-push-subs   | 0 3 * * 0   | t
