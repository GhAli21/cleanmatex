/**
 * B19 — finance-jobs.service.ts unit tests.
 *
 * Covers: gift-card expiry sweep (per-tenant loop, one tenant's failure
 * doesn't block the rest), idempotency-key cleanup (SQL function call),
 * ERP posting-retry (eligible-exceptions loop, success marks RETRIED,
 * failure leaves the exception open), and the runFinanceJob() wrapper's
 * run-log lifecycle (RUNNING -> SUCCESS/FAILED, always finalized).
 */

const mockTenantsFindMany = jest.fn();
const mockRunLogCreate = jest.fn();
const mockRunLogUpdate = jest.fn();
const mockRunLogUpdateMany = jest.fn();
const mockRunLogFindFirst = jest.fn();
const mockRunLogFindMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockExpireGiftCards = jest.fn();
const mockExpireCreditNotes = jest.fn();
const mockProcessOutboxBatch = jest.fn();
const mockRetry = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tenants_mst: { findMany: (...a: unknown[]) => mockTenantsFindMany(...a) },
    sys_fin_job_run_log: {
      create: (...a: unknown[]) => mockRunLogCreate(...a),
      update: (...a: unknown[]) => mockRunLogUpdate(...a),
      updateMany: (...a: unknown[]) => mockRunLogUpdateMany(...a),
      findFirst: (...a: unknown[]) => mockRunLogFindFirst(...a),
      findMany: (...a: unknown[]) => mockRunLogFindMany(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  expireGiftCards: (...a: unknown[]) => mockExpireGiftCards(...a),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  expireCreditNotes: (...a: unknown[]) => mockExpireCreditNotes(...a),
}));

jest.mock('@/lib/services/outbox-processor.service', () => ({
  processOutboxBatch: (...a: unknown[]) => mockProcessOutboxBatch(...a),
}));

jest.mock('@/lib/services/erp-lite-posting-engine.service', () => ({
  ErpLitePostingEngineService: { retry: (...a: unknown[]) => mockRetry(...a) },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: (...a: unknown[]) => mockLoggerError(...a), warn: jest.fn(), info: jest.fn() },
}));

import {
  runFinanceJob,
  listFinanceJobsLastRun,
  listFinanceJobRuns,
  nextCronOccurrence,
  FINANCE_JOB_CODES,
} from '@/lib/services/finance-jobs.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockRunLogCreate.mockResolvedValue({ id: 'run-1' });
  mockRunLogUpdate.mockResolvedValue({});
  mockRunLogUpdateMany.mockResolvedValue({ count: 0 });
  mockRunLogFindFirst.mockResolvedValue(null);
  mockRunLogFindMany.mockResolvedValue([]);
  mockQueryRaw.mockRejectedValue(new Error('fin_list_job_schedules missing'));
});

describe('runFinanceJob — gift_card_expiry', () => {
  it('loops every active tenant and aggregates expired/failed counts', async () => {
    mockTenantsFindMany.mockResolvedValue([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
    mockExpireGiftCards
      .mockResolvedValueOnce({ expiredCount: 3, failedCount: 0 })
      .mockResolvedValueOnce({ expiredCount: 1, failedCount: 1 });

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY, triggerSource: 'SCHEDULE' });

    expect(result.status).toBe('SUCCESS');
    expect(result.processedCount).toBe(4);
    expect(result.failedCount).toBe(1);
    expect(mockExpireGiftCards).toHaveBeenCalledWith('tenant-a');
    expect(mockExpireGiftCards).toHaveBeenCalledWith('tenant-b');
  });

  it('one tenant throwing never blocks the rest', async () => {
    mockTenantsFindMany.mockResolvedValue([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
    mockExpireGiftCards
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ expiredCount: 2, failedCount: 0 });

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY, triggerSource: 'SCHEDULE' });

    expect(result.status).toBe('SUCCESS');
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });
});

describe('runFinanceJob — idempotency_cleanup', () => {
  it('calls the cleanup_expired_idempotency_keys() SQL function and returns its deleted count', async () => {
    mockQueryRaw.mockResolvedValue([{ cleanup_expired_idempotency_keys: 17 }]);

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.IDEMPOTENCY_CLEANUP, triggerSource: 'MANUAL', triggeredBy: 'user-1' });

    expect(result.status).toBe('SUCCESS');
    expect(result.processedCount).toBe(17);
    expect(result.failedCount).toBe(0);
    expect(mockRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trigger_source: 'MANUAL', triggered_by: 'user-1' }) }),
    );
  });
});

describe('runFinanceJob — erp_posting_retry', () => {
  it('retries each eligible exception and marks a success RETRIED', async () => {
    mockQueryRaw.mockResolvedValue([
      { exception_id: 'exc-1', tenant_org_id: 'tenant-a', posting_log_id: 'log-1' },
      { exception_id: 'exc-2', tenant_org_id: 'tenant-a', posting_log_id: 'log-2' },
    ]);
    mockRetry
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error_message: 'still broken' });
    mockExecuteRaw.mockResolvedValue(undefined);

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.ERP_POSTING_RETRY, triggerSource: 'SCHEDULE' });

    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockRetry).toHaveBeenCalledWith({ posting_log_id: 'log-1', tenant_org_id: 'tenant-a' });
  });

  it('a thrown retry never blocks the remaining exceptions', async () => {
    mockQueryRaw.mockResolvedValue([
      { exception_id: 'exc-1', tenant_org_id: 'tenant-a', posting_log_id: 'log-1' },
      { exception_id: 'exc-2', tenant_org_id: 'tenant-a', posting_log_id: 'log-2' },
    ]);
    mockRetry.mockRejectedValueOnce(new Error('crash')).mockResolvedValueOnce({ success: true });
    mockExecuteRaw.mockResolvedValue(undefined);

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.ERP_POSTING_RETRY, triggerSource: 'SCHEDULE' });

    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});

describe('runFinanceJob — run-log lifecycle', () => {
  it('creates a RUNNING row before executing, then finalizes SUCCESS', async () => {
    mockTenantsFindMany.mockResolvedValue([]);

    await runFinanceJob({ jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY, triggerSource: 'SCHEDULE' });

    expect(mockRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RUNNING' }) }),
    );
    expect(mockRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'SUCCESS', processed_count: 0, failed_count: 0 }),
      }),
    );
  });

  it('a job that throws still finalizes the run as FAILED (never left stuck RUNNING)', async () => {
    mockTenantsFindMany.mockRejectedValue(new Error('db down'));

    const result = await runFinanceJob({ jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY, triggerSource: 'SCHEDULE' });

    expect(result.status).toBe('FAILED');
    expect(mockRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error_message: 'db down' }) }),
    );
    expect(mockLoggerError).toHaveBeenCalled();
  });
});

describe('listFinanceJobsLastRun', () => {
  it('returns the most recent run per registered job code, null when never run', async () => {
    mockRunLogFindFirst
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'SUCCESS',
        trigger_source: 'SCHEDULE',
        processed_count: 5,
        failed_count: 0,
        error_message: null,
        started_at: new Date('2026-07-24T02:00:00Z'),
        finished_at: new Date('2026-07-24T02:00:05Z'),
      })
      .mockResolvedValue(null);

    const result = await listFinanceJobsLastRun();

    expect(result).toHaveLength(5);
    expect(result[0].jobCode).toBe(FINANCE_JOB_CODES.OUTBOX_PROCESSOR);
    expect(result[0].lastRun?.status).toBe('SUCCESS');
    expect(result[1].jobCode).toBe(FINANCE_JOB_CODES.GIFT_CARD_EXPIRY);
    expect(result[1].lastRun).toBeNull();
  });
});

describe('runFinanceJob — outbox_processor', () => {
  it('maps processOutboxBatch counts into processed/failed and prunes idle ticks', async () => {
    mockProcessOutboxBatch.mockResolvedValue({
      claimed: 3,
      processed: 2,
      skipped: 1,
      failed: 0,
      deadLettered: 0,
    });
    mockExecuteRaw.mockResolvedValue(1);

    const result = await runFinanceJob({
      jobCode: FINANCE_JOB_CODES.OUTBOX_PROCESSOR,
      triggerSource: 'SCHEDULE',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.processedCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(mockExecuteRaw).toHaveBeenCalled();
  });
});

describe('runFinanceJob — credit_note_expiry', () => {
  it('loops every active tenant and aggregates expired/failed counts', async () => {
    mockTenantsFindMany.mockResolvedValue([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
    mockExpireCreditNotes
      .mockResolvedValueOnce({ expiredCount: 2, failedCount: 0 })
      .mockResolvedValueOnce({ expiredCount: 0, failedCount: 1 });

    const result = await runFinanceJob({
      jobCode: FINANCE_JOB_CODES.CREDIT_NOTE_EXPIRY,
      triggerSource: 'SCHEDULE',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(mockExpireCreditNotes).toHaveBeenCalledWith('tenant-a');
    expect(mockExpireCreditNotes).toHaveBeenCalledWith('tenant-b');
  });
});

describe('runFinanceJob — overlap', () => {
  it('throws JOB_ALREADY_RUNNING for a MANUAL trigger when a run is in flight', async () => {
    mockRunLogFindFirst.mockResolvedValue({
      id: 'run-live',
      started_at: new Date('2026-09-17T01:00:00Z'),
    });

    await expect(
      runFinanceJob({ jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY, triggerSource: 'MANUAL', triggeredBy: 'user-1' }),
    ).rejects.toThrow('JOB_ALREADY_RUNNING');
    expect(mockRunLogCreate).not.toHaveBeenCalled();
  });

  it('skips a SCHEDULE trigger when a run is in flight so cron does not storm', async () => {
    mockRunLogFindFirst.mockResolvedValue({
      id: 'run-live',
      started_at: new Date('2026-09-17T01:00:00Z'),
    });

    const result = await runFinanceJob({
      jobCode: FINANCE_JOB_CODES.OUTBOX_PROCESSOR,
      triggerSource: 'SCHEDULE',
    });

    expect(result.skippedBecauseRunning).toBe(true);
    expect(result.status).toBe('SUCCESS');
    expect(mockProcessOutboxBatch).not.toHaveBeenCalled();
  });
});

describe('listFinanceJobRuns', () => {
  it('returns mapped history rows newest first', async () => {
    mockRunLogFindMany.mockResolvedValue([
      {
        id: 'run-2',
        status: 'FAILED',
        trigger_source: 'MANUAL',
        processed_count: 0,
        failed_count: 0,
        error_message: 'boom',
        started_at: new Date('2026-09-17T03:00:00Z'),
        finished_at: new Date('2026-09-17T03:00:02Z'),
      },
    ]);

    const rows = await listFinanceJobRuns(FINANCE_JOB_CODES.IDEMPOTENCY_CLEANUP, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('FAILED');
    expect(rows[0].durationMs).toBe(2000);
  });
});

describe('nextCronOccurrence', () => {
  it('returns the next UTC minute for * * * * *', () => {
    const from = new Date('2026-09-17T10:15:30.000Z');
    const next = nextCronOccurrence('* * * * *', from);
    expect(next?.toISOString()).toBe('2026-09-17T10:16:00.000Z');
  });

  it('returns the next daily 02:00 UTC slot', () => {
    const from = new Date('2026-09-17T01:30:00.000Z');
    const next = nextCronOccurrence('0 2 * * *', from);
    expect(next?.toISOString()).toBe('2026-09-17T02:00:00.000Z');
  });
});
