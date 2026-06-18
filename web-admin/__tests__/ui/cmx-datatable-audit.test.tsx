import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

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

    fireEvent.click(screen.getByRole('button', { name: 'Audit' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByText('Audit Information').length).toBeGreaterThan(0)
    expect(screen.getByText('Created by')).toBeInTheDocument()
    expect(screen.getByText('ops_user_001')).toBeInTheDocument()
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
})
