/**
 * Storybook coverage for the workspace frame: the full frame (title, actions, KPI strip,
 * filters, table), the minimal frame (content only), and Arabic, where the page dir mirrors it.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell'

const meta: Meta<typeof CmxCrudPageShell> = {
  title: 'Patterns/CmxCrudPageShell',
  component: CmxCrudPageShell,
}
export default meta
type Story = StoryObj<typeof CmxCrudPageShell>

const Kpis = () => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    {['12', '4', '7', '1'].map((v, i) => (
      <div key={i} className="rounded-lg border border-border bg-card p-4 cmx-type-kpi">{v}</div>
    ))}
  </div>
)
const Table = () => <div className="h-40 rounded-lg border border-border bg-card" />

export const Full: Story = {
  args: {
    title: 'Orders',
    subtitle: 'Manage and track orders',
    actions: <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">+ New order</button>,
    kpis: <Kpis />,
    filters: <input className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Search" />,
    children: <Table />,
  },
}

export const ContentOnly: Story = { args: { children: <Table /> } }

export const RTL: Story = {
  args: {
    title: 'الطلبات',
    subtitle: 'إدارة الطلبات ومتابعتها',
    actions: <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">+ طلب جديد</button>,
    kpis: <Kpis />,
    children: <Table />,
  },
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
}
