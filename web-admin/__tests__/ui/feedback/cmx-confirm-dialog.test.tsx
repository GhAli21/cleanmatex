import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}))

// next-intl ships ESM that jest cannot parse; the dialog only needs a label lookup.
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { CmxConfirmDialog } from '@ui/feedback/cmx-confirm-dialog'

describe('CmxConfirmDialog', () => {
  it('Escape cancels in controlled mode', async () => {
    const onCancel = jest.fn()
    render(<CmxConfirmDialog open title="Delete?" onConfirm={jest.fn()} onCancel={onCancel} />)
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('moves focus inside the dialog when it opens', async () => {
    render(<CmxConfirmDialog open title="Delete?" onConfirm={jest.fn()} />)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
  })

  it('names the dialog by its title and keeps custom body content', async () => {
    render(
      <CmxConfirmDialog open title="Delete order?" description="This cannot be undone." onConfirm={jest.fn()}>
        <input aria-label="Reason" />
      </CmxConfirmDialog>
    )
    expect(await screen.findByRole('dialog', { name: 'Delete order?' })).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByLabelText('Reason')).toBeInTheDocument()
  })

  it('opens from its trigger and confirms', async () => {
    const onConfirm = jest.fn()
    render(<CmxConfirmDialog title="Delete?" confirmLabel="Yes" onConfirm={onConfirm} trigger={<button>Open</button>} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ignores Escape while the confirm is in progress', async () => {
    const onCancel = jest.fn()
    let finish: () => void = () => {}
    const onConfirm = () => new Promise<void>((resolve) => { finish = resolve })
    render(<CmxConfirmDialog open title="Delete?" confirmLabel="Yes" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
    finish()
  })

  it('a closed confirm does not unlock the page scroll held by an open modal', () => {
    document.body.style.overflow = 'hidden'
    const { rerender } = render(<CmxConfirmDialog open={false} title="Delete?" onConfirm={jest.fn()} />)
    rerender(<CmxConfirmDialog open={false} title="Delete again?" onConfirm={jest.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    document.body.style.overflow = ''
  })

  it('restores the previous scroll lock when it closes', async () => {
    document.body.style.overflow = 'hidden'
    const { rerender } = render(<CmxConfirmDialog open title="Delete?" onConfirm={jest.fn()} />)
    await screen.findByRole('dialog')
    rerender(<CmxConfirmDialog open={false} title="Delete?" onConfirm={jest.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    document.body.style.overflow = ''
  })

  it('does not confirm while confirmDisabled', async () => {
    const onConfirm = jest.fn()
    render(<CmxConfirmDialog open title="Delete?" confirmLabel="Yes" confirmDisabled onConfirm={onConfirm} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
