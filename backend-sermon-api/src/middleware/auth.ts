import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import type { Role } from '../types.js';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

/** Requires a valid `Authorization: Bearer <jwt>` header. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');

  const token = header.slice('Bearer '.length).trim();
  const payload = jwt.verify(token, env.jwtSecret); // throws JsonWebTokenError / TokenExpiredError -> 401 via error handler
  if (typeof payload === 'string' || !payload.sub || !payload.role) throw AppError.unauthorized('Invalid token payload');

  const account = await User.findByPk(payload.sub);
  if (!account || !account.isActive) throw AppError.unauthorized('Account is inactive or no longer exists');
  req.user = { id: account.id, role: account.role };
  next();
}

/** Role-based access control. Use after `authenticate`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
