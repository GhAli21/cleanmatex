/**
 * Error Extraction Utility
 * Extracts user-friendly error messages from various error types
 * @module ui/feedback/utils
 */

/**
 * Default extraction paths to try when extracting error messages
 */
const DEFAULT_EXTRACTION_PATHS = [
  'message',
  'error',
  'error.message',
  'error.error',
  'detail',
  'details',
  'error.detail',
  'error.details',
  'msg',
  'error.msg',
  'description',
  'error.description',
];

/**
 * Extract error message from various error types
 * Supports: Error, AxiosError, Supabase errors, fetch Response, plain objects
 */
export function extractErrorMessage(
  error: unknown,
  options?: {
    fallback?: string;
    extractFrom?: string[];
  }
): string {
  const fallback = options?.fallback ?? 'An unexpected error occurred';
  const paths = options?.extractFrom ?? DEFAULT_EXTRACTION_PATHS;

  if (!error) {
    return fallback;
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check for nested error (common in wrapped errors)
    if ((error as any).error && (error as any).error instanceof Error) {
      const nestedMessage = (error as any).error.message;
      if (nestedMessage && nestedMessage !== error.message) {
        return nestedMessage;
      }
    }
    return error.message || fallback;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error || fallback;
  }

  // Handle number errors (status codes)
  if (typeof error === 'number') {
    return `Error ${error}`;
  }

  // Handle Response objects (from fetch)
  if (error && typeof error === 'object' && 'status' in error && 'statusText' in error) {
    const response = error as Response;
    return `HTTP ${response.status}: ${response.statusText}`;
  }

  // Handle plain objects - try extraction paths
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, any>;

    // Try each extraction path
    for (const path of paths) {
      const value = getNestedValue(errorObj, path);
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    // Special handling for common error structures

    // AxiosError structure
    if (errorObj.response) {
      const response = errorObj.response as Record<string, any>;
      if (response.data) {
        const data = response.data as Record<string, any>;
        // Try common axios error paths
        if (data.message) return String(data.message);
        if (data.error) {
          if (typeof data.error === 'string') return data.error;
          if (data.error.message) return String(data.error.message);
        }
        if (data.detail) return String(data.detail);
        if (data.details) return String(data.details);
      }
      if (response.status && response.statusText) {
        return `HTTP ${response.status}: ${response.statusText}`;
      }
    }

    // Supabase error structure
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error_description) {
      return String(errorObj.error_description);
    }
    if (errorObj.error) {
      if (typeof errorObj.error === 'string') return errorObj.error;
      if (errorObj.error.message) return String(errorObj.error.message);
    }

    // Try to stringify if it's a simple object
    try {
      const stringified = JSON.stringify(errorObj);
      if (stringified !== '{}' && stringified.length < 200) {
        return stringified;
      }
    } catch {
      // Ignore JSON stringify errors
    }
  }

  return fallback;
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: Record<string, any>, path: string): unknown {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Extract error code if available
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const errorObj = error as Record<string, any>;

  // Try common code fields
  const codePaths = ['code', 'error.code', 'errorCode', 'error_code', 'statusCode', 'status_code'];
  for (const path of codePaths) {
    const value = getNestedValue(errorObj, path);
    if (value != null) {
      return String(value);
    }
  }

  // Check for HTTP status code
  if ('status' in errorObj && typeof errorObj.status === 'number') {
    return `HTTP_${errorObj.status}`;
  }

  return undefined;
}

/**
 * Extract error details/metadata
 */
export function extractErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const errorObj = error as Record<string, any>;
  const details: Record<string, unknown> = {};

  // Extract common metadata fields
  const metadataFields = [
    'code',
    'status',
    'statusCode',
    'statusText',
    'requestId',
    'timestamp',
    'path',
    'method',
    'url',
  ];

  for (const field of metadataFields) {
    if (field in errorObj && errorObj[field] != null) {
      details[field] = errorObj[field];
    }
  }

  // Extract nested details
  if (errorObj.details && typeof errorObj.details === 'object') {
    Object.assign(details, errorObj.details);
  }

  if (errorObj.error?.details && typeof errorObj.error.details === 'object') {
    Object.assign(details, errorObj.error.details);
  }

  return details;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as Record<string, any>;

  // Check for network-related error messages
  const networkMessages = [
    'network',
    'fetch',
    'timeout',
    'connection',
    'offline',
    'failed to fetch',
  ];

  const message = extractErrorMessage(error, { fallback: '' }).toLowerCase();
  if (networkMessages.some((keyword) => message.includes(keyword))) {
    return true;
  }

  // Check for network-related status codes
  if ('status' in errorObj) {
    const status = errorObj.status;
    if (status === 0 || status >= 500) {
      return true;
    }
  }

  return false;
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as Record<string, any>;
  if ('status' in errorObj || 'statusCode' in errorObj) {
    const status = (errorObj.status ?? errorObj.statusCode) as number;
    return status >= 400 && status < 500;
  }

  return false;
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as Record<string, any>;
  if ('status' in errorObj || 'statusCode' in errorObj) {
    const status = (errorObj.status ?? errorObj.statusCode) as number;
    return status >= 500;
  }

  return false;
}

