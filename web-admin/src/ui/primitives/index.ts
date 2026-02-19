/**
 * Primitives Layer - Low-level UI components
 * @module ui/primitives
 */

// ===== Cmx Primitives (Blueprint-compliant) =====
export * from './cmx-button'
export * from './cmx-input'
export * from './cmx-textarea'
export * from './cmx-card'
export * from './cmx-spinner'
export * from './cmx-checkbox'
export * from './cmx-select';
export * from './cmx-switch';
export * from './tabs';

// ===== Legacy shadcn/ui primitives (for backward compatibility) =====
// These are being phased out - prefer Cmx* components above
export * from './alert'
export * from './avatar'
export * from './badge'
export * from './button'
export * from './card'
export * from './data-table'
export * from './dropdown-menu'
export * from './form'
export * from './form-input'
export * from './input'
export * from './label'
export * from './loading-button'
export * from './separator'
export * from './table'
export * from './tooltip'
