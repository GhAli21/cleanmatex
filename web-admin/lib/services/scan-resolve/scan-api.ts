/**
 * Shared bits for the scan and lookup API routes (HFC P3b, plan section 7.1).
 */
import { NextResponse } from 'next/server';
import { log } from '@/lib/utils/logger';
import { scanErrorStatus, type ScanErrorCode } from '@/lib/services/scan-resolve/scan-resolve.service';

/** Plain-English fallback; the UI shows its own EN/AR text by `code`. */
const MESSAGES: Record<string, string> = {
  SCAN_NOT_FOUND: 'No order or piece matches this code',
  SCAN_AMBIGUOUS: 'This code matches more than one record',
  SCAN_UNSUPPORTED_PAYLOAD: 'This label is not supported',
  SCAN_INVALID: 'Invalid code',
  ORDER_NOT_FOUND: 'Order not found',
  PIECE_NOT_FOUND: 'Piece not found',
  VALIDATION_ERROR: 'Invalid request',
  PIECE_TAG_ORDER_CLOSED: 'The order is delivered, closed or cancelled; its tags are free',
  PIECE_TAG_PIECE_REMOVED: 'This piece was removed from the order',
};

export function apiError(code: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, error: MESSAGES[code] ?? code, code, ...extra }, { status });
}

export function scanError(code: ScanErrorCode): NextResponse {
  return apiError(code, scanErrorStatus(code));
}

export function apiFailure(endpoint: string, error: unknown): NextResponse {
  log.error(`[API] ${endpoint} error`, error instanceof Error ? error : new Error(String(error)), {
    feature: 'scan',
    action: 'lookup',
    endpoint,
  });
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
