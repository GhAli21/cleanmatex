/**
 * Console display method implementation for development logging
 * @module ui/feedback/methods
 */

import type { MessageType, MessageOptions, MessageResult } from '../types';
import { getMessageConfig } from '../message-config';

/**
 * Display a message using console logging
 * @param type
 * @param message
 * @param options
 */
export function showConsoleMessage(
  type: MessageType,
  message: string,
  options?: MessageOptions
): MessageResult {
  const config = getMessageConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  // Skip console logging in production unless explicitly enabled
  if (isProduction && !config.enableConsoleInProduction) {
    return {};
  }

  const description = options?.description;
  const data = options?.data;

  // Build log message
  const logMessage = description ? `${message} - ${description}` : message;
  const logData = data ? { data } : undefined;

  // Log based on type
  switch (type) {
    case 'success':
      console.log('✅ SUCCESS:', logMessage, logData || '');
      break;
    case 'error':
      console.error('❌ ERROR:', logMessage, logData || '');
      break;
    case 'warning':
      console.warn('⚠️ WARNING:', logMessage, logData || '');
      break;
    case 'info':
      console.info('ℹ️ INFO:', logMessage, logData || '');
      break;
    case 'loading':
      console.log('⏳ LOADING:', logMessage, logData || '');
      break;
    default:
      console.log('📢 MESSAGE:', logMessage, logData || '');
  }

  return {};
}

/**
 * Show a promise-based console log
 * @param promise
 * @param messages
 * @param messages.loading
 * @param messages.success
 * @param messages.error
 * @param options
 */
export async function showConsolePromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T> {
  const config = getMessageConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !config.enableConsoleInProduction) {
    return promise;
  }

  console.log('⏳', messages.loading);

  try {
    const result = await promise;
    const successMessage =
      typeof messages.success === 'function'
        ? messages.success(result)
        : messages.success;
    console.log('✅', successMessage);
    return result;
  } catch (error) {
    const errorMessage =
      typeof messages.error === 'function'
        ? messages.error(error as Error)
        : messages.error;
    console.error('❌', errorMessage);
    throw error;
  }
}
