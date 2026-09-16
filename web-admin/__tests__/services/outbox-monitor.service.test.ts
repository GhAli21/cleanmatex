/**
 * Tests: outbox-monitor.service filter helpers and bulk-retry guardrails.
 */

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_domain_events_outbox: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/outbox.service', () => ({
  manualRetryMany: jest.fn(),
  OUTBOX_BULK_RETRY_MAX: 50,
}));

import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import {
  buildOutboxWhere,
  bulkRetryOutbox,
  parseOutboxStatus,
} from '@/lib/services/outbox-monitor.service';

describe('outbox-monitor.service — parseOutboxStatus', () => {
  it('accepts known outbox statuses and rejects unknown values', () => {
    expect(parseOutboxStatus('FAILED')).toBe(OUTBOX_STATUSES.FAILED);
    expect(parseOutboxStatus('DEAD_LETTERED')).toBe(OUTBOX_STATUSES.DEAD_LETTERED);
    expect(parseOutboxStatus('nope')).toBeUndefined();
    expect(parseOutboxStatus(null)).toBeUndefined();
  });
});

describe('outbox-monitor.service — buildOutboxWhere', () => {
  it('always scopes to the tenant and composes optional filters', () => {
    const where = buildOutboxWhere('tenant-1', {
      status: 'FAILED',
      eventType: 'LOYALTY_EARN',
      search: 'timeout',
    });

    expect(where.AND).toEqual(
      expect.arrayContaining([
        { tenant_org_id: 'tenant-1' },
        { status: 'FAILED' },
        { event_type: 'LOYALTY_EARN' },
        expect.objectContaining({
          OR: expect.arrayContaining([
            { event_type: { contains: 'timeout', mode: 'insensitive' } },
            { error_message: { contains: 'timeout', mode: 'insensitive' } },
          ]),
        }),
      ]),
    );
  });

  it('adds exact UUID matches when the search term is a UUID', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const where = buildOutboxWhere('tenant-1', { search: id });
    const orClause = (where.AND as object[]).find((clause) => 'OR' in clause) as { OR: object[] };
    expect(orClause.OR).toEqual(
      expect.arrayContaining([{ id }, { aggregate_id: id }]),
    );
  });
});

describe('outbox-monitor.service — bulkRetryOutbox', () => {
  it('no-ops when the current status filter is not retryable', async () => {
    await expect(
      bulkRetryOutbox('tenant-1', { filters: { status: 'PENDING' } }),
    ).resolves.toEqual({ retried: 0, requested: 0 });
  });
});
