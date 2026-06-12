/**
 * Types for the BVM (Business Voucher Module) wiring layer.
 *
 * Wiring connects posted voucher transaction lines to their operational effects
 * (org_order_payments_dtl, org_order_credit_apps_dtl, org_cash_drawer_movements_dtl).
 * Each handler implements WiringHandler. The orchestrator (voucher-wiring.service.ts)
 * runs handlers in a single DB transaction immediately after voucher posting.
 */

import type { Prisma } from '@prisma/client';

/**
 * Minimal line projection loaded by the wiring orchestrator.
 * All fields the handlers need to produce their operational effect.
 * The orchestrator mutates order_payment_id and cash_drawer_mvt_id
 * in-memory after each successful wire() call so subsequent handlers
 * can read them (e.g. cash drawer handler reads order_payment_id set
 * by the order payment handler).
 */
export interface VoucherLineForWiring {
  id: string;
  tenant_org_id: string;
  voucher_id: string;
  line_no: number;
  line_role: string;
  line_status: string;
  wiring_status: string;
  direction: string | null;
  payment_method_code: string | null;
  payment_status: string | null;
  amount: Prisma.Decimal;
  currency_code: string | null;
  target_type: string | null;
  target_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  cash_drawer_session_id: string | null;
  tendered_amount: Prisma.Decimal | null;
  change_returned_amount: Prisma.Decimal | null;
  /** Sub-type for ORDER_CREDIT_APPLICATION: WALLET, GIFT_CARD, CUSTOMER_ADVANCE, CREDIT_NOTE, LOYALTY_CREDIT */
  credit_application_type: string | null;
  /** Populated after orderPaymentWiringHandler runs — read by cashDrawerWiringHandler for FK */
  order_payment_id: string | null;
  /** Populated after cashDrawerWiringHandler runs */
  cash_drawer_mvt_id: string | null;
  card_brand_code: string | null;
  card_last4: string | null;
  gateway_code: string | null;
  gateway_reference: string | null;
  bank_reference: string | null;
  check_number: string | null;
  org_payment_method_id: string | null;
  payment_terminal_id: string | null;
  branch_id: string | null;
}

/**
 * A single linked operational effect produced by a wiring handler.
 * Returned by getLinkedEffect() and included in LinkedEffectsResult.
 */
export interface LinkedEffect {
  effectType:
    | 'ORDER_PAYMENT'
    | 'CASH_DRAWER_MOVEMENT'
    | 'CREDIT_APPLICATION'
    | 'INVOICE_PAYMENT'
    | 'STATEMENT_PAYMENT';
  effectId: string;
  tableRef:
    | 'org_order_payments_dtl'
    | 'org_cash_drawer_movements_dtl'
    | 'org_order_credit_apps_dtl'
    | 'org_invoice_payments_dtl'
    | 'org_b2b_statements_mst';
  amount: Prisma.Decimal | number;
  currency_code: string | null;
}

/**
 * Contract every Phase 1A wiring handler must implement.
 * Handlers are pure — they only write within the provided tx.
 * canHandle() is evaluated first; if false, the handler is skipped.
 * validate() runs before wire(); throws on invalid input.
 * wire() creates the operational row and returns its ID.
 */
export interface WiringHandler {
  /** Return true if this handler owns the given line's role/payment combination. */
  canHandle(line: VoucherLineForWiring): boolean;
  /** Throw a descriptive Error if required fields are missing. */
  validate(line: VoucherLineForWiring): Promise<void>;
  /**
   * Create the operational effect row within the open tx.
   * Returns the new row's ID.
   */
  wire(
    line: VoucherLineForWiring,
    voucherId: string,
    tenantOrgId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<string>;
  /** Fetch the operational record linked to this line (read path for UI). */
  getLinkedEffect(
    line: VoucherLineForWiring,
    tenantOrgId: string,
    tx: Prisma.TransactionClient
  ): Promise<LinkedEffect | null>;
}

/** Result for a single wired line. */
export interface WireLineResult {
  lineId: string;
  wired: boolean;
  effectIds: string[];
  error?: string;
}

/** Aggregate wiring outcome returned by wireBizVoucher(). */
export interface WiringResult {
  voucherId: string;
  linesWired: number;
  linesSkipped: number;
  linesFailed: number;
  effects: WireLineResult[];
}

/** Combined result of postAndWireBizVoucher(). */
export interface PostAndWireResult {
  voucherId: string;
  voucher_no: string;
  voucher_status: string;
  wiring: WiringResult;
  fromCache: boolean;
}

/** All linked effects for a voucher (returned by getVoucherLinkedEffects). */
export interface LinkedEffectsResult {
  voucherId: string;
  orderPayments: Array<{
    id: string;
    order_id: string | null;
    amount: Prisma.Decimal;
    payment_method_code: string | null;
    line_id: string | null;
    payment_status: string | null;
  }>;
  cashDrawerMovements: Array<{
    id: string;
    session_id: string | null;
    amount: Prisma.Decimal;
    movement_type: string | null;
    line_id: string | null;
  }>;
  creditApplications: Array<{
    id: string;
    order_id: string | null;
    amount: Prisma.Decimal;
    credit_type: string | null;
    line_id: string | null;
  }>;
}

/** Linked effect(s) for a single voucher line. */
export interface LineLinkedEffectResult {
  lineId: string;
  wiring_status: string;
  effects: LinkedEffect[];
}
