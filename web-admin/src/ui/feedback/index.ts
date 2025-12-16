/**
 * Feedback Layer - Toasts, alerts, and confirmation dialogs
 * @module ui/feedback
 */

// New unified message utility (recommended)
export * from './cmx-message';
export * from './useMessage';
export * from './types';
export * from './message-config';

// Display methods (for advanced usage)
export * from './methods/toast-method';
export * from './methods/alert-method';
export * from './methods/console-method';
export * from './methods/inline-method';

// Legacy exports (deprecated - maintained for backward compatibility)
export * from './cmx-toast';

// Other feedback components
export * from './cmx-confirm-dialog';
