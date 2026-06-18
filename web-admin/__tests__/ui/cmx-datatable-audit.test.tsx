import '@testing-library/jest-dom'
import * as React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    ({
      close: 'Close',
      'auditCard.title': 'Audit Information',
      'auditCard.actionLabel': 'Audit',
      'auditCard.createdAt': 'Created at',
      'auditCard.createdBy': 'Created by',
      'auditCard.updatedAt': 'Updated at',
      'auditCard.updatedBy': 'Updated by',
      'auditCard.createdInfo': 'Created info',
      'auditCard.updatedInfo': 'Updated info',
      'auditCard.recordStatus': 'Record status',
      'auditCard.recordOrder': 'Record order',
      'auditCard.recordNotes': 'Record notes',
      'auditCard.showMore': 'Show more',
      'auditCard.showLess': 'Show less',
      'auditCard.notAvailable': '—',
      'auditCard.missingActor': 'NO_Data_For_this_user_id, Contact Admin',
    }[key] ?? key),
}))

import { CmxDataTable } from '@/src/ui/data-display/cmx-datatable'

type AuditRow = {
  id: string
  name: string
  created_at?: string
  created_by?: string | null
}

describe('CmxDataTable audit action', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('auto-detects audit fields and opens the shared audit dialog', () => {
    render(
      <CmxDataTable<AuditRow>
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => row.name,
            sortable: false,
          },
        ]}
        data={[
          {
            id: 'row_1',
            name: 'Campaign Sync',
            created_at: '2026-06-18T10:00:00.000Z',
            created_by: 'ops_user_001',
          },
        ]}
      />,
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Audit' }))
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByText('Audit Information').length).toBeGreaterThan(0)
    expect(screen.getByText('Created by')).toBeInTheDocument()
    expect(screen.getByText('ops_user_001')).toBeInTheDocument()
  })

  it('resolves actor display names and shows them above ids when available', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: '370466e6-8b45-4e7d-b377-f0f9421deb59',
            displayName: 'Aisha Rahman',
            email: 'aisha@cleanmatex.test',
            phone: '+968 9000 1111',
          },
        ],
      }),
    })

    render(
      <CmxDataTable<AuditRow>
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => row.name,
            sortable: false,
          },
        ]}
        data={[
          {
            id: 'row_3',
            name: 'Tax Profile',
            created_at: '2026-06-18T10:00:00.000Z',
            created_by: '370466e6-8b45-4e7d-b377-f0f9421deb59',
          },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Audit' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Aisha Rahman')).toBeInTheDocument()
    expect(screen.getByText('aisha@cleanmatex.test • +968 9000 1111')).toBeInTheDocument()
    expect(screen.getByText('370466e6-8b45-4e7d-b377-f0f9421deb59')).toBeInTheDocument()
  })

  it('does not render the audit action when rows have no audit fields', () => {
    render(
      <CmxDataTable<AuditRow>
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => row.name,
            sortable: false,
          },
        ]}
        data={[
          {
            id: 'row_2',
            name: 'No Audit Row',
          },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Audit' })).not.toBeInTheDocument()
  })

  it('shows the missing actor fallback when both user lookups return no data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
      }),
    })

    render(
      <CmxDataTable<AuditRow>
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => row.name,
            sortable: false,
          },
        ]}
        data={[
          {
            id: 'row_4',
            name: 'Missing Audit Actor',
            created_at: '2026-06-18T10:00:00.000Z',
            created_by: 'missing-user-id',
          },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Audit' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('NO_Data_For_this_user_id, Contact Admin')).toBeInTheDocument()
    expect(screen.getByText('missing-user-id')).toBeInTheDocument()
  })
})
