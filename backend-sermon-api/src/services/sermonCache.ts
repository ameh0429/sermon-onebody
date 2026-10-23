import NodeCache from 'node-cache';
import { env } from '../config/env.js';

/**
 * In-process cache for sermon list responses. Swap for Redis if you run several instances
 * (each instance would otherwise hold its own copy until the TTL expires).
 */
export const sermonCache = new NodeCache({
  stdTTL: env.sermonCacheTtl,
  checkperiod: Math.max(30, env.sermonCacheTtl),
  useClones: false,
  maxKeys: 500,
});

export const sermonListKey = (query: unknown) => `sermons:list:${JSON.stringify(query)}`;
export const invalidateSermonCache = () => sermonCache.flushAll();
