import { isMockDataEnabled } from '@/lib/data-mode';
import {
  getMockAgent,
  getMockDistricts,
  getMockNeighborhoods,
  getMockProperty,
  listMockAgentProperties,
  listMockProperties,
  mockCities,
} from '@/mocks/marketplace-data';
import { agentsApi, locationsApi, propertiesApi } from '@/services/api';
import type {
  AgentPropertyListQuery,
  PublicPropertyListQuery,
} from '@/types/api';

/** Read-only public discovery facade. Mutations and account APIs stay real. */
export const publicMarketplaceData = {
  async properties(query: PublicPropertyListQuery) {
    if (isMockDataEnabled) return listMockProperties(query);
    return propertiesApi.list(query);
  },

  async property(id: string) {
    if (isMockDataEnabled) {
      const property = getMockProperty(id);
      if (!property) throw new Error('Demo ilanı bulunamadı.');
      return property;
    }
    return propertiesApi.detail(id);
  },

  async cities() {
    if (isMockDataEnabled) return [...mockCities];
    return locationsApi.cities();
  },

  async districts(cityId: string) {
    if (isMockDataEnabled) return getMockDistricts(cityId);
    return locationsApi.districts(cityId);
  },

  async neighborhoods(districtId: string) {
    if (isMockDataEnabled) return getMockNeighborhoods(districtId);
    return locationsApi.neighborhoods(districtId);
  },

  async agent(slug: string) {
    if (isMockDataEnabled) {
      const agent = getMockAgent(slug);
      if (!agent) throw new Error('Demo emlakçı profili bulunamadı.');
      return agent;
    }
    return agentsApi.public(slug);
  },

  async agentProperties(slug: string, query: AgentPropertyListQuery) {
    if (isMockDataEnabled) return listMockAgentProperties(slug, query);
    return agentsApi.properties(slug, query);
  },
};
