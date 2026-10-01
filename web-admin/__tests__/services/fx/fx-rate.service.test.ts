/**
 * Tests: fx-rate.service (org_fx_rate_mst CRUD + lifecycle, plan 01 §5).
 * Covers: lifecycle transitions (DRAFT→APPROVED/REJECTED, APPROVED→VOIDED),
 * tenant isolation, and translating DB failures (unique violation, the C3
 * trigger) into typed FxErrors.
 */

const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockFindFirstOrThrow = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_fx_rate_mst: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findFirstOrThrow: (...a: unknown[]) => mockFindFirstOrThrow(...a),
      count: (...a: unknown[]) => mockCount(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  class Decimal {
    value: string;
    constructor(v: string | number) {
      this.value = String(v);
    }
    toString() {
      return this.value;
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError, Decimal },
  };
});

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

import { Prisma } from '@prisma/client';
import {
  approveRate,
  createRate,
  deleteRate,
  rejectRate,
  updateRate,
  voidRate,
} from '@/lib/services/fx/fx-rate.service';
import { FX_ERROR } from '@/lib/services/fx/fx-errors';
import { FX_RATE_ORIGIN, FX_RATE_STATUS } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function rateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rate-id',
    tenant_org_id: TENANT_ID,
    from_currency_code: 'USD',
    to_currency_code: 'OMR',
    rate_type_code: 'SPOT',
    source_code: 'ecb',
    origin_code: FX_RATE_ORIGIN.MANUAL,
    provider_code: null,
    rate_date: new Date('2026-09-30'),
    rate_value: { toString: () => '0.3850000000' },
    inverse_rate_value: null,
    status: FX_RATE_STATUS.DRAFT,
    source_reference: null,
    import_batch_id: null,
    hq_rate_id: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_at: new Date('2026-09-30'),
    created_by: USER_ID,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fx-rate.service — createRate', () => {
  it('rejects a same-currency pair before touching the DB', async () => {
    await expect(
      createRate(TENANT_ID, { fromCurrencyCode: 'USD', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '1' }, USER_ID)
    ).rejects.toMatchObject({ code: FX_ERROR.SAME_CURRENCY_PAIR });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a DRAFT rate by default', async () => {
    mockCreate.mockResolvedValue(rateRow());

    const result = await createRate(
      TENANT_ID,
      { fromCurrencyCode: 'USD', toCurrencyCode: 'OMR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '0.385' },
      USER_ID
    );

    expect(result.status).toBe(FX_RATE_STATUS.DRAFT);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.tenant_org_id).toBe(TENANT_ID);
    expect(data.status).toBe(FX_RATE_STATUS.DRAFT);
    expect(data.approved_at).toBeNull();
  });

  it('self-approves in the same call when approveNow is true (P5)', async () => {
    mockCreate.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED, approved_by: USER_ID }));

    await createRate(
      TENANT_ID,
      { fromCurrencyCode: 'USD', toCurrencyCode: 'OMR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '0.385', approveNow: true },
      USER_ID
    );

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.status).toBe(FX_RATE_STATUS.APPROVED);
    expect(data.approved_by).toBe(USER_ID);
  });

  it('translates a unique-constraint violation into RATE_DUPLICATE', async () => {
    mockCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', 'P2002'));

    await expect(
      createRate(TENANT_ID, { fromCurrencyCode: 'USD', toCurrencyCode: 'OMR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '0.385' }, USER_ID)
    ).rejects.toMatchObject({ code: FX_ERROR.RATE_DUPLICATE });
  });

  it('translates the C3 trigger exception into RATE_PAIR_INVALID', async () => {
    mockCreate.mockRejectedValue(new Error('FX_RATE_PAIR_INVALID: pair not valid for this tenant'));

    await expect(
      createRate(TENANT_ID, { fromCurrencyCode: 'USD', toCurrencyCode: 'GBP', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '0.385' }, USER_ID)
    ).rejects.toMatchObject({ code: FX_ERROR.RATE_PAIR_INVALID });
  });

  it('rejects a non-positive or malformed rate before hitting the DB', async () => {
    await expect(
      createRate(TENANT_ID, { fromCurrencyCode: 'USD', toCurrencyCode: 'OMR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '0' }, USER_ID)
    ).rejects.toMatchObject({ code: FX_ERROR.RATE_NON_POSITIVE });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('fx-rate.service — updateRate', () => {
  it('throws RATE_NOT_FOUND for a missing or other-tenant row', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(updateRate(TENANT_ID, 'rate-id', { rate: '0.4' }, USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_NOT_FOUND,
    });
  });

  it('throws RATE_NOT_EDITABLE once the rate is no longer DRAFT', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED }));
    await expect(updateRate(TENANT_ID, 'rate-id', { rate: '0.4' }, USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_NOT_EDITABLE,
    });
  });

  it('updates only the fields provided', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdate.mockResolvedValue(rateRow({ rate_value: { toString: () => '0.4000000000' } }));

    await updateRate(TENANT_ID, 'rate-id', { rate: '0.4' }, USER_ID);

    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.rate_value).toBeInstanceOf(Prisma.Decimal);
    expect(data.rate_type_code).toBeUndefined();
  });
});

describe('fx-rate.service — lifecycle transitions', () => {
  it('approveRate transitions DRAFT → APPROVED and records the approver (self-approval allowed, P5)', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirstOrThrow.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED, approved_by: USER_ID }));

    const result = await approveRate(TENANT_ID, 'rate-id', USER_ID);

    expect(result.status).toBe(FX_RATE_STATUS.APPROVED);
    expect(result.selfApproved).toBe(true);
    const patch = mockUpdateMany.mock.calls[0][0].data;
    expect(patch.status).toBe(FX_RATE_STATUS.APPROVED);
    expect(patch.approved_by).toBe(USER_ID);
  });

  it('approveRate rejects a non-DRAFT rate (RATE_INVALID_TRANSITION)', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED }));
    await expect(approveRate(TENANT_ID, 'rate-id', USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_INVALID_TRANSITION,
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('rejectRate requires a non-empty reason', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    await expect(rejectRate(TENANT_ID, 'rate-id', '   ', USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.REASON_REQUIRED,
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('rejectRate transitions DRAFT → REJECTED with the reason recorded', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirstOrThrow.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.REJECTED, rejection_reason: 'bad quote' }));

    const result = await rejectRate(TENANT_ID, 'rate-id', 'bad quote', USER_ID);

    expect(result.status).toBe(FX_RATE_STATUS.REJECTED);
    expect(mockUpdateMany.mock.calls[0][0].data.rejection_reason).toBe('bad quote');
  });

  it('voidRate transitions APPROVED → VOIDED (correction path, P6) and rejects a non-APPROVED rate', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED }));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirstOrThrow.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.VOIDED, void_reason: 'bank corrected the quote' }));

    const result = await voidRate(TENANT_ID, 'rate-id', 'bank corrected the quote', USER_ID);
    expect(result.status).toBe(FX_RATE_STATUS.VOIDED);

    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    await expect(voidRate(TENANT_ID, 'rate-id', 'reason', USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_INVALID_TRANSITION,
    });
  });

  it('transition treats a concurrent status change (0 rows updated) as RATE_INVALID_TRANSITION', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(approveRate(TENANT_ID, 'rate-id', USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_INVALID_TRANSITION,
    });
  });
});

describe('fx-rate.service — deleteRate', () => {
  it('soft-deletes a DRAFT rate', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdate.mockResolvedValue(rateRow({ rec_status: 0 }));

    await deleteRate(TENANT_ID, 'rate-id', USER_ID);

    expect(mockUpdate.mock.calls[0][0].data.rec_status).toBe(0);
  });

  it('refuses to delete an approved rate — must be voided instead', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED }));
    await expect(deleteRate(TENANT_ID, 'rate-id', USER_ID)).rejects.toMatchObject({
      code: FX_ERROR.RATE_NOT_EDITABLE,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('fx-rate.service — tenant isolation', () => {
  it('scopes findFirst reads by tenant_org_id', async () => {
    mockFindFirst.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.DRAFT }));
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirstOrThrow.mockResolvedValue(rateRow({ status: FX_RATE_STATUS.APPROVED }));

    await approveRate(TENANT_ID, 'rate-id', USER_ID);

    expect(mockFindFirst.mock.calls[0][0].where.tenant_org_id).toBe(TENANT_ID);
    expect(mockUpdateMany.mock.calls[0][0].where.tenant_org_id).toBe(TENANT_ID);
  });
});
