import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { OrderStatusBadge, orderStatusTone } from '@features/orders/ui/order-status-badge'
import { STATUS_META, type OrderStatus } from '@/lib/types/workflow'

const statusWithHue = (hue: string) =>
  (Object.keys(STATUS_META) as OrderStatus[]).find((s) => STATUS_META[s].color === hue)

test('every status hue maps to a locked tone', () => {
  const tones = new Set(['neutral', 'info', 'success', 'warning', 'danger'])
  for (const status of Object.keys(STATUS_META)) expect(tones.has(orderStatusTone(status))).toBe(true)
})

test('a green status renders as success with its stage icon', () => {
  const status = statusWithHue('green') ?? statusWithHue('emerald')
  expect(status).toBeDefined()
  const { container } = render(<OrderStatusBadge status={status as OrderStatus} />)
  const badge = container.querySelector('[data-tone]')
  expect(badge).toHaveAttribute('data-tone', 'success')
  expect(badge?.querySelector('svg')).not.toBeNull()
})

test('Arabic label comes from labelAr', () => {
  const status = Object.keys(STATUS_META)[0] as OrderStatus
  render(<OrderStatusBadge status={status} locale="ar" />)
  expect(screen.getByText(STATUS_META[status].labelAr)).toBeInTheDocument()
})

test('unknown status renders nothing and maps to neutral', () => {
  const { container } = render(<OrderStatusBadge status={'not_a_status' as OrderStatus} />)
  expect(container).toBeEmptyDOMElement()
  expect(orderStatusTone('not_a_status')).toBe('neutral')
})
