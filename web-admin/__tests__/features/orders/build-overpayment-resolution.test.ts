/**
 * Tests: buildOverpaymentResolutionPayload (client helper)
 */

import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { buildOverpaymentResolutionPayload } from '@/src/features/orders/ui/payment-modal/allocation/build-overpayment-resolution';

describe('buildOverpaymentResolutionPayload', () => {
  it('returns undefined for adjust_legs mode', () => {
    expect(buildOverpaymentResolutionPayload('adjust_legs', 10)).toBeUndefined();
  });

  it('builds advance resolution payload', () => {
    expect(
      buildOverpaymentResolutionPayload(OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE, 5.5)
    ).toEqual({
      excessAmount: 5.5,
      lines: [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE, amount: 5.5 }],
    });
  });

  it('builds credit resolution payload with optional note', () => {
    expect(
      buildOverpaymentResolutionPayload(
        OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
        3,
        { noteReason: 'Overpaid at POS' }
      )
    ).toEqual({
      excessAmount: 3,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
          amount: 3,
          noteReason: 'Overpaid at POS',
        },
      ],
    });
  });

  it('builds auto allocation payload when preview id is present', () => {
    const previewId = '00000000-0000-4000-8000-000000000020';
    expect(
      buildOverpaymentResolutionPayload(
        OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
        12,
        { allocationPreviewId: previewId }
      )
    ).toEqual({
      excessAmount: 12,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
          amount: 12,
          allocationPreviewId: previewId,
        },
      ],
    });
  });

  it('returns undefined for auto allocation without preview id', () => {
    expect(
      buildOverpaymentResolutionPayload(
        OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
        12
      )
    ).toBeUndefined();
  });
});
