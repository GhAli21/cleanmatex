/** Normalized compiled evidence row consumed by fulfilment completion commands. */
export interface CompiledDeliveryEvidenceRow {
  fulfilment_channel: string;
  evidence_method_code: string;
  is_required: boolean;
  minimum_count: number;
}

const EXECUTABLE_DELIVERY_METHODS = new Set(['signature', 'photo', 'mixed', 'pod', 'notes']);

const EVIDENCE_BY_POD_METHOD: Record<string, string> = {
  SIGNATURE: 'signature',
  PHOTO: 'photo',
  MIXED: 'mixed',
  POD: 'pod',
  NOTES: 'notes',
};

/** Stable proof failures produced from compiled profile evidence, not the live POD catalog. */
export type CompiledDeliveryEvidenceErrorCode = 'POD_METHOD_INVALID' | 'POD_EVIDENCE_REQUIRED';

/**
 * Transport-neutral compiled evidence failure. The delivery command maps this to
 * its public error surface without leaking artifact internals.
 */
export class CompiledDeliveryEvidenceError extends Error {
  readonly code: CompiledDeliveryEvidenceErrorCode;

  constructor(code: CompiledDeliveryEvidenceErrorCode, message: string) {
    super(message);
    this.name = 'CompiledDeliveryEvidenceError';
    this.code = code;
  }
}

function methodKey(row: CompiledDeliveryEvidenceRow): string {
  return row.evidence_method_code.trim().toLowerCase();
}

function deliveryEvidenceRows(evidence: readonly CompiledDeliveryEvidenceRow[]): CompiledDeliveryEvidenceRow[] {
  return evidence.filter((row) =>
    row.fulfilment_channel.trim().toLowerCase() === 'delivery'
    && EXECUTABLE_DELIVERY_METHODS.has(methodKey(row)),
  );
}

function pickupEvidenceRows(evidence: readonly CompiledDeliveryEvidenceRow[]): CompiledDeliveryEvidenceRow[] {
  return evidence.filter((row) => row.fulfilment_channel.trim().toLowerCase() === 'pickup');
}

function permittedDeliveryMethods(rows: CompiledDeliveryEvidenceRow[]): Set<string> {
  const permitted = new Set(rows.map(methodKey));
  if (permitted.has('signature') && permitted.has('photo')) permitted.add('mixed');
  if (permitted.has('notes') && !permitted.has('pod')) permitted.add('pod');
  return permitted;
}

const POD_CODE_BY_EVIDENCE: Record<string, string> = {
  signature: 'SIGNATURE',
  photo: 'PHOTO',
  mixed: 'MIXED',
  pod: 'POD',
  notes: 'NOTES',
};

/** Staff method codes permitted by compiled delivery evidence, excluding OTP. */
export function compiledDeliveryPodMethodCodes(
  evidence: readonly CompiledDeliveryEvidenceRow[],
): string[] {
  return [...permittedDeliveryMethods(deliveryEvidenceRows(evidence))]
    .map((method) => POD_CODE_BY_EVIDENCE[method])
    .filter((code): code is string => Boolean(code))
    .sort();
}

function requiredPhotoCount(rows: CompiledDeliveryEvidenceRow[], photoMethod: 'photo' | 'mixed'): number {
  const configured = rows
    .filter((row) => methodKey(row) === photoMethod)
    .map((row) => row.minimum_count);
  return Math.max(1, ...configured, 0);
}

/**
 * Narrows a semantic order's POD method to the compiled delivery evidence.
 * Legacy orders and artifacts without delivery evidence keep the catalog path.
 */
export function assertCompiledDeliveryEvidence(input: {
  evidence: readonly CompiledDeliveryEvidenceRow[];
  podMethodCode: string;
  hasSignature: boolean;
  photoCount: number;
  hasNotes?: boolean;
}): void {
  const rows = deliveryEvidenceRows(input.evidence);
  if (rows.length === 0) return;

  const selected = EVIDENCE_BY_POD_METHOD[input.podMethodCode];
  const permitted = permittedDeliveryMethods(rows);
  if (!selected || !permitted.has(selected)) {
    throw new CompiledDeliveryEvidenceError(
      'POD_METHOD_INVALID',
      'POD method is not permitted by the compiled delivery evidence policy.',
    );
  }

  const signatureRequired = selected === 'signature'
    || selected === 'mixed'
    || rows.some((row) => methodKey(row) === 'signature' && row.is_required)
    || rows.some((row) => methodKey(row) === 'mixed' && row.is_required);
  if (signatureRequired && !input.hasSignature) {
    throw new CompiledDeliveryEvidenceError('POD_EVIDENCE_REQUIRED', 'A signature is required.');
  }

  const photoRequired = selected === 'photo'
    || selected === 'mixed'
    || rows.some((row) => methodKey(row) === 'photo' && row.is_required)
    || rows.some((row) => methodKey(row) === 'mixed' && row.is_required);
  if (photoRequired) {
    const photoMethod = selected === 'mixed' || rows.some((row) => methodKey(row) === 'mixed' && row.is_required)
      ? 'mixed'
      : 'photo';
    const minimum = requiredPhotoCount(rows, photoMethod);
    if (input.photoCount < minimum) {
      throw new CompiledDeliveryEvidenceError(
        'POD_EVIDENCE_REQUIRED',
        minimum > 1 ? `At least ${minimum} delivery photos are required.` : 'At least one delivery photo is required.',
      );
    }
  }

  const notesRequired = rows.some((row) => methodKey(row) === 'notes' && row.is_required);
  if (notesRequired && !input.hasNotes) {
    throw new CompiledDeliveryEvidenceError('POD_EVIDENCE_REQUIRED', 'Delivery notes are required.');
  }
}

/** True when the snapshot artifact names permitted delivery methods and the catalog must not widen them. */
export function hasCompiledDeliveryEvidence(evidence: readonly CompiledDeliveryEvidenceRow[]): boolean {
  return deliveryEvidenceRows(evidence).length > 0;
}

/** Enforces optional compiled pickup notes. OTP remains rejected by the absence of an OTP verifier. */
export function assertCompiledPickupEvidence(input: {
  evidence: readonly CompiledDeliveryEvidenceRow[];
  hasNotes: boolean;
}): void {
  const rows = pickupEvidenceRows(input.evidence);
  const notesRequired = rows.some((row) => methodKey(row) === 'notes' && row.is_required);
  if (notesRequired && !input.hasNotes) {
    throw new CompiledDeliveryEvidenceError('POD_EVIDENCE_REQUIRED', 'Pickup notes are required.');
  }
}
