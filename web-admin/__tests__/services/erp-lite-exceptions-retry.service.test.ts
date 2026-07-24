/**
 * B19 — ErpLiteExceptionsService.retryException() unit tests.
 */

const mockExecuteRaw = jest.fn();
const mockRetry = jest.fn();

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a) },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-xyz'),
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/erp-lite-feature-guard', () => ({
  assertErpLiteEnabledForTenant: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ userId: 'user-1' }),
}));

jest.mock('@/lib/services/erp-lite-posting-engine.service', () => ({
  ErpLitePostingEngineService: { retry: (...a: unknown[]) => mockRetry(...a) },
}));

import { ErpLiteExceptionsService } from '@/lib/services/erp-lite-exceptions.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
});

describe('ErpLiteExceptionsService.retryException', () => {
  it('on success, marks the exception RETRIED and returns success:true', async () => {
    mockRetry.mockResolvedValue({ success: true });

    const result = await ErpLiteExceptionsService.retryException('exc-1', 'log-1');

    expect(result.success).toBe(true);
    expect(mockRetry).toHaveBeenCalledWith({ posting_log_id: 'log-1', tenant_org_id: 'tenant-xyz' });
    // Two $executeRaw calls: the status UPDATE + the audit-trail INSERT.
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
  });

  it('on failure, leaves the exception status untouched and returns the error', async () => {
    mockRetry.mockResolvedValue({ success: false, error_message: 'ACCOUNT_NOT_FOUND' });

    const result = await ErpLiteExceptionsService.retryException('exc-1', 'log-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('ACCOUNT_NOT_FOUND');
    // Only the audit-trail INSERT — no status UPDATE on failure.
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });
});
