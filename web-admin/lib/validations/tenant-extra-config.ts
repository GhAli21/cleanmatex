/**
 * Zod validation schemas for Extra Tenant Configuration API mutations.
 *
 * @module lib/validations/tenant-extra-config
 */

import { z } from 'zod';
import { EXTRA_CONFIG_KEY_PATTERN } from '@/lib/constants/tenant-extra-config';

/** Valid UPPER_SNAKE_CASE config_key parameter. */
export const extraConfigKeySchema = z
  .string()
  .trim()
  .regex(EXTRA_CONFIG_KEY_PATTERN, 'Invalid configuration key format');

/** Single key/value pair submitted to save a tenant override. */
export const extraConfigSaveEntrySchema = z.object({
  config_key: extraConfigKeySchema,
  config_value: z.string().trim().min(1, 'Value is required').max(200, 'Value is too long'),
});

/** Batch payload accepted by `PUT /api/v1/settings/extra-config`. */
export const extraConfigSaveBatchSchema = z.object({
  entries: z
    .array(extraConfigSaveEntrySchema)
    .min(1, 'At least one configuration entry is required')
    .max(50, 'Too many configuration entries in one request'),
});

export type ExtraConfigSaveBatchInput = z.infer<typeof extraConfigSaveBatchSchema>;
