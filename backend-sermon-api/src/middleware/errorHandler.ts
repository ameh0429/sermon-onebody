import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof jwt.TokenExpiredError) {
    status = 401;
    message = 'Token has expired';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401;
    message = 'Invalid token';
  } else if (err instanceof UniqueConstraintError) {
    status = 409;
    message = 'Resource already exists';
  } else if (err instanceof ForeignKeyConstraintError) {
    status = 400;
    message = 'Referenced resource does not exist';
  } else if (err instanceof ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = err.errors.map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    message = 'Malformed JSON body';
  } else if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 413) {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} -> ${status}`, err as Error);
  else logger.warn(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);

  res.status(status).json({
    status: 'error',
    message,
    ...(details ? { errors: details } : {}),
    ...(!env.isProduction && status >= 500 && err instanceof Error ? { stack: err.stack } : {}),
  });
}
