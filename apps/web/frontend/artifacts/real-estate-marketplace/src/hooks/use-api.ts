import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, applicationsApi, favoritesApi, locationsApi, propertiesApi, usersApi } from '@/services/api';
import { publicMarketplaceData } from '@/services/public-marketplace-data';
import type { AgentPropertyListQuery, AdminAgentApplicationListQuery, AdminAgentListQuery, AdminPropertyListQuery, AdminUserListQuery, AuditLogListQuery, MyPropertyListQuery, PublicPropertyListQuery } from '@/types/api';
export const keys = {
  properties: ['properties'] as const, publicProperties: (q: PublicPropertyListQuery) => ['properties', q] as const,
  property: (id: string) => ['property', id] as const, myProperties: (q: MyPropertyListQuery) => ['my-properties', q] as const,
  cities: ['cities'] as const, districts: (id: string) => ['districts', id] as const, neighborhoods: (id: string) => ['neighborhoods', id] as const,
  favorites: ['favorites'] as const, agent: (slug: string) => ['agent', slug] as const, agentProperties: (slug: string, q: AgentPropertyListQuery) => ['agent-properties', slug, q] as const,
  me: ['me'] as const, application: ['application'] as const, applicationDocs: ['application-docs'] as const,
};
export const useProperties = (q: PublicPropertyListQuery) => useQuery({ queryKey: keys.publicProperties(q), queryFn: () => publicMarketplaceData.properties(q) });
export const useProperty = (id: string) => useQuery({ queryKey: keys.property(id), queryFn: () => publicMarketplaceData.property(id), enabled: !!id });
export const useCities = () => useQuery({ queryKey: keys.cities, queryFn: publicMarketplaceData.cities, staleTime: 300000 });
export const useDistricts = (id: string) => useQuery({ queryKey: keys.districts(id), queryFn: () => publicMarketplaceData.districts(id), enabled: !!id, staleTime: 300000 });
export const useNeighborhoods = (id: string) => useQuery({ queryKey: keys.neighborhoods(id), queryFn: () => publicMarketplaceData.neighborhoods(id), enabled: !!id, staleTime: 300000 });
export const useApiCities = () => useQuery({ queryKey: ['api-cities'], queryFn: locationsApi.cities, staleTime: 300000 });
export const useApiDistricts = (id: string) => useQuery({ queryKey: ['api-districts', id], queryFn: () => locationsApi.districts(id), enabled: !!id, staleTime: 300000 });
export const useApiNeighborhoods = (id: string) => useQuery({ queryKey: ['api-neighborhoods', id], queryFn: () => locationsApi.neighborhoods(id), enabled: !!id, staleTime: 300000 });
export const useFavorites = (page = 1) => useQuery({ queryKey: [...keys.favorites, page], queryFn: () => favoritesApi.list(page) });
export const useMineProperties = (q: MyPropertyListQuery) => useQuery({ queryKey: keys.myProperties(q), queryFn: () => propertiesApi.mine(q) });
export const useAgent = (slug: string) => useQuery({ queryKey: keys.agent(slug), queryFn: () => publicMarketplaceData.agent(slug), enabled: !!slug });
export const useAgentProperties = (slug: string, q: AgentPropertyListQuery) => useQuery({ queryKey: keys.agentProperties(slug, q), queryFn: () => publicMarketplaceData.agentProperties(slug, q), enabled: !!slug });
export const useMe = () => useQuery({ queryKey: keys.me, queryFn: usersApi.me });
export const useApplication = () => useQuery({ queryKey: keys.application, queryFn: applicationsApi.mine });
export const useApplicationDocs = (enabled = true) => useQuery({ queryKey: keys.applicationDocs, queryFn: applicationsApi.documents, enabled });
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => favorite ? favoritesApi.remove(id) : favoritesApi.add(id), onSuccess: () => { qc.invalidateQueries({ queryKey: keys.favorites }); qc.invalidateQueries({ queryKey: keys.properties }); qc.invalidateQueries({ queryKey: ['property'] }); qc.invalidateQueries({ queryKey: ['agent-properties'] }); } });
}
export const useInvalidateMarketplace = () => {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['my-properties'] }); qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['property'] }); };
};
export const useAdminUsers = (q: AdminUserListQuery) => useQuery({ queryKey: ['admin-users', q], queryFn: () => adminApi.users(q) });
export const useAdminAgents = (q: AdminAgentListQuery) => useQuery({ queryKey: ['admin-agents', q], queryFn: () => adminApi.agents(q) });
export const useAdminApps = (q: AdminAgentApplicationListQuery) => useQuery({ queryKey: ['admin-apps', q], queryFn: () => adminApi.applications(q) });
export const useAdminProperties = (q: AdminPropertyListQuery) => useQuery({ queryKey: ['admin-properties', q], queryFn: () => propertiesApi.adminList(q) });
export const useAdminAudit = (q: AuditLogListQuery) => useQuery({ queryKey: ['admin-audit', q], queryFn: () => adminApi.audit(q) });
