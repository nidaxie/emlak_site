import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PropertySellerType, Role } from '../../generated/prisma/enums';

type AgentRow = {
  id: string;
  isActive: boolean;
  userActive: boolean;
  role: string;
};

type OwnedProperty = {
  sellerType: string;
  agentProfileId: string | null;
  deletedAt: Date | null;
};

export async function lockAgentProfile(
  tx: Prisma.TransactionClient,
  profileId: string,
) {
  const rows = await tx.$queryRaw<
    Array<{ id: string; isActive: boolean; userId: string }>
  >`
    SELECT id, "isActive" AS "isActive", "userId" AS "userId"
    FROM agent_profiles
    WHERE id = ${profileId}::uuid
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

export async function lockActiveAgent(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const users = await tx.$queryRaw<
    Array<{ id: string; userActive: boolean; role: string }>
  >`
    SELECT id, "isActive" AS "userActive", role::text AS role
    FROM users
    WHERE id = ${userId}::uuid
    FOR SHARE
  `;
  const user = users[0];

  if (!user || user.role !== Role.AGENT) {
    throw new ForbiddenException('Agent profile not found');
  }

  if (!user.userActive) {
    throw new UnauthorizedException('Unauthorized');
  }

  const rows = await tx.$queryRaw<AgentRow[]>`
    SELECT p.id,
           p."isActive" AS "isActive",
           ${user.userActive}::boolean AS "userActive",
           ${user.role}::text AS role
    FROM agent_profiles p
    WHERE p."userId" = ${userId}::uuid
    FOR UPDATE
  `;

  return assertProfessionalAgent(rows[0]);
}

export function assertProfessionalAgent(row: AgentRow | undefined) {
  if (!row || row.role !== Role.AGENT) {
    throw new ForbiddenException('Agent profile not found');
  }

  if (!row.userActive) {
    throw new UnauthorizedException('Unauthorized');
  }

  if (!row.isActive) {
    throw new ForbiddenException('Agent profile is inactive');
  }

  return row.id;
}

export function assertOwnedAgentProperty<T extends OwnedProperty>(
  row: T | null,
  profileId: string,
) {
  if (
    !row ||
    row.deletedAt !== null ||
    row.sellerType !== PropertySellerType.AGENT ||
    row.agentProfileId !== profileId
  ) {
    throw new NotFoundException('Property not found');
  }

  return row;
}
