import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AgentLogoResponse,
  AgentProfile,
  AgentPropertyListQuery,
  AgentPublicProfile,
  PaginatedResponse,
  PropertyCard,
  UpdateAgentProfileRequest,
} from '@/types/api';

function assertApiModeForAgentPanel() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/agents/me',
    });
  }
}

export const agentsService = {
  getPublicAgent: (slug: string): Promise<AgentPublicProfile> =>
    request<AgentPublicProfile>(`/agents/${slug}`),

  getPublicAgentProperties: (
    slug: string,
    query: AgentPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyCard>> =>
    request<PaginatedResponse<PropertyCard>>(
      `/agents/${slug}/properties${queryString(query)}`,
      {},
      { auth: 'optional' },
    ),

  getMyAgentProfile: (): Promise<AgentProfile> => {
    assertApiModeForAgentPanel();
    return request<AgentProfile>('/agents/me', {}, { auth: true });
  },

  updateMyAgentProfile: (
    data: UpdateAgentProfileRequest,
  ): Promise<AgentProfile> => {
    assertApiModeForAgentPanel();
    const payload: UpdateAgentProfileRequest = {
      ...(data.companyName !== undefined
        ? { companyName: data.companyName.trim() }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() }
        : {}),
    };
    return request<AgentProfile>(
      '/agents/me',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      { auth: true },
    );
  },

  uploadAgentLogo: (file: File): Promise<AgentLogoResponse> => {
    assertApiModeForAgentPanel();
    const body = new FormData();
    body.append('file', file);
    return request<AgentLogoResponse>(
      '/agents/me/logo',
      {
        method: 'POST',
        body,
      },
      { auth: true },
    );
  },

  // Backward-compatible aliases used in api.ts
  public: (slug: string): Promise<AgentPublicProfile> =>
    agentsService.getPublicAgent(slug),
  properties: (
    slug: string,
    query: AgentPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyCard>> =>
    agentsService.getPublicAgentProperties(slug, query),
  mine: (): Promise<AgentProfile> => agentsService.getMyAgentProfile(),
  update: (data: UpdateAgentProfileRequest): Promise<AgentProfile> =>
    agentsService.updateMyAgentProfile(data),
  logo: (file: File): Promise<AgentLogoResponse> =>
    agentsService.uploadAgentLogo(file),
};
