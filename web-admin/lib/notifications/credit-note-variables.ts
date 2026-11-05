/**
 * Notification variables for the credit_note.issued event (store credit notes, SCN).
 *
 * Templates use {{credit_note_no}} for the store credit note number (HFC A-74). The seeded default template
 * (migration 0382) still uses {{invoice_number}}, so the same number is also sent under that key.
 * Emitted from stored-value.service issueCreditNote / issueCreditNoteTx (FOLLOWUPS #11). Templates updated by migration 0697 to {{credit_note_no}}; invoice_number alias kept for older overrides.
 */

export interface CreditNoteIssuedVariableInput {
  /** Store credit note number, e.g. SCN-000123. Leading and trailing spaces are removed. */
  creditNoteNo: string;
  /** Credit amount in major units. Omitted when not known. */
  amount?: number | null;
  /** ISO 4217 currency code, e.g. OMR. */
  currencyCode?: string | null;
  /** Decimal places for the currency (OMR = 3). Defaults to 2. */
  decimalPlaces?: number;
}

/**
 * Build the {{key}} values for a credit_note.issued notification.
 * @param input Credit note number and optional amount and currency.
 * @returns credit_note_no, invoice_number (same value, for the default template), and amount/currency when given.
 * @throws Error when creditNoteNo is empty.
 */
export function buildCreditNoteIssuedNotificationVariables(
  input: CreditNoteIssuedVariableInput,
): Record<string, string> {
  const creditNoteNo = (input.creditNoteNo ?? '').trim();
  if (!creditNoteNo) {
    throw new Error('creditNoteNo is required for credit_note.issued notifications');
  }
  const vars: Record<string, string> = {
    credit_note_no: creditNoteNo,
    invoice_number: creditNoteNo,
  };
  if (typeof input.amount === 'number' && Number.isFinite(input.amount)) {
    vars.amount = input.amount.toFixed(input.decimalPlaces ?? 2);
  }
  const currency = (input.currencyCode ?? '').trim();
  if (currency) vars.currency = currency;
  return vars;
}
