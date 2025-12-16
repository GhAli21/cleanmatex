import { describe, it, expect } from '@jest/globals';
import { OrderStatusEnum, WorkflowSettingsSchema } from '@/lib/validations/workflow-schema';

describe('workflow-schema', () => {
  it('validates OrderStatus enum', () => {
    expect(OrderStatusEnum.parse('READY')).toBe('READY');
    expect(() => OrderStatusEnum.parse('UNKNOWN')).toThrow();
  });

  it('validates WorkflowSettings schema', () => {
    const valid = {
      id: '00000000-0000-0000-0000-000000000001',
      tenant_org_id: '00000000-0000-0000-0000-000000000002',
      service_category_code: null,
      workflow_steps: ['INTAKE', 'PREPARATION', 'READY'],
      status_transitions: {
        INTAKE: ['PREPARATION'],
        PREPARATION: ['READY'],
        READY: [],
      },
      quality_gate_rules: {
        READY: {
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


