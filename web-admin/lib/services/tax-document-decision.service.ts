/**
 * Tax-document decision module (Phase 7 / ADR — Order Fin v1.1).
 *
 * Pure functions: (order_state, trigger_event, tenant_config) → action.
 * No DB access, no side effects — suitable for unit testing without mocks.
 *
 * Decision matrix (simplified):
 *
 * trigger_event            | eligible order states            | document_type from config
 * ─────────────────────────┼──────────────────────────────────┼───────────────────────────
 * ON_ORDER_SUBMIT          | CONFIRMED, PENDING_PAYMENT       | per tenant config
 * ON_PAYMENT_CONFIRMATION  | any state with outstanding = 0   | per tenant config
 * ON_SERVICE_COMPLETION    | READY, COMPLETED                 | per tenant config
 * ON_DELIVERY              | DELIVERED                        | per tenant config
 * ON_AR_INVOICE_ISSUE      | INVOICED                         | per tenant config
 *
 * If the tenant has no config for the trigger event, or if the order state
 * does not match the eligible set, shouldIssue = false.
 */

import {
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_TRIGGER_EVENTS,
} from '@/lib/constants/order-financial';
import type {
  TaxDocumentType,
  TaxDocumentTriggerEvent,
  TaxDocumentDecision,
} from '@/lib/types/order-financial';

/** Minimal trigger config row — matches org_tax_doc_triggers_cfg. */
export type TriggerConfig = {
  triggerEvent: TaxDocumentTriggerEvent;
  documentType: TaxDocumentType;
  isEnabled:    boolean;
};

/** Order state information needed for the decision. */
export type OrderStateForDecision = {
  status:      string;
  outstanding: number;
  hasTaxLines: boolean;
};

/** Eligible order statuses per trigger event. */
const ELIGIBLE_STATUSES: Record<TaxDocumentTriggerEvent, string[]> = {
  [TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT]:         ['CONFIRMED', 'PENDING_PAYMENT', 'PROCESSING'],
  [TAX_DOCUMENT_TRIGGER_EVENTS.ON_PAYMENT_CONFIRMATION]: ['CONFIRMED', 'PENDING_PAYMENT', 'PROCESSING', 'COMPLETED', 'READY'],
  [TAX_DOCUMENT_TRIGGER_EVENTS.ON_SERVICE_COMPLETION]:   ['READY', 'COMPLETED'],
  [TAX_DOCUMENT_TRIGGER_EVENTS.ON_DELIVERY]:             ['DELIVERED', 'COMPLETED'],
  [TAX_DOCUMENT_TRIGGER_EVENTS.ON_AR_INVOICE_ISSUE]:     ['INVOICED', 'PROCESSING'],
  [TAX_DOCUMENT_TRIGGER_EVENTS.LEGACY_BACKFILL]:         [],
};

/**
 * Decides whether a tax document should be issued for a given trigger event.
 *
 * Returns a TaxDocumentDecision with shouldIssue=true only when:
 *   1. The tenant has an enabled config for the trigger event.
 *   2. The order status is in the eligible set for that trigger.
 *   3. The order has at least one tax line (no point issuing a tax document
 *      for a zero-tax order unless explicitly configured otherwise).
 * @param triggerEvent
 * @param orderState
 * @param tenantConfigs
 */
export function decideTaxDocumentIssuance(
  triggerEvent:  TaxDocumentTriggerEvent,
  orderState:    OrderStateForDecision,
  tenantConfigs: TriggerConfig[],
): TaxDocumentDecision {
  const config = tenantConfigs.find(
    (c) => c.triggerEvent === triggerEvent && c.isEnabled,
  );

  if (!config) {
    return {
      shouldIssue:  false,
      documentType: null,
      reason:       `no_enabled_config_for_trigger:${triggerEvent}`,
    };
  }

  const eligible = ELIGIBLE_STATUSES[triggerEvent] ?? [];
  if (!eligible.includes(orderState.status)) {
    return {
      shouldIssue:  false,
      documentType: null,
      reason:       `order_status_not_eligible:${orderState.status}`,
    };
  }

  if (!orderState.hasTaxLines) {
    return {
      shouldIssue:  false,
      documentType: null,
      reason:       'no_tax_lines_on_order',
    };
  }

  return {
    shouldIssue:  true,
    documentType: config.documentType,
    reason:       `triggered_by:${triggerEvent}`,
  };
}

/**
 * Decides whether a correction document (CREDIT_NOTE or DEBIT_NOTE) should
 * be issued to supersede an existing ISSUED document.
 *
 * netDelta > 0 → customer owes more → DEBIT_NOTE
 * netDelta < 0 → customer is owed back → CREDIT_NOTE
 * netDelta = 0 → no correction needed
 * @param netDelta
 */
export function decideCorrectionDocumentType(
  netDelta: number,
): TaxDocumentType | null {
  if (netDelta > 0) return TAX_DOCUMENT_TYPES.DEBIT_NOTE;
  if (netDelta < 0) return TAX_DOCUMENT_TYPES.CREDIT_NOTE;
  return null;
}
