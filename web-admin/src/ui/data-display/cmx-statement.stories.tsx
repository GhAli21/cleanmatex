/**
 * Storybook coverage for the statement primitives, CmxMoneyText and
 * CmxCollapsibleSection: the four row modes, counted and not-counted lines,
 * was → now, the line cap, the draft outline, RTL, dark and print.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import {
  CmxMoneyText,
  CmxStatement,
  CmxStatementGroup,
  CmxStatementLine,
  CmxStatementLineList,
  CmxStatementRow,
} from '@ui/data-display'

const omr = (amount: number, sign: 'plus' | 'minus' | 'neutral' = 'neutral', locale: 'en' | 'ar' = 'en') => (
  <CmxMoneyText amount={amount} currencyCode="OMR" decimalPlaces={3} sign={sign} locale={locale} signLabels={{ plus: 'plus', minus: 'minus' }} />
)

function Sample({ draft, print, locale = 'en' }: { draft?: boolean; print?: boolean; locale?: 'en' | 'ar' }) {
  return (
    <CmxStatement draft={draft} print={print} aria-label="Statement">
      <CmxStatementGroup title="Order value" footer={{ label: 'Total', amount: omr(11.475, 'neutral', locale), emphasis: true }}>
        <CmxStatementRow title="Items & extras" mode="expanded" count={2} amount={omr(10, 'neutral', locale)}>
          <CmxStatementLineList>
            <CmxStatementLine label="Shirt" amount={omr(6, 'neutral', locale)} />
            <CmxStatementLine label="Trousers" amount={omr(4, 'neutral', locale)} />
            <CmxStatementLine label="Extras (included)" note={omr(1, 'neutral', locale)} muted />
          </CmxStatementLineList>
        </CmxStatementRow>
        <CmxStatementRow title="Charges" mode="expandable" count={2} amount={omr(1.5, 'plus', locale)}>
          <CmxStatementLineList>
            <CmxStatementLine label="Delivery" amount={omr(1.5, 'plus', locale)} />
            <CmxStatementLine label="Service" chip={<span className="text-xs">Voided · not counted</span>} struck amount={omr(0.3, 'plus', locale)} />
          </CmxStatementLineList>
        </CmxStatementRow>
        <CmxStatementRow title="Discounts" mode="detail" count={1} amount={omr(0.5, 'minus', locale)}>
          <CmxStatementLineList>
            <CmxStatementLine label="Promo SPRING5" note={<>{omr(0.5)} → {omr(0.6)}</>} amount={omr(0.6, 'minus', locale)} />
          </CmxStatementLineList>
        </CmxStatementRow>
        <CmxStatementRow title="Tax" mode="total" amount={omr(0.475, 'plus', locale)} />
      </CmxStatementGroup>
      <CmxStatementGroup title="Settlement" footer={{ label: 'Due at collection', amount: omr(2.475, 'neutral', locale), emphasis: true }}>
        <CmxStatementRow title="Payments" mode="expanded" count={10} amount={omr(8, 'minus', locale)}>
          <CmxStatementLineList cap={3} showAllLabel={(n) => `Show all (${n})`} showLessLabel="Show less">
            {Array.from({ length: 10 }, (_, i) => <CmxStatementLine key={i} label={`Cash #${i + 1}`} meta="10:41" amount={omr(0.8, 'minus', locale)} />)}
          </CmxStatementLineList>
        </CmxStatementRow>
      </CmxStatementGroup>
    </CmxStatement>
  )
}

const meta = {
  title: 'DataDisplay/CmxStatement',
  component: CmxStatement,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CmxStatement>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <Sample /> }

// Draft: dashed outline for figures not yet saved.
export const Draft: Story = { render: () => <Sample draft /> }

// RTL variant — verifies Arabic layout direction, chevrons and end-aligned amounts.
export const RTL: Story = { render: () => <div dir="rtl"><Sample locale="ar" /></div> }

export const Dark: Story = { render: () => <div className="dark bg-[rgb(var(--cmx-background-rgb))] p-4"><Sample /></div> }

// Print: every row open, no toggles.
export const Print: Story = { render: () => <Sample print /> }

export const MoneyTextStates: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {omr(1234.5)}
      {omr(0.5, 'minus')}
      <CmxMoneyText amount={12.5} currencyCode={null} decimalPlaces={null} unknownCurrencyLabel="Currency unknown" />
      <CmxMoneyText amount={null} currencyCode="OMR" decimalPlaces={3} />
      <CmxMoneyText amount={2.475} currencyCode="OMR" decimalPlaces={3} tone="warning" size="xl" />
      <CmxMoneyText amount={0.3} currencyCode="OMR" decimalPlaces={3} struck tone="muted" />
    </div>
  ),
}
