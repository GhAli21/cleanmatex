/**
 * CleanMateX Logging Utility 
 * 
 * Centralized logging utility for structured logging across the application.
 * Supports multiple log levels, context tracking, and integration with error tracking services.
 * 
 * @version 1.0.0
 * @last_updated 2025-11-14
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  feature?: string;
  action?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  environment: string;
  service: string;
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  environment: string;
  enableConsole: boolean;
  enableSentry?: boolean;
  enableRemoteLogging?: boolean;
  sanitizeSensitiveData?: boolean;
}

/**
 * Sensitive data patterns to sanitize from logs
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /ssn/i,
  /api.?key/i,
];

/**
 * Sanitize sensitive data from log context
 */
function sanitizeContext(context: LogContext, sanitize: boolean): LogContext {
  if (!sanitize) return context;

  const sanitized = { ...context };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    
    // Check if key matches sensitive patterns
    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Check if value is an object with sensitive data
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as LogContext, true);
    }
  }
  
  return sanitized;
}

/**
 * Format log entry for console output
 */
function formatConsoleLog(entry: LogEntry, level: LogLevel): string {
  const emoji = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.FATAL]: '🚨',
  }[level];

  const levelName = entry.level.toUpperCase().padEnd(5);
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  
  let output = `${emoji} [${timestamp}] ${levelName} ${entry.message}`;
  
  if (entry.context && Object.keys(entry.context).length > 0) {
    output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
  }
  
  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.stack && entry.level === 'ERROR') {
      output += `\n  Stack: ${entry.error.stack}`;
    }
  }
  
  return output;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private config: LoggerConfig;
  private sentryClient: any = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG),
      service: config.service ?? 'web-admin',
      environment: config.environment ?? (process.env.NODE_ENV ?? 'development'),
      enableConsole: config.enableConsole ?? true,
      enableSentry: config.enableSentry ?? false,
      enableRemoteLogging: config.enableRemoteLogging ?? false,
      sanitizeSensitiveData: config.sanitizeSensitiveData ?? true,
    };

    // Initialize Sentry if enabled
    // Note: Sentry is optional and loaded dynamically to avoid build-time errors
    // Install @sentry/nextjs if you want error tracking
    if (this.config.enableSentry && typeof window === 'undefined') {
      // Server-side Sentry initialization
      try {
        // Use require with try-catch - webpack will ignore this if package is not installed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Sentry = require('@sentry/nextjs');
        this.sentryClient = Sentry;
      } catch (e) {
        // Sentry not installed, continue without it
      }
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const sanitizedContext = context
      ? sanitizeContext(context, this.config.sanitizeSensitiveData ?? true)
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      environment: this.config.environment,
      service: this.config.service,
    };

    if (sanitizedContext) {
      entry.context = sanitizedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Output log entry
   */
  private outputLog(entry: LogEntry, level: LogLevel): void {
    // Console output
    if (this.config.enableConsole) {
      if (level >= LogLevel.ERROR) {
        console.error(formatConsoleLog(entry, level));
      } else if (level === LogLevel.WARN) {
        console.warn(formatConsoleLog(entry, level));
      } else {
        console.log(formatConsoleLog(entry, level));
      }
    }

    // Sentry integration
    if (this.config.enableSentry && level >= LogLevel.ERROR && this.sentryClient) {
      try {
        if (entry.error) {
          this.sentryClient.captureException(entry.error, {
            level: level === LogLevel.FATAL ? 'fatal' : 'error',
            tags: {
              service: this.config.service,
              feature: entry.context?.feature,
            },
            extra: entry.context,
          });
        } else {
          this.sentryClient.captureMessage(entry.message, {
            level: level === LogLevel.FATAL ? 'fatal' : 'error',
            tags: {
              service: this.config.service,
              feature: entry.context?.feature,
            },
            extra: entry.context,
          });
        }
      } catch (e) {
        // Fail silently if Sentry fails
      }
    }

    // Remote logging (future: send to logging service)
    if (this.config.enableRemoteLogging && level >= LogLevel.ERROR) {
      // TODO: Implement remote logging service integration
      // Example: Send to DataDog, CloudWatch, etc.
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.outputLog(entry, LogLevel.DEBUG);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.outputLog(entry, LogLevel.INFO);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.outputLog(entry, LogLevel.WARN);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.outputLog(entry, LogLevel.ERROR);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.FATAL)) return;
    const entry = this.createLogEntry(LogLevel.FATAL, message, context, error);
    this.outputLog(entry, LogLevel.FATAL);
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.config);
    // Merge parent context with child context
    const originalCreateLogEntry = childLogger.createLogEntry.bind(childLogger);
    childLogger.createLogEntry = (level: LogLevel, message: string, ctx?: LogContext, err?: Error) => {
      const mergedContext = { ...context, ...ctx };
      return originalCreateLogEntry(level, message, mergedContext, err);
    };
    return childLogger;
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }
}

// Create default logger instance
const defaultLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  service: 'web-admin',
  environment: process.env.NODE_ENV ?? 'development',
  enableConsole: true,
  enableSentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  sanitizeSensitiveData: true,
});

// Export default logger and Logger class
export const logger = defaultLogger;
export { Logger };

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context),
  fatal: (message: string, error?: Error, context?: LogContext) => logger.fatal(message, error, context),
};

