import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  message: string;
  metadata?: Record<string, any>;
  error?: unknown;
}

export const logger = {
  log: (level: LogLevel, payload: LogPayload) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: payload.message,
      metadata: payload.metadata || {},
    };

    if (payload.error) {
      logEntry.metadata.error =
        payload.error instanceof Error
          ? { name: payload.error.name, message: payload.error.message, stack: payload.error.stack }
          : payload.error;
    }

    // Structured logging for platforms like Datadog, CloudWatch, GCP Logging
    console.log(JSON.stringify(logEntry));

    // Send to Sentry if it's an error
    if (level === 'error') {
      try {
        if (payload.error) {
          Sentry.captureException(payload.error, {
            extra: payload.metadata,
          });
        } else {
          Sentry.captureMessage(payload.message, {
            level: 'error',
            extra: payload.metadata,
          });
        }
      } catch (sentryError) {
        console.error('Failed to log to Sentry', sentryError);
      }
    }
  },

  info: (message: string, metadata?: Record<string, any>) => {
    logger.log('info', { message, metadata });
  },

  warn: (message: string, metadata?: Record<string, any>, error?: unknown) => {
    logger.log('warn', { message, metadata, error });
  },

  error: (message: string, error?: unknown, metadata?: Record<string, any>) => {
    logger.log('error', { message, metadata, error });
  },

  debug: (message: string, metadata?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      logger.log('debug', { message, metadata });
    }
  },
};
