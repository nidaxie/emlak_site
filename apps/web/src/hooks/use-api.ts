import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  adminAgentsApi,
  adminApplicationsApi,
  adminAuditApi,
  adminPropertiesApi,
  adminUsersApi,
  agentsApi,
  applicationsApi,
  favoritesApi,
  locationsApi,
  propertiesApi,
  usersApi,
} from '@/services/api';
import { publicMarketplaceData } from '@/services/public-marketplace-data';
import type {
  AgentPropertyListQuery,
  AdminAgentApplicationListQuery,
  AdminAgentListQuery,
  AdminPropertyListQuery,
  AdminUserListQuery,
  AuditLogListQuery,
  FavoriteListResponse,
  MyPropertyListQuery,
  PaginatedResponse,
  PropertyCard,
  PropertyDetail,
  PublicPropertyListQuery,
} from '@/types/api';

export const keys = {
  properties: ['properties'] as const,
  publicProperties: (q: PublicPropertyListQuery) => ['properties', q] as const,
  property: (id: string) => ['property', id] as const,
  myProperties: (q: MyPropertyListQuery) => ['my-properties', q] as const,
  myProperty: (id: string) => ['my-property', id] as const,
  agentMe: ['agent-me'] as const,
  cities: ['cities'] as const,
  districts: (id: string) => ['districts', id] as const,
  neighborhoods: (id: string) => ['neighborhoods', id] as const,
  favorites: ['favorites'] as const,
  agent: (slug: string) => ['agent', slug] as const,
  agentProperties: (slug: string, q: AgentPropertyListQuery) =>
    ['agent-properties', slug, q] as const,
  me: ['me'] as const,
  application: ['agent-application', 'me'] as const,
  applicationDocs: ['agent-application', 'documents'] as const,
  adminUsers: (q: AdminUserListQuery) => ['admin-users', q] as const,
  adminUser: (id: string) => ['admin-user', id] as const,
  adminApplications: (q: AdminAgentApplicationListQuery) =>
    ['admin-agent-applications', q] as const,
  adminApplication: (id: string) => ['admin-agent-application', id] as const,
  adminApplicationDocuments: (id: string) =>
    ['admin-agent-application-documents', id] as const,
  adminAgents: (q: AdminAgentListQuery) => ['admin-agents', q] as const,
  adminAgent: (id: string) => ['admin-agent', id] as const,
  adminProperties: (q: AdminPropertyListQuery) =>
    ['admin-properties', q] as const,
  adminProperty: (id: string) => ['admin-property', id] as const,
  adminAuditLogs: (q: AuditLogListQuery) => ['admin-audit-logs', q] as const,
};

export const useProperties = (q: PublicPropertyListQuery) =>
  useQuery({
    queryKey: keys.publicProperties(q),
    queryFn: () => publicMarketplaceData.properties(q),
  });

export const useProperty = (id: string) =>
  useQuery({
    queryKey: keys.property(id),
    queryFn: () => publicMarketplaceData.property(id),
    enabled: !!id,
  });

export const useCities = () =>
  useQuery({
    queryKey: keys.cities,
    queryFn: publicMarketplaceData.cities,
    staleTime: 300000,
  });

export const useDistricts = (id: string) =>
  useQuery({
    queryKey: keys.districts(id),
    queryFn: () => publicMarketplaceData.districts(id),
    enabled: !!id,
    staleTime: 300000,
  });

export const useNeighborhoods = (id: string) =>
  useQuery({
    queryKey: keys.neighborhoods(id),
    queryFn: () => publicMarketplaceData.neighborhoods(id),
    enabled: !!id,
    staleTime: 300000,
  });

export const useApiCities = () =>
  useQuery({
    queryKey: ['api-cities'],
    queryFn: locationsApi.cities,
    staleTime: 300000,
  });

export const useApiDistricts = (id: string) =>
  useQuery({
    queryKey: ['api-districts', id],
    queryFn: () => locationsApi.districts(id),
    enabled: !!id,
    staleTime: 300000,
  });

export const useApiNeighborhoods = (id: string) =>
  useQuery({
    queryKey: ['api-neighborhoods', id],
    queryFn: () => locationsApi.neighborhoods(id),
    enabled: !!id,
    staleTime: 300000,
  });

export const useFavorites = (page = 1, limit = 20) =>
  useQuery({
    queryKey: [...keys.favorites, page, limit],
    queryFn: () => favoritesApi.getFavorites(page, limit),
  });

export const useMineProperties = (q: MyPropertyListQuery, enabled = true) =>
  useQuery({
    queryKey: keys.myProperties(q),
    queryFn: () => propertiesApi.getMyProperties(q),
    enabled,
  });

export const useMineProperty = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.myProperty(id),
    queryFn: () => propertiesApi.getMyProperty(id),
    enabled: enabled && !!id,
  });

export const useMyAgentProfile = (enabled = true) =>
  useQuery({
    queryKey: keys.agentMe,
    queryFn: agentsApi.getMyAgentProfile,
    enabled,
  });

export const useAgent = (slug: string) =>
  useQuery({
    queryKey: keys.agent(slug),
    queryFn: () => publicMarketplaceData.agent(slug),
    enabled: !!slug,
  });

export const useAgentProperties = (slug: string, q: AgentPropertyListQuery) =>
  useQuery({
    queryKey: keys.agentProperties(slug, q),
    queryFn: () => publicMarketplaceData.agentProperties(slug, q),
    enabled: !!slug,
  });

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: usersApi.getMe });

export const useApplication = (enabled = true) =>
  useQuery({
    queryKey: keys.application,
    queryFn: applicationsApi.getMyApplication,
    enabled,
    retry: (failureCount, error) =>
      !(error instanceof ApiRequestError && error.status === 404) &&
      failureCount < 1,
  });

export const useApplicationDocs = (enabled = true) =>
  useQuery({
    queryKey: keys.applicationDocs,
    queryFn: applicationsApi.getMyDocuments,
    enabled,
  });

function updatePaginatedCardFavorite(
  pageData: PaginatedResponse<PropertyCard> | undefined,
  propertyId: string,
  nextFavorite: boolean,
): PaginatedResponse<PropertyCard> | undefined {
  if (!pageData?.items) return pageData;
  return {
    ...pageData,
    items: pageData.items.map((item) =>
      item.id === propertyId ? { ...item, isFavorite: nextFavorite } : item,
    ),
  };
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      favorite
        ? favoritesApi.removeFavorite(id)
        : favoritesApi.addFavorite(id),
    onMutate: async ({ id, favorite }) => {
      const nextFavorite = !favorite;

      await Promise.all([
        qc.cancelQueries({ queryKey: keys.favorites }),
        qc.cancelQueries({ queryKey: keys.properties }),
        qc.cancelQueries({ queryKey: keys.property(id) }),
        qc.cancelQueries({ queryKey: ['agent-properties'] }),
      ]);

      const previousFavorites = qc.getQueriesData<FavoriteListResponse>({
        queryKey: keys.favorites,
      });
      const previousProperties = qc.getQueriesData<
        PaginatedResponse<PropertyCard>
      >({
        queryKey: keys.properties,
      });
      const previousDetail = qc.getQueryData<PropertyDetail>(keys.property(id));
      const previousAgentProperties = qc.getQueriesData<
        PaginatedResponse<PropertyCard>
      >({
        queryKey: ['agent-properties'],
      });

      qc.setQueriesData<PaginatedResponse<PropertyCard>>(
        { queryKey: keys.properties },
        (old) => updatePaginatedCardFavorite(old, id, nextFavorite),
      );

      qc.setQueriesData<PaginatedResponse<PropertyCard>>(
        { queryKey: ['agent-properties'] },
        (old) => updatePaginatedCardFavorite(old, id, nextFavorite),
      );

      if (previousDetail) {
        qc.setQueryData<PropertyDetail>(keys.property(id), {
          ...previousDetail,
          isFavorite: nextFavorite,
        });
      }

      if (!nextFavorite) {
        qc.setQueriesData<FavoriteListResponse>(
          { queryKey: keys.favorites },
          (old) => {
            if (!old?.items) return old;
            const existed = old.items.some((item) => item.id === id);
            if (!existed) return old;
            return {
              ...old,
              items: old.items.filter((item) => item.id !== id),
              total: Math.max(0, old.total - 1),
            };
          },
        );
      }

      return {
        previousFavorites,
        previousProperties,
        previousDetail,
        previousAgentProperties,
      };
    },
    onError: (error, variables, context) => {
      if (context) {
        context.previousFavorites.forEach(([key, data]) =>
          qc.setQueryData(key, data),
        );
        context.previousProperties.forEach(([key, data]) =>
          qc.setQueryData(key, data),
        );
        if (context.previousDetail !== undefined) {
          qc.setQueryData(keys.property(variables.id), context.previousDetail);
        }
        context.previousAgentProperties.forEach(([key, data]) =>
          qc.setQueryData(key, data),
        );
      }

      const description =
        error instanceof ApiRequestError
          ? error.message
          : 'Favori işlemi tamamlanamadı. Lütfen tekrar deneyin.';
      toast({
        variant: 'destructive',
        title: 'İşlem gerçekleştirilemedi',
        description,
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.favorite
          ? 'Favorilerden çıkarıldı'
          : 'Favorilere eklendi',
      });
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: keys.favorites });
      qc.invalidateQueries({ queryKey: keys.properties });
      qc.invalidateQueries({ queryKey: keys.property(variables.id) });
      qc.invalidateQueries({ queryKey: ['agent-properties'] });
    },
  });
}

export const useInvalidateMarketplace = () => {
  const qc = useQueryClient();
  return (propertyId?: string) => {
    qc.invalidateQueries({ queryKey: ['my-properties'] });
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['agent-properties'] });
    qc.invalidateQueries({ queryKey: ['favorites'] });
    if (propertyId) {
      qc.invalidateQueries({ queryKey: keys.property(propertyId) });
      qc.invalidateQueries({ queryKey: keys.myProperty(propertyId) });
    } else {
      qc.invalidateQueries({ queryKey: ['property'] });
    }
  };
};

export const useAdminUsers = (q: AdminUserListQuery, enabled = true) =>
  useQuery({
    queryKey: keys.adminUsers(q),
    queryFn: () => adminUsersApi.getUsers(q),
    enabled,
  });

export const useAdminUser = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.adminUser(id),
    queryFn: () => adminUsersApi.getUser(id),
    enabled: enabled && !!id,
  });

export const useAdminAgents = (q: AdminAgentListQuery, enabled = true) =>
  useQuery({
    queryKey: keys.adminAgents(q),
    queryFn: () => adminAgentsApi.getAgents(q),
    enabled,
  });

export const useAdminAgent = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.adminAgent(id),
    queryFn: () => adminAgentsApi.getAgent(id),
    enabled: enabled && !!id,
  });

export const useAdminApps = (
  q: AdminAgentApplicationListQuery,
  enabled = true,
) =>
  useQuery({
    queryKey: keys.adminApplications(q),
    queryFn: () => adminApplicationsApi.getApplications(q),
    enabled,
  });

export const useAdminApplication = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.adminApplication(id),
    queryFn: () => adminApplicationsApi.getApplication(id),
    enabled: enabled && !!id,
  });

export const useAdminApplicationDocuments = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.adminApplicationDocuments(id),
    queryFn: () => adminApplicationsApi.getApplicationDocuments(id),
    enabled: enabled && !!id,
  });

export const useAdminProperties = (q: AdminPropertyListQuery, enabled = true) =>
  useQuery({
    queryKey: keys.adminProperties(q),
    queryFn: () => adminPropertiesApi.getProperties(q),
    enabled,
  });

export const useAdminProperty = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.adminProperty(id),
    queryFn: () => adminPropertiesApi.getProperty(id),
    enabled: enabled && !!id,
  });

export const useAdminAudit = (q: AuditLogListQuery, enabled = true) =>
  useQuery({
    queryKey: keys.adminAuditLogs(q),
    queryFn: () => adminAuditApi.getAuditLogs(q),
    enabled,
  });
