import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// Prevent jest from loading tenant-currency-context (next-intl ESM) via the
// @ui/primitives barrel — same workaround as payment-primitives.test.tsx.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { CapabilityViewRenderer } from '@features/orders/payment/view/capability-view-renderer';
import { planCapabilityView } from '@features/orders/payment/view/capability-view-plan';
import { FULL_PRESET } from '@features/orders/payment/presets';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import { PAYMENT_REASON } from '@features/orders/payment/domain/payment-reasons';
import type { EvaluatedCapability } from '@features/orders/payment/capabilities/registry';
import type { PaymentCapabilityKey } from '@features/orders/payment/capabilities/capability-keys';

function evaluated(
  key: PaymentCapabilityKey,
  overrides: Partial<EvaluatedCapability> = {},
): EvaluatedCapability {
  return {
    key,
    available: true,
    required: false,
    blocked: false,
    presentation: 'dialog',
    reasons: [],
    messageKeys: { title: `t.${key}`, action: `a.${key}` },
    ...overrides,
  };
}

const noopRender = () => null;
const labelFor = (slot: { key: string }) => `Open ${slot.key}`;
const noGuard = () => null;

describe('CapabilityViewRenderer', () => {
  it('renders inline surfaces via renderInline and skips null nodes', () => {
    const plan = planCapabilityView(
      [
        evaluated(PAYMENT_CAPABILITY.CASH, { presentation: 'inline' }),
        evaluated(PAYMENT_CAPABILITY.SUBMIT_GUARDS, { presentation: 'inline' }),
      ],
      FULL_PRESET,
    );
    render(
      <CapabilityViewRenderer
        plan={plan}
        renderInline={(slot) =>
          slot.key === PAYMENT_CAPABILITY.CASH ? <div>cash-lane</div> : null
        }
        dialogButtonLabel={labelFor}
        onOpenCapability={jest.fn()}
        resolveGuard={noGuard}
      />,
    );
    expect(screen.getByText('cash-lane')).toBeInTheDocument();
    // SUBMIT_GUARDS inline returned null → no wrapper for it.
    expect(screen.getByTestId('capability-view-inline').children).toHaveLength(1);
  });

  it('renders a dialog opener button that opens the capability', () => {
    const onOpen = jest.fn();
    const plan = planCapabilityView(
      [evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, { presentation: 'dialog' })],
      FULL_PRESET,
    );
    render(
      <CapabilityViewRenderer
        plan={plan}
        renderInline={noopRender}
        dialogButtonLabel={labelFor}
        onOpenCapability={onOpen}
        resolveGuard={noGuard}
      />,
    );
    const button = screen.getByTestId('capability-action-SPLIT_TENDER');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveTextContent('Open SPLIT_TENDER');
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ key: PAYMENT_CAPABILITY.SPLIT_TENDER }),
    );
  });

  it('emphasizes a required dialog slot with a badge and reason data attribute', () => {
    const plan = planCapabilityView(
      [
        evaluated(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING, {
          presentation: 'dialog',
          required: true,
          reasons: [PAYMENT_REASON.REQUIRED_B2B_FIELDS_MISSING],
        }),
      ],
      FULL_PRESET,
    );
    render(
      <CapabilityViewRenderer
        plan={plan}
        renderInline={noopRender}
        dialogButtonLabel={labelFor}
        requiredBadgeLabel="Required"
        onOpenCapability={jest.fn()}
        resolveGuard={noGuard}
      />,
    );
    const button = screen.getByTestId('capability-action-B2B_ACCOUNT_BILLING');
    expect(button).toHaveAttribute('data-required', 'true');
    expect(button).toHaveAttribute('data-reason', 'REQUIRED_B2B_FIELDS_MISSING');
    expect(
      screen.getByTestId('capability-action-required-B2B_ACCOUNT_BILLING'),
    ).toHaveTextContent('Required');
  });

  it('renders deduped guard banners and fires the corrective action', () => {
    const onAction = jest.fn();
    const plan = planCapabilityView(
      [
        evaluated(PAYMENT_CAPABILITY.CASH_DRAWER, {
          presentation: 'inline',
          blocked: true,
          blockReason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
        }),
        evaluated(PAYMENT_CAPABILITY.SUBMIT_GUARDS, {
          presentation: 'inline',
          blocked: true,
          blockReason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
        }),
      ],
      FULL_PRESET,
    );
    render(
      <CapabilityViewRenderer
        plan={plan}
        renderInline={noopRender}
        dialogButtonLabel={labelFor}
        onOpenCapability={jest.fn()}
        resolveGuard={() => ({
          message: 'Drawer closed',
          actionLabel: 'Open a session',
          onAction,
        })}
      />,
    );
    // Deduped: exactly one guard banner despite two blocked slots.
    const guards = screen.getAllByTestId('payment-submit-guard');
    expect(guards).toHaveLength(1);
    expect(guards[0]).toHaveAttribute('data-reason', 'CASH_DRAWER_SESSION_CLOSED');
    fireEvent.click(screen.getByText('Open a session'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits a region entirely when it has no slots', () => {
    const plan = planCapabilityView(
      [evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, { presentation: 'dialog' })],
      FULL_PRESET,
    );
    render(
      <CapabilityViewRenderer
        plan={plan}
        renderInline={noopRender}
        dialogButtonLabel={labelFor}
        onOpenCapability={jest.fn()}
        resolveGuard={noGuard}
      />,
    );
    expect(screen.queryByTestId('capability-view-inline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('capability-view-guards')).not.toBeInTheDocument();
    expect(screen.getByTestId('capability-view-actions')).toBeInTheDocument();
  });
});
