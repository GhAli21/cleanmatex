/**
 * Gift Card Metadata Schema
 *
 * Validates the JSON metadata stored in org_gift_card_txn_dtl.metadata and
 * org_gift_cards_mst.metadata. All fields are optional so the schema is
 * backward-compatible with records that predate this validation layer.
 */

import { z } from 'zod';

export const GiftCardMetadataSchema = z.object({
  /** Caller-supplied idempotency key for the operation that produced this record */
  idempotency_key:  z.string().optional(),
  /** Origin channel of the gift card operation */
  source:           z.enum(['POS', 'ADMIN', 'API', 'IMPORT']).optional(),
  /** POS terminal ID (if applicable) */
  pos_terminal_id:  z.string().optional(),
  /** Batch reference (for bulk-issued card sets) */
  batch_ref:        z.string().optional(),
  /** Free-form operational notes attached to this record */
  notes:            z.string().optional(),
}).catchall(z.unknown());

/**
 *
 */
export type GiftCardMetadata = z.infer<typeof GiftCardMetadataSchema>;
