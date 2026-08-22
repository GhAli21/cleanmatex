import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { SemanticWorkflowArtifact } from '@/lib/services/workflow/semantic-workflow-artifact.service';
import type {
  WorkflowGateEvaluationPhase,
  WorkflowGateOrderFacts,
} from '@/lib/services/workflow/workflow-gate-evaluator.service';
import { workflowGateNeedsExtendedFacts } from '@/lib/services/workflow/workflow-gate-evaluator.service';

type QueryClient = Pick<typeof prisma, '$queryRaw'>;

/** Header facts already locked by the workflow command or discovery read. */
export interface WorkflowGateHeaderFacts {
  tenant_org_id: string;
  id: string;
  current_status: string | null;
  preparation_status: string | null;
  rack_location: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
}

type ItemFactRow = {
  active_item_count: number | bigint | string;
  unready_item_count: number | bigint | string;
  expected_piece_count: number | bigint | string;
};

type PieceFactRow = {
  active_piece_count: number | bigint | string;
  scanned_piece_count: number | bigint | string;
  ready_piece_count: number | bigint | string;
};

type CountRow = { count: number | bigint | string };
type FlagRow = { present: boolean };

function toCount(value: number | bigint | string | null | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function artifactEnablesPieceTracking(artifact?: SemanticWorkflowArtifact | null): boolean | null {
  if (!artifact) return null;
  const policy = (artifact as { policy?: { track_individual_piece?: unknown } | null }).policy;
  if (!policy || typeof policy !== 'object') return null;
  if (!('track_individual_piece' in policy)) return null;
  return Boolean(policy.track_individual_piece);
}

/**
 * Loads the extra live facts needed by piece, QA, fulfilment, and evidence
 * gates. Queries stay tenant-scoped and, when a command transaction is
 * supplied, lock the related rows with the order.
 *
 * @param input.tenantId - Authenticated tenant that owns the order.
 * @param input.order - Header facts already read for this tenant order.
 * @param input.gateCodes - Gate codes that will be evaluated for this command.
 * @param input.phase - Discovery vs execute; POD evidence is input-satisfied.
 * @param input.artifact - Optional immutable profile artifact for piece tracking.
 * @param input.transaction - Optional command transaction used to lock related rows.
 */
export async function loadWorkflowGateFacts(input: {
  tenantId: string;
  order: WorkflowGateHeaderFacts;
  gateCodes: readonly string[];
  phase: WorkflowGateEvaluationPhase;
  artifact?: SemanticWorkflowArtifact | null;
  transaction?: QueryClient;
}): Promise<WorkflowGateOrderFacts> {
  const facts: WorkflowGateOrderFacts = {
    preparationStatus: input.order.preparation_status,
    rackLocation: input.order.rack_location,
    paymentTypeCode: input.order.payment_type_code,
    outstandingAmount: input.order.outstanding_amount,
    currentStatus: input.order.current_status,
    evaluationPhase: input.phase,
  };

  if (!workflowGateNeedsExtendedFacts(input.gateCodes)) {
    return facts;
  }

  const db = input.transaction ?? prisma;
  const lockClause = input.transaction ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const tenantId = input.tenantId;
  const orderId = input.order.id;

  const [itemRows, pieceRows, issueRows, qaRows, pickupRows, stopRows] = await Promise.all([
    db.$queryRaw<ItemFactRow[]>(Prisma.sql`
      WITH locked AS (
        SELECT item_is_rejected, rec_status, item_status, quantity_ready, quantity
        FROM public.org_order_items_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
        ${lockClause}
      )
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(item_is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
        ) AS active_item_count,
        COUNT(*) FILTER (
          WHERE COALESCE(item_is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
            AND NOT (
              lower(COALESCE(item_status, '')) IN ('ready', 'assembled')
              OR COALESCE(quantity_ready, 0) >= GREATEST(COALESCE(quantity, 1), 1)
            )
        ) AS unready_item_count,
        COALESCE(SUM(
          GREATEST(COALESCE(quantity, 1), 0)
        ) FILTER (
          WHERE COALESCE(item_is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
        ), 0) AS expected_piece_count
      FROM locked
    `),
    db.$queryRaw<PieceFactRow[]>(Prisma.sql`
      WITH locked AS (
        SELECT is_rejected, rec_status, scan_state, is_ready, piece_status
        FROM public.org_order_item_pieces_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
        ${lockClause}
      )
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
        ) AS active_piece_count,
        COUNT(*) FILTER (
          WHERE COALESCE(is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
            AND lower(COALESCE(scan_state, '')) = 'scanned'
        ) AS scanned_piece_count,
        COUNT(*) FILTER (
          WHERE COALESCE(is_rejected, false) = false
            AND COALESCE(rec_status, 1) = 1
            AND (is_ready = true OR lower(COALESCE(piece_status, '')) = 'ready')
        ) AS ready_piece_count
      FROM locked
    `),
    db.$queryRaw<CountRow[]>(Prisma.sql`
      WITH locked AS (
        SELECT status, rec_status
        FROM public.org_order_issues
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
        ${lockClause}
      )
      SELECT COUNT(*)::int AS count
      FROM locked
      WHERE upper(status) = 'OPEN'
        AND COALESCE(rec_status, 1) = 1
    `),
    db.$queryRaw<Array<{ task_count: number | bigint | string; passed_count: number | bigint | string }>>(Prisma.sql`
      WITH locked AS (
        SELECT is_active, rec_status, qa_status
        FROM public.org_asm_tasks_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
        ${lockClause}
      )
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(is_active, true) = true
            AND COALESCE(rec_status, 1) = 1
        ) AS task_count,
        COUNT(*) FILTER (
          WHERE COALESCE(is_active, true) = true
            AND COALESCE(rec_status, 1) = 1
            AND lower(replace(COALESCE(qa_status, ''), '-', '_')) IN ('qa_passed', 'passed')
        ) AS passed_count
      FROM locked
    `),
    db.$queryRaw<FlagRow[]>(Prisma.sql`
      WITH locked AS (
        SELECT 1
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
          AND release_status = 'released'
          AND release_type IN ('pickup', 'partial')
          AND COALESCE(rec_status, 1) = 1
        ${lockClause}
      )
      SELECT EXISTS (SELECT 1 FROM locked) AS present
    `),
    db.$queryRaw<FlagRow[]>(Prisma.sql`
      WITH locked AS (
        SELECT 1
        FROM public.org_dlv_stops_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND order_id = ${orderId}::uuid
          AND lower(COALESCE(stop_status_code, '')) IN ('pending', 'in_transit')
        ${lockClause}
      )
      SELECT EXISTS (SELECT 1 FROM locked) AS present
    `),
  ]);

  const items = itemRows[0];
  const pieces = pieceRows[0];
  const artifactTracking = artifactEnablesPieceTracking(input.artifact);
  const activePieceCount = toCount(pieces?.active_piece_count);

  return {
    ...facts,
    pieceTrackingEnabled: artifactTracking ?? activePieceCount > 0,
    activeItemCount: toCount(items?.active_item_count),
    unreadyItemCount: toCount(items?.unready_item_count),
    expectedPieceCount: toCount(items?.expected_piece_count),
    activePieceCount,
    scannedPieceCount: toCount(pieces?.scanned_piece_count),
    readyPieceCount: toCount(pieces?.ready_piece_count),
    openIssueCount: toCount(issueRows[0]?.count),
    qaTaskCount: toCount(qaRows[0]?.task_count),
    qaPassedTaskCount: toCount(qaRows[0]?.passed_count),
    hasOpenPickupRelease: Boolean(pickupRows[0]?.present),
    hasActiveDeliveryStop: Boolean(stopRows[0]?.present),
  };
}
