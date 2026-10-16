-- LOCAL ONLY: stop jobs that POST to the (production) base_url via pg_net
SELECT jobname, cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'ntf-outbox-processor',    -- every minute
  'ntf-campaign-scheduler',  -- every minute
  'fin-outbox-processor',    -- every minute
  'ntf-reconcile-outbox',    -- every 5 min
  'fin-erp-posting-retry',   -- hourly
  'fin-pos-session-rollover',-- every 15 min
  'fin-gift-card-expiry', 'fin-credit-note-expiry',
  'fin-loyalty-points-expiry', 'fin-idempotency-cleanup'  -- daily
);

-- Verify: should list nothing active that is HTTP-calling
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'ntf-%' OR jobname LIKE 'fin-%' ORDER BY jobname;
