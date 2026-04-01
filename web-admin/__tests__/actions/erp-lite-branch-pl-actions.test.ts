jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/lib/services/erp-lite-phase10.service', () => ({
  ErpLitePhase10Service: {
    createAllocationRule: jest.fn(),
    postCostRun: jest.fn(),
  },
}));

import {
  createErpLiteAllocationRuleAction,
  postErpLiteCostRunAction,
} from '@/app/actions/erp-lite/branch-pl-actions';
import { ErpLitePhase10Service } from '@/lib/services/erp-lite-phase10.service';

const mockService = ErpLitePhase10Service as unknown as {
  createAllocationRule: jest.Mock;
  postCostRun: jest.Mock;
};

function buildFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('ERP-Lite branch-pl actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects allocation rule creation success with the created notice', async () => {
    await expect(
      createErpLiteAllocationRuleAction(
        buildFormData({
          name: 'Revenue Share',
          basis_code: 'REVENUE',
        })
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/erp-lite/branch-pl?notice=allocation-rule-created'
    );

    expect(mockService.createAllocationRule).toHaveBeenCalledWith({
      rule_code: null,
      name: 'Revenue Share',
      name2: null,
      basis_code: 'REVENUE',
      effective_from: null,
    });
  });

  it('redirects cost run post errors back to branch p&l', async () => {
    mockService.postCostRun.mockRejectedValueOnce(new Error('Draft cost run has no detail lines'));

    await expect(
      postErpLiteCostRunAction(
        buildFormData({
          cost_run_id: 'run-1',
        })
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/erp-lite/branch-pl?error=Draft+cost+run+has+no+detail+lines'
    );
  });
});
