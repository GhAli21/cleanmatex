import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { jobs } from '@/lib/jobs/producer';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { renderBuiltContent } from '@lib/notifications/canonical-builder';
import { decideDelivery } from '@lib/notifications/delivery-policy';
import { resolveRecipientAddress } from '@lib/notifications/recipient-resolver';
import { notificationSettingsService, type ChannelConfig } from '@lib/notifications/settings-service';
import type { RenderedContent } from '@lib/notifications/template-renderer';
import { NOTIFICATION_CHANNEL } from '@lib/notifications/types';
import { collapseUserPrefRows } from '@lib/notifications/user-prefs';
import { normalizePhone } from '@lib/services/customers.service';
import { CAMPAIGN_AUDIENCE, CAMPAIGN_CUSTOMER_CHANNELS_LIVE } from '@lib/constants/notification-campaigns';

/**
 * Campaigns on pg-boss (docs/features/Background_Jobs/STEP5_PLAN.md, tenant item 4).
 *
 *   status route → queueCampaignStartTx: an `ntf.campaign_start` job in the same transaction as the
 *   status change (approve, schedule, start now, resume).
 *   cmx-workers → startCampaign: creates the targets (staff users, or customers for audience_code
 *   CUSTOMERS, migration 0818), sets the campaign RUNNING and queues one
 *   `ntf.campaign_chunk` per page of 50 targets that still has PENDING ones.
 *   cmx-workers → runCampaignChunk: per PENDING target, one transaction locks the target, writes its
 *   in-app row or outbox row, queues `ntf.deliver` (low priority) and counts it on the campaign.
 *
 * Every step can run twice: targets and rows are deduplicated by their unique keys, a target is
 * processed only while PENDING under a row lock, and a deliver job id is its outbox id. HQ API's
 * finalize functions move QUEUED targets to SENT / FAILED / SKIPPED and count them (0769).
 */

type Tx = Prisma.TransactionClient;

export const CAMPAIGN_CHUNK_SIZE = 50;
/** pg-boss priority of campaign sends: below every event notification, so receipts and OTP go first. */
export const CAMPAIGN_DELIVER_PRIORITY = -10;
/** A chunk whose channel the tenant switched off waits this long, then checks again. */
const CHANNEL_OFF_RECHECK_MS = 15 * 60_000;
const CAMPAIGN_EVENT_CODE = 'campaign.send';
const STARTABLE = new Set(['APPROVED', 'SCHEDULED', 'RUNNING']);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Queues the start of a campaign inside the caller's transaction; `startAfter` in the future delays it. */
export async function queueCampaignStartTx(tx: Tx, tenantOrgId: string, campaignId: string, startAfter?: Date | null): Promise<void> {
  await jobs.enqueue(tx, 'ntf.campaign_start', { tenantOrgId, campaignId },
    startAfter && startAfter.getTime() > Date.now() ? { startAfter } : {});
}

async function auditCampaign(tx: Tx, tenantOrgId: string, campaignId: string, action: string, oldValue: object, newValue: object): Promise<void> {
  await tx.org_ntf_audit_dtl.create({
    data: {
      tenant_org_id: tenantOrgId, entity_type: 'CAMPAIGN', entity_id: campaignId, action_code: action,
      old_value: oldValue as Prisma.InputJsonValue, new_value: newValue as Prisma.InputJsonValue,
      performed_by: 'system', performed_at: new Date(), rec_status: 1, is_active: true,
    },
  });
}

/** Completes a RUNNING campaign that has no PENDING target left. Only one caller wins the guarded update. */
async function completeIfDoneTx(tx: Tx, tenantOrgId: string, campaignId: string): Promise<boolean> {
  const pending = await tx.org_ntf_camp_targets_dtl.count({
    where: { tenant_org_id: tenantOrgId, campaign_id: campaignId, status: 'PENDING' },
  });
  if (pending > 0) return false;
  const now = new Date();
  const { count } = await tx.org_ntf_campaigns_mst.updateMany({
    where: { id: campaignId, tenant_org_id: tenantOrgId, status: 'RUNNING' },
    data: { status: 'COMPLETED', completed_at: now, updated_at: now, updated_info: 'ntf.campaign_chunk' },
  });
  if (count === 1) await auditCampaign(tx, tenantOrgId, campaignId, 'STATUS_CHANGED', { status: 'RUNNING' }, { status: 'COMPLETED' });
  return count === 1;
}

export interface CampaignStartOutcome {
  outcome: 'STARTED' | 'NOT_DUE' | 'NOT_STARTABLE' | 'NO_TARGETS' | 'UNSUPPORTED' | 'COMPLETED' | 'SKIPPED_ORPHAN';
  chunks: number;
}

/** Distinct GUID strings from an untrusted target_segment list; anything else is dropped. */
function guidList(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((u): u is string => typeof u === 'string' && GUID.test(u)))] : [];
}

/**
 * One PENDING target per active customer of this tenant that the campaign names, or, with
 * `allConsented`, per customer who agreed to marketing on the campaign's channel. Ids of another
 * tenant's customers, or of inactive ones, match nothing and are dropped.
 */
async function createCustomerTargetsTx(tx: Tx, tenantOrgId: string, campaignId: string, channel: string, customerIds: string[], allConsented: boolean): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO public.org_ntf_camp_targets_dtl
           (tenant_org_id, campaign_id, recipient_customer_id, status, rec_status, is_active, created_by, created_info)
    SELECT c.tenant_org_id, ${campaignId}::uuid, c.id, 'PENDING', 1, true, 'system', 'ntf.campaign_start'
      FROM public.org_customers_mst c
     WHERE c.tenant_org_id = ${tenantOrgId}::uuid AND c.is_active AND coalesce(c.rec_status, 1) = 1
       AND (c.id = ANY(${customerIds}::uuid[])
            OR (${allConsented} AND EXISTS (
                  SELECT 1 FROM public.org_ntf_cust_consent_dtl k
                   WHERE k.tenant_org_id = ${tenantOrgId}::uuid AND k.customer_id = c.id AND k.channel_code = ${channel}
                     AND k.marketing_consent AND k.is_active AND k.rec_status = 1)))
    ON CONFLICT (campaign_id, recipient_customer_id) DO NOTHING`;
}

/** The `ntf.campaign_start` job. */
export async function startCampaign(tenantOrgId: string, campaignId: string): Promise<CampaignStartOutcome> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction(async (tx) => {
    // The row lock makes a second start, or a status change, wait for this one.
    const [campaign] = await tx.$queryRaw<{ status: string; scheduled_at: Date | null; target_segment: unknown; audience_code: string; channel_code: string }[]>`
      SELECT status, scheduled_at, target_segment, audience_code, channel_code
        FROM public.org_ntf_campaigns_mst
       WHERE id = ${campaignId}::uuid AND tenant_org_id = ${tenantOrgId}::uuid AND is_active
         FOR UPDATE`;
    if (!campaign) return { outcome: 'SKIPPED_ORPHAN', chunks: 0 };
    if (!STARTABLE.has(campaign.status)) return { outcome: 'NOT_STARTABLE', chunks: 0 };
    if (campaign.status !== 'RUNNING' && campaign.scheduled_at && campaign.scheduled_at.getTime() > Date.now()) {
      await queueCampaignStartTx(tx, tenantOrgId, campaignId, campaign.scheduled_at);
      return { outcome: 'NOT_DUE', chunks: 0 };
    }

    const isCustomers = campaign.audience_code === CAMPAIGN_AUDIENCE.CUSTOMERS;
    const failStart = async (outcome: 'NO_TARGETS' | 'UNSUPPORTED', reason: string): Promise<CampaignStartOutcome> => {
      await tx.org_ntf_campaigns_mst.updateMany({
        where: { id: campaignId, tenant_org_id: tenantOrgId },
        data: { status: 'FAILED', updated_at: new Date(), updated_info: `ntf.campaign_start: ${reason}` },
      });
      await auditCampaign(tx, tenantOrgId, campaignId, 'ACTIVATION_FAILED', { status: campaign.status }, { status: 'FAILED', reason });
      return { outcome, chunks: 0 };
    };
    if (isCustomers && !(CAMPAIGN_CUSTOMER_CHANNELS_LIVE as readonly string[]).includes(campaign.channel_code)) {
      // The create route refuses this too; a row written another way still must not send free text on WhatsApp.
      return failStart('UNSUPPORTED', `${campaign.channel_code} campaigns to customers are not available yet`);
    }

    // The audience is fixed by the first start: a resume never adds customers who agreed later.
    let total = await tx.org_ntf_camp_targets_dtl.count({ where: { tenant_org_id: tenantOrgId, campaign_id: campaignId } });
    if (total === 0) {
      const segment = (campaign.target_segment ?? {}) as { user_ids?: unknown; customer_ids?: unknown; all_consented?: unknown };
      if (isCustomers) {
        await createCustomerTargetsTx(tx, tenantOrgId, campaignId, campaign.channel_code, guidList(segment.customer_ids), segment.all_consented === true);
      } else {
        const userIds = guidList(segment.user_ids);
        if (userIds.length > 0) {
          await tx.org_ntf_camp_targets_dtl.createMany({
            data: userIds.map((uid) => ({
              tenant_org_id: tenantOrgId, campaign_id: campaignId, recipient_user_id: uid, status: 'PENDING',
              rec_status: 1, is_active: true, created_by: 'system', created_info: 'ntf.campaign_start',
            })),
            skipDuplicates: true, // UNIQUE (campaign_id, recipient_user_id)
          });
        }
      }
      total = await tx.org_ntf_camp_targets_dtl.count({ where: { tenant_org_id: tenantOrgId, campaign_id: campaignId } });
    }

    if (total === 0) {
      return failStart('NO_TARGETS', isCustomers ? 'No active customers in target_segment' : 'No user_ids in target_segment');
    }

    await tx.$executeRaw`
      UPDATE public.org_ntf_campaigns_mst
         SET status = 'RUNNING', started_at = coalesce(started_at, now() AT TIME ZONE 'UTC'), total_targets = ${total},
             updated_at = now() AT TIME ZONE 'UTC', updated_info = 'ntf.campaign_start'
       WHERE id = ${campaignId}::uuid AND tenant_org_id = ${tenantOrgId}::uuid`;
    if (campaign.status !== 'RUNNING') {
      await auditCampaign(tx, tenantOrgId, campaignId, 'STATUS_CHANGED', { status: campaign.status }, { status: 'RUNNING', total_targets: total });
    }

    // Pages in id order are fixed once targets exist; queue only the pages with work left (a resume).
    const pages = await tx.$queryRaw<{ chunk: number }[]>`
      SELECT DISTINCT ((t.rn - 1) / ${CAMPAIGN_CHUNK_SIZE})::int AS chunk
        FROM (SELECT status, row_number() OVER (ORDER BY id) AS rn
                FROM public.org_ntf_camp_targets_dtl
               WHERE tenant_org_id = ${tenantOrgId}::uuid AND campaign_id = ${campaignId}::uuid) t
       WHERE t.status = 'PENDING'
       ORDER BY 1`;
    for (const { chunk } of pages) {
      await jobs.enqueue(tx, 'ntf.campaign_chunk', { tenantOrgId, campaignId, chunk });
    }
    if (pages.length === 0 && await completeIfDoneTx(tx, tenantOrgId, campaignId)) return { outcome: 'COMPLETED', chunks: 0 };
    return { outcome: 'STARTED', chunks: pages.length };
  }));
}

export interface CampaignChunkOutcome {
  outcome: 'PROCESSED' | 'NOT_RUNNING' | 'CHANNEL_OFF_RECHECK' | 'SKIPPED_ORPHAN';
  queued: number;
  sentNow: number;
  skipped: number;
  completed: boolean;
}

type TargetResult = 'QUEUED' | 'SENT' | 'SKIPPED' | 'ALREADY_DONE' | 'STOP';

interface CampaignContent {
  tenantOrgId: string;
  campaignId: string;
  channel: string;
  channelConfig: ChannelConfig;
  rendered: RenderedContent;
}

/**
 * Who one target sends to: a staff user (address looked up per target) or a customer (consent and
 * address read for the whole chunk; `blockedReason` when the customer is no longer active).
 */
interface TargetRecipient {
  userId: string | null;
  customerId: string | null;
  hasConsent: boolean;
  customerAddress?: string | null;
  blockedReason?: string | null;
}

/** One target in one transaction: lock it while PENDING, write its row, queue its send, count it. */
async function processTarget(c: CampaignContent, targetId: string, r: TargetRecipient): Promise<TargetResult> {
  const { userId, customerId } = r;
  const decision = decideDelivery({ channelConfig: c.channelConfig, isTransactional: false, hasMarketingConsent: r.hasConsent, priority: 'NORMAL' });
  let skipReason: string | null = !userId && !customerId ? 'NO_RECIPIENT'
    : r.blockedReason ?? (decision.action === 'SKIP' ? decision.skipReason : null);

  // Address lookups call Supabase, so they run before the transaction. Push is addressed to the user.
  let address: string | null = r.customerAddress ?? null;
  if (!skipReason && customerId && !address) skipReason = 'NO_RECIPIENT_ADDRESS';
  if (!skipReason && userId && c.channel !== NOTIFICATION_CHANNEL.IN_APP && c.channel !== NOTIFICATION_CHANNEL.PUSH) {
    address = await resolveRecipientAddress({
      tenantOrgId: c.tenantOrgId, recipientUserId: userId, channelCode: c.channel, sourceEntityType: 'campaign', sourceEntityId: c.campaignId,
    });
    if (!address) skipReason = 'NO_RECIPIENT_ADDRESS';
  }

  const idempotencyKey = `campaign:${c.campaignId}:target:${targetId}`;
  return prisma.$transaction(async (tx): Promise<TargetResult> => {
    const [campaign] = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM public.org_ntf_campaigns_mst
       WHERE id = ${c.campaignId}::uuid AND tenant_org_id = ${c.tenantOrgId}::uuid FOR SHARE`;
    if (campaign?.status !== 'RUNNING') return 'STOP'; // paused or cancelled meanwhile: the target stays PENDING
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM public.org_ntf_camp_targets_dtl
       WHERE id = ${targetId}::uuid AND tenant_org_id = ${c.tenantOrgId}::uuid AND status = 'PENDING' FOR UPDATE`;
    if (locked.length === 0) return 'ALREADY_DONE';

    const now = new Date();
    const target = { where: { id: targetId, tenant_org_id: c.tenantOrgId } };
    const campaignRow = { where: { id: c.campaignId, tenant_org_id: c.tenantOrgId } };

    if (skipReason) {
      await tx.org_ntf_camp_targets_dtl.updateMany({ ...target, data: { status: 'SKIPPED', skip_reason: skipReason, processed_at: now, updated_at: now } });
      await tx.org_ntf_campaigns_mst.updateMany({ ...campaignRow, data: { skip_count: { increment: 1 }, updated_at: now } });
      return 'SKIPPED';
    }

    const content = {
      tenant_org_id: c.tenantOrgId, recipient_user_id: userId, event_code: CAMPAIGN_EVENT_CODE,
      source_entity_type: 'campaign', source_entity_id: c.campaignId, idempotency_key: idempotencyKey, rec_status: 1,
    };

    if (c.channel === NOTIFICATION_CHANNEL.IN_APP) {
      // The in-app row is the delivery itself, so the target is SENT now.
      await tx.org_ntf_inbox_mst.createMany({
        data: [{ ...content, title: c.rendered.title, title2: c.rendered.title2 ?? null, body: c.rendered.body, body2: c.rendered.body2 ?? null, channel_code: 'IN_APP', priority: 'NORMAL' }],
        skipDuplicates: true,
      });
      const inbox = await tx.org_ntf_inbox_mst.findFirst({ where: { tenant_org_id: c.tenantOrgId, idempotency_key: idempotencyKey }, select: { id: true } });
      await tx.org_ntf_camp_targets_dtl.updateMany({ ...target, data: { status: 'SENT', inbox_id: inbox?.id ?? null, outbox_id: null, processed_at: now, updated_at: now } });
      await tx.org_ntf_campaigns_mst.updateMany({ ...campaignRow, data: { sent_count: { increment: 1 }, updated_at: now } });
      return 'SENT';
    }

    await tx.org_ntf_outbox_dtl.createMany({
      data: [{
        ...content, channel_code: c.channel, recipient_address: address,
        rendered_subject: c.rendered.title, rendered_subject2: c.rendered.title2 ?? null,
        rendered_body: c.rendered.body, rendered_body2: c.rendered.body2 ?? null,
        metadata: (c.rendered.metadata ?? {}) as Prisma.InputJsonValue,
        status: 'QUEUED', scheduled_at: decision.scheduledAt, retry_count: 0, max_retries: 3, created_by: 'system', is_active: true,
      }],
      skipDuplicates: true,
    });
    const outbox = await tx.org_ntf_outbox_dtl.findFirst({
      where: { tenant_org_id: c.tenantOrgId, idempotency_key: idempotencyKey },
      select: { id: true, status: true, claim_token: true, scheduled_at: true },
    });
    if (!outbox) throw new Error(`campaign outbox row missing after insert (target ${targetId})`);
    await tx.org_ntf_camp_targets_dtl.updateMany({ ...target, data: { status: 'QUEUED', outbox_id: outbox.id, processed_at: now, updated_at: now } });
    await tx.org_ntf_campaigns_mst.updateMany({ ...campaignRow, data: { queued_count: { increment: 1 }, updated_at: now } });
    if (outbox.status === 'QUEUED' && !outbox.claim_token) {
      await jobs.enqueue(tx, 'ntf.deliver', { tenantOrgId: c.tenantOrgId, outboxId: outbox.id }, {
        id: outbox.id,
        priority: CAMPAIGN_DELIVER_PRIORITY,
        ...(outbox.scheduled_at.getTime() > Date.now() ? { startAfter: outbox.scheduled_at } : {}),
      });
    }
    return 'QUEUED';
  });
}

/** The `ntf.campaign_chunk` job: targets chunk*50 .. chunk*50+49 of the campaign, in id order. */
export async function runCampaignChunk(tenantOrgId: string, campaignId: string, chunk: number): Promise<CampaignChunkOutcome> {
  return withTenantContext(tenantOrgId, async () => {
    const result: CampaignChunkOutcome = { outcome: 'PROCESSED', queued: 0, sentNow: 0, skipped: 0, completed: false };
    const campaign = await prisma.org_ntf_campaigns_mst.findFirst({
      where: { id: campaignId, tenant_org_id: tenantOrgId, is_active: true },
      select: { status: true, audience_code: true, channel_code: true, template_code: true, name: true, name2: true, description: true, description2: true },
    });
    if (!campaign) return { ...result, outcome: 'SKIPPED_ORPHAN' };
    if (campaign.status !== 'RUNNING') return { ...result, outcome: 'NOT_RUNNING' }; // a resume queues the page again

    const page = await prisma.org_ntf_camp_targets_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, campaign_id: campaignId },
      orderBy: { id: 'asc' }, skip: chunk * CAMPAIGN_CHUNK_SIZE, take: CAMPAIGN_CHUNK_SIZE,
      select: { id: true, status: true, recipient_user_id: true, recipient_customer_id: true },
    });
    const pending = page.filter((t) => t.status === 'PENDING');

    if (pending.length > 0) {
      const channelConfig = await notificationSettingsService.getChannelConfig(tenantOrgId, campaign.channel_code);
      if (!channelConfig?.isEnabled) {
        // The tenant switched the channel off: the targets wait (as before) until it is on again or the campaign is cancelled.
        await prisma.$transaction((tx) => jobs.enqueue(tx, 'ntf.campaign_chunk', { tenantOrgId, campaignId, chunk },
          { startAfter: new Date(Date.now() + CHANNEL_OFF_RECHECK_MS) }));
        return { ...result, outcome: 'CHANNEL_OFF_RECHECK' };
      }

      // Marketing consent per user on this channel (the channel-level preference, event_code NULL).
      const userIds = pending.map((t) => t.recipient_user_id).filter((u): u is string => Boolean(u));
      const { data: prefs, error: prefsError } = userIds.length === 0 ? { data: [], error: null } : await createAdminSupabaseClient()
        .from('org_ntf_user_prefs_dtl')
        .select('user_id, channel_code, event_code, marketing_consent, is_enabled, updated_at, created_at')
        .eq('tenant_org_id', tenantOrgId).eq('channel_code', campaign.channel_code).is('event_code', null).in('user_id', userIds);
      if (prefsError) throw new Error(`campaign consent lookup failed: ${prefsError.message}`); // retry rather than skip everyone
      const consent = new Map(collapseUserPrefRows(prefs ?? []).map((p) => [p.user_id as string, Boolean(p.marketing_consent) && Boolean(p.is_enabled)]));

      // Customers: consent from org_ntf_cust_consent_dtl on this channel, address from the customer row.
      const customerIds = pending.map((t) => t.recipient_customer_id).filter((u): u is string => Boolean(u));
      const [customerConsent, customers] = customerIds.length === 0 ? [[], []] : await Promise.all([
        prisma.org_ntf_cust_consent_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, customer_id: { in: customerIds }, channel_code: campaign.channel_code, marketing_consent: true, is_active: true, rec_status: 1 },
          select: { customer_id: true },
        }),
        prisma.org_customers_mst.findMany({
          where: { tenant_org_id: tenantOrgId, id: { in: customerIds }, is_active: true },
          select: { id: true, email: true, phone: true, rec_status: true },
        }),
      ]);
      const customerAgreed = new Set(customerConsent.map((k) => k.customer_id));
      const customerById = new Map(customers.filter((cu) => cu.rec_status !== 0).map((cu) => [cu.id, cu]));
      const customerRecipient = (customerId: string): TargetRecipient => {
        const cu = customerById.get(customerId);
        if (!cu) return { userId: null, customerId, hasConsent: false, blockedReason: 'CUSTOMER_INACTIVE' };
        const phone = cu.phone ? normalizePhone(cu.phone) : null;
        const customerAddress = campaign.channel_code === NOTIFICATION_CHANNEL.EMAIL ? (cu.email?.trim() || null)
          : phone?.isValid ? phone.normalized : null;
        return { userId: null, customerId, hasConsent: customerAgreed.has(customerId), customerAddress };
      };

      // The message does not vary per recipient: render once per chunk.
      const rendered = await renderBuiltContent({
        channel: campaign.channel_code,
        template: campaign.template_code ? { kind: 'code', templateCode: campaign.template_code } : null,
        inline: { title: campaign.name, title2: campaign.name2 ?? null, body: campaign.description ?? campaign.name, body2: campaign.description2 ?? null },
        variables: {
          campaign_name: campaign.name, campaign_name2: campaign.name2 ?? '',
          campaign_description: campaign.description ?? '', campaign_description2: campaign.description2 ?? '',
        },
      });

      const content: CampaignContent = { tenantOrgId, campaignId, channel: campaign.channel_code, channelConfig, rendered };
      for (const t of pending) {
        const r = await processTarget(content, t.id, t.recipient_customer_id
          ? customerRecipient(t.recipient_customer_id)
          : { userId: t.recipient_user_id, customerId: null, hasConsent: t.recipient_user_id ? (consent.get(t.recipient_user_id) ?? false) : false });
        if (r === 'STOP') return { ...result, outcome: 'NOT_RUNNING' };
        if (r === 'QUEUED') result.queued++;
        else if (r === 'SENT') result.sentNow++;
        else if (r === 'SKIPPED') result.skipped++;
      }
    }

    result.completed = await prisma.$transaction((tx) => completeIfDoneTx(tx, tenantOrgId, campaignId));
    return result;
  });
}

/**
 * Last failed attempt of an `ntf.campaign_chunk` job: the page's PENDING targets become FAILED with the
 * reason and are counted, so the campaign can still complete instead of staying RUNNING for ever.
 */
export async function failCampaignChunk(tenantOrgId: string, campaignId: string, chunk: number, error: string): Promise<void> {
  const reason = error.slice(0, 1000);
  await withTenantContext(tenantOrgId, () => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      WITH page AS (
        SELECT id FROM public.org_ntf_camp_targets_dtl
         WHERE tenant_org_id = ${tenantOrgId}::uuid AND campaign_id = ${campaignId}::uuid
         ORDER BY id OFFSET ${chunk * CAMPAIGN_CHUNK_SIZE} LIMIT ${CAMPAIGN_CHUNK_SIZE}
      ), failed AS (
        UPDATE public.org_ntf_camp_targets_dtl t
           SET status = 'FAILED', skip_reason = ${reason}, processed_at = now() AT TIME ZONE 'UTC', updated_at = now() AT TIME ZONE 'UTC',
               updated_info = 'ntf.campaign_chunk dead letter'
          FROM page
         WHERE t.id = page.id AND t.tenant_org_id = ${tenantOrgId}::uuid AND t.status = 'PENDING'
        RETURNING t.id
      )
      UPDATE public.org_ntf_campaigns_mst
         SET failed_count = failed_count + (SELECT count(*) FROM failed)::int, updated_at = now() AT TIME ZONE 'UTC'
       WHERE id = ${campaignId}::uuid AND tenant_org_id = ${tenantOrgId}::uuid`;
    await completeIfDoneTx(tx, tenantOrgId, campaignId);
  }));
}
