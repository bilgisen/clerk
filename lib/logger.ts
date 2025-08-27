import pino, { Logger } from 'pino';

// Define log message structure
type LogMessage = {
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  [key: string]: unknown;
};

// Create a Pino logger instance
const baseLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  customLevels: {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  },
});

// Create a child logger with default context
const createLogger = (context: Record<string, unknown> = {}) => {
  const childLogger = baseLogger.child(context);
  
  // Wrap logger methods to ensure proper typing
  return {
    debug: (msg: string | LogMessage, ...args: unknown[]) => {
      if (typeof msg === 'string') {
        childLogger.debug({ message: msg, ...(args[0] as object || {}) });
      } else {
        childLogger.debug(msg);
      }
    },
    info: (msg: string | LogMessage, ...args: unknown[]) => {
      if (typeof msg === 'string') {
        childLogger.info({ message: msg, ...(args[0] as object || {}) });
      } else {
        childLogger.info(msg);
      }
    },
    warn: (msg: string | LogMessage, ...args: unknown[]) => {
      if (typeof msg === 'string') {
        childLogger.warn({ message: msg, ...(args[0] as object || {}) });
      } else {
        childLogger.warn(msg);
      }
    },
    error: (msg: string | LogMessage | Error, ...args: unknown[]) => {
      if (msg instanceof Error) {
        childLogger.error({ error: msg });
      } else if (typeof msg === 'string') {
        childLogger.error({ 
          message: msg, 
          ...(args[0] as object || {}) 
        });
      } else {
        childLogger.error(msg);
      }
    },
    child: (context: Record<string, unknown>) => createLogger(context),
  };
};

// Create default logger instance
const logger = createLogger();

export { logger, createLogger };
export type { LogMessage };

export default logger;
