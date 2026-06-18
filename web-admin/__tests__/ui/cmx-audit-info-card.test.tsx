import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    ({
      'auditCard.title': 'Audit Information',
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

import { CmxAuditInfoCard } from '@/src/ui/data-display/cmx-audit-info-card'

/**
 * Keeps test rendering concise so each case focuses on the audit behavior under
 * test rather than repeating the surrounding card setup.
 */
function renderCard(props: React.ComponentProps<typeof CmxAuditInfoCard>) {
  return render(<CmxAuditInfoCard {...props} />)
}

describe('CmxAuditInfoCard', () => {
  it('normalizes snake_case and camelCase record fields', () => {
    renderCard({
      record: {
        created_at: '2026-06-18T10:00:00.000Z',
        created_by: 'raw_user_001',
        updatedAt: '2026-06-18T12:15:00.000Z',
        updatedBy: {
          displayName: 'Operations Lead',
        },
      },
    })

    expect(screen.getByText('Created by')).toBeInTheDocument()
    expect(screen.getByText('raw_user_001')).toBeInTheDocument()
    expect(screen.getByText('Updated by')).toBeInTheDocument()
    expect(screen.getByText('Operations Lead')).toBeInTheDocument()
  })

  it('prefers explicit props over normalized record values', () => {
    renderCard({
      record: {
        created_at: '2026-06-18T10:00:00.000Z',
        created_by: 'raw_user_001',
      },
      createdBy: {
        displayName: 'Override User',
      },
    })

    expect(screen.getByText('Override User')).toBeInTheDocument()
    expect(screen.queryByText('raw_user_001')).not.toBeInTheDocument()
  })

  it('uses actor fallback priority label then displayName then email then id', () => {
    renderCard({
      createdBy: {
        label: 'Finance Supervisor',
        displayName: 'Display Name',
        email: 'finance@cleanmatex.test',
        id: 'user_123',
      },
      updatedBy: {
        email: 'ops@cleanmatex.test',
      },
    })

    expect(screen.getByText('Finance Supervisor')).toBeInTheDocument()
    expect(screen.getByText('ops@cleanmatex.test')).toBeInTheDocument()
  })

  it('renders actor display name above the stable id when both are available', () => {
    renderCard({
      createdBy: {
        displayName: 'Aisha Rahman',
        email: 'aisha@cleanmatex.test',
        phone: '+968 9000 1111',
        id: '370466e6-8b45-4e7d-b377-f0f9421deb59',
      },
    })

    expect(screen.getByText('Aisha Rahman')).toBeInTheDocument()
    expect(screen.getByText('aisha@cleanmatex.test • +968 9000 1111')).toBeInTheDocument()
    expect(screen.getByText('370466e6-8b45-4e7d-b377-f0f9421deb59')).toBeInTheDocument()
  })

  it('normalizes actor companion fields from raw records', () => {
    renderCard({
      record: {
        created_by: '370466e6-8b45-4e7d-b377-f0f9421deb59',
        created_by_name: 'Audit Owner',
        created_by_email: 'audit.owner@cleanmatex.test',
        created_by_phone: '+968 9111 2222',
      },
    })

    expect(screen.getByText('Audit Owner')).toBeInTheDocument()
    expect(screen.getByText('audit.owner@cleanmatex.test • +968 9111 2222')).toBeInTheDocument()
    expect(screen.getByText('370466e6-8b45-4e7d-b377-f0f9421deb59')).toBeInTheDocument()
  })

  it('omits absent core rows when raw record keys are not present', () => {
    renderCard({
      record: {
        created_at: '2026-06-18T10:00:00.000Z',
      },
    })

    expect(screen.getByText('Created at')).toBeInTheDocument()
    expect(screen.queryByText('Updated at')).not.toBeInTheDocument()
    expect(screen.queryByText('Created by')).not.toBeInTheDocument()
  })

  it('renders em dash for explicitly passed null core values', () => {
    renderCard({
      createdAt: null,
      createdBy: null,
    })

    expect(screen.getByText('Created at')).toBeInTheDocument()
    expect(screen.getByText('Created by')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('collapses extras by default and toggles aria-expanded', () => {
    renderCard({
      createdAt: '2026-06-18T10:00:00.000Z',
      extras: [
        { key: 'postedBy', label: 'Posted by', value: 'Finance Manager' },
      ],
    })

    const toggle = screen.getByRole('button', { name: /show more/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Posted by')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: /show less/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Posted by')).toBeInTheDocument()
    expect(screen.getByText('Finance Manager')).toBeInTheDocument()
  })

  it('renders formatted datetime output for explicit timestamp props', () => {
    renderCard({
      createdAt: '2026-06-18T10:00:00.000Z',
    })

    expect(
      screen.getByText((content) => content.includes('2026')),
    ).toBeInTheDocument()
  })
})
