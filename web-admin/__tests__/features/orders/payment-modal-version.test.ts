jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
import {
  DEFAULT_PAYMENT_MODAL_VERSION,
  PAYMENT_MODAL_VERSIONS,
  coercePaymentModalVersion,
  fetchPaymentModalDemoTenantFlag,
} from '@features/orders/hooks/use-payment-modal-version';

describe('payment modal version helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to v4 for unsupported versions', () => {
    expect(coercePaymentModalVersion('legacy')).toBe(DEFAULT_PAYMENT_MODAL_VERSION);
  });

  it('keeps supported versions unchanged', () => {
    expect(coercePaymentModalVersion(PAYMENT_MODAL_VERSIONS.V3)).toBe(PAYMENT_MODAL_VERSIONS.V3);
  });

  it('returns true when the tenant has the HQ demo flag', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { is_hq_test_demo: true },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    await expect(fetchPaymentModalDemoTenantFlag('tenant-demo')).resolves.toBe(true);

    expect(supabase.from).toHaveBeenCalledWith('org_tenants_mst');
    expect(select).toHaveBeenCalledWith('is_hq_test_demo');
    expect(eq).toHaveBeenCalledWith('id', 'tenant-demo');
  });

  it('returns false when the lookup fails', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'forbidden' },
    });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    await expect(fetchPaymentModalDemoTenantFlag('tenant-prod')).resolves.toBe(false);
  });
});
