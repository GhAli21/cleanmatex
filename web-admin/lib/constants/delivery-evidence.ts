/** Database-mirrored proof types accepted by the delivery evidence receipt table. */
export const DELIVERY_EVIDENCE_TYPES = {
  SIGNATURE: 'signature',
  PHOTO: 'photo',
} as const;

/** Valid proof types for a private delivery evidence upload. */
export type DeliveryEvidenceType =
  (typeof DELIVERY_EVIDENCE_TYPES)[keyof typeof DELIVERY_EVIDENCE_TYPES];

/** Matches the bucket limit so oversized files are rejected before storage work begins. */
export const DELIVERY_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

/** Draft uploads expire quickly because they are not delivery proof until completion consumes them. */
export const DELIVERY_EVIDENCE_UPLOAD_TTL_MS = 30 * 60 * 1000;

/** Private Supabase Storage bucket containing delivery proof objects. */
export const DELIVERY_EVIDENCE_BUCKET = 'delivery-pod-evidence';
