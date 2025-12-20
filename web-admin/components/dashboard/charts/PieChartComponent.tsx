'use client'

/**
 * Pie Chart Component
 *
 * Reusable pie chart with customizable data and styling
 */

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

interface PieChartData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface PieChartProps {
  data: PieChartData[]
  height?: number
  showLegend?: boolean
  showLabels?: boolean
  innerRadius?: number
  outerRadius?: number
  formatter?: (value: number) => string
}

export function PieChartComponent({
  data,
  height = 300,
  showLegend = true,
  showLabels = true,
  innerRadius = 0,
  outerRadius = 80,
  formatter,
}: PieChartProps) {
  const renderLabel = (props: any) => {
    if (!showLabels) return null
    const { name, percent } = props
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={showLabels}
          label={renderLabel}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={formatter ? (value: any) => formatter(value) : undefined}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
          }}
        />
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}
