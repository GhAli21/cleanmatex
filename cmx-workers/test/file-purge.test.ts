/**
 * File purge on local Supabase Postgres (migrations through 0847). Run: npm test --workspace=cmx-workers
 *
 * Proves the step 6e wiring: the registry turns the weekly schedule into a pg-boss schedule (UTC, missed
 * runs sent once) and removes it when switched off; HQ "Run now" → one `file.purge.sweep` job → completed
 * with its counts, plus a run history row. The batch rules (one Storage call per bucket, tenant-filtered
 * marks, next page after a full batch, no mark when storage fails) are proven by web-admin
 * __tests__/services/file-util.service.test.ts.
 * Note: the sweep is the real one, so it also purges any local DELETED file still holding bytes.
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import { loadConfig } from '../src/config';
import { HANDLERS } from '../src/handlers/index';
import { startWorker, type RunningWorker } from '../src/worker';

const db = new pg.Pool({ connectionString: LOCAL_DB, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const INSTANCE = 'cmx-workers-ftest';
const SCHEDULE = 'file.purge.weekly';
const QUEUE = 'file.purge.sweep';
const ACTOR = 'file-purge-test';

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 90_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('File purge schedule and Run now through the worker', () => {
  let worker: RunningWorker;
  let original: { job_code: string; desired_enabled: boolean }[];
  let polling: string;
  const startedAt = new Date();

  before(async () => {
    original = await q(`SELECT job_code, desired_enabled FROM public.sys_ops_job_cf WHERE job_code = ANY($1::text[])`, [[SCHEDULE, QUEUE]]);
    [{ polling_s: polling }] = await q<{ polling_s: string }>(`SELECT polling_s FROM public.sys_ops_job_queue_cf WHERE queue_name = $1`, [QUEUE]);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = ANY($1::text[])`, [[SCHEDULE, QUEUE]]);
    await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = 1 WHERE queue_name = $1`, [QUEUE]); // 300 s in production
    const config = loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE });
    worker = await startWorker(config, HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    for (const r of original) await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2 WHERE job_code = $1`, [r.job_code, r.desired_enabled]);
    await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = $2 WHERE queue_name = $1`, [QUEUE, polling]);
    await q(`DELETE FROM pgboss.schedule WHERE key = $1`, [SCHEDULE]);
    await q(`DELETE FROM public.sys_ops_job_run_dtl WHERE job_code = $1 AND actor = $2`, [SCHEDULE, ACTOR]);
    await q(`DELETE FROM public.sys_ops_job_req_tr WHERE job_code = $1 AND requested_by = $2`, [SCHEDULE, ACTOR]);
    await q(`DELETE FROM pgboss.job WHERE name = $1 AND created_on >= $2`, [QUEUE, startedAt]);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_schedule = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
    await jobs.stop();
    await prisma.$disconnect();
    await db.end();
  });

  it('switching the schedule on creates the weekly pg-boss schedule in UTC, missed runs sent once; off removes it', async () => {
    const sched = await worker.boss.getSchedule(QUEUE, SCHEDULE);
    assert.equal(sched?.cron, '47 3 * * 0');
    assert.equal(sched?.timezone, 'UTC');
    assert.equal(sched?.options?.missed, 'once');

    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = false WHERE job_code = $1`, [SCHEDULE]);
    await worker.syncNow();
    assert.equal(await worker.boss.getSchedule(QUEUE, SCHEDULE), null);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = $1`, [SCHEDULE]);
    await worker.syncNow();
  });

  it('Run now → one sweep job, completed with its counts, and the run is in the history', async () => {
    const [{ r }] = await q<{ r: { ok: boolean } }>(`SELECT public.fn_ops_job_run_now($1, $2) AS r`, [SCHEDULE, ACTOR]);
    assert.equal(r.ok, true);
    const job = await waitFor('sweep completed', async () =>
      (await q<{ state: string; output: { purged: number; failed: number; nextPage: number | null } }>(
        `SELECT state, output FROM pgboss.job WHERE name = $1 AND created_on >= $2 AND state = 'completed' LIMIT 1`, [QUEUE, startedAt]))[0]);
    assert.equal(typeof job.output.purged, 'number');
    assert.equal(job.output.failed, 0);
    const runs = await q<{ status: string }>(`SELECT status FROM public.sys_ops_job_run_dtl WHERE job_code = $1 AND actor = $2`, [SCHEDULE, ACTOR]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'SUCCESS');
  });
});
