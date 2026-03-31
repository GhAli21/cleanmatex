import { ErpLitePostingEngineService } from '@/lib/services/erp-lite-posting-engine.service';
import {
  ERP_LITE_ATTEMPT_STATUSES,
  ERP_LITE_EXCEPTION_TYPES,
  ERP_LITE_LOG_STATUSES,
  ERP_LITE_POSTING_MODES,
} from '@/lib/constants/erp-lite-posting';

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockTransaction = jest.fn();
const mockTxExecuteRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ErpLitePostingEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: { $executeRaw: typeof mockTxExecuteRaw }) => Promise<unknown>) =>
      fn({ $executeRaw: mockTxExecuteRaw })
    );
  });

  it('previews a valid posting request using published governance and tenant mappings', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ next_attempt: 1 }])
      .mockResolvedValueOnce([
        {
          pkg_id: 'pkg-1',
          pkg_code: 'ERP_LITE_V1_CORE',
          pkg_version_no: 1,
          compat_version: 'erp_lite_runtime_v1',
          rule_id: 'rule-1',
          rule_code: 'ORDER_INVOICED_V1',
          rule_version_no: 1,
          priority_no: 10,
          condition_json: {},
          is_fallback: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          line_no: 10,
          entry_side: 'DR',
          usage_code_id: 'usage-ar',
          usage_code: 'ACCOUNTS_RECEIVABLE',
          resolver_id: null,
          resolver_code: null,
          amount_source_code: 'GROSS_AMOUNT',
          line_type_code: 'MAIN',
          condition_json: {},
        },
        {
          line_no: 20,
          entry_side: 'CR',
          usage_code_id: 'usage-sales',
          usage_code: 'SALES_REVENUE',
          resolver_id: null,
          resolver_code: null,
          amount_source_code: 'NET_AMOUNT',
          line_type_code: 'MAIN',
          condition_json: {},
        },
        {
          line_no: 30,
          entry_side: 'CR',
          usage_code_id: 'usage-vat',
          usage_code: 'VAT_OUTPUT',
          resolver_id: null,
          resolver_code: null,
          amount_source_code: 'TAX_AMOUNT',
          line_type_code: 'VAT',
          condition_json: { when: 'tax_amount > 0' },
        },
      ])
      .mockResolvedValueOnce([{ period_id: 'period-1', period_code: '2026-03', status_code: 'OPEN' }])
      .mockResolvedValueOnce([
        {
          account_id: 'acct-ar',
          account_code: '1100',
          account_name: 'Accounts Receivable',
          is_active: true,
          is_postable: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          account_id: 'acct-sales',
          account_code: '4100',
          account_name: 'Sales Revenue',
          is_active: true,
          is_postable: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          account_id: 'acct-vat',
          account_code: '2100',
          account_name: 'VAT Output',
          is_active: true,
          is_postable: true,
        },
      ]);

    const result = await ErpLitePostingEngineService.preview({
      txn_event_code: 'ORDER_INVOICED',
      source_module_code: 'orders',
      source_doc_type_code: 'ORDER',
      source_doc_id: '11111111-1111-1111-1111-111111111111',
      source_doc_no: 'ORD-001',
      journal_date: '2026-03-29',
      currency_code: 'OMR',
      amounts: {
        net_amount: 10,
        tax_amount: 1,
        gross_amount: 11,
      },
      meta: {
        created_by: 'tester',
      },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe(ERP_LITE_POSTING_MODES.PREVIEW);
    expect(result.package_code).toBe('ERP_LITE_V1_CORE');
    expect(result.rule_code).toBe('ORDER_INVOICED_V1');
    expect(result.total_debit).toBe(11);
    expect(result.total_credit).toBe(11);
    expect(result.lines).toHaveLength(3);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate execute attempts when a posted idempotency key already exists', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ next_attempt: 2 }])
      .mockResolvedValueOnce([{ id: 'log-posted', journal_id: 'journal-1' }]);

    const result = await ErpLitePostingEngineService.execute({
      txn_event_code: 'ORDER_SETTLED_CASH',
      source_module_code: 'orders',
      source_doc_type_code: 'ORDER',
      source_doc_id: '22222222-2222-2222-2222-222222222222',
      source_doc_no: 'ORD-002',
      journal_date: '2026-03-29',
      currency_code: 'OMR',
      amounts: {
        net_amount: 0,
        tax_amount: 0,
        gross_amount: 25,
      },
      meta: {
        created_by: 'tester',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error_code).toBe(ERP_LITE_EXCEPTION_TYPES.DUPLICATE_POST);
    expect(result.log_status_code).toBe(ERP_LITE_LOG_STATUSES.SKIPPED);
    expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION);
    expect(result.journal_id).toBe('journal-1');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
  });

  it('replays stored payload for retry and executes a fresh attempt', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          request_payload_json: {
            txn_event_code: 'PAYMENT_RECEIVED',
            source_module_code: 'billing',
            source_doc_type_code: 'PAYMENT',
            source_doc_id: '33333333-3333-3333-3333-333333333333',
            source_doc_no: 'PAY-001',
            journal_date: '2026-03-29',
            currency_code: 'OMR',
            amounts: {
              net_amount: 0,
              tax_amount: 0,
              gross_amount: 15,
              discount_amount: 0,
              delivery_fee_amount: 0,
              rounding_amount: 0,
            },
            meta: {
              created_by: 'tester',
              payment_method_code: 'CASH',
            },
          },
          source_doc_id: '33333333-3333-3333-3333-333333333333',
          source_doc_type_code: 'PAYMENT',
          txn_event_code: 'PAYMENT_RECEIVED',
          idempotency_key: 'tenant-123:PAYMENT_RECEIVED:33333333-3333-3333-3333-333333333333:v1',
          attempt_no: 1,
        },
      ])
      .mockResolvedValueOnce([{ next_attempt: 2 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          pkg_id: 'pkg-1',
          pkg_code: 'ERP_LITE_V1_CORE',
          pkg_version_no: 1,
          compat_version: 'erp_lite_runtime_v1',
          rule_id: 'rule-2',
          rule_code: 'PAYMENT_RECEIVED_V1',
          rule_version_no: 1,
          priority_no: 50,
          condition_json: {},
          is_fallback: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          line_no: 10,
          entry_side: 'DR',
          usage_code_id: null,
          usage_code: null,
          resolver_id: 'resolver-1',
          resolver_code: 'PAYMENT_METHOD_MAP',
          amount_source_code: 'GROSS_AMOUNT',
          line_type_code: 'MAIN',
          condition_json: {},
        },
        {
          line_no: 20,
          entry_side: 'CR',
          usage_code_id: 'usage-ar',
          usage_code: 'ACCOUNTS_RECEIVABLE',
          resolver_id: null,
          resolver_code: null,
          amount_source_code: 'GROSS_AMOUNT',
          line_type_code: 'MAIN',
          condition_json: {},
        },
      ])
      .mockResolvedValueOnce([{ period_id: 'period-1', period_code: '2026-03', status_code: 'OPEN' }])
      .mockResolvedValueOnce([
        {
          account_id: 'acct-cash',
          account_code: '1000',
          account_name: 'Cash Main',
          is_active: true,
          is_postable: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          account_id: 'acct-ar',
          account_code: '1100',
          account_name: 'Accounts Receivable',
          is_active: true,
          is_postable: true,
        },
      ]);

    const result = await ErpLitePostingEngineService.retry({ posting_log_id: 'log-1' });

    expect(result.success).toBe(true);
    expect(result.mode).toBe(ERP_LITE_POSTING_MODES.RETRY);
    expect(result.rule_code).toBe('PAYMENT_RECEIVED_V1');
    expect(result.total_debit).toBe(15);
    expect(result.total_credit).toBe(15);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(3);
  });
});
