/**
 * Schedules (DESIGN §5.5 "Sweep", §20.9; migration 0823). A `PGBOSS_SCHEDULE` registry row names a
 * cron (`schedule`, else `default_schedule`, read in UTC) and a target queue. This worker owns the rows
 * whose target queue it consumes: it creates, changes or removes the pg-boss schedule (key = job_code)
 * to match `desired_enabled`, reports `applied_*`, and serves HQ "Run now" requests by sending one job
 * to the target queue.
 */
import type { Db, PgBoss } from 'pg-boss';
import { errorText, log } from './log';

export interface ScheduleSetting {
  jobCode: string;
  targetQueue: string;
  cron: string;
  /** On, ACTIVE and its target has a handler here. */
  wanted: boolean;
}

/** Every schedule row whose target queue this worker consumes, including switched-off and superseded ones (to remove them). */
export async function readSchedules(db: Db, handlers: Readonly<Record<string, unknown>>): Promise<ScheduleSetting[]> {
  const { rows } = await db.executeSql(
    `SELECT c.job_code, c.target_job_code, COALESCE(c.schedule, c.default_schedule) AS cron,
            (c.desired_enabled AND c.lifecycle_status = 'ACTIVE' AND c.is_active AND c.rec_status = 1) AS enabled
       FROM public.sys_ops_job_cf c
       JOIN public.sys_ops_job_queue_cf q ON q.queue_name = c.target_job_code AND q.consumer_app = 'CMX_WORKERS'
      WHERE c.kind = 'PGBOSS_SCHEDULE'
      ORDER BY c.job_code`,
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    jobCode: String(r.job_code),
    targetQueue: String(r.target_job_code),
    cron: String(r.cron),
    wanted: r.enabled === true && Boolean(handlers[String(r.target_job_code)]),
  }));
}

/** Makes pg-boss's schedules match the registry. Returns what is in force, for reporting. */
export async function applySchedules(boss: PgBoss, settings: ScheduleSetting[]): Promise<{ jobCode: string; enabled: boolean; cron: string | null }[]> {
  const applied: { jobCode: string; enabled: boolean; cron: string | null }[] = [];
  if (!settings.length) return applied;
  // One read of every pg-boss schedule instead of one per registry row.
  const existing = new Map((await boss.getSchedules()).map((x) => [`${x.name}|${x.key}`, x]));
  for (const s of settings) {
    const current = existing.get(`${s.targetQueue}|${s.jobCode}`);
    if (s.wanted) {
      if (!current || current.cron !== s.cron || current.timezone !== 'UTC' || current.options?.missed !== 'once') {
        // missed 'once': a run that came due while the worker was down is sent when it is back (pg-boss default skips it).
        await boss.schedule(s.targetQueue, s.cron, {}, { key: s.jobCode, tz: 'UTC', missed: 'once' });
        log('info', 'schedule set', { job: s.jobCode, queue: s.targetQueue, cron: s.cron });
      }
      applied.push({ jobCode: s.jobCode, enabled: true, cron: s.cron });
    } else {
      if (current) {
        await boss.unschedule(s.targetQueue, s.jobCode);
        log('info', 'schedule removed', { job: s.jobCode, queue: s.targetQueue });
      }
      applied.push({ jobCode: s.jobCode, enabled: false, cron: null });
    }
  }
  return applied;
}

/** Writes what is in force. Skips rows already current within 5 minutes, like the queue report. */
export async function reportSchedules(db: Db, by: string, applied: { jobCode: string; enabled: boolean; cron: string | null }[]): Promise<void> {
  if (!applied.length) return;
  await db.executeSql(
    `UPDATE public.sys_ops_job_cf c
        SET applied_enabled = x.enabled, applied_schedule = x.cron, applied_at = now(), applied_by = $4
       FROM unnest($1::text[], $2::boolean[], $3::text[]) AS x(code, enabled, cron)
      WHERE c.job_code = x.code
        AND c.kind = 'PGBOSS_SCHEDULE'
        AND (c.applied_enabled IS DISTINCT FROM x.enabled OR c.applied_schedule IS DISTINCT FROM x.cron
             OR c.applied_at IS NULL OR c.applied_at < now() - interval '5 minutes')`,
    [applied.map((a) => a.jobCode), applied.map((a) => a.enabled), applied.map((a) => a.cron), by],
  );
}

/**
 * HQ "Run now" on a schedule: claims the waiting requests for schedules this worker owns, sends one
 * job to each target queue and closes the request (run history). A target without a handler here
 * closes as failed instead of sending a job nobody runs.
 */
export async function runManualRequests(boss: PgBoss, db: Db, worker: string, handlers: Readonly<Record<string, unknown>>): Promise<number> {
  const { rows } = await db.executeSql(`SELECT request_id, job_code, target_queue FROM public.fn_ops_job_sched_claim_manual('CMX_WORKERS', $1)`, [worker]);
  for (const r of rows as { request_id: string; job_code: string; target_queue: string }[]) {
    let ok = false;
    let message: string;
    try {
      if (!handlers[r.target_queue]) {
        message = `cmx-workers has no handler for ${r.target_queue}`;
      } else {
        const jobId = await boss.send(r.target_queue, {});
        ok = true;
        message = `Sent one job to ${r.target_queue} (${jobId ?? 'not inserted'})`;
      }
    } catch (err) {
      message = `Could not send to ${r.target_queue}: ${errorText(err)}`;
    }
    await db.executeSql('SELECT public.fn_ops_job_finish($1::uuid, $2, $3, $4)', [r.request_id, worker, ok, message]);
    log(ok ? 'info' : 'error', 'manual run', { job: r.job_code, queue: r.target_queue, message });
  }
  return rows.length;
}
