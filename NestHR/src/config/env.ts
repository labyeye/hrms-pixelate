// Central place for environment-specific values.
// To switch environments, change API_BASE_URL here or point to your local IP.
export const API_BASE_URL =
  (globalThis as any).__HRMS_API_BASE_URL__ ||
  'https://hrms-backend.pixelatenest.com/api';
