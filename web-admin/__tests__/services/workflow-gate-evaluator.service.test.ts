import {
  evaluateWorkflowGate,
  evaluateWorkflowGateSet,
  workflowGateNeedsExtendedFacts,
  type WorkflowGateOrderFacts,
} from '@/lib/services/workflow/workflow-gate-evaluator.service';

const settledOrder: WorkflowGateOrderFacts = {
  preparationStatus: 'completed',
  rackLocation: 'R-12',
  paymentTypeCode: 'PAY_IN_ADVANCE',
  outstandingAmount: '0.0000',
  currentStatus: 'ready',
  evaluationPhase: 'execute',
  pieceTrackingEnabled: true,
  activeItemCount: 2,
  unreadyItemCount: 0,
  expectedPieceCount: 2,
  activePieceCount: 2,
  scannedPieceCount: 2,
  readyPieceCount: 2,
  openIssueCount: 0,
  qaTaskCount: 1,
  qaPassedTaskCount: 1,
  hasOpenPickupRelease: true,
  hasActiveDeliveryStop: true,
};

describe('workflow gate evaluator', () => {
  it('blocks semantic fulfilment gates when a pay-on-collection balance remains', () => {
    const result = evaluateWorkflowGate(
      'fin_release_eligible',
      { ...settledOrder, paymentTypeCode: 'PAY_ON_COLLECTION', outstandingAmount: '4.5000' },
      'semantic',
    );

    expect(result).toEqual({
      allowed: false,
      blockedReasons: [expect.objectContaining({ code: 'GATE_FIN_RELEASE' })],
    });
  });

  it('allows a settled pay-on-collection order within the shared money tolerance', () => {
    const result = evaluateWorkflowGate(
      'fin_release_eligible',
      { ...settledOrder, paymentTypeCode: 'PAY_ON_COLLECTION', outstandingAmount: '0.0010' },
      'semantic',
    );

    expect(result).toEqual({ allowed: true, blockedReasons: [] });
  });

  it('delegates B2B credit fulfilment to the isolated B2B payment-hold seam', () => {
    const result = evaluateWorkflowGate(
      'fin_release_eligible',
      { ...settledOrder, paymentTypeCode: 'CREDIT_INVOICE', outstandingAmount: '0.0000' },
      'semantic',
    );

    expect(result).toEqual({ allowed: true, blockedReasons: [] });
  });

  it('returns every failed gate so one command response explains the full correction path', () => {
    const result = evaluateWorkflowGateSet(
      ['rack_required', 'fin_release_eligible'],
      { ...settledOrder, rackLocation: null, outstandingAmount: '1.0000' },
      'semantic',
    );

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toEqual([
      'GATE_RACK_REQUIRED',
      'GATE_FIN_RELEASE',
    ]);
  });

  it('never lets an unknown semantic gate silently pass, while retaining temporary legacy compatibility', () => {
    expect(evaluateWorkflowGate('future_gate', settledOrder, 'semantic')).toEqual({
      allowed: false,
      blockedReasons: [expect.objectContaining({ code: 'GATE_RUNTIME_UNAVAILABLE' })],
    });
    expect(evaluateWorkflowGate('future_gate', settledOrder, 'legacy')).toEqual({
      allowed: true,
      blockedReasons: [],
    });
  });

  it('fails closed when semantic piece facts were not loaded', () => {
    const result = evaluateWorkflowGate('all_pieces_scanned', {
      preparationStatus: 'completed',
      rackLocation: 'R-12',
      paymentTypeCode: 'PAY_IN_ADVANCE',
      outstandingAmount: '0',
    }, 'semantic');

    expect(result.blockedReasons[0]?.code).toBe('GATE_FACTS_UNAVAILABLE');
  });

  it('requires every tracked piece to be scanned and present', () => {
    expect(evaluateWorkflowGate(
      'all_pieces_scanned',
      { ...settledOrder, scannedPieceCount: 1 },
      'semantic',
    ).blockedReasons[0]?.code).toBe('GATE_PIECES_UNSCANNED');
    expect(evaluateWorkflowGate('all_pieces_scanned', settledOrder, 'semantic')).toEqual({
      allowed: true,
      blockedReasons: [],
    });
  });

  it('skips piece scan and ready checks when piece tracking is disabled', () => {
    const untracked = {
      ...settledOrder,
      pieceTrackingEnabled: false,
      expectedPieceCount: 0,
      activePieceCount: 0,
      scannedPieceCount: 0,
      readyPieceCount: 0,
    };
    expect(evaluateWorkflowGate('all_pieces_scanned', untracked, 'semantic').allowed).toBe(true);
    expect(evaluateWorkflowGate('all_pieces_ready', untracked, 'semantic').allowed).toBe(true);
  });

  it('blocks QA leave when issues remain or no passed QA task exists', () => {
    expect(evaluateWorkflowGate(
      'qa_passed',
      { ...settledOrder, openIssueCount: 1 },
      'semantic',
    ).blockedReasons[0]?.code).toBe('GATE_QA_NOT_PASSED');
    expect(evaluateWorkflowGate(
      'qa_passed',
      { ...settledOrder, qaTaskCount: 0, qaPassedTaskCount: 0 },
      'semantic',
    ).blockedReasons[0]?.code).toBe('GATE_QA_NOT_PASSED');
  });

  it('blocks pickup and delivery collection while a pay-on-collection balance remains', () => {
    const owing = {
      ...settledOrder,
      paymentTypeCode: 'PAY_ON_COLLECTION',
      outstandingAmount: '3.2500',
    };
    expect(evaluateWorkflowGate('pickup_collection_settled', owing, 'semantic').blockedReasons[0]?.code)
      .toBe('GATE_PICKUP_COLLECTION');
    expect(evaluateWorkflowGate('delivery_collection_settled', owing, 'semantic').blockedReasons[0]?.code)
      .toBe('GATE_DELIVERY_COLLECTION');
  });

  it('requires an open pickup release for staged pickup and an active delivery stop', () => {
    expect(evaluateWorkflowGate(
      'pickup_release_valid',
      { ...settledOrder, currentStatus: 'ready_for_pickup', hasOpenPickupRelease: false },
      'semantic',
    ).blockedReasons[0]?.code).toBe('GATE_PICKUP_RELEASE');
    expect(evaluateWorkflowGate(
      'delivery_stop_active',
      { ...settledOrder, hasActiveDeliveryStop: false },
      'semantic',
    ).blockedReasons[0]?.code).toBe('GATE_DELIVERY_STOP');
  });

  it('does not hide POD during discovery, then validates method-specific evidence at execute', () => {
    expect(evaluateWorkflowGate(
      'pod_evidence_valid',
      { ...settledOrder, evaluationPhase: 'discover' },
      'semantic',
    ).allowed).toBe(true);

    expect(evaluateWorkflowGate(
      'pod_evidence_valid',
      { ...settledOrder, evaluationPhase: 'execute' },
      'semantic',
      undefined,
      { podMethodCode: 'SIGNATURE', signatureEvidenceId: 'sig-1' },
    ).allowed).toBe(true);

    expect(evaluateWorkflowGate(
      'pod_evidence_valid',
      { ...settledOrder, evaluationPhase: 'execute' },
      'semantic',
      undefined,
      { podMethodCode: 'OTP', otpVerified: true },
    ).blockedReasons[0]?.code).toBe('GATE_POD_EVIDENCE');
  });

  it('keeps partial fulfilment and returns fail closed in semantic mode', () => {
    expect(evaluateWorkflowGate('partial_fulfilment_supported', settledOrder, 'semantic').blockedReasons[0]?.code)
      .toBe('GATE_PARTIAL_UNSUPPORTED');
    expect(evaluateWorkflowGate('return_service_available', settledOrder, 'semantic').blockedReasons[0]?.code)
      .toBe('GATE_RETURN_UNSUPPORTED');
    expect(evaluateWorkflowGate('partial_fulfilment_supported', settledOrder, 'legacy').allowed).toBe(true);
  });

  it('identifies which gate codes need extra locked order facts', () => {
    expect(workflowGateNeedsExtendedFacts(['rack_required', 'fin_release_eligible'])).toBe(false);
    expect(workflowGateNeedsExtendedFacts(['qa_passed'])).toBe(true);
  });
});
