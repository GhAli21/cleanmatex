/**
 * The registry is the control plane (DESIGN §20.8–§20.9): `sys_ops_job_cf.desired_enabled` pauses or
 * resumes a queue, `sys_ops_job_queue_cf` holds how this worker runs it. The worker reports what it
 * actually runs in `applied_enabled` / `applied_at`, which the HQ jobs screen uses for WORKER_NOT_SEEN
 * (20 minutes) and STATE_DRIFT.
 */
import type { Db } from 'pg-boss';

export interface QueueSetting {
  queueName: string;
  desiredEnabled: boolean;
  localConcurrency: number;
  pollingS: number;
  expireS: number;
  retryLimit: number;
}

export async function readRegistry(db: Db): Promise<QueueSetting[]> {
  const { rows } = await db.executeSql(
    `SELECT q.queue_name, c.desired_enabled, q.local_concurrency, q.polling_s::float8 AS polling_s, q.expire_s, q.retry_limit
       FROM public.sys_ops_job_queue_cf q
       JOIN public.sys_ops_job_cf c ON c.job_code = q.queue_name
      WHERE q.consumer_app = 'CMX_WORKERS'
        AND c.kind = 'PGBOSS_QUEUE'
        AND c.is_active AND q.is_active
        AND c.lifecycle_status NOT IN ('SUPERSEDED', 'RETIRED')
      ORDER BY q.queue_name`,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    queueName: String(r.queue_name),
    desiredEnabled: r.desired_enabled === true,
    localConcurrency: Number(r.local_concurrency),
    pollingS: Number(r.polling_s),
    expireS: Number(r.expire_s),
    retryLimit: Number(r.retry_limit),
  }));
}

/** Writes what this worker runs. Skips rows already current within 5 minutes, so an idle worker writes ~1 row per queue per 5 minutes. */
export async function reportApplied(db: Db, by: string, applied: { queueName: string; enabled: boolean }[]): Promise<void> {
  if (!applied.length) return;
  await db.executeSql(
    `UPDATE public.sys_ops_job_cf c
        SET applied_enabled = x.enabled, applied_at = now(), applied_by = $3
       FROM unnest($1::text[], $2::boolean[]) AS x(code, enabled)
      WHERE c.job_code = x.code
        AND c.kind = 'PGBOSS_QUEUE'
        AND (c.applied_enabled IS DISTINCT FROM x.enabled OR c.applied_at IS NULL OR c.applied_at < now() - interval '5 minutes')`,
    [applied.map((a) => a.queueName), applied.map((a) => a.enabled), by],
  );
}
