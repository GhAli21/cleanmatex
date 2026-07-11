/**
 * Stories for `CapabilityViewRenderer` — the L5 view renderer. Lets you visually
 * QA the three regions in isolation: inline surfaces (delegated via
 * `renderInline`), dialog-opener buttons (with the required-gate emphasis +
 * badge), and the deduped submit-guard banners. All labels arrive resolved
 * (i18n stays in the caller), so no intl provider is needed. Toggle `isRTL` in
 * the controls to check right-to-left.
 */
import type { Meta, StoryObj } from '@storybook/nextjs';
import { CapabilityViewRenderer } from './capability-view-renderer';
import type { CapabilityViewSlot, VisiblePresentation } from './capability-view-plan';
import { PAYMENT_CAPABILITY } from '../capabilities/capability-keys';
import { PAYMENT_REASON } from '../domain/payment-reasons';
import type { PaymentCapabilityKey } from '../capabilities/capability-keys';
import type { EvaluatedCapability } from '../capabilities/registry';

/** Builds a view slot for the stories. */
function slot(
  key: PaymentCapabilityKey,
  presentation: VisiblePresentation,
  overrides: Partial<EvaluatedCapability> = {},
): CapabilityViewSlot {
  return {
    key,
    presentation,
    evaluated: {
      key,
      available: true,
      required: false,
      blocked: false,
      presentation,
      reasons: [],
      messageKeys: { title: `t.${key}`, action: `a.${key}` },
      ...overrides,
    },
  };
}

const inlineFx = slot(PAYMENT_CAPABILITY.FX_ROUNDING, 'inline');
const dialogSplit = slot(PAYMENT_CAPABILITY.SPLIT_TENDER, 'dialog');
const dialogB2BRequired = slot(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING, 'dialog', {
  required: true,
  reasons: [PAYMENT_REASON.REQUIRED_B2B_FIELDS_MISSING],
});
const guardDrawer = slot(PAYMENT_CAPABILITY.CASH_DRAWER, 'inline', {
  blocked: true,
  blockReason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
});

const meta = {
  title: 'Features/Orders/PaymentModal/CapabilityViewRenderer',
  component: CapabilityViewRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-sm space-y-3 rounded-2xl border border-slate-200 p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    isRTL: { control: 'boolean' },
    requiredBadgeLabel: { control: 'text' },
  },
  args: {
    isRTL: false,
    requiredBadgeLabel: 'Required',
    renderInline: (s: CapabilityViewSlot) =>
      s.key === PAYMENT_CAPABILITY.FX_ROUNDING ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          FX / rounding line (inline surface)
        </div>
      ) : null,
    dialogButtonLabel: (s: CapabilityViewSlot) =>
      ({
        [PAYMENT_CAPABILITY.SPLIT_TENDER]: 'Split payment',
        [PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING]: 'Bill to account',
      }[s.key] ?? s.key),
    onOpenCapability: (s: CapabilityViewSlot) => {
      // eslint-disable-next-line no-console
      console.log('open capability', s.key);
    },
    resolveGuard: () => ({
      message: 'Cash drawer is closed for reconciliation.',
      actionLabel: 'Open a session',
      onAction: () => {
        // eslint-disable-next-line no-console
        console.log('corrective action');
      },
    }),
  },
} satisfies Meta<typeof CapabilityViewRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two dialog-opener buttons — the second is a required gate (primary + badge). */
export const ActionsOnly: Story = {
  args: { plan: [dialogSplit, dialogB2BRequired] },
};

/** All three regions: an inline surface, dialog openers, and a blocked guard. */
export const InlineActionsAndGuard: Story = {
  args: { plan: [inlineFx, dialogSplit, dialogB2BRequired, guardDrawer] },
};

/** Only a blocked submit-guard banner (with corrective action). */
export const GuardOnly: Story = {
  args: { plan: [guardDrawer] },
};

/** Empty plan — the renderer draws nothing (no empty region wrappers). */
export const Empty: Story = {
  args: { plan: [] },
};
