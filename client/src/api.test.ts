import { describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './api';

describe('API base URL configuration', () => {
  it('uses localhost for development when no API URL is configured', () => {
    expect(getApiBaseUrl(undefined, true)).toBe('http://localhost:5000/api/v1');
  });

  it('uses a same-origin API path for production when no API URL is configured', () => {
    expect(getApiBaseUrl(undefined, false)).toBe('/api/v1');
  });

  it('uses an explicitly configured API URL in either environment', () => {
    expect(getApiBaseUrl('https://api.taskflow.example/api/v1', false)).toBe('https://api.taskflow.example/api/v1');
  });
});
