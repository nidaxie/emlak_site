import { ApiRequestError, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AgentApplication,
  AgentApplicationDocument,
  AgentDocumentType,
  CreateAgentApplicationRequest,
  UpdateAgentApplicationRequest,
  UploadedAgentDocument,
} from '@/types/api';

function assertApiModeForAgentApplications() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/agent-applications',
    });
  }
}

export const agentApplicationsService = {
  createApplication: (
    data: CreateAgentApplicationRequest,
  ): Promise<AgentApplication> => {
    assertApiModeForAgentApplications();
    return request<AgentApplication>(
      '/agent-applications',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  getMyApplication: (): Promise<AgentApplication> => {
    assertApiModeForAgentApplications();
    return request<AgentApplication>(
      '/agent-applications/me',
      {},
      { auth: true },
    );
  },

  updateMyApplication: (
    data: UpdateAgentApplicationRequest,
  ): Promise<AgentApplication> => {
    assertApiModeForAgentApplications();
    return request<AgentApplication>(
      '/agent-applications/me',
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  uploadDocument: (
    file: File,
    documentType: AgentDocumentType,
  ): Promise<UploadedAgentDocument> => {
    assertApiModeForAgentApplications();
    const body = new FormData();
    body.append('file', file);
    body.append('documentType', documentType);
    return request<UploadedAgentDocument>(
      '/agent-applications/me/documents',
      {
        method: 'POST',
        body,
      },
      { auth: true },
    );
  },

  getMyDocuments: (): Promise<AgentApplicationDocument[]> => {
    assertApiModeForAgentApplications();
    return request<AgentApplicationDocument[]>(
      '/agent-applications/me/documents',
      {},
      { auth: true },
    );
  },

  getMyDocument: (documentId: string): Promise<Blob> => {
    assertApiModeForAgentApplications();
    return request<Blob>(
      `/agent-applications/me/documents/${documentId}`,
      {},
      { auth: true },
    );
  },

  // Backward-compatible aliases used in api.ts
  mine: (): Promise<AgentApplication> =>
    agentApplicationsService.getMyApplication(),
  create: (data: CreateAgentApplicationRequest): Promise<AgentApplication> =>
    agentApplicationsService.createApplication(data),
  update: (data: UpdateAgentApplicationRequest): Promise<AgentApplication> =>
    agentApplicationsService.updateMyApplication(data),
  documents: (): Promise<AgentApplicationDocument[]> =>
    agentApplicationsService.getMyDocuments(),
  download: (id: string): Promise<Blob> =>
    agentApplicationsService.getMyDocument(id),
};
