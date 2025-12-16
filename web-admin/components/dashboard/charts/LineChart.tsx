'use client'

/**
 * Line Chart Component
 *
 * Reusable line chart with customizable data and styling
 */

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface LineChartData {
  [key: string]: string | number
}

interface LineChartProps {
  data: LineChartData[]
  lines: Array<{
    dataKey: string
    stroke: string
    name?: string
  }>
  xAxisKey: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  formatter?: (value: number) => string
}

export function LineChart({
  data,
  lines,
  xAxisKey,
  height = 300,
  showGrid = true,
  showLegend = true,
  formatter,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          formatter={formatter}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
        />
        {showLegend && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.stroke}
            strokeWidth={2}
            name={line.name}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
