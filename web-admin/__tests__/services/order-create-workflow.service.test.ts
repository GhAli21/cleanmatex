import {
  hydrateOrderCreateColumns,
  OrderCreatePresetError,
} from '@/lib/services/workflow/order-create-hydrator';
import { resolveOrderCreateWorkflowState } from '@/lib/services/workflow/order-create-workflow.service';

describe('order-create-hydrator', () => {
  it('stamps POS in-hand intake and leaves prep pending', () => {
    const hydrated = hydrateOrderCreateColumns('POS_IN_HAND', {
      userId: '11111111-1111-1111-1111-111111111111',
      now: new Date('2026-09-03T12:00:00.000Z'),
      receivedInfo: 'counter',
    });

    expect(hydrated).toMatchObject({
      physical_intake_status: 'received',
      physical_intake_by: '11111111-1111-1111-1111-111111111111',
      received_info: 'counter',
      preparation_status: 'pending',
      prepared_at: null,
      prepared_by: null,
    });
    expect(hydrated.physical_intake_at?.toISOString()).toBe('2026-09-03T12:00:00.000Z');
    expect(hydrated.received_at?.toISOString()).toBe('2026-09-03T12:00:00.000Z');
  });

  it('keeps remote draft without intake stamps', () => {
    expect(hydrateOrderCreateColumns('REMOTE_DRAFT', { userId: null })).toMatchObject({
      physical_intake_status: 'pending_dropoff',
      physical_intake_at: null,
      received_at: null,
      preparation_status: 'pending',
    });
  });

  it('keeps home collection pending without intake stamps', () => {
    expect(hydrateOrderCreateColumns('HOME_COLLECTION_PENDING', { userId: null })).toMatchObject({
      physical_intake_status: 'pending_dropoff',
      physical_intake_at: null,
      received_at: null,
      preparation_status: 'pending',
    });
  });

  it('fails closed on unknown preset', () => {
    expect(() => hydrateOrderCreateColumns('NOT_A_PRESET', { userId: null })).toThrow(
      OrderCreatePresetError,
    );
  });
});

describe('order-create-workflow', () => {
  const rules = [
    {
      rule_code: 'INIT_POS_RETAIL',
      order_source_code: 'pos',
      order_type_id: null,
      is_retail: true,
      is_quick_drop: null,
      initial_status: 'delivered',
      priority: 10,
      create_preset_code: 'RETAIL_SOLD',
    },
    {
      rule_code: 'INIT_POS_QUICK_DROP',
      order_source_code: 'pos',
      order_type_id: null,
      is_retail: false,
      is_quick_drop: true,
      initial_status: 'intake',
      priority: 20,
      create_preset_code: 'POS_QUICK_DROP',
    },
    {
      rule_code: 'INIT_POS_PROCESSING',
      order_source_code: 'pos',
      order_type_id: null,
      is_retail: false,
      is_quick_drop: false,
      initial_status: 'processing',
      priority: 30,
      create_preset_code: 'POS_IN_HAND',
    },
    {
      rule_code: 'INIT_MOBILE_HOME_COLLECTION',
      order_source_code: 'customer_mobile_app',
      order_type_id: 'HOME_COLLECTION',
      is_retail: false,
      is_quick_drop: null,
      initial_status: 'awaiting_collection',
      priority: 40,
      create_preset_code: 'HOME_COLLECTION_PENDING',
    },
    {
      rule_code: 'INIT_MOBILE_CND',
      order_source_code: 'customer_mobile_app',
      order_type_id: 'COLLECTION_AND_DELIVERY',
      is_retail: false,
      is_quick_drop: null,
      initial_status: 'awaiting_collection',
      priority: 45,
      create_preset_code: 'HOME_COLLECTION_PENDING',
    },
    {
      rule_code: 'INIT_MOBILE_DRAFT',
      order_source_code: 'customer_mobile_app',
      order_type_id: null,
      is_retail: false,
      is_quick_drop: null,
      initial_status: 'draft',
      priority: 50,
      create_preset_code: 'REMOTE_DRAFT',
    },
  ];

  it('resolves POS normal laundry to processing with POS_IN_HAND', async () => {
    const state = await resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'LAUNDRY' }],
      isQuickDrop: false,
      orderTypeId: 'POS',
      sourceRow: {
        order_source_code: 'pos',
        requires_remote_intake_confirm: false,
        is_active: true,
      },
      semanticInitialRules: rules,
      userId: '11111111-1111-1111-1111-111111111111',
    });

    expect(state.initialStatus).toBe('processing');
    expect(state.createPresetCode).toBe('POS_IN_HAND');
    expect(state.hydrated.physical_intake_status).toBe('received');
  });

  it('resolves POS retail to delivered with RETAIL_SOLD', async () => {
    const state = await resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'RETAIL_ITEMS' }],
      isQuickDrop: false,
      sourceRow: {
        order_source_code: 'pos',
        requires_remote_intake_confirm: false,
        is_active: true,
      },
      semanticInitialRules: rules,
      userId: null,
    });

    expect(state.initialStatus).toBe('delivered');
    expect(state.createPresetCode).toBe('RETAIL_SOLD');
    expect(state.hydrated.preparation_status).toBe('completed');
  });

  it('resolves mobile remote to draft with REMOTE_DRAFT', async () => {
    const state = await resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'LAUNDRY' }],
      sourceRow: {
        order_source_code: 'customer_mobile_app',
        requires_remote_intake_confirm: true,
        is_active: true,
      },
      semanticInitialRules: rules,
      userId: null,
    });

    expect(state.initialStatus).toBe('draft');
    expect(state.createPresetCode).toBe('REMOTE_DRAFT');
    expect(state.hydrated.physical_intake_status).toBe('pending_dropoff');
  });

  it('resolves mobile HOME_COLLECTION to awaiting_collection with HOME_COLLECTION_PENDING', async () => {
    const state = await resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'LAUNDRY' }],
      orderTypeId: 'HOME_COLLECTION',
      sourceRow: {
        order_source_code: 'customer_mobile_app',
        requires_remote_intake_confirm: true,
        is_active: true,
      },
      semanticInitialRules: rules,
      userId: null,
    });

    expect(state.initialStatus).toBe('awaiting_collection');
    expect(state.createPresetCode).toBe('HOME_COLLECTION_PENDING');
    expect(state.hydrated.physical_intake_status).toBe('pending_dropoff');
    expect(state.hydrated.received_at).toBeNull();
  });

  it('resolves mobile COLLECTION_AND_DELIVERY to awaiting_collection', async () => {
    const state = await resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'LAUNDRY' }],
      orderTypeId: 'COLLECTION_AND_DELIVERY',
      sourceRow: {
        order_source_code: 'customer_mobile_app',
        requires_remote_intake_confirm: true,
        is_active: true,
      },
      semanticInitialRules: rules,
      userId: null,
    });

    expect(state.initialStatus).toBe('awaiting_collection');
    expect(state.createPresetCode).toBe('HOME_COLLECTION_PENDING');
  });

  it('fails closed when the matched Initial rule has no create preset', async () => {
    await expect(resolveOrderCreateWorkflowState({
      items: [{ serviceCategoryCode: 'LAUNDRY' }],
      isQuickDrop: false,
      sourceRow: {
        order_source_code: 'pos',
        requires_remote_intake_confirm: false,
        is_active: true,
      },
      semanticInitialRules: [{
        rule_code: 'INIT_POS_PROCESSING',
        order_source_code: 'pos',
        order_type_id: null,
        is_retail: false,
        is_quick_drop: false,
        initial_status: 'processing',
        priority: 30,
        create_preset_code: null,
      }],
      userId: null,
    })).rejects.toBeInstanceOf(OrderCreatePresetError);
  });
});
