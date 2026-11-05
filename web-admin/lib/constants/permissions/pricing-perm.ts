/**
 * Catalog pricing permissions (`sys_auth_permissions`, already seeded — the DB
 * codes are mirrored exactly). Speed Pricing (Line-Level P7-01, decision P0-05)
 * reuses them: a speed rule is a product price, so no new codes or roles.
 */
export const PRICING_PERMISSIONS = {
  READ: 'pricing:read',
  CREATE: 'pricing:create',
  UPDATE: 'pricing:update',
  DELETE: 'pricing:delete',
  BULK: 'pricing:bulk',
  HISTORY: 'pricing:history',
  TIERS: 'pricing:tiers',
  OVERRIDE: 'pricing:override',
} as const;

/** One pricing permission code. */
export type PricingPermission = (typeof PRICING_PERMISSIONS)[keyof typeof PRICING_PERMISSIONS];
