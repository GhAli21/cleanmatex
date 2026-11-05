/**
 * Storybook: CmxCodeChip (HFC P3b). Order, line, piece and tag codes; click to copy; stays LTR inside RTL text.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCodeChip } from '@ui/data-display/cmx-code-chip'

const meta = {
  title: 'DataDisplay/CmxCodeChip',
  component: CmxCodeChip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: { kind: { control: 'select', options: ['order', 'item', 'piece', 'tag'] }, size: { control: 'select', options: ['sm', 'md'] } },
  args: { code: 'ORD-20261031-0001', kind: 'order' },
} satisfies Meta<typeof CmxCodeChip>

export default meta
type Story = StoryObj<typeof meta>

export const Order: Story = {}
export const Piece: Story = { args: { code: 'ORD-20261031-0001-2-3', kind: 'piece', size: 'md' } }
export const Tag: Story = { args: { code: 'HT-55120', kind: 'tag', label: 'Tag' } }
export const NotCopyable: Story = { args: { copyable: false } }
export const InArabicText: Story = {
  render: (args) => (
    <p dir="rtl">
      الطلب <CmxCodeChip {...args} label="رقم الطلب" /> جاهز للاستلام
    </p>
  ),
}
