/**
 * React Hook for Message Utility
 * Provides convenient access to message utility with i18n integration
 * @module ui/feedback
 */

'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MessageOptions, MessageResult, PromiseMessageConfig, PromiseMessages, ErrorExtractionOptions } from './types';
import { cmxMessage } from './cmx-message';

/**
 * Hook return type
 */
export interface UseMessageReturn {
  /**
   * Show success message
   */
  showSuccess: (message: string, options?: MessageOptions) => MessageResult;

  /**
   * Show error message
   */
  showError: (message: string, options?: MessageOptions) => MessageResult;

  /**
   * Show error message extracted from error object
   */
  showErrorFrom: (error: unknown, options?: ErrorExtractionOptions) => MessageResult;

  /**
   * Show warning message
   */
  showWarning: (message: string, options?: MessageOptions) => MessageResult;

  /**
   * Show info message
   */
  showInfo: (message: string, options?: MessageOptions) => MessageResult;

  /**
   * Show loading message
   */
  showLoading: (message: string, options?: MessageOptions) => MessageResult;

  /**
   * Handle promise with loading/success/error messages
   */
  handlePromise: <T>(
    promise: Promise<T>,
    messages: PromiseMessageConfig,
    options?: MessageOptions
  ) => Promise<T>;
}

/**
 * React hook for displaying messages with i18n support
 *
 * @example
 * ```tsx
 * const { showSuccess, showError } = useMessage();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showSuccess(t('messages.saveSuccess'));
 *   } catch (error) {
 *     showError(t('errors.saveFailed'));
 *   }
 * };
 * ```
 */
export function useMessage(): UseMessageReturn {
  const t = useTranslations();

  const showSuccess = useCallback(
    (message: string, options?: MessageOptions) => {
      // If message looks like a translation key, try to translate it
      const translatedMessage = message.includes('.') && !message.includes(' ')
        ? t(message as any)
        : message;
      return cmxMessage.success(translatedMessage, options);
    },
    [t]
  );

  const showError = useCallback(
    (message: string, options?: MessageOptions) => {
      const translatedMessage = message.includes('.') && !message.includes(' ')
        ? t(message as any)
        : message;
      return cmxMessage.error(translatedMessage, options);
    },
    [t]
  );

  const showErrorFrom = useCallback(
    (error: unknown, options?: ErrorExtractionOptions) => {
      // Extract error message first
      const extractedMessage = cmxMessage.errorFrom(error, options);
      
      // Try to translate the extracted message if it looks like a translation key
      // Note: This is a best-effort translation since we don't know the original message
      return extractedMessage;
    },
    []
  );

  const showWarning = useCallback(
    (message: string, options?: MessageOptions) => {
      const translatedMessage = message.includes('.') && !message.includes(' ')
        ? t(message as any)
        : message;
      return cmxMessage.warning(translatedMessage, options);
    },
    [t]
  );

  const showInfo = useCallback(
    (message: string, options?: MessageOptions) => {
      const translatedMessage = message.includes('.') && !message.includes(' ')
        ? t(message as any)
        : message;
      return cmxMessage.info(translatedMessage, options);
    },
    [t]
  );

  const showLoading = useCallback(
    (message: string, options?: MessageOptions) => {
      const translatedMessage = message.includes('.') && !message.includes(' ')
        ? t(message as any)
        : message;
      return cmxMessage.loading(translatedMessage, options);
    },
    [t]
  );

  const handlePromise = useCallback(
    <T,>(
      promise: Promise<T>,
      messages: PromiseMessages,
      options?: MessageOptions
    ): Promise<T> => {
      // Translate message strings if they look like translation keys
      const translatedMessages: PromiseMessageConfig = {
        loading: typeof messages.loading === 'string' && messages.loading.includes('.') && !messages.loading.includes(' ')
          ? t(messages.loading as any)
          : messages.loading,
        success: typeof messages.success === 'string' && messages.success.includes('.') && !messages.success.includes(' ')
          ? t(messages.success as any)
          : messages.success,
        error: typeof messages.error === 'string' && messages.error.includes('.') && !messages.error.includes(' ')
          ? t(messages.error as any)
          : messages.error,
      };

      return cmxMessage.promise(promise, translatedMessages, options);
    },
    [t]
  );

  return {
    showSuccess,
    showError,
    showErrorFrom,
    showWarning,
    showInfo,
    showLoading,
    handlePromise,
  };
}
