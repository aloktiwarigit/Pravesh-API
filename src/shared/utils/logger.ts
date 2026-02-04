/**
 * Shared Logger Utility
 * Structured JSON logging for Azure Application Insights compatibility
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function formatLog(level: LogLevel, contextOrMessage: Record<string, unknown> | string, message?: string): LogEntry {
  const entry: LogEntry = {
    level,
    message: typeof contextOrMessage === 'string' ? contextOrMessage : (message ?? ''),
    timestamp: new Date().toISOString(),
  };

  if (typeof contextOrMessage === 'object') {
    entry.context = contextOrMessage;
  }

  return entry;
}

export const logger = {
  info(contextOrMessage: Record<string, unknown> | string, message?: string): void {
    const entry = formatLog('info', contextOrMessage, message);
    console.log(JSON.stringify(entry));
  },

  warn(contextOrMessage: Record<string, unknown> | string, message?: string): void {
    const entry = formatLog('warn', contextOrMessage, message);
    console.warn(JSON.stringify(entry));
  },

  error(contextOrMessage: Record<string, unknown> | string, message?: string): void {
    const entry = formatLog('error', contextOrMessage, message);
    console.error(JSON.stringify(entry));
  },

  debug(contextOrMessage: Record<string, unknown> | string, message?: string): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = formatLog('debug', contextOrMessage, message);
      console.debug(JSON.stringify(entry));
    }
  },
};
