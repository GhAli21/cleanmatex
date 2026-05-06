/**
 * Discount Rule Conditions Schema
 *
 * Defines the structure of the `conditions` JSONB field on org_discount_rules_cf.
 * Includes a Zod schema for server-side validation when creating or updating rules.
 */

import { z } from 'zod';

/** Bump this when the conditions shape changes in a breaking way. */
export const CONDITIONS_SCHEMA_VERSION = 1;

/** Typed shape of the conditions object stored on a discount rule. */
export interface DiscountConditions {
  schema_version: 1;
  /** Minimum order subtotal (after manual discount) required to trigger the rule. */
  min_order_amount?: number;
  /** Minimum number of items required to trigger the rule. */
  min_items?: number;
  /** Rule only applies if the order contains at least one item in these categories. */
  service_categories?: string[];
  /** Rule only applies to customers with one of these loyalty tiers. */
  customer_tiers?: ('bronze' | 'silver' | 'gold' | 'platinum')[];
  /** Rule only applies on the specified ISO weekday numbers (0=Sun … 6=Sat). */
  days_of_week?: number[];
  /** Rule only applies when the order time falls inside one of these windows. */
  time_ranges?: { start: string; end: string }[];
}

/** Zod schema for validating discount rule conditions from user input. */
export const discountConditionsSchema = z.object({
  schema_version: z.literal(1),
  min_order_amount: z.number().nonnegative().optional(),
  min_items: z.number().int().positive().optional(),
  service_categories: z.array(z.string()).optional(),
  customer_tiers: z
    .array(z.enum(['bronze', 'silver', 'gold', 'platinum']))
    .optional(),
  days_of_week: z
    .array(z.number().int().min(0).max(6))
    .optional(),
  time_ranges: z
    .array(
      z.object({
        start: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
        end: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
      })
    )
    .optional(),
});

export type DiscountConditionsInput = z.infer<typeof discountConditionsSchema>;
