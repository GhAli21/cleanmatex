/**
 * CmxMessage - Global Message Utility
 * Unified API for displaying messages across the application
 * @module ui/feedback
 */

import { MessageType, DisplayMethod, type MessageOptions, type MessageResult, type PromiseMessageConfig } from './types';
import { getMessageConfig } from './message-config';
import { showToastMessage, showToastPromise } from './methods/toast-method';
import { showAlertMessage, showAlertPromise } from './methods/alert-method';
import { showConsoleMessage, showConsolePromise } from './methods/console-method';
import { showInlineMessage, showInlinePromise } from './methods/inline-method';

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
   * Show a promise-based message with loading/success/error states
   */
  promise<T>(
    promise: Promise<T>,
    messages: PromiseMessageConfig,
    options?: MessageOptions
  ): Promise<T> {
    const method = options?.method ?? getMessageConfig().defaultMethod;

    switch (method) {
      case DisplayMethod.TOAST:
        return showToastPromise(promise, messages, options);
      case DisplayMethod.ALERT:
        return showAlertPromise(promise, messages, options);
      case DisplayMethod.CONSOLE:
        return showConsolePromise(promise, messages, options);
      case DisplayMethod.INLINE:
        return showInlinePromise(promise, messages, options);
      default:
        return showToastPromise(promise, messages, options);
    }
  }

  /**
   * Internal method to show a message using the specified or default method
   */
  private show(
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
