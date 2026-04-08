import { ErpLitePostingEngineService } from '@/lib/services/erp-lite-posting-engine.service';
import {
  ERP_LITE_ATTEMPT_STATUSES,
  ERP_LITE_ERROR_CODES,
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
const mockTxQueryRaw = jest.fn();
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_REQUEST = {
  txn_event_code: 'ORDER_INVOICED',
  source_module_code: 'orders',
  source_doc_type_code: 'ORDER',
  source_doc_id: '11111111-1111-1111-1111-111111111111',
  source_doc_no: 'ORD-001',
  journal_date: '2026-03-29',
  currency_code: 'OMR',
  amounts: { net_amount: 10, tax_amount: 1, gross_amount: 11 },
  meta: { created_by: 'tester' },
} as const;

const RULE_ROW = {
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
  stop_on_match: false,
};

/** Two balanced lines: DR ACCOUNTS_RECEIVABLE 11, CR SALES_REVENUE 11 */
const BALANCED_LINES = [
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
    amount_source_code: 'GROSS_AMOUNT',
    line_type_code: 'MAIN',
    condition_json: {},
  },
];

const OPEN_PERIOD = [{ period_id: 'period-1', period_code: '2026-03', status_code: 'OPEN' }];

const ACTIVE_AR_ACCOUNT = {
  account_id: 'acct-ar',
  account_code: '1100',
  account_name: 'Accounts Receivable',
  is_active: true,
  is_postable: true,
  acc_type_id: 'type-asset',
  required_acc_type_id: null,
};

const ACTIVE_SALES_ACCOUNT = {
  account_id: 'acct-sales',
  account_code: '4100',
  account_name: 'Sales Revenue',
  is_active: true,
  is_postable: true,
  acc_type_id: 'type-revenue',
  required_acc_type_id: null,
};

const NO_DUPLICATE = []; // empty = no existing posted log

/**
 * Seed $queryRaw for a successful execute() path.
 *
 * Call order for execute():
 *   [0] getNextAttemptNo
 *   [1] findExistingPostedLog  → NO_DUPLICATE
 *   [2] loadGovernance rules
 *   [3] loadGovernance lines
 *   [4] loadOpenPeriod
 *   [5] findMappedAccount (AR, global-scoped, branch_id=null)
 *   [6] findMappedAccount (SALES, global-scoped)
 * Then inside the tx:
 *   tx.$queryRaw[0] nextFinDocNo
 *   tx.$executeRaw  insertPostingLog, insertJournal, insertJournalLines, updatePostingLog
 */
function seedExecuteSuccess() {
  mockQueryRaw
    .mockResolvedValueOnce([{ next_attempt: 1 }])
    .mockResolvedValueOnce(NO_DUPLICATE)
    .mockResolvedValueOnce([RULE_ROW])
    .mockResolvedValueOnce(BALANCED_LINES)
    .mockResolvedValueOnce(OPEN_PERIOD)
    .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT])
    .mockResolvedValueOnce([ACTIVE_SALES_ACCOUNT]);
  // inside transaction: journal number
  mockTxQueryRaw.mockResolvedValueOnce([{ doc_no: 'JNL-20260329-0001' }]);
  mockTxExecuteRaw.mockResolvedValue(1);
}

/**
 * Seed $queryRaw for a successful preview() path.
 *
 * Call order for preview():
 *   [0] getNextAttemptNo
 *   [1] loadGovernance rules
 *   [2] loadGovernance lines
 *   [3] loadOpenPeriod
 *   [4] findMappedAccount (AR)
 *   [5] findMappedAccount (SALES)
 * Then: insertPostingLog via prisma.$executeRaw
 */
function seedPreviewSuccess() {
  mockQueryRaw
    .mockResolvedValueOnce([{ next_attempt: 1 }])
    .mockResolvedValueOnce([RULE_ROW])
    .mockResolvedValueOnce(BALANCED_LINES)
    .mockResolvedValueOnce(OPEN_PERIOD)
    .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT])
    .mockResolvedValueOnce([ACTIVE_SALES_ACCOUNT]);
  mockExecuteRaw.mockResolvedValue(1);
}

describe('ErpLitePostingEngineService', () => {
  beforeEach(() => {
    // resetAllMocks clears both calls AND the mockResolvedValueOnce queue,
    // preventing leftover mocks from leaking between tests.
    jest.resetAllMocks();

    // Re-establish mocks that resetAllMocks cleared from the jest.mock() factory.
    // These are module-level mocks whose implementations are set in the factory,
    // but resetAllMocks removes their return values/implementations.
    const { getTenantIdFromSession, withTenantContext } =
      jest.requireMock('@/lib/db/tenant-context') as {
        getTenantIdFromSession: jest.Mock;
        withTenantContext: jest.Mock;
      };
    getTenantIdFromSession.mockResolvedValue('tenant-123');
    withTenantContext.mockImplementation(
      async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) => fn('tenant-123')
    );

    // Transaction mock provides both $queryRaw and $executeRaw so
    // persistJournal (nextFinDocNo → tx.$queryRaw) works correctly.
    mockTransaction.mockImplementation(
      async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw; $executeRaw: typeof mockTxExecuteRaw }) => Promise<unknown>) =>
        fn({ $queryRaw: mockTxQueryRaw, $executeRaw: mockTxExecuteRaw })
    );
    // Default: all writes succeed
    mockExecuteRaw.mockResolvedValue(1);
  });

  // -------------------------------------------------------------------------
  // preview() — happy path
  // -------------------------------------------------------------------------

  describe('preview()', () => {
    it('returns a balanced preview result for a valid ORDER_INVOICED request', async () => {
      seedPreviewSuccess();

      const result = await ErpLitePostingEngineService.preview(BASE_REQUEST);

      expect(result.success).toBe(true);
      expect(result.mode).toBe(ERP_LITE_POSTING_MODES.PREVIEW);
      expect(result.package_code).toBe('ERP_LITE_V1_CORE');
      expect(result.rule_code).toBe('ORDER_INVOICED_V1');
      expect(result.total_debit).toBe(11);
      expect(result.total_credit).toBe(11);
      expect(result.lines).toHaveLength(2);
    });

    it('throws REQUEST_MISSING_SOURCE_METADATA when required source metadata fields are empty', async () => {
      // normalizeRequest throws synchronously inside buildEnvelope.
      // buildEnvelope is called OUTSIDE the try/catch in preview(), so the error
      // propagates uncaught — callers receive a rejected promise.
      await expect(
        ErpLitePostingEngineService.preview({
          ...BASE_REQUEST,
          txn_event_code: '' as never,
        })
      ).rejects.toMatchObject({
        code: ERP_LITE_ERROR_CODES.REQUEST_MISSING_SOURCE_METADATA,
      });
    });

    it('throws REQUEST_MISSING_CURRENCY_OR_DATE when currency or journal_date is empty', async () => {
      await expect(
        ErpLitePostingEngineService.preview({
          ...BASE_REQUEST,
          currency_code: '' as never,
        })
      ).rejects.toMatchObject({
        code: ERP_LITE_ERROR_CODES.REQUEST_MISSING_CURRENCY_OR_DATE,
      });
    });
  });

  // -------------------------------------------------------------------------
  // execute() — happy path
  // -------------------------------------------------------------------------

  describe('execute()', () => {
    it('posts a journal atomically and returns POSTED status', async () => {
      seedExecuteSuccess();

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(true);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.POSTED);
      expect(result.log_status_code).toBe(ERP_LITE_LOG_STATUSES.POSTED);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency — duplicate block
  // -------------------------------------------------------------------------

  describe('duplicate detection', () => {
    it('blocks duplicate execute when a posted log already exists for the idempotency key', async () => {
      // [0] attempt counter, [1] duplicate check returns existing row
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 2 }])
        .mockResolvedValueOnce([{ id: 'log-posted', journal_id: 'journal-1' }]);

      const result = await ErpLitePostingEngineService.execute({
        ...BASE_REQUEST,
        source_doc_id: '22222222-2222-2222-2222-222222222222',
        source_doc_no: 'ORD-002',
        txn_event_code: 'ORDER_SETTLED_CASH',
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.DUPLICATE_POST);
      expect(result.log_status_code).toBe(ERP_LITE_LOG_STATUSES.SKIPPED);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION);
      expect(result.journal_id).toBe('journal-1');
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Governance failure paths
  // -------------------------------------------------------------------------

  describe('governance resolution failures', () => {
    it('returns GOV_RULE_NOT_FOUND when no published rule exists for the event', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])  // attempt counter
        .mockResolvedValueOnce(NO_DUPLICATE)            // duplicate check
        .mockResolvedValueOnce([]);                     // governance → empty

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.GOV_RULE_NOT_FOUND);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_RULE);
    });

    it('returns GOV_AMBIGUOUS_RULE when two equally-ranked non-fallback rules tie', async () => {
      const tiedRuleA = { ...RULE_ROW, rule_id: 'rule-a', rule_code: 'RULE_A', is_fallback: false };
      const tiedRuleB = { ...RULE_ROW, rule_id: 'rule-b', rule_code: 'RULE_B', is_fallback: false };

      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([tiedRuleA, tiedRuleB]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.GOV_AMBIGUOUS_RULE);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_RULE);
    });
  });

  // -------------------------------------------------------------------------
  // Period failure
  // -------------------------------------------------------------------------

  describe('period validation', () => {
    it('returns PERIOD_CLOSED when no open period covers the posting date', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce([]); // period → empty

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.PERIOD_CLOSED);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION);
    });
  });

  // -------------------------------------------------------------------------
  // Account / usage mapping failure paths
  // -------------------------------------------------------------------------

  describe('account resolution failures', () => {
    it('returns USAGE_MAPPING_NOT_FOUND when no active mapping exists for a usage code', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([]); // AR mapping → not found (global scope)

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.USAGE_MAPPING_NOT_FOUND);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT);
    });

    it('returns ACCOUNT_INACTIVE when the mapped account is inactive', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([{ ...ACTIVE_AR_ACCOUNT, is_active: false }]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.ACCOUNT_INACTIVE);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT);
    });

    it('returns ACCOUNT_NOT_POSTABLE when the mapped account is not postable', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([{ ...ACTIVE_AR_ACCOUNT, is_postable: false }]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.ACCOUNT_NOT_POSTABLE);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT);
    });

    it('returns ACCOUNT_TYPE_MISMATCH when account type does not satisfy the usage code constraint (PB-C2)', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([
          {
            ...ACTIVE_AR_ACCOUNT,
            acc_type_id: 'type-liability',
            required_acc_type_id: 'type-asset', // constraint mismatch
          },
        ]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.ACCOUNT_TYPE_MISMATCH);
      expect(result.attempt_status_code).toBe(ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT);
    });
  });

  // -------------------------------------------------------------------------
  // Entry side validation (PB-C3)
  // -------------------------------------------------------------------------

  describe('entry_side validation (PB-C3)', () => {
    it('returns RULE_INVALID_ENTRY_SIDE for an unrecognised entry_side — never silently defaults to CREDIT', async () => {
      const badSideLine = { ...BALANCED_LINES[0], entry_side: 'UNKNOWN' };

      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce([badSideLine, BALANCED_LINES[1]])
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT])
        .mockResolvedValueOnce([ACTIVE_SALES_ACCOUNT]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.RULE_INVALID_ENTRY_SIDE);
    });
  });

  // -------------------------------------------------------------------------
  // Journal balance (JOURNAL_UNBALANCED)
  // -------------------------------------------------------------------------

  describe('journal balance validation', () => {
    it('returns JOURNAL_UNBALANCED when debit total does not equal credit total', async () => {
      // DR line uses GROSS_AMOUNT (11), CR line uses NET_AMOUNT (10) → imbalanced
      const unbalancedLines = [
        { ...BALANCED_LINES[0], amount_source_code: 'GROSS_AMOUNT' }, // DR 11
        { ...BALANCED_LINES[1], amount_source_code: 'NET_AMOUNT' },   // CR 10
      ];

      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([RULE_ROW])
        .mockResolvedValueOnce(unbalancedLines)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT])
        .mockResolvedValueOnce([ACTIVE_SALES_ACCOUNT]);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ERP_LITE_ERROR_CODES.JOURNAL_UNBALANCED);
    });
  });

  // -------------------------------------------------------------------------
  // Retry — replays stored payload
  // -------------------------------------------------------------------------

  describe('retry()', () => {
    it('replays stored payload and succeeds on a fresh attempt', async () => {
      // retry() call order:
      // [0] loadStoredPostingLog   (prisma.$queryRaw)
      // [1] getNextAttemptNo       (prisma.$queryRaw)
      // [2] findExistingPostedLog  (prisma.$queryRaw)
      // [3] loadGovernance rules   (prisma.$queryRaw)
      // [4] loadGovernance lines   (prisma.$queryRaw)
      // [5] loadOpenPeriod         (prisma.$queryRaw)
      // [6] findMappedAccount cash (prisma.$queryRaw — PAYMENT_METHOD_MAP resolver)
      // [7] findMappedAccount AR   (prisma.$queryRaw)
      // tx: nextFinDocNo           (tx.$queryRaw)
      // tx: insert log/journal/... (tx.$executeRaw)

      const CASH_ACCOUNT = {
        account_id: 'acct-cash',
        account_code: '1000',
        account_name: 'Cash Main',
        is_active: true,
        is_postable: true,
        acc_type_id: 'type-asset',
        required_acc_type_id: null,
      };

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
              amounts: { net_amount: 0, tax_amount: 0, gross_amount: 15, discount_amount: 0, delivery_fee_amount: 0, rounding_amount: 0 },
              meta: { created_by: 'tester', payment_method_code: 'CASH' },
            },
            source_doc_id: '33333333-3333-3333-3333-333333333333',
            source_doc_type_code: 'PAYMENT',
            txn_event_code: 'PAYMENT_RECEIVED',
            idempotency_key: 'tenant-123:PAYMENT_RECEIVED:33333333-3333-3333-3333-333333333333:v1',
            attempt_no: 1,
          },
        ])
        .mockResolvedValueOnce([{ next_attempt: 2 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([{ ...RULE_ROW, rule_id: 'rule-2', rule_code: 'PAYMENT_RECEIVED_V1', priority_no: 50 }])
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
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([CASH_ACCOUNT])
        .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT]);

      mockTxQueryRaw.mockResolvedValueOnce([{ doc_no: 'JNL-20260329-0002' }]);
      mockTxExecuteRaw.mockResolvedValue(1);

      const result = await ErpLitePostingEngineService.retry({ posting_log_id: 'log-1' });

      expect(result.success).toBe(true);
      expect(result.mode).toBe(ERP_LITE_POSTING_MODES.RETRY);
      expect(result.rule_code).toBe('PAYMENT_RECEIVED_V1');
      expect(result.total_debit).toBe(15);
      expect(result.total_credit).toBe(15);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Fallback rule semantics (PB-H3)
  // -------------------------------------------------------------------------

  describe('fallback rule semantics (PB-H3)', () => {
    it('prefers a non-fallback rule over a fallback rule regardless of priority_no ordering', async () => {
      // fallback has lower priority_no (higher precedence by number) but is_fallback=true
      // specific has higher priority_no but is_fallback=false → must win
      const fallbackRule = { ...RULE_ROW, rule_id: 'rule-fallback', rule_code: 'FALLBACK', priority_no: 5, is_fallback: true };
      const specificRule = { ...RULE_ROW, rule_id: 'rule-specific', rule_code: 'SPECIFIC', priority_no: 50, is_fallback: false };

      mockQueryRaw
        .mockResolvedValueOnce([{ next_attempt: 1 }])
        .mockResolvedValueOnce(NO_DUPLICATE)
        .mockResolvedValueOnce([fallbackRule, specificRule])
        .mockResolvedValueOnce(BALANCED_LINES)
        .mockResolvedValueOnce(OPEN_PERIOD)
        .mockResolvedValueOnce([ACTIVE_AR_ACCOUNT])
        .mockResolvedValueOnce([ACTIVE_SALES_ACCOUNT]);

      mockTxQueryRaw.mockResolvedValueOnce([{ doc_no: 'JNL-20260329-0003' }]);
      mockTxExecuteRaw.mockResolvedValue(1);

      const result = await ErpLitePostingEngineService.execute(BASE_REQUEST);

      expect(result.success).toBe(true);
      expect(result.rule_code).toBe('SPECIFIC');
    });
  });
});
