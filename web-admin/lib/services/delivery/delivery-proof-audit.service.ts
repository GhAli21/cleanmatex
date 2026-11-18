import 'server-only';

import { FILE_CATEGORIES, FILE_PURPOSES, FILE_REF_TYPES } from '@/lib/constants/file-util';
import { prisma } from '@/lib/db/prisma';
import { listFiles, type FileView } from '@/lib/services/file-util/file-util.service';
import { logger } from '@/lib/utils/logger';
import type {
  DeliveryProofAudit,
  DeliveryProofAuditEntry,
  DeliveryProofEvidenceLink,
} from '@features/delivery/model/delivery-proof-audit';

const OUTSTANDING_AMOUNT_EPSILON = 0.001;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toNumber(value: { toString(): string } | number | null): number {
  return value === null ? 0 : Number(value);
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

/**
 * The stop's proof: File Util files of the order tagged to the stop and locked by the delivery
 * completion. Unlocked uploads (abandoned drafts) are not proof and are left out.
 */
function proofFilesOfStop(files: FileView[], stopId: string): { signature: FileView | null; photos: FileView[] } {
  const ofStop = files.filter((f) => f.lockedAt && f.refTypeCode === FILE_REF_TYPES.DELIVERY_STOP && f.refId === stopId);
  return {
    signature: ofStop.find((f) => f.purposeCode === FILE_PURPOSES.ORDER_FILE.SIGNATURE) ?? null,
    photos: ofStop.filter((f) => f.purposeCode === FILE_PURPOSES.ORDER_FILE.DELIVERY_PROOF),
  };
}

const link = (file: FileView): DeliveryProofEvidenceLink => ({ url: file.url, source: 'private_signed' });

/**
 * Resolves authorized proof-of-delivery records without allowing object keys or
 * permanent private-storage URLs to leave the server boundary.
 */
export class DeliveryProofAuditService {
  static async getOrderAudit(tenantId: string, orderId: string): Promise<DeliveryProofAudit | null> {
    const order = await prisma.org_orders_mst.findFirst({
      where: {
        id: orderId,
        tenant_org_id: tenantId,
        rec_status: 1,
      },
      select: {
        id: true,
        order_no: true,
        current_status: true,
        outstanding_amount: true,
        currency_code: true,
      },
    });
    if (!order) return null;

    const stops = await prisma.org_dlv_stops_dtl.findMany({
      where: {
        tenant_org_id: tenantId,
        order_id: orderId,
        is_active: true,
        rec_status: 1,
      },
      orderBy: [{ actual_time: 'desc' }, { sequence: 'asc' }],
      select: {
        id: true,
        route_id: true,
        sequence: true,
        stop_status_code: true,
        actual_time: true,
        org_dlv_pod_tr: {
          where: {
            tenant_org_id: tenantId,
            is_active: true,
            rec_status: 1,
          },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            pod_method_code: true,
            pod_notes: true,
            verified_at: true,
            verified_by: true,
            created_by: true,
          },
        },
      },
    });

    const actorIds = [...new Set(
      stops.flatMap((stop) => stop.org_dlv_pod_tr.map((pod) => pod.verified_by ?? pod.created_by))
        .filter((actorId): actorId is string => Boolean(actorId && UUID_PATTERN.test(actorId))),
    )];
    const operators = actorIds.length === 0
      ? []
      : await prisma.org_users_mst.findMany({
          where: {
            tenant_org_id: tenantId,
            user_id: { in: actorIds },
            is_active: true,
            rec_status: 1,
          },
          select: {
            user_id: true,
            display_name: true,
            name: true,
            first_name: true,
            last_name: true,
          },
        });
    const operatorNames = new Map(operators.map((operator) => {
      const fullName = [operator.first_name, operator.last_name].filter(Boolean).join(' ').trim();
      return [operator.user_id, operator.display_name?.trim() || operator.name?.trim() || fullName || null] as const;
    }));

    // One batch read + signing call for the whole order; a signing outage hides links, not the audit.
    let proofFiles: FileView[] = [];
    if (stops.some((stop) => stop.org_dlv_pod_tr.length > 0)) {
      try {
        proofFiles = await listFiles({
          tenantId,
          categoryCode: FILE_CATEGORIES.ORDER_FILE,
          entityIds: [orderId],
          purposeCodes: [FILE_PURPOSES.ORDER_FILE.SIGNATURE, FILE_PURPOSES.ORDER_FILE.DELIVERY_PROOF],
        });
      } catch (error) {
        logger.warn('Delivery proof signing failed', {
          tenantId,
          orderId,
          error: error instanceof Error ? error.message : String(error),
          feature: 'delivery',
          action: 'read_proof_audit',
        });
      }
    }

    const entries = stops.flatMap((stop) => stop.org_dlv_pod_tr.map((pod) => {
      const proof = proofFilesOfStop(proofFiles, stop.id);
      const actorId = pod.verified_by ?? pod.created_by;

      return {
        podId: pod.id,
        stopId: stop.id,
        routeId: stop.route_id,
        stopSequence: stop.sequence,
        stopStatus: stop.stop_status_code ?? 'pending',
        podMethodCode: pod.pod_method_code,
        deliveredAt: toIso(stop.actual_time),
        verifiedAt: toIso(pod.verified_at),
        deliveredBy: actorId ? operatorNames.get(actorId) ?? null : null,
        notes: pod.pod_notes,
        signature: proof.signature ? link(proof.signature) : null,
        photos: proof.photos.map(link),
      } satisfies DeliveryProofAuditEntry;
    })).sort((left, right) => {
      const leftTime = left.verifiedAt ?? left.deliveredAt ?? '';
      const rightTime = right.verifiedAt ?? right.deliveredAt ?? '';
      return rightTime.localeCompare(leftTime);
    });

    const outstandingAmount = toNumber(order.outstanding_amount);
    return {
      order: {
        id: order.id,
        orderNo: order.order_no,
        workflowOutcome: order.current_status,
        paymentState: outstandingAmount > OUTSTANDING_AMOUNT_EPSILON ? 'balance_due' : 'settled',
        outstandingAmount,
        currencyCode: order.currency_code,
      },
      deliveryStopCount: stops.length,
      entries,
    };
  }
}
