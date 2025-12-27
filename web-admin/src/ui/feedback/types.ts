/**
 * Type definitions for Global Message Utility
 * @module ui/feedback
 */

/**
 * Message types supported by the utility
 */
export enum MessageType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading',
}

/**
 * Display methods for messages
 */
export enum DisplayMethod {
  TOAST = 'toast',
  ALERT = 'alert',
  CONSOLE = 'console',
  INLINE = 'inline',
}

/**
 * Options for displaying a message
 */
export interface MessageOptions {
  /**
   * Display method to use. If not specified, uses default from config.
   */
  method?: DisplayMethod;

  /**
   * Additional description or details for the message
   */
  description?: string;

  /**
   * Rich content (React node) - supported by toast and inline methods
   */
  content?: React.ReactNode;

  /**
   * Enable HTML rendering (use with caution, content will be sanitized)
   * @default false
   */
  html?: boolean;

  /**
   * Duration in milliseconds (for toast notifications)
   * @default Based on message type from config
   */
  duration?: number;

  /**
   * Whether the message can be dismissed
   * @default true
   */
  dismissible?: boolean;

  /**
   * Action button configuration (for toast)
   */
  action?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Custom data to attach to the message
   */
  data?: Record<string, unknown>;

  /**
   * For inline method: callback when message is dismissed
   */
  onDismiss?: () => void;

  /**
   * For alert method: whether to show as confirm dialog
   */
  confirm?: boolean;

  /**
   * For alert method: confirm button label
   */
  confirmLabel?: string;

  /**
   * For alert method: cancel button label
   */
  cancelLabel?: string;

  /**
   * Retry configuration for promise method
   */
  retry?: {
    /**
     * Maximum number of retry attempts
     * @default 0 (no retry)
     */
    maxAttempts?: number;

    /**
     * Delay between retries in milliseconds
     * @default 1000
     */
    delay?: number;

    /**
     * Use exponential backoff (delay doubles with each retry)
     * @default false
     */
    exponentialBackoff?: boolean;

    /**
     * Callback to generate retry message
     * @param attempt Current attempt number (1-indexed)
     * @returns Message to show during retry
     */
    onRetry?: (attempt: number) => string;

    /**
     * Condition function to determine if error should be retried
     * @param error The error that occurred
     * @returns true if should retry, false otherwise
     */
    shouldRetry?: (error: unknown) => boolean;
  };
}

/**
 * Result returned from message display operations
 */
export interface MessageResult {
  /**
   * Unique ID for the message (for toast/inline)
   */
  id?: string | number;

  /**
   * Dismiss function (for toast)
   */
  dismiss?: () => void;

  /**
   * For inline method: message object for rendering
   */
  message?: InlineMessage;

  /**
   * For alert method: whether user confirmed
   */
  confirmed?: boolean;
}

/**
 * Inline message object for component rendering
 */
export interface InlineMessage {
  type: MessageType;
  title: string;
  description?: string;
  items?: string[];
  onDismiss?: () => void;
  data?: Record<string, unknown>;
  /**
   * ARIA role for accessibility
   * @default Based on message type (alert for error/warning, status for success/info)
   */
  role?: 'alert' | 'status' | 'log';
  /**
   * ARIA live region politeness
   * @default 'polite' for success/info, 'assertive' for error/warning
   */
  ariaLive?: 'polite' | 'assertive' | 'off';
}

/**
 * Promise message configuration
 */
export interface PromiseMessageConfig {
  loading: string;
  success: string | ((result: unknown) => string);
  error: string | ((error: Error) => string);
}

/**
 * Alias for PromiseMessageConfig (for backward compatibility)
 */
export type PromiseMessages = PromiseMessageConfig;

/**
 * Confirm dialog options for custom alert dialogs
 */
export interface ConfirmDialogOptions {
  /**
   * Dialog title
   */
  title: string;

  /**
   * Main message content
   */
  message?: string;

  /**
   * Additional description/details
   */
  description?: string;

  /**
   * Dialog variant determines styling and default icon
   */
  variant?: 'default' | 'destructive' | 'success' | 'warning';

  /**
   * Confirm button label
   */
  confirmLabel?: string;

  /**
   * Cancel button label
   */
  cancelLabel?: string;

  /**
   * Custom icon name (Lucide icon)
   */
  icon?: string;

  /**
   * Custom icon component (overrides icon prop)
   */
  iconComponent?: React.ReactNode;

  /**
   * Whether to show cancel button
   * @default true
   */
  showCancel?: boolean;
}

/**
 * Error extraction options
 */
export interface ErrorExtractionOptions extends Omit<MessageOptions, 'confirm' | 'confirmLabel' | 'cancelLabel'> {
  /**
   * Fallback message if error extraction fails
   */
  fallback?: string;

  /**
   * Custom extraction paths to try (e.g., ['message', 'error', 'detail', 'error.message'])
   */
  extractFrom?: string[];
}

/**
 * Message configuration interface
 */
export interface MessageConfig {
  defaultMethod: DisplayMethod;
  toastPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  durations: {
    success: number;
    error: number;
    warning: number;
    info: number;
    loading: number;
  };
  enableConsoleInProduction: boolean;
  rtlAware: boolean;
  /**
   * Enable message queuing
   * @default false
   */
  queueMessages?: boolean;
  /**
   * Maximum queue size
   * @default 5
   */
  maxQueueSize?: number;
}
