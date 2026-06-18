/**
 * Client-safe types and pure helpers for order discount lines.
 * Import from here in client components — this file has no server-side dependencies.
 * DB functions remain in order-discounts.ts (server-only).
 */

/**
 *
 */
export interface OrderDiscountLine {
  id: string;
  tenant_org_id: string;
  order_id: string;
  applied_seq: number;
  source_type: string;
  source_id: string | null;
  source_name: string | null;
  source_name2: string | null;
  discount_type: string;
  discount_rate: number | null;
  discount_amount: number;
  is_voided: boolean;
  voided_at: Date | null;
  voided_by: string | null;
  created_at: Date | null;
  created_by: string | null;
}

/**
 * EN/AR label for a source_type — used in print components
 * @param sourceType
 * @param locale
 */
export function sourceLabel(sourceType: string, locale: 'en' | 'ar'): string {
  const labels: Record<string, { en: string; ar: string }> = {
    MANUAL:        { en: 'Manual',     ar: 'يدوي' },
    DISCOUNT_RULE: { en: 'Rule',       ar: 'قاعدة' },
    PROMO_CODE:    { en: 'Promo',      ar: 'ترويج' },
    GIFT_CARD:     { en: 'Gift Card',  ar: 'بطاقة هدية' },
  };
  return labels[sourceType]?.[locale] ?? sourceType;
}
