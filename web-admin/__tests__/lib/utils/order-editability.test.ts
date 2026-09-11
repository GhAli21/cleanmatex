import { isEditableStatus, isOrderEditable } from '@/lib/utils/order-editability';

describe('isOrderEditable', () => {
  it('allows Edit order while the live profile status is preparing', () => {
    expect(isOrderEditable({
      current_status: 'preparing',
      preparation_status: 'pending',
    })).toEqual({ canEdit: true });
    expect(isEditableStatus('preparing')).toBe(true);
  });

  it('blocks edit after preparation is completed', () => {
    expect(isOrderEditable({
      current_status: 'preparing',
      preparation_status: 'completed',
    }).canEdit).toBe(false);
  });
});
