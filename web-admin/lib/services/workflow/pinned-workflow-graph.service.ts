import 'server-only';

import { prisma } from '@/lib/db/prisma';

export interface PinnedInitialRule {
  rule_code: string;
  order_source_code: string | null;
  order_type_id: string | null;
  is_retail: boolean | null;
  initial_status: string;
  priority: number;
  is_active?: boolean | null;
}

export interface PinnedGraphDefinition {
  schema_version: number;
  catalog_fingerprint: string;
  statuses: Record<string, unknown>[];
  screens: Record<string, unknown>[];
  screen_status_memberships: Array<{
    screen_key: string;
    status_code: string;
    is_active?: boolean | null;
  }>;
  actions: Array<{
    action_code: string;
    name: string;
    name2?: string | null;
    permission_code?: string | null;
    is_active?: boolean | null;
  }>;
  transitions: Array<{
    id: string;
    from_status: string;
    to_status: string;
    gate_set_code?: string | null;
    permission_code?: string | null;
    is_active?: boolean | null;
  }>;
  action_maps: Array<{
    screen_key: string;
    action_code: string;
    transition_id: string;
    is_active?: boolean | null;
  }>;
  gates: Record<string, unknown>[];
  initial_rules: PinnedInitialRule[];
  system_screen_contracts: Record<string, unknown>[];
}

export interface PinnedActionTransitionRow {
  action_code: string;
  name: string;
  name2: string | null;
  action_permission_code: string | null;
  from_status: string;
  to_status: string;
  gate_set_code: string | null;
  transition_permission_code: string | null;
}

type ProfileVersionPinRow = {
  wf_graph_def_version_id: string | null;
};

type GraphDefRow = {
  graph_definition: PinnedGraphDefinition;
  catalog_fingerprint: string;
};

/** Loads graph snapshot pinned on a profile version (any status — keeps orders working after unpublish). */
export async function loadPinnedGraphForProfileVersion(
  profileId: string,
  versionNo: number,
): Promise<PinnedGraphDefinition | null> {
  const versions = await prisma.$queryRaw<ProfileVersionPinRow[]>`
    SELECT wf_graph_def_version_id::text
    FROM public.sys_wf_profile_ver_mst
    WHERE profile_id = ${profileId}::uuid
      AND version_no = ${versionNo}
      AND version_status IN ('PUBLISHED', 'DRAFT', 'RETIRED')
    LIMIT 1
  `;
  const graphDefId = versions[0]?.wf_graph_def_version_id;
  if (!graphDefId) return null;

  const graphRows = await prisma.$queryRaw<GraphDefRow[]>`
    SELECT graph_definition, catalog_fingerprint
    FROM public.sys_wf_graph_def_ver_mst
    WHERE graph_def_version_id = ${graphDefId}::uuid
    LIMIT 1
  `;
  const row = graphRows[0];
  if (!row?.graph_definition) return null;
  return row.graph_definition;
}

export function isPinnedScreenStatusMember(
  graph: PinnedGraphDefinition,
  screen: string,
  statusCode: string,
): boolean {
  return graph.screen_status_memberships.some(
    (m) =>
      m.screen_key === screen &&
      m.status_code === statusCode &&
      (m.is_active ?? true),
  );
}

export function loadPinnedActionTransitions(
  graph: PinnedGraphDefinition,
  screen: string,
  fromStatus: string,
  actionCode?: string,
): PinnedActionTransitionRow[] {
  const activeMaps = graph.action_maps.filter(
    (m) => m.screen_key === screen && (m.is_active ?? true),
  );
  const actionByCode = new Map(
    graph.actions
      .filter((a) => a.is_active ?? true)
      .map((a) => [a.action_code, a]),
  );
  const transitionById = new Map(
    graph.transitions
      .filter((t) => t.is_active ?? true)
      .map((t) => [t.id, t]),
  );

  const rows: PinnedActionTransitionRow[] = [];
  for (const map of activeMaps) {
    const action = actionByCode.get(map.action_code);
    const transition = transitionById.get(map.transition_id);
    if (!action || !transition || transition.from_status !== fromStatus) continue;
    if (actionCode && action.action_code !== actionCode) continue;
    rows.push({
      action_code: action.action_code,
      name: action.name,
      name2: action.name2 ?? null,
      action_permission_code: action.permission_code ?? null,
      from_status: transition.from_status,
      to_status: transition.to_status,
      gate_set_code: transition.gate_set_code ?? null,
      transition_permission_code: transition.permission_code ?? null,
    });
  }

  return rows.sort((a, b) => a.action_code.localeCompare(b.action_code));
}
