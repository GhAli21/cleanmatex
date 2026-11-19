import { EXTRA_CONFIG_KEYS } from '@/lib/constants/tenant-extra-config';

const mockFrom = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdateMany = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockGetFeatureFlags = jest.fn();
const mockGetSessionIdentity = jest.fn();

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('server-only', () => ({}));

jest.mock('@/lib/supabase/catalog-read', () => ({
  catalogReadClient: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tenant_extra_config_cf: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(cb),
  },
}));

jest.mock('@/lib/services/feature-flags.service', () => ({
  getFeatureFlags: (...args: unknown[]) => mockGetFeatureFlags(...args),
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getSessionIdentity: () => mockGetSessionIdentity(),
}));

import {
  ExtraConfigError,
  getRequestExtraConfig,
  resetTenantExtraConfigKey,
  upsertTenantExtraConfigBatch,
} from '@/lib/services/tenant-extra-config.service';

const SAMPLE_CATALOG = [
  {
    config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
    category_code: 'NUMBERS_AND_DATES',
    name: 'Currency & Number Digits',
    name2: 'أرقام العملة',
    description: null,
    description2: null,
    value_type: 'SELECT',
    default_value: 'LATN',
    allowed_values_json: [
      { value: 'LATN', label: '123', label2: '123' },
      { value: 'ARAB', label: '١٢٣', label2: '١٢٣' },
    ],
    validation_regex: null,
    min_num: null,
    max_num: null,
    is_editable_by_tenant: true,
    plan_flag_key: null,
    rec_order: 10,
    rec_status: 1,
    is_active: true,
  },
  {
    config_key: 'HQ_LOCKED_KEY',
    category_code: 'ACCESSIBILITY',
    name: 'HQ Locked',
    name2: null,
    description: null,
    description2: null,
    value_type: 'BOOLEAN',
    default_value: 'TRUE',
    allowed_values_json: [],
    validation_regex: null,
    min_num: null,
    max_num: null,
    is_editable_by_tenant: false,
    plan_flag_key: null,
    rec_order: 20,
    rec_status: 1,
    is_active: true,
  },
];

describe('tenant-extra-config.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const orderChain = {
      order: jest.fn().mockResolvedValue({ data: SAMPLE_CATALOG, error: null }),
    };
    const firstOrderChain = { order: jest.fn().mockReturnValue(orderChain) };
    const eqActive = { ...firstOrderChain };
    const eqRec = { eq: jest.fn().mockReturnValue(eqActive) };
    const select = { eq: jest.fn().mockReturnValue(eqRec) };
    mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(select) });

    mockGetFeatureFlags.mockResolvedValue({});
    mockFindMany.mockResolvedValue([]);
    mockGetSessionIdentity.mockResolvedValue({
      tenantId: 'tenant-123',
      userId: 'user-1',
    });
    mockTransaction.mockImplementation(async (cb) =>
      cb({
        org_tenant_extra_config_cf: {
          findFirst: mockFindFirst,
          updateMany: mockUpdateMany,
          create: mockCreate,
        },
      })
    );
  });

  it('explicitly filters tenant_org_id when saving a custom override and resets when saved back to default', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ id: 'ov-1' });

    await upsertTenantExtraConfigBatch(
      'tenant-123',
      [{ config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT, config_value: 'ARAB' }],
      { userId: 'user-1' }
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id: 'tenant-123',
          config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
          config_value: 'ARAB',
        }),
      })
    );

    await upsertTenantExtraConfigBatch(
      'tenant-123',
      [{ config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT, config_value: 'LATN' }],
      { userId: 'user-1' }
    );
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id: 'tenant-123',
          config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
        }),
        data: expect.objectContaining({ is_active: false, rec_status: 0 }),
      })
    );
  });

  it('rejects non-editable HQ keys and invalid options cleanly', async () => {
    await expect(
      upsertTenantExtraConfigBatch(
        'tenant-123',
        [{ config_key: 'HQ_LOCKED_KEY', config_value: 'FALSE' }],
        { userId: 'user-1' }
      )
    ).rejects.toThrow(ExtraConfigError);

    await expect(
      upsertTenantExtraConfigBatch(
        'tenant-123',
        [{ config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT, config_value: 'INVALID' }],
        { userId: 'user-1' }
      )
    ).rejects.toThrow(ExtraConfigError);
  });

  it('resetTenantExtraConfigKey filters explicitly by tenant_org_id', async () => {
    await resetTenantExtraConfigKey('tenant-abc', EXTRA_CONFIG_KEYS.NUMBER_SCRIPT, {
      userId: 'u2',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id: 'tenant-abc',
          config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
        }),
        data: expect.objectContaining({ is_active: false, rec_status: 0 }),
      })
    );
  });

  it('degrades to GCC defaults without throwing when catalog read fails inside getRequestExtraConfig', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const res = await getRequestExtraConfig();
    expect(res.numberScript).toBe('LATN');
    expect(res.defaultTablePageSize).toBe(10);
  });
});
