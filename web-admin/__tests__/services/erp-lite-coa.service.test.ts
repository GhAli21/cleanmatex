jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

import { ErpLiteCoaService } from '@/lib/services/erp-lite-coa.service';

describe('ErpLiteCoaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a COA dashboard snapshot with localized option collections', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'acct-1',
          account_code: '1000',
          account_name: 'Cash',
          account_type_name: 'Asset',
          account_group_name: 'Current Assets',
          parent_account_name: null,
          branch_name: null,
          is_postable: true,
          is_control_account: false,
          is_system_linked: false,
          manual_post_allowed: true,
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([{ id: 'type-1', code: 'ASSET', name: 'Asset', name2: 'أصل' }])
      .mockResolvedValueOnce([{ id: 'group-1', code: 'CUR_ASSET', name: 'Current Assets', name2: 'أصول متداولة' }])
      .mockResolvedValueOnce([{ id: 'acct-1', code: '1000', name: 'Cash', name2: 'نقد' }])
      .mockResolvedValueOnce([{ id: 'branch-1', code: 'BR1', name: 'Main', name2: 'الرئيسي' }]);

    const snapshot = await ErpLiteCoaService.getDashboardSnapshot('en');

    expect(snapshot.account_list).toHaveLength(1);
    expect(snapshot.account_type_options).toEqual([{ id: 'type-1', label: 'ASSET · Asset' }]);
    expect(snapshot.account_group_options).toEqual([{ id: 'group-1', label: 'CUR_ASSET · Current Assets' }]);
    expect(snapshot.parent_account_options).toEqual([{ id: 'acct-1', label: '1000 · Cash' }]);
    expect(snapshot.branch_options).toEqual([{ id: 'branch-1', label: 'BR1 · Main' }]);
  });

  it('creates an account with tenant-scoped inserts', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'type-1' }])
      .mockResolvedValueOnce([{ id: 'group-1' }])
      .mockResolvedValueOnce([{ id: 'parent-1' }])
      .mockResolvedValueOnce([{ id: 'branch-1' }])
      .mockResolvedValueOnce([]);

    await ErpLiteCoaService.createAccount({
      account_code: '1100',
      name: 'Petty Cash',
      acc_type_id: 'type-1',
      acc_group_id: 'group-1',
      parent_account_id: 'parent-1',
      branch_id: 'branch-1',
      description: 'Front desk petty cash',
      is_postable: true,
    });

    const insertQuery = mockQueryRaw.mock.calls[4]?.[0];
    expect(insertQuery?.values).toContain('tenant-123');
    expect(insertQuery?.values).toContain('1100');
    expect(insertQuery?.values).toContain('Petty Cash');
  });
});
