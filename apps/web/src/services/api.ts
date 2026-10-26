import { request } from '@/lib/api-client';
import { adminAgentApplicationsService } from '@/services/admin-agent-applications';
import { adminAgentsService } from '@/services/admin-agents';
import { adminAuditService } from '@/services/admin-audit';
import { adminPropertiesService } from '@/services/admin-properties';
import { adminUsersService } from '@/services/admin-users';
import { agentApplicationsService } from '@/services/agent-applications';
import { agentsService } from '@/services/agents';
import { authService } from '@/services/auth';
import { favoritesService } from '@/services/favorites';
import { propertiesService } from '@/services/properties';
import { propertyImagesService } from '@/services/property-images';
import { usersService } from '@/services/users';
import type * as T from '@/types/api';

export const authApi = authService;
export const usersApi = usersService;
export const locationsApi = {
  cities: () => request<T.City[]>('/locations/cities'),
  districts: (cityId: string) =>
    request<T.District[]>(`/locations/cities/${cityId}/districts`),
  neighborhoods: (districtId: string) =>
    request<T.Neighborhood[]>(`/locations/districts/${districtId}/neighborhoods`),
};
export const propertiesApi = propertiesService;
export const propertyImagesApi = propertyImagesService;
export const favoritesApi = favoritesService;
export const agentsApi = agentsService;
export const applicationsApi = agentApplicationsService;
export const adminUsersApi = adminUsersService;
export const adminApplicationsApi = adminAgentApplicationsService;
export const adminAgentsApi = adminAgentsService;
export const adminPropertiesApi = adminPropertiesService;
export const adminAuditApi = adminAuditService;

export const adminApi = {
  users: adminUsersService.getUsers,
  user: adminUsersService.getUser,
  userStatus: adminUsersService.updateUserStatus,
  applications: adminAgentApplicationsService.getApplications,
  application: adminAgentApplicationsService.getApplication,
  applicationDocuments: adminAgentApplicationsService.getApplicationDocuments,
  applicationDocument: adminAgentApplicationsService.getApplicationDocument,
  approveApplication: adminAgentApplicationsService.approveApplication,
  rejectApplication: adminAgentApplicationsService.rejectApplication,
  agents: adminAgentsService.getAgents,
  agent: adminAgentsService.getAgent,
  agentStatus: adminAgentsService.updateAgentStatus,
  properties: adminPropertiesService.getProperties,
  property: adminPropertiesService.getProperty,
  deactivateProperty: adminPropertiesService.deactivateProperty,
  deletePropertyImage: adminPropertiesService.deletePropertyImage,
  deleteProperty: adminPropertiesService.deleteProperty,
  audit: adminAuditService.getAuditLogs,
};
