/**
 * Order Financial View contract (Reusable Order Fin View PLAN §6, §6.6;
 * DESIGN §1). Framework-free so builders, the resolver and `cmx-api` can
 * share it (PR-24). The runtime guard is `lib/validations/order-fin-view-schemas.ts`.
 *
 * Rules carried by the data, not by UI code:
 * - amounts are read from the snapshot and fact rows, never re-derived for display;
 * - DB codes (statuses, types) pass through exactly as stored;
 * - the server returns i18n keys and `name`/`name2`, never translated text.
 */
import type {
  ORDER_FIN_BALANCE_STATES,
  ORDER_FIN_DATA_SOURCES,
  ORDER_FIN_GROUP_KEYS,
  ORDER_FIN_HEADER_METRICS,
  ORDER_FIN_LINE_ROLES,
  ORDER_FIN_LINE_SIGNS,
  ORDER_FIN_LINE_STATES,
  ORDER_FIN_LINE_UNITS,
  ORDER_FIN_PRESETS,
  ORDER_FIN_SECTION_KEYS,
  ORDER_FIN_SECTION_MODES,
  ORDER_FIN_SECTION_STATUSES,
  ORDER_FIN_SOURCE_KINDS,
  ORDER_FIN_VIEW_SCHEMA_VERSION,
  ORDER_FIN_WARNING_SEVERITIES,
} from '@/lib/constants/order-fin-view';
import type { ServerTotals } from '@/lib/types/payment-quote';
import type { TaxPricingMode } from '@/lib/constants/order-financial';
import type { OrderChangeFinancialOutcome } from '@/lib/services/order-change/order-change-financial-result.service';

export type OrderFinSectionKey = (typeof ORDER_FIN_SECTION_KEYS)[number];
export type OrderFinGroupKey = (typeof ORDER_FIN_GROUP_KEYS)[number];
export type OrderFinSectionMode = (typeof ORDER_FIN_SECTION_MODES)[number];
export type OrderFinSectionStatus = (typeof ORDER_FIN_SECTION_STATUSES)[number];
export type OrderFinHeaderMetric = (typeof ORDER_FIN_HEADER_METRICS)[number];
export type OrderFinBalanceState = (typeof ORDER_FIN_BALANCE_STATES)[number];
export type OrderFinPreset = (typeof ORDER_FIN_PRESETS)[number];
export type OrderFinSourceKind = (typeof ORDER_FIN_SOURCE_KINDS)[number];
export type OrderFinDataSource = (typeof ORDER_FIN_DATA_SOURCES)[number];

/** A reconciliation or display warning; `messageKey` is an i18n key. */
export type FinancialWarningSeverity = (typeof ORDER_FIN_WARNING_SEVERITIES)[number];
export interface FinancialWarning {
  code: string;
  severity: FinancialWarningSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

/** One statement line (PLAN §6.6). */
export interface OrderFinLine {
  id: string;
  labelKey?: string;                                     // i18n key for fixed words
  label?: { name: string | null; name2: string | null }; // catalog names as stored
  unit: (typeof ORDER_FIN_LINE_UNITS)[number];           // 'points' is never summed with money
  amount: number | null;
  previousAmount?: number | null;                        // edit source only: "−0.500 → −0.700"
  sign: (typeof ORDER_FIN_LINE_SIGNS)[number];
  role: (typeof ORDER_FIN_LINE_ROLES)[number];           // 'informational' never goes in the amount column
  state: (typeof ORDER_FIN_LINE_STATES)[number];
  countsInTotal: boolean;                                // false: shown, never summed
  meta?: { dateIso?: string; methodCode?: string; ref?: string; statusCode?: string };
  /** Item lines only: the line's tax by code (Tax Engine), shown under the line; never summed. */
  taxParts?: OrderFinTaxPart[];
}

/** One tax code's share of an item line's tax, as stored in the tax record. */
export interface OrderFinTaxPart {
  taxCode: string;
  ratePercent: number | null;
  amount: number;
}

/** One section's payload. `lines` only when loaded in a detail mode. */
export interface OrderFinSectionPayload<TLine = OrderFinLine> {
  key: OrderFinSectionKey;
  status: OrderFinSectionStatus;
  totals: OrderFinLine[];             // what 'total' mode shows (usually one line)
  lines?: TLine[];
  counts?: Record<string, number>;    // e.g. { completed: 2, pending: 1 }
  warningCodes?: string[];            // inline markers on this section
  partial?: boolean;                  // timeline only: not every event source was loaded
}

/** Header figures; the UI picks which metrics to show per config. */
export interface OrderFinHeaderPayload {
  metrics: Partial<Record<OrderFinHeaderMetric, number | null>>;
  balanceState: OrderFinBalanceState | null;    // null when the snapshot is missing
  paymentStatus: string | null;                 // DB code as stored
  settlementType: string | null;                // DB code as stored
  editOutcome?: OrderChangeFinancialOutcome;    // edit source only, exact service code
  baseCurrency?: { code: string; total: number | null; exchangeRate: number | null } | null;
}

/** The whole view: one shape for saved, draft and edit sources. */
export interface OrderFinancialView {
  schemaVersion: typeof ORDER_FIN_VIEW_SCHEMA_VERSION;
  orderId: string | null;                       // null for drafts
  orderNo: string | null;
  orderStatus: string | null;                   // DB code; drives the cancelled banner (PR-09)
  currency: { code: string | null; decimalPlaces: number | null }; // order currency, not tenant (BF-18)
  currencyKnown: boolean;                       // false → "Currency unknown", never a default
  snapshotStatus: string | null;                // DB value as is; null when the snapshot is missing
  sourceKind: OrderFinSourceKind;
  generatedAt: string;
  header: OrderFinHeaderPayload;
  sections: Partial<Record<OrderFinSectionKey, OrderFinSectionPayload>>;
  warnings: FinancialWarning[];
}

/** The view without sections or warnings: what the batch header reader returns (P3-04). */
export type OrderFinHeaderView = Pick<
  OrderFinancialView,
  'orderId' | 'orderNo' | 'orderStatus' | 'currency' | 'currencyKnown' | 'snapshotStatus' | 'header'
>;

/**
 * Normalized section input (DESIGN §1): the saved-order loader, the draft
 * mapper and the edit mapper all produce this, and the builders read only
 * this, never DB rows. Amounts are stored values, never recomputed.
 */
export interface OrderFinSnapshotInput {
  orderId: string | null;
  orderNo: string | null;
  orderStatus: string | null;
  currencyCode: string | null;
  currencyDecimals: number | null;
  snapshotStatus: string | null;            // null: the snapshot was never written
  paymentStatus: string | null;
  settlementType: string | null;
  mismatchCount: number;
  itemsBase: number;                        // Σ item total_price; extras are already inside it
  /** Extras inside the item prices (shown as `included`); null when not known (orders written before the calculator). */
  extrasIncluded: number | null;
  /** Speed (express) premiums inside the item prices, shown as `included`; null when not known. */
  speedPremiumIncluded: number | null;
  charges: number;
  discount: number;
  tax: number;
  rounding: number;                         // signed cash-rounding adjustment, as stored
  /** Mode the stored totals were calculated in; TAX_INCLUSIVE means tax sits inside the prices. */
  taxPricingMode: TaxPricingMode;
  total: number;
  paid: number;
  credits: number;
  refunded: number;
  netCollected: number;
  outstanding: number;
  overpaid: number;
  changeReturned: number;
  receivable: number;
  baseCurrency: { code: string; total: number | null; exchangeRate: number | null } | null;
  engineVersion: number | null;
  calculationHash: string | null;
  traceId: string | null;
}

/** One fact row (payment, charge, item…) ready for a builder; `state` decides `countsInTotal`. */
export interface OrderFinFactInput {
  id: string;
  labelKey?: string;                        // i18n key when the line has a fixed name (draft discounts)
  label?: { name: string | null; name2: string | null };
  amount: number | null;
  previousAmount?: number | null;           // edit source only: the saved amount before the change
  unit?: OrderFinLine['unit'];              // default 'money'; loyalty is 'points'
  role?: OrderFinLine['role'];              // default 'additive'; document totals are 'informational'
  state: OrderFinLine['state'];
  statusCode?: string | null;               // DB status as stored
  dateIso?: string | null;
  methodCode?: string | null;               // payment method, credit type, charge type…
  ref?: string | null;                      // short display ref only (never a gateway reference)
  taxParts?: OrderFinTaxPart[];             // item lines: tax by code
}

export interface OrderFinSourceSet {
  sourceKind: OrderFinSourceKind;
  snapshot: OrderFinSnapshotInput | null;   // null: "Financial data unavailable", never zeros
  facts: Partial<Record<OrderFinDataSource, OrderFinFactInput[]>>;
  errors: Partial<Record<OrderFinDataSource, string>>;
  /** Server-side results of the canonical aggregation (BF-14); absent for draft and edit. */
  checks?: OrderFinChecks;
  /** Edit source only: the quote's was → now figures for the header (PLAN §6.4). */
  edit?: Pick<OrderFinEditQuote, 'originalTotal' | 'projectedTotal' | 'totalDelta' | 'outcome'>;
}

/**
 * One Order Edit preview as figures (PLAN §6.4, P3-08), built on the server by
 * `editQuoteFromPreview` from the same result the Review dialog shows. The
 * edit mapper lays it over the saved order; nothing is recomputed.
 */
export interface OrderFinEditQuote {
  originalTotal: number;
  projectedTotal: number;
  totalDelta: number;                       // Apply's `commercialDelta`
  outcome: OrderChangeFinancialOutcome;     // exact service code
  /** The quote's settlement result (`projectOrderChangeFinancialResult`). */
  paid: number;
  credits: number;
  outstanding: number;
  overpaid: number;                         // unresolved overpayment, the OVERPAYMENT outcome's figure
  /** What the snapshot will hold after Apply; null when the edit is not re-priced (notes, dates: EC-08). */
  projected: (Pick<OrderFinSnapshotInput,
    'itemsBase' | 'extrasIncluded' | 'speedPremiumIncluded' | 'charges' | 'discount' | 'tax' | 'rounding' | 'taxPricingMode'>
    & { facts: Required<Pick<OrderFinSourceSet['facts'], 'charges' | 'discounts' | 'taxes'>> }) | null;
}

/**
 * An unsaved order in payment-modal-v4 (PLAN §6.3, D8): figures the modal and
 * its engine have already computed and shown, never recomputed. Fields mirror
 * the engine's names so the caller copies them as is.
 */
export interface OrderFinDraftInput {
  currencyCode: string | null;
  currencyDecimals: number | null;
  settlementType: string | null;                // DB settlement code of the chosen method, when known
  /** The server quote the modal displays (`/api/v1/orders/preview-payment`). */
  quote: Pick<ServerTotals,
    'subtotal' | 'manualDiscount' | 'autoRuleDiscount' | 'promoDiscount' | 'vatValue' | 'additionalTaxAmount'
    | 'taxBreakdown' | 'chargesTotal' | 'roundingAdjustmentAmount' | 'saleTotal' | 'taxPricingMode' | 'extrasIncludedAmount' | 'speedPremiumIncludedAmount'>;
  /** Cart lines as the cart shows them (extras inside). Optional: totals stand without them. */
  items?: Array<{ id: string; label: { name: string | null; name2: string | null }; amount: number }>;
  /** Engine (`useMoneyDerivations`) outputs. */
  realPaymentEntries: Array<{ leg: { method?: string; amount?: number }; index: number }>;
  customerCreditEntries: Array<{ leg: { method?: string; amount?: number }; index: number }>;
  payNowAmount: number;
  customerCreditAmount: number;
  remainingBalance: number;
  giftCardSettlementAmount: number;
  displayChangeAmount: number;
  /** Excess neither returned as change nor moved to wallet/advance (`payExtra.unresolvedExcessAmount`): the saved `overpaid_amount` before submit. */
  unresolvedOverpaymentAmount: number;
}

/** What the facts say, through the shared aggregation functions; warnings compare these with the snapshot. */
export interface OrderFinChecks {
  expectedOutstanding?: number;             // D005 via aggregateOrderFinancials
  expectedCredits?: number;                 // effective credits via aggregateOrderFinancials
  invoiceOutstanding?: number;              // Σ this order's share on its live AR invoices
  lineMismatches?: OrderFinSectionKey[];    // value sections whose counted lines ≠ snapshot total
  expectedTotal?: number;                   // the snapshot writer's own total formula on the stored parts
}

/** Header display options (merged over the preset). */
export interface OrderFinHeaderConfig {
  visible?: boolean;                       // default true
  metrics?: OrderFinHeaderMetric[];        // order = render order
  emphasize?: OrderFinHeaderMetric;        // the hero number, default 'balance'
  layout?: 'cards' | 'inline' | 'compact' | 'badge';
  showPaymentStatus?: boolean;
  showSettlementType?: boolean;
  showReconciliationBadge?: boolean;
  showBaseCurrency?: boolean;
  hideZeroMetrics?: boolean;               // never hides 'total' or 'balance'
}

/** Caller display configuration (PLAN §6). No permission logic (D10). */
export interface OrderFinancialDisplayConfig {
  preset?: OrderFinPreset;                 // default 'summary'
  header?: OrderFinHeaderConfig;
  sections?: Partial<Record<OrderFinSectionKey, OrderFinSectionMode>>;
  sectionOrder?: OrderFinSectionKey[];
  groupOrder?: OrderFinGroupKey[];
  lineCap?: number;                        // default 8; 'audit' and layout 'print' show all lines
  /** Reserved (D17), not built: a heavy section may later switch to a table. */
  detailRenderer?: Partial<Record<OrderFinSectionKey, 'lines' | 'table'>>;
  layout?: 'card' | 'plain' | 'sheet' | 'print';
  columns?: 1 | 2 | 'auto';
  density?: 'comfortable' | 'compact';
  showEmptySections?: boolean;             // default false
  showWarnings?: boolean;                  // default true
  forbiddenSectionBehavior?: 'hide' | 'lockNote'; // default 'hide'
  /** In-view preset switch (D9); a `?fin=` URL param wins over the remembered choice. */
  presetSwitcher?: OrderFinPreset[];
}

/** Output of `resolveOrderFinDisplayConfig`: every option filled, plus the data to load. */
export interface ResolvedOrderFinDisplayConfig {
  preset: OrderFinPreset;
  sourceKind: OrderFinSourceKind;
  header: Required<OrderFinHeaderConfig>;
  sections: Record<OrderFinSectionKey, OrderFinSectionMode>;
  sectionOrder: OrderFinSectionKey[];      // always every key, caller's order first
  groupOrder: OrderFinGroupKey[];
  lineCap: number | null;                  // null: show every line
  layout: NonNullable<OrderFinancialDisplayConfig['layout']>;
  columns: NonNullable<OrderFinancialDisplayConfig['columns']>;
  density: NonNullable<OrderFinancialDisplayConfig['density']>;
  showEmptySections: boolean;
  showWarnings: boolean;
  forbiddenSectionBehavior: 'hide' | 'lockNote';
  presetSwitcher: OrderFinPreset[];
  /** Minimum sources to load, in registry order; empty for the draft source (no DB). */
  requiredSources: OrderFinDataSource[];
}
