/**
 * Alert display method implementation using browser dialogs
 * @module ui/feedback/methods
 */

import type { MessageType, MessageOptions, MessageResult } from '../types';

/**
 * Display a message using browser alert/confirm dialogs
 */
export function showAlertMessage(
  type: MessageType,
  message: string,
  options?: MessageOptions
): MessageResult {
  if (typeof window === 'undefined') {
    // Server-side: return without showing
    return { confirmed: false };
  }

  const description = options?.description;
  const fullMessage = description ? `${message}\n\n${description}` : message;

  // For confirm dialogs
  if (options?.confirm) {
    const confirmed = window.confirm(fullMessage);
    return { confirmed };
  }

  // For regular alerts
  switch (type) {
    case 'error':
    case 'warning':
      // Errors and warnings use alert for visibility
      window.alert(fullMessage);
      break;
    case 'success':
    case 'info':
    case 'loading':
    default:
      // Success and info can use alert or be silent
      window.alert(fullMessage);
      break;
  }

  return { confirmed: true };
}

/**
 * Show a promise-based alert (not recommended, but supported)
 */
export async function showAlertPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T> {
  // Show loading message
  if (typeof window !== 'undefined') {
    window.alert(messages.loading);
  }

  try {
    const result = await promise;
    const successMessage =
      typeof messages.success === 'function'
        ? messages.success(result)
        : messages.success;

    if (typeof window !== 'undefined') {
      window.alert(successMessage);
    }

    return result;
  } catch (error) {
    const errorMessage =
      typeof messages.error === 'function'
        ? messages.error(error as Error)
        : messages.error;

    if (typeof window !== 'undefined') {
      window.alert(errorMessage);
    }

    throw error;
  }
}
