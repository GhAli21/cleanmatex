/**
 * credit_note.issued notification variables (HFC A-74).
 */
import { buildCreditNoteIssuedNotificationVariables } from '@/lib/notifications/credit-note-variables';
import { interpolate } from '@/lib/notifications/template-renderer';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));

describe('buildCreditNoteIssuedNotificationVariables', () => {
  it('sends the number as credit_note_no and as invoice_number for the default template', () => {
    expect(buildCreditNoteIssuedNotificationVariables({ creditNoteNo: ' SCN-000123 ' })).toEqual({
      credit_note_no: 'SCN-000123',
      invoice_number: 'SCN-000123',
    });
  });

  it('fills both the new {{credit_note_no}} and the seeded {{invoice_number}} placeholders', () => {
    const vars = buildCreditNoteIssuedNotificationVariables({ creditNoteNo: 'SCN-000123' });
    expect(interpolate('Credit Note Issued #{{invoice_number}}', vars)).toBe('Credit Note Issued #SCN-000123');
    expect(interpolate('رقم إشعار الدائن {{credit_note_no}}', vars)).toBe('رقم إشعار الدائن SCN-000123');
  });

  it('formats the amount with the currency decimal places', () => {
    const vars = buildCreditNoteIssuedNotificationVariables({
      creditNoteNo: 'SCN-1',
      amount: 5,
      currencyCode: 'OMR',
      decimalPlaces: 3,
    });
    expect(vars.amount).toBe('5.000');
    expect(vars.currency).toBe('OMR');
  });

  it('rejects an empty credit note number', () => {
    expect(() => buildCreditNoteIssuedNotificationVariables({ creditNoteNo: '  ' })).toThrow();
  });
});
