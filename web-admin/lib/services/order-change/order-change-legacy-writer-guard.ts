/**
 * Stops the legacy full-replacement save on a committed order while Edit Order V2 is on.
 * Draft and uncommitted orders still use the existing update. Create is not involved.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';

export const LEGACY_COMMITTED_UPDATE_RETIRED = 'LEGACY_COMMITTED_UPDATE_RETIRED';

const COMMITTED_COMMERCIAL_FIELD_KEYS = new Set([
  'packing_pref_code',
  'packing_pref_cf_id',
  'packing',
  'packingPref',
  'notes',
  'color',
  'brand',
  'has_stain',
  'has_damage',
  'hasStain',
  'hasDamage',
  'stainNotes',
  'stain_notes',
  'damageNotes',
  'damage_notes',
  'metadata',
  'quantity',
  'pricePerUnit',
  'price_per_unit',
  'totalPrice',
  'total_price',
  'productId',
  'product_id',
  'priceOverride',
  'price_override',
]);

export function legacyCommittedUpdateRetiredBody() {
  return {
    success: false as const,
    error: 'This committed order must be saved through Edit Order review.',
    errorCode: LEGACY_COMMITTED_UPDATE_RETIRED,
  };
}

/**
 * Returns the retired response when this committed order must use Edit Order review.
 * A missing, uncommitted, or flag-off order returns null so the existing writer continues.
 */
export async function blockCommittedCommercialWrite(tenantId: string, orderId: string) {
  const status = await legacyCommittedReplacementStatus(tenantId, orderId);
  if (status !== 'RETIRED') return null;
  return { status: 409 as const, body: legacyCommittedUpdateRetiredBody() };
}

/**
 * Mixed piece routes keep scan, readiness, and rack updates.
 * A present commercial field retires the whole request instead of writing part of it.
 */
export function payloadIncludesCommittedCommercialChange(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => payloadIncludesCommittedCommercialChange(entry));
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (COMMITTED_COMMERCIAL_FIELD_KEYS.has(key) && child !== undefined) return true;
    if ((key === 'updates' || key === 'items') && payloadIncludesCommittedCommercialChange(child)) return true;
  }
  return false;
}

export async function blockCommittedCommercialFields(
  tenantId: string,
  orderId: string,
  payload: unknown,
) {
  if (!payloadIncludesCommittedCommercialChange(payload)) return null;
  return blockCommittedCommercialWrite(tenantId, orderId);
}

function echoText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function echoFlag(value: unknown): boolean {
  return value === true;
}

/**
 * Processing sends the current notes and condition flags with every readiness save.
 * An unchanged echo is safe to drop. A different value is a commercial edit.
 */
export function committedCommercialEchoChanged(
  current: { notes?: string | null; has_stain?: boolean | null; has_damage?: boolean | null },
  incoming: { notes?: unknown; has_stain?: unknown; has_damage?: unknown },
): boolean {
  if ('notes' in incoming && echoText(incoming.notes) !== echoText(current.notes)) return true;
  if ('has_stain' in incoming && echoFlag(incoming.has_stain) !== echoFlag(current.has_stain)) return true;
  if ('has_damage' in incoming && echoFlag(incoming.has_damage) !== echoFlag(current.has_damage)) return true;
  return false;
}

export function legacyCommittedReplacementDecision(input: {
  committedAt: Date | string | null;
  editStateVersion: number | null;
  featureEnabled: boolean;
}): 'ALLOW' | 'RETIRED' {
  if (!input.featureEnabled) return 'ALLOW';
  if (!input.committedAt) return 'ALLOW';
  if ((input.editStateVersion ?? 0) < 1) return 'ALLOW';
  return 'RETIRED';
}

/**
 * A missing order is left to the existing update so its not-found response stays unchanged.
 */
export async function legacyCommittedReplacementStatus(
  tenantId: string,
  orderId: string,
): Promise<'ALLOW' | 'RETIRED'> {
  return withTenantContext(tenantId, async () => {
    const [order, flags] = await Promise.all([
      prisma.org_orders_mst.findFirst({
        where: { id: orderId, tenant_org_id: tenantId },
        select: { committed_at: true, edit_state_version: true },
      }),
      getFeatureFlags(tenantId),
    ]);
    if (!order) return 'ALLOW';
    return legacyCommittedReplacementDecision({
      committedAt: order.committed_at,
      editStateVersion: order.edit_state_version,
      featureEnabled: flags.order_edit_v2 === true,
    });
  });
}
