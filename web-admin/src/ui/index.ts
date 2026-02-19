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

// ===== Compatibility Layer (legacy API, use @ui/compat) =====
// Re-exports for backward compatibility - migrate to Cmx components when possible
export * from './compat'

// ===== Legacy Components (for backward compatibility) =====
// These wrap shadcn/ui - will be phased out
export * from './components'

// ===== Utils =====
export { cn } from '@/lib/utils'
