/**
 * Storybook coverage for the shared data table, including the built-in audit
 * row action that auto-detects audit-shaped row metadata.
 */

import type { ComponentType } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import {
  CmxDataTable,
  type CmxDataTableProps,
} from '@ui/data-display/cmx-datatable'

type StoryRow = {
  id: string
  name: string
  status: string
  created_at?: string
  created_by?: string | null
  updated_at?: string | null
  updated_by?: string | null
}

const columns: CmxDataTableProps<StoryRow>['columns'] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => row.name,
    sortable: false,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => row.status,
    sortable: false,
  },
]

const meta = {
  title: 'DataDisplay/CmxDataTable',
  component: CmxDataTable as ComponentType<CmxDataTableProps<StoryRow>>,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<ComponentType<CmxDataTableProps<StoryRow>>>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    columns,
    data: [
      { id: '1', name: 'North Branch', status: 'Active' },
      { id: '2', name: 'Airport Counter', status: 'Inactive' },
    ],
  },
}

export const WithAuditActions: Story = {
  args: {
    columns,
    data: [
      {
        id: '1',
        name: 'North Branch',
        status: 'Active',
        created_at: '2026-06-18T10:00:00.000Z',
        created_by: 'ops_user_001',
        updated_at: '2026-06-18T12:30:00.000Z',
        updated_by: 'branch_admin_004',
      },
      {
        id: '2',
        name: 'Airport Counter',
        status: 'Inactive',
        created_at: '2026-06-17T08:15:00.000Z',
        created_by: 'setup_job_002',
      },
    ],
  },
}

export const RTL: Story = {
  args: {
    columns: [
      {
        key: 'name',
        header: 'الاسم',
        render: (row) => row.name,
        sortable: false,
      },
      {
        key: 'status',
        header: 'الحالة',
        render: (row) => row.status,
        sortable: false,
      },
    ],
    data: [
      {
        id: '1',
        name: 'فرع مسقط',
        status: 'نشط',
        created_at: '2026-06-18T10:00:00.000Z',
        created_by: 'ops_user_ar_001',
      },
    ],
  },
  parameters: {
    direction: 'rtl',
  },
  // RTL variant — verifies Arabic layout direction.
}
