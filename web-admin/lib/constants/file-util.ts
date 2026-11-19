/**
 * File Util — codes mirrored from the `sys_file_*` lookup tables (migration 0743) and the
 * access rules of each file category.
 *
 * Every string here equals the DB value exactly (CLAUDE.md rule 9). Rules that change by data
 * (allowed types, limits, purposes) are NOT copied here; they are read from the DB at upload time.
 */

/** `sys_file_category_cd.category_code` — kind of record a file belongs to. */
export const FILE_CATEGORIES = {
  ORDER_FILE: 'ORDER_FILE',
  CUSTOMER_FILE: 'CUSTOMER_FILE',
  PRODUCT_IMAGE: 'PRODUCT_IMAGE',
  TENANT_LOGO: 'TENANT_LOGO',
} as const;
export type FileCategoryCode = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];
export const FILE_CATEGORY_CODES = Object.values(FILE_CATEGORIES) as [FileCategoryCode, ...FileCategoryCode[]];

/** `sys_file_status_cd.status_code` — fixed system lifecycle codes. */
export const FILE_STATUSES = {
  PENDING: 'PENDING',
  READY: 'READY',
  DELETED: 'DELETED',
} as const;
export type FileStatusCode = (typeof FILE_STATUSES)[keyof typeof FILE_STATUSES];

/** `sys_file_source_cd.source_code` — screen or channel a file was uploaded from. */
export const FILE_SOURCES = {
  ORDER_NEW: 'ORDER_NEW',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_DETAIL: 'ORDER_DETAIL',
  ORDER_PREPARATION: 'ORDER_PREPARATION',
  ORDER_PROCESSING: 'ORDER_PROCESSING',
  ORDER_ASSEMBLY: 'ORDER_ASSEMBLY',
  ORDER_QA: 'ORDER_QA',
  ORDER_PACKING: 'ORDER_PACKING',
  ORDER_READY: 'ORDER_READY',
  ORDER_DELIVERY: 'ORDER_DELIVERY',
  ORDER_ISSUE: 'ORDER_ISSUE',
  CUSTOMER_PROFILE: 'CUSTOMER_PROFILE',
  PRODUCT_SETUP: 'PRODUCT_SETUP',
  TENANT_SETTINGS: 'TENANT_SETTINGS',
  MOBILE_APP: 'MOBILE_APP',
  API: 'API',
  SYSTEM: 'SYSTEM',
} as const;
export type FileSourceCode = (typeof FILE_SOURCES)[keyof typeof FILE_SOURCES];
export const FILE_SOURCE_CODES = Object.values(FILE_SOURCES) as [FileSourceCode, ...FileSourceCode[]];

/** `sys_file_ref_type_cd.ref_type_code` — sub-record of an order a file can point at. */
export const FILE_REF_TYPES = {
  ORDER_ITEM: 'ORDER_ITEM',
  ORDER_PIECE: 'ORDER_PIECE',
  ORDER_ISSUE: 'ORDER_ISSUE',
  DELIVERY_STOP: 'DELIVERY_STOP',
  QA_DECISION: 'QA_DECISION',
  ASM_TASK: 'ASM_TASK',
  ASM_EXCEPTION: 'ASM_EXCEPTION',
} as const;
export type FileRefTypeCode = (typeof FILE_REF_TYPES)[keyof typeof FILE_REF_TYPES];
export const FILE_REF_TYPE_CODES = Object.values(FILE_REF_TYPES) as [FileRefTypeCode, ...FileRefTypeCode[]];

/** `sys_file_purpose_cd.purpose_code` values seeded by 0743, per category (HQ may add more). */
export const FILE_PURPOSES = {
  ORDER_FILE: {
    BEFORE_IMAGE: 'BEFORE_IMAGE',
    AFTER_IMAGE: 'AFTER_IMAGE',
    DAMAGE: 'DAMAGE',
    STAIN: 'STAIN',
    ISSUE_EVIDENCE: 'ISSUE_EVIDENCE',
    QA_EVIDENCE: 'QA_EVIDENCE',
    ASSEMBLY_EXCEPTION: 'ASSEMBLY_EXCEPTION',
    DELIVERY_PROOF: 'DELIVERY_PROOF',
    // Added by 0771: counter pickup proof, locked by the pickup completion command.
    PICKUP_PROOF: 'PICKUP_PROOF',
    SIGNATURE: 'SIGNATURE',
    ITEM_VIDEO: 'ITEM_VIDEO',
    CUSTOMER_DOCUMENT: 'CUSTOMER_DOCUMENT',
    OTHER: 'OTHER',
  },
  CUSTOMER_FILE: { PHOTO: 'PHOTO', ID_DOCUMENT: 'ID_DOCUMENT', OTHER: 'OTHER' },
  PRODUCT_IMAGE: { MAIN: 'MAIN', FOR_ORDER: 'FOR_ORDER', BACKSIDE: 'BACKSIDE', GALLERY: 'GALLERY' },
  // DARK and FAVICON added by 0757 (theme runtime, PR-07).
  TENANT_LOGO: { MAIN: 'MAIN', RECEIPT: 'RECEIPT', DARK: 'DARK', FAVICON: 'FAVICON' },
} as const;

/**
 * Who may read or change the files of each category. Files reuse the owning domain's existing
 * permissions (no File Util permission codes); all codes exist in `sys_auth_permissions`.
 * Each list is "any of": holding one listed code is enough.
 */
export const FILE_CATEGORY_ACCESS: Record<FileCategoryCode, { read: readonly string[]; write: readonly string[] }> = {
  // Order files: editors, and floor staff who move orders through the workflow (they report
  // issues and assembly exceptions with photos); either permission is enough.
  ORDER_FILE: { read: ['orders:read'], write: ['orders:update', 'orders:transition'] },
  CUSTOMER_FILE: { read: ['customers:read'], write: ['customers:update'] },
  PRODUCT_IMAGE: { read: ['products:read'], write: ['products:update'] },
  TENANT_LOGO: { read: ['settings:read'], write: ['settings:branding'] },
};

/** Lifetime of signed read URLs for private files: 5 minutes, never stored. */
export const FILE_SIGNED_URL_TTL_SECONDS = 300;
/** PENDING uploads older than this are abandoned: 24 hours. Must equal the interval in fn_file_util_expire_pending (0744). */
export const FILE_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
/** Most records one list call may ask for (bounds query size for list screens). */
export const FILE_LIST_MAX_ENTITIES = 100;
/** Most files one sign call may ask for. */
export const FILE_SIGN_MAX_IDS = 200;
/** Thumbnail objects are always WebP, made in the browser. */
export const FILE_THUMB_MIME = 'image/webp';
