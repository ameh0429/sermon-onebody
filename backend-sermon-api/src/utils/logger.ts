import winston from 'winston';

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level}: ${stack ?? message}`),
      ),
  transports: [new winston.transports.Console()],
});
