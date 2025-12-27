/**
 * CmxMessage - Global Message Utility
 * Unified API for displaying messages across the application
 * @module ui/feedback
 */

import { MessageType, DisplayMethod, type MessageOptions, type MessageResult, type PromiseMessageConfig, type ConfirmDialogOptions, type ErrorExtractionOptions } from './types';
import { getMessageConfig, setMessageConfig } from './message-config';
import { showToastMessage, showToastPromise } from './methods/toast-method';
import { showAlertMessage, showAlertPromise } from './methods/alert-method';
import { showConsoleMessage, showConsolePromise } from './methods/console-method';
import { showInlineMessage, showInlinePromise } from './methods/inline-method';
import { alertDialogManager } from './utils/alert-dialog-manager';
import { extractErrorMessage } from './utils/error-extractor';
import { messageQueue } from './utils/message-queue';

/**
 * Core message utility class
 */
class CmxMessage {
  /**
   * Display a success message
   */
  success(message: string, options?: MessageOptions): MessageResult {
    return this.show(MessageType.SUCCESS, message, options);
  }

  /**
   * Display an error message
   */
  error(message: string, options?: MessageOptions): MessageResult {
    return this.show(MessageType.ERROR, message, options);
  }

  /**
   * Display an error message extracted from an error object
   * Automatically extracts messages from Error, AxiosError, Supabase errors, fetch responses, etc.
   */
  errorFrom(error: unknown, options?: ErrorExtractionOptions): MessageResult {
    const extractedMessage = extractErrorMessage(error, {
      fallback: options?.fallback,
      extractFrom: options?.extractFrom,
    });

    // Use the extracted message with the provided options (excluding extraction-specific options)
    const { fallback, extractFrom, ...messageOptions } = options || {};
    return this.show(MessageType.ERROR, extractedMessage, messageOptions);
  }

  /**
   * Display a warning message
   */
  warning(message: string, options?: MessageOptions): MessageResult {
    return this.show(MessageType.WARNING, message, options);
  }

  /**
   * Display an info message
   */
  info(message: string, options?: MessageOptions): MessageResult {
    return this.show(MessageType.INFO, message, options);
  }

  /**
   * Display a loading message
   */
  loading(message: string, options?: MessageOptions): MessageResult {
    return this.show(MessageType.LOADING, message, options);
  }

  /**
   * Show a custom confirm dialog
   * Returns a promise that resolves to true if confirmed, false if cancelled
   */
  async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (typeof window === 'undefined') {
      // Server-side: return false
      return false;
    }

    return alertDialogManager.showConfirm(options);
  }

  /**
   * Show multiple messages in batch
   * Messages are shown sequentially with a small delay between them
   */
  async batch(
    messages: Array<{
      type: MessageType;
      message: string;
      options?: MessageOptions;
    }>
  ): Promise<MessageResult[]> {
    const results: MessageResult[] = [];

    for (const msg of messages) {
      const result = await Promise.resolve(this.show(msg.type, msg.message, msg.options));
      results.push(result);
      // Small delay between batch messages
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    messageQueue.clear();
  }

  /**
   * Set message configuration
   */
  setConfig(config: Partial<import('./types').MessageConfig>): void {
    setMessageConfig(config);
    
    // Update queue settings if provided
    if (config.maxQueueSize !== undefined) {
      messageQueue.setMaxSize(config.maxQueueSize);
    }
  }

  /**
   * Show a promise-based message with loading/success/error states
   * Supports both Promise<T> and () => Promise<T> for retry functionality
   */
  promise<T>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    messages: PromiseMessageConfig,
    options?: MessageOptions
  ): Promise<T> {
    const method = options?.method ?? getMessageConfig().defaultMethod;
    const retryConfig = options?.retry;

    // Convert Promise to function if needed
    const promiseFn = typeof promiseOrFn === 'function' 
      ? promiseOrFn 
      : () => promiseOrFn;

    // If retry is configured, wrap the promise function with retry logic
    const promiseWithRetry = retryConfig && retryConfig.maxAttempts
      ? () => this.retryPromise(promiseFn, messages, retryConfig, method)
      : promiseFn;

    switch (method) {
      case DisplayMethod.TOAST:
        return showToastPromise(promiseWithRetry(), messages, options);
      case DisplayMethod.ALERT:
        return showAlertPromise(promiseWithRetry(), messages, options);
      case DisplayMethod.CONSOLE:
        return showConsolePromise(promiseWithRetry(), messages, options);
      case DisplayMethod.INLINE:
        return showInlinePromise(promiseWithRetry(), messages, options);
      default:
        return showToastPromise(promiseWithRetry(), messages, options);
    }
  }

  /**
   * Retry a promise function with configurable retry logic
   */
  private async retryPromise<T>(
    promiseFn: () => Promise<T>,
    messages: PromiseMessageConfig,
    retryConfig: NonNullable<MessageOptions['retry']>,
    method: DisplayMethod
  ): Promise<T> {
    const maxAttempts = retryConfig.maxAttempts ?? 1;
    const baseDelay = retryConfig.delay ?? 1000;
    const exponentialBackoff = retryConfig.exponentialBackoff ?? false;
    const shouldRetry = retryConfig.shouldRetry ?? (() => true);

    let lastError: unknown;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        return await promiseFn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!shouldRetry(error)) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt >= maxAttempts) {
          throw error;
        }

        // Calculate delay (exponential backoff if enabled)
        const delay = exponentialBackoff
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay;

        // Show retry message if callback provided
        if (retryConfig.onRetry) {
          const retryMessage = retryConfig.onRetry(attempt);
          this.show(MessageType.INFO, retryMessage, { method });
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
  }

  /**
   * Internal method to show a message using the specified or default method
   */
  private show(
    type: MessageType,
    message: string,
    options?: MessageOptions
  ): MessageResult | Promise<MessageResult> {
    const config = getMessageConfig();
    const method = options?.method ?? config.defaultMethod;

    // If queuing is enabled, use queue
    if (config.queueMessages && method !== DisplayMethod.CONSOLE) {
      return messageQueue.enqueue(type, message, options, (t, m, o) => {
        return this.showDirect(t, m, o);
      });
    }

    // Otherwise show directly
    return this.showDirect(type, message, { ...options, method });
  }

  /**
   * Direct show method (bypasses queue)
   */
  private showDirect(
    type: MessageType,
    message: string,
    options?: MessageOptions
  ): MessageResult {
    const method = options?.method ?? getMessageConfig().defaultMethod;

    switch (method) {
      case DisplayMethod.TOAST:
        return showToastMessage(type, message, options);
      case DisplayMethod.ALERT:
        return showAlertMessage(type, message, options);
      case DisplayMethod.CONSOLE:
        return showConsoleMessage(type, message, options);
      case DisplayMethod.INLINE:
        return showInlineMessage(type, message, options);
      default:
        return showToastMessage(type, message, options);
    }
  }
}

/**
 * Global message utility instance
 */
export const cmxMessage = new CmxMessage();

/**
 * Convenience exports for direct usage
 */
export const showSuccess = (message: string, options?: MessageOptions) =>
  cmxMessage.success(message, options);

export const showError = (message: string, options?: MessageOptions) =>
  cmxMessage.error(message, options);

export const showWarning = (message: string, options?: MessageOptions) =>
  cmxMessage.warning(message, options);

export const showInfo = (message: string, options?: MessageOptions) =>
  cmxMessage.info(message, options);

export const showLoading = (message: string, options?: MessageOptions) =>
  cmxMessage.loading(message, options);

export const showPromise = <T>(
  promise: Promise<T>,
  messages: PromiseMessageConfig,
  options?: MessageOptions
) => cmxMessage.promise(promise, messages, options);
