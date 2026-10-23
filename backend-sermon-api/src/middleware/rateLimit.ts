import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

const handler = (_req: Request, res: Response) => {
  res.status(429).json({ status: 'error', message: 'Too many requests, please try again later.' });
};

const base = { standardHeaders: true, legacyHeaders: false, handler } as const;

/** Applied to the whole API. */
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300 });

/** Strict limiter for login/register to slow down credential stuffing. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 10 });

/** Limits writes to community content (posts, flags). */
export const writeLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 30 });
