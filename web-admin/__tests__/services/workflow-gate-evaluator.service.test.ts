import {
  evaluateWorkflowGate,
  evaluateWorkflowGateSet,
  type WorkflowGateOrderFacts,
} from '@/lib/services/workflow/workflow-gate-evaluator.service';

const settledOrder: WorkflowGateOrderFacts = {
  preparationStatus: 'completed',
  rackLocation: 'R-12',
  paymentTypeCode: 'PAY_IN_ADVANCE',
  outstandingAmount: '0.0000',
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
});
