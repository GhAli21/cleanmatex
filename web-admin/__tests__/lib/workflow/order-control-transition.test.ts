import { resolveOrderControlTransition } from '@/lib/workflow/order-control-transition';

describe('resolveOrderControlTransition', () => {
  it('holds work and preserves the prior operational status', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'HOLD_ORDER_WORK', currentStatus: 'processing', holdFromStatus: null,
      note: 'Machine maintenance',
    })).toEqual({
      ok: true, toStatus: 'on_hold', nextHoldFromStatus: 'processing', clearHoldFromStatus: false,
    });
  });

  it('resumes to the preserved status and clears the hold marker', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: 'processing', note: '',
    })).toEqual({
      ok: true, toStatus: 'processing', nextHoldFromStatus: null, clearHoldFromStatus: true,
    });
  });

  it('rejects resume when the preserved status is missing', () => {
    expect(resolveOrderControlTransition({
      actionCode: 'RESUME_ORDER_WORK', currentStatus: 'on_hold', holdFromStatus: null, note: '',
    })).toMatchObject({ ok: false, message: expect.stringContaining('hold_from_status') });
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
