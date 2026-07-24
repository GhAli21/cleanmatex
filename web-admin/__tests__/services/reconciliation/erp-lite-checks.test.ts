/**
 * B6 — erp-lite-checks.ts unit tests.
 *
 * Covers the BVM/operational-fact ↔ ERP-Lite GL posting-attempt trip-wires:
 *   - ORDER_PAYMENT_ERP_POST_ATTEMPTED
 *   - REFUND_ERP_POST_ATTEMPTED
 *
 * Both must (1) no-op entirely for a tenant without ERP-Lite enabled (avoid
 * flooding false positives for the majority of tenants that don't use it),
 * and (2) flag a fact with zero org_fin_post_log_tr rows once enabled.
 */

const mockOrderPaymentsFindMany = jest.fn();
const mockRefundsFindMany = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_payments_dtl: { findMany: (...a: unknown[]) => mockOrderPaymentsFindMany(...a) },
    org_order_refunds_dtl: { findMany: (...a: unknown[]) => mockRefundsFindMany(...a) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

const mockCanAccess = jest.fn();
jest.mock('@/lib/services/feature-flags.service', () => ({
  canAccess: (...a: unknown[]) => mockCanAccess(...a),
  FEATURE_FLAG_KEYS: { ERP_LITE_ENABLED: 'erp_lite_enabled' },
}));

import { Decimal } from '@prisma/client/runtime/library';
import {
  checkOrderPaymentErpPostAttempted,
  checkRefundErpPostAttempted,
} from '@/lib/services/reconciliation/erp-lite-checks';

const TENANT = 'tenant-aaa';
const WINDOW = { periodFrom: new Date('2026-07-01'), periodTo: new Date('2026-07-31') };

beforeEach(() => jest.clearAllMocks());

describe('checkOrderPaymentErpPostAttempted', () => {
  it('short-circuits with [] when ERP-Lite is not enabled for the tenant', async () => {
    mockCanAccess.mockResolvedValue(false);
    const result = await checkOrderPaymentErpPostAttempted(TENANT, WINDOW);
    expect(result).toEqual([]);
    expect(mockOrderPaymentsFindMany).not.toHaveBeenCalled();
  });

  it('flags a COMPLETED payment with zero org_fin_post_log_tr attempts', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', amount: new Decimal('50') },
    ]);
    mockQueryRaw.mockResolvedValue([]); // no attempts found
    const result = await checkOrderPaymentErpPostAttempted(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      checkName: 'ORDER_PAYMENT_ERP_POST_ATTEMPTED',
      severity: 'WARNING',
      actualValue: 50,
      affectedEntityId: 'p1',
    });
  });

  it('is clean when a matching attempt exists', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', amount: new Decimal('50') },
    ]);
    mockQueryRaw.mockResolvedValue([{ source_doc_id: 'p1' }]);
    expect(await checkOrderPaymentErpPostAttempted(TENANT, WINDOW)).toEqual([]);
  });

  it('short-circuits without querying attempts when there are no payments in window', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockOrderPaymentsFindMany.mockResolvedValue([]);
    expect(await checkOrderPaymentErpPostAttempted(TENANT, WINDOW)).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe('checkRefundErpPostAttempted', () => {
  it('short-circuits with [] when ERP-Lite is not enabled for the tenant', async () => {
    mockCanAccess.mockResolvedValue(false);
    const result = await checkRefundErpPostAttempted(TENANT, WINDOW);
    expect(result).toEqual([]);
    expect(mockRefundsFindMany).not.toHaveBeenCalled();
  });

  it('flags a PROCESSED refund with zero REFUND_ISSUED attempts', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockRefundsFindMany.mockResolvedValue([
      { id: 'r1', order_id: 'o1', refund_amount: new Decimal('20') },
    ]);
    mockQueryRaw.mockResolvedValue([]);
    const result = await checkRefundErpPostAttempted(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      checkName: 'REFUND_ERP_POST_ATTEMPTED',
      severity: 'WARNING',
      actualValue: 20,
      affectedEntityId: 'r1',
    });
  });

  it('is clean when a matching attempt exists', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockRefundsFindMany.mockResolvedValue([
      { id: 'r1', order_id: 'o1', refund_amount: new Decimal('20') },
    ]);
    mockQueryRaw.mockResolvedValue([{ source_doc_id: 'r1' }]);
    expect(await checkRefundErpPostAttempted(TENANT, WINDOW)).toEqual([]);
  });
});
