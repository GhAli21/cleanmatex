/**
 * ntf.campaign_start / ntf.campaign_chunk end to end on local Supabase (migrations through 0810,
 * local API running). Run: npm test --workspace=cmx-workers
 *
 * Proves STEP5_PLAN.md tenant item 4:
 *  - an approved campaign gets its targets, runs, and completes; a consenting user's target is QUEUED
 *    with an outbox row (address resolved) and one ntf.deliver job at priority -10 (ids only); a user
 *    without consent is SKIPPED; the campaign counters match;
 *  - running the start and the chunk again adds no row, job or count;
 *  - "Start now" (status RUNNING with no targets yet) creates the targets and sends;
 *  - a campaign with no user ids fails with an audit row;
 *  - customers (0818): a named customer who agreed gets an outbox row to their own email and no user,
 *    one who did not is SKIPPED; "all who agreed" targets only agreeing customers;
 *  - WhatsApp to customers (0819, STEP5_PLAN 4c): the outbox row has event campaign.send, the customer's
 *    E.164 phone and the campaign's template_vars as metadata (HQ fills the template slots from them).
 * Uses the demo tenant; switches both queues on for the run and restores them.
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
const INSTANCE = 'cmx-workers-ctest';
const QUEUES = ['ntf.campaign_start', 'ntf.campaign_chunk'];
const WA_TEMPLATE = 'jobs_test.wa_marketing';

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('campaigns on local Supabase', () => {
  let worker: RunningWorker;
  let tenant: string;
  let consenting: string;
  let declining: string;
  const campaignIds: string[] = [];
  const prefIds: string[] = [];
  const consentIds: string[] = [];
  let agreedCustomer: { id: string; email: string };
  let otherCustomer: string;
  let wasEnabled: Record<string, boolean>;

  async function createCampaign(status: string, userIds: string[]): Promise<string> {
    const [{ id }] = await q<{ id: string }>(
      `INSERT INTO public.org_ntf_campaigns_mst (tenant_org_id, name, description, status, channel_code, target_segment, created_by)
       VALUES ($1, 'Jobs test campaign', 'Hello from the jobs test', $2, 'EMAIL', $3, 'cmx-workers-test') RETURNING id::text AS id`,
      [tenant, status, JSON.stringify({ user_ids: userIds })]);
    campaignIds.push(id);
    return id;
  }

  async function createCustomerCampaign(channel: string, segment: object, template?: { code: string; vars: object }): Promise<string> {
    const [{ id }] = await q<{ id: string }>(
      `INSERT INTO public.org_ntf_campaigns_mst (tenant_org_id, name, description, status, audience_code, channel_code, target_segment, template_code, template_vars, created_by)
       VALUES ($1, 'Jobs test customer campaign', 'Hello customers', 'APPROVED', 'CUSTOMERS', $2, $3, $4, $5, 'cmx-workers-test') RETURNING id::text AS id`,
      [tenant, channel, JSON.stringify(segment), template?.code ?? null, JSON.stringify(template?.vars ?? {})]);
    campaignIds.push(id);
    return id;
  }

  async function startAndWait(campaignId: string, until: string[]): Promise<{ status: string; total_targets: number; queued_count: number; skip_count: number }> {
    await worker.boss.send('ntf.campaign_start', { tenantOrgId: tenant, campaignId });
    return waitFor(`campaign ${until.join('/')}`, async () => (await q<{ status: string; total_targets: number; queued_count: number; skip_count: number }>(
      `SELECT status, total_targets, queued_count, skip_count FROM public.org_ntf_campaigns_mst WHERE id = $1 AND tenant_org_id = $2 AND status = ANY($3)`,
      [campaignId, tenant, until]))[0]);
  }

  const targets = (campaignId: string) => q<{ recipient_user_id: string; status: string; skip_reason: string | null; outbox_id: string | null }>(
    `SELECT recipient_user_id::text, status, skip_reason, outbox_id::text FROM public.org_ntf_camp_targets_dtl WHERE campaign_id = $1 AND tenant_org_id = $2`,
    [campaignId, tenant]);

  before(async () => {
    // The demo tenant: EMAIL on, two users with an email address.
    const users = await q<{ tenant_org_id: string; user_id: string }>(
      `SELECT u.tenant_org_id::text, u.user_id::text
         FROM public.org_users_mst u
         JOIN auth.users a ON a.id = u.user_id AND a.email IS NOT NULL
         JOIN public.org_ntf_settings_cf s ON s.tenant_org_id = u.tenant_org_id AND s.channel_code = 'EMAIL' AND s.is_enabled
        WHERE u.tenant_org_id = (SELECT min(s2.tenant_org_id::text)::uuid FROM public.org_ntf_settings_cf s2 WHERE s2.channel_code = 'EMAIL' AND s2.is_enabled)
        ORDER BY u.user_id LIMIT 2`);
    assert.equal(users.length, 2, 'the demo tenant needs two users with an email address');
    tenant = users[0].tenant_org_id;
    [consenting, declining] = users.map((u) => u.user_id);
    // Newest channel-level preference wins (collapseUserPrefRows).
    for (const [user, consent] of [[consenting, true], [declining, false]] as const) {
      const [{ id }] = await q<{ id: string }>(
        `INSERT INTO public.org_ntf_user_prefs_dtl (tenant_org_id, user_id, channel_code, event_code, is_enabled, marketing_consent, created_at, updated_at)
         VALUES ($1, $2, 'EMAIL', NULL, true, $3, now() + interval '1 day', now() + interval '1 day') RETURNING id::text AS id`, [tenant, user, consent]);
      prefIds.push(id);
    }
    // Two active customers with an email: one agreed to email marketing, the other has no consent row.
    const customers = await q<{ id: string; email: string }>(
      `SELECT id::text, trim(email) AS email FROM public.org_customers_mst
        WHERE tenant_org_id = $1 AND is_active AND coalesce(rec_status, 1) = 1 AND nullif(trim(email), '') IS NOT NULL
        ORDER BY id LIMIT 2`, [tenant]);
    assert.equal(customers.length, 2, 'the demo tenant needs two customers with an email address');
    [agreedCustomer, { id: otherCustomer }] = customers;
    await q(`DELETE FROM public.org_ntf_cust_consent_dtl WHERE tenant_org_id = $1 AND customer_id = ANY($2::uuid[]) AND created_by = 'cmx-workers-test'`,
      [tenant, customers.map((c) => c.id)]);
    const [{ id: consentId }] = await q<{ id: string }>(
      `INSERT INTO public.org_ntf_cust_consent_dtl (tenant_org_id, customer_id, channel_code, marketing_consent, consent_given_at, consent_source, created_by)
       VALUES ($1, $2, 'EMAIL', true, now(), 'STAFF', 'cmx-workers-test') RETURNING id::text AS id`, [tenant, agreedCustomer.id]);
    consentIds.push(consentId);
    const rows = await q<{ job_code: string; desired_enabled: boolean }>(`SELECT job_code, desired_enabled FROM public.sys_ops_job_cf WHERE job_code = ANY($1)`, [QUEUES]);
    wasEnabled = Object.fromEntries(rows.map((r) => [r.job_code, r.desired_enabled]));
    await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = true WHERE job_code = ANY($1)`, [QUEUES]);
    worker = await startWorker(loadConfig({ ...LOCAL_ENV, REGISTRY_POLL_SECONDS: '1', WORKER_INSTANCE_NAME: INSTANCE }), HANDLERS, () => {});
  });

  after(async () => {
    await worker?.stop();
    for (const [code, enabled] of Object.entries(wasEnabled ?? {})) {
      await q(`UPDATE public.sys_ops_job_cf SET desired_enabled = $2 WHERE job_code = $1`, [code, enabled]);
    }
    const outbox = await q<{ id: string }>(
      `SELECT id::text AS id FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND source_entity_type = 'campaign' AND source_entity_id = ANY($2::text[])`, [tenant, campaignIds]);
    await q(`DELETE FROM pgboss.job WHERE name = 'ntf.deliver' AND id = ANY($1::uuid[])`, [outbox.map((o) => o.id)]);
    await q(`DELETE FROM pgboss.job WHERE name = ANY($1) AND data->>'campaignId' = ANY($2::text[])`, [[...QUEUES, 'dead_letter'], campaignIds]);
    await q(`DELETE FROM public.org_ntf_camp_targets_dtl WHERE tenant_org_id = $1 AND campaign_id = ANY($2::uuid[])`, [tenant, campaignIds]);
    await q(`DELETE FROM public.org_ntf_outbox_dtl WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, outbox.map((o) => o.id)]);
    await q(`DELETE FROM public.org_ntf_audit_dtl WHERE tenant_org_id = $1 AND entity_type = 'CAMPAIGN' AND entity_id = ANY($2::text[])`, [tenant, campaignIds]);
    await q(`DELETE FROM public.org_ntf_campaigns_mst WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, campaignIds]);
    await q(`DELETE FROM public.org_ntf_user_prefs_dtl WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, prefIds]);
    await q(`DELETE FROM public.org_ntf_cust_consent_dtl WHERE tenant_org_id = $1 AND id = ANY($2::uuid[])`, [tenant, consentIds]);
    await q(`DELETE FROM public.sys_ntf_templates_mst WHERE template_code = $1`, [WA_TEMPLATE]);
    await q(`DELETE FROM pgboss.instance WHERE name = $1`, [INSTANCE]);
    await q(`UPDATE public.sys_ops_job_cf SET applied_enabled = NULL, applied_at = NULL, applied_by = NULL WHERE applied_by = $1`, [INSTANCE]);
    await jobs.stop();
    await prisma.$disconnect();
    await db.end();
  });

  it('an approved campaign → targets, a low-priority ntf.deliver for consent, SKIPPED without, COMPLETED', async () => {
    const id = await createCampaign('APPROVED', [consenting, declining]);
    const campaign = await startAndWait(id, ['COMPLETED', 'FAILED']);
    assert.equal(campaign.status, 'COMPLETED');
    assert.equal(campaign.total_targets, 2);
    assert.equal(campaign.queued_count, 1);
    assert.equal(campaign.skip_count, 1);

    const rows = await targets(id);
    const queued = rows.find((t) => t.recipient_user_id === consenting);
    const skipped = rows.find((t) => t.recipient_user_id === declining);
    assert.equal(queued?.status, 'QUEUED');
    assert.equal(skipped?.status, 'SKIPPED');
    assert.equal(skipped?.skip_reason, 'NO_MARKETING_CONSENT');

    const [outbox] = await q<{ recipient_address: string | null; status: string }>(
      `SELECT recipient_address, status FROM public.org_ntf_outbox_dtl WHERE id = $1 AND tenant_org_id = $2`, [queued?.outbox_id, tenant]);
    assert.ok(outbox.recipient_address, 'the email address is resolved when the row is written');
    const [deliver] = await q<{ data: Record<string, string>; priority: number }>(
      `SELECT data, priority FROM pgboss.job WHERE name = 'ntf.deliver' AND id = $1`, [queued?.outbox_id]);
    assert.deepEqual(deliver.data, { tenantOrgId: tenant, outboxId: queued?.outbox_id }, 'the job carries ids only');
    assert.equal(deliver.priority, -10);
  });

  it('running the start and the chunk again adds no row, job or count', async () => {
    const id = campaignIds[0];
    const snapshot = async () => (await q(
      `SELECT (SELECT count(*)::int FROM public.org_ntf_camp_targets_dtl WHERE campaign_id = $1 AND tenant_org_id = $2) AS targets,
              (SELECT count(*)::int FROM public.org_ntf_outbox_dtl WHERE source_entity_id = $1::text AND tenant_org_id = $2) AS outbox,
              (SELECT count(*)::int FROM pgboss.job j JOIN public.org_ntf_outbox_dtl o ON o.id = j.id AND j.name = 'ntf.deliver'
                WHERE o.source_entity_id = $1::text AND o.tenant_org_id = $2) AS deliver,
              (SELECT row_to_json(c) FROM (SELECT status, total_targets, queued_count, skip_count, sent_count FROM public.org_ntf_campaigns_mst
                WHERE id = $1 AND tenant_org_id = $2) c) AS campaign`, [id, tenant]))[0];
    const before_ = await snapshot();
    const startId = await worker.boss.send('ntf.campaign_start', { tenantOrgId: tenant, campaignId: id });
    const chunkId = await worker.boss.send('ntf.campaign_chunk', { tenantOrgId: tenant, campaignId: id, chunk: 0 });
    for (const [name, jobId] of [['ntf.campaign_start', startId], ['ntf.campaign_chunk', chunkId]]) {
      await waitFor(`${name} re-run completed`, async () =>
        (await q(`SELECT 1 FROM pgboss.job WHERE name = $1 AND id = $2 AND state = 'completed'`, [name, jobId]))[0]);
    }
    assert.deepEqual(await snapshot(), before_);
  });

  it('"Start now" (RUNNING before any target exists) creates the targets and sends', async () => {
    const id = await createCampaign('RUNNING', [consenting]);
    const campaign = await startAndWait(id, ['COMPLETED', 'FAILED']);
    assert.equal(campaign.status, 'COMPLETED');
    assert.equal(campaign.total_targets, 1);
    assert.equal((await targets(id))[0]?.status, 'QUEUED');
  });

  it('a campaign with no user ids fails, with an audit row', async () => {
    const id = await createCampaign('APPROVED', []);
    assert.equal((await startAndWait(id, ['FAILED', 'COMPLETED'])).status, 'FAILED');
    const audit = await q(`SELECT 1 FROM public.org_ntf_audit_dtl WHERE tenant_org_id = $1 AND entity_id = $2 AND action_code = 'ACTIVATION_FAILED'`, [tenant, id]);
    assert.equal(audit.length, 1);
  });

  it('customers by id: the one who agreed gets an outbox row to their email and no user; the other is SKIPPED', async () => {
    const id = await createCustomerCampaign('EMAIL', { customer_ids: [agreedCustomer.id, otherCustomer] });
    const campaign = await startAndWait(id, ['COMPLETED', 'FAILED']);
    assert.equal(campaign.status, 'COMPLETED');
    assert.equal(campaign.total_targets, 2);
    assert.equal(campaign.queued_count, 1);
    assert.equal(campaign.skip_count, 1);

    const rows = await q<{ recipient_customer_id: string; recipient_user_id: string | null; status: string; skip_reason: string | null; outbox_id: string | null }>(
      `SELECT recipient_customer_id::text, recipient_user_id::text, status, skip_reason, outbox_id::text
         FROM public.org_ntf_camp_targets_dtl WHERE campaign_id = $1 AND tenant_org_id = $2`, [id, tenant]);
    const queued = rows.find((t) => t.recipient_customer_id === agreedCustomer.id);
    const skipped = rows.find((t) => t.recipient_customer_id === otherCustomer);
    assert.equal(queued?.status, 'QUEUED');
    assert.equal(queued?.recipient_user_id, null);
    assert.equal(skipped?.status, 'SKIPPED');
    assert.equal(skipped?.skip_reason, 'NO_MARKETING_CONSENT');

    const [outbox] = await q<{ recipient_address: string | null; recipient_user_id: string | null; source_entity_type: string }>(
      `SELECT recipient_address, recipient_user_id::text, source_entity_type FROM public.org_ntf_outbox_dtl WHERE id = $1 AND tenant_org_id = $2`,
      [queued?.outbox_id, tenant]);
    assert.equal(outbox.recipient_address, agreedCustomer.email);
    assert.equal(outbox.recipient_user_id, null);
    assert.equal(outbox.source_entity_type, 'campaign');
    const [deliver] = await q<{ priority: number }>(`SELECT priority FROM pgboss.job WHERE name = 'ntf.deliver' AND id = $1`, [queued?.outbox_id]);
    assert.equal(deliver.priority, -10);
  });

  it('"all customers who agreed" targets only agreeing customers', async () => {
    const id = await createCustomerCampaign('EMAIL', { all_consented: true });
    assert.equal((await startAndWait(id, ['COMPLETED', 'FAILED'])).status, 'COMPLETED');
    const rows = await q<{ recipient_customer_id: string }>(
      `SELECT recipient_customer_id::text FROM public.org_ntf_camp_targets_dtl WHERE campaign_id = $1 AND tenant_org_id = $2`, [id, tenant]);
    assert.ok(rows.some((t) => t.recipient_customer_id === agreedCustomer.id));
    assert.ok(!rows.some((t) => t.recipient_customer_id === otherCustomer));
  });

  it('WhatsApp to a customer who agreed: outbox row with campaign.send, E.164 phone and the template values', async () => {
    const [customer] = await q<{ id: string; phone: string }>(
      `SELECT id::text, phone FROM public.org_customers_mst
        WHERE tenant_org_id = $1 AND is_active AND coalesce(rec_status, 1) = 1 AND phone ~ '^\\+[1-9][0-9]{7,14}$' ORDER BY id LIMIT 1`, [tenant]);
    assert.ok(customer, 'the demo tenant needs a customer with an E.164 phone');
    await q(`DELETE FROM public.org_ntf_cust_consent_dtl WHERE tenant_org_id = $1 AND customer_id = $2 AND channel_code = 'WHATSAPP' AND created_by = 'cmx-workers-test'`, [tenant, customer.id]);
    const [{ id: consentId }] = await q<{ id: string }>(
      `INSERT INTO public.org_ntf_cust_consent_dtl (tenant_org_id, customer_id, channel_code, marketing_consent, consent_given_at, consent_source, created_by)
       VALUES ($1, $2, 'WHATSAPP', true, now(), 'STAFF', 'cmx-workers-test') RETURNING id::text AS id`, [tenant, customer.id]);
    consentIds.push(consentId);
    // A campaign must name an existing template (0819); this one has no version, so the display text falls back to the campaign name.
    await q(`INSERT INTO public.sys_ntf_templates_mst (template_code, event_code, name) VALUES ($1, 'campaign.send', 'Jobs test WhatsApp marketing') ON CONFLICT DO NOTHING`, [WA_TEMPLATE]);

    const id = await createCustomerCampaign('WHATSAPP', { customer_ids: [customer.id] }, { code: WA_TEMPLATE, vars: { offer: '20% off' } });
    const campaign = await startAndWait(id, ['COMPLETED', 'FAILED']);
    assert.equal(campaign.status, 'COMPLETED');
    assert.equal(campaign.queued_count, 1);

    const [outbox] = await q<{ recipient_address: string; event_code: string; channel_code: string; metadata: Record<string, unknown> }>(
      `SELECT o.recipient_address, o.event_code, o.channel_code, o.metadata FROM public.org_ntf_outbox_dtl o
         JOIN public.org_ntf_camp_targets_dtl t ON t.outbox_id = o.id AND t.tenant_org_id = o.tenant_org_id
        WHERE t.campaign_id = $1 AND t.tenant_org_id = $2`, [id, tenant]);
    assert.equal(outbox.channel_code, 'WHATSAPP');
    assert.equal(outbox.event_code, 'campaign.send');
    assert.equal(outbox.recipient_address, customer.phone);
    assert.equal((outbox.metadata.variables as Record<string, string>).offer, '20% off');
  });
});
