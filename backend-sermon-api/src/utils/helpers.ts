import type { Request } from 'express';
import { AppError } from './AppError.js';

/** Express 5 types route params as `string | string[]`; our routes only ever use single values. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  const single = Array.isArray(value) ? value[0] : value;
  if (!single) throw AppError.badRequest(`Missing route parameter: ${name}`);
  return single;
}

export function currentUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export function paginate(page: number, limit: number) {
  return { limit, offset: (page - 1) * limit };
}

export function paginated<T>(rows: T[], total: number, page: number, limit: number) {
  return {
    data: rows,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
