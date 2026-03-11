/**
 * Service Preferences — Zod schemas for API inputs
 * Aligned with lib/constants/service-preferences.ts
 */

import { z } from 'zod';
import {
  SERVICE_PREFERENCE_CODES,
  PACKING_PREFERENCE_CODES,
  PREFERENCE_SOURCES,
} from '@/lib/constants/service-preferences';

const servicePreferenceCodeSchema = z.enum(
  Object.values(SERVICE_PREFERENCE_CODES) as [string, ...string[]]
);

const packingPreferenceCodeSchema = z.enum(
  Object.values(PACKING_PREFERENCE_CODES) as [string, ...string[]]
);

const preferenceSourceSchema = z.enum(
  Object.values(PREFERENCE_SOURCES) as [string, ...string[]]
);

const uuidSchema = z.string().uuid();

/** Add service preference to order item */
export const addServicePrefSchema = z.object({
  preference_code: servicePreferenceCodeSchema,
  source: preferenceSourceSchema.default('manual'),
  extra_price: z.number().nonnegative(),
  branch_id: uuidSchema.optional().nullable(),
});

/** Add service preference to order piece */
export const addPieceServicePrefSchema = z.object({
  preference_code: servicePreferenceCodeSchema,
  source: preferenceSourceSchema.default('manual'),
  extra_price: z.number().nonnegative(),
  branch_id: uuidSchema.optional().nullable(),
});

/** Update packing preference */
export const updatePackingPrefSchema = z.object({
  packing_pref_code: packingPreferenceCodeSchema,
  packing_pref_is_override: z.boolean().optional(),
  packing_pref_source: preferenceSourceSchema.optional(),
});

/** Add customer standing preference */
export const addCustomerServicePrefSchema = z.object({
  preference_code: servicePreferenceCodeSchema,
  source: preferenceSourceSchema.default('manual'),
});

/** Apply bundle to order item */
export const applyBundleSchema = z.object({
  bundle_code: z.string().min(1).max(50),
});

/** Create/update preference bundle (Care Package) */
export const preferenceBundleSchema = z.object({
  bundle_code: z.string().min(1).max(50),
  name: z.string().min(1).max(250),
  name2: z.string().max(250).optional().nullable(),
  preference_codes: z.array(z.string()).optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  discount_amount: z.number().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  display_order: z.number().int().min(0).optional().default(0),
});

/** Resolve preferences query params */
export const resolvePreferencesQuerySchema = z.object({
  tenant_org_id: uuidSchema,
  customer_id: uuidSchema.optional(),
  product_code: z.string().optional(),
  service_category_code: z.string().optional(),
});

export type AddServicePrefInput = z.infer<typeof addServicePrefSchema>;
export type AddPieceServicePrefInput = z.infer<typeof addPieceServicePrefSchema>;
export type UpdatePackingPrefInput = z.infer<typeof updatePackingPrefSchema>;
export type AddCustomerServicePrefInput = z.infer<
  typeof addCustomerServicePrefSchema
>;
export type ApplyBundleInput = z.infer<typeof applyBundleSchema>;
export type ResolvePreferencesQuery = z.infer<
  typeof resolvePreferencesQuerySchema
>;
