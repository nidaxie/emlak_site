import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  ListingType,
  PropertyStatus,
  PropertyType,
} from '../../generated/prisma/enums';
import { createdAtFilter, parseCreatedBound } from '../users/admin-user-query';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';

const contains = (value: string) => ({
  contains: value,
  mode: 'insensitive' as const,
});

export interface AgentListingCounts {
  total: number;
  active: number;
  inactive: number;
  sold: number;
  rented: number;
  publiclyVisible: number;
}

export interface AgentListingDistribution extends AgentListingCounts {
  listingTypes: Record<ListingType, number>;
  propertyTypes: Record<PropertyType, number>;
}

export function emptyListingCounts(): AgentListingCounts {
  return {
    total: 0,
    active: 0,
    inactive: 0,
    sold: 0,
    rented: 0,
    publiclyVisible: 0,
  };
}

export function listingCountsFromGroups(
  groups: Array<{ status: PropertyStatus; count: number }>,
  publiclyVisible: number,
): AgentListingCounts {
  const countOf = (status: PropertyStatus) =>
    groups.find((row) => row.status === status)?.count ?? 0;
  const active = countOf(PropertyStatus.ACTIVE);
  const inactive = countOf(PropertyStatus.INACTIVE);
  const sold = countOf(PropertyStatus.SOLD);
  const rented = countOf(PropertyStatus.RENTED);

  return {
    total: active + inactive + sold + rented,
    active,
    inactive,
    sold,
    rented,
    publiclyVisible,
  };
}

export function emptyListingDistribution(): AgentListingDistribution {
  return {
    ...emptyListingCounts(),
    listingTypes: { SALE: 0, RENT: 0 },
    propertyTypes: {
      APARTMENT: 0,
      HOUSE: 0,
      VILLA: 0,
      LAND: 0,
      WORKPLACE: 0,
    },
  };
}

export function applyListingBreakdown(
  summary: AgentListingDistribution,
  listingTypes: Array<{ listingType: ListingType; count: number }>,
  propertyTypes: Array<{ propertyType: PropertyType; count: number }>,
) {
  for (const row of listingTypes) {
    summary.listingTypes[row.listingType] = row.count;
  }

  for (const row of propertyTypes) {
    summary.propertyTypes[row.propertyType] = row.count;
  }

  return summary;
}

export function portfoliosByProfile(
  statusRows: Array<{
    agentProfileId: string | null;
    status: PropertyStatus;
    count: number;
  }>,
  publicRows: Array<{ agentProfileId: string | null; count: number }>,
) {
  const portfolios = new Map<string, AgentListingCounts>();
  const bucket = (profileId: string) => {
    const current = portfolios.get(profileId);

    if (current) {
      return current;
    }

    const created = emptyListingCounts();
    portfolios.set(profileId, created);

    return created;
  };

  for (const row of statusRows) {
    if (!row.agentProfileId) {
      continue;
    }

    const counts = bucket(row.agentProfileId);

    if (row.status === PropertyStatus.ACTIVE) {
      counts.active += row.count;
    } else if (row.status === PropertyStatus.INACTIVE) {
      counts.inactive += row.count;
    } else if (row.status === PropertyStatus.SOLD) {
      counts.sold += row.count;
    } else if (row.status === PropertyStatus.RENTED) {
      counts.rented += row.count;
    }

    counts.total =
      counts.active + counts.inactive + counts.sold + counts.rented;
  }

  for (const row of publicRows) {
    if (!row.agentProfileId) {
      continue;
    }

    bucket(row.agentProfileId).publiclyVisible = row.count;
  }

  return portfolios;
}

export interface ProfileAccountCounts {
  total: number;
  active: number;
  suspended: number;
  publiclyVisible: number;
  accountStatuses: { active: number; inactive: number };
  profileAccounts: {
    activeProfileActiveAccount: number;
    activeProfileInactiveAccount: number;
    suspendedProfileActiveAccount: number;
    suspendedProfileInactiveAccount: number;
  };
}

export function presentProfileAccounts(
  rows: Array<{
    profileActive: boolean;
    userActive: boolean;
    count: number;
  }>,
): ProfileAccountCounts {
  const countOf = (profileActive: boolean, userActive: boolean) =>
    rows.find(
      (row) =>
        row.profileActive === profileActive && row.userActive === userActive,
    )?.count ?? 0;
  const activeProfileActiveAccount = countOf(true, true);
  const activeProfileInactiveAccount = countOf(true, false);
  const suspendedProfileActiveAccount = countOf(false, true);
  const suspendedProfileInactiveAccount = countOf(false, false);
  const active = activeProfileActiveAccount + activeProfileInactiveAccount;
  const suspended =
    suspendedProfileActiveAccount + suspendedProfileInactiveAccount;

  return {
    total: active + suspended,
    active,
    suspended,
    publiclyVisible: activeProfileActiveAccount,
    accountStatuses: {
      active: activeProfileActiveAccount + suspendedProfileActiveAccount,
      inactive: activeProfileInactiveAccount + suspendedProfileInactiveAccount,
    },
    profileAccounts: {
      activeProfileActiveAccount,
      activeProfileInactiveAccount,
      suspendedProfileActiveAccount,
      suspendedProfileInactiveAccount,
    },
  };
}

export const cityChartLimit = 10;

export function presentCityDistribution(
  rows: Array<{ city: string; count: number }>,
) {
  let blankCount = 0;
  const named: Array<{ city: string; count: number }> = [];

  for (const row of rows) {
    if (row.city.trim().length === 0) {
      blankCount += row.count;
      continue;
    }

    named.push({ city: row.city, count: row.count });
  }

  named.sort(
    (left, right) =>
      right.count - left.count || left.city.localeCompare(right.city, 'tr'),
  );
  const items = named.slice(0, cityChartLimit);
  const otherCount = named
    .slice(cityChartLimit)
    .reduce((sum, row) => sum + row.count, 0);

  return {
    basis: 'stored-city-name' as const,
    items,
    otherCount,
    blankCount,
    distinctCount: named.length,
  };
}

export function agentSearchWhere(
  raw: string | undefined,
): Prisma.AgentProfileWhereInput | undefined {
  const term = raw?.trim();

  if (!term) {
    return undefined;
  }

  const parts = term.split(/\s+/).filter((part) => part.length > 0);
  const normalized = parts.join(' ');
  const or: Prisma.AgentProfileWhereInput[] = [
    { companyName: contains(normalized) },
    { email: contains(normalized) },
    { taxNumber: contains(normalized) },
    { phone: contains(normalized) },
    { user: { email: contains(normalized) } },
    { user: { phone: contains(normalized) } },
    { user: { firstName: contains(normalized) } },
    { user: { lastName: contains(normalized) } },
  ];

  if (parts.length >= 2) {
    const splitLimit = Math.min(parts.length, 5);

    for (let index = 1; index < splitLimit; index += 1) {
      const first = parts.slice(0, index).join(' ');
      const rest = parts.slice(index).join(' ');

      or.push({
        user: {
          AND: [{ firstName: contains(first) }, { lastName: contains(rest) }],
        },
      });
      or.push({
        user: {
          AND: [{ firstName: contains(rest) }, { lastName: contains(first) }],
        },
      });
    }
  }

  return { OR: or };
}

export function agentListWhere(
  query: ListAgentsQueryDto,
): Prisma.AgentProfileWhereInput {
  const createdFrom = query.createdFrom
    ? parseCreatedBound(query.createdFrom, 'start')
    : null;
  const createdTo = query.createdTo
    ? parseCreatedBound(query.createdTo, 'end')
    : null;

  if ((query.createdFrom && !createdFrom) || (query.createdTo && !createdTo)) {
    throw new BadRequestException('Invalid date');
  }

  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new BadRequestException('createdFrom must not be after createdTo');
  }

  const createdAt = createdAtFilter(query.createdFrom, query.createdTo);
  const search = agentSearchWhere(query.search);
  const companyName = query.companyName?.trim();
  const city = query.city?.trim();
  const district = query.district?.trim();

  return {
    ...(query.isActive === undefined
      ? {}
      : { isActive: query.isActive === 'true' }),
    ...(query.userIsActive === undefined
      ? {}
      : { user: { isActive: query.userIsActive === 'true' } }),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(companyName ? { companyName: contains(companyName) } : {}),
    ...(city ? { city: contains(city) } : {}),
    ...(district ? { district: contains(district) } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ?? {}),
  };
}
