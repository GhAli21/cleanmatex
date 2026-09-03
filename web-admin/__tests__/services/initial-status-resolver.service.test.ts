import {
  resolveInitialStatus,
  resolveInitialStatusFromSemanticRules,
  SemanticInitialStatusResolutionError,
} from '@/lib/services/workflow/initial-status-resolver.service';

describe('semantic initial-status resolver', () => {
  const rules = [
    {
      rule_code: 'QUICK_DROP',
      order_source_code: 'web_admin',
      order_type_id: null,
      is_retail: false,
      is_quick_drop: true,
      initial_status: 'preparing',
      priority: 10,
    },
    {
      rule_code: 'STANDARD',
      order_source_code: 'web_admin',
      order_type_id: null,
      is_retail: false,
      is_quick_drop: false,
      initial_status: 'intake',
      priority: 20,
    },
  ];

  it('selects the immutable semantic rule for the new order context', () => {
    expect(resolveInitialStatusFromSemanticRules(rules, {
      orderSourceCode: 'web_admin',
      isRetail: false,
      isQuickDrop: true,
    })).toEqual({ initialStatus: 'preparing', ruleCode: 'QUICK_DROP' });
  });

  it('matches a typed POS laundry order against a POS-scoped start rule', () => {
    expect(resolveInitialStatusFromSemanticRules([
      {
        rule_code: 'INIT_RETAIL_DELIVERED',
        order_source_code: null,
        order_type_id: null,
        is_retail: true,
        is_quick_drop: false,
        initial_status: 'delivered',
        priority: 100,
      },
      {
        rule_code: 'INIT_TO_PROCESSING',
        order_source_code: 'pos',
        order_type_id: 'POS',
        is_retail: null,
        is_quick_drop: null,
        initial_status: 'processing',
        priority: 111,
      },
    ], {
      orderSourceCode: 'pos',
      orderTypeId: 'POS',
      isRetail: false,
      isQuickDrop: false,
    })).toEqual({ initialStatus: 'processing', ruleCode: 'INIT_TO_PROCESSING' });
  });

  it('fails closed instead of applying the legacy intake fallback to an unmatched semantic order', () => {
    expect(() => resolveInitialStatusFromSemanticRules(rules, {
      orderSourceCode: 'customer_mobile_app',
      isRetail: false,
      isQuickDrop: false,
    })).toThrow(SemanticInitialStatusResolutionError);
  });

  it('rejects an order create whose compiled policy has no matching rule', async () => {
    await expect(resolveInitialStatus({
      orderSourceCode: 'web_admin',
      isRetail: false,
      semanticInitialRules: [],
    })).rejects.toBeInstanceOf(SemanticInitialStatusResolutionError);
  });
});
