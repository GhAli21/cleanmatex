/**
 * Integration test against local Supabase Postgres with migrations 0807 + 0808 applied.
 * Run: npm test --workspace=@cmx/jobs  (JOBS_TEST_DATABASE_URL overrides the local default).
 * Every case cleans up: committed jobs are deleted, everything else runs in a rolled-back transaction.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { claimEffect, createJobProducer } from '../src/index';

const url = process.env.JOBS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const prisma = new PrismaClient({ datasourceUrl: url });
const producer = createJobProducer(prisma);
const QUEUE = 'ops.smoke_test';
const ROLLBACK = new Error('rollback');

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
/** Runs fn in a transaction that is always rolled back. */
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  await assert.rejects(prisma.$transaction(async (tx) => { await fn(tx); throw ROLLBACK; }), ROLLBACK);
}
async function jobCount(id: string, name = QUEUE) {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>('SELECT count(*)::int n FROM pgboss.job WHERE name = $1 AND id = $2::uuid', name, id);
  return rows[0].n;
}

describe('@cmx/jobs producer mode', () => {
  before(async () => { await prisma.$queryRawUnsafe('SELECT 1 FROM pgboss.queue LIMIT 1'); });
  after(async () => { await producer.stop(); await prisma.$disconnect(); });

  it('commit keeps the job', async () => {
    const id = await prisma.$transaction((tx) => producer.enqueue(tx, QUEUE, { runId: randomUUID() }));
    assert.ok(id);
    try {
      assert.equal(await jobCount(id), 1);
    } finally {
      await prisma.$executeRawUnsafe('DELETE FROM pgboss.job WHERE name = $1 AND id = $2::uuid', QUEUE, id);
    }
  });

  it('rollback removes the job', async () => {
    let id: string | null = null;
    await inRollback(async (tx) => { id = await producer.enqueue(tx, QUEUE, { runId: randomUUID() }); });
    assert.ok(id);
    assert.equal(await jobCount(id!), 0);
  });

  it('the same job id is inserted once', async () => {
    const id = randomUUID();
    await inRollback(async (tx) => {
      assert.equal(await producer.enqueue(tx, QUEUE, { runId: randomUUID() }, { id }), id);
      assert.equal(await producer.enqueue(tx, QUEUE, { runId: randomUUID() }, { id }), null);
      const rows = await tx.$queryRawUnsafe<{ n: number }[]>('SELECT count(*)::int n FROM pgboss.job WHERE name = $1 AND id = $2::uuid', QUEUE, id);
      assert.equal(rows[0].n, 1);
    });
  });

  it('rejects payloads that are not ids-only', async () => {
    await assert.rejects(prisma.$transaction((tx) =>
      producer.enqueue(tx, QUEUE, { runId: randomUUID(), customer: { phone: '+968' } } as never)));
    await assert.rejects(prisma.$transaction((tx) => producer.enqueue(tx, QUEUE, { runId: 'not-an-id' })));
  });

  it('publish sends one job per subscribed queue, with the event id as job id, once', async () => {
    const eventId = randomUUID();
    await inRollback(async (tx) => {
      await tx.$executeRawUnsafe(`INSERT INTO pgboss.subscription (event, name) VALUES ('JOBS_TEST_HAPPENED', $1)`, QUEUE);
      const data = { tenantOrgId: randomUUID(), eventId };
      await producer.publish(tx, 'JOBS_TEST_HAPPENED', data);
      await producer.publish(tx, 'JOBS_TEST_HAPPENED', data);
      const rows = await tx.$queryRawUnsafe<{ n: number }[]>('SELECT count(*)::int n FROM pgboss.job WHERE name = $1 AND id = $2::uuid', QUEUE, eventId);
      assert.equal(rows[0].n, 1);
    });
  });

  it('publish with redeliver adds a new job even when the event id job exists', async () => {
    const eventId = randomUUID();
    await inRollback(async (tx) => {
      await tx.$executeRawUnsafe(`INSERT INTO pgboss.subscription (event, name) VALUES ('JOBS_TEST_HAPPENED', $1)`, QUEUE);
      const data = { tenantOrgId: randomUUID(), eventId };
      await producer.publish(tx, 'JOBS_TEST_HAPPENED', data);
      await producer.publish(tx, 'JOBS_TEST_HAPPENED', data, { redeliver: true });
      const rows = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int n FROM pgboss.job WHERE name = $1 AND data->>'eventId' = $2`, QUEUE, eventId);
      assert.equal(rows[0].n, 2);
    });
  });

  it('publish without subscribers creates nothing and does not throw', async () => {
    await inRollback(async (tx) => {
      await producer.publish(tx, 'JOBS_TEST_NOBODY_LISTENS', { tenantOrgId: randomUUID(), eventId: randomUUID() });
    });
  });

  it('claimEffect claims a key once per tenant', async () => {
    const tenants = await prisma.$queryRawUnsafe<{ id: string }[]>('SELECT id::text FROM public.org_tenants_mst LIMIT 1');
    assert.ok(tenants.length, 'local DB needs at least one tenant');
    const claim = { tenantOrgId: tenants[0].id, effectKey: `jobs-test:${randomUUID()}`, queueName: QUEUE, jobId: randomUUID(), appliedBy: 'jobs-test' };
    await inRollback(async (tx) => {
      assert.equal(await claimEffect(tx, claim), true);
      assert.equal(await claimEffect(tx, { ...claim, jobId: randomUUID() }), false);
    });
  });
});
