import 'server-only'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import {
  isPinnedScreenStatusMember,
  loadPinnedGraphForProfileVersion,
  type PinnedGraphDefinition,
} from '@/lib/services/workflow/pinned-workflow-graph.service'
import {
  loadSemanticWorkflowArtifactForOrder,
  type SemanticWorkflowArtifact,
  type SemanticWorkflowOrderSnapshot,
} from '@/lib/services/workflow/semantic-workflow-artifact.service'
import { isSemanticScreenStatusMember } from '@/lib/services/workflow/semantic-workflow-runtime.service'
import {
  getWorkflowScreenContract,
  listWorkflowScreenKeysForStatus,
} from '@/lib/services/workflow-profile.service'
import type {
  WorkboardConfigurationGap,
  WorkboardListResponse,
  WorkboardOwnerScreenKey,
  WorkboardOrderRow,
  WorkboardQueryInput,
} from '@/lib/types/workboard'

const WORKBOARD_SCREEN_KEY = 'workboard'
const OWNER_SCREEN_KEYS = [
  'preparation',
  'processing',
  'assembly',
  'qa',
  'packing',
  'ready_release',
  'driver_delivery',
] as const

type OwnerScreenKey = WorkboardOwnerScreenKey

const EMPTY_OWNER_COUNTS: Record<OwnerScreenKey, number> = {
  preparation: 0,
  processing: 0,
  assembly: 0,
  qa: 0,
  packing: 0,
  ready_release: 0,
  driver_delivery: 0,
}

interface ProfilePairRow {
  wf_profile_id: string | null
  wf_version_no: number | null
  wf_profile_version_id: string | null
  wf_profile_artifact_id: string | null
  wf_profile_revision: number | null
  wf_profile_checksum: string | null
  wf_profile_schema_version: number | null
}

interface StatusLabelRow {
  status_code: string
  name: string | null
  name2: string | null
}

interface WorkboardRowSql {
  id: string
  order_no: string
  customer_name: string | null
  customer_phone: string | null
  branch_name: string | null
  current_status: string
  priority: string | null
  has_issue: boolean | null
  is_rejected: boolean | null
  received_at: Date | null
  last_transition_at: Date | null
  ready_by_at: Date | null
  wf_profile_id: string | null
  wf_version_no: number | null
  wf_profile_artifact_id: string | null
  assignee_name: string | null
}

interface WorkboardMetricRow {
  total: bigint
  blocked: bigint
  overdue: bigint
}

interface WorkboardOwnerMetricRow {
  current_status: string
  wf_profile_id: string | null
  wf_version_no: number | null
  wf_profile_artifact_id: string | null
  total: bigint
}

interface StatusScope {
  profileId: string | null
  versionNo: number | null
  artifactId: string | null
  ownerByStatus: Map<string, OwnerScreenKey>
}

function scopeKey(
  profileId: string | null,
  versionNo: number | null,
  artifactId: string | null,
): string {
  if (artifactId) return `semantic:${artifactId}`
  return profileId && versionNo !== null ? `${profileId}:${versionNo}` : 'legacy'
}

function createEmptyOwnerCounts(): Record<OwnerScreenKey, number> {
  return { ...EMPTY_OWNER_COUNTS }
}

function ownerPath(screenKey: OwnerScreenKey, orderId: string): string {
  const basePath: Record<OwnerScreenKey, string> = {
    preparation: '/dashboard/preparation',
    processing: '/dashboard/processing',
    assembly: '/dashboard/assembly',
    qa: '/dashboard/qa',
    packing: '/dashboard/packing',
    ready_release: '/dashboard/ready',
    driver_delivery: '/dashboard/delivery',
  }

  const base = basePath[screenKey]
  return screenKey === 'driver_delivery' ? base : `${base}/${orderId}`
}

function asIso(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function ageMinutes(receivedAt: Date | null, lastTransitionAt: Date | null): number {
  const origin = lastTransitionAt ?? receivedAt
  return origin ? Math.max(0, Math.floor((Date.now() - origin.getTime()) / 60_000)) : 0
}

function ownerForPinnedStatus(
  graph: PinnedGraphDefinition,
  statusCode: string,
): OwnerScreenKey | null {
  return OWNER_SCREEN_KEYS.find((screenKey) =>
    isPinnedScreenStatusMember(graph, screenKey, statusCode),
  ) ?? null
}

/**
 * Uses the artifact's primary-owner membership to route a semantic queue item.
 * Workboard itself is an observer: it may expose a queue row but never execute
 * an action or infer an owner from mutable screen memberships.
 */
function ownerForSemanticStatus(
  artifact: SemanticWorkflowArtifact,
  statusCode: string,
): OwnerScreenKey | null {
  if (!isSemanticScreenStatusMember(artifact, WORKBOARD_SCREEN_KEY, statusCode)) {
    return null
  }

  const moduleByScreen = new Map(
    artifact.modules.map((module) => [module.screen_key.trim().toLowerCase(), module]),
  )
  const ownerMembership = artifact.module_statuses.find((membership) => {
    const moduleConfig = moduleByScreen.get(membership.screen_key.trim().toLowerCase())
    return membership.status_code.trim().toLowerCase() === statusCode.trim().toLowerCase()
      && membership.visibility_mode === 'owner'
      && moduleConfig?.module_mode === 'primary_owner'
      && moduleConfig.is_enabled
      && OWNER_SCREEN_KEYS.includes(membership.screen_key as OwnerScreenKey)
  })

  return (ownerMembership?.screen_key as OwnerScreenKey | undefined) ?? null
}

function scopeFromSemanticArtifact(
  snapshot: ProfilePairRow,
  artifact: SemanticWorkflowArtifact,
): StatusScope {
  const ownerByStatus = new Map<string, OwnerScreenKey>()
  for (const membership of artifact.module_statuses) {
    const statusCode = membership.status_code.trim().toLowerCase()
    const owner = ownerForSemanticStatus(artifact, statusCode)
    if (owner) ownerByStatus.set(statusCode, owner)
  }

  return {
    profileId: snapshot.wf_profile_id,
    versionNo: snapshot.wf_version_no,
    artifactId: snapshot.wf_profile_artifact_id,
    ownerByStatus,
  }
}

async function loadLiveOwners(
  tenantId: string,
  statusCodes: string[],
): Promise<Map<string, OwnerScreenKey>> {
  const ownerPairs = await Promise.all(
    statusCodes.map(async (statusCode) => {
      const screens = await listWorkflowScreenKeysForStatus(tenantId, statusCode)
      const owner = OWNER_SCREEN_KEYS.find((screenKey) => screens.includes(screenKey))
      return owner ? ([statusCode, owner] as const) : null
    }),
  )

  return new Map(
    ownerPairs.filter((pair): pair is readonly [string, OwnerScreenKey] => pair !== null),
  )
}

function scopePredicate(scope: StatusScope): Prisma.Sql {
  const statuses = [...scope.ownerByStatus.keys()]
  const statusClause = Prisma.sql`o.current_status IN (${Prisma.join(statuses)})`
  if (scope.artifactId) {
    return Prisma.sql`(
      o.wf_profile_artifact_id = ${scope.artifactId}::uuid
      AND ${statusClause}
    )`
  }
  if (!scope.profileId || scope.versionNo === null) {
    return Prisma.sql`((o.wf_profile_id IS NULL OR o.wf_version_no IS NULL) AND ${statusClause})`
  }

  return Prisma.sql`(
    o.wf_profile_id = ${scope.profileId}::uuid
    AND o.wf_version_no = ${scope.versionNo}
    AND ${statusClause}
  )`
}

function dateRangeForToday(now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function buildWhereSql(
  tenantId: string,
  input: WorkboardQueryInput,
  scopes: StatusScope[],
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`o.tenant_org_id = ${tenantId}::uuid`,
    Prisma.sql`COALESCE(o.rec_status, 1) <> 0`,
    Prisma.sql`o.current_status IS NOT NULL`,
    Prisma.sql`(${Prisma.join(scopes.map(scopePredicate), ' OR ')})`,
  ]

  if (input.search) {
    const pattern = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`
    clauses.push(Prisma.sql`(
      o.order_no ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_name, c.name, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_mobile_number, c.phone, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_email, c.email, '') ILIKE ${pattern} ESCAPE '\\'
    )`)
  }

  if (input.branchId) clauses.push(Prisma.sql`o.branch_id = ${input.branchId}::uuid`)
  if (input.assigneeId) clauses.push(Prisma.sql`task.assigned_to = ${input.assigneeId}::uuid`)
  if (input.priority) clauses.push(Prisma.sql`o.priority = ${input.priority}`)
  if (input.blocker === 'blocked') {
    clauses.push(Prisma.sql`(COALESCE(o.has_issue, false) OR COALESCE(o.is_rejected, false))`)
  }
  if (input.blocker === 'clear') {
    clauses.push(Prisma.sql`NOT (COALESCE(o.has_issue, false) OR COALESCE(o.is_rejected, false))`)
  }

  const dueAt = Prisma.sql`COALESCE(o.ready_by, o.ready_by_at_new)`
  const now = new Date()
  const today = dateRangeForToday(now)
  if (input.sla === 'overdue') clauses.push(Prisma.sql`${dueAt} < ${now}`)
  if (input.sla === 'due_today') {
    clauses.push(Prisma.sql`${dueAt} >= ${today.start} AND ${dueAt} < ${today.end}`)
  }
  if (input.sla === 'not_due') clauses.push(Prisma.sql`(${dueAt} IS NULL OR ${dueAt} >= ${today.end})`)

  return Prisma.join(clauses, ' AND ')
}

function filterScopesByOwner(
  scopes: StatusScope[],
  ownerScreenKey?: OwnerScreenKey,
): StatusScope[] {
  if (!ownerScreenKey) {
    return scopes
  }

  return scopes
    .map((scope) => ({
      ...scope,
      ownerByStatus: new Map(
        [...scope.ownerByStatus.entries()].filter(([, owner]) => owner === ownerScreenKey),
      ),
    }))
    .filter((scope) => scope.ownerByStatus.size > 0)
}

function buildOwnerSummary(
  ownerMetrics: WorkboardOwnerMetricRow[],
  ownerByScope: Map<string, Map<string, OwnerScreenKey>>,
): Record<OwnerScreenKey, number> {
  const summary = createEmptyOwnerCounts()

  for (const metric of ownerMetrics) {
    const owner = ownerByScope
      .get(scopeKey(metric.wf_profile_id, metric.wf_version_no, metric.wf_profile_artifact_id))
      ?.get(metric.current_status)

    if (!owner) {
      continue
    }

    summary[owner] += Number(metric.total)
  }

  return summary
}

/**
 * Tenant-safe supervisor projection for configured operational statuses.
 * It deliberately exposes no action execution capability; the destination
 * stage is the only component allowed to mutate the workflow.
 */
export class WorkboardQueryService {
  /**
   * Lists the operational queue using each order's pinned profile graph when present.
   *
   * @example
   * await WorkboardQueryService.list(tenantId, { page: 1, pageSize: 25 })
   */
  static async list(
    tenantId: string,
    input: WorkboardQueryInput,
  ): Promise<WorkboardListResponse> {
    const contract = await getWorkflowScreenContract(tenantId, WORKBOARD_SCREEN_KEY)
    const configuredStatuses = [...new Set(contract.statuses.map((status) => status.trim()).filter(Boolean))]
    const gaps: WorkboardConfigurationGap[] = []

    const profilePairs = await prisma.$queryRaw<ProfilePairRow[]>(Prisma.sql`
      SELECT DISTINCT
        wf_profile_id::text,
        wf_version_no,
        wf_profile_version_id::text,
        wf_profile_artifact_id::text,
        wf_profile_revision,
        wf_profile_checksum,
        wf_profile_schema_version
      FROM public.org_orders_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND COALESCE(rec_status, 1) <> 0
        AND (
          (wf_profile_id IS NOT NULL AND wf_version_no IS NOT NULL)
          OR wf_profile_artifact_id IS NOT NULL
          OR wf_profile_version_id IS NOT NULL
          OR wf_profile_revision IS NOT NULL
          OR wf_profile_checksum IS NOT NULL
          OR wf_profile_schema_version IS NOT NULL
        )
    `)
    const liveOwners = await loadLiveOwners(tenantId, configuredStatuses)
    const scopes: StatusScope[] = liveOwners.size > 0
      ? [{ profileId: null, versionNo: null, artifactId: null, ownerByStatus: liveOwners }]
      : []

    for (const pair of profilePairs) {
      if (pair.wf_profile_artifact_id) {
        const artifact = await loadSemanticWorkflowArtifactForOrder(pair satisfies SemanticWorkflowOrderSnapshot)
        if (!artifact) continue
        const scope = scopeFromSemanticArtifact(pair, artifact)
        if (scope.ownerByStatus.size > 0) scopes.push(scope)
        continue
      }
      if (!pair.wf_profile_id || pair.wf_version_no === null) continue

      const graph = await loadPinnedGraphForProfileVersion(pair.wf_profile_id, pair.wf_version_no)
      const ownerByStatus = new Map<string, OwnerScreenKey>()
      for (const statusCode of configuredStatuses) {
        // A V2 profile owns its own queue policy; the live contract must not
        // broaden a pinned order into Workboard after a later catalog edit.
        if (graph && !isPinnedScreenStatusMember(graph, WORKBOARD_SCREEN_KEY, statusCode)) continue
        const owner = graph ? ownerForPinnedStatus(graph, statusCode) : liveOwners.get(statusCode)
        if (owner) ownerByStatus.set(statusCode, owner)
      }
      if (ownerByStatus.size > 0) {
        scopes.push({ profileId: pair.wf_profile_id, versionNo: pair.wf_version_no, artifactId: null, ownerByStatus })
      }
    }

    for (const statusCode of configuredStatuses) {
      if (!scopes.some((scope) => scope.ownerByStatus.has(statusCode))) {
        gaps.push({ statusCode, reason: 'no_stage_owner' })
      }
    }
    if (scopes.length === 0) return this.emptyResponse(input, gaps)

    const filteredScopes = filterScopesByOwner(scopes, input.ownerScreenKey)
    const baseWhereSql = buildWhereSql(tenantId, input, scopes)
    const whereSql = filteredScopes.length > 0
      ? buildWhereSql(tenantId, input, filteredScopes)
      : null
    const offset = (input.page - 1) * input.pageSize
    const orderBy = (() => {
      switch (input.sort) {
        case 'age_asc':
          return Prisma.sql`COALESCE(o.last_transition_at, o.received_at, o.created_at) DESC NULLS LAST`
        case 'ready_by_asc':
          return Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) ASC NULLS LAST`
        case 'ready_by_desc':
          return Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) DESC NULLS LAST`
        case 'order_no_asc':
          return Prisma.sql`o.order_no ASC NULLS LAST`
        case 'order_no_desc':
          return Prisma.sql`o.order_no DESC NULLS LAST`
        case 'customer_asc':
          return Prisma.sql`COALESCE(o.customer_name, c.name, '') ASC NULLS LAST`
        case 'customer_desc':
          return Prisma.sql`COALESCE(o.customer_name, c.name, '') DESC NULLS LAST`
        case 'stage_asc':
          return Prisma.sql`o.current_status ASC NULLS LAST`
        case 'stage_desc':
          return Prisma.sql`o.current_status DESC NULLS LAST`
        case 'priority_asc':
          return Prisma.sql`o.priority ASC NULLS LAST`
        case 'priority_desc':
          return Prisma.sql`o.priority DESC NULLS LAST`
        case 'assignee_asc':
          return Prisma.sql`COALESCE(u.display_name, u.name, '') ASC NULLS LAST`
        case 'assignee_desc':
          return Prisma.sql`COALESCE(u.display_name, u.name, '') DESC NULLS LAST`
        case 'age_desc':
        default:
          return Prisma.sql`COALESCE(o.last_transition_at, o.received_at, o.created_at) ASC NULLS LAST`
      }
    })()

    const scopedStatuses = [...new Set(
      scopes.flatMap((scope) => [...scope.ownerByStatus.keys()]),
    )]
    const [rows, metrics, ownerMetrics, statusLabels, branches, assignees, priorityRows] = await Promise.all([
      whereSql
        ? prisma.$queryRaw<WorkboardRowSql[]>(Prisma.sql`
            SELECT o.id::text, o.order_no, COALESCE(o.customer_name, c.name) AS customer_name,
              COALESCE(o.customer_mobile_number, c.phone) AS customer_phone,
              COALESCE(b.name, b.branch_name) AS branch_name, o.current_status, o.priority,
              o.has_issue, o.is_rejected, o.received_at, o.last_transition_at,
              COALESCE(o.ready_by_at_new, o.ready_by) AS ready_by_at, o.wf_profile_id::text,
              o.wf_version_no, o.wf_profile_artifact_id::text,
              COALESCE(u.display_name, u.name) AS assignee_name
            FROM public.org_orders_mst o
            LEFT JOIN public.org_customers_mst c ON c.id = o.customer_id AND c.tenant_org_id = o.tenant_org_id
            LEFT JOIN public.org_branches_mst b ON b.id = o.branch_id AND b.tenant_org_id = o.tenant_org_id
            LEFT JOIN public.org_asm_tasks_mst task ON task.order_id = o.id
              AND task.tenant_org_id = o.tenant_org_id AND task.is_active = true
              AND COALESCE(task.rec_status, 1) <> 0
            LEFT JOIN public.org_users_mst u ON u.user_id = task.assigned_to
              AND u.tenant_org_id = o.tenant_org_id AND u.is_active = true
              AND COALESCE(u.rec_status, 1) <> 0
            WHERE ${whereSql}
            ORDER BY ${orderBy}, o.order_no ASC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `)
        : Promise.resolve([] as WorkboardRowSql[]),
      whereSql
        ? prisma.$queryRaw<WorkboardMetricRow[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS total,
              COUNT(*) FILTER (WHERE COALESCE(o.has_issue, false) OR COALESCE(o.is_rejected, false))::bigint AS blocked,
              COUNT(*) FILTER (WHERE COALESCE(o.ready_by_at_new, o.ready_by) < NOW())::bigint AS overdue
            FROM public.org_orders_mst o
            LEFT JOIN public.org_customers_mst c ON c.id = o.customer_id AND c.tenant_org_id = o.tenant_org_id
            LEFT JOIN public.org_asm_tasks_mst task ON task.order_id = o.id
              AND task.tenant_org_id = o.tenant_org_id AND task.is_active = true
              AND COALESCE(task.rec_status, 1) <> 0
            WHERE ${whereSql}
          `)
        : Promise.resolve([{ total: BigInt(0), blocked: BigInt(0), overdue: BigInt(0) }] as WorkboardMetricRow[]),
      prisma.$queryRaw<WorkboardOwnerMetricRow[]>(Prisma.sql`
        SELECT o.current_status, o.wf_profile_id::text, o.wf_version_no,
          o.wf_profile_artifact_id::text,
          COUNT(*)::bigint AS total
        FROM public.org_orders_mst o
        LEFT JOIN public.org_customers_mst c ON c.id = o.customer_id AND c.tenant_org_id = o.tenant_org_id
        LEFT JOIN public.org_asm_tasks_mst task ON task.order_id = o.id
          AND task.tenant_org_id = o.tenant_org_id AND task.is_active = true
          AND COALESCE(task.rec_status, 1) <> 0
        WHERE ${baseWhereSql}
        -- Artifact identity is part of the immutable policy snapshot. Grouping by it
        -- keeps two revisions of the same profile from being merged in supervisor counts.
        GROUP BY o.current_status, o.wf_profile_id, o.wf_version_no, o.wf_profile_artifact_id
      `),
      prisma.$queryRaw<StatusLabelRow[]>(Prisma.sql`
        SELECT status_code, name, name2 FROM public.sys_wf_statuses_cd
        WHERE status_code IN (${Prisma.join(scopedStatuses)})
      `),
      prisma.org_branches_mst.findMany({
        where: { tenant_org_id: tenantId, is_active: { not: false }, rec_status: { not: 0 } },
        select: { id: true, name: true, branch_name: true }, orderBy: [{ name: 'asc' }, { branch_name: 'asc' }],
      }),
      prisma.org_users_mst.findMany({
        where: { tenant_org_id: tenantId, is_active: true, rec_status: { not: 0 } },
        select: { user_id: true, display_name: true, name: true }, orderBy: [{ display_name: 'asc' }, { name: 'asc' }],
      }),
      prisma.$queryRaw<Array<{ priority: string | null }>>(Prisma.sql`
        SELECT DISTINCT priority FROM public.org_orders_mst o
        WHERE o.tenant_org_id = ${tenantId}::uuid AND COALESCE(o.rec_status, 1) <> 0
          AND priority IS NOT NULL ORDER BY priority ASC
      `),
    ])

    const ownerByScope = new Map(scopes.map((scope) => [
      scopeKey(scope.profileId, scope.versionNo, scope.artifactId),
      scope.ownerByStatus,
    ]))
    const summaryByOwner = buildOwnerSummary(ownerMetrics, ownerByScope)
    const labels = new Map(statusLabels.map((row) => [row.status_code, row]))
    const mappedRows: WorkboardOrderRow[] = rows.flatMap((row) => {
      const owner = ownerByScope
        .get(scopeKey(row.wf_profile_id, row.wf_version_no, row.wf_profile_artifact_id))
        ?.get(row.current_status)
      if (!owner) return []
      return [{
        id: row.id, orderNo: row.order_no, customerName: row.customer_name ?? 'Unknown customer',
        customerPhone: row.customer_phone, branchName: row.branch_name, statusCode: row.current_status,
        statusName: labels.get(row.current_status)?.name ?? row.current_status,
        statusName2: labels.get(row.current_status)?.name2 ?? null,
        ownerScreenKey: owner,
        ownerPath: ownerPath(owner, row.id), assigneeName: row.assignee_name, priority: row.priority,
        isBlocked: row.has_issue === true || row.is_rejected === true,
        receivedAt: asIso(row.received_at), lastTransitionAt: asIso(row.last_transition_at),
        readyByAt: asIso(row.ready_by_at), ageMinutes: ageMinutes(row.received_at, row.last_transition_at),
      }]
    })
    const summary = metrics[0]
    return {
      rows: mappedRows, total: Number(summary?.total ?? 0), page: input.page, pageSize: input.pageSize,
      summary: {
        total: Number(summary?.total ?? 0),
        blocked: Number(summary?.blocked ?? 0),
        overdue: Number(summary?.overdue ?? 0),
        byOwner: summaryByOwner,
      },
      metadata: {
        branches: branches.map((branch) => ({ id: branch.id, name: branch.name ?? branch.branch_name ?? branch.id })),
        assignees: assignees.map((user) => ({ id: user.user_id, name: user.display_name ?? user.name ?? user.user_id })),
        priorities: priorityRows.flatMap((row) => row.priority ? [row.priority] : []), configurationGaps: gaps,
      },
    }
  }

  private static emptyResponse(
    input: WorkboardQueryInput,
    configurationGaps: WorkboardConfigurationGap[],
  ): WorkboardListResponse {
    return {
      rows: [], total: 0, page: input.page, pageSize: input.pageSize,
      summary: { total: 0, blocked: 0, overdue: 0, byOwner: createEmptyOwnerCounts() },
      metadata: { branches: [], assignees: [], priorities: [], configurationGaps },
    }
  }
}
