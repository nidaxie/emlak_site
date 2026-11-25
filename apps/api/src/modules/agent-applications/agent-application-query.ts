import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AgentDocumentType } from '../../generated/prisma/enums';
import { createdAtFilter, parseCreatedBound } from '../users/admin-user-query';
import {
  hasRequiredAgentDocuments,
  requiredAgentDocuments,
} from './application-lifecycle';
import { ListAgentApplicationsQueryDto } from './dto/list-agent-applications-query.dto';

export interface DocumentCompletion {
  requiredCount: number;
  completedCount: number;
  isComplete: boolean;
  missingTypes: AgentDocumentType[];
}

export function documentCompletion(
  presentTypes: readonly AgentDocumentType[],
): DocumentCompletion {
  const present = new Set(presentTypes);
  const missingTypes = requiredAgentDocuments.filter(
    (documentType) => !present.has(documentType),
  );

  return {
    requiredCount: requiredAgentDocuments.length,
    completedCount: requiredAgentDocuments.length - missingTypes.length,
    isComplete: hasRequiredAgentDocuments(present),
    missingTypes: [...missingTypes],
  };
}

export function applicationSearchWhere(
  raw: string | undefined,
): Prisma.AgentApplicationWhereInput | undefined {
  const term = raw?.trim();

  if (!term) {
    return undefined;
  }

  const contains = (value: string) => ({
    contains: value,
    mode: 'insensitive' as const,
  });
  const or: Prisma.AgentApplicationWhereInput[] = [
    { companyName: contains(term) },
    { email: contains(term) },
    { taxNumber: contains(term) },
    { user: { email: contains(term) } },
    { user: { firstName: contains(term) } },
    { user: { lastName: contains(term) } },
  ];
  const parts = term.split(/\s+/).filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(' ');

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

  return { OR: or };
}

export function applicationListWhere(
  query: ListAgentApplicationsQueryDto,
): Prisma.AgentApplicationWhereInput {
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
  const search = applicationSearchWhere(query.search);
  const city = query.city?.trim();
  const district = query.district?.trim();

  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
    ...(district
      ? { district: { equals: district, mode: 'insensitive' } }
      : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ?? {}),
  };
}
