import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ORDER_CHANGE_LIMITS,
  type OrderChangeOperationCode,
} from '@/lib/constants/order-change';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';

/** The only policy target domains that V1 Change operations may address. */
export const ORDER_CHANGE_CAPABILITY_TARGET_TYPES = ['ORDER', 'ITEM', 'PIECE', 'PREFERENCE'] as const;

/** Derives the controlled target-domain union from the frozen policy tokens. */
export type OrderChangeCapabilityTargetType = (typeof ORDER_CHANGE_CAPABILITY_TARGET_TYPES)[number];

/** The finite outcomes exposed by capability evaluation and bound into review proof. */
export const ORDER_CHANGE_CAPABILITY_DECISIONS = [
  'ALLOW',
  'ALLOW_WITH_WARNING',
  'REQUIRE_OVERRIDE',
  'DENY',
] as const;

/** Derives the allowed policy outcome from the persisted profile binding contract. */
export type OrderChangeCapabilityDecisionKind = (typeof ORDER_CHANGE_CAPABILITY_DECISIONS)[number];

/** A profile-owned, stage-specific authorization rule for exactly one Change operation domain. */
export interface OrderChangeCapabilityBinding {
  /** Exact Edit Policy selected by the trusted tenant/profile resolver. */
  editPolicyId: string;
  /** Immutable workflow profile version that supplied this binding. */
  profileVersionId: string;
  /** Published policy revision used to invalidate a stale review. */
  policyRevision: number;
  /** Exact current workflow status; wildcard status bindings are deliberately unsupported. */
  workflowStatus: string;
  /** Frozen V1 Change operation. */
  operationCode: OrderChangeOperationCode;
  /** Semantic commercial target derived server-side from the operation code. */
  targetType: OrderChangeCapabilityTargetType;
  /** Result when all hard domain gates and permissions are satisfied. */
  decision: OrderChangeCapabilityDecisionKind;
  /** Stable code for a warning, required reason, override, or denial. */
  reasonCode: string;
  /** Localized client message lookup key; browser text is never policy authority. */
  messageKey: string;
  /** Requires an operator-entered reason even when the operation does not need an override. */
  requiresReason?: boolean;
  /** Optional specialized permission such as a sensitive operational override. */
  requiredPermissionCode?: string;
  /** Permission needed for REQUIRE_OVERRIDE; defaults to the V2 override permission. */
  overridePermissionCode?: string;
}

/** Server-derived order facts that determine whether any operation can be evaluated. */
export interface OrderChangeCapabilityOrderFacts {
  /** Resolved from the independent default-off `order_edit_v2` feature flag by a future server boundary. */
  featureEnabled: boolean;
  /** V2 commitment is a prerequisite and is not inferred from workflow status. */
  committedAt: Date | null;
  /** Per-order access state persisted on the governed order. */
  editAccessStatus: 'OPEN' | 'TEMPORARILY_BLOCKED' | 'PERMANENTLY_BLOCKED' | string | null;
  /** Expiry is meaningful only for a temporary block. */
  editBlockedUntil: Date | null;
  /** Current workflow status without status-transition side effects. */
  workflowStatus: string | null;
  /** Optimistic commercial revision included in proof binding. */
  editStateVersion: number;
  /** Workflow-owned revision included in proof binding. */
  wfStateVersion: number;
}

/** Server-derived actor and authorization adapter used without trusting browser claims. */
export interface OrderChangeCapabilityActor {
  /** Authenticated user ID resolved by the server boundary. */
  actorUserId: string;
  /** Checks a permission from the authenticated tenant membership context. */
  canUsePermission: (permissionCode: string) => Promise<boolean>;
}

/** Candidate operation evaluated after request-shape validation and before projection. */
export interface OrderChangeCapabilityOperation {
  /** Frozen V1 operation code. */
  code: OrderChangeOperationCode;
  /** Server-derived parent scope for ADD_PREFERENCE; never browser-authored policy input. */
  preferenceParentTargetType?: Extract<OrderChangeCapabilityTargetType, 'ORDER' | 'ITEM' | 'PIECE'>;
  /** Sequence is retained so a result cannot be reused for a different submitted operation. */
  seq: number;
  /** Whether a reason was supplied in the request or operation payload. */
  hasReason: boolean;
  /** Hard domain facts are produced by structural/fiscal/pricing owners, never by the browser. */
  hardDenial?: { code: string; messageKey: string } | null;
}

/** Capability result returned for one operation and later bound into a review proof. */
export interface OrderChangeCapabilityResult {
  /** Original operation sequence. */
  seq: number;
  /** Original frozen operation code. */
  operationCode: OrderChangeOperationCode;
  /** Server-derived semantic target domain. */
  targetType: OrderChangeCapabilityTargetType;
  /** Controlled decision outcome. */
  decision: OrderChangeCapabilityDecisionKind;
  /** Stable machine code suitable for audit and localized UI lookup. */
  reasonCode: string;
  /** Stable localized message key, never browser-authored text. */
  messageKey: string;
  /** Warning acknowledgements are mandatory before Apply when true. */
  requiresAcknowledgement: boolean;
  /** Reason requirements cannot be silently waived by the client. */
  requiresReason: boolean;
  /** Present only when a configured override is possible. */
  overridePermissionCode: string | null;
  /** Policy identity used by the Preview/Apply proof contract. */
  policyIdentity: { editPolicyId: string; profileVersionId: string; policyRevision: number } | null;
}

/** Error codes for invalid review-proof material without revealing key or payload internals. */
export type OrderChangeReviewProofErrorCode =
  | 'ORDER_CHANGE_REVIEW_PROOF_INVALID'
  | 'ORDER_CHANGE_REVIEW_PROOF_STALE'
  | 'ORDER_CHANGE_REVIEW_PROOF_SIGNER_UNAVAILABLE';

/** Thrown when a review proof cannot safely authorize a future Change command. */
export class OrderChangeReviewProofError extends Error {
  /** Stable error code consumed by the future V3 error-envelope adapter. */
  readonly code: OrderChangeReviewProofErrorCode;

  /** @param code Stable error code. @param message Safe server-side diagnostic message. */
  constructor(code: OrderChangeReviewProofErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Explicit injected key material; configuration ownership and rotation policy remain external release gates. */
export interface OrderChangeReviewProofKey {
  /** Non-secret key identifier included in the token so an approved key ring can rotate safely. */
  keyId: string;
  /** Server-only HMAC key. This module never reads an environment variable or exposes the secret. */
  secret: string;
}

/** Canonical facts a proof binds so a changed review cannot be replayed as a different Change. */
export interface OrderChangeReviewProofBinding {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  expectedEditStateVersion: number;
  expectedWfStateVersion: number;
  sourceContext: string;
  canonicalIntent: unknown;
  changeReason: string | null;
  gateDecisions: unknown;
  policyIdentity: { editPolicyId: string; profileVersionId: string; policyRevision: number };
  policyFacts: unknown;
  calculationFingerprint: string;
  settlementSourceFingerprint: string;
}

type OrderChangeReviewProofPayload = {
  v: 1;
  kid: string;
  tenantId: string;
  orderId: string;
  actorUserId: string;
  expectedEditStateVersion: number;
  expectedWfStateVersion: number;
  sourceContext: string;
  intentDigest: string;
  reasonDigest: string;
  decisionsDigest: string;
  editPolicyId: string;
  profileVersionId: string;
  policyRevision: number;
  policyFactsDigest: string;
  calculationFingerprint: string;
  settlementSourceFingerprint: string;
  exp: number;
};

const ORDER_CHANGE_REVIEW_PROOF_TTL_SECONDS = 300;
const ORDER_CHANGE_REVIEW_PROOF_DOMAIN = 'cleanmatex.order-change.review-proof.v1';

/**
 * Maps a request operation to its commercial policy target so a browser cannot
 * select a more permissive target class for the same operation.
 */
export function resolveOrderChangeCapabilityTarget(
  operationCode: OrderChangeOperationCode,
  preferenceParentTargetType?: Extract<OrderChangeCapabilityTargetType, 'ORDER' | 'ITEM' | 'PIECE'>,
): OrderChangeCapabilityTargetType {
  if (operationCode === 'ADD_ITEM') return 'ORDER';
  if (operationCode === 'REMOVE_ITEM' || operationCode === 'CHANGE_ITEM_QUANTITY') return 'ITEM';
  if (operationCode === 'ADD_PIECE') return 'ITEM';
  if (operationCode === 'REMOVE_PIECE') return 'PIECE';
  if (operationCode === 'ADD_PREFERENCE') {
    if (!preferenceParentTargetType) throw new Error('Preference parent scope is required.');
    return preferenceParentTargetType;
  }
  if (operationCode === 'CHANGE_PREFERENCE' || operationCode === 'REMOVE_PREFERENCE') return 'PREFERENCE';
  return 'ORDER';
}

/**
 * Evaluates one operation only against an explicit published profile binding.
 * Missing profile data, missing permissions, non-committed orders, and hard
 * domain denials are all fail-closed to prevent legacy editability from becoming authorization.
 */
export async function evaluateOrderChangeCapability(input: {
  facts: OrderChangeCapabilityOrderFacts;
  actor: OrderChangeCapabilityActor;
  operation: OrderChangeCapabilityOperation;
  bindings: readonly OrderChangeCapabilityBinding[];
  now?: Date;
}): Promise<OrderChangeCapabilityResult> {
  let targetType: OrderChangeCapabilityTargetType;
  try {
    targetType = resolveOrderChangeCapabilityTarget(
      input.operation.code,
      input.operation.preferenceParentTargetType,
    );
  } catch {
    return {
      seq: input.operation.seq,
      operationCode: input.operation.code,
      targetType: 'PREFERENCE',
      decision: 'DENY',
      reasonCode: 'CAPABILITY_TARGET_UNAVAILABLE',
      messageKey: 'orderChange.capability.targetUnavailable',
      requiresAcknowledgement: false,
      requiresReason: false,
      overridePermissionCode: null,
      policyIdentity: null,
    };
  }
  const denial = (reasonCode: string, messageKey: string): OrderChangeCapabilityResult => ({
    seq: input.operation.seq,
    operationCode: input.operation.code,
    targetType,
    decision: 'DENY',
    reasonCode,
    messageKey,
    requiresAcknowledgement: false,
    requiresReason: false,
    overridePermissionCode: null,
    policyIdentity: null,
  });

  if (!input.facts.committedAt) return denial('ORDER_NOT_COMMITTED', 'orderChange.capability.orderNotCommitted');
  if (!input.facts.featureEnabled) return denial('FEATURE_DISABLED', 'orderChange.capability.featureDisabled');
  const accessDenial = getEditAccessDenial(input.facts, input.now ?? new Date());
  if (accessDenial) return denial(accessDenial.code, accessDenial.messageKey);
  if (!input.facts.workflowStatus?.trim()) return denial('WORKFLOW_STATUS_UNAVAILABLE', 'orderChange.capability.workflowStatusUnavailable');
  if (input.operation.hardDenial) return denial(input.operation.hardDenial.code, input.operation.hardDenial.messageKey);
  if (!await input.actor.canUsePermission(ORDERS_PERMISSIONS.EDIT)) return denial('PERMISSION_DENIED', 'orderChange.capability.permissionDenied');

  const binding = input.bindings.find((candidate) =>
    candidate.workflowStatus === input.facts.workflowStatus
    && candidate.operationCode === input.operation.code
    && candidate.targetType === targetType,
  );
  if (!binding) return denial('CAPABILITY_POLICY_BINDING_MISSING', 'orderChange.capability.policyBindingMissing');
  if (binding.decision === 'DENY') return denial(binding.reasonCode, binding.messageKey);
  if (binding.requiredPermissionCode && !await input.actor.canUsePermission(binding.requiredPermissionCode)) {
    return denial('PERMISSION_DENIED', 'orderChange.capability.permissionDenied');
  }
  if (binding.requiresReason && !input.operation.hasReason) {
    return denial('CHANGE_REASON_REQUIRED', 'orderChange.capability.reasonRequired');
  }
  const overridePermissionCode = binding.overridePermissionCode ?? ORDERS_PERMISSIONS.EDIT_OVERRIDE;
  if (binding.decision === 'REQUIRE_OVERRIDE' && !await input.actor.canUsePermission(overridePermissionCode)) {
    return denial('OVERRIDE_FORBIDDEN', 'orderChange.capability.overrideForbidden');
  }

  return {
    seq: input.operation.seq,
    operationCode: input.operation.code,
    targetType,
    decision: binding.decision,
    reasonCode: binding.reasonCode,
    messageKey: binding.messageKey,
    requiresAcknowledgement: binding.decision === 'ALLOW_WITH_WARNING',
    requiresReason: Boolean(binding.requiresReason) || binding.decision === 'REQUIRE_OVERRIDE',
    overridePermissionCode: binding.decision === 'REQUIRE_OVERRIDE' ? overridePermissionCode : null,
    policyIdentity: { editPolicyId: binding.editPolicyId, profileVersionId: binding.profileVersionId, policyRevision: binding.policyRevision },
  };
}

/**
 * Issues a bounded, domain-separated review proof from injected server-only key material.
 * The caller must supply a key from an approved provisioning and rotation owner.
 */
export function issueOrderChangeReviewProof(input: {
  key: OrderChangeReviewProofKey;
  binding: OrderChangeReviewProofBinding;
  now?: Date;
}): string {
  const key = assertProofKey(input.key);
  const payload: OrderChangeReviewProofPayload = {
    v: 1,
    kid: key.keyId,
    tenantId: input.binding.tenantId,
    orderId: input.binding.orderId,
    actorUserId: input.binding.actorUserId,
    expectedEditStateVersion: input.binding.expectedEditStateVersion,
    expectedWfStateVersion: input.binding.expectedWfStateVersion,
    sourceContext: input.binding.sourceContext,
    intentDigest: digestCanonical(input.binding.canonicalIntent),
    reasonDigest: digestCanonical(input.binding.changeReason),
    decisionsDigest: digestCanonical(input.binding.gateDecisions),
    editPolicyId: input.binding.policyIdentity.editPolicyId,
    profileVersionId: input.binding.policyIdentity.profileVersionId,
    policyRevision: input.binding.policyIdentity.policyRevision,
    policyFactsDigest: digestCanonical(input.binding.policyFacts),
    calculationFingerprint: input.binding.calculationFingerprint,
    settlementSourceFingerprint: input.binding.settlementSourceFingerprint,
    exp: Math.floor((input.now?.getTime() ?? Date.now()) / 1000) + ORDER_CHANGE_REVIEW_PROOF_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signProof(encoded, key.secret)}`;
}

/**
 * Verifies signature, expiry, and every command-relevant review binding before future Apply work.
 * Completed idempotent replay is intentionally outside this function and remains a durable-response lookup.
 */
export function verifyOrderChangeReviewProof(input: {
  proof: string;
  keys: readonly OrderChangeReviewProofKey[];
  expected: OrderChangeReviewProofBinding;
  now?: Date;
}): void {
  if (input.proof.length === 0 || input.proof.length > ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH) {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof is invalid.');
  }
  const [encoded, signature, extra] = input.proof.split('.');
  if (!encoded || !signature || extra) throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof is invalid.');

  const payload = parseProofPayload(encoded);
  const key = input.keys.find((candidate) => candidate.keyId === payload.kid);
  if (!key) throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_SIGNER_UNAVAILABLE', 'Review proof signer is unavailable.');
  const normalizedKey = assertProofKey(key);
  const expectedSignature = signProof(encoded, normalizedKey.secret);
  const presented = Buffer.from(signature);
  const computed = Buffer.from(expectedSignature);
  if (presented.length !== computed.length || !timingSafeEqual(presented, computed)) {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof is invalid.');
  }
  if (payload.exp < Math.floor((input.now?.getTime() ?? Date.now()) / 1000)) {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_STALE', 'Review proof has expired.');
  }
  const expected = toProofPayload(input.expected, payload.kid, payload.exp);
  const comparisonKeys: Array<keyof OrderChangeReviewProofPayload> = [
    'v', 'kid', 'tenantId', 'orderId', 'actorUserId', 'expectedEditStateVersion', 'expectedWfStateVersion',
    'sourceContext', 'intentDigest', 'reasonDigest', 'decisionsDigest', 'editPolicyId', 'profileVersionId', 'policyRevision',
    'policyFactsDigest', 'calculationFingerprint', 'settlementSourceFingerprint',
  ];
  if (comparisonKeys.some((field) => payload[field] !== expected[field])) {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_STALE', 'Review proof is no longer valid for this Change.');
  }
}

function getEditAccessDenial(facts: OrderChangeCapabilityOrderFacts, now: Date): { code: string; messageKey: string } | null {
  if (facts.editAccessStatus === 'PERMANENTLY_BLOCKED') return { code: 'EDIT_ACCESS_BLOCKED', messageKey: 'orderChange.capability.permanentlyBlocked' };
  if (facts.editAccessStatus === 'TEMPORARILY_BLOCKED') {
    if (!facts.editBlockedUntil || Number.isNaN(facts.editBlockedUntil.getTime()) || facts.editBlockedUntil > now) {
      return { code: 'EDIT_ACCESS_BLOCKED', messageKey: 'orderChange.capability.temporarilyBlocked' };
    }
  }
  if (facts.editAccessStatus !== null && facts.editAccessStatus !== 'OPEN' && facts.editAccessStatus !== 'TEMPORARILY_BLOCKED') {
    return { code: 'EDIT_ACCESS_BLOCKED', messageKey: 'orderChange.capability.accessStateInvalid' };
  }
  return null;
}

function assertProofKey(key: OrderChangeReviewProofKey): OrderChangeReviewProofKey {
  if (!key.keyId.trim() || !key.secret.trim()) {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_SIGNER_UNAVAILABLE', 'Review proof signer is unavailable.');
  }
  return { keyId: key.keyId.trim(), secret: key.secret.trim() };
}

function signProof(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(`${ORDER_CHANGE_REVIEW_PROOF_DOMAIN}.${encoded}`).digest('base64url');
}

function parseProofPayload(encoded: string): OrderChangeReviewProofPayload {
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<OrderChangeReviewProofPayload>;
    if (
      payload.v !== 1 || typeof payload.kid !== 'string' || typeof payload.tenantId !== 'string'
      || typeof payload.orderId !== 'string' || typeof payload.actorUserId !== 'string'
      || !Number.isInteger(payload.expectedEditStateVersion) || !Number.isInteger(payload.expectedWfStateVersion)
      || typeof payload.sourceContext !== 'string' || typeof payload.intentDigest !== 'string'
      || typeof payload.reasonDigest !== 'string' || typeof payload.decisionsDigest !== 'string'
      || typeof payload.editPolicyId !== 'string' || typeof payload.profileVersionId !== 'string' || !Number.isInteger(payload.policyRevision)
      || typeof payload.policyFactsDigest !== 'string' || typeof payload.calculationFingerprint !== 'string'
      || typeof payload.settlementSourceFingerprint !== 'string' || !Number.isInteger(payload.exp)
    ) throw new Error('invalid payload');
    return payload as OrderChangeReviewProofPayload;
  } catch {
    throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof is invalid.');
  }
}

function toProofPayload(binding: OrderChangeReviewProofBinding, keyId: string, exp: number): OrderChangeReviewProofPayload {
  return {
    v: 1,
    kid: keyId,
    tenantId: binding.tenantId,
    orderId: binding.orderId,
    actorUserId: binding.actorUserId,
    expectedEditStateVersion: binding.expectedEditStateVersion,
    expectedWfStateVersion: binding.expectedWfStateVersion,
    sourceContext: binding.sourceContext,
    intentDigest: digestCanonical(binding.canonicalIntent),
    reasonDigest: digestCanonical(binding.changeReason),
    decisionsDigest: digestCanonical(binding.gateDecisions),
    editPolicyId: binding.policyIdentity.editPolicyId,
    profileVersionId: binding.policyIdentity.profileVersionId,
    policyRevision: binding.policyIdentity.policyRevision,
    policyFactsDigest: digestCanonical(binding.policyFacts),
    calculationFingerprint: binding.calculationFingerprint,
    settlementSourceFingerprint: binding.settlementSourceFingerprint,
    exp,
  };
}

function digestCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof input is invalid.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new OrderChangeReviewProofError('ORDER_CHANGE_REVIEW_PROOF_INVALID', 'Review proof input is invalid.');
}

