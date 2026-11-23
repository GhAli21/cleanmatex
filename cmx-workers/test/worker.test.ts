/**
 * cmx-workers against local Supabase Postgres (migrations through 0808). Run: npm test --workspace=cmx-workers
 * Proves DESIGN §10 step 3: a job runs; a failing job retries with backoff, lands in dead_letter and redrives;
 * pause and resume from the registry; the worker reports itself so HQ stops flagging WORKER_NOT_SEEN.
 * Restores the registry row and deletes every job it created.
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Job } from 'pg-boss';
import { loadConfig } from '../src/config';
import { HANDLERS } from '../src/handlers/index';
import { handlerBudgetMs, runWithBudget } from '../src/runner';
import { startWorker, type RunningWorker } from '../src/worker';

const URL_ = LOCAL_DB;
const Q = 'ops.smoke_test';
const db = new pg.Pool({ connectionString: URL_, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
const jobState = async (name: string, runId: string) =>
  (await q<{ state: string; retry_count: number }>(`SELECT state, retry_count FROM pgboss.job WHERE name = $1 AND data->>'runId' = $2 ORDER BY created_on DESC LIMIT 1`, [name, runId]))[0];

const fakeJob = (signal = new AbortController().signal) => ({ id: 'j', name: 'n', data: {}, signal, retryCount: 0, expireInSeconds: 60, heartbeatSeconds: null }) as Job<unknown>;

describe('runWithBudget', () => {
  it('returns the handler result', async () => {
    assert.deepEqual(await runWithBudget(async () => ({ ok: 1 }), fakeJob(), 1000), { ok: 1 });
  });
  it('fails a handler that outlives its budget', async () => {
    await assert.rejects(runWithBudget(() => new Promise(() => {}), fakeJob(), 50), /exceeded its 50 ms budget/);
  });
  it('fails when pg-boss aborts the job', async () => {
    const ac = new AbortController();
    const p = runWithBudget(() => new Promise(() => {}), fakeJob(ac.signal), 10_000);
    ac.abort(new Error('stopping'));
    await assert.rejects(p, /stopping/);
  });
  it('keeps the budget below expireInSeconds', () => {
    for (const s of [1, 2, 30, 60, 120, 300, 900]) assert.ok(handlerBudgetMs(s) < s * 1000 || s === 1, String(s));
  });
});

describe('loadConfig', () => {
  it('requires a CA certificate for a non-local database', () => {
    assert.throws(() => loadConfig({ ...LOCAL_ENV, JOBS_DATABASE_URL: 'postgresql://u:p@aws-1-us-east-2.pooler.supabase.com:5432/postgres' }), /JOBS_DATABASE_CA_CERT/);
    assert.equal(loadConfig({ ...LOCAL_ENV }).JOBS_DB_POOL_MAX, 4);
  });
  it('requires the variables the reaction services read', () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...rest } = LOCAL_ENV;
    assert.throws(() => loadConfig(rest), /NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe('cmx-workers on local Postgres', () => {
  let worker: RunningWorker;
  const runIds: string[] = [];
  const finalFailures: string[] = [];
  let original: Record<string, unknown>;

  before(async () => {
    [original] = await q(`SELECT desired_enabled, applied_enabled, applied_at, applied_by FROM public.sys_ops_job_cf WHERE job_code = $1`, [Q]);
    assert.ok(original, 'ops.smoke_test registry row (0808) is missing');
    const config = loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: 'cmx-workers-test' });
    worker = await startWorker(config, HANDLERS, (_e, queue, jobId) => finalFailures.push(`${queue}:${jobId}`));
  });

  after(async () => {
    await worker?.stop();
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2, applied_enabled = $3, applied_at = $4, applied_by = $5 WHERE job_code = $1`,
      [Q, original.desired_enabled, original.applied_enabled, original.applied_at, original.applied_by]);
    await q(`DELETE FROM pgboss.job WHERE name IN ($1, 'dead_letter') AND data->>'runId' = ANY($2::text[])`, [Q, runIds]);
    await q(`DELETE FROM pgboss.instance WHERE name = 'cmx-workers-test'`);
    // This worker also runs the finance reaction queues: clear what it reported for them.
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = 'cmx-workers-test'`);
    await db.end();
  });

  it('reports itself in the registry, so HQ no longer flags WORKER_NOT_SEEN', async () => {
    const [row] = await q<{ applied_enabled: boolean; applied_by: string }>(`SELECT applied_enabled, applied_by FROM public.sys_ops_job_cf WHERE job_code = $1`, [Q]);
    assert.equal(row.applied_enabled, true);
    assert.equal(row.applied_by, 'cmx-workers-test');
    const [list] = await q<{ drift_flags: string[] }>(`SELECT drift_flags FROM public.fn_ops_job_list_v2() WHERE job_code = $1`, [Q]);
    assert.ok(!list.drift_flags.includes('WORKER_NOT_SEEN'), list.drift_flags.join());
  });

  it('runs a job', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    await worker.boss.send(Q, { runId });
    await waitFor('completed', async () => (await jobState(Q, runId))?.state === 'completed');
  });

  it('retries a failing job with backoff, dead-letters it, then redrives it', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    const sourceId = await worker.boss.send(Q, { runId, mode: 'fail' });
    const dead = await waitFor('dead letter', async () => (await q<{ id: string }>(`SELECT id FROM pgboss.job WHERE name = 'dead_letter' AND data->>'runId' = $1`, [runId]))[0]);
    const failed = await jobState(Q, runId);
    assert.equal(failed.state, 'failed');
    assert.equal(failed.retry_count, 2); // registry retry_limit 2 → 3 attempts
    assert.ok(finalFailures.includes(`${Q}:${sourceId}`), 'final failure was not reported for alerting');

    assert.equal(await worker.boss.redrive('dead_letter', { ids: [dead.id] }), 1);
    await waitFor('redriven job back in the source queue', async () =>
      (await q(`SELECT 1 FROM pgboss.job WHERE name = $1 AND data->>'runId' = $2 AND state IN ('created', 'retry', 'active')`, [Q, runId]))[0]);
    await waitFor('dead-lettered again after redrive', async () =>
      (await q(`SELECT 1 FROM pgboss.job WHERE name = 'dead_letter' AND data->>'runId' = $1`, [runId]))[0]);
  });

  it('pauses and resumes from the registry; paused jobs wait in the queue', async () => {
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = false WHERE job_code = $1`, [Q]);
    await worker.syncNow();
    const [paused] = await q<{ applied_enabled: boolean }>(`SELECT applied_enabled FROM public.sys_ops_job_cf WHERE job_code = $1`, [Q]);
    assert.equal(paused.applied_enabled, false);

    const runId = randomUUID();
    runIds.push(runId);
    await worker.boss.send(Q, { runId });
    await new Promise((r) => setTimeout(r, 3000)); // longer than the queue's 2 s polling
    assert.equal((await jobState(Q, runId)).state, 'created');

    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = $1`, [Q]);
    await worker.syncNow();
    await waitFor('completed after resume', async () => (await jobState(Q, runId))?.state === 'completed');
  });
});
