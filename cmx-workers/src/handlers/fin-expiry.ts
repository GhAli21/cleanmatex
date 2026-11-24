/**
 * Gift card and loyalty expiry (Background Jobs step 6a, migration 0823; credit notes are pg_cron): a daily schedule → `<kind>.sweep`
 * (due ids → item jobs) → `<kind>.item` (one entity through the web-admin ledger-aware service).
 * An item whose entity is no longer due completes as SKIPPED_ORPHAN and is never retried (DESIGN §5.6).
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import {
  runExpirySweep,
  runGiftCardExpiryItem,
  runLoyaltyExpiryItem,
} from '@/lib/services/finance-expiry-jobs.service';
import type { JobHandler } from './types';

export const FIN_EXPIRY_HANDLERS: Readonly<Record<string, JobHandler>> = {
  'fin.gift_card_expiry.sweep': async (job) =>
    runExpirySweep('gift_card', QUEUE_PAYLOADS['fin.gift_card_expiry.sweep'].parse(job.data ?? {}).page ?? 0),
  'fin.loyalty_expiry.sweep': async (job) =>
    runExpirySweep('loyalty', QUEUE_PAYLOADS['fin.loyalty_expiry.sweep'].parse(job.data ?? {}).page ?? 0),
  'fin.gift_card_expiry.item': async (job) => {
    const { tenantOrgId, giftCardId } = QUEUE_PAYLOADS['fin.gift_card_expiry.item'].parse(job.data);
    return runGiftCardExpiryItem(tenantOrgId, giftCardId);
  },
  'fin.loyalty_expiry.item': async (job) => {
    const { tenantOrgId, accountId } = QUEUE_PAYLOADS['fin.loyalty_expiry.item'].parse(job.data);
    return runLoyaltyExpiryItem(tenantOrgId, accountId);
  },
};
