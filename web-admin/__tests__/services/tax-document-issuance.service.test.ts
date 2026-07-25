/**
 * Tests: tax-document-issuance.service (B14)
 *
 * Covers:
 * - resolveTaxRegistrationNo — branch override, tenant fallback, neither present
 * - maybeIssueTaxDocumentTx — registration gate, trigger-config gate, decision gate, happy path
 * - issueCorrectionTaxDocumentTx — zero-delta no-op, no-original no-op, DEBIT_NOTE/CREDIT_NOTE happy paths
 */

const mockCreateTaxDocumentTx = jest.fn();
const mockIssueTaxDocumentTx = jest.fn();
const mockGetTaxDocumentTriggerConfigs = jest.fn();
const mockDecideTaxDocumentIssuance = jest.fn();
const mockDecideCorrectionDocumentType = jest.fn();

jest.mock('@/lib/services/tax-document-write.service', () => ({
  createTaxDocumentTx: (...a: unknown[]) => mockCreateTaxDocumentTx(...a),
  issueTaxDocumentTx: (...a: unknown[]) => mockIssueTaxDocumentTx(...a),
  getTaxDocumentTriggerConfigs: (...a: unknown[]) => mockGetTaxDocumentTriggerConfigs(...a),
}));

jest.mock('@/lib/services/tax-document-decision.service', () => ({
  decideTaxDocumentIssuance: (...a: unknown[]) => mockDecideTaxDocumentIssuance(...a),
  decideCorrectionDocumentType: (...a: unknown[]) => mockDecideCorrectionDocumentType(...a),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {},
}));

import {
  resolveTaxRegistrationNo,
  maybeIssueTaxDocumentTx,
  issueCorrectionTaxDocumentTx,
} from '@/lib/services/tax-document-issuance.service';

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    org_orders_mst: { findUnique: jest.fn() },
    org_tax_documents_mst: { findFirst: jest.fn(), update: jest.fn() },
    ...overrides,
  };
}

describe('tax-document-issuance.service (B14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveTaxRegistrationNo', () => {
    it('returns the branch override when present', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([{ tax_registration_no: ' BR-123 ' }]),
      });
      const result = await resolveTaxRegistrationNo(tx as never, 't1', 'branch1');
      expect(result).toBe('BR-123');
    });

    it('falls back to the tenant value when the branch has no override', async () => {
      const queryRaw = jest
        .fn()
        .mockResolvedValueOnce([{ tax_registration_no: null }])
        .mockResolvedValueOnce([{ tax_registration_no: 'TEN-999' }]);
      const tx = makeTx({ $queryRaw: queryRaw });
      const result = await resolveTaxRegistrationNo(tx as never, 't1', 'branch1');
      expect(result).toBe('TEN-999');
    });

    it('reads only the tenant when no branchId is supplied', async () => {
      const queryRaw = jest.fn().mockResolvedValueOnce([{ tax_registration_no: 'TEN-1' }]);
      const tx = makeTx({ $queryRaw: queryRaw });
      const result = await resolveTaxRegistrationNo(tx as never, 't1', null);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe('TEN-1');
    });

    it('returns null when neither branch nor tenant has a registration number', async () => {
      const tx = makeTx({ $queryRaw: jest.fn().mockResolvedValue([{ tax_registration_no: null }]) });
      const result = await resolveTaxRegistrationNo(tx as never, 't1', 'branch1');
      expect(result).toBeNull();
    });
  });

  describe('maybeIssueTaxDocumentTx', () => {
    const baseParams = {
      tenantId: 't1',
      orderId: 'order1',
      branchId: null,
      triggerEvent: 'ON_ORDER_SUBMIT' as const,
      orderStatus: 'CONFIRMED',
      issuedBy: 'user1',
    };

    it('no-ops when the tenant has no tax-registration number', async () => {
      const tx = makeTx({ $queryRaw: jest.fn().mockResolvedValue([{ tax_registration_no: null }]) });
      const result = await maybeIssueTaxDocumentTx(tx as never, baseParams);
      expect(result).toBeNull();
      expect(mockGetTaxDocumentTriggerConfigs).not.toHaveBeenCalled();
    });

    it('no-ops when there are zero enabled trigger configs for the tenant', async () => {
      const tx = makeTx({ $queryRaw: jest.fn().mockResolvedValue([{ tax_registration_no: 'REG-1' }]) });
      mockGetTaxDocumentTriggerConfigs.mockResolvedValue([]);
      const result = await maybeIssueTaxDocumentTx(tx as never, baseParams);
      expect(result).toBeNull();
      expect(mockCreateTaxDocumentTx).not.toHaveBeenCalled();
    });

    it('no-ops when the decision service rejects issuance', async () => {
      const tx = makeTx({ $queryRaw: jest.fn().mockResolvedValue([{ tax_registration_no: 'REG-1' }]) });
      mockGetTaxDocumentTriggerConfigs.mockResolvedValue([
        { triggerEvent: 'ON_ORDER_SUBMIT', documentType: 'INVOICE', isEnabled: true },
      ]);
      (tx.org_orders_mst.findUnique as jest.Mock).mockResolvedValue({
        total_amount: 100, total_tax_amount: 5, currency_code: 'OMR', currency_ex_rate: 1, base_cur_currency_code: null,
      });
      mockDecideTaxDocumentIssuance.mockReturnValue({ shouldIssue: false, documentType: null, reason: 'order_status_not_eligible:DRAFT' });
      const result = await maybeIssueTaxDocumentTx(tx as never, baseParams);
      expect(result).toBeNull();
      expect(mockCreateTaxDocumentTx).not.toHaveBeenCalled();
    });

    it('creates and issues a document on the happy path', async () => {
      const tx = makeTx({ $queryRaw: jest.fn().mockResolvedValue([{ tax_registration_no: 'REG-1' }]) });
      mockGetTaxDocumentTriggerConfigs.mockResolvedValue([
        { triggerEvent: 'ON_ORDER_SUBMIT', documentType: 'INVOICE', isEnabled: true },
      ]);
      (tx.org_orders_mst.findUnique as jest.Mock).mockResolvedValue({
        total_amount: 100, total_tax_amount: 5, currency_code: 'OMR', currency_ex_rate: 1, base_cur_currency_code: null,
      });
      mockDecideTaxDocumentIssuance.mockReturnValue({ shouldIssue: true, documentType: 'INVOICE', reason: 'triggered_by:ON_ORDER_SUBMIT' });
      mockCreateTaxDocumentTx.mockResolvedValue('doc-1');
      mockIssueTaxDocumentTx.mockResolvedValue({ documentNo: 'INV-2026-000001', sequenceNumber: 1 });

      const result = await maybeIssueTaxDocumentTx(tx as never, baseParams);

      expect(mockCreateTaxDocumentTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ orderId: 'order1', tenantId: 't1', documentType: 'INVOICE', totalAmount: 100, taxAmount: 5 }),
      );
      expect(mockIssueTaxDocumentTx).toHaveBeenCalledWith(tx, 'doc-1', 't1', 'user1');
      expect(result).toEqual({ documentId: 'doc-1', documentNo: 'INV-2026-000001' });
    });
  });

  describe('issueCorrectionTaxDocumentTx', () => {
    const baseParams = {
      tenantId: 't1',
      orderId: 'order1',
      netDelta: 0,
      triggerEvent: 'ON_REFUND' as const,
      issuedBy: 'user1',
    };

    it('no-ops on a zero delta without querying for an original document', async () => {
      const tx = makeTx();
      mockDecideCorrectionDocumentType.mockReturnValue(null);
      const result = await issueCorrectionTaxDocumentTx(tx as never, baseParams);
      expect(result).toBeNull();
      expect(tx.org_tax_documents_mst.findFirst).not.toHaveBeenCalled();
    });

    it('no-ops when there is no ISSUED original invoice/simplified-invoice for the order', async () => {
      const tx = makeTx();
      (tx.org_tax_documents_mst.findFirst as jest.Mock).mockResolvedValue(null);
      mockDecideCorrectionDocumentType.mockReturnValue('CREDIT_NOTE');
      const result = await issueCorrectionTaxDocumentTx(tx as never, { ...baseParams, netDelta: -10 });
      expect(result).toBeNull();
      expect(mockCreateTaxDocumentTx).not.toHaveBeenCalled();
    });

    it('issues a DEBIT_NOTE with a proportional tax split for a positive delta, linked via supersedes_id', async () => {
      const tx = makeTx();
      (tx.org_tax_documents_mst.findFirst as jest.Mock).mockResolvedValue({
        id: 'orig-doc', total_amount: 100, tax_amount: 5, currency_code: 'OMR', currency_ex_rate: 1, base_currency_code: null,
      });
      mockDecideCorrectionDocumentType.mockReturnValue('DEBIT_NOTE');
      mockCreateTaxDocumentTx.mockResolvedValue('correction-doc');
      mockIssueTaxDocumentTx.mockResolvedValue({ documentNo: 'DN-2026-000001', sequenceNumber: 1 });

      const result = await issueCorrectionTaxDocumentTx(tx as never, { ...baseParams, netDelta: 20 });

      expect(mockCreateTaxDocumentTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ documentType: 'DEBIT_NOTE', totalAmount: 20, taxAmount: 1 }),
      );
      expect(tx.org_tax_documents_mst.update).toHaveBeenCalledWith({
        where: { id: 'correction-doc' },
        data: { supersedes_id: 'orig-doc' },
      });
      expect(result).toEqual({ documentId: 'correction-doc', documentNo: 'DN-2026-000001' });
    });

    it('issues a CREDIT_NOTE for a negative delta using the absolute amount', async () => {
      const tx = makeTx();
      (tx.org_tax_documents_mst.findFirst as jest.Mock).mockResolvedValue({
        id: 'orig-doc', total_amount: 200, tax_amount: 10, currency_code: 'OMR', currency_ex_rate: 1, base_currency_code: null,
      });
      mockDecideCorrectionDocumentType.mockReturnValue('CREDIT_NOTE');
      mockCreateTaxDocumentTx.mockResolvedValue('correction-doc-2');
      mockIssueTaxDocumentTx.mockResolvedValue({ documentNo: 'CN-2026-000001', sequenceNumber: 1 });

      const result = await issueCorrectionTaxDocumentTx(tx as never, { ...baseParams, netDelta: -50 });

      expect(mockCreateTaxDocumentTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ documentType: 'CREDIT_NOTE', totalAmount: 50, taxAmount: 2.5 }),
      );
      expect(result).toEqual({ documentId: 'correction-doc-2', documentNo: 'CN-2026-000001' });
    });
  });
});
