import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { CustomerWhatsAppConsentEditor } from '@features/customers/ui/customer-whatsapp-consent-card'

jest.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => namespace === 'common' && key === 'save' ? 'Save' : key }))
jest.mock('@lib/hooks/usePermissions', () => ({ useHasPermission: () => true }))
jest.mock('@ui/feedback', () => ({ cmxMessage: { success: jest.fn(), error: jest.fn() }, CmxSummaryMessage: ({ title }: { title: string }) => <p>{title}</p> }))
jest.mock('@ui/primitives', () => ({
  CmxButton: ({ children, loading, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; children: ReactNode }) => <button {...props} disabled={props.disabled || loading}>{children}</button>,
  CmxCheckbox: ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => <label><input type="checkbox" {...props} />{label}</label>,
  CmxSelect: ({ label, options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) =>
    <label>{label}<select {...props}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>,
  CmxSkeleton: () => <div />,
}))

const renderEditor = (optedIn: boolean, canEdit = true, phone: string | null = null, preferredLanguage: string | null = null) => {
  const onSave = jest.fn().mockResolvedValue(undefined)
  const onSaveLanguage = jest.fn().mockResolvedValue(undefined)
  render(<CustomerWhatsAppConsentEditor
    consent={{ optedIn, phone, updatedAt: '2026-10-02', preferredLanguage }}
    canEdit={canEdit} pending={false} onSave={onSave}
    languagePending={false} onSaveLanguage={onSaveLanguage}
  />)
  return { onSave, onSaveLanguage }
}

describe('customer consent editor', () => {
  it('allows withdrawing existing consent with an invalid phone and writes only after Save', async () => {
    const { onSave } = renderEditor(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0])
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(false))
  })

  it('blocks enabling consent until an international phone is present', () => {
    renderEditor(false)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled()
  })

  it('keeps customer readers read-only', () => {
    renderEditor(true, false, '+96890123456')
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('saves an explicit preferred-language change independently of WhatsApp consent', async () => {
    const { onSave, onSaveLanguage } = renderEditor(true, true, '+96890123456', null)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ar' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1])
    await waitFor(() => expect(onSaveLanguage).toHaveBeenCalledWith('ar'))
    expect(onSave).not.toHaveBeenCalled()
  })
})
