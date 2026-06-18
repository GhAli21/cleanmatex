/**
 * Stories for CmxMoneyKeypad.
 *
 * CmxMoneyKeypad is fully prop-driven (value, onValueChange, currencyCode, etc.).
 * It does not call useTenantCurrency() — no context mock is needed.
 * Each story uses a useState wrapper so the keypad and field stay in sync.
 */

import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxMoneyKeypad } from '@ui/utilities'

// ─── Render helper ────────────────────────────────────────────────────────────

/**
 * Controlled wrapper that owns the numeric value so keypad presses update the
 * field in real time during story interaction.
 * @param root0
 * @param root0.initialValue
 * @param root0.currencyCode
 * @param root0.decimalPlaces
 * @param root0.label
 * @param root0.placeholder
 * @param root0.error
 * @param root0.disabled
 * @param root0.showQuickAdd
 * @param root0.quickAddKeys
 * @param root0.headerSlot
 * @param root0.min
 * @param root0.max
 * @param root0.rtl
 */
function KeypadStory({
  initialValue = null,
  currencyCode,
  decimalPlaces = 3,
  label,
  placeholder,
  error,
  disabled = false,
  showQuickAdd = true,
  quickAddKeys,
  headerSlot,
  min,
  max,
  rtl = false,
}: {
  initialValue?: number | null
  currencyCode?: string
  decimalPlaces?: number
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  showQuickAdd?: boolean
  quickAddKeys?: string[]
  headerSlot?: React.ReactNode
  min?: number
  max?: number
  rtl?: boolean
}) {
  const [value, setValue] = useState<number | null>(initialValue)

  return (
    <div className="w-[320px] space-y-2" dir={rtl ? 'rtl' : 'ltr'}>
      <CmxMoneyKeypad
        value={value}
        onValueChange={(v) => setValue(v)}
        currencyCode={currencyCode}
        decimalPlaces={decimalPlaces}
        label={label}
        placeholder={placeholder}
        error={error}
        disabled={disabled}
        showQuickAdd={showQuickAdd}
        quickAddKeys={quickAddKeys}
        headerSlot={headerSlot}
        min={min}
        max={max}
      />
      <p className="text-xs text-slate-400">
        {rtl ? 'القيمة الحالية:' : 'Current value:'}{' '}
        <span className="font-mono text-slate-700">
          {value == null ? 'null' : value}
        </span>
      </p>
    </div>
  )
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Utilities/CmxMoneyKeypad',
  component: CmxMoneyKeypad,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'number',
      description: 'Controlled numeric value (null = empty field)',
    },
    onValueChange: {
      action: 'valueChanged',
      description: 'Called with (value, draft) on every keypad press or field edit',
    },
    currencyCode: {
      control: 'text',
      description: 'Currency label shown before the input field',
    },
    decimalPlaces: {
      control: { type: 'number', min: 0, max: 6 },
      description: 'Number of decimal places for formatting and input clamping',
    },
    showQuickAdd: {
      control: 'boolean',
      description: 'When true renders a 4-column grid with quick-add keys; false = 3-column numeric pad',
    },
    quickAddKeys: {
      control: 'object',
      description: 'Labels for the three right-column quick-add keys',
    },
    disabled: {
      control: 'boolean',
    },
    min: {
      control: 'number',
      description: 'Minimum value — input is clamped to this bound',
    },
    max: {
      control: 'number',
      description: 'Maximum value — input is clamped to this bound',
    },
    label: {
      control: 'text',
    },
    placeholder: {
      control: 'text',
    },
    error: {
      control: 'text',
      description: 'Error message displayed below the field',
    },
    headerSlot: {
      control: false,
      description: 'ReactNode rendered above the key grid',
    },
  },
} satisfies Meta<typeof CmxMoneyKeypad>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Default layout: 4-column grid with +10 / +20 / +50 quick-add keys and OMR label. */
export const Default: Story = {
  render: () => (
    <KeypadStory
      currencyCode="OMR"
      decimalPlaces={3}
      placeholder="0.000"
    />
  ),
}

/** Pre-populated with a value — verifies the field and draft sync correctly on mount. */
export const WithValue: Story = {
  render: () => (
    <KeypadStory
      initialValue={35.5}
      currencyCode="OMR"
      decimalPlaces={3}
    />
  ),
}

/** Zero value — field should display 0.000 (showZero is always true in the keypad). */
export const ZeroValue: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
    />
  ),
}

/** Currency label displayed before the input field. */
export const WithCurrencyLabel: Story = {
  render: () => (
    <KeypadStory
      initialValue={125}
      currencyCode="SAR"
      decimalPlaces={2}
      label="Cash received"
    />
  ),
}

/** Without a currency label — field takes the full width of the row. */
export const WithoutCurrencyLabel: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      decimalPlaces={3}
      label="Amount"
    />
  ),
}

/**
 * 3-column numeric pad — showQuickAdd=false removes the right-column increment keys
 * and tightens the grid to 3 columns.
 */
export const WithoutQuickAdd: Story = {
  render: () => (
    <KeypadStory
      currencyCode="OMR"
      decimalPlaces={3}
      showQuickAdd={false}
      label="Amount"
    />
  ),
}

/** Custom quick-add keys — e.g. +5 / +25 / +100 for a different payment context. */
export const CustomQuickAddKeys: Story = {
  render: () => (
    <KeypadStory
      currencyCode="OMR"
      decimalPlaces={3}
      showQuickAdd
      quickAddKeys={['+5', '+25', '+100']}
      label="Amount"
    />
  ),
}

/** Disabled state — all keypad buttons and the text field are non-interactive. */
export const Disabled: Story = {
  render: () => (
    <KeypadStory
      initialValue={50}
      currencyCode="OMR"
      decimalPlaces={3}
      disabled
      label="Amount"
    />
  ),
}

/** Error message displayed below the field — e.g. from server-side validation. */
export const WithError: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
      label="Payment amount"
      error="Amount cannot be zero."
    />
  ),
}

/** Upper bound — entering a value above 200 is clamped immediately. */
export const WithMaxBound: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
      max={200}
      label="Amount (max 200)"
    />
  ),
}

/** Lower bound — combined with max for a strict payment window. */
export const WithMinMax: Story = {
  render: () => (
    <KeypadStory
      initialValue={10}
      currencyCode="OMR"
      decimalPlaces={3}
      min={1}
      max={500}
      label="Amount (1 – 500)"
    />
  ),
}

/**
 * headerSlot — a custom node rendered above the key grid, e.g. a running total banner.
 * Useful for payment modals that show the remaining balance.
 */
export const WithHeaderSlot: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
      headerSlot={
        <div className="mb-1 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-600">
          Remaining balance: <span className="font-semibold text-slate-900">85.500 OMR</span>
        </div>
      }
    />
  ),
}

/** Two-decimal-place variant — for currencies like USD or AED. */
export const TwoDecimalPlaces: Story = {
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="USD"
      decimalPlaces={2}
      label="Amount"
    />
  ),
}

/** Arabic layout — currency label and value readout flow right-to-left. */
export const RTL: Story = {
  name: 'RTL (Arabic)',
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
      label="المبلغ"
      placeholder="أدخل القيمة"
      rtl
    />
  ),
  parameters: {
    direction: 'rtl',
  },
}

/** RTL with quick-add keys — verifies the 4-column grid mirrors correctly in Arabic. */
export const RTLWithQuickAdd: Story = {
  name: 'RTL (Arabic) — With Quick Add',
  render: () => (
    <KeypadStory
      initialValue={50}
      currencyCode="OMR"
      decimalPlaces={3}
      showQuickAdd
      quickAddKeys={['+10', '+20', '+50']}
      label="مبلغ الدفع"
      rtl
    />
  ),
  parameters: {
    direction: 'rtl',
  },
}

/** RTL with error message — verifies Arabic error text flows correctly. */
export const RTLWithError: Story = {
  name: 'RTL (Arabic) — With Error',
  render: () => (
    <KeypadStory
      initialValue={0}
      currencyCode="OMR"
      decimalPlaces={3}
      label="مبلغ الدفع"
      error="يجب أن يكون المبلغ أكبر من الصفر."
      rtl
    />
  ),
  parameters: {
    direction: 'rtl',
  },
}
