/**
 * Order Piece Mapper
 * 
 * Maps database models (from Supabase) to domain types (OrderItemPiece)
 * Handles type conversions, date parsing, and type assertions
 */

import type { OrderItemPiece } from '@/types/order';

/**
 * Database model for order piece (as returned by Supabase)
 * Dates are ISO strings, not Date objects
 */
export interface OrderPieceDbModel {
  id: string;
  tenant_org_id: string;
  order_id: string;
  order_item_id: string;
  piece_seq: number;
  piece_code: string;
  service_category_code: string | null;
  product_id: string | null;
  scan_state: string | null;
  barcode: string | null;
  quantity: number | null;
  price_per_unit: number;
  total_price: number;
  piece_status: 'intake' | 'processing' | 'qa' | 'ready' | null;
  piece_stage: string | null;
  is_rejected: boolean | null;
  issue_id: string | null;
  rack_location: string | null;
  last_step_at: string | null; // ISO string from DB
  last_step_by: string | null;
  last_step: string | null;
  notes: string | null;
  color: string | null;
  brand: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;
  metadata: Record<string, any>;
  created_at: string | null; // ISO string from DB
  rec_order: number | null;
  rec_notes: string | null;
  rec_status: number | null;
  created_by: string | null;
  created_info: string | null;
  updated_at: string | null; // ISO string from DB
  updated_by: string | null;
  updated_info: string | null;
  is_ready: boolean;
}

/**
 * Convert database model to domain type
 * Handles date string to Date conversion and type assertions
 */
export function mapOrderPieceFromDb(dbPiece: OrderPieceDbModel): OrderItemPiece {
  return {
    ...dbPiece,
    // Convert ISO date strings to Date objects
    last_step_at: dbPiece.last_step_at ? new Date(dbPiece.last_step_at) : null,
    created_at: dbPiece.created_at ? new Date(dbPiece.created_at) : null,
    updated_at: dbPiece.updated_at ? new Date(dbPiece.updated_at) : null,
    // Type assertion for scan_state enum
    scan_state: dbPiece.scan_state as 'expected' | 'scanned' | 'missing' | 'wrong' | null,
  };
}

/**
 * Convert array of database models to domain types
 */
export function mapOrderPiecesFromDb(dbPieces: OrderPieceDbModel[]): OrderItemPiece[] {
  return dbPieces.map(mapOrderPieceFromDb);
}

/**
 * Convert domain type to database update payload
 * Converts Date objects to ISO strings for Supabase
 */
export function mapOrderPieceToDbUpdate(
  piece: Partial<OrderItemPiece>
): Partial<OrderPieceDbModel> {
  const update: Partial<OrderPieceDbModel> = { ...piece };

  // Convert Date objects to ISO strings
  if (piece.last_step_at instanceof Date) {
    update.last_step_at = piece.last_step_at.toISOString();
  } else if (piece.last_step_at === null) {
    update.last_step_at = null;
  }

  if (piece.created_at instanceof Date) {
    update.created_at = piece.created_at.toISOString();
  } else if (piece.created_at === null) {
    update.created_at = null;
  }

  if (piece.updated_at instanceof Date) {
    update.updated_at = piece.updated_at.toISOString();
  } else if (piece.updated_at === null) {
    update.updated_at = null;
  }

  return update;
}

