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
}
