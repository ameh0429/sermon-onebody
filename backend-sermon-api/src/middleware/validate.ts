import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates (and coerces) request parts with Zod. Replaces them with the parsed values. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: { location: string; path: string; message: string }[] = [];

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({ location, path: issue.path.join('.'), message: issue.message });
        }
        continue;
      }
      // `req.query` is a getter in Express 5, so redefine it instead of assigning.
      Object.defineProperty(req, location, { value: result.data, writable: true, configurable: true, enumerable: true });
    }

    if (issues.length) throw AppError.badRequest('Validation failed', issues);
    next();
  };
}
