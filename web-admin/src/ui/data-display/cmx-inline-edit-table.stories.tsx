/**
 * Storybook — CmxInlineEditTable
 */

import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCheckbox, CmxInput } from '@ui/primitives'
import {
  CmxInlineEditTable,
  type CmxInlineEditTableColumn,
} from './cmx-inline-edit-table'

type DemoRow = {
  id: string
  name: string
  notes: string
  ready: boolean
}

const meta: Meta = {
  title: 'Data Display/CmxInlineEditTable',
  parameters: {
    layout: 'padded',
  },
}

export default meta

type Story = StoryObj

/**
 * Interactive checklist-style table (dialog pattern).
 */
export const Checklist: Story = {
  render: function ChecklistStory() {
    const [rows, setRows] = React.useState<DemoRow[]>([
      { id: '1', name: 'Shirt #1', notes: '', ready: false },
      { id: '2', name: 'Trouser #1', notes: 'Starch', ready: true },
      { id: '3', name: 'Dress #1', notes: '', ready: false },
    ])

    const columns: CmxInlineEditTableColumn<DemoRow>[] = [
      {
        key: 'item',
        header: 'Item',
        cell: (row) => (
          <span className="text-sm font-medium">{row.name}</span>
        ),
      },
      {
        key: 'notes',
        header: 'Notes',
        cell: (row) => (
          <CmxInput
            value={row.notes}
            className="h-8"
            onChange={(e) =>
              setRows((prev) =>
                prev.map((r) =>
                  r.id === row.id ? { ...r, notes: e.target.value } : r
                )
              )
            }
          />
        ),
      },
      {
        key: 'ready',
        header: 'Ready',
        align: 'center',
        width: '5rem',
        cell: (row) => (
          <div className="flex justify-center">
            <CmxCheckbox
              checked={row.ready}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id ? { ...r, ready: e.target.checked } : r
                  )
                )
              }
            />
          </div>
        ),
      },
    ]

    return (
      <CmxInlineEditTable
        caption="Demo pieces"
        getRowId={(r) => r.id}
        data={rows}
        columns={columns}
      />
    )
  },
}

/**
 * Loading skeleton state.
 */
export const Loading: Story = {
  render: () => (
    <CmxInlineEditTable
      columns={[
        { key: 'a', header: 'Item', cell: () => null },
        { key: 'b', header: 'Notes', cell: () => null },
      ]}
      data={[]}
      getRowId={() => 'x'}
      loading
      skeletonRows={3}
    />
  ),
}

/**
 * Empty state with action slot.
 */
export const Empty: Story = {
  render: () => (
    <CmxInlineEditTable
      columns={[
        { key: 'a', header: 'Item', cell: () => null },
        { key: 'b', header: 'Notes', cell: () => null },
      ]}
      data={[]}
      getRowId={() => 'x'}
      emptyTitle="No rows"
      emptyDescription="Nothing to edit yet."
    />
  ),
}
