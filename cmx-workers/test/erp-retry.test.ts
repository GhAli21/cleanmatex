/**
 * ERP posting retry on local Supabase Postgres (migrations through 0825). Run: npm test --workspace=cmx-workers
 *
 * Proves the step 6c wiring: a `fin.erp_post.retry` job sent through the app producer is consumed by
 * the worker and completes; an exception that no longer exists (or a person already handled) is
 * skipped, never replayed. When the engine queues the job (SYSTEM_ERROR only, attempts 1-2, savepoint
 * inside a business transaction) is proven by web-admin
 * __tests__/services/erp-lite-posting-engine.service.test.ts ("auto-retry queueing").
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import { loadConfig } from '../src/config';
import { HANDLERS } from '../src/handlers/index';
import { startWorker, type RunningWorker } from '../src/worker';

const db = new pg.Pool({ connectionString: LOCAL_DB, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const INSTANCE = 'cmx-workers-etest';
const QUEUE = 'fin.erp_post.retry';

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('ERP posting retry through the worker', () => {
  let worker: RunningWorker;
  let original: { desired_enabled: boolean; polling_s: string };
  const exceptionId = randomUUID();

  before(async () => {
    [original] = await q(
      `SELECT c.desired_enabled, qc.polling_s FROM public.sys_ops_job_cf c
       JOIN public.sys_ops_job_queue_cf qc ON qc.queue_name = c.job_code WHERE c.job_code = $1`, [QUEUE]);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = $1`, [QUEUE]);
    await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = 1 WHERE queue_name = $1`, [QUEUE]); // 300 s in production
    const config = loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE });
    worker = await startWorker(config, HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2 WHERE job_code = $1`, [QUEUE, original.desired_enabled]);
    await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = $2 WHERE queue_name = $1`, [QUEUE, original.polling_s]);
    await q(`DELETE FROM pgboss.job WHERE name = $1 AND id = $2`, [QUEUE, exceptionId]);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_schedule = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
    await jobs.stop();
    await prisma.$disconnect();
    await db.end();
  });

  it('a job for an exception that does not exist completes as SKIPPED_ORPHAN, and the same id is sent once', async () => {
    const [{ id: tenantOrgId }] = await q<{ id: string }>(`SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`);
    const payload = { tenantOrgId, exceptionId, postingLogId: randomUUID() };
    const first = await prisma.$transaction((tx) => jobs.enqueue(tx, QUEUE, payload, { id: exceptionId }));
    const again = await prisma.$transaction((tx) => jobs.enqueue(tx, QUEUE, payload, { id: exceptionId }));
    assert.equal(first, exceptionId);
    assert.equal(again, null);

    const job = await waitFor('retry job completed', async () =>
      (await q<{ output: { outcome: string; reason?: string } }>(
        `SELECT output FROM pgboss.job WHERE name = $1 AND id = $2 AND state = 'completed'`, [QUEUE, exceptionId]))[0]);
    assert.deepEqual(job.output, { outcome: 'SKIPPED_ORPHAN', reason: 'EXCEPTION_NOT_FOUND' });
  });
});
