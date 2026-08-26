import 'server-only';

import type { ResolvedWorkflowInitialRule } from './workflow-profile-resolution.service';

/** Inputs used to match a creation context against immutable profile rules. */
export interface ResolveInitialStatusParams {
  orderSourceCode?: string | null;
  orderTypeId?: string | null;
  isRetail?: boolean | null;
  isQuickDrop?: boolean | null;
  /** Immutable semantic artifact rules resolved with the order's profile snapshot. */
  semanticInitialRules: ResolvedWorkflowInitialRule[];
}

/** Deterministic initial workflow status and the rule that selected it. */
export interface ResolveInitialStatusResult {
  initialStatus: string;
  ruleCode: string | null;
}

/**
 * Signals a profile-policy configuration problem before any order is written.
 * An order must never silently borrow a mutable catalog default because its
 * compiled artifact is its creation-time and runtime authority.
 */
export class SemanticInitialStatusResolutionError extends Error {
  readonly code = 'PROFILE_INITIAL_RULE_UNMATCHED';

  /** Creates the stable semantic configuration error used by order adapters. */
  constructor() {
    super('The assigned workflow profile has no initial rule matching this order. Contact your platform administrator.');
    this.name = 'SemanticInitialStatusResolutionError';
  }
}

/**
 * Resolves an initial status from the already-validated immutable semantic
 * artifact. A semantic profile without a matching rule is invalid for the
 * order context, so this intentionally fails rather than falling back to a
 * mutable intake default.
 *
 * @param rules - Initial rules emitted by the immutable semantic artifact.
 * @param params - New-order facts used to select the most specific rule.
 */
export function resolveInitialStatusFromSemanticRules(
  rules: ResolvedWorkflowInitialRule[],
  params: Omit<ResolveInitialStatusParams, 'semanticInitialRules'>,
): ResolveInitialStatusResult {
  const source = params.orderSourceCode?.trim() || null;
  const typeId = params.orderTypeId?.trim() || null;
  const isRetail = params.isRetail ?? null;
  const isQuickDrop = params.isQuickDrop ?? null;

  for (const rule of [...rules].sort((left, right) => left.priority - right.priority || left.rule_code.localeCompare(right.rule_code))) {
    if (rule.order_source_code != null && rule.order_source_code !== source) continue;
    if (rule.order_type_id != null && rule.order_type_id !== typeId) continue;
    if (rule.is_retail != null && rule.is_retail !== isRetail) continue;
    if (rule.is_quick_drop != null && rule.is_quick_drop !== isQuickDrop) continue;

    const status = rule.initial_status.trim().toLowerCase();
    if (status && status !== 'closed') return { initialStatus: status, ruleCode: rule.rule_code };
  }

  throw new SemanticInitialStatusResolutionError();
}

/**
 * Resolves create-time operational status from the compiled order profile.
 * Lower priority wins. Null matchers are wildcards. Retail must never resolve
 * to `closed` (V1.0 ADR).
 *
 * @param params - New-order facts and optional immutable profile-rule snapshot.
 */
export async function resolveInitialStatus(
  params: ResolveInitialStatusParams,
): Promise<ResolveInitialStatusResult> {
  return resolveInitialStatusFromSemanticRules(params.semanticInitialRules, params);
}
