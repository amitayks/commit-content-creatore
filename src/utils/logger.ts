/**
 * Winston-based logger utility.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/** Custom log format */
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  // Add stack trace for errors
  if (stack) {
    log += `\n${stack}`;
  }

  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }

  return log;
});

/** Create the logger instance */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

/** Add file transport in production */
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export default logger;

/**
 * Create a child logger with a specific context.
 */
export function createLogger(context: string): winston.Logger {
  return logger.child({ context });
}
