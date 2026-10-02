import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { CustomerWhatsAppConsentEditor } from '@features/customers/ui/customer-whatsapp-consent-card'

jest.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => namespace === 'common' && key === 'save' ? 'Save' : key }))
jest.mock('@lib/hooks/usePermissions', () => ({ useHasPermission: () => true }))
jest.mock('@ui/feedback', () => ({ cmxMessage: { success: jest.fn(), error: jest.fn() }, CmxSummaryMessage: ({ title }: { title: string }) => <p>{title}</p> }))
jest.mock('@ui/primitives', () => ({
  CmxButton: ({ children, loading, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; children: ReactNode }) => <button {...props} disabled={props.disabled || loading}>{children}</button>,
  CmxCheckbox: ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => <label><input type="checkbox" {...props} />{label}</label>,
  CmxSkeleton: () => <div />,
}))

const renderEditor = (optedIn: boolean, canEdit = true, phone: string | null = null) => {
  const onSave = jest.fn().mockResolvedValue(undefined)
  render(<CustomerWhatsAppConsentEditor consent={{ optedIn, phone, updatedAt: '2026-10-02' }} canEdit={canEdit} pending={false} onSave={onSave} />)
  return onSave
}

describe('customer consent editor', () => {
  it('allows withdrawing existing consent with an invalid phone and writes only after Save', async () => {
    const onSave = renderEditor(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(false))
  })

  it('blocks enabling consent until an international phone is present', () => {
    renderEditor(false)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps customer readers read-only', () => {
    renderEditor(true, false, '+96890123456')
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
