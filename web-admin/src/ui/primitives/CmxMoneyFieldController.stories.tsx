/**
 * Stories for CmxMoneyFieldController.
 *
 * The component wraps CmxMoneyField in a React Hook Form <Controller>.
 * It reads decimalPlaces from useTenantCurrency() (falls back to ORDER_DEFAULTS safely
 * when no provider is present), so no context mock is needed in Storybook.
 * Pass decimalPlaces as a prop to override the hook value per story.
 */

import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { useForm } from 'react-hook-form'
import { CmxMoneyFieldController } from '@ui/primitives'

// ─── Render helper ────────────────────────────────────────────────────────────

/**
 * Wraps CmxMoneyFieldController with a useForm instance so the Controller has a
 * live form context. Displays the current numeric value below the field so
 * story reviewers can verify round-trip behaviour.
 */
function ControllerStory({
  defaultValue = null,
  decimalPlaces = 3,
  label,
  placeholder,
  error,
  disabled = false,
  showZero = false,
  min,
  max,
  rtl = false,
}: {
  defaultValue?: number | null
  decimalPlaces?: number
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  showZero?: boolean
  min?: number
  max?: number
  rtl?: boolean
}) {
  const form = useForm<{ amount: number | null }>({
    defaultValues: { amount: defaultValue },
  })

  // Inject a manual error when the error prop is provided so the story renders the error state.
  React.useEffect(() => {
    if (error) {
      form.setError('amount', { type: 'manual', message: error })
    } else {
      form.clearErrors('amount')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const watchedValue = form.watch('amount')

  return (
    <div className="w-[320px] space-y-3" dir={rtl ? 'rtl' : 'ltr'}>
      <form>
        <CmxMoneyFieldController
          name="amount"
          control={form.control}
          decimalPlaces={decimalPlaces}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
          showZero={showZero}
          min={min}
          max={max}
        />
      </form>
      <p className="text-xs text-slate-400">
        {rtl ? 'القيمة الحالية:' : 'Current value:'}{' '}
        <span className="font-mono text-slate-700">
          {watchedValue == null ? 'null' : watchedValue}
        </span>
      </p>
    </div>
  )
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Primitives/CmxMoneyFieldController',
  component: CmxMoneyFieldController,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: false,
      description: 'RHF field name — bound to the form value at this path',
    },
    control: {
      control: false,
      description: 'React Hook Form Control object from useForm()',
    },
    decimalPlaces: {
      control: { type: 'number', min: 0, max: 6 },
      description: 'Override tenant decimal places for this field only',
    },
    label: {
      control: 'text',
      description: 'Visible field label',
    },
    placeholder: {
      control: 'text',
      description: 'Input placeholder shown when the field is empty',
    },
    disabled: {
      control: 'boolean',
    },
    showZero: {
      control: 'boolean',
      description: 'When true, zero renders as 0.000 instead of an empty field',
    },
    min: {
      control: 'number',
      description: 'Minimum allowed value (clamped on blur)',
    },
    max: {
      control: 'number',
      description: 'Maximum allowed value (clamped on blur)',
    },
    error: {
      control: 'text',
      description: 'Field-level error message (overridden by RHF fieldState.error)',
    },
  },
} satisfies Meta<typeof CmxMoneyFieldController>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Empty field — user enters an amount from scratch. */
export const Default: Story = {
  render: () => (
    <ControllerStory
      label="Amount"
      placeholder="0.000"
      decimalPlaces={3}
    />
  ),
}

/** Field pre-populated with a non-zero value. */
export const WithValue: Story = {
  render: () => (
    <ControllerStory
      defaultValue={125.5}
      label="Order total"
      decimalPlaces={3}
    />
  ),
}

/** Zero is displayed as 0.000 rather than blank when showZero is true. */
export const ShowZero: Story = {
  render: () => (
    <ControllerStory
      defaultValue={0}
      label="Discount amount"
      decimalPlaces={3}
      showZero
    />
  ),
}

/** Field is non-interactive — read-only display of a committed value. */
export const Disabled: Story = {
  render: () => (
    <ControllerStory
      defaultValue={89.75}
      label="Paid amount"
      decimalPlaces={3}
      disabled
    />
  ),
}

/** RHF validation message surfaces through fieldState.error. */
export const WithError: Story = {
  render: () => (
    <ControllerStory
      defaultValue={0}
      label="Payment amount"
      decimalPlaces={3}
      error="Amount must be greater than zero."
    />
  ),
}

/** Lower and upper bounds are enforced on blur and via keypad input. */
export const WithMinMax: Story = {
  render: () => (
    <ControllerStory
      defaultValue={10}
      label="Tip amount"
      decimalPlaces={3}
      min={0}
      max={50}
      placeholder="0.000 – 50.000"
    />
  ),
}

/** Two-decimal-place variant — e.g. for currencies like USD or SAR. */
export const TwoDecimalPlaces: Story = {
  render: () => (
    <ControllerStory
      defaultValue={99.99}
      label="Amount (USD)"
      decimalPlaces={2}
    />
  ),
}

/** Arabic layout — field label and current-value readout rendered right-to-left. */
export const RTL: Story = {
  name: 'RTL (Arabic)',
  render: () => (
    <ControllerStory
      defaultValue={250}
      label="المبلغ"
      placeholder="أدخل القيمة"
      decimalPlaces={3}
      rtl
    />
  ),
  parameters: {
    direction: 'rtl',
  },
}

/** RTL + error message combined — verifies error text flows correctly in Arabic. */
export const RTLWithError: Story = {
  name: 'RTL (Arabic) — With Error',
  render: () => (
    <ControllerStory
      defaultValue={0}
      label="مبلغ الدفع"
      decimalPlaces={3}
      error="يجب أن يكون المبلغ أكبر من الصفر."
      rtl
    />
  ),
  parameters: {
    direction: 'rtl',
  },
}
