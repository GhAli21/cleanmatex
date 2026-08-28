import 'server-only'

import { Prisma } from '@prisma/client'

import { READY_AREA_STATUSES } from '@/lib/constants/ready-list-focus'
import { WORKFLOW_SCREEN_KEY_SET } from '@/lib/constants/workflow-screens'
import { prisma } from '@/lib/db/prisma'
import {
  loadSemanticWorkflowArtifactForOrder,
  SemanticWorkflowArtifactError,
  type SemanticWorkflowArtifact,
  type SemanticWorkflowOrderSnapshot,
} from '@/lib/services/workflow/semantic-workflow-artifact.service'
import { isSemanticScreenStatusMember } from '@/lib/services/workflow/semantic-workflow-runtime.service'

const FLOOR_SCREEN_ALIASES: Record<string, string[]> = {
  ready: ['ready', 'ready_release'],
  ready_release: ['ready_release', 'ready'],
  delivery: ['delivery', 'driver_delivery'],
  driver_delivery: ['driver_delivery', 'delivery'],
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

interface StatusScope {
  artifactId: string
  statuses: string[]
}

interface OrderIdRow {
  id: string
}

interface CountRow {
  total: bigint
}

/** Authenticated floor-list query. Tenant is resolved by the API adapter, never the client. */
export interface StageWorklistQueryInput {
  screen: string
  page: number
  pageSize: number
  search?: string
  statusNarrow?: string[]
  /** Ready desk: outstanding balance still due. */
  collectionDue?: boolean
  /** Ready desk: no usable rack location. */
  missingRack?: boolean
  receivedFrom?: string
  receivedTo?: string
  readyByFrom?: string
  readyByTo?: string
  sortBy?: string
  sortAscending?: boolean
}

/** Page of tenant order IDs that belong on one floor screen under current policy. */
export interface StageWorklistPage {
  orderIds: string[]
  total: number
}

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Accepts historical floor aliases (`ready`, `delivery`) together with catalog keys.
 * Unknown keys fail closed so a caller cannot widen the list to every order.
 */
export function canonicalStageWorklistScreens(screen: string): string[] {
  const normalised = normalise(screen)
  if (!normalised) return []
  const aliased = FLOOR_SCREEN_ALIASES[normalised]
  if (aliased) return aliased
  return WORKFLOW_SCREEN_KEY_SET.has(normalised) ? [normalised] : []
}

function uniqueStatuses(values: Iterable<string>): string[] {
  return [...new Set([...values].map(normalise).filter(Boolean))]
}

function scopePredicate(scope: StatusScope): Prisma.Sql {
  const statusClause = Prisma.sql`o.current_status IN (${Prisma.join(scope.statuses)})`
  return Prisma.sql`(
    o.wf_profile_artifact_id = ${scope.artifactId}::uuid
    AND ${statusClause}
  )`
}

function buildWhereSql(
  tenantId: string,
  input: StageWorklistQueryInput,
  scopes: StatusScope[],
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`o.tenant_org_id = ${tenantId}::uuid`,
    Prisma.sql`COALESCE(o.rec_status, 1) <> 0`,
    Prisma.sql`o.current_status IS NOT NULL`,
    Prisma.sql`(${Prisma.join(scopes.map(scopePredicate), ' OR ')})`,
  ]

  const statusNarrow = uniqueStatuses(input.statusNarrow ?? [])
  if (statusNarrow.length > 0) {
    clauses.push(Prisma.sql`o.current_status IN (${Prisma.join(statusNarrow)})`)
  }

  if (input.collectionDue) {
    clauses.push(Prisma.sql`COALESCE(o.outstanding_amount, 0) > 0`)
  }

  if (input.missingRack) {
    clauses.push(Prisma.sql`NULLIF(BTRIM(COALESCE(o.rack_location, '')), '') IS NULL`)
  }

  if (input.search) {
    const pattern = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`
    clauses.push(Prisma.sql`(
      o.order_no ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_name, c.name, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_mobile_number, c.phone, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(o.customer_email, c.email, '') ILIKE ${pattern} ESCAPE '\\'
    )`)
  }

  if (input.receivedFrom) clauses.push(Prisma.sql`o.received_at >= ${input.receivedFrom}::timestamptz`)
  if (input.receivedTo) clauses.push(Prisma.sql`o.received_at <= ${input.receivedTo}::timestamptz`)
  if (input.readyByFrom) {
    clauses.push(Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) >= ${input.readyByFrom}::timestamptz`)
  }
  if (input.readyByTo) {
    clauses.push(Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) <= ${input.readyByTo}::timestamptz`)
  }

  return Prisma.join(clauses, ' AND ')
}

function orderBySql(input: StageWorklistQueryInput): Prisma.Sql {
  const ascending = input.sortAscending === true
  switch (input.sortBy) {
    case 'order_no':
      return ascending ? Prisma.sql`o.order_no ASC NULLS LAST` : Prisma.sql`o.order_no DESC NULLS LAST`
    case 'ready_by':
    case 'ready_by_at':
    case 'ready_by_at_new':
      return ascending
        ? Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) ASC NULLS LAST`
        : Prisma.sql`COALESCE(o.ready_by_at_new, o.ready_by) DESC NULLS LAST`
    case 'created_at':
      return ascending ? Prisma.sql`o.created_at ASC NULLS LAST` : Prisma.sql`o.created_at DESC NULLS LAST`
    case 'total':
      return ascending ? Prisma.sql`o.total_amount ASC NULLS LAST` : Prisma.sql`o.total_amount DESC NULLS LAST`
    default:
      return ascending ? Prisma.sql`o.received_at ASC NULLS LAST` : Prisma.sql`o.received_at DESC NULLS LAST`
  }
}

const READY_QUEUE_SCREENS = new Set(['ready', 'ready_release'])
const READY_AREA_STATUS_SET = new Set(READY_AREA_STATUSES.map(normalise))

function statusesForSemanticScreen(
  screens: string[],
  artifact: SemanticWorkflowArtifact,
): string[] {
  const wanted = new Set(screens.map(normalise))
  const isReadyQueue = [...wanted].some((screen) => READY_QUEUE_SCREENS.has(screen))
  const statuses = new Set<string>()
  for (const membership of artifact.module_statuses) {
    const screen = normalise(membership.screen_key)
    const status = normalise(membership.status_code)
    const hostedOnReadyPage = isReadyQueue && screen === 'pickup_handover'
    if (!wanted.has(screen) && !hostedOnReadyPage) continue
    if (!isSemanticScreenStatusMember(artifact, membership.screen_key, membership.status_code)) {
      continue
    }
    if (isReadyQueue && !READY_AREA_STATUS_SET.has(status)) continue
    statuses.add(status)
  }
  return [...statuses]
}

/** Loads a compiled artifact for queue scoping; incomplete snapshots are skipped, not listed via a graph pin. */
async function loadSemanticArtifactForScope(
  pair: ProfilePairRow,
): Promise<SemanticWorkflowArtifact | null> {
  try {
    return await loadSemanticWorkflowArtifactForOrder(pair satisfies SemanticWorkflowOrderSnapshot)
  } catch (error) {
    if (error instanceof SemanticWorkflowArtifactError) return null
    throw error
  }
}

async function resolveScopes(
  tenantId: string,
  screens: string[],
): Promise<StatusScope[]> {
  const profilePairs = await prisma.$queryRaw<ProfilePairRow[]>`
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
  `

  const scopes: StatusScope[] = []

  for (const pair of profilePairs) {
    const artifact = await loadSemanticArtifactForScope(pair)
    if (!artifact || !pair.wf_profile_artifact_id) continue
    const statuses = statusesForSemanticScreen(screens, artifact)
    if (statuses.length > 0) {
      scopes.push({
        artifactId: pair.wf_profile_artifact_id,
        statuses,
      })
    }
  }

  return scopes
}

/**
 * Lists the current page of floor-screen order IDs using each order's runtime
 * policy. Orders without a complete valid compiled artifact are excluded.
 *
 * @param tenantId Authenticated tenant resolved by the API adapter.
 * @param input Floor screen, paging, and optional operator filters.
 */
export async function listStageWorklistOrderPage(
  tenantId: string,
  input: StageWorklistQueryInput,
): Promise<StageWorklistPage> {
  const screens = canonicalStageWorklistScreens(input.screen)
  if (screens.length === 0) return { orderIds: [], total: 0 }

  const page = Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1
  const pageSize = Number.isFinite(input.pageSize) && input.pageSize > 0
    ? Math.min(Math.floor(input.pageSize), 100)
    : 20

  const scopes = await resolveScopes(tenantId, screens)
  if (scopes.length === 0) return { orderIds: [], total: 0 }

  const whereSql = buildWhereSql(tenantId, { ...input, page, pageSize }, scopes)
  const offset = (page - 1) * pageSize
  const rows = await prisma.$queryRaw<OrderIdRow[]>`
    SELECT o.id
    FROM public.org_orders_mst o
    LEFT JOIN public.org_customers_mst c
      ON c.id = o.customer_id
      AND c.tenant_org_id = o.tenant_org_id
    WHERE ${whereSql}
    ORDER BY ${orderBySql(input)}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `
  const countRows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS total
    FROM public.org_orders_mst o
    LEFT JOIN public.org_customers_mst c
      ON c.id = o.customer_id
      AND c.tenant_org_id = o.tenant_org_id
    WHERE ${whereSql}
  `

  return {
    orderIds: rows.map((row) => row.id),
    total: Number(countRows[0]?.total ?? 0),
  }
}
