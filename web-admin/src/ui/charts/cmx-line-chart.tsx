/**
 * CmxLineChart - Line chart wrapper for Recharts
 * @module ui/charts
 */

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface CmxLineChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey: string
}

export function CmxLineChart({ data, xKey, yKey }: CmxLineChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid
            stroke="rgb(var(--cmx-border-subtle-rgb,226 232 240))"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis dataKey={xKey} tickLine={false} />
          <YAxis tickLine={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="rgb(var(--cmx-primary-rgb,14 165 233))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
