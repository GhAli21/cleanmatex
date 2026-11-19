import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'

describe('CmxSummaryMessage', () => {
  test('title + items (operation summary), unchanged API', () => {
    render(<CmxSummaryMessage type="success" title="Saved" items={['a', 'b']} />)
    expect(screen.getByRole('alert')).toHaveClass('bg-success-bg', 'border-success-border', 'text-success-text')
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  test('free content: children, or message when both are given; no title needed', () => {
    const { rerender } = render(
      <CmxSummaryMessage type="error">
        <span>Failed <a href="/x">retry</a></span>
      </CmxSummaryMessage>,
    )
    expect(screen.getByRole('alert')).toHaveClass('bg-danger-bg', 'text-danger-text')
    expect(screen.getByRole('link', { name: 'retry' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
    rerender(<CmxSummaryMessage type="info" message="From message">From children</CmxSummaryMessage>)
    expect(screen.getByText('From message')).toBeInTheDocument()
    expect(screen.queryByText('From children')).toBeNull()
  })

  test('passes div attributes and lets the caller set the role', () => {
    render(<CmxSummaryMessage type="warning" id="w1" role="status" message="Heads up" />)
    expect(screen.getByRole('status')).toHaveAttribute('id', 'w1')
  })

  test('dismiss button uses the given label', () => {
    const onDismiss = jest.fn()
    render(<CmxSummaryMessage type="info" message="m" onDismiss={onDismiss} dismissLabel="إغلاق" />)
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
