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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ACCOUNT_ROW = {
  id: 'acct-1',
  account_code: '100000',
  account_name: 'Cash',
  account_level: 1,
  account_type_name: 'Asset',
  account_group_name: 'Current Assets',
  parent_account_code: null,
  parent_account_name: null,
  branch_name: null,
  is_postable: true,
  is_control_account: false,
  is_system_linked: false,
  is_system_seeded: true,
  is_locked: true,
  manual_post_allowed: true,
  allow_tenant_children: false,
  is_active: true,
};

describe('ErpLiteCoaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getDashboardSnapshot — no longer contains account_list
  // -------------------------------------------------------------------------

  describe('getDashboardSnapshot()', () => {
    it('returns option collections without an account_list field', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ id: 'type-1', code: 'ASSET', name: 'Asset', name2: 'أصل' }])
        .mockResolvedValueOnce([{ id: 'group-1', code: 'CUR_ASSET', name: 'Current Assets', name2: 'أصول متداولة' }])
        .mockResolvedValueOnce([{ id: 'acct-2', code: '110000', name: 'Current Assets', name2: 'أصول متداولة' }])
        .mockResolvedValueOnce([{ id: 'branch-1', code: 'BR1', name: 'Main', name2: 'الرئيسي' }]);

      const snapshot = await ErpLiteCoaService.getDashboardSnapshot('en');

      expect(snapshot.account_type_options).toEqual([{ id: 'type-1', label: 'ASSET · Asset' }]);
      expect(snapshot.account_group_options).toEqual([{ id: 'group-1', label: 'CUR_ASSET · Current Assets' }]);
      expect(snapshot.parent_account_options).toEqual([{ id: 'acct-2', label: '110000 · Current Assets' }]);
      expect(snapshot.branch_options).toEqual([{ id: 'branch-1', label: 'BR1 · Main' }]);
      // account_list is no longer part of the snapshot — pagination is separate
      expect((snapshot as Record<string, unknown>).account_list).toBeUndefined();
    });

    it('uses name2 for Arabic locale in option labels', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ id: 'type-1', code: 'ASSET', name: 'Asset', name2: 'أصل' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const snapshot = await ErpLiteCoaService.getDashboardSnapshot('ar');

      // AR locale: label should use name2 when available
      expect(snapshot.account_type_options[0].label).toBe('ASSET · أصل');
    });
  });

  // -------------------------------------------------------------------------
  // getAccountPage — paginated account list
  // -------------------------------------------------------------------------

  describe('getAccountPage()', () => {
    it('returns a paginated result with total, page, and pageSize', async () => {
      const rowWithCount = { ...ACCOUNT_ROW, total_count: BigInt(42) };
      mockQueryRaw.mockResolvedValueOnce([rowWithCount]);

      const result = await ErpLiteCoaService.getAccountPage('en', 1, 20);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(42);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].account_code).toBe('100000');
      // total_count must be stripped from the returned row items
      expect((result.rows[0] as Record<string, unknown>).total_count).toBeUndefined();
    });

    it('returns empty rows with total 0 when no accounts exist', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      const result = await ErpLiteCoaService.getAccountPage('en', 1, 50);

      expect(result.total).toBe(0);
      expect(result.rows).toHaveLength(0);
    });

    it('clamps pageSize to the allowed range [10, 200]', async () => {
      // pageSize 5 should be clamped to 10 — seed one call
      mockQueryRaw.mockResolvedValueOnce([]);

      const result = await ErpLiteCoaService.getAccountPage('en', 1, 5);

      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // createAccount
  // -------------------------------------------------------------------------

  describe('createAccount()', () => {
    it('inserts an account at the correct level under an allowed parent', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([
          {
            id: 'parent-1',
            account_code: '111000',
            account_level: 3,
            is_postable: false,
            is_system_seeded: true,
            allow_tenant_children: true,
          },
        ])
        .mockResolvedValueOnce([{ id: 'type-1' }])
        .mockResolvedValueOnce([{ id: 'group-1' }])
        .mockResolvedValueOnce([{ id: 'branch-1' }])
        .mockResolvedValueOnce([]);

      await ErpLiteCoaService.createAccount({
        account_code: '111001',
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
      expect(insertQuery?.values).toContain('111001');
      expect(insertQuery?.values).toContain('Petty Cash');
      expect(insertQuery?.values).toContain(4); // level = parent level + 1
    });

    it('rejects child creation when the governed parent disallows tenant children', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: 'parent-1',
          account_code: '111000',
          account_level: 3,
          is_postable: false,
          is_system_seeded: true,
          allow_tenant_children: false,
        },
      ]);

      await expect(
        ErpLiteCoaService.createAccount({
          account_code: '111001',
          name: 'Restricted Child',
          acc_type_id: 'type-1',
          acc_group_id: 'group-1',
          parent_account_id: 'parent-1',
        })
      ).rejects.toThrow('Selected parent account is governed and does not allow tenant child accounts');
    });

    it('rejects non-6-digit account codes', async () => {
      await expect(
        ErpLiteCoaService.createAccount({
          account_code: '1100',
          name: 'Short Code',
          acc_type_id: 'type-1',
        })
      ).rejects.toThrow('Account code must be a 6-digit numeric code');
    });
  });
});
