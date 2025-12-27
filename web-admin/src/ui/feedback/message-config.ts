/**
 * Message utility configuration
 * @module ui/feedback
 */

import type { MessageConfig } from './types';
import { DisplayMethod } from './types';

/**
 * Default message configuration
 */
const defaultConfig: MessageConfig = {
  defaultMethod: DisplayMethod.TOAST,
  toastPosition: 'top-right',
  durations: {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
    loading: Infinity,
  },
  enableConsoleInProduction: false,
  rtlAware: true,
  queueMessages: false,
  maxQueueSize: 5,
  throttleMs: 100,
};

let currentConfig: MessageConfig = { ...defaultConfig };

/**
 * Get the current message configuration
 */
export function getMessageConfig(): MessageConfig {
  return { ...currentConfig };
}

/**
 * Update message configuration
 */
export function setMessageConfig(config: Partial<MessageConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    durations: {
      ...currentConfig.durations,
      ...(config.durations || {}),
    },
  };
}

/**
 * Reset configuration to defaults
 */
export function resetMessageConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Get RTL-aware toast position
 */
export function getRTLToastPosition(): 'top-left' | 'top-right' {
  if (!currentConfig.rtlAware) {
    return currentConfig.toastPosition as 'top-left' | 'top-right';
  }

  // Check document direction
  if (typeof document !== 'undefined') {
    const isRTL = document.documentElement.dir === 'rtl';
    return isRTL ? 'top-left' : 'top-right';
  }

  // Fallback to configured position
  return currentConfig.toastPosition as 'top-left' | 'top-right';
}
