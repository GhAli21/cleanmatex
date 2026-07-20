/**
 * Tests: app/actions/customers/stored-value-actions.ts — permission gates (B27)
 *
 * Covers the newly-added permission checks that closed a confirmed gap
 * (these actions had NO permission check at all before this package):
 * - topUpWallet requires stored_value:issue_wallet_credit
 * - issueAdvance requires stored_value:issue_advance
 * - issueCreditNoteAction requires stored_value:issue_credit_note
 * In every case: denies (typed error, not a thrown exception) when the actor
 * lacks the permission, and proceeds to the underlying service call when granted.
 */

const mockHasPermissionServer = jest.fn();
const mockGetAuthContext = jest.fn();
const mockTopUpWalletTx = jest.fn();
const mockIssueAdvanceTx = jest.fn();
const mockIssueCreditNote = jest.fn();
const mockPrismaTransaction = jest.fn();
const mockGetTenantCurrency = jest.fn();

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: (...a: unknown[]) => mockGetAuthContext(...a),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockPrismaTransaction(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getTenantCurrency: (...a: unknown[]) => mockGetTenantCurrency(...a),
  })),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...a: unknown[]) => mockTopUpWalletTx(...a),
  issueAdvanceTx: (...a: unknown[]) => mockIssueAdvanceTx(...a),
  issueCreditNote: (...a: unknown[]) => mockIssueCreditNote(...a),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { topUpWallet, issueAdvance, issueCreditNoteAction } from '@/app/actions/customers/stored-value-actions';

const TENANT = 'tenant-sv-001';
const CUSTOMER = 'customer-sv-001';

describe('stored-value-actions — permission gates (B27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ tenantId: TENANT, userId: 'user-1' });
    mockGetTenantCurrency.mockResolvedValue('OMR');
    mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  });

  describe('topUpWallet', () => {
    it('denies with a typed error when the actor lacks stored_value:issue_wallet_credit', async () => {
      mockHasPermissionServer.mockResolvedValue(false);

      const result = await topUpWallet(CUSTOMER, 10);

      expect(result).toEqual({
        success: false,
        error: 'Insufficient permissions: stored_value:issue_wallet_credit required',
      });
      expect(mockTopUpWalletTx).not.toHaveBeenCalled();
    });

    it('proceeds to topUpWalletTx when authorized', async () => {
      mockHasPermissionServer.mockResolvedValue(true);
      mockTopUpWalletTx.mockResolvedValue({});

      const result = await topUpWallet(CUSTOMER, 10);

      expect(result).toEqual({ success: true });
      expect(mockTopUpWalletTx).toHaveBeenCalled();
      expect(mockHasPermissionServer).toHaveBeenCalledWith('stored_value:issue_wallet_credit');
    });
  });

  describe('issueAdvance', () => {
    it('denies with a typed error when the actor lacks stored_value:issue_advance', async () => {
      mockHasPermissionServer.mockResolvedValue(false);

      const result = await issueAdvance(CUSTOMER, 10);

      expect(result).toEqual({
        success: false,
        error: 'Insufficient permissions: stored_value:issue_advance required',
      });
      expect(mockIssueAdvanceTx).not.toHaveBeenCalled();
    });

    it('proceeds to issueAdvanceTx when authorized', async () => {
      mockHasPermissionServer.mockResolvedValue(true);
      mockIssueAdvanceTx.mockResolvedValue({});

      const result = await issueAdvance(CUSTOMER, 10);

      expect(result).toEqual({ success: true });
      expect(mockIssueAdvanceTx).toHaveBeenCalled();
    });
  });

  describe('issueCreditNoteAction', () => {
    it('denies with a typed error when the actor lacks stored_value:issue_credit_note', async () => {
      mockHasPermissionServer.mockResolvedValue(false);

      const result = await issueCreditNoteAction(CUSTOMER, 10, 'Goodwill', 'OMR');

      expect(result).toEqual({
        success: false,
        error: 'Insufficient permissions: stored_value:issue_credit_note required',
      });
      expect(mockIssueCreditNote).not.toHaveBeenCalled();
    });

    it('proceeds to issueCreditNote when authorized (this is the path the UI actually calls — the API route with the same permission was never wired to the UI)', async () => {
      mockHasPermissionServer.mockResolvedValue(true);
      mockIssueCreditNote.mockResolvedValue({});

      const result = await issueCreditNoteAction(CUSTOMER, 10, 'Goodwill', 'OMR');

      expect(result).toEqual({ success: true });
      expect(mockIssueCreditNote).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ customerId: CUSTOMER, amount: 10, reason: 'Goodwill' })
      );
    });
  });
});
