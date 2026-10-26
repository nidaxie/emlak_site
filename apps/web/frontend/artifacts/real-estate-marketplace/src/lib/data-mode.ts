export type DataMode = 'api' | 'mock';

const configuredMode = import.meta.env.VITE_DATA_MODE;

if (configuredMode && configuredMode !== 'api' && configuredMode !== 'mock') {
  throw new Error('VITE_DATA_MODE yalnızca "api" veya "mock" olabilir.');
}

/**
 * Public discovery uses demo data by default during local development.
 * Production builds use the real API unless VITE_DATA_MODE=mock is explicit.
 */
export const DATA_MODE: DataMode =
  configuredMode ?? (import.meta.env.DEV ? 'mock' : 'api');

export const isMockDataEnabled = DATA_MODE === 'mock';
