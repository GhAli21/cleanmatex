import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { loadPinnedGraphForProfileVersion, type PinnedInitialRule } from './pinned-workflow-graph.service';
import type { ResolvedWorkflowInitialRule } from './workflow-profile-resolution.service';

export interface ResolveInitialStatusParams {
  orderSourceCode?: string | null;
  orderTypeId?: string | null;
  isRetail?: boolean | null;
  isQuickDrop?: boolean | null;
  /** When set, initial rules are read from the pinned graph def (V2 orders). */
  wfProfileId?: string | null;
  wfVersionNo?: number | null;
  /** Immutable semantic artifact rules resolved with the order's profile snapshot. */
  semanticInitialRules?: ResolvedWorkflowInitialRule[] | null;
}

export interface ResolveInitialStatusResult {
  initialStatus: string;
  ruleCode: string | null;
}

const FALLBACK_STATUS = 'intake';

type InitialRuleRow = {
  rule_code: string;
  order_source_code: string | null;
  order_type_id: string | null;
  is_retail: boolean | null;
  initial_status: string;
  priority: number;
};

/**
 * Resolve create-time operational status from pinned initial rules (immutable graph def).
 */
export function resolveInitialStatusFromPinnedRules(
  rules: PinnedInitialRule[],
  params: Omit<ResolveInitialStatusParams, 'wfProfileId' | 'wfVersionNo'>,
): ResolveInitialStatusResult {
  const source = params.orderSourceCode?.trim() || null;
  const typeId = params.orderTypeId?.trim() || null;
  const isRetail = params.isRetail ?? null;

  const activeRules = rules
    .filter((r) => r.is_active ?? true)
    .sort((a, b) => a.priority - b.priority || a.rule_code.localeCompare(b.rule_code));

  for (const rule of activeRules) {
    if (rule.order_source_code != null && rule.order_source_code !== source) continue;
    if (rule.order_type_id != null && rule.order_type_id !== typeId) continue;
    if (rule.is_retail != null && rule.is_retail !== isRetail) continue;

    const status = (rule.initial_status ?? '').trim().toLowerCase();
    if (!status || status === 'closed') continue;

    return { initialStatus: status, ruleCode: rule.rule_code };
  }

  return { initialStatus: FALLBACK_STATUS, ruleCode: null };
}

/** Resolves an initial status from the already-validated immutable semantic artifact. */
export function resolveInitialStatusFromSemanticRules(
  rules: ResolvedWorkflowInitialRule[],
  params: Omit<ResolveInitialStatusParams, 'wfProfileId' | 'wfVersionNo' | 'semanticInitialRules'>,
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

  return { initialStatus: FALLBACK_STATUS, ruleCode: null };
}

/**
 * Resolve create-time operational status from `sys_wf_initial_rules_cd`.
 * Lower priority wins. Null matchers are wildcards.
 * Retail must never resolve to `closed` (V1.0 ADR).
 * V2: when wfProfileId + wfVersionNo are set, uses pinned initial rules from graph def.
 */
export async function resolveInitialStatus(
  params: ResolveInitialStatusParams,
): Promise<ResolveInitialStatusResult> {
  if (params.semanticInitialRules) {
    return resolveInitialStatusFromSemanticRules(params.semanticInitialRules, params);
  }
  if (params.wfProfileId && params.wfVersionNo != null) {
    const graph = await loadPinnedGraphForProfileVersion(params.wfProfileId, params.wfVersionNo);
    if (graph?.initial_rules?.length) {
      return resolveInitialStatusFromPinnedRules(graph.initial_rules, params);
    }
  }

  let rules: InitialRuleRow[] = [];
  try {
    rules = await prisma.$queryRaw<InitialRuleRow[]>`
      SELECT
        rule_code,
        order_source_code,
        order_type_id,
        is_retail,
        initial_status,
        priority
      FROM public.sys_wf_initial_rules_cd
      WHERE COALESCE(is_active, true) = true
      ORDER BY priority ASC, rule_code ASC
    `;
  } catch {
    return { initialStatus: FALLBACK_STATUS, ruleCode: null };
  }

  const source = params.orderSourceCode?.trim() || null;
  const typeId = params.orderTypeId?.trim() || null;
  const isRetail = params.isRetail ?? null;

  for (const rule of rules) {
    if (rule.order_source_code != null && rule.order_source_code !== source) {
      continue;
    }
    if (rule.order_type_id != null && rule.order_type_id !== typeId) {
      continue;
    }
    if (rule.is_retail != null && rule.is_retail !== isRetail) {
      continue;
    }

    const status = (rule.initial_status ?? '').trim().toLowerCase();
    if (!status || status === 'closed') {
      continue;
    }

    return { initialStatus: status, ruleCode: rule.rule_code };
  }

  return { initialStatus: FALLBACK_STATUS, ruleCode: null };
}
