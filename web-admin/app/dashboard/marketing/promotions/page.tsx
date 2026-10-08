/**
 * Legacy Promotions route — consolidated into Promo Codes (/promos).
 * Keeps bookmarks working while avoiding the dual-admin drift.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { MARKETING_MARKETING_PROMOTIONS_ACCESS } from '@features/marketing/access/marketing-access';

/** Keeps legacy-bookmark history identifiable before redirecting to Promo Codes. */
export const metadata: Metadata = { title: 'Promotions' };

/**
 * Gate on the contract's page permissions, then redirect to the canonical promotions admin surface.
 * The destination enforces access again; gating here keeps the legacy route consistent with its contract.
 */
export default async function PromotionsPage() {
  const required = MARKETING_MARKETING_PROMOTIONS_ACCESS.page.permissions ?? [];
  const checks = await Promise.all(required.map((p) => hasPermissionServer(p)));
  const requireAll = MARKETING_MARKETING_PROMOTIONS_ACCESS.page.requireAllPermissions !== false;
  const allowed = requireAll ? checks.every(Boolean) : checks.some(Boolean);
  if (!allowed) {
    redirect('/dashboard');
  }
  redirect('/dashboard/marketing/promos');
}
