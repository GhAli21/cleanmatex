/**
 * Piece Validation Utilities
 * Validates piece data and operations
 */

import type { OrderItemPiece } from '@/types/order';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate piece sequence uniqueness
 */
export function validatePieceSequence(
  pieces: OrderItemPiece[],
  newSeq: number
): ValidationResult {
  const errors: string[] = [];

  if (newSeq < 1) {
    errors.push('Piece sequence must be at least 1');
  }

  const existingSeq = pieces.find((p) => p.piece_seq === newSeq);
  if (existingSeq) {
    errors.push(`Piece sequence ${newSeq} already exists`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate piece status transition
 */
export function validateStatusTransition(
  currentStatus: string | null,
  newStatus: string | null
): ValidationResult {
  const errors: string[] = [];

  const validStatuses = ['intake', 'processing', 'qa', 'ready'];
  if (newStatus && !validStatuses.includes(newStatus)) {
    errors.push(`Invalid status: ${newStatus}`);
  }

  // Allow any transition for now (can add business rules later)
  // Example: can't go from 'ready' back to 'intake'

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate piece quantity
 */
export function validateQuantity(quantity: number | null): ValidationResult {
  const errors: string[] = [];

  if (quantity === null || quantity === undefined) {
    errors.push('Quantity is required');
  } else if (quantity < 1) {
    errors.push('Quantity must be at least 1');
  } else if (quantity > 1000) {
    errors.push('Quantity cannot exceed 1000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate piece price
 */
export function validatePrice(price: number): ValidationResult {
  const errors: string[] = [];

  if (price < 0) {
    errors.push('Price cannot be negative');
  }

  if (price > 1000000) {
    errors.push('Price cannot exceed 1,000,000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate barcode format
 */
export function validateBarcode(barcode: string | null): ValidationResult {
  const errors: string[] = [];

  if (barcode && barcode.length > 100) {
    errors.push('Barcode cannot exceed 100 characters');
  }

  // Allow alphanumeric, hyphens, underscores
  if (barcode && !/^[A-Za-z0-9\-_]+$/.test(barcode)) {
    errors.push('Barcode contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate piece update data
 */
export function validatePieceUpdate(
  piece: Partial<OrderItemPiece>,
  existingPieces?: OrderItemPiece[]
): ValidationResult {
  const errors: string[] = [];

  // Validate quantity
  if (piece.quantity !== undefined) {
    const qtyResult = validateQuantity(piece.quantity);
    if (!qtyResult.valid) {
      errors.push(...qtyResult.errors);
    }
  }

  // Validate price
  if (piece.price_per_unit !== undefined) {
    const priceResult = validatePrice(piece.price_per_unit);
    if (!priceResult.valid) {
      errors.push(...priceResult.errors);
    }
  }

  // Validate total price
  if (piece.total_price !== undefined) {
    const totalPriceResult = validatePrice(piece.total_price);
    if (!totalPriceResult.valid) {
      errors.push(...totalPriceResult.errors);
    }
  }

  // Validate barcode
  if (piece.barcode !== undefined) {
    const barcodeResult = validateBarcode(piece.barcode);
    if (!barcodeResult.valid) {
      errors.push(...barcodeResult.errors);
    }
  }

  // Validate status transition
  if (piece.piece_status !== undefined && existingPieces) {
    const existingPiece = existingPieces.find((p) => p.id === piece.id);
    if (existingPiece) {
      const statusResult = validateStatusTransition(
        existingPiece.piece_status,
        piece.piece_status
      );
      if (!statusResult.valid) {
        errors.push(...statusResult.errors);
      }
    }
  }

  // Validate piece sequence if provided
  if (piece.piece_seq !== undefined && existingPieces) {
    const seqResult = validatePieceSequence(existingPieces, piece.piece_seq);
    if (!seqResult.valid) {
      errors.push(...seqResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate batch piece updates
 */
export function validateBatchUpdates(
  updates: Array<{ pieceId: string; updates: Partial<OrderItemPiece> }>,
  existingPieces: OrderItemPiece[]
): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(updates) || updates.length === 0) {
    errors.push('Updates array is required and cannot be empty');
    return { valid: false, errors };
  }

  if (updates.length > 100) {
    errors.push('Cannot update more than 100 pieces at once');
  }

  // Validate each update
  for (const update of updates) {
    if (!update.pieceId) {
      errors.push('Piece ID is required for each update');
      continue;
    }

    const piece = existingPieces.find((p) => p.id === update.pieceId);
    if (!piece) {
      errors.push(`Piece ${update.pieceId} not found`);
      continue;
    }

    const pieceResult = validatePieceUpdate(update.updates, existingPieces);
    if (!pieceResult.valid) {
      errors.push(
        `Piece ${update.pieceId}: ${pieceResult.errors.join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

