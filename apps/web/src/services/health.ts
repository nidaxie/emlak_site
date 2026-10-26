import { apiGet } from '@/services/api-client';
import type { HealthResponse } from '@/types/health';

export function getHealth() {
  return apiGet<HealthResponse>('/health');
}
