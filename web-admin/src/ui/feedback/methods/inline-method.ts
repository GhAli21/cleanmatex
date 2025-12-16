/**
 * Inline display method implementation for component rendering
 * @module ui/feedback/methods
 */

import type { MessageType, MessageOptions, MessageResult, InlineMessage } from '../types';

// Store for inline messages (for components to subscribe)
let inlineMessageStore: InlineMessage | null = null;
let inlineMessageListeners: Set<(message: InlineMessage | null) => void> = new Set();

/**
 * Display a message as an inline message object
 */
export function showInlineMessage(
  type: MessageType,
  message: string,
  options?: MessageOptions
): MessageResult {
  const inlineMessage: InlineMessage = {
    type,
    title: message,
    description: options?.description,
    items: options?.description ? [options.description] : undefined,
    onDismiss: options?.onDismiss,
    data: options?.data,
  };

  // Store message
  inlineMessageStore = inlineMessage;

  // Notify listeners
  inlineMessageListeners.forEach((listener) => {
    listener(inlineMessage);
  });

  return {
    message: inlineMessage,
    dismiss: () => {
      clearInlineMessage();
      if (options?.onDismiss) {
        options.onDismiss();
      }
    },
  };
}

/**
 * Clear the current inline message
 */
export function clearInlineMessage(): void {
  inlineMessageStore = null;
  inlineMessageListeners.forEach((listener) => {
    listener(null);
  });
}

/**
 * Get the current inline message
 */
export function getCurrentInlineMessage(): InlineMessage | null {
  return inlineMessageStore;
}

/**
 * Subscribe to inline message changes
 */
export function subscribeToInlineMessages(
  listener: (message: InlineMessage | null) => void
): () => void {
  inlineMessageListeners.add(listener);

  // Immediately notify with current message
  listener(inlineMessageStore);

  // Return unsubscribe function
  return () => {
    inlineMessageListeners.delete(listener);
  };
}

/**
 * Show a promise-based inline message
 */
export async function showInlinePromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T> {
  // Show loading message
  showInlineMessage('loading', messages.loading, options);

  try {
    const result = await promise;
    const successMessage =
      typeof messages.success === 'function'
        ? messages.success(result)
        : messages.success;
    showInlineMessage('success', successMessage, options);
    return result;
  } catch (error) {
    const errorMessage =
      typeof messages.error === 'function'
        ? messages.error(error as Error)
        : messages.error;
    showInlineMessage('error', errorMessage, options);
    throw error;
  }
}
