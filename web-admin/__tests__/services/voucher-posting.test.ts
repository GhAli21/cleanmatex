/**
 * Tests: voucher-posting.service
 *
 * Covers: DRAFT→POSTED, idempotency, immutability guard, cashier type restriction.
 * All DB access is mocked — no real database required.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTx = {
  org_idempotency_keys: {
    findFirst: jest.fn(),
    upsert:    jest.fn(),
  },
  $queryRaw:                       jest.fn(),
  org_fin_voucher_trx_lines_dtl:   { findMany: jest.fn(), updateMany: jest.fn() },
  org_fin_vouchers_mst:            { updateMany: jest.fn() },
  org_domain_events_outbox:        { create: jest.fn() },
  org_fin_voucher_audit_log:       { create: jest.fn() },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

// ---------------------------------------------------------------------------

import { postBizVoucher } from '@/lib/services/voucher-posting.service';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

const TENANT = 'tenant-test-001';
const VOUCHER_ID = 'voucher-uuid-001';
const USER_ID = 'user-uuid-001';

const makeDraftVoucher = () => ({
  id:             VOUCHER_ID,
  voucher_no:     'RV-2026-000001',
  voucher_status: VOUCHER_STATUS.DRAFT,
  total_amount:   '200',
});

const makeDraftLines = () => [
  { amount: 100, line_status: 'DRAFT', is_active: true },
  { amount: 100, line_status: 'DRAFT', is_active: true },
];

// ---------------------------------------------------------------------------

describe('postBizVoucher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('posts a DRAFT voucher → returns POSTED result', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_idempotency_keys.upsert.mockResolvedValue({});

    const result = await postBizVoucher(TENANT, VOUCHER_ID, USER_ID);

    expect(result.voucher_status).toBe(VOUCHER_STATUS.POSTED);
    expect(result.voucherId).toBe(VOUCHER_ID);
    expect(result.fromCache).toBe(false);
  });

  it('sets posting_status to POSTED when posting a voucher', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});

    await postBizVoucher(TENANT, VOUCHER_ID, USER_ID);

    const updateCall = mockTx.org_fin_vouchers_mst.updateMany.mock.calls[0][0];
    expect(updateCall.data.posting_status).toBe('POSTED');
  });

  it('writes a domain event outbox row with event_type VOUCHER_POSTED', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});

    await postBizVoucher(TENANT, VOUCHER_ID, USER_ID);

    const outboxCall = mockTx.org_domain_events_outbox.create.mock.calls[0][0];
    expect(outboxCall.data.event_type).toBe('VOUCHER_POSTED');
    expect(outboxCall.data.aggregate_type).toBe('fin_voucher');
  });

  it('writes an audit log row with action POSTED', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});

    await postBizVoucher(TENANT, VOUCHER_ID, USER_ID);

    const auditCall = mockTx.org_fin_voucher_audit_log.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('POSTED');
    expect(auditCall.data.changed_by).toBe(USER_ID);
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('returns cached result on duplicate idempotency key', async () => {
    const cached = {
      voucherId:      VOUCHER_ID,
      voucher_no:     'RV-2026-000001',
      voucher_status: VOUCHER_STATUS.POSTED,
      fromCache:      false,
    };
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue({ response_cache: cached });

    const result = await postBizVoucher(TENANT, VOUCHER_ID, USER_ID, 'idem-key-001');

    expect(result.fromCache).toBe(true);
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
  });

  it('upserts idempotency key after successful post', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_idempotency_keys.upsert.mockResolvedValue({});

    await postBizVoucher(TENANT, VOUCHER_ID, USER_ID, 'idem-key-002');

    expect(mockTx.org_idempotency_keys.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips idempotency upsert when no key provided', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 2 });
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});

    await postBizVoucher(TENANT, VOUCHER_ID, USER_ID);

    expect(mockTx.org_idempotency_keys.upsert).not.toHaveBeenCalled();
  });

  // ── Rejection cases ────────────────────────────────────────────────────────

  it('throws when voucher not found', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([]);

    await expect(postBizVoucher(TENANT, VOUCHER_ID, USER_ID)).rejects.toThrow(/not found/);
  });

  it('throws when voucher is already POSTED (invalid transition)', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([{
      ...makeDraftVoucher(),
      voucher_status: VOUCHER_STATUS.POSTED,
    }]);

    await expect(postBizVoucher(TENANT, VOUCHER_ID, USER_ID)).rejects.toThrow(
      /Invalid voucher status transition/
    );
  });

  it('throws when voucher is CANCELLED', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([{
      ...makeDraftVoucher(),
      voucher_status: VOUCHER_STATUS.CANCELLED,
    }]);

    await expect(postBizVoucher(TENANT, VOUCHER_ID, USER_ID)).rejects.toThrow(
      /Invalid voucher status transition/
    );
  });

  it('throws when no active DRAFT lines exist', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([makeDraftVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([
      { amount: 200, line_status: 'POSTED', is_active: true },
    ]);

    await expect(postBizVoucher(TENANT, VOUCHER_ID, USER_ID)).rejects.toThrow(
      /at least one active DRAFT line/
    );
  });

  it('throws when header total does not match line sum', async () => {
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([{ ...makeDraftVoucher(), total_amount: '999' }]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makeDraftLines());

    await expect(postBizVoucher(TENANT, VOUCHER_ID, USER_ID)).rejects.toThrow(
      /does not match/
    );
  });
});
