/**
 * Label data types and constants (HFC P4, plan T4.2). Pure: no server imports, so the browser renderer,
 * hooks and the API route share them with LabelDataService.
 */

export const ORDER_LABEL_SIZES = ['4x6in', '80mm', '58mm', 'A6'] as const;
export const PIECE_TAG_SIZES = ['58x30mm', '50x25mm', '80x40mm'] as const;
export type OrderLabelSize = (typeof ORDER_LABEL_SIZES)[number];
export type PieceTagSize = (typeof PIECE_TAG_SIZES)[number];

/** Label types configured in sys_label_printing_cf / org_label_printing_cf (migration 0685). */
export const LABEL_TYPES = ['ORDER_LABEL', 'PIECE_TAG', 'RECEIPT'] as const;
export type LabelType = (typeof LABEL_TYPES)[number];

export const MIN_LABEL_COPIES = 1;
export const MAX_LABEL_COPIES = 10;

/** Value columns of the label-printing config tables (camelCase). */
export const LABEL_PRINTING_FIELDS = ['sizeCode', 'showQr', 'showCustomerName', 'showOrderBarcode', 'copies'] as const;
export type LabelPrintingField = (typeof LABEL_PRINTING_FIELDS)[number];

/** Which fields apply to each label type; the others must stay null (DB CHECK chk_*_lblp_shape). */
export const LABEL_TYPE_FIELDS: Record<LabelType, readonly LabelPrintingField[]> = {
  ORDER_LABEL: ['sizeCode', 'showQr', 'showCustomerName', 'copies'],
  PIECE_TAG: ['sizeCode', 'showQr', 'copies'],
  RECEIPT: ['showOrderBarcode'],
};

/** Allowed size codes per label type (empty = the type has no size). */
export const LABEL_TYPE_SIZES: Record<LabelType, readonly string[]> = {
  ORDER_LABEL: ORDER_LABEL_SIZES,
  PIECE_TAG: PIECE_TAG_SIZES,
  RECEIPT: [],
};

/** One row of label-printing values. In overrides every value may be null (= inherit). */
export interface LabelPrintingValues {
  labelType: LabelType;
  sizeCode: string | null;
  showQr: boolean | null;
  showCustomerName: boolean | null;
  showOrderBarcode: boolean | null;
  copies: number | null;
}

/** Level that supplied an effective value; FEATURE_FLAG = capped by human_codes_scan_labels. */
export type LabelValueSource = 'BRANCH' | 'TENANT' | 'SYSTEM' | 'FEATURE_FLAG';

/** One row of fn_label_printing_resolve (branch -> tenant -> system per column). */
export interface ResolvedLabelPrinting extends LabelPrintingValues {
  /** Configured receipt barcode before the human_codes_scan_labels ceiling (RECEIPT only). */
  showOrderBarcodeConfigured: boolean | null;
  sources: Partial<Record<LabelPrintingField, LabelValueSource>>;
}

export interface LabelSettings {
  orderLabelSize: OrderLabelSize;
  /** Staff QR on the order label. */
  orderLabelQr: boolean;
  showCustomerName: boolean;
  /** Copies of the order label per print (1-10). */
  orderLabelCopies: number;
  pieceTagSize: PieceTagSize;
  /** Add the staff QR to piece tags (off by default: small tags fit CODE128 only). */
  pieceTagQr: boolean;
  /** Copies of each piece tag per print (1-10). */
  pieceTagCopies: number;
  /** Print the order CODE128 on the receipt (RECEIPT show_order_barcode, capped by human_codes_scan_labels). */
  receiptOrderCode128: boolean;
}

/** Fallback when the config cannot be read. Matches the sys_label_printing_cf seed, receipt barcode off. */
export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  orderLabelSize: '4x6in',
  orderLabelQr: true,
  showCustomerName: true,
  orderLabelCopies: 1,
  pieceTagSize: '58x30mm',
  pieceTagQr: false,
  pieceTagCopies: 1,
  receiptOrderCode128: false,
};

function pickSize<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function pickCopies(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= MIN_LABEL_COPIES && v <= MAX_LABEL_COPIES ? v : fallback;
}
function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Resolved config rows -> LabelSettings; a missing row or bad value falls back to DEFAULT_LABEL_SETTINGS. */
export function toLabelSettings(rows: readonly ResolvedLabelPrinting[] | null | undefined): LabelSettings {
  const by = new Map((rows ?? []).map((r) => [r.labelType, r]));
  const order = by.get('ORDER_LABEL');
  const tag = by.get('PIECE_TAG');
  const receipt = by.get('RECEIPT');
  const d = DEFAULT_LABEL_SETTINGS;
  return {
    orderLabelSize: pickSize(order?.sizeCode, ORDER_LABEL_SIZES, d.orderLabelSize),
    orderLabelQr: pickBool(order?.showQr, d.orderLabelQr),
    showCustomerName: pickBool(order?.showCustomerName, d.showCustomerName),
    orderLabelCopies: pickCopies(order?.copies, d.orderLabelCopies),
    pieceTagSize: pickSize(tag?.sizeCode, PIECE_TAG_SIZES, d.pieceTagSize),
    pieceTagQr: pickBool(tag?.showQr, d.pieceTagQr),
    pieceTagCopies: pickCopies(tag?.copies, d.pieceTagCopies),
    receiptOrderCode128: pickBool(receipt?.showOrderBarcode, d.receiptOrderCode128),
  };
}

export interface OrderLabelData {
  orderId: string;
  orderNo: string;
  /** CMX1:ORD:<order no> */
  staffQr: string;
  /** CODE128 value (= order no) */
  barcodeValue: string;
  branchName: string | null;
  branchName2: string | null;
  /** ISO timestamp or null */
  readyBy: string | null;
  itemCount: number;
  pieceCount: number;
  /** "First L." or null when the order label hides the customer name */
  customerShort: string | null;
}

export interface PieceTagData {
  pieceId: string;
  pieceCode: string;
  barcodeValue: string;
  /** CMX1:PEC:<piece code> */
  staffQr: string;
  orderNo: string;
  itemSrno: string | null;
  itemName: string | null;
  itemName2: string | null;
  pieceSeq: number;
  /** Pieces on the same line */
  pieceTotal: number;
  /** External (heat-seal / RFID) tag, if one is attached and not released */
  externalTag: string | null;
}

export interface LabelDataResult {
  order: OrderLabelData;
  pieces: PieceTagData[];
  settings: LabelSettings;
}

/** Which piece tags to build: none, all live pieces, or the given piece ids (others are ignored). */
export type PieceSelection = 'none' | 'all' | string[];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Any 8-4-4-4-12 hex id (seed ids are not always RFC version 4). */
export function isUuidLike(v: string): boolean {
  return UUID_RE.test(v);
}
/** Most piece ids one request may name. */
export const MAX_PIECE_SELECTION = 500;

/** `pieces` query value (none | all | uuid,uuid,...) -> selection, or null when it is not valid. */
export function parsePieceSelection(raw: string | null): PieceSelection | null {
  const v = (raw ?? 'none').trim();
  if (v === '' || v === 'none') return 'none';
  if (v === 'all') return 'all';
  const ids = Array.from(new Set(v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));
  if (ids.length === 0 || ids.length > MAX_PIECE_SELECTION) return null;
  return ids.every((id) => UUID_RE.test(id)) ? ids : null;
}
