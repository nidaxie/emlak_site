export type DataMode = 'api' | 'mock';

const configuredMode = import.meta.env.VITE_DATA_MODE;

if (configuredMode && configuredMode !== 'api' && configuredMode !== 'mock') {
  throw new Error('VITE_DATA_MODE yalnızca "api" veya "mock" olabilir.');
}

/**
 * Default mode is "api" unless VITE_DATA_MODE="mock" is explicitly set.
 * In "api" mode, requests never fall back to mock data.
 */
export const DATA_MODE: DataMode = configuredMode ?? 'api';

export const isMockDataEnabled = DATA_MODE === 'mock';
