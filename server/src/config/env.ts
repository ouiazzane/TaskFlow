import dotenv from 'dotenv';

dotenv.config();

dotenv.config({ path: '../.env' });

function getNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: getNumber('PORT', 5000),
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? 'taskflow',
  JWT_SECRET: process.env.JWT_SECRET ?? 'development-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1d',
  COOKIE_NAME: process.env.COOKIE_NAME ?? 'taskflow_token',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  RATE_LIMIT_WINDOW_MS: getNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  RATE_LIMIT_MAX: getNumber('RATE_LIMIT_MAX', 100)
};

type RuntimeConfig = Pick<typeof env, 'NODE_ENV' | 'JWT_SECRET' | 'CLIENT_URL' | 'MONGODB_URI'>;

export function validateRuntimeConfig(config: RuntimeConfig): void {
  if (config.NODE_ENV !== 'production') return;
  if (config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
  }

  let clientOrigin: URL;
  try {
    clientOrigin = new URL(config.CLIENT_URL);
  } catch {
    throw new Error('CLIENT_URL must be an HTTPS origin in production.');
  }
  if (clientOrigin.protocol !== 'https:' || clientOrigin.origin !== config.CLIENT_URL) {
    throw new Error('CLIENT_URL must be an HTTPS origin in production.');
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(config.MONGODB_URI)) {
    throw new Error('MONGODB_URI must be configured with a MongoDB connection string in production.');
  }
  if (!/^mongodb\+srv:\/\//i.test(config.MONGODB_URI) && !/[?&](?:tls|ssl)=true(?:&|$)/i.test(config.MONGODB_URI)) {
    throw new Error('MONGODB_URI must enable TLS in production.');
  }
}

validateRuntimeConfig(env);
