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

export async function lockActiveAgent(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<AgentRow[]>`
    SELECT p.id,
           p."isActive" AS "isActive",
           u."isActive" AS "userActive",
           u.role::text AS role
    FROM agent_profiles p
    JOIN users u ON u.id = p."userId"
    WHERE p."userId" = ${userId}::uuid
    FOR UPDATE OF p
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
