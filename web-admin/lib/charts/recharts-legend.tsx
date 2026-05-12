'use client'

import { Legend } from 'recharts'

/**
 * Recharts `Legend` is a class component; React 19 JSX typings reject it as a component.
 * Cast at boundary — use anywhere `<Legend />` from recharts fails typecheck.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts Legend + React 19 JSX types
export const ChartLegend = Legend as any
