/**
 * Toast display method implementation using Sonner
 * @module ui/feedback/methods
 */

import { toast as sonnerToast } from 'sonner';
import { recordSessionMessage } from '@lib/session-activity';
import type { MessageType, MessageOptions, MessageResult } from '../types';
import { getMessageConfig } from '../message-config';
import { sanitizeHtmlSync, containsHtml } from '../utils/html-sanitizer';

/**
 * Display a message using Sonner toast notifications
 * @param type
 * @param message
 * @param options
 */
export function showToastMessage(
  type: MessageType,
  message: string,
  options?: MessageOptions
): MessageResult {
  const duration = options?.duration ?? getDefaultDuration(type);
  let description = options?.description;

  // Handle HTML content
  if (options?.html && containsHtml(message)) {
    message = sanitizeHtmlSync(message);
  }
  if (options?.html && description && containsHtml(description)) {
    description = sanitizeHtmlSync(description);
  }

  // Determine ARIA role based on message type
  // Sonner handles ARIA attributes internally, but we can add className for styling
  const ariaRole = type === 'error' || type === 'warning' ? 'alert' : 'status';

  // Build Sonner options
  // Note: Sonner supports JSX/React nodes, but we'll use string for now
  // For React node support, we'd need to use sonnerToast.custom() or pass JSX directly
  const sonnerOptions: Parameters<typeof sonnerToast>[1] = {
    duration,
    description: description || (options?.content ? String(options.content) : undefined),
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    // Sonner automatically adds proper ARIA attributes, but we can ensure className
    className: `cmx-toast cmx-toast-${type} [role="${ariaRole}"]`,
  };

  // If content is provided and it's a React node, use custom toast
  if (options?.content && typeof options.content !== 'string') {
    return {
      id: sonnerToast.custom(options.content as any, sonnerOptions),
      dismiss: () => {
        // Dismiss will be handled by Sonner
      },
    };
  }

  let toastId: string | number | undefined;

  // Show toast based on type
  switch (type) {
    case 'success':
      toastId = sonnerToast.success(message, sonnerOptions);
      break;
    case 'error':
      toastId = sonnerToast.error(message, sonnerOptions);
      break;
    case 'warning':
      toastId = sonnerToast.warning(message, sonnerOptions);
      break;
    case 'info':
      toastId = sonnerToast.info(message, sonnerOptions);
      break;
    case 'loading':
      toastId = sonnerToast.loading(message, sonnerOptions);
      break;
    default:
      toastId = sonnerToast(message, sonnerOptions);
  }

  return {
    id: toastId,
    dismiss: () => {
      if (toastId !== undefined) {
        sonnerToast.dismiss(toastId);
      }
    },
  };
}

/**
 * Show a promise-based toast
 * @param promise
 * @param messages
 * @param messages.loading
 * @param messages.success
 * @param messages.error
 * @param options
 */
export function showToastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T> {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: (result: T) => {
      const message =
        typeof messages.success === 'function'
          ? messages.success(result)
          : messages.success;
      // Success is not logged by default; honor forceSessionLog if set
      recordSessionMessage({
        type: 'success',
        title: message,
        description: options?.description,
        method: 'toast',
        source: options?.sessionActivitySource,
        skipSessionLog: options?.skipSessionLog,
        forceSessionLog: options?.forceSessionLog,
      });
      return message;
    },
    error: (error: Error) => {
      const message =
        typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error;
      recordSessionMessage({
        type: 'error',
        title: message,
        description: options?.description,
        method: 'toast',
        source: options?.sessionActivitySource,
        skipSessionLog: options?.skipSessionLog,
        forceSessionLog: options?.forceSessionLog,
      });
      return message;
    },
  }) as unknown as Promise<T>;
}

/**
 * Get default duration for message type from message-config
 * @param type
 */
function getDefaultDuration(type: MessageType): number {
  const { durations } = getMessageConfig();
  return durations[type] ?? 4000;
}
