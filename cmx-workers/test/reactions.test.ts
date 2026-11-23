/**
 * Finance event reactions end to end on local Supabase Postgres (migrations through 0809).
 * Run: npm test --workspace=cmx-workers
 *
 * Proves DESIGN §10.2 step 4 / §22.2:
 *  - code and database agree on every reaction (queue, event, handler) and on the tenant monitor catalog;
 *  - emitEventTx → publish → worker → one history row, one effect row, event PROCESSED;
 *  - operator retry re-runs the reaction and writes nothing new;
 *  - a job whose event row is gone completes as SKIPPED_ORPHAN;
 *  - the last failed attempt marks the event DEAD_LETTERED and the job lands in dead_letter, with no effect row.
 * Creates its own customer, order and events, and deletes everything it created.
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import { emitEventTx, manualRetry } from '@/lib/services/outbox.service';
import { OUTBOX_HANDLER_CATALOG } from '@/lib/constants/order-financial';
import { loadConfig } from '../src/config';
import { FIN_REACTIONS } from '../src/handlers/fin-reactions';
import { HANDLERS } from '../src/handlers/index';
import { startWorker, type RunningWorker } from '../src/worker';

const db = new pg.Pool({ connectionString: LOCAL_DB, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const INSTANCE = 'cmx-workers-rtest';
const HISTORY_Q = 'fin.order_submitted.order_history';
const CASH_Q = 'fin.cash_drawer_variance_recorded.cash_over_short';

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
const eventRow = async (tenant: string, id: string) =>
  (await q<{ status: string; error_message: string | null }>(
    `SELECT status, error_message FROM public.org_domain_events_outbox WHERE id = $1 AND tenant_org_id = $2`, [id, tenant]))[0];
const effects = async (tenant: string, key: string) =>
  (await q<{ n: number }>(`SELECT count(*)::int n FROM public.org_ops_job_effect_tr WHERE tenant_org_id = $1 AND effect_key = $2`, [tenant, key]))[0].n;

describe('reaction contract: code and database agree', () => {
  it('FIN_REACTIONS equals the enabled CMX_WORKERS reactions in sys_ops_job_event_subs_cf', async () => {
    const rows = await q<{ queue: string; eventCode: string; handlerCode: string }>(
      `SELECT s.queue_job_code AS "queue", s.event_code AS "eventCode", s.handler_code AS "handlerCode"
         FROM public.sys_ops_job_event_subs_cf s
         JOIN public.sys_ops_job_queue_cf qd ON qd.queue_name = s.queue_job_code
        WHERE s.is_enabled AND s.is_active AND qd.consumer_app = 'CMX_WORKERS'
        ORDER BY 1`);
    const code = [...FIN_REACTIONS].map((r) => ({ ...r })).sort((a, b) => a.queue.localeCompare(b.queue));
    assert.deepEqual(code, rows);
    for (const r of rows) assert.ok(HANDLERS[r.queue], `no handler for ${r.queue}`);
  });

  it('the tenant monitor catalog (OUTBOX_HANDLER_CATALOG) lists the same reactions', () => {
    const fromCatalog = OUTBOX_HANDLER_CATALOG.flatMap((e) => e.eventTypes.map((t) => `${e.handler}:${t}`)).sort();
    const fromCode = FIN_REACTIONS.map((r) => `${r.handlerCode}:${r.eventCode}`).sort();
    assert.deepEqual(fromCatalog, fromCode);
  });
});

describe('finance reactions on local Postgres', () => {
  let worker: RunningWorker;
  let tenant: string;
  let customerId: string;
  let orderId: string;
  const eventIds: string[] = [];
  let cashOriginal: { retry_limit: number };

  before(async () => {
    [{ id: tenant }] = await q<{ id: string }>(`SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`);
    [{ id: customerId }] = await q<{ id: string }>(
      `INSERT INTO public.org_customers_mst (tenant_org_id, name) VALUES ($1, 'cmx-workers reaction test') RETURNING id`, [tenant]);
    [{ id: orderId }] = await q<{ id: string }>(
      `INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no) VALUES ($1, $2, '') RETURNING id`, [tenant, customerId]);
    [cashOriginal] = await q<{ retry_limit: number }>(`SELECT retry_limit FROM public.sys_ops_job_queue_cf WHERE queue_name = $1`, [CASH_Q]);

    const config = loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE });
    worker = await startWorker(config, HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    await q(`UPDATE public.sys_ops_job_queue_cf SET retry_limit = $2 WHERE queue_name = $1`, [CASH_Q, cashOriginal.retry_limit]);
    await q(`UPDATE pgboss.queue SET retry_limit = 8, retry_delay = 10 WHERE name = $1`, [CASH_Q]);
    await q(`DELETE FROM pgboss.job WHERE data->>'eventId' = ANY($1::text[])`, [eventIds]);
    await q(`DELETE FROM public.org_ops_job_effect_tr WHERE tenant_org_id = $1 AND split_part(effect_key, ':', 2) = ANY($2::text[])`, [tenant, eventIds]);
    await q(`DELETE FROM public.org_order_history WHERE tenant_org_id = $1 AND order_id = $2`, [tenant, orderId]);
    await q(`DELETE FROM public.org_domain_events_outbox WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, eventIds]);
    await q(`DELETE FROM public.org_orders_mst WHERE tenant_org_id = $1 AND id = $2`, [tenant, orderId]);
    await q(`DELETE FROM public.org_customers_mst WHERE tenant_org_id = $1 AND id = $2`, [tenant, customerId]);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
    await jobs.stop(); // the web-admin producer started by emitEventTx
    await prisma.$disconnect();
    await db.end();
  });

  it('emit → publish → reaction: one history row, one effect row, event PROCESSED', async () => {
    const eventId = await prisma.$transaction((tx) =>
      emitEventTx(tx, tenant, 'ORDER_SUBMITTED', 'order', orderId, { paymentStatus: 'PAID', settled: true }));
    eventIds.push(eventId);
    assert.equal((await eventRow(tenant, eventId)).status, 'PENDING');

    await waitFor('event PROCESSED', async () => (await eventRow(tenant, eventId)).status === 'PROCESSED');
    const history = await q(`SELECT 1 FROM public.org_order_history WHERE tenant_org_id = $1 AND outbox_event_id = $2`, [tenant, eventId]);
    assert.equal(history.length, 1);
    assert.equal(await effects(tenant, `order_history:${eventId}`), 1);
    const [job] = await q<{ state: string; output: { outcome: string } }>(
      `SELECT state, output FROM pgboss.job WHERE name = $1 AND id = $2`, [HISTORY_Q, eventId]);
    assert.equal(job.state, 'completed');
    assert.equal(job.output.outcome, 'WRITTEN');
  });

  it('operator retry re-runs the reaction and writes nothing new', async () => {
    const eventId = eventIds[0];
    await q(`UPDATE public.org_domain_events_outbox SET status = 'DEAD_LETTERED', error_message = 'test' WHERE id = $1 AND tenant_org_id = $2`, [eventId, tenant]);

    await manualRetry(eventId, tenant);
    assert.equal((await eventRow(tenant, eventId)).status, 'PENDING');
    await waitFor('event PROCESSED again', async () => (await eventRow(tenant, eventId)).status === 'PROCESSED');

    assert.equal((await eventRow(tenant, eventId)).error_message, null);
    const history = await q(`SELECT 1 FROM public.org_order_history WHERE tenant_org_id = $1 AND outbox_event_id = $2`, [tenant, eventId]);
    assert.equal(history.length, 1);
    assert.equal(await effects(tenant, `order_history:${eventId}`), 1);
    const outcomes = await q<{ outcome: string }>(
      `SELECT output->>'outcome' AS outcome FROM pgboss.job WHERE name = $1 AND data->>'eventId' = $2 AND state = 'completed' ORDER BY completed_on`, [HISTORY_Q, eventId]);
    assert.deepEqual(outcomes.map((o) => o.outcome), ['WRITTEN', 'ALREADY_APPLIED']);
  });

  it('a job whose event row is gone completes as SKIPPED_ORPHAN', async () => {
    const eventId = randomUUID();
    eventIds.push(eventId);
    const jobId = await worker.boss.send(HISTORY_Q, { tenantOrgId: tenant, eventId });
    const job = await waitFor('orphan job completed', async () =>
      (await q<{ state: string; output: { outcome: string } }>(`SELECT state, output FROM pgboss.job WHERE name = $1 AND id = $2 AND state = 'completed'`, [HISTORY_Q, jobId]))[0]);
    assert.equal(job.output.outcome, 'SKIPPED_ORPHAN');
  });

  it('the last failed attempt marks the event DEAD_LETTERED; the job goes to dead_letter; no effect is kept', async () => {
    // One attempt only, so the test does not wait through backoff. Restored in after().
    await q(`UPDATE public.sys_ops_job_queue_cf SET retry_limit = 0 WHERE queue_name = $1`, [CASH_Q]);
    await q(`UPDATE pgboss.queue SET retry_limit = 0, retry_delay = 0 WHERE name = $1`, [CASH_Q]);
    await worker.syncNow(); // settings changed → consumer restarts with retryLimit 0

    // A variance event without its required fields: the handler throws.
    const eventId = await prisma.$transaction((tx) =>
      emitEventTx(tx, tenant, 'CASH_DRAWER_VARIANCE_RECORDED', 'cash_drawer_session', randomUUID(), {}));
    eventIds.push(eventId);

    const row = await waitFor('event DEAD_LETTERED', async () => {
      const r = await eventRow(tenant, eventId);
      return r.status === 'DEAD_LETTERED' ? r : null;
    });
    assert.match(row.error_message ?? '', /payload missing required fields/);
    await waitFor('dead letter', async () =>
      (await q(`SELECT 1 FROM pgboss.job WHERE name = 'dead_letter' AND data->>'eventId' = $1`, [eventId]))[0]);
    assert.equal(await effects(tenant, `cash_over_short:${eventId}`), 0, 'the failed transaction must not keep its effect row');
  });
});
