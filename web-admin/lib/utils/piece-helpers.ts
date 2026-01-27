/**
 * Piece Helpers
 * 
 * Utilities for managing piece-level tracking in orders.
 * Handles generation, validation, and manipulation of pre-submission pieces
 * when piece tracking is enabled for a tenant.
 * 
 * @module piece-helpers
 */

import type { PreSubmissionPiece } from '@features/orders/model/new-order-types';

/**
 * Generates pieces for an item
 * @param itemId - Item ID (product ID)
 * @param quantity - Number of pieces to generate
 * @returns Array of pre-submission pieces
 */
export function generatePiecesForItem(
  itemId: string,
  quantity: number
): PreSubmissionPiece[] {
  if (quantity <= 0) {
    return [];
  }

  const pieces: PreSubmissionPiece[] = [];
  for (let i = 1; i <= quantity; i++) {
    pieces.push({
      id: `temp-${itemId}-${i}`,
      itemId,
      pieceSeq: i,
    });
  }
  return pieces;
}

/**
 * Updates piece details
 * @param pieces - Current pieces array
 * @param pieceId - Piece ID to update
 * @param updates - Updates to apply
 * @returns Updated pieces array
 */
export function updatePieceDetails(
  pieces: PreSubmissionPiece[],
  pieceId: string,
  updates: Partial<Omit<PreSubmissionPiece, 'id' | 'itemId' | 'pieceSeq'>>
): PreSubmissionPiece[] {
  return pieces.map((piece) =>
    piece.id === pieceId ? { ...piece, ...updates } : piece
  );
}

/**
 * Validates piece data
 * @param piece - Piece to validate
 * @returns True if valid, false otherwise
 */
export function validatePieceData(piece: PreSubmissionPiece): boolean {
  if (!piece.id || !piece.itemId || !piece.pieceSeq) {
    return false;
  }

  if (piece.pieceSeq < 1) {
    return false;
  }

  return true;
}

/**
 * Validates all pieces in an array
 * @param pieces - Pieces array to validate
 * @returns Array of invalid piece IDs
 */
export function validatePieces(pieces: PreSubmissionPiece[]): string[] {
  return pieces
    .filter((piece) => !validatePieceData(piece))
    .map((piece) => piece.id);
}

/**
 * Adds a new piece to existing pieces
 * @param pieces - Current pieces array
 * @param itemId - Item ID
 * @returns Updated pieces array with new piece
 */
export function addPiece(
  pieces: PreSubmissionPiece[],
  itemId: string
): PreSubmissionPiece[] {
  const maxSeq =
    pieces.length > 0
      ? Math.max(...pieces.map((p) => p.pieceSeq))
      : 0;

  const newPiece: PreSubmissionPiece = {
    id: `temp-${itemId}-${maxSeq + 1}`,
    itemId,
    pieceSeq: maxSeq + 1,
  };

  return [...pieces, newPiece];
}

/**
 * Removes a piece from pieces array
 * @param pieces - Current pieces array
 * @param pieceId - Piece ID to remove
 * @returns Updated pieces array
 */
export function removePiece(
  pieces: PreSubmissionPiece[],
  pieceId: string
): PreSubmissionPiece[] {
  const filtered = pieces.filter((p) => p.id !== pieceId);
  
  // Re-sequence pieces
  return filtered.map((piece, index) => ({
    ...piece,
    pieceSeq: index + 1,
  }));
}

/**
 * Adjusts pieces count to match quantity
 * @param pieces - Current pieces array
 * @param itemId - Item ID
 * @param quantity - Target quantity
 * @returns Updated pieces array
 */
export function adjustPiecesToQuantity(
  pieces: PreSubmissionPiece[],
  itemId: string,
  quantity: number
): PreSubmissionPiece[] {
  const currentCount = pieces.length;

  if (quantity === currentCount) {
    return pieces;
  }

  if (quantity > currentCount) {
    // Add new pieces
    const newPieces = generatePiecesForItem(itemId, quantity - currentCount);
    const maxSeq = currentCount > 0 ? Math.max(...pieces.map((p) => p.pieceSeq)) : 0;
    
    return [
      ...pieces,
      ...newPieces.map((piece, index) => ({
        ...piece,
        pieceSeq: maxSeq + index + 1,
      })),
    ];
  }

  // Remove excess pieces (keep first N pieces)
  const updated = pieces.slice(0, quantity);
  
  // Re-sequence
  return updated.map((piece, index) => ({
    ...piece,
    pieceSeq: index + 1,
  }));
}

