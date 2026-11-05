/**
 * Which data sources each section needs (DESIGN §1 step 1). `total` mode on a
 * snapshot-backed section costs nothing beyond the core row; detail modes
 * also need the section's fact rows.
 */
import type { OrderFinDataSource, OrderFinSectionKey } from '@/lib/types/order-fin-view';

interface SectionSources {
  /** The section total is a snapshot column, so `total` mode needs only `core`. */
  totalFromSnapshot: boolean;
  /** Fact sources for detail modes (and for `total` when not snapshot-backed). */
  detail: OrderFinDataSource[];
}

/** Timeline events come from every dated source; a missing one makes it `partial`. */
export const TIMELINE_EVENT_SOURCES: OrderFinDataSource[] = [
  'charges', 'discounts', 'payments', 'credits', 'refunds', 'overpayment', 'receivable',
  'taxDocuments', 'vouchers', 'loyalty', 'adjustments', 'orderChanges', 'receipts',
];

export const ORDER_FIN_SECTION_SOURCES: Record<OrderFinSectionKey, SectionSources> = {
  items:          { totalFromSnapshot: true,  detail: ['items'] },
  charges:        { totalFromSnapshot: true,  detail: ['charges'] },
  discounts:      { totalFromSnapshot: true,  detail: ['discounts'] },
  taxes:          { totalFromSnapshot: true,  detail: ['taxes'] },
  rounding:       { totalFromSnapshot: true,  detail: [] },
  payments:       { totalFromSnapshot: true,  detail: ['payments'] },
  credits:        { totalFromSnapshot: true,  detail: ['credits'] },
  refunds:        { totalFromSnapshot: true,  detail: ['refunds'] },
  overpayment:    { totalFromSnapshot: true,  detail: ['overpayment'] },
  receivable:     { totalFromSnapshot: false, detail: ['receivable'] },
  taxDocuments:   { totalFromSnapshot: false, detail: ['taxDocuments'] },
  vouchers:       { totalFromSnapshot: false, detail: ['vouchers'] },
  loyalty:        { totalFromSnapshot: false, detail: ['loyalty'] },
  adjustments:    { totalFromSnapshot: false, detail: ['adjustments'] },
  orderChanges:   { totalFromSnapshot: false, detail: ['orderChanges'] },
  currency:       { totalFromSnapshot: true,  detail: [] },
  receipts:       { totalFromSnapshot: false, detail: ['receipts'] },
  timeline:       { totalFromSnapshot: false, detail: TIMELINE_EVENT_SOURCES },
  reconciliation: { totalFromSnapshot: true,  detail: [] },
  debug:          { totalFromSnapshot: true,  detail: [] },
};
