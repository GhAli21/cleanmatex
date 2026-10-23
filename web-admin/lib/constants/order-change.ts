/**
 * Edit Order V2 contract tokens. These are request-contract values only; they
 * do not grant capability or enable a Change command before the WP05 policy boundary.
 * Derive {@link OrderChangeOperationCode} from this list to keep accepted
 * operation codes aligned across validation and future policy packages.
 */
export const ORDER_CHANGE_OPERATION_CODES = [
  'ADD_ITEM',
  'REMOVE_ITEM',
  'CHANGE_ITEM_QUANTITY',
  'ADD_PIECE',
  'REMOVE_PIECE',
  'ADD_PREFERENCE',
  'CHANGE_PREFERENCE',
  'REMOVE_PREFERENCE',
  'CHANGE_PRIORITY',
  'CHANGE_SERVICE_SPEED',
  'CHANGE_READY_BY',
  'CHANGE_ORDER_NOTES',
  'CHANGE_CUSTOMER_SNAPSHOT',
  'CHANGE_CUSTOMER',
  'CHANGE_BRANCH',
  'CHANGE_ORDER_TYPE',
  'CHANGE_EXPRESS',
  'CHANGE_QUICK_DROP',
  'CHANGE_PAYMENT_NOTES',
  'CHANGE_ORDER_SOURCE',
  'CHANGE_PHYSICAL_INTAKE',
  'CHANGE_B2B_REFERENCE',
  'CHANGE_DISCOUNT',
  'CHANGE_PAYMENT_TYPE',
  'CHANGE_ITEM_PRODUCT',
  'CHANGE_ITEM_SERVICE',
  'CHANGE_ITEM_PRICE',
  'CHANGE_PIECE_BRAND',
  'CHANGE_PIECE_RACK',
  /** Residual fields require their own live catalog rule, just like every other operation. */
  'CHANGE_UNLISTED',
] as const;

/**
 * Stable identity kinds accepted by the v3 Change contract.
 *
 * Derive {@link OrderChangeTargetKind} from this list so request validation and
 * downstream policy packages cannot silently accept an ungoverned target kind.
 */
export const ORDER_CHANGE_TARGET_KINDS = [
  'ORDER',
  'PERSISTED_ITEM',
  'PERSISTED_PIECE',
  'PERSISTED_PREFERENCE',
  'LOCAL_ITEM',
  'LOCAL_PIECE',
  'LOCAL_PREFERENCE',
] as const;

/** V1 context is read-only until capability policy is implemented in WP05. */
export const ORDER_CHANGE_CONTEXT_DEFERRED_REASON = 'CAPABILITY_POLICY_PENDING';

/**
 * Finite transport and graph bounds for the future Preview, Apply, and History
 * endpoints. They constrain untrusted input only; tenant preference limits and
 * capability decisions remain server-derived policy in their owning packages.
 */
export const ORDER_CHANGE_LIMITS = {
  MAX_REQUEST_BODY_BYTES: 128 * 1024,
  MAX_OPERATIONS: 50,
  MAX_ADD_ITEM_OPERATIONS: 25,
  MAX_ADD_PIECE_OPERATIONS: 50,
  MAX_ADD_PREFERENCE_OPERATIONS: 50,
  MAX_SELECTED_PIECE_IDS: 50,
  MAX_GATE_DECISIONS: 20,
  MAX_CHANGE_REASON_LENGTH: 500,
  MAX_ORDER_NOTE_LENGTH: 1_000,
  MAX_PIECE_NOTE_LENGTH: 500,
  MAX_PREFERENCE_CONTENT_LENGTH: 500,
  MAX_REVIEW_PROOF_LENGTH: 4_096,
  /** SHA-256 hex of the line list. The list itself is not accepted on Apply. */
  MAX_CALCULATION_FINGERPRINT_LENGTH: 256,
  MAX_IDEMPOTENCY_KEY_LENGTH: 200,
  HISTORY_DEFAULT_PAGE_SIZE: 20,
  HISTORY_MAX_PAGE_SIZE: 100,
  HISTORY_MAX_CURSOR_LENGTH: 512,
} as const;

/**
 * Future mutation routes layer these windows over the current generic API
 * tenant/user windows because recalculation and order locking are costlier than
 * ordinary reads. They are policy constants only until Preview/Apply exist.
 */
export const ORDER_CHANGE_RATE_LIMITS = {
  PREVIEW_PER_ACTOR_PER_MINUTE: 30,
  PREVIEW_PER_ORDER_PER_MINUTE: 10,
  APPLY_PER_ACTOR_PER_MINUTE: 10,
  APPLY_PER_ORDER_PER_MINUTE: 5,
} as const;

/** Union of the live Change catalog codes accepted by the v3 contract. */
export type OrderChangeOperationCode = (typeof ORDER_CHANGE_OPERATION_CODES)[number];

/** Union of stable persisted and batch-local identity kinds accepted by v3. */
export type OrderChangeTargetKind = (typeof ORDER_CHANGE_TARGET_KINDS)[number];

/** Seeded catalog operations whose commercial writer has not shipped; an ALLOW cell cannot enable them. */
export const ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES = [
  'CHANGE_CUSTOMER', 'CHANGE_BRANCH', 'CHANGE_ORDER_TYPE', 'CHANGE_EXPRESS', 'CHANGE_QUICK_DROP',
  'CHANGE_PAYMENT_NOTES', 'CHANGE_ORDER_SOURCE', 'CHANGE_PHYSICAL_INTAKE', 'CHANGE_B2B_REFERENCE',
  'CHANGE_DISCOUNT', 'CHANGE_PAYMENT_TYPE', 'CHANGE_ITEM_PRODUCT', 'CHANGE_ITEM_SERVICE',
  'CHANGE_ITEM_PRICE', 'CHANGE_PIECE_BRAND', 'CHANGE_PIECE_RACK',
] as const satisfies readonly OrderChangeOperationCode[];

/**
 * Keeps runtime writers and editing controls closed independently of policy authoring.
 * @param code - Catalog operation accepted by the bounded request schema.
 * @returns Whether a governed writer exists for this operation.
 */
export function isOrderChangeOperationWriterAvailable(code: OrderChangeOperationCode): boolean {
  return !(ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES as readonly OrderChangeOperationCode[]).includes(code);
}

/** Known editable fields must use their governed operation rather than a residual-rule permission. */
const ORDER_CHANGE_KNOWN_FIELD_OPERATIONS: Readonly<Record<string, OrderChangeOperationCode>> = {
  productId: 'CHANGE_ITEM_PRODUCT', serviceCategoryCode: 'CHANGE_ITEM_SERVICE', pricePerUnit: 'CHANGE_ITEM_PRICE',
  priceOverride: 'CHANGE_ITEM_PRICE', overrideReason: 'CHANGE_ITEM_PRICE', brand: 'CHANGE_PIECE_BRAND', rackLocation: 'CHANGE_PIECE_RACK',
  customerId: 'CHANGE_CUSTOMER', branchId: 'CHANGE_BRANCH', orderTypeId: 'CHANGE_ORDER_TYPE',
  express: 'CHANGE_EXPRESS', isQuickDrop: 'CHANGE_QUICK_DROP', quickDropQuantity: 'CHANGE_QUICK_DROP',
  paymentNotes: 'CHANGE_PAYMENT_NOTES', orderSourceCode: 'CHANGE_ORDER_SOURCE',
  physicalIntakeStatus: 'CHANGE_PHYSICAL_INTAKE', physicalIntakeInfo: 'CHANGE_PHYSICAL_INTAKE', receivedInfo: 'CHANGE_PHYSICAL_INTAKE',
  b2bContractId: 'CHANGE_B2B_REFERENCE', costCenterCode: 'CHANGE_B2B_REFERENCE', poNumber: 'CHANGE_B2B_REFERENCE',
  discountRate: 'CHANGE_DISCOUNT', discountType: 'CHANGE_DISCOUNT', promoCodeId: 'CHANGE_DISCOUNT', giftCardId: 'CHANGE_DISCOUNT',
  promoDiscountAmount: 'CHANGE_DISCOUNT', giftCardDiscountAmount: 'CHANGE_DISCOUNT',
  paymentTypeCode: 'CHANGE_PAYMENT_TYPE', priority: 'CHANGE_PRIORITY', serviceSpeed: 'CHANGE_SERVICE_SPEED',
  notes: 'CHANGE_ORDER_NOTES', customerNotes: 'CHANGE_ORDER_NOTES',
  customerName: 'CHANGE_CUSTOMER_SNAPSHOT', customerMobile: 'CHANGE_CUSTOMER_SNAPSHOT', customerEmail: 'CHANGE_CUSTOMER_SNAPSHOT',
  isDefaultCustomer: 'CHANGE_CUSTOMER_SNAPSHOT', customerDetails: 'CHANGE_CUSTOMER_SNAPSHOT',
  'order.readyBy': 'CHANGE_READY_BY', readyBy: 'CHANGE_READY_BY',
  'item.productId': 'CHANGE_ITEM_PRODUCT', 'item.serviceCategoryCode': 'CHANGE_ITEM_SERVICE',
  'item.pricePerUnit': 'CHANGE_ITEM_PRICE', 'item.priceOverride': 'CHANGE_ITEM_PRICE', 'item.overrideReason': 'CHANGE_ITEM_PRICE',
  'piece.brand': 'CHANGE_PIECE_BRAND', 'piece.rackLocation': 'CHANGE_PIECE_RACK',
  'item.packing': 'ADD_PREFERENCE', 'item.stain': 'ADD_PREFERENCE', 'item.stainNotes': 'ADD_PREFERENCE',
  'item.damage': 'ADD_PREFERENCE', 'item.damageNotes': 'ADD_PREFERENCE', 'item.notes': 'ADD_PREFERENCE',
  'piece.color': 'ADD_PREFERENCE', 'piece.notes': 'ADD_PREFERENCE', 'piece.conditions': 'ADD_PREFERENCE',
  'piece.packing': 'ADD_PREFERENCE', 'piece.stain': 'ADD_PREFERENCE', 'piece.damage': 'ADD_PREFERENCE', 'preference.code': 'ADD_PREFERENCE',
};

/**
 * Classifies known draft fields without inventing a preference row or authorizing its mutation.
 * @param field - Draft field path or existing request field token.
 * @returns Required catalog operation, or null only for a genuinely unknown field.
 */
export function resolveOrderChangeKnownFieldOperation(field: string): OrderChangeOperationCode | null {
  const key = field.startsWith('order.') ? field.slice('order.'.length) : field;
  return Object.hasOwn(ORDER_CHANGE_KNOWN_FIELD_OPERATIONS, key) ? ORDER_CHANGE_KNOWN_FIELD_OPERATIONS[key] : null;
}
