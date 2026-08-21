import 'server-only';

import { DELIVERY_EVIDENCE_BUCKET, DELIVERY_EVIDENCE_SIGNED_URL_TTL_SECONDS } from '@/lib/constants/delivery-evidence';
import { prisma } from '@/lib/db/prisma';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
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

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function isSafeLegacyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function belongsToDeliveryEvidenceScope(tenantId: string, stopId: string, objectKey: string): boolean {
  return objectKey.startsWith(`${tenantId}/delivery/${stopId}/`);
}

async function resolveEvidenceLink(params: {
  tenantId: string;
  stopId: string;
  objectKey: string | null;
  legacyUrl: string | null;
}): Promise<DeliveryProofEvidenceLink | null> {
  if (params.objectKey && belongsToDeliveryEvidenceScope(params.tenantId, params.stopId, params.objectKey)) {
    const { data, error } = await createAdminSupabaseClient()
      .storage
      .from(DELIVERY_EVIDENCE_BUCKET)
      .createSignedUrl(params.objectKey, DELIVERY_EVIDENCE_SIGNED_URL_TTL_SECONDS);

    if (data?.signedUrl) {
      return { url: data.signedUrl, source: 'private_signed' };
    }

    logger.warn('Delivery proof signing failed', {
      tenantId: params.tenantId,
      stopId: params.stopId,
      error: error?.message ?? 'No signed URL returned',
      feature: 'delivery',
      action: 'read_proof_audit',
    });
  }

  if (params.legacyUrl && isSafeLegacyUrl(params.legacyUrl)) {
    return { url: params.legacyUrl, source: 'legacy' };
  }

  return null;
}

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
            signature_object_key: true,
            photo_object_keys: true,
            signature_url: true,
            photo_urls: true,
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

    const entries = (await Promise.all(stops.flatMap((stop) => stop.org_dlv_pod_tr.map(async (pod) => {
      const signature = await resolveEvidenceLink({
        tenantId,
        stopId: stop.id,
        objectKey: pod.signature_object_key,
        legacyUrl: pod.signature_url,
      });
      const objectKeys = toStringArray(pod.photo_object_keys);
      const legacyUrls = toStringArray(pod.photo_urls);
      const photos = await Promise.all(Array.from(
        { length: Math.max(objectKeys.length, legacyUrls.length) },
        (_, index) => resolveEvidenceLink({
          tenantId,
          stopId: stop.id,
          objectKey: objectKeys[index] ?? null,
          legacyUrl: legacyUrls[index] ?? null,
        }),
      ));
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
        signature,
        photos: photos.filter((photo): photo is DeliveryProofEvidenceLink => photo !== null),
      } satisfies DeliveryProofAuditEntry;
    })))).sort((left, right) => {
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
