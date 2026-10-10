import { cashDrawerChoicesForPosSession } from '@features/orders/model/cash-drawer-pos-link';

const reception = { session: { id: 'ses-reception' } };
const vip = { session: { id: 'ses-vip' } };

describe('cashDrawerChoicesForPosSession', () => {
  it('keeps every open drawer when the POS session has no linked drawer', () => {
    const result = cashDrawerChoicesForPosSession([reception, vip], null);
    expect(result.choices).toEqual([reception, vip]);
    expect(result.linkedMissing).toBe(false);
  });

  it('keeps only the drawer already linked to the POS session', () => {
    const result = cashDrawerChoicesForPosSession([reception, vip], 'ses-reception');
    expect(result.choices).toEqual([reception]);
    expect(result.linkedMissing).toBe(false);
  });

  it('offers no other drawer when the linked session is not open', () => {
    const result = cashDrawerChoicesForPosSession([vip], 'ses-reception');
    expect(result.choices).toEqual([]);
    expect(result.linkedMissing).toBe(true);
  });
});
