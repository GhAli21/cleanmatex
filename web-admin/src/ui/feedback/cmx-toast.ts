/**
 * CmxToast - Toast notifications (Sonner wrapper)
 * @module ui/feedback
 * 
 * @deprecated This module is deprecated. Use `cmxMessage` from './cmx-message' instead.
 * See MIGRATION.md for migration guide.
 */

import { cmxMessage } from './cmx-message';
import type { MessageOptions } from './types';

/**
 * @deprecated Use cmxMessage.success() instead
 */
export const cmxToast = {
  success: (message: string, options?: { description?: string }) => {
    console.warn(
      '[DEPRECATED] cmxToast.success is deprecated. Use cmxMessage.success() instead.'
    );
    return cmxMessage.success(message, {
      ...options,
      method: 'toast' as const,
    });
  },
  error: (message: string, options?: { description?: string }) => {
    console.warn(
      '[DEPRECATED] cmxToast.error is deprecated. Use cmxMessage.error() instead.'
    );
    return cmxMessage.error(message, {
      ...options,
      method: 'toast' as const,
    });
  },
  info: (message: string, options?: { description?: string }) => {
    console.warn(
      '[DEPRECATED] cmxToast.info is deprecated. Use cmxMessage.info() instead.'
    );
    return cmxMessage.info(message, {
      ...options,
      method: 'toast' as const,
    });
  },
};

/**
 * @deprecated Use cmxMessage.success() or showSuccess() instead
 */
export const showSuccessToast = cmxToast.success;

/**
 * @deprecated Use cmxMessage.error() or showError() instead
 */
export const showErrorToast = cmxToast.error;

/**
 * @deprecated Use cmxMessage.info() or showInfo() instead
 */
export const showInfoToast = cmxToast.info;
