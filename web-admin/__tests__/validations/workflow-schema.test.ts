import { describe, it, expect } from '@jest/globals';
import { OrderStatusEnum, WorkflowSettingsSchema } from '@/lib/validations/workflow-schema';

describe('workflow-schema', () => {
  it('validates OrderStatus enum', () => {
    expect(OrderStatusEnum.parse('ready')).toBe('ready');
    expect(() => OrderStatusEnum.parse('UNKNOWN')).toThrow();
  });

  it('validates WorkflowSettings schema', () => {
    const valid = {
      id: 'a0000000-0000-4000-8000-000000000001',
      tenant_org_id: 'a0000000-0000-4000-8000-000000000002',
      service_category_code: null,
      workflow_steps: ['intake', 'preparation', 'ready'],
      status_transitions: {
        intake: ['preparation'],
        preparation: ['ready'],
        ready: [],
      },
      quality_gate_rules: {
        ready: {
          requireAllItemsAssembled: true,
          requireQAPassed: true,
        },
      },
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const parsed = WorkflowSettingsSchema.parse(valid);
    expect(parsed.is_active).toBe(true);
  });
});
