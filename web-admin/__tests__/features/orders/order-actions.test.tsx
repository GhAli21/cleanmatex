import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { OrderActions } from '@features/orders/ui/order-actions';

const workflowActionBarMock = jest.fn((_props: unknown) => (
  <div data-testid="workflow-action-bar">Engine order controls</div>
));
let grantedPermissions = new Set(['orders:transition', 'orders:update']);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
jest.mock('@/lib/hooks/usePermissions', () => ({
  useHasPermissionCode: (permission: string) => grantedPermissions.has(permission),
}));

jest.mock('@features/workflow/ui/WorkflowActionBar', () => ({
  WorkflowActionBar: (props: unknown) => workflowActionBarMock(props),
}));

jest.mock('@features/orders/ui/fix-order-data-modal', () => ({
  FixOrderDataModal: () => null,
}));

jest.mock('@features/orders/ui/cancel-order-dialog', () => ({
  CancelOrderDialog: () => null,
}));

jest.mock('@features/orders/ui/customer-return-order-dialog', () => ({
  CustomerReturnOrderDialog: () => null,
}));

describe('OrderActions', () => {
  beforeEach(() => {
    workflowActionBarMock.mockClear();
    grantedPermissions = new Set(['orders:transition', 'orders:update']);
  });

  it('does not expose retired raw-status actions for out-for-delivery orders', () => {
    render(
      <OrderActions
        order={{
          id: '1e844914-cebe-4778-8fe2-94c833521185',
          status: 'out_for_delivery',
          tenant_org_id: '11111111-1111-1111-1111-111111111111',
          preparation_status: 'completed',
        }}
      />,
    );

    expect(screen.queryByText('buttons.markAsReady')).not.toBeInTheDocument();
    expect(screen.queryByText('buttons.markAsDelivered')).not.toBeInTheDocument();
    expect(screen.queryByText('dialog.confirmChange')).not.toBeInTheDocument();
    expect(screen.getByTestId('workflow-action-bar')).toBeInTheDocument();
    expect(workflowActionBarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: '1e844914-cebe-4778-8fe2-94c833521185',
        screen: 'order_control',
        hideWhenEmpty: true,
      }),
    );
  });

  it('hides transition and repair controls when their permissions are absent', () => {
    grantedPermissions = new Set();

    render(
      <OrderActions
        order={{
          id: '1e844914-cebe-4778-8fe2-94c833521185',
          status: 'intake',
          tenant_org_id: '11111111-1111-1111-1111-111111111111',
          preparation_status: 'pending',
        }}
      />,
    );

    expect(screen.queryByTestId('workflow-action-bar')).not.toBeInTheDocument();
    expect(screen.queryByText('buttons.cancelOrder')).not.toBeInTheDocument();
    expect(screen.queryByText('buttons.editOrder')).not.toBeInTheDocument();
    expect(screen.queryByText('buttons.fixOrderData')).not.toBeInTheDocument();
  });
});
