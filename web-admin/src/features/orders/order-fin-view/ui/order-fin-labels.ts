/**
 * Label helpers for the Order Financial View: one place decides the words
 * every line, section and warning shows (EN/AR). No money here.
 */
import type { FinancialWarning, OrderFinLine, OrderFinSectionKey, OrderFinancialView } from '@/lib/types/order-fin-view';

/** A next-intl translator (root or namespaced); `has` guards optional keys. */
export interface Translator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

const FIN_PREFIX = 'orders.finView.';

/** Warnings whose text already lives in `orders.detail.financial.warning.*` (reused, not duplicated). */
const LEGACY_WARNING_KEYS = new Set(['balanceMismatch', 'giftCardNotInCredits', 'payOnCollectionWithArInvoice', 'paidOrderWithArInvoice', 'creditInvoiceMissingAr']);

/** A catalog name in the viewer's language; Arabic falls back to the English name. */
export function localName(label: OrderFinLine['label'], locale: string): string | null {
  if (!label) return null;
  return (locale === 'ar' ? label.name2 || label.name : label.name || label.name2) ?? null;
}

/**
 * The text of one line: its fixed key, else its catalog name, else a translated
 * code (credit type), else the raw code.
 * @param line - the statement line
 * @param section - the section it belongs to
 * @param t - root translator
 * @param locale - viewer locale
 */
export function lineLabel(line: OrderFinLine, section: OrderFinSectionKey, t: Translator, locale: string): string {
  if (line.labelKey?.startsWith(FIN_PREFIX) && t.has(line.labelKey)) return t(line.labelKey);
  const name = localName(line.label, locale);
  if (name) return name;
  const code = line.meta?.methodCode;
  // Credit lines carry the credit type code (WALLET, GIFT_CARD…) and no name.
  if (code && section === 'credits' && t.has(`${FIN_PREFIX}creditTypes.${code}`)) return t(`${FIN_PREFIX}creditTypes.${code}`);
  return code ?? line.meta?.ref ?? '—';
}

/**
 * Section title; the tax row says "included in prices" when its total is not added (tax-inclusive).
 * @param key - section key
 * @param view - the view (reads the tax total's role)
 * @param t - root translator
 */
export function sectionTitle(key: OrderFinSectionKey, view: OrderFinancialView, t: Translator): string {
  if (key === 'taxes' && view.sections.taxes?.totals[0]?.role === 'included') return t(`${FIN_PREFIX}sections.taxesIncluded`);
  return t(`${FIN_PREFIX}sections.${key}`);
}

/**
 * Warning text with its parameters (numbers are passed through as given).
 * @param warning - the view warning
 * @param t - root translator
 */
export function warningText(warning: FinancialWarning, t: Translator): string {
  const key = LEGACY_WARNING_KEYS.has(warning.messageKey)
    ? `orders.detail.financial.warning.${warning.messageKey}`
    : `${FIN_PREFIX}warnings.${warning.messageKey}`;
  return t.has(key) ? t(key, warning.messageParams) : warning.code;
}

/** Translated payment status (BF-17), or the stored code when unknown. */
export function paymentStatusLabel(code: string | null, t: Translator): string | null {
  if (!code) return null;
  const key = `${FIN_PREFIX}paymentStatus.${code}`;
  return t.has(key) ? t(key) : code;
}

/** Translated settlement type (reuses `paymentConfig.methods.settlementTypeCodes`), or the stored code. */
export function settlementTypeLabel(code: string | null, t: Translator): string | null {
  if (!code) return null;
  const key = `paymentConfig.methods.settlementTypeCodes.${code}`;
  return t.has(key) ? t(key) : code;
}
