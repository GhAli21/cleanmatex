/**
 * CleanMateX UI Library
 * Main entry point for the design system - implements UI Blueprint v1.0
 * @module ui
 */

// ===== Layer 1: Foundations =====
export * from './foundations'

// ===== Layer 2: Primitives =====
export * from './primitives'

// ===== Layer 3: Forms =====
export * from './forms'

// ===== Layer 4: Data Display =====
export * from './data-display'

// ===== Layer 5: Charts =====
export * from './charts'

// ===== Layer 6: Feedback =====
export * from './feedback'

// ===== Layer 7: Navigation =====
export * from './navigation'

// ===== Layer 8: Overlays =====
export * from './overlays'

// ===== Layer 9: Patterns =====
export * from './patterns'

// NOTE: CmxChart and legacy wrappers live in ./components; not re-exported here to avoid
// overlap with primitives/forms/feedback. Use @ui/primitives, @ui/forms, @ui/feedback, etc.
// If needed: import { CmxChart } from '@ui/components'

// ===== Utils =====
export { cn } from '@/lib/utils'
