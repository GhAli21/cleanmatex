jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: [...strings],
      values,
    }),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import {
  getWorkflowScreenContract,
  listWorkflowScreenKeysForStatus,
} from '@/lib/services/workflow-profile.service';

const mockQueryRaw = prisma.$queryRaw as jest.Mock;

describe('workflow profile readers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the effective screen contract and binds the tenant filter', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        pre_conditions: {
          statuses: ['processing'],
          additional_filters: { express: true },
        },
        required_permissions: ['orders:transition'],
      },
    ]);

    const result = await getWorkflowScreenContract(
      '11111111-1111-1111-1111-111111111111',
      ' Processing ',
    );

    expect(result).toEqual({
      statuses: ['processing'],
      additional_filters: { express: true },
      required_permissions: ['orders:transition'],
    });

    const query = mockQueryRaw.mock.calls[0][0];
    expect(query.values).toEqual(
      expect.arrayContaining([
        'processing',
        '11111111-1111-1111-1111-111111111111',
      ]),
    );
    expect(query.strings.join(' ')).toContain('tenant_org_id');
    expect(query.strings.join(' ')).toContain('tenant_org_id IS NULL');
  });

  it('returns an empty contract when no active tenant or system row exists', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await expect(
      getWorkflowScreenContract(
        '11111111-1111-1111-1111-111111111111',
        'unknown',
      ),
    ).resolves.toEqual({
      statuses: [],
      additional_filters: {},
      required_permissions: [],
    });
  });

  it('discovers only configured screens using the authenticated tenant', async () => {
    mockQueryRaw.mockResolvedValue([
      { screen_key: 'processing' },
      { screen_key: 'canceling' },
    ]);

    const result = await listWorkflowScreenKeysForStatus(
      '22222222-2222-2222-2222-222222222222',
      ' Processing ',
    );

    expect(result).toEqual(['processing', 'canceling']);
    const query = mockQueryRaw.mock.calls[0][0];
    expect(query.values).toEqual(
      expect.arrayContaining([
        'processing',
        '22222222-2222-2222-2222-222222222222',
      ]),
    );
    expect(query.strings.join(' ')).toContain('org_ord_screen_contracts_cf');
  });
});
