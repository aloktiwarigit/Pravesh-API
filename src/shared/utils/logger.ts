import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger: pino.Logger = pino({
  level,
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'pla-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-test-auth-secret"]',
      'req.body.pan',
      'req.body.panNumber',
      'req.body.accountNumber',
      'req.body.aadhaarNumber',
    ],
    remove: true,
  },
});

export type Logger = pino.Logger;
