import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  dbSync: process.env.DB_SYNC === 'true',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  sermonCacheTtl: Number(process.env.SERMON_CACHE_TTL ?? 60),
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
