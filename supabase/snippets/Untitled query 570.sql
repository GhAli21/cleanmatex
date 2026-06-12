-- Supabase hosted restricts ALTER DATABASE — use ALTER ROLE postgres instead.
-- pg_cron runs as the postgres role, so this is equivalent.
ALTER ROLE postgres
  SET app.next_js_base_url = 'https://cmx.cleanmatex.com/';

ALTER ROLE postgres
  SET app.outbox_secret_key = '4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf';

-- Apply to current session (ALTER ROLE takes effect on next connection only):
SET app.next_js_base_url = 'https://cmx.cleanmatex.com/';
SET app.outbox_secret_key = '4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf';

-- Verify:
SELECT
  current_setting('app.next_js_base_url', true)   AS next_js_base_url,
  current_setting('app.outbox_secret_key', true)   AS outbox_secret_key;

-- Verify pg_cron jobs:
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ntf%' ORDER BY jobname;
