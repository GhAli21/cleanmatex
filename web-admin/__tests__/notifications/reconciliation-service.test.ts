/** @jest-environment node */
import twilio from 'twilio';
import { reconcileTenantOutbox } from '@lib/notifications/reconciliation-service';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { notificationSettingsService } from '@lib/notifications/settings-service';

jest.mock('twilio', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/notifications/settings-service', () => ({ notificationSettingsService: { getActiveProvider: jest.fn() } }));
// Reused from the live adapter's own classifier so reconciliation never diverges from send-time judgment.
jest.mock('@lib/notifications/whatsapp-customer-eligibility', () => ({ resolveWhatsAppCustomerEligibility: jest.fn() }));
jest.mock('@lib/notifications/log-missing-env', () => ({ collectMissingEnv: jest.fn(() => []), logMissingNotificationEnv: jest.fn() }));
jest.mock('@lib/notifications/config', () => ({
  getTwilioWhatsappFrom: jest.fn(), getTwilioWhatsappSandboxContentSid: jest.fn(), getTwilioWhatsappSandboxToPhone: jest.fn(),
  isNtfDispatchViaHq: jest.fn(), isTwilioWhatsappSandboxTemplateEnabled: jest.fn(), getNtfHqDispatchUrl: jest.fn(),
}));

const baseRow = {
  id: 'outbox-1', tenant_org_id: 'tenant-a', channel_code: 'WHATSAPP', provider_message_id: 'SM-known',
  retry_count: 0, max_retries: 3, reconcile_state: 'ACCEPTANCE_UNCERTAIN', claim_token: 'claim-1',
};

describe('reconcileTenantOutbox', () => {
  let uncertainRows: typeof baseRow[];
  let crashedRows: typeof baseRow[];
  let updates: Array<{ payload: Record<string, unknown>; table: string }>;
  let inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  let filters: Array<[string, string, unknown]>;
  let updateMatches = true;
  const fetchMessage = jest.fn();
  const messagesFn = jest.fn(() => ({ fetch: fetchMessage }));

  beforeEach(() => {
    jest.clearAllMocks();
    uncertainRows = [];
    crashedRows = [];
    updates = [];
    inserts = [];
    filters = [];
    updateMatches = true;
    process.env.TWILIO_ACCOUNT_SID = 'AC-test';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    jest.mocked(twilio).mockReturnValue({ messages: messagesFn } as unknown as ReturnType<typeof twilio>);
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: {} });

    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: (table: string) => {
        // isUpdateMode is independent of select tracking: finalizeStuckRow's update
        // chain calls `.select('id')` again after `.update(...)` to request the
        // affected row back, so `.select()` alone must never erase update mode.
        let isUpdateMode = false;
        let sawUncertainFilter = false;
        let sawCrashedFilter = false;

        const query: Record<string, unknown> = {
          select: jest.fn(() => query),
          eq: jest.fn((field: string, value: unknown) => {
            filters.push([table, field, value]);
            if (field === 'reconcile_state' && value === 'ACCEPTANCE_UNCERTAIN') sawUncertainFilter = true;
            return query;
          }),
          is: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); return query; }),
          not: jest.fn((field: string, _op: string, value: unknown) => { filters.push([table, field, value]); return query; }),
          lt: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); sawCrashedFilter = true; return query; }),
          limit: jest.fn(async () => ({
            data: sawUncertainFilter ? uncertainRows : (sawCrashedFilter ? crashedRows : []),
            error: null,
          })),
          update: jest.fn((payload: Record<string, unknown>) => { isUpdateMode = true; updates.push({ table, payload }); return query; }),
          maybeSingle: jest.fn(async () => (isUpdateMode ? { data: updateMatches ? { id: 'outbox-1' } : null, error: null } : { data: null, error: null })),
          insert: jest.fn(async (payload: Record<string, unknown>) => { inserts.push({ table, payload }); return { error: null }; }),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  });

  it('resolves a stuck ACCEPTANCE_UNCERTAIN row via a real Twilio status lookup (accepted) — never guesses', async () => {
    uncertainRows = [{ ...baseRow }];
    fetchMessage.mockResolvedValue({ status: 'delivered', sid: 'SM-known' });

    const summary = await reconcileTenantOutbox('tenant-a');

    expect(messagesFn).toHaveBeenCalledWith('SM-known');
    expect(summary.results[0]).toMatchObject({ outboxId: 'outbox-1', outcome: 'RESOLVED_SENT' });
    const outboxUpdate = updates.find((u) => u.table === 'org_ntf_outbox_dtl');
    expect(outboxUpdate?.payload).toMatchObject({ status: 'SENT', reconcile_state: null, claim_token: null });
    const receiptInsert = inserts.find((i) => i.table === 'org_ntf_receipts_tr');
    expect(receiptInsert?.payload).toMatchObject({ tenant_org_id: 'tenant-a', receipt_kind: 'DELIVERED', provider_message_id: 'SM-known' });
  });

  it('dead-letters a row with no captured provider_message_id instead of silently retrying or dropping it', async () => {
    uncertainRows = [{ ...baseRow, provider_message_id: null }];

    const summary = await reconcileTenantOutbox('tenant-a');

    expect(messagesFn).not.toHaveBeenCalled();
    expect(summary.results[0]).toMatchObject({ outboxId: 'outbox-1', outcome: 'DEAD_LETTERED' });
    const outboxUpdate = updates.find((u) => u.table === 'org_ntf_outbox_dtl');
    expect(outboxUpdate?.payload.status).toBe('FAILED_PERMANENT');
    expect(String(outboxUpdate?.payload.error_message)).toContain('RECONCILIATION_REQUIRED');
    // Never silently dropped: it is still visible as a logged attempt.
    expect(inserts.some((i) => i.table === 'org_ntf_delivery_log_dtl')).toBe(true);
  });

  it('dead-letters a non-WHATSAPP channel row (no lookup implemented yet)', async () => {
    uncertainRows = [{ ...baseRow, channel_code: 'EMAIL' }];
    const summary = await reconcileTenantOutbox('tenant-a');
    expect(summary.results[0].outcome).toBe('DEAD_LETTERED');
    expect(notificationSettingsService.getActiveProvider).not.toHaveBeenCalled();
  });

  it('treats a Twilio 404 as proof of non-submission and re-queues it for the normal retry path', async () => {
    uncertainRows = [{ ...baseRow }];
    fetchMessage.mockRejectedValue({ status: 404, message: 'The requested resource was not found' });

    const summary = await reconcileTenantOutbox('tenant-a');

    expect(summary.results[0].outcome).toBe('RESOLVED_FAILED_RETRYABLE');
    const outboxUpdate = updates.find((u) => u.table === 'org_ntf_outbox_dtl');
    expect(outboxUpdate?.payload).toMatchObject({ status: 'FAILED_TEMPORARY', retry_count: 1 });
    expect(outboxUpdate?.payload.next_retry_at).toBeTruthy();
  });

  it('defers (leaves untouched) on a transient Twilio lookup error instead of guessing', async () => {
    uncertainRows = [{ ...baseRow }];
    fetchMessage.mockRejectedValue({ message: 'ETIMEDOUT' });

    const summary = await reconcileTenantOutbox('tenant-a');

    expect(summary.results[0].outcome).toBe('DEFERRED');
    expect(updates.find((u) => u.table === 'org_ntf_outbox_dtl')).toBeUndefined();
  });

  it('also inspects crashed PROCESSING rows with an expired lease and no reconcile_state', async () => {
    crashedRows = [{ ...baseRow, reconcile_state: null, provider_message_id: null }];
    const summary = await reconcileTenantOutbox('tenant-a');
    expect(summary.inspected).toBe(1);
    expect(summary.results[0].outcome).toBe('DEAD_LETTERED');
  });

  it('filters every outbox read by the exact tenant_org_id passed in', async () => {
    uncertainRows = [{ ...baseRow }];
    fetchMessage.mockResolvedValue({ status: 'sent', sid: 'SM-known' });
    await reconcileTenantOutbox('tenant-a');
    const tenantFilters = filters.filter(([table, field]) => table === 'org_ntf_outbox_dtl' && field === 'tenant_org_id');
    expect(tenantFilters.length).toBeGreaterThan(0);
    expect(tenantFilters.every(([, , value]) => value === 'tenant-a')).toBe(true);
  });

  it('skips finalizing when the claim was already taken by another worker/run (stale-claim guard)', async () => {
    uncertainRows = [{ ...baseRow }];
    updateMatches = false;
    fetchMessage.mockResolvedValue({ status: 'delivered', sid: 'SM-known' });
    const summary = await reconcileTenantOutbox('tenant-a');
    expect(summary.results[0].outcome).toBe('SKIPPED_STALE_CLAIM');
  });
});
