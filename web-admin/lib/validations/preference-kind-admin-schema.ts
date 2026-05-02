/**
 * Admin API: PUT /api/v1/catalog/preference-kinds/admin
 */
import { z } from 'zod';
import { zOptionalNormalizedHexIngress } from '@/lib/validations/css-color-schema';

export const preferenceKindAdminPutSchema = z.object({
  kindCode: z.string().min(1).max(30),
  name: z.string().max(250).optional().nullable(),
  name2: z.string().max(250).optional().nullable(),
  kind_bg_color: zOptionalNormalizedHexIngress,
  is_show_in_quick_bar: z.boolean().optional(),
  is_show_for_customer: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type PreferenceKindAdminPutBody = z.infer<typeof preferenceKindAdminPutSchema>;
