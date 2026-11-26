/** One evidence link is issued only after the authorized audit request reaches the server. */
export interface DeliveryProofEvidenceLink {
  url: string;
  /** Short-lived signed link to the locked File Util proof file. */
  source: 'private_signed';
}

/** Immutable proof and handover record for one completed delivery stop. */
export interface DeliveryProofAuditEntry {
  podId: string;
  stopId: string;
  routeId: string;
  stopSequence: number;
  stopStatus: string;
  podMethodCode: string;
  deliveredAt: string | null;
  verifiedAt: string | null;
  deliveredBy: string | null;
  notes: string | null;
  signature: DeliveryProofEvidenceLink | null;
  photos: DeliveryProofEvidenceLink[];
}

/** Order-level delivery evidence, payment state, and current workflow outcome. */
export interface DeliveryProofAudit {
  order: {
    id: string;
    orderNo: string;
    branchId: string | null;
    workflowOutcome: string | null;
    paymentState: 'settled' | 'balance_due';
    outstandingAmount: number;
    currencyCode: string | null;
  };
  deliveryStopCount: number;
  entries: DeliveryProofAuditEntry[];
}
