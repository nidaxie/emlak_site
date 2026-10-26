import { apiRequest, apiUpload } from '@/services/api-client';
import type { AgentApplication, AgentApplicationInput } from '@/types/agents';

export function createAgentApplication(
  accessToken: string,
  input: AgentApplicationInput,
) {
  return apiRequest<AgentApplication>('/agent-applications', {
    accessToken,
    body: input,
  });
}

export function getMyAgentApplication(accessToken: string) {
  return apiRequest<AgentApplication>('/agent-applications/me', {
    accessToken,
  });
}

export type AgentDocumentType = 'TAX_CERTIFICATE' | 'AUTHORIZATION_CERTIFICATE';

export function uploadAgentDocument(
  accessToken: string,
  documentType: AgentDocumentType,
  file: Blob,
  fileName: string,
) {
  const form = new FormData();
  form.set('file', file, fileName);
  form.set('documentType', documentType);

  return apiUpload<{
    id: string;
    documentType: AgentDocumentType;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>('/agent-applications/me/documents', form, accessToken);
}

export function updateMyAgentApplication(
  accessToken: string,
  input: Partial<AgentApplicationInput>,
) {
  return apiRequest<AgentApplication>('/agent-applications/me', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}
