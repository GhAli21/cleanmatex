/**
 * ntf.orchestrate end to end on local Supabase (migrations through 0810, local API running).
 * Run: npm test --workspace=cmx-workers
 *
 * Proves STEP5_PLAN.md (tenant side):
 *  - emitNotificationEvent stores a request and queues ntf.orchestrate (job id = request id);
 *  - the worker writes the in-app and outbox rows, queues one ntf.deliver per sendable outbox row
 *    (job id = outbox id, for HQ API) and marks the request PROCESSED;
 *  - running the request again writes no second row and no second deliver job;
 *  - a job for a request that no longer exists completes as SKIPPED_ORPHAN.
 * Uses the demo tenant's settings; switches ntf.orchestrate on for the run and restores it.
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import { requestNotification } from '@/lib/notifications/request.service';
import { loadConfig } from '../src/config';
import { HANDLERS } from '../src/handlers/index';
import { startWorker, type RunningWorker } from '../src/worker';

const db = new pg.Pool({ connectionString: LOCAL_DB, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const INSTANCE = 'cmx-workers-ntest';
const Q = 'ntf.orchestrate';

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('ntf.orchestrate on local Supabase', () => {
  let worker: RunningWorker;
  let tenant: string;
  let userId: string;
  const sourceId = randomUUID();
  const requestIds: string[] = [];
  let wasEnabled: boolean;

  before(async () => {
    // The demo tenant: settings with IN_APP and EMAIL on, and a user with an email address.
    [{ tenant_org_id: tenant, user_id: userId }] = await q<{ tenant_org_id: string; user_id: string }>(
      `SELECT u.tenant_org_id, u.user_id
         FROM public.org_users_mst u
         JOIN auth.users a ON a.id = u.user_id AND a.email IS NOT NULL
         JOIN public.org_ntf_settings_cf s ON s.tenant_org_id = u.tenant_org_id AND s.channel_code = 'EMAIL' AND s.is_enabled
        ORDER BY u.tenant_org_id, u.user_id LIMIT 1`);
    [{ desired_enabled: wasEnabled }] = await q<{ desired_enabled: boolean }>(`SELECT desired_enabled FROM public.sys_ops_job_cf WHERE job_code = $1`, [Q]);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = $1`, [Q]);
    worker = await startWorker(loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE }), HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2 WHERE job_code = $1`, [Q, wasEnabled]);
    const outbox = await q<{ id: string }>(`SELECT id::text AS id FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND source_entity_id = $2`, [tenant, sourceId]);
    await q(`DELETE FROM pgboss.job WHERE name = 'ntf.deliver' AND id = ANY($1::uuid[])`, [outbox.map((o) => o.id)]);
    await q(`DELETE FROM pgboss.job WHERE name IN ($1, 'dead_letter') AND data->>'requestId' = ANY($2::text[])`, [Q, requestIds]);
    await q(`DELETE FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND source_entity_id = $2`, [tenant, sourceId]);
    await q(`DELETE FROM public.org_ntf_inbox_mst WHERE tenant_org_id = $1 AND source_entity_id = $2`, [tenant, sourceId]);
    await q(`DELETE FROM public.org_ntf_requests_tr WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, requestIds]);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
    await jobs.stop();
    await prisma.$disconnect();
    await db.end();
  });

  it('request → in-app and outbox rows, one ntf.deliver per sendable row, request PROCESSED', async () => {
    const requestId = await requestNotification({
      code: 'order.created',
      tenantOrgId: tenant,
      recipientUserIds: [userId],
      sourceEntityType: 'order',
      sourceEntityId: sourceId,
      variables: { order_number: 'ORD-JOBS-TEST' },
    });
    requestIds.push(requestId);
    const [job] = await q<{ data: Record<string, string> }>(`SELECT data FROM pgboss.job WHERE name = $1 AND id = $2`, [Q, requestId]);
    assert.deepEqual(job.data, { tenantOrgId: tenant, requestId }, 'the job carries ids only');

    const req = await waitFor('request PROCESSED', async () =>
      (await q<{ status: string; result_summary: { deliverJobs: number } }>(
        `SELECT status, result_summary FROM public.org_ntf_requests_tr WHERE id = $1 AND tenant_org_id = $2 AND status <> 'PENDING'`, [requestId, tenant]))[0]);
    assert.equal(req.status, 'PROCESSED');

    const inbox = await q(`SELECT 1 FROM public.org_ntf_inbox_mst WHERE tenant_org_id = $1 AND source_entity_id = $2`, [tenant, sourceId]);
    assert.ok(inbox.length >= 1, 'in-app row written');
    const sendable = await q<{ id: string }>(
      `SELECT id::text AS id FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND source_entity_id = $2 AND status IN ('QUEUED', 'FAILED_TEMPORARY')`, [tenant, sourceId]);
    assert.ok(sendable.length >= 1, 'at least the EMAIL outbox row is sendable');
    const deliver = await q<{ id: string; data: Record<string, string> }>(
      `SELECT id::text AS id, data FROM pgboss.job WHERE name = 'ntf.deliver' AND id = ANY($1::uuid[])`, [sendable.map((r) => r.id)]);
    assert.equal(deliver.length, sendable.length, 'one ntf.deliver job per sendable outbox row');
    assert.equal(req.result_summary.deliverJobs, sendable.length);
    for (const d of deliver) assert.deepEqual(d.data, { tenantOrgId: tenant, outboxId: d.id });
  });

  it('running the request again writes no second row and no second deliver job', async () => {
    const requestId = requestIds[0];
    const count = async () => (await q<{ inbox: number; outbox: number; deliver: number }>(
      `SELECT (SELECT count(*)::int FROM public.org_ntf_inbox_mst WHERE tenant_org_id = $1 AND source_entity_id = $2) AS inbox,
              (SELECT count(*)::int FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND source_entity_id = $2) AS outbox,
              (SELECT count(*)::int FROM pgboss.job j WHERE j.name = 'ntf.deliver'
                 AND j.id IN (SELECT o.id FROM public.org_ntf_outbox_dtl o WHERE o.tenant_org_id = $1 AND o.source_entity_id = $2)) AS deliver`,
      [tenant, sourceId]))[0];
    const before_ = await count();

    // Force a full re-run, as after a crash between writing rows and marking the request.
    await q(`UPDATE public.org_ntf_requests_tr SET status = 'PENDING', processed_at = NULL WHERE id = $1 AND tenant_org_id = $2`, [requestId, tenant]);
    const rerunId = await worker.boss.send(Q, { tenantOrgId: tenant, requestId });
    await waitFor('re-run completed', async () =>
      (await q(`SELECT 1 FROM pgboss.job WHERE name = $1 AND id = $2 AND state = 'completed'`, [Q, rerunId]))[0]);

    assert.deepEqual(await count(), before_);
    const [req] = await q<{ status: string }>(`SELECT status FROM public.org_ntf_requests_tr WHERE id = $1 AND tenant_org_id = $2`, [requestId, tenant]);
    assert.equal(req.status, 'PROCESSED');
  });

  it('a job for a request that no longer exists completes as SKIPPED_ORPHAN', async () => {
    const requestId = randomUUID();
    requestIds.push(requestId);
    const jobId = await worker.boss.send(Q, { tenantOrgId: tenant, requestId });
    const done = await waitFor('orphan completed', async () =>
      (await q<{ output: { outcome: string } }>(`SELECT output FROM pgboss.job WHERE name = $1 AND id = $2 AND state = 'completed'`, [Q, jobId]))[0]);
    assert.equal(done.output.outcome, 'SKIPPED_ORPHAN');
  });
});
