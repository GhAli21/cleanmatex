import { readApplyFailure } from '../../../../src/features/orders/order-change/apply-failure';

describe('readApplyFailure', () => {
  it('keeps the code, request id, and server message for the operator to copy', () => {
    expect(readApplyFailure({
      ok: false,
      error: {
        code: 'COLLECTION_POLICY_UNRESOLVED',
        message: 'Order change apply was rejected',
        details: null,
        requestId: '0c4dbedb-5021-434b-b5f4-ac5822ee35c8',
      },
    })).toEqual({
      code: 'COLLECTION_POLICY_UNRESOLVED',
      requestId: '0c4dbedb-5021-434b-b5f4-ac5822ee35c8',
      serverMessage: 'Order change apply was rejected',
    });
  });

  it('uses UNKNOWN when the body has no error code', () => {
    expect(readApplyFailure(null)).toEqual({
      code: 'UNKNOWN',
      requestId: null,
      serverMessage: null,
    });
  });
});
