import { ConflictException } from '@nestjs/common';
import {
  AgentDocumentType,
  ApplicationStatus,
} from '../../generated/prisma/enums';

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.PENDING],
  [ApplicationStatus.PENDING]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.REJECTED]: [ApplicationStatus.DRAFT],
  [ApplicationStatus.APPROVED]: [],
};

export const requiredAgentDocuments = [
  AgentDocumentType.TAX_CERTIFICATE,
  AgentDocumentType.AUTHORIZATION_CERTIFICATE,
] as const;

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
) {
  return transitions[from].includes(to);
}

export function assertApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  message: string,
) {
  if (!canTransitionApplication(from, to)) {
    throw new ConflictException(message);
  }
}

export function hasRequiredAgentDocuments(
  documentTypes: ReadonlySet<AgentDocumentType>,
) {
  return requiredAgentDocuments.every((documentType) =>
    documentTypes.has(documentType),
  );
}

// Newest row first. An open review wins over a draft, and either wins over history.
export function selectCurrentApplication<
  T extends { status: ApplicationStatus },
>(rowsNewestFirst: readonly T[]) {
  return (
    rowsNewestFirst.find((row) => row.status === ApplicationStatus.PENDING) ??
    rowsNewestFirst.find((row) => row.status === ApplicationStatus.DRAFT) ??
    rowsNewestFirst[0] ??
    null
  );
}
