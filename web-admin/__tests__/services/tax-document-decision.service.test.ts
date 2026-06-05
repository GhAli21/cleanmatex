/**
 * Phase 7 — Tax-Document Decision Service tests
 *
 * Pure function tests: no DB, no mocks needed.
 * Covers decideTaxDocumentIssuance and decideCorrectionDocumentType.
 */

import {
  decideTaxDocumentIssuance,
  decideCorrectionDocumentType,
  type TriggerConfig,
  type OrderStateForDecision,
} from '@/lib/services/tax-document-decision.service';
import {
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_TRIGGER_EVENTS,
} from '@/lib/constants/order-financial';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConfig(
  triggerEvent: string,
  documentType = TAX_DOCUMENT_TYPES.INVOICE,
  isEnabled = true,
): TriggerConfig {
  return { triggerEvent: triggerEvent as TriggerConfig['triggerEvent'], documentType, isEnabled };
}

function makeOrder(
  status: string,
  outstanding = 0,
  hasTaxLines = true,
): OrderStateForDecision {
  return { status, outstanding, hasTaxLines };
}

const allConfigs: TriggerConfig[] = [
  makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,         TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE),
  makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_PAYMENT_CONFIRMATION, TAX_DOCUMENT_TYPES.INVOICE),
  makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_SERVICE_COMPLETION,   TAX_DOCUMENT_TYPES.INVOICE),
  makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY,             TAX_DOCUMENT_TYPES.INVOICE),
  makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_AR_INVOICE_ISSUE,     TAX_DOCUMENT_TYPES.INVOICE),
];

// ── decideTaxDocumentIssuance ─────────────────────────────────────────────────

describe('decideTaxDocumentIssuance', () => {
  describe('no enabled config for trigger', () => {
    it('returns shouldIssue=false when tenant has no config for the event', () => {
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
        makeOrder('CONFIRMED'),
        [],
      );
      expect(result.shouldIssue).toBe(false);
      expect(result.documentType).toBeNull();
      expect(result.reason).toContain('no_enabled_config_for_trigger');
    });

    it('returns shouldIssue=false when config exists but is disabled', () => {
      const disabledConfigs = [makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT, TAX_DOCUMENT_TYPES.INVOICE, false)];
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
        makeOrder('CONFIRMED'),
        disabledConfigs,
      );
      expect(result.shouldIssue).toBe(false);
      expect(result.reason).toContain('no_enabled_config_for_trigger');
    });
  });

  describe('ON_ORDER_SUBMIT eligible statuses', () => {
    const trigger = TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT;
    const configs = [makeConfig(trigger, TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE)];

    it.each(['CONFIRMED', 'PENDING_PAYMENT', 'PROCESSING'])(
      'issues for status=%s',
      (status) => {
        const result = decideTaxDocumentIssuance(trigger, makeOrder(status), configs);
        expect(result.shouldIssue).toBe(true);
        expect(result.documentType).toBe(TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE);
      },
    );

    it('does not issue for COMPLETED (not eligible for submit trigger)', () => {
      const result = decideTaxDocumentIssuance(trigger, makeOrder('COMPLETED'), configs);
      expect(result.shouldIssue).toBe(false);
      expect(result.reason).toContain('order_status_not_eligible');
    });
  });

  describe('ON_PAYMENT_CONFIRMATION eligible statuses', () => {
    const trigger = TAX_DOCUMENT_TRIGGER_EVENTS.ON_PAYMENT_CONFIRMATION;
    const configs = [makeConfig(trigger, TAX_DOCUMENT_TYPES.INVOICE)];

    it.each(['CONFIRMED', 'PENDING_PAYMENT', 'PROCESSING', 'COMPLETED', 'READY'])(
      'issues for status=%s',
      (status) => {
        const result = decideTaxDocumentIssuance(trigger, makeOrder(status), configs);
        expect(result.shouldIssue).toBe(true);
      },
    );

    it('does not issue for DELIVERED', () => {
      const result = decideTaxDocumentIssuance(trigger, makeOrder('DELIVERED'), configs);
      expect(result.shouldIssue).toBe(false);
    });
  });

  describe('ON_SERVICE_COMPLETION eligible statuses', () => {
    const trigger = TAX_DOCUMENT_TRIGGER_EVENTS.ON_SERVICE_COMPLETION;
    const configs = [makeConfig(trigger)];

    it.each(['READY', 'COMPLETED'])('issues for status=%s', (status) => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder(status), configs).shouldIssue).toBe(true);
    });

    it('does not issue for CONFIRMED', () => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder('CONFIRMED'), configs).shouldIssue).toBe(false);
    });
  });

  describe('ON_DELIVERY eligible statuses', () => {
    const trigger = TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY;
    const configs = [makeConfig(trigger)];

    it.each(['DELIVERED', 'COMPLETED'])('issues for status=%s', (status) => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder(status), configs).shouldIssue).toBe(true);
    });

    it('does not issue for READY', () => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder('READY'), configs).shouldIssue).toBe(false);
    });
  });

  describe('ON_AR_INVOICE_ISSUE eligible statuses', () => {
    const trigger = TAX_DOCUMENT_TRIGGER_EVENTS.ON_AR_INVOICE_ISSUE;
    const configs = [makeConfig(trigger)];

    it.each(['INVOICED', 'PROCESSING'])('issues for status=%s', (status) => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder(status), configs).shouldIssue).toBe(true);
    });

    it('does not issue for COMPLETED', () => {
      expect(decideTaxDocumentIssuance(trigger, makeOrder('COMPLETED'), configs).shouldIssue).toBe(false);
    });
  });

  describe('zero-tax orders', () => {
    it('returns shouldIssue=false when hasTaxLines=false', () => {
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
        makeOrder('CONFIRMED', 0, false),
        [makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT)],
      );
      expect(result.shouldIssue).toBe(false);
      expect(result.reason).toBe('no_tax_lines_on_order');
    });
  });

  describe('documentType from config', () => {
    it('returns SIMPLIFIED_INVOICE type from config', () => {
      const configs = [makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT, TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE)];
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
        makeOrder('CONFIRMED'),
        configs,
      );
      expect(result.documentType).toBe(TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE);
    });

    it('uses the first matching enabled config when multiple events configured', () => {
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
        makeOrder('CONFIRMED'),
        allConfigs,
      );
      expect(result.shouldIssue).toBe(true);
      expect(result.documentType).toBe(TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE);
    });
  });

  describe('reason field', () => {
    it('includes trigger event name in reason when issued', () => {
      const result = decideTaxDocumentIssuance(
        TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY,
        makeOrder('DELIVERED'),
        [makeConfig(TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY)],
      );
      expect(result.reason).toContain(TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY);
    });
  });
});

// ── decideCorrectionDocumentType ─────────────────────────────────────────────

describe('decideCorrectionDocumentType', () => {
  it('returns DEBIT_NOTE for positive delta (customer owes more)', () => {
    expect(decideCorrectionDocumentType(50)).toBe(TAX_DOCUMENT_TYPES.DEBIT_NOTE);
    expect(decideCorrectionDocumentType(0.01)).toBe(TAX_DOCUMENT_TYPES.DEBIT_NOTE);
  });

  it('returns CREDIT_NOTE for negative delta (customer owed back)', () => {
    expect(decideCorrectionDocumentType(-50)).toBe(TAX_DOCUMENT_TYPES.CREDIT_NOTE);
    expect(decideCorrectionDocumentType(-0.01)).toBe(TAX_DOCUMENT_TYPES.CREDIT_NOTE);
  });

  it('returns null for zero delta (no correction needed)', () => {
    expect(decideCorrectionDocumentType(0)).toBeNull();
  });
});

// ── formatTaxDocumentNo ───────────────────────────────────────────────────────

import { formatTaxDocumentNo } from '@/lib/services/tax-document-sequence.service';

describe('formatTaxDocumentNo', () => {
  it.each([
    [TAX_DOCUMENT_TYPES.INVOICE,            2026, 1,      'INV-2026-000001'],
    [TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE, 2026, 42,     'SIM-2026-000042'],
    [TAX_DOCUMENT_TYPES.CREDIT_NOTE,        2025, 3,      'CN-2025-000003'],
    [TAX_DOCUMENT_TYPES.DEBIT_NOTE,         2026, 999999, 'DN-2026-999999'],
  ])('%s fiscal=%d seq=%d → %s', (type, year, seq, expected) => {
    expect(formatTaxDocumentNo(type, year, seq)).toBe(expected);
  });

  it('zero-pads sequence number to 6 digits', () => {
    expect(formatTaxDocumentNo(TAX_DOCUMENT_TYPES.INVOICE, 2026, 7)).toBe('INV-2026-000007');
  });
});
