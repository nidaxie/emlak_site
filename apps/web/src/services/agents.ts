import { apiRequest, apiUpload } from '@/services/api-client';
import type {
  AgentProfile,
  PublicAgentProfile,
  UpdateAgentProfileInput,
} from '@/types/agents';
import type {
  PropertyPage,
  PublicProperty,
  PublicPropertyQuery,
} from '@/types/properties';

export function getPublicAgent(slug: string) {
  return apiRequest<PublicAgentProfile>(`/agents/${encodeURIComponent(slug)}`);
}

export function getAgentProperties(
  slug: string,
  query: PublicPropertyQuery = {},
  accessToken?: string,
) {
  return apiRequest<PropertyPage<PublicProperty>>(
    `/agents/${encodeURIComponent(slug)}/properties${queryString(query)}`,
    { accessToken },
  );
}

export function getMyAgentProfile(accessToken: string) {
  return apiRequest<AgentProfile>('/agents/me', { accessToken });
}

export function uploadMyAgentLogo(
  accessToken: string,
  file: Blob,
  fileName: string,
) {
  const form = new FormData();
  form.set('file', file, fileName);

  return apiUpload<{ logoUrl: string }>('/agents/me/logo', form, accessToken);
}

function queryString(query: object) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : '';
}

export function updateMyAgentProfile(
  accessToken: string,
  input: UpdateAgentProfileInput,
) {
  return apiRequest<AgentProfile>('/agents/me', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}
