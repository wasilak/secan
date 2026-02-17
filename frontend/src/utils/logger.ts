/**
 * Logger utility with level controls for development debugging.
 * 
 * In production builds, debug logs are suppressed to keep the console clean.
 * Error and warning logs are always enabled for genuine error conditions.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Enable debug logging only in development mode
    this.config = {
      enabled: import.meta.env.DEV,
      minLevel: import.meta.env.DEV ? 'debug' : 'warn',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled && level === 'debug') {
      return false;
    }
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Log debug information (only in development mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log informational messages (only in development mode)
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warning messages (always enabled)
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log error messages (always enabled)
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
