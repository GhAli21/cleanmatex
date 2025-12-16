export const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['INTAKE', 'CANCELLED'],
  INTAKE: ['PREPARATION', 'CANCELLED'],
  PREPARATION: ['SORTING', 'CANCELLED'],
  SORTING: ['WASHING', 'FINISHING', 'CANCELLED'],
  WASHING: ['DRYING', 'CANCELLED'],
  DRYING: ['FINISHING', 'CANCELLED'],
  FINISHING: ['ASSEMBLY', 'PACKING', 'CANCELLED'],
  ASSEMBLY: ['QA', 'CANCELLED'],
  QA: ['PACKING', 'WASHING', 'CANCELLED'],
  PACKING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'READY', 'CANCELLED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export type QualityGateChecker = (args: {
  orderId: string;
  tenantId: string;
}) => Promise<{ canMove: boolean; blockers: string[] }>;

// Registry placeholders; actual checks implemented in service
export const QUALITY_GATES: Record<string, QualityGateChecker | undefined> = {
  READY: async () => ({ canMove: true, blockers: [] }),
};


