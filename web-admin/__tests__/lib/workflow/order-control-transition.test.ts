import { resolveOrderControlTransition } from '@/lib/workflow/order-control-transition';

describe('resolveOrderControlTransition', () => {
  it('H1 holds work from processing and preserves the prior operational status', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'processing', holdFromStatus: null,
      note: 'Machine maintenance',
    })).toEqual({
      ok: true, toStatus: 'on_hold', nextHoldFromStatus: 'processing', clearHoldFromStatus: false,
    });
  });

  it('H2 resumes to the preserved status and clears the hold marker', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'processing', note: '',
    })).toEqual({
      ok: true, toStatus: 'processing', nextHoldFromStatus: null, clearHoldFromStatus: true,
    });
  });

  it('H3 holds from preparing and resumes to preparing', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'preparing', holdFromStatus: null,
      note: 'Waiting for missing bag',
    })).toEqual({
      ok: true, toStatus: 'on_hold', nextHoldFromStatus: 'preparing', clearHoldFromStatus: false,
    });
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'preparing', note: '',
    })).toEqual({
      ok: true, toStatus: 'preparing', nextHoldFromStatus: null, clearHoldFromStatus: true,
    });
  });

  it('H3 holds from ready and resumes to ready', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'ready', holdFromStatus: null,
      note: 'Customer asked to delay',
    })).toEqual({
      ok: true, toStatus: 'on_hold', nextHoldFromStatus: 'ready', clearHoldFromStatus: false,
    });
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'ready', note: '',
    })).toEqual({
      ok: true, toStatus: 'ready', nextHoldFromStatus: null, clearHoldFromStatus: true,
    });
  });

  it('H4 rejects nested hold and hold from terminal statuses', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'processing',
      note: 'Second hold attempt',
    })).toMatchObject({ ok: false, message: expect.stringContaining('already on hold') });

    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'processing', holdFromStatus: 'preparing',
      note: 'Would overwrite prior hold',
    })).toMatchObject({ ok: false, message: expect.stringContaining('already on hold') });

    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'delivered', holdFromStatus: null,
      note: 'Cannot hold delivered',
    })).toMatchObject({ ok: false, message: expect.stringContaining('this status') });

    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'cancelled', holdFromStatus: null,
      note: 'Cannot hold cancelled',
    })).toMatchObject({ ok: false, message: expect.stringContaining('this status') });

    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'stopped', holdFromStatus: null,
      note: 'Cannot hold stopped',
    })).toMatchObject({ ok: false, message: expect.stringContaining('this status') });

    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'draft', holdFromStatus: null,
      note: 'Cannot hold draft',
    })).toMatchObject({ ok: false, message: expect.stringContaining('this status') });
  });

  it('rejects resume when the preserved status is missing', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: null, note: '',
    })).toMatchObject({ ok: false, message: expect.stringContaining('hold_from_status') });
  });

  it('rejects resume when the order is not on hold', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'processing', holdFromStatus: 'processing', note: '',
    })).toMatchObject({ ok: false, message: expect.stringContaining('not on hold') });
  });

  it('permanently stops work and clears the hold marker', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'STOP_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'processing',
      note: 'Customer requested stop',
    })).toEqual({
      ok: true, toStatus: 'stopped', nextHoldFromStatus: null, clearHoldFromStatus: true,
    });
  });

  it.each(['HOLD_ORDER_WORK', 'STOP_ORDER_WORK'] as const)(
    'requires an auditable reason for %s',
    (actionCode) => {
      expect(resolveOrderControlTransition({
        actionCode, currentStatus: 'processing', holdFromStatus: null, note: 'short',
      })).toMatchObject({ ok: false, message: expect.stringContaining('at least 10') });
    },
  );

  it('leaves non-control actions to the configured workflow edge', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'MARK_READY', currentStatus: 'packing', holdFromStatus: null, note: '',
    })).toBeNull();
  });
});
