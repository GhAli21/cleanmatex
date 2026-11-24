import 'server-only';

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { jobs } from '@/lib/jobs/producer';
import { expireGiftCard } from './gift-card-service';
import { expireLoyaltyPointsForAccount } from './loyalty.service';

/**
 * Gift card and loyalty expiry on pg-boss (Background Jobs step 6a, migration 0823,
 * docs/features/Background_Jobs/STEP6_PLAN.md). Credit note expiry is pure database (pg_cron
 * fn_fin_credit_note_expiry_run): it has no TypeScript-only effect. These two stay here because gift
 * card expiry posts a GL entry through the TypeScript ERP engine, and loyalty lot expiry is the same
 * code checkout and redemption run.
 *
 * A daily schedule sends one `<kind>.sweep` job. The sweep reads up to 100 due ids through a bounded
 * SQL function and queues one `<kind>.item` job each, all in one transaction. A full page re-sends
 * the sweep with `page + 1` (job ids make the already-queued ids a no-op), so a large backlog drains
 * in pages instead of one long run. Each item expires ONE entity through the existing ledger-aware
 * service, which re-checks "still due" under its row lock: running an item twice changes nothing.
 */

export type ExpiryKind = 'gift_card' | 'loyalty';

/** Page size of the due-id functions (they cap at 100). */
export const EXPIRY_SWEEP_PAGE = 100;
/** A day's sweep stops after this many pages (5,000 items); the next day continues. */
export const EXPIRY_SWEEP_MAX_PAGES = 50;

export interface ExpirySweepOutcome {
  found: number;
  /** Item jobs inserted now (ids already queued are not counted). */
  queued: number;
  /** Page number of the follow-up sweep, when one was sent. */
  nextPage: number | null;
}

export interface ExpiryItemOutcome {
  outcome: 'EXPIRED' | 'SKIPPED_ORPHAN';
  reason?: string;
}

interface DueRow { tenant_org_id: string; entity_id: string }

const SWEEP_QUEUE = {
  gift_card: 'fin.gift_card_expiry.sweep',
  loyalty: 'fin.loyalty_expiry.sweep',
} as const;

async function readDue(kind: ExpiryKind): Promise<DueRow[]> {
  switch (kind) {
    case 'gift_card':
      return prisma.$queryRaw<DueRow[]>`SELECT tenant_org_id, gift_card_id AS entity_id FROM public.fn_fin_gift_card_exp_due(${EXPIRY_SWEEP_PAGE}::int)`;
    case 'loyalty':
      return prisma.$queryRaw<DueRow[]>`SELECT tenant_org_id, account_id AS entity_id FROM public.fn_fin_loyalty_exp_due(${EXPIRY_SWEEP_PAGE}::int)`;
  }
}

/**
 * Job id of a loyalty item: one per account per UTC day. An account can expire points again on a
 * later day, so its id cannot be the account id alone (pg-boss keeps finished jobs for 7 days).
 */
export function loyaltyExpiryJobId(accountId: string, at: Date = new Date()): string {
  const h = createHash('sha256').update(`fin.loyalty_expiry:${accountId}:${at.toISOString().slice(0, 10)}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The `<kind>.sweep` job: queues one item job per due id, and a follow-up sweep after a full page. */
export async function runExpirySweep(kind: ExpiryKind, page = 0): Promise<ExpirySweepOutcome> {
  const due = await readDue(kind);
  let queued = 0;
  let nextPage: number | null = null;
  await prisma.$transaction(async (tx) => {
    for (const row of due) {
      const id = kind === 'gift_card'
        ? await jobs.enqueue(tx, 'fin.gift_card_expiry.item', { tenantOrgId: row.tenant_org_id, giftCardId: row.entity_id }, { id: row.entity_id })
        : await jobs.enqueue(tx, 'fin.loyalty_expiry.item', { tenantOrgId: row.tenant_org_id, accountId: row.entity_id }, { id: loyaltyExpiryJobId(row.entity_id) });
      if (id) queued += 1;
    }
    if (due.length >= EXPIRY_SWEEP_PAGE && page + 1 < EXPIRY_SWEEP_MAX_PAGES) {
      nextPage = page + 1;
      // Nothing new queued: the earlier items are still running, so look again later.
      await jobs.enqueue(tx, SWEEP_QUEUE[kind], { page: nextPage }, { startAfter: queued > 0 ? 60 : 300 });
    }
  });
  return { found: due.length, queued, nextPage };
}

const GIFT_CARD_ORPHAN = new Set(['GIFT_CARD_NOT_DUE']);

/** The `fin.gift_card_expiry.item` job. Throws on a retryable failure. */
export async function runGiftCardExpiryItem(tenantOrgId: string, giftCardId: string): Promise<ExpiryItemOutcome> {
  const r = await expireGiftCard(giftCardId, tenantOrgId, { onlyIfDue: true });
  if (r.success) return { outcome: 'EXPIRED' };
  if (r.error && GIFT_CARD_ORPHAN.has(r.error)) return { outcome: 'SKIPPED_ORPHAN', reason: r.error };
  throw new Error(`gift card expiry failed: ${r.error ?? 'unknown error'}`);
}

/**
 * The `fin.loyalty_expiry.item` job. The cutoff comes from the tenant's program now, not from the
 * sweep, so a program changed in between is honoured. Throws on a retryable failure.
 */
export async function runLoyaltyExpiryItem(tenantOrgId: string, accountId: string): Promise<ExpiryItemOutcome> {
  const program = await withTenantContext(tenantOrgId, () => prisma.org_loyalty_programs_cf.findFirst({
    where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 },
    select: { points_expiry_days: true },
  }));
  if (!program?.points_expiry_days || program.points_expiry_days <= 0) return { outcome: 'SKIPPED_ORPHAN', reason: 'NO_POINTS_EXPIRY' };
  const cutoff = new Date(Date.now() - program.points_expiry_days * 24 * 60 * 60 * 1000);
  const r = await expireLoyaltyPointsForAccount(tenantOrgId, accountId, cutoff);
  if (r.success) return { outcome: 'EXPIRED' };
  if (r.error === 'LOYALTY_ACCOUNT_NOT_FOUND') return { outcome: 'SKIPPED_ORPHAN', reason: r.error };
  throw new Error(`loyalty expiry failed: ${r.error ?? 'unknown error'}`);
}
