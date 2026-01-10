/**
 * Piece Utilities
 * Helper functions for working with order item pieces
 */

import type { OrderItemPiece, ItemPiece } from '@/types/order';

/**
 * Convert database OrderItemPiece to client-side ItemPiece format
 */
export function convertDbPieceToClientPiece(
  dbPiece: OrderItemPiece,
  itemId: string
): ItemPiece {
  return {
    id: dbPiece.id,
    itemId: itemId,
    pieceNumber: dbPiece.piece_seq,
    isReady: dbPiece.piece_status === 'ready' && !dbPiece.is_rejected,
    currentStep: dbPiece.last_step as any,
    notes: dbPiece.notes || '',
    rackLocation: dbPiece.rack_location || '',
    isRejected: dbPiece.is_rejected || false,
  };
}

/**
 * Convert client-side ItemPiece to database update format
 */
export function convertClientPieceToDbUpdate(
  clientPiece: ItemPiece
): Partial<OrderItemPiece> {
  return {
    piece_status: clientPiece.isReady ? 'ready' : 'processing',
    last_step: clientPiece.currentStep,
    notes: clientPiece.notes,
    rack_location: clientPiece.rackLocation,
    is_rejected: clientPiece.isRejected,
  };
}

/**
 * Calculate quantity ready from pieces
 */
export function calculateQuantityReady(pieces: OrderItemPiece[]): number {
  return pieces.filter(
    (p) => p.piece_status === 'ready' && !p.is_rejected
  ).length;
}

/**
 * Calculate quantity rejected from pieces
 */
export function calculateQuantityRejected(pieces: OrderItemPiece[]): number {
  return pieces.filter((p) => p.is_rejected).length;
}

/**
 * Group pieces by item ID
 */
export function groupPiecesByItem(
  pieces: OrderItemPiece[]
): Map<string, OrderItemPiece[]> {
  const grouped = new Map<string, OrderItemPiece[]>();

  for (const piece of pieces) {
    const itemId = piece.order_item_id;
    if (!grouped.has(itemId)) {
      grouped.set(itemId, []);
    }
    grouped.get(itemId)!.push(piece);
  }

  // Sort pieces by sequence number
  for (const [itemId, itemPieces] of grouped.entries()) {
    itemPieces.sort((a, b) => a.piece_seq - b.piece_seq);
  }

  return grouped;
}

/**
 * Filter pieces by status
 */
export function filterPiecesByStatus(
  pieces: OrderItemPiece[],
  status: OrderItemPiece['piece_status']
): OrderItemPiece[] {
  return pieces.filter((p) => p.piece_status === status);
}

/**
 * Filter pieces by rejection status
 */
export function filterPiecesByRejection(
  pieces: OrderItemPiece[],
  isRejected: boolean
): OrderItemPiece[] {
  return pieces.filter((p) => (p.is_rejected || false) === isRejected);
}

/**
 * Get piece statistics for an item
 */
export function getPieceStatistics(pieces: OrderItemPiece[]) {
  return {
    total: pieces.length,
    ready: calculateQuantityReady(pieces),
    rejected: calculateQuantityRejected(pieces),
    processing: pieces.filter(
      (p) => p.piece_status === 'processing' && !p.is_rejected
    ).length,
    qa: pieces.filter(
      (p) => p.piece_status === 'qa' && !p.is_rejected
    ).length,
    intake: pieces.filter(
      (p) => p.piece_status === 'intake' && !p.is_rejected
    ).length,
  };
}

