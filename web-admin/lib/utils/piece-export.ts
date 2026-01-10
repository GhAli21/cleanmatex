/**
 * Piece Export Utilities
 * Export piece data to CSV/Excel
 */

import type { OrderItemPiece } from '@/types/order';
import { formatDateTime } from './rtl';

export interface PieceExportOptions {
  format: 'csv' | 'excel';
  includeHeaders?: boolean;
  fields?: string[];
}

export function exportPiecesToCSV(
  pieces: OrderItemPiece[],
  options: PieceExportOptions = { format: 'csv' }
): string {
  const headers = options.fields || [
    'piece_seq',
    'piece_code',
    'barcode',
    'piece_status',
    'rack_location',
    'last_step',
    'is_rejected',
    'notes',
    'created_at',
  ];

  const rows = pieces.map(piece => {
    return headers.map(header => {
      const value = (piece as any)[header];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return formatDateTime(value);
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    });
  });

  const csvContent = [
    options.includeHeaders !== false ? headers.join(',') : '',
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].filter(Boolean).join('\n');

  return csvContent;
}

export function downloadPiecesCSV(
  pieces: OrderItemPiece[],
  filename: string = 'pieces-export.csv',
  options?: PieceExportOptions
): void {
  const csv = exportPiecesToCSV(pieces, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

