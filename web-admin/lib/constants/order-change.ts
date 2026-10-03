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

/** Union of the frozen Change operation codes accepted by the v3 contract. */
export type OrderChangeOperationCode = (typeof ORDER_CHANGE_OPERATION_CODES)[number];

/** Union of stable persisted and batch-local identity kinds accepted by v3. */
export type OrderChangeTargetKind = (typeof ORDER_CHANGE_TARGET_KINDS)[number];
