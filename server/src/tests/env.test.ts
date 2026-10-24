import { describe, expect, it } from 'vitest';
import { validateRuntimeConfig } from '../config/env.js';

const productionConfig = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-random-production-secret-with-more-than-32-characters',
  CLIENT_URL: 'https://taskflow.example.com',
  MONGODB_URI: 'mongodb+srv://database.example.com/taskflow'
};

describe('runtime configuration', () => {
  it('accepts production configuration with an HTTPS origin and MongoDB URI', () => {
    expect(() => validateRuntimeConfig(productionConfig)).not.toThrow();
  });

  it('rejects a short production JWT secret', () => {
    expect(() => validateRuntimeConfig({ ...productionConfig, JWT_SECRET: 'short' })).toThrow(
      'JWT_SECRET must be configured with at least 32 characters in production.'
    );
  });

  it.each(['http://taskflow.example.com', 'https://taskflow.example.com/app', 'not a URL'])(
    'rejects an invalid production client origin',
    (CLIENT_URL) => {
      expect(() => validateRuntimeConfig({ ...productionConfig, CLIENT_URL })).toThrow(
        'CLIENT_URL must be an HTTPS origin in production.'
      );
    }
  );

  it('rejects a non-MongoDB production database URI', () => {
    expect(() => validateRuntimeConfig({ ...productionConfig, MONGODB_URI: 'https://database.example.com' })).toThrow(
      'MONGODB_URI must be configured with a MongoDB connection string in production.'
    );
  });

  it('requires TLS for a standard MongoDB production URI', () => {
    expect(() => validateRuntimeConfig({ ...productionConfig, MONGODB_URI: 'mongodb://database.example.com/taskflow' })).toThrow(
      'MONGODB_URI must enable TLS in production.'
    );
    expect(() => validateRuntimeConfig({ ...productionConfig, MONGODB_URI: 'mongodb://database.example.com/taskflow?ssl=true' })).not.toThrow();
  });

  it('does not impose production-only constraints during local development', () => {
    expect(() => validateRuntimeConfig({
      NODE_ENV: 'development',
      JWT_SECRET: 'short',
      CLIENT_URL: 'http://localhost:5173/path',
      MONGODB_URI: ''
    })).not.toThrow();
  });
});
