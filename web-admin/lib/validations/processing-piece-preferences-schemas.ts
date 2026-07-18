/**
 * Zod schemas for Processing piece preference APIs.
 */

import { z } from 'zod';

export const addProcessingPiecePrefSchema = z.object({
  preference_sys_kind: z.enum([
    'service_prefs',
    'packing_prefs',
    'condition_stain',
    'condition_damag',
    'condition_special',
    'color',
    'note',
  ]),
  preference_code: z.string().min(1).max(500),
  extra_price: z.number().min(0).optional(),
  preference_id: z.string().uuid().nullable().optional(),
  preference_content: z.string().max(2000).nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
});

export type AddProcessingPiecePrefBody = z.infer<
  typeof addProcessingPiecePrefSchema
>;

export const setProcessingPrefConfirmedSchema = z.object({
  processing_confirmed: z.boolean(),
});

export const appendProcessingPrefNoteSchema = z.object({
  note_text: z.string().min(1).max(2000),
});
