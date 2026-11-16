import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Check } from 'lucide-react'
import { CmxStatusBadge } from '@ui/feedback/cmx-status-badge'

const badge = () => screen.getByText('Label').closest('span[data-tone]') as HTMLElement

test.each([
  ['success', 'bg-success-bg', 'text-success-text', 'border-success-border'],
  ['warning', 'bg-warning-bg', 'text-warning-text', 'border-warning-border'],
  ['info', 'bg-info-bg', 'text-info-text', 'border-info-border'],
  ['danger', 'bg-danger-bg', 'text-danger-text', 'border-danger-border'],
  ['neutral', 'bg-muted', 'text-muted-foreground', 'border-border'],
  ['brand', 'bg-primary-bg', 'text-primary-text', 'border-primary/30'],
] as const)('soft %s uses its tone tokens', (tone, bg, text, border) => {
  render(<CmxStatusBadge tone={tone} label="Label" />)
  expect(badge()).toHaveClass(bg, text, border)
})

test('defaults to a soft neutral badge', () => {
  render(<CmxStatusBadge label="Label" />)
  expect(badge()).toHaveAttribute('data-tone', 'neutral')
  expect(badge()).toHaveClass('bg-muted')
})

test('renders children when there is no label', () => {
  render(<CmxStatusBadge tone="info">Label</CmxStatusBadge>)
  expect(badge()).toHaveClass('bg-info-bg')
})

test('a caller className wins over the tone background', () => {
  render(<CmxStatusBadge tone="success" className="bg-card" label="Label" />)
  expect(badge()).toHaveClass('bg-card')
  expect(badge()).not.toHaveClass('bg-success-bg')
})

test('solid brand uses the brand colour with its readable text', () => {
  render(<CmxStatusBadge tone="brand" appearance="solid" label="Label" />)
  expect(badge()).toHaveClass('bg-primary', 'text-primary-foreground')
})

test('outline keeps the tone text and border on a clear background', () => {
  render(<CmxStatusBadge tone="danger" appearance="outline" label="Label" />)
  expect(badge()).toHaveClass('bg-transparent', 'text-danger-text', 'border-danger-border')
})

test('the icon is hidden from screen readers and the text stays readable', () => {
  render(<CmxStatusBadge tone="success" icon={Check} label="Label" />)
  expect(badge().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(badge()).not.toHaveAttribute('aria-label')
})
