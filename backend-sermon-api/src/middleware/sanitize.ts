import type { NextFunction, Request, Response } from 'express';
import xss from 'xss';

// Strip all HTML: allow no tags and drop the contents of script/style tags.
const strip = (value: string) =>
  xss(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] });

const SKIP_KEYS = new Set(['password']);

function clean(value: unknown, key?: string): unknown {
  if (typeof value === 'string') return key && SKIP_KEYS.has(key) ? value : strip(value);
  if (Array.isArray(value)) return value.map((v) => clean(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
  }
  return value;
}

/** Removes HTML/script content from every string in the request body (passwords are left untouched). */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}
