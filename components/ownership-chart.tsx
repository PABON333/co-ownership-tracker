'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCentsAsCurrency, formatPercentage } from '@/lib/financial/calculations'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

interface OwnershipChartProps {
  data: Array<{
    name: string
    value: number
    percentage: number
  }>
}

export function OwnershipChart({ data }: OwnershipChartProps) {
  const chartData = data.filter((d) => d.value > 0)

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string, props) => [
            `${formatCentsAsCurrency(value)} (${formatPercentage(props.payload.percentage)})`,
            name,
          ]}
        />
        <Legend
          formatter={(value, entry) =>
            `${value}: ${formatPercentage((entry.payload as { percentage: number }).percentage)}`
          }
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
