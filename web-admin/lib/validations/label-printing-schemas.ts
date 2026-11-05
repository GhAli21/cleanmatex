/**
 * Label printing settings input (HFC P4, migration 0685, decision A-46).
 *
 * PUT /api/v1/settings/label-printing body: the overrides of one scope (tenant-wide when branchId is null, else
 * one branch). Each value may be null (= use the default of the level above). Fields that do not apply to a label
 * type must be null, sizes must be valid for the type, copies 1-10. The DB enforces the same rules
 * (chk_org_lblp_copies, chk_org_lblp_shape).
 */
import { z } from 'zod';
import {
  LABEL_PRINTING_FIELDS,
  LABEL_TYPES,
  LABEL_TYPE_FIELDS,
  LABEL_TYPE_SIZES,
  MAX_LABEL_COPIES,
  MIN_LABEL_COPIES,
} from '@/lib/services/labels/label-types';

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const labelPrintingOverrideSchema = z
  .object({
    labelType: z.enum(LABEL_TYPES),
    sizeCode: z.string().max(20).nullable(),
    showQr: z.boolean().nullable(),
    showCustomerName: z.boolean().nullable(),
    showOrderBarcode: z.boolean().nullable(),
    copies: z.number().int().min(MIN_LABEL_COPIES).max(MAX_LABEL_COPIES).nullable(),
  })
  .superRefine((row, ctx) => {
    const allowed = LABEL_TYPE_FIELDS[row.labelType];
    for (const field of LABEL_PRINTING_FIELDS) {
      if (!allowed.includes(field) && row[field] !== null) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'NOT_APPLICABLE' });
      }
    }
    if (row.sizeCode !== null && !LABEL_TYPE_SIZES[row.labelType].includes(row.sizeCode)) {
      ctx.addIssue({ code: 'custom', path: ['sizeCode'], message: 'INVALID_SIZE' });
    }
  });

export const labelPrintingSaveSchema = z
  .object({
    branchId: z.string().regex(UUID_LIKE).nullable(),
    rows: z.array(labelPrintingOverrideSchema).min(1).max(LABEL_TYPES.length),
  })
  .superRefine((body, ctx) => {
    const types = body.rows.map((r) => r.labelType);
    if (new Set(types).size !== types.length) {
      ctx.addIssue({ code: 'custom', path: ['rows'], message: 'DUPLICATE_LABEL_TYPE' });
    }
  });

export type LabelPrintingSaveInput = z.infer<typeof labelPrintingSaveSchema>;

/** `branchId` query value: absent/empty = tenant-wide (null), a uuid, or undefined when it is not valid. */
export function parseBranchIdParam(value: string | null): string | null | undefined {
  if (value === null || value.trim() === '') return null;
  return UUID_LIKE.test(value.trim()) ? value.trim() : undefined;
}
