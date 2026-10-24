import axios from 'axios';

export function getApiBaseUrl(configuredUrl: string | undefined, isDevelopment: boolean): string {
  return configuredUrl || (isDevelopment ? 'http://localhost:5000/api/v1' : '/api/v1');
}

const baseURL = getApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || 'Une erreur est survenue.';
    return Promise.reject(new Error(message));
  }
);
