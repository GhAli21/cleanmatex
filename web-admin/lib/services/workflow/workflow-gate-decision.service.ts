import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import { evaluateWorkflowGate, type WorkflowGateBlockedReason, type WorkflowGateOrderFacts, type WorkflowGateRuntimeMode } from '@/lib/services/workflow/workflow-gate-evaluator.service';
import type { SemanticWorkflowCommandChannel } from '@/lib/services/workflow/semantic-workflow-artifact.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const ACK_TTL_SECONDS = 300;
const GATE_DECISION_OUTBOX_EVENT_TYPE = 'WORKFLOW_GATE_DECISION_ACCEPTED';
const OPERATIONAL_CHANNELS = new Set(['staff_web', 'mobile', 'api', 'integration', 'pos']);

export type WorkflowGateDecisionErrorCode =
  | 'WF_GATE_HARD_BLOCKED'
  | 'WF_GATE_ACK_REQUIRED'
  | 'WF_GATE_ACK_INVALID'
  | 'WF_GATE_OVERRIDE_FORBIDDEN'
  | 'WF_GATE_OVERRIDE_REASON_INVALID'
  | 'WF_GATE_EVALUATOR_UNAVAILABLE'
  | 'WF_GATE_EVALUATION_STALE';

export class WorkflowGateDecisionError extends Error {
  readonly code: WorkflowGateDecisionErrorCode;
  readonly blockedReasons?: WorkflowGateBlockedReason[];

  constructor(
    code: WorkflowGateDecisionErrorCode,
    message: string,
    blockedReasons?: WorkflowGateBlockedReason[],
  ) {
    super(message);
    this.name = 'WorkflowGateDecisionError';
    this.code = code;
    this.blockedReasons = blockedReasons;
  }
}

export type SemanticGateBinding = {
  gate_code: string;
  blocking_mode: 'hard_block' | 'soft_warning' | 'override_allowed';
  evaluator_version: number;
  input_schema_version: number;
  override_permission_code?: string | null;
  override_min_reason_length?: number;
  message_key?: string | null;
};

export type SubmittedGateDecision = {
  gateCode: string;
  acknowledgementChallenge?: string;
  overrideReason?: string;
};

export type AvailableGateDecision = {
  gateCode: string;
  result: 'WARNING' | 'OVERRIDABLE';
  messageKey: string | null;
  acknowledgementChallenge?: string;
  overrideMinReasonLength?: number;
  overridePermissionCode?: string | null;
};

type ChallengePayload = {
  v: 1;
  tenantId: string;
  orderId: string;
  artifactId: string;
  actionCode: string;
  screen: string;
  gateCode: string;
  channel: SemanticWorkflowCommandChannel;
  actorUserId: string;
  stateVersion: number;
  fingerprint: string;
  exp: number;
};

function challengeSecret(): string {
  const secret = process.env.WORKFLOW_GATE_CHALLENGE_SECRET
    || process.env.SUPABASE_JWT_SECRET
    || process.env.NEXTAUTH_SECRET;
  if (!secret?.trim()) {
    throw new WorkflowGateDecisionError(
      'WF_GATE_EVALUATOR_UNAVAILABLE',
      'The gate acknowledgement signer is not configured.',
    );
  }
  return secret.trim();
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function hmacDigest(value: string): string {
  return createHmac('sha256', challengeSecret()).update(value).digest('base64url');
}

function effectiveMode(
  binding: SemanticGateBinding,
  channel: SemanticWorkflowCommandChannel,
): SemanticGateBinding['blocking_mode'] {
  if (channel === 'public_web' || !OPERATIONAL_CHANNELS.has(channel)) return 'hard_block';
  return binding.blocking_mode;
}

/** SHA-256 of canonical non-PII facts used to detect stale acknowledgements. */
export function fingerprintSafeGateFacts(
  facts: WorkflowGateOrderFacts,
  failedGateCodes: readonly string[],
): string {
  return createHash('sha256')
    .update(JSON.stringify({
      status: facts.currentStatus ?? null,
      preparationCompleted: (facts.preparationStatus ?? '').trim().toLowerCase() === 'completed',
      hasRack: Boolean(facts.rackLocation?.trim()),
      paymentType: String(facts.paymentTypeCode ?? '').trim().toUpperCase(),
      outstandingPositive: Number(facts.outstandingAmount ?? 0) > 0.001,
      failedGates: [...failedGateCodes].map((code) => code.trim().toLowerCase()).sort(),
    }))
    .digest('hex');
}

export function issueAcknowledgementChallenge(payload: Omit<ChallengePayload, 'v' | 'exp'>): string {
  const body: ChallengePayload = {
    v: 1,
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ACK_TTL_SECONDS,
  };
  const encoded = toBase64Url(JSON.stringify(body));
  return `${encoded}.${hmacDigest(encoded)}`;
}

export function verifyAcknowledgementChallenge(
  token: string,
  expected: Omit<ChallengePayload, 'v' | 'exp'>,
): void {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new WorkflowGateDecisionError('WF_GATE_ACK_INVALID', 'The acknowledgement challenge is invalid.');
  }
  const expectedSignature = hmacDigest(encoded);
  const presented = Buffer.from(signature);
  const computed = Buffer.from(expectedSignature);
  if (presented.length !== computed.length || !timingSafeEqual(presented, computed)) {
    throw new WorkflowGateDecisionError('WF_GATE_ACK_INVALID', 'The acknowledgement challenge is invalid.');
  }
  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ChallengePayload;
  } catch {
    throw new WorkflowGateDecisionError('WF_GATE_ACK_INVALID', 'The acknowledgement challenge is invalid.');
  }
  if (
    payload.v !== 1
    || payload.tenantId !== expected.tenantId
    || payload.orderId !== expected.orderId
    || payload.artifactId !== expected.artifactId
    || payload.actionCode !== expected.actionCode
    || payload.screen !== expected.screen
    || payload.gateCode !== expected.gateCode
    || payload.channel !== expected.channel
    || payload.actorUserId !== expected.actorUserId
    || payload.stateVersion !== expected.stateVersion
    || payload.fingerprint !== expected.fingerprint
    || payload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new WorkflowGateDecisionError(
      payload.fingerprint !== expected.fingerprint || payload.stateVersion !== expected.stateVersion
        ? 'WF_GATE_EVALUATION_STALE'
        : 'WF_GATE_ACK_INVALID',
      'The acknowledgement challenge is no longer valid for this command.',
    );
  }
}

export function classifySemanticGateFailures(input: {
  bindings: readonly SemanticGateBinding[];
  facts: WorkflowGateOrderFacts;
  runtimeMode: WorkflowGateRuntimeMode;
  channel: SemanticWorkflowCommandChannel;
  locale?: string;
  commandInput?: Record<string, unknown>;
}): {
  hardReasons: WorkflowGateBlockedReason[];
  failedBindings: SemanticGateBinding[];
} {
  const hardReasons: WorkflowGateBlockedReason[] = [];
  const failedBindings: SemanticGateBinding[] = [];
  for (const binding of input.bindings) {
    const result = evaluateWorkflowGate(
      binding.gate_code,
      input.facts,
      input.runtimeMode,
      input.locale,
      input.commandInput,
    );
    if (result.allowed) continue;
    failedBindings.push(binding);
    if (effectiveMode(binding, input.channel) === 'hard_block') {
      hardReasons.push(...result.blockedReasons);
    }
  }
  return { hardReasons, failedBindings };
}

export function buildAvailableGateDecisions(input: {
  tenantId: string;
  orderId: string;
  artifactId: string;
  actionCode: string;
  screen: string;
  channel: SemanticWorkflowCommandChannel;
  actorUserId: string;
  stateVersion: number;
  facts: WorkflowGateOrderFacts;
  failedBindings: readonly SemanticGateBinding[];
}): AvailableGateDecision[] {
  const fingerprint = fingerprintSafeGateFacts(
    input.facts,
    input.failedBindings.map((binding) => binding.gate_code),
  );
  return input.failedBindings.flatMap((binding): AvailableGateDecision[] => {
    const mode = effectiveMode(binding, input.channel);
    if (mode === 'hard_block') return [];
    if (mode === 'soft_warning') {
      return [{
        gateCode: binding.gate_code,
        result: 'WARNING',
        messageKey: binding.message_key ?? null,
        acknowledgementChallenge: issueAcknowledgementChallenge({
          tenantId: input.tenantId,
          orderId: input.orderId,
          artifactId: input.artifactId,
          actionCode: input.actionCode,
          screen: input.screen,
          gateCode: binding.gate_code.trim().toLowerCase(),
          channel: input.channel,
          actorUserId: input.actorUserId,
          stateVersion: input.stateVersion,
          fingerprint,
        }),
      }];
    }
    return [{
      gateCode: binding.gate_code,
      result: 'OVERRIDABLE',
      messageKey: binding.message_key ?? null,
      overrideMinReasonLength: Math.max(binding.override_min_reason_length ?? 10, 10),
      overridePermissionCode: binding.override_permission_code ?? null,
    }];
  });
}

export async function assertAndRecordSemanticGateDecisions(input: {
  tx: PrismaTransactionClient;
  tenantId: string;
  orderId: string;
  artifactId: string;
  profileVersionId?: string | null;
  // Retired compiled-artifact field (Gate 5, ADR-SAAS-MNG-0010) — written
  // into org_wf_gate_decision_mst.profile_artifact_id as an audit passthrough
  // only; its FK to the (now-dropped) artifact table was removed in
  // migration 0494. Never read back to make a decision.
  profileArtifactId?: string | null;
  actionCode: string;
  screen: string;
  channel: SemanticWorkflowCommandChannel;
  actorUserId: string;
  actorName?: string;
  idempotencyKey: string;
  requestCorrelationId?: string;
  stateVersion: number;
  facts: WorkflowGateOrderFacts;
  runtimeMode: WorkflowGateRuntimeMode;
  bindings: readonly SemanticGateBinding[];
  submitted: readonly SubmittedGateDecision[];
  commandInput?: Record<string, unknown>;
  canOverridePermission?: (permissionCode: string) => Promise<boolean>;
}): Promise<void> {
  const classified = classifySemanticGateFailures({
    bindings: input.bindings,
    facts: input.facts,
    runtimeMode: input.runtimeMode,
    channel: input.channel,
    commandInput: input.commandInput,
  });
  if (classified.hardReasons.length > 0) {
    throw new WorkflowGateDecisionError(
      'WF_GATE_HARD_BLOCKED',
      'One or more workflow gates blocked this action.',
      classified.hardReasons,
    );
  }
  if (classified.failedBindings.length === 0) return;

  const fingerprint = fingerprintSafeGateFacts(
    input.facts,
    classified.failedBindings.map((binding) => binding.gate_code),
  );
  const submittedByGate = new Map(
    input.submitted.map((decision) => [decision.gateCode.trim().toLowerCase(), decision]),
  );

  for (const binding of classified.failedBindings) {
    const mode = effectiveMode(binding, input.channel);
    const gateCode = binding.gate_code.trim().toLowerCase();
    const submitted = submittedByGate.get(gateCode);
    if (mode === 'soft_warning') {
      if (!submitted?.acknowledgementChallenge?.trim()) {
        throw new WorkflowGateDecisionError(
          'WF_GATE_ACK_REQUIRED',
          'This action requires acknowledgement of a current warning.',
        );
      }
      verifyAcknowledgementChallenge(submitted.acknowledgementChallenge.trim(), {
        tenantId: input.tenantId,
        orderId: input.orderId,
        artifactId: input.artifactId,
        actionCode: input.actionCode,
        screen: input.screen,
        gateCode,
        channel: input.channel,
        actorUserId: input.actorUserId,
        stateVersion: input.stateVersion,
        fingerprint,
      });
      await persistAcceptedDecision(input, {
        gateCode,
        binding,
        fingerprint,
        mode: 'soft_warning_acknowledged',
        ackChallenge: submitted.acknowledgementChallenge.trim(),
      });
      continue;
    }

    if (mode !== 'override_allowed') {
      throw new WorkflowGateDecisionError(
        'WF_GATE_HARD_BLOCKED',
        'One or more workflow gates blocked this action.',
      );
    }
    const permission = binding.override_permission_code?.trim();
    if (!permission) {
      throw new WorkflowGateDecisionError(
        'WF_GATE_OVERRIDE_FORBIDDEN',
        'This action cannot be overridden.',
      );
    }
    const allowed = input.canOverridePermission
      ? await input.canOverridePermission(permission)
      : false;
    if (!allowed) {
      throw new WorkflowGateDecisionError(
        'WF_GATE_OVERRIDE_FORBIDDEN',
        'The caller cannot override this workflow gate.',
      );
    }
    const minLength = Math.max(binding.override_min_reason_length ?? 10, 10);
    const reason = submitted?.overrideReason?.trim() ?? '';
    if (reason.length < minLength) {
      throw new WorkflowGateDecisionError(
        'WF_GATE_OVERRIDE_REASON_INVALID',
        `Override reason must be at least ${minLength} characters.`,
      );
    }
    await persistAcceptedDecision(input, {
      gateCode,
      binding,
      fingerprint,
      mode: 'override_authorized',
      overrideReason: reason,
      overrideMinLength: minLength,
    });
  }
}

async function persistAcceptedDecision(
  input: {
    tx: PrismaTransactionClient;
    tenantId: string;
    orderId: string;
    artifactId: string;
    profileVersionId?: string | null;
    profileArtifactId?: string | null;
    actionCode: string;
    screen: string;
    channel: SemanticWorkflowCommandChannel;
    actorUserId: string;
    actorName?: string;
    idempotencyKey: string;
    requestCorrelationId?: string;
  },
  decision: {
    gateCode: string;
    binding: SemanticGateBinding;
    fingerprint: string;
    mode: 'soft_warning_acknowledged' | 'override_authorized';
    ackChallenge?: string;
    overrideReason?: string;
    overrideMinLength?: number;
  },
): Promise<void> {
  if (!OPERATIONAL_CHANNELS.has(input.channel)) {
    throw new WorkflowGateDecisionError(
      'WF_GATE_OVERRIDE_FORBIDDEN',
      'Public channels cannot acknowledge or override workflow gates.',
    );
  }
  const ackHash = decision.ackChallenge
    ? createHash('sha256').update(decision.ackChallenge).digest('hex')
    : null;
  const correlation = (input.requestCorrelationId ?? input.idempotencyKey).trim().slice(0, 255);
  const actorSubject = (input.actorName?.trim() || input.actorUserId).slice(0, 255);
  const rows = await input.tx.$queryRaw<Array<{ decision_id: string }>>`
    INSERT INTO public.org_wf_gate_decision_mst (
      tenant_org_id,
      order_id,
      profile_artifact_id,
      profile_version_id,
      workflow_action_code,
      workflow_screen_key,
      gate_code,
      evaluator_version,
      input_schema_version,
      decision_mode,
      channel_code,
      actor_user_id,
      actor_subject,
      idempotency_key,
      request_correlation_id,
      evaluation_fingerprint,
      ack_challenge_hash,
      override_reason,
      override_reason_min_length
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.orderId}::uuid,
      ${input.profileArtifactId ?? null}::uuid,
      ${input.profileVersionId ?? input.artifactId}::uuid,
      ${input.actionCode},
      ${input.screen},
      ${decision.gateCode},
      ${decision.binding.evaluator_version},
      ${decision.binding.input_schema_version},
      ${decision.mode},
      ${input.channel},
      ${input.actorUserId}::uuid,
      ${actorSubject},
      ${input.idempotencyKey},
      ${correlation},
      ${decision.fingerprint},
      ${ackHash},
      ${decision.overrideReason ?? null},
      ${decision.mode === 'override_authorized' ? decision.overrideMinLength ?? 10 : 0}
    )
    RETURNING decision_id::text
  `;
  const decisionId = rows[0]?.decision_id;
  if (!decisionId) {
    throw new WorkflowGateDecisionError(
      'WF_GATE_EVALUATOR_UNAVAILABLE',
      'The gate decision could not be recorded.',
    );
  }
  await input.tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id: input.tenantId,
      event_type: GATE_DECISION_OUTBOX_EVENT_TYPE,
      aggregate_type: 'workflow_gate_decision',
      aggregate_id: decisionId,
      payload: {
        orderId: input.orderId,
        actionCode: input.actionCode,
        screen: input.screen,
        gateCode: decision.gateCode,
        decisionMode: decision.mode,
        channel: input.channel,
        fingerprint: decision.fingerprint,
      } as Prisma.InputJsonValue,
      status: OUTBOX_STATUSES.PENDING,
      attempts: 0,
      max_attempts: 6,
      next_retry_at: new Date(),
    },
  });
}
