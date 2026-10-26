import { queryString, request } from '@/lib/api-client';
import type * as T from '@/types/api';

const json = (data: unknown) => JSON.stringify(data);
export const authApi = {
  login: (data: T.LoginRequest) => request<T.LoginResponse>('/auth/login', { method: 'POST', body: json(data), credentials: 'include' }),
  register: (data: T.RegisterRequest) => request<T.AuthUser>('/auth/register', { method: 'POST', body: json(data) }),
  logout: () => request<T.LogoutResponse>('/auth/logout', { method: 'POST', credentials: 'include' }),
};
export const usersApi = {
  me: () => request<T.UserProfile>('/users/me', {}, { auth: true }),
  updateMe: (data: T.UpdateUserProfileRequest) => request<T.UserProfile>('/users/me', { method: 'PATCH', body: json(data) }, { auth: true }),
};
export const locationsApi = {
  cities: () => request<T.City[]>('/locations/cities'),
  districts: (cityId: string) => request<T.District[]>(`/locations/cities/${cityId}/districts`),
  neighborhoods: (districtId: string) => request<T.Neighborhood[]>(`/locations/districts/${districtId}/neighborhoods`),
};
export const propertiesApi = {
  list: (query: T.PublicPropertyListQuery) => request<T.PaginatedResponse<T.PropertyCard>>(`/properties${queryString(query)}`, {}, { auth: 'optional' }),
  detail: (id: string) => request<T.PropertyDetail>(`/properties/${id}`, {}, { auth: 'optional' }),
  mine: (query: T.MyPropertyListQuery) => request<T.PaginatedResponse<T.PropertyRecord>>(`/properties/me${queryString(query)}`, {}, { auth: true }),
  mineDetail: (id: string) => request<T.PropertyRecord>(`/properties/me/${id}`, {}, { auth: true }),
  create: (data: T.CreatePropertyRequest) => request<T.PropertyRecord>('/properties', { method: 'POST', body: json(data) }, { auth: true }),
  update: (id: string, data: T.UpdatePropertyRequest) => request<T.PropertyRecord>(`/properties/${id}`, { method: 'PATCH', body: json(data) }, { auth: true }),
  status: (id: string, data: T.UpdatePropertyStatusRequest) => request<T.PropertyRecord>(`/properties/${id}/status`, { method: 'PATCH', body: json(data) }, { auth: true }),
  remove: (id: string) => request<T.DeletePropertyResponse>(`/properties/${id}`, { method: 'DELETE' }, { auth: true }),
  uploadImage: (id: string, file: File) => { const body = new FormData(); body.append('file', file); return request<T.UploadedPropertyImage>(`/properties/${id}/images`, { method: 'POST', body }, { auth: true }); },
  orderImages: (id: string, imageIds: string[]) => request<T.PropertyImageOrderResponse>(`/properties/${id}/images/order`, { method: 'PATCH', body: json({ imageIds }) }, { auth: true }),
  coverImage: (id: string, imageId: string) => request<T.PropertyCoverResponse>(`/properties/${id}/images/${imageId}/cover`, { method: 'PATCH' }, { auth: true }),
  deleteImage: (id: string, imageId: string) => request<T.DeletedPropertyImageResponse>(`/properties/${id}/images/${imageId}`, { method: 'DELETE' }, { auth: true }),
  adminList: (query: T.AdminPropertyListQuery) => request<T.PaginatedResponse<T.AdminProperty>>(`/admin/properties${queryString(query)}`, {}, { auth: true }),
  adminDetail: (id: string) => request<T.AdminPropertyDetail>(`/admin/properties/${id}`, {}, { auth: true }),
  moderate: (id: string, reason: string) => request<T.PropertyRecord>(`/admin/properties/${id}/deactivate`, { method: 'PATCH', body: json({ reason }) }, { auth: true }),
  adminDelete: (id: string, reason: string) => request<T.DeletePropertyResponse>(`/admin/properties/${id}`, { method: 'DELETE', body: json({ reason }) }, { auth: true }),
  adminDeleteImage: (id: string, imageId: string) => request<T.DeletedPropertyImageResponse>(`/admin/properties/${id}/images/${imageId}`, { method: 'DELETE' }, { auth: true }),
};
export const favoritesApi = {
  list: (page = 1, limit = 20) => request<T.FavoriteListResponse>(`/favorites${queryString({ page, limit })}`, {}, { auth: true }),
  add: (id: string) => request<T.FavoriteMutationResponse>(`/favorites/${id}`, { method: 'POST' }, { auth: true }),
  remove: (id: string) => request<T.FavoriteRemovalResponse>(`/favorites/${id}`, { method: 'DELETE' }, { auth: true }),
};
export const agentsApi = {
  public: (slug: string) => request<T.AgentPublicProfile>(`/agents/${slug}`),
  properties: (slug: string, query: T.AgentPropertyListQuery) => request<T.PaginatedResponse<T.PropertyCard>>(`/agents/${slug}/properties${queryString(query)}`, {}, { auth: 'optional' }),
  mine: () => request<T.AgentProfile>('/agents/me', {}, { auth: true }),
  update: (data: T.UpdateAgentProfileRequest) => request<T.AgentProfile>('/agents/me', { method: 'PATCH', body: json(data) }, { auth: true }),
  logo: (file: File) => { const body = new FormData(); body.append('file', file); return request<T.AgentLogoResponse>('/agents/me/logo', { method: 'POST', body }, { auth: true }); },
};
export const applicationsApi = {
  mine: () => request<T.AgentApplication>('/agent-applications/me', {}, { auth: true }),
  create: (data: T.CreateAgentApplicationRequest) => request<T.AgentApplication>('/agent-applications', { method: 'POST', body: json(data) }, { auth: true }),
  update: (data: T.UpdateAgentApplicationRequest) => request<T.AgentApplication>('/agent-applications/me', { method: 'PATCH', body: json(data) }, { auth: true }),
  documents: () => request<T.AgentApplicationDocument[]>('/agent-applications/me/documents', {}, { auth: true }),
  uploadDocument: (file: File, documentType: T.AgentDocumentType) => { const body = new FormData(); body.append('file', file); body.append('documentType', documentType); return request<T.UploadedAgentDocument>('/agent-applications/me/documents', { method: 'POST', body }, { auth: true }); },
  download: (id: string) => request<Blob>(`/agent-applications/me/documents/${id}`, {}, { auth: true }),
};
export const adminApi = {
  users: (q: T.AdminUserListQuery) => request<T.PaginatedResponse<T.AdminUser>>(`/admin/users${queryString(q)}`, {}, { auth: true }),
  user: (id: string) => request<T.AdminUserDetail>(`/admin/users/${id}`, {}, { auth: true }),
  userStatus: (id: string, isActive: boolean) => request<T.ActiveStatusResponse>(`/admin/users/${id}/status`, { method: 'PATCH', body: json({ isActive }) }, { auth: true }),
  applications: (q: T.AdminAgentApplicationListQuery) => request<T.PaginatedResponse<T.AdminAgentApplicationListItem>>(`/admin/agent-applications${queryString(q)}`, {}, { auth: true }),
  application: (id: string) => request<T.AdminAgentApplication>(`/admin/agent-applications/${id}`, {}, { auth: true }),
  applicationDocuments: (id: string) => request<T.AgentApplicationDocument[]>(`/admin/agent-applications/${id}/documents`, {}, { auth: true }),
  applicationDocument: (id: string, docId: string) => request<Blob>(`/admin/agent-applications/${id}/documents/${docId}`, {}, { auth: true }),
  approveApplication: (id: string) => request<T.AgentApplicationApproval>(`/admin/agent-applications/${id}/approve`, { method: 'POST' }, { auth: true }),
  rejectApplication: (id: string, reason: string) => request<T.AgentApplicationRejection>(`/admin/agent-applications/${id}/reject`, { method: 'POST', body: json({ reason }) }, { auth: true }),
  agents: (q: T.AdminAgentListQuery) => request<T.PaginatedResponse<T.AdminAgentListItem>>(`/admin/agents${queryString(q)}`, {}, { auth: true }),
  agent: (id: string) => request<T.AdminAgent>(`/admin/agents/${id}`, {}, { auth: true }),
  agentStatus: (id: string, isActive: boolean) => request<T.ActiveStatusResponse>(`/admin/agents/${id}/status`, { method: 'PATCH', body: json({ isActive }) }, { auth: true }),
  audit: (q: T.AuditLogListQuery) => request<T.PaginatedResponse<T.AuditLog>>(`/admin/audit-logs${queryString(q)}`, {}, { auth: true }),
};
