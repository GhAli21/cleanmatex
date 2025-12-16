'use client'

import * as React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface CmxChartProps<TData extends Record<string, unknown> = Record<string, unknown>> {
  data: TData[]
  xKey: string
  yKey: string
}

export const CmxChart = <TData extends Record<string, unknown> = Record<string, unknown>>({
  data,
  xKey,
  yKey,
}: CmxChartProps<TData>) => {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground">No data</div>
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
