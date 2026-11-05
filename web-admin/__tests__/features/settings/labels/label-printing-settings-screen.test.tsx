/**
 * HFC P4 (A-49): Labels & Tags settings screen - renders the three cards with "Use default", saves the scope's
 * overrides, and is view-only without settings:update.
 */
import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const permissions = new Set<string>()
const fetchConfig = jest.fn()
const saveConfig = jest.fn()

jest.mock('@lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({ decimalPlaces: 3 }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }))
jest.mock('@/lib/hooks/usePermissions', () => ({ useHasPermissionCode: (code: string) => permissions.has(code) }))
jest.mock('@/lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'csrf' }) }))
jest.mock('@features/settings/labels/api/label-printing-api', () => ({
  LabelPrintingApiError: class extends Error {},
  fetchLabelPrintingConfig: (...a: unknown[]) => fetchConfig(...a),
  saveLabelPrintingConfig: (...a: unknown[]) => saveConfig(...a),
}))
// Minimal next-intl stand-in over the real EN catalog (next-intl ships ESM only): {var} and simple plurals.
jest.mock('next-intl', () => {
  const catalog: Record<string, unknown> = {
    labelSettings: jest.requireActual('@/messages/en/labelSettings.json'),
    common: jest.requireActual('@/messages/en/common.json'),
  }
  const lookup = (ns: string, key: string): unknown =>
    key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), catalog[ns])
  return {
    useLocale: () => 'en',
    useTranslations: (ns: string) => {
      const t = (key: string, vals: Record<string, string | number> = {}) => {
        let msg = lookup(ns, key)
        if (typeof msg !== 'string') return `${ns}.${key}`
        const plural = /^\{count, plural, one \{([^}]*)\}.*other \{([^}]*)\}\}$/.exec(msg)
        if (plural) msg = (vals.count === 1 ? plural[1] : plural[2]).replace('#', String(vals.count))
        return (msg as string).replace(/\{(\w+)\}/g, (_m, k) => String(vals[k] ?? ''))
      }
      t.has = (key: string) => typeof lookup(ns, key) === 'string'
      return t
    },
  }
})
jest.mock('@ui/feedback', () => ({
  ...jest.requireActual('@ui/feedback'),
  cmxMessage: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() },
}))

import { LabelPrintingSettingsScreen } from '@features/settings/labels/ui/label-printing-settings-screen'

const labelSettings = jest.requireActual<{ receiptBarcodeNote: string }>('@/messages/en/labelSettings.json')

const row = (labelType: string, v: Record<string, unknown> = {}) => ({
  labelType,
  sizeCode: null,
  showQr: null,
  showCustomerName: null,
  showOrderBarcode: null,
  copies: null,
  ...v,
})
const CFG = {
  systemDefaults: [
    row('ORDER_LABEL', { sizeCode: '4x6in', showQr: true, showCustomerName: true, copies: 1 }),
    row('PIECE_TAG', { sizeCode: '58x30mm', showQr: false, copies: 1 }),
    row('RECEIPT', { showOrderBarcode: false }),
  ],
  tenantOverrides: [],
  branchOverrides: [],
  effective: [
    { ...row('ORDER_LABEL', { sizeCode: '4x6in', showQr: true, showCustomerName: true, copies: 1 }), sources: { sizeCode: 'SYSTEM' } },
    { ...row('PIECE_TAG', { sizeCode: '58x30mm', showQr: false, copies: 1 }), sources: {} },
    { ...row('RECEIPT', { showOrderBarcode: false }), sources: { showOrderBarcode: 'FEATURE_FLAG' } },
  ],
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LabelPrintingSettingsScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  permissions.clear()
  fetchConfig.mockReset().mockResolvedValue(CFG)
  saveConfig.mockReset().mockResolvedValue(CFG)
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'b1', name: 'Main', name2: 'الرئيسي' }] }) }) as never
})

describe('LabelPrintingSettingsScreen', () => {
  it('shows the three cards with "Use default", the source and the receipt note; view-only without update', async () => {
    mount()
    expect(await screen.findByText('Order label')).toBeInTheDocument()
    expect(screen.getByText('Piece tag')).toBeInTheDocument()
    expect(screen.getByText('Receipt')).toBeInTheDocument()
    expect(screen.getByText('Use default (4 × 6 in)')).toBeInTheDocument()
    expect(screen.getByText('In use: 4 × 6 in (system default)')).toBeInTheDocument()
    expect(screen.getByText(labelSettings.receiptBarcodeNote)).toBeInTheDocument()
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(fetchConfig).toHaveBeenCalledWith(null)
  })

  it('saves the tenant-wide overrides after a change', async () => {
    permissions.add('settings:update')
    mount()
    await screen.findByText('Order label')
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    fireEvent.click(screen.getByRole('combobox', { name: 'Order barcode' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Show' }))
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveConfig).toHaveBeenCalled())
    const arg = saveConfig.mock.calls[0][0]
    expect(arg.branchId).toBeNull()
    expect(arg.csrfToken).toBe('csrf')
    expect(arg.rows.find((r: { labelType: string }) => r.labelType === 'RECEIPT').showOrderBarcode).toBe(true)
    expect(arg.rows.find((r: { labelType: string }) => r.labelType === 'ORDER_LABEL').sizeCode).toBeNull()
  })
})
