/**
 * Stories for `FxRoundingLine` — the read-only FX / rounding reference line
 * (ADR condition #9). Lets you visually QA the Phase-4e surface in isolation:
 * exchange-rate display, rounding adjustment, RTL (Direction toolbar), and the
 * defensive sub-epsilon case where it renders nothing.
 *
 * i18n is provided by a NextIntlClientProvider decorator; RTL follows the global
 * Direction toolbar (the component reads `document.dir` via `useRTL`).
 */
import type { Meta, StoryObj } from '@storybook/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { FxRoundingLine } from './fx-rounding-line';

const messages = {
  newOrder: {
    payment: {
      capabilities: {
        FX_ROUNDING: {
          title: 'FX / Rounding',
          exchangeRate: 'Exchange rate',
          rounding: 'Rounding adjustment',
        },
      },
    },
  },
};

const meta = {
  title: 'Features/Orders/PaymentModal/Capabilities/FxRoundingLine',
  component: FxRoundingLine,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <div className="max-w-xs">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
  argTypes: {
    exchangeRate: { control: { type: 'number', step: 0.01 } },
    roundingAmount: { control: { type: 'number', step: 0.01 } },
    moneyEpsilon: { control: { type: 'number', step: 0.0001 } },
    currencyCode: { control: 'text' },
  },
  args: {
    exchangeRate: 3.75,
    roundingAmount: 0,
    moneyEpsilon: 0.0001,
    currencyCode: 'SAR',
    formatAmount: (n: number) => n.toFixed(3),
  },
} satisfies Meta<typeof FxRoundingLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Non-base exchange rate only (the common multi-currency case; rounding is 0). */
export const RateOnly: Story = {};

/** Both a non-base rate and a rounding adjustment are shown. */
export const RateAndRounding: Story = {
  args: { exchangeRate: 3.75, roundingAmount: 0.03 },
};

/** Rounding adjustment only (base currency, rate = 1). */
export const RoundingOnly: Story = {
  args: { exchangeRate: 1, roundingAmount: -0.05 },
};

/**
 * Sub-epsilon: base rate and no rounding → the line renders **nothing**
 * (defensive gate). An empty canvas here is the correct, expected result.
 */
export const NothingToShow: Story = {
  args: { exchangeRate: 1, roundingAmount: 0 },
};
