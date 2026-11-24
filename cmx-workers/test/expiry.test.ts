/**
 * Expiry sweeps on local Supabase Postgres (migrations through 0823). Run: npm test --workspace=cmx-workers
 *
 * Proves STEP6_PLAN 6a / DESIGN §10.2 step 6 "each job has a run-twice test and a tenant-isolation test":
 *  - gift card and loyalty items (cmx-workers) and credit notes (pure database, fn_fin_credit_note_expire_one
 *    and the pg_cron run function): another tenant's id changes nothing; running twice writes one ledger
 *    row; an entity that is not due is skipped;
 *  - the registry turns a schedule into a pg-boss schedule and removes it when switched off;
 *  - HQ "Run now" on the gift card schedule → sweep → item → the card is EXPIRED, with a run history row.
 * Creates its own rows and deletes everything it created; restores the registry rows it switched on.
 */
import { LOCAL_DB, LOCAL_ENV } from './env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { prisma } from '@/lib/db/prisma';
import { jobs } from '@/lib/jobs/producer';
import {
  runGiftCardExpiryItem,
  runLoyaltyExpiryItem,
} from '@/lib/services/finance-expiry-jobs.service';
import { loadConfig } from '../src/config';
import { HANDLERS } from '../src/handlers/index';
import { startWorker, type RunningWorker } from '../src/worker';

const db = new pg.Pool({ connectionString: LOCAL_DB, max: 2 });
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const INSTANCE = 'cmx-workers-etest';
const GC_CODES = ['fin.gift_card_expiry.daily', 'fin.gift_card_expiry.sweep', 'fin.gift_card_expiry.item'];
const GC_QUEUES = ['fin.gift_card_expiry.sweep', 'fin.gift_card_expiry.item'];
const expireNote = async (tenant: string, id: string) => (await q<{ o: string }>(
  `SELECT public.fn_fin_credit_note_expire_one($1::uuid, $2::uuid, true) AS o`, [tenant, id]))[0].o;

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 90_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

let tenantA: string;
let tenantB: string;
let customerA: string;
let customerB: string;
const cards: string[] = [];
const notes: string[] = [];
let programB: string | undefined;
let accountB: string | undefined;

async function newCard(expiry: string): Promise<string> {
  const [{ id }] = await q<{ id: string }>(
    `INSERT INTO public.org_gift_cards_mst (tenant_org_id, gift_card_code, original_amount, current_balance, available_amount, currency_code, status, expiry_date)
     VALUES ($1, $2, 5, 5, 5, 'OMR', 'ACTIVE', now() + $3::interval) RETURNING id`, [tenantA, `ETEST-${randomUUID().slice(0, 8)}`, expiry]);
  cards.push(id);
  return id;
}
async function newNote(days: number): Promise<string> {
  const [{ id }] = await q<{ id: string }>(
    `INSERT INTO public.org_credit_notes_mst (tenant_org_id, customer_id, original_amount, remaining_balance, currency_code, reason, status, expires_at)
     VALUES ($1, $2, 3, 3, 'OMR', 'cmx-workers expiry test', 'ACTIVE', (now() AT TIME ZONE 'UTC')::date + $3::int) RETURNING id`, [tenantA, customerA, days]);
  notes.push(id);
  return id;
}

before(async () => {
  [{ id: tenantA }, { id: tenantB }] = await q<{ id: string }>(
    `SELECT id FROM public.org_tenants_mst WHERE is_active AND rec_status = 1 ORDER BY created_at LIMIT 2`);
  [{ id: customerA }] = await q<{ id: string }>(
    `INSERT INTO public.org_customers_mst (tenant_org_id, name) VALUES ($1, 'cmx-workers expiry test') RETURNING id`, [tenantA]);
  [{ id: customerB }] = await q<{ id: string }>(
    `INSERT INTO public.org_customers_mst (tenant_org_id, name) VALUES ($1, 'cmx-workers expiry test') RETURNING id`, [tenantB]);
});

after(async () => {
  await q(`DELETE FROM pgboss.job WHERE name LIKE 'fin.%expiry%' AND data->>'giftCardId' = ANY($1::text[])`, [cards]);
  await q(`DELETE FROM public.org_gift_card_txn_dtl WHERE tenant_org_id = $1 AND gift_card_id = ANY($2::uuid[])`, [tenantA, cards]);
  await q(`DELETE FROM public.org_gift_cards_mst WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenantA, cards]);
  await q(`DELETE FROM public.org_credit_note_txn_dtl WHERE tenant_org_id = $1 AND credit_note_id = ANY($2::uuid[])`, [tenantA, notes]);
  await q(`DELETE FROM public.org_credit_notes_mst WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenantA, notes]);
  if (accountB) {
    await q(`DELETE FROM public.org_loyalty_txn_allocs_dtl WHERE tenant_org_id = $1 AND account_id = $2`, [tenantB, accountB]);
    await q(`DELETE FROM public.org_loyalty_txn_dtl WHERE tenant_org_id = $1 AND account_id = $2`, [tenantB, accountB]);
    await q(`DELETE FROM public.org_loyalty_accounts_mst WHERE tenant_org_id = $1 AND id = $2`, [tenantB, accountB]);
  }
  if (programB) await q(`DELETE FROM public.org_loyalty_programs_cf WHERE tenant_org_id = $1 AND id = $2`, [tenantB, programB]);
  await q(`DELETE FROM public.org_customers_mst WHERE id = ANY($1::uuid[])`, [[customerA, customerB]]);
  await jobs.stop();
  await prisma.$disconnect();
  await db.end();
});

describe('expiry items: tenant isolation and run twice', () => {
  it('gift card: another tenant changes nothing; twice writes one EXPIRE row; not due is skipped', async () => {
    const due = await newCard('-1 day');
    assert.equal((await runGiftCardExpiryItem(tenantB, due)).outcome, 'SKIPPED_ORPHAN');
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_gift_cards_mst WHERE id = $1`, [due]))[0].status, 'ACTIVE');

    assert.equal((await runGiftCardExpiryItem(tenantA, due)).outcome, 'EXPIRED');
    assert.equal((await runGiftCardExpiryItem(tenantA, due)).outcome, 'EXPIRED');
    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int n FROM public.org_gift_card_txn_dtl WHERE tenant_org_id = $1 AND gift_card_id = $2 AND transaction_type = 'EXPIRE'`, [tenantA, due]);
    assert.equal(n, 1);
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_gift_cards_mst WHERE id = $1`, [due]))[0].status, 'EXPIRED');

    const later = await newCard('+30 days');
    assert.equal((await runGiftCardExpiryItem(tenantA, later)).outcome, 'SKIPPED_ORPHAN');
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_gift_cards_mst WHERE id = $1`, [later]))[0].status, 'ACTIVE');
  });

  it('credit note (database): another tenant changes nothing; twice writes one EXPIRY row; not due is skipped', async () => {
    const due = await newNote(-2);
    assert.equal(await expireNote(tenantB, due), 'NOT_FOUND');
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_credit_notes_mst WHERE id = $1`, [due]))[0].status, 'ACTIVE');

    assert.equal(await expireNote(tenantA, due), 'EXPIRED');
    assert.equal(await expireNote(tenantA, due), 'ALREADY_EXPIRED');
    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int n FROM public.org_credit_note_txn_dtl WHERE tenant_org_id = $1 AND credit_note_id = $2`, [tenantA, due]);
    assert.equal(n, 1);
    const [note] = await q<{ status: string; remaining_balance: string }>(`SELECT status, remaining_balance FROM public.org_credit_notes_mst WHERE id = $1`, [due]);
    assert.equal(note.status, 'EXPIRED');
    assert.equal(Number(note.remaining_balance), 0);

    const later = await newNote(10);
    assert.equal(await expireNote(tenantA, later), 'NOT_DUE');
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_credit_notes_mst WHERE id = $1`, [later]))[0].status, 'ACTIVE');
  });

  it('credit note (database): the daily run expires a due note and leaves a future one', async () => {
    const due = await newNote(-1);
    const later = await newNote(5);
    const [{ r }] = await q<{ r: { expired: number; failed: number } }>(`SELECT public.fn_fin_credit_note_expiry_run() AS r`);
    assert.ok(r.expired >= 1);
    assert.equal(r.failed, 0);
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_credit_notes_mst WHERE id = $1`, [due]))[0].status, 'EXPIRED');
    assert.equal((await q<{ status: string }>(`SELECT status FROM public.org_credit_notes_mst WHERE id = $1`, [later]))[0].status, 'ACTIVE');
  });

  it('loyalty: another tenant changes nothing; twice expires the old lot once', async () => {
    [{ id: programB }] = await q<{ id: string }>(
      `INSERT INTO public.org_loyalty_programs_cf (tenant_org_id, program_name, points_expiry_days) VALUES ($1, 'cmx-workers expiry test', 30) RETURNING id`, [tenantB]);
    [{ id: accountB }] = await q<{ id: string }>(
      `INSERT INTO public.org_loyalty_accounts_mst (tenant_org_id, customer_id, program_id, points_balance) VALUES ($1, $2, $3, 10) RETURNING id`, [tenantB, customerB, programB]);
    await q(`INSERT INTO public.org_loyalty_txn_dtl (tenant_org_id, account_id, customer_id, txn_type, points, points_before, points_after, remaining_points, created_at)
             VALUES ($1, $2, $3, 'EARN', 10, 0, 10, 10, now() - interval '40 days')`, [tenantB, accountB, customerB]);
    const lot = async () => (await q<{ r: number }>(
      `SELECT remaining_points r FROM public.org_loyalty_txn_dtl WHERE tenant_org_id = $1 AND account_id = $2 AND txn_type = 'EARN'`, [tenantB, accountB]))[0].r;
    const rows = async () => (await q<{ n: number }>(
      `SELECT count(*)::int n FROM public.org_loyalty_txn_dtl WHERE tenant_org_id = $1 AND account_id = $2`, [tenantB, accountB]))[0].n;

    assert.equal((await runLoyaltyExpiryItem(tenantA, accountB!)).outcome, 'SKIPPED_ORPHAN');
    assert.equal(await lot(), 10);

    assert.equal((await runLoyaltyExpiryItem(tenantB, accountB!)).outcome, 'EXPIRED');
    assert.equal(await lot(), 0);
    const afterFirst = await rows();
    assert.equal((await runLoyaltyExpiryItem(tenantB, accountB!)).outcome, 'EXPIRED');
    assert.equal(await rows(), afterFirst);
    assert.equal((await q<{ b: number }>(`SELECT points_balance b FROM public.org_loyalty_accounts_mst WHERE id = $1`, [accountB]))[0].b, 0);
  });
});

describe('schedule and Run now through the worker', () => {
  let worker: RunningWorker;
  let original: { job_code: string; desired_enabled: boolean }[];
  let polling: { queue_name: string; polling_s: string }[];

  before(async () => {
    original = await q(`SELECT job_code, desired_enabled FROM public.sys_ops_job_cf WHERE job_code = ANY($1::text[])`, [GC_CODES]);
    polling = await q(`SELECT queue_name, polling_s FROM public.sys_ops_job_queue_cf WHERE queue_name = ANY($1::text[])`, [GC_QUEUES]);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = ANY($1::text[])`, [GC_CODES]);
    await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = 1 WHERE queue_name = ANY($1::text[])`, [GC_QUEUES]); // 300 s in production
    const config = loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE });
    worker = await startWorker(config, HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    for (const r of original) await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2 WHERE job_code = $1`, [r.job_code, r.desired_enabled]);
    for (const r of polling) await q(`UPDATE public.sys_ops_job_queue_cf SET polling_s = $2 WHERE queue_name = $1`, [r.queue_name, r.polling_s]);
    await q(`DELETE FROM pgboss.schedule WHERE key = ANY($1::text[])`, [GC_CODES]);
    await q(`DELETE FROM public.sys_ops_job_run_dtl WHERE job_code = 'fin.gift_card_expiry.daily' AND actor = 'expiry-test'`);
    await q(`DELETE FROM public.sys_ops_job_req_tr WHERE job_code = 'fin.gift_card_expiry.daily' AND requested_by = 'expiry-test'`);
    await q(`DELETE FROM pgboss.job WHERE name = 'fin.gift_card_expiry.sweep' AND created_on > now() - interval '1 hour'`);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_schedule = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
  });

  it('switching the schedule on creates the pg-boss schedule in UTC, missed runs sent once; off removes it', async () => {
    const sched = await worker.boss.getSchedule('fin.gift_card_expiry.sweep', 'fin.gift_card_expiry.daily');
    assert.equal(sched?.cron, '0 2 * * *');
    assert.equal(sched?.timezone, 'UTC');
    assert.equal(sched?.options?.missed, 'once');
    const [row] = await q<{ applied_enabled: boolean; applied_schedule: string }>(
      `SELECT applied_enabled, applied_schedule FROM public.sys_ops_job_cf WHERE job_code = 'fin.gift_card_expiry.daily'`);
    assert.deepEqual(row, { applied_enabled: true, applied_schedule: '0 2 * * *' });

    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = false WHERE job_code = 'fin.gift_card_expiry.daily'`);
    await worker.syncNow();
    assert.equal(await worker.boss.getSchedule('fin.gift_card_expiry.sweep', 'fin.gift_card_expiry.daily'), null);
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = 'fin.gift_card_expiry.daily'`);
    await worker.syncNow();
  });

  it('Run now → sweep → item: the due card is EXPIRED and the run is in the history', async () => {
    const card = await newCard('-2 days');
    const [{ r }] = await q<{ r: { ok: boolean } }>(`SELECT public.fn_ops_job_run_now('fin.gift_card_expiry.daily', 'expiry-test') AS r`);
    assert.equal(r.ok, true);
    await waitFor('card EXPIRED', async () =>
      (await q<{ status: string }>(`SELECT status FROM public.org_gift_cards_mst WHERE id = $1`, [card]))[0].status === 'EXPIRED');
    const runs = await q<{ status: string; message: string }>(
      `SELECT status, message FROM public.sys_ops_job_run_dtl WHERE job_code = 'fin.gift_card_expiry.daily' AND actor = 'expiry-test'`);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'SUCCESS');
    const [item] = await q<{ state: string; output: { outcome: string } }>(
      `SELECT state, output FROM pgboss.job WHERE name = 'fin.gift_card_expiry.item' AND id = $1`, [card]);
    assert.equal(item.state, 'completed');
    assert.equal(item.output.outcome, 'EXPIRED');
  });
});
