import {
  AgentDocumentType,
  ApplicationStatus,
} from '../../generated/prisma/enums';
import {
  canTransitionApplication,
  hasRequiredAgentDocuments,
  selectCurrentApplication,
} from './application-lifecycle';

describe('agent application status', () => {
  it('supports draft, review, and a closed decision', () => {
    expect(Object.values(ApplicationStatus).sort()).toEqual([
      ApplicationStatus.APPROVED,
      ApplicationStatus.DRAFT,
      ApplicationStatus.PENDING,
      ApplicationStatus.REJECTED,
    ]);
  });

  it('allows only the application lifecycle transitions', () => {
    expect(
      canTransitionApplication(
        ApplicationStatus.DRAFT,
        ApplicationStatus.PENDING,
      ),
    ).toBe(true);
    expect(
      canTransitionApplication(
        ApplicationStatus.PENDING,
        ApplicationStatus.APPROVED,
      ),
    ).toBe(true);
    expect(
      canTransitionApplication(
        ApplicationStatus.PENDING,
        ApplicationStatus.REJECTED,
      ),
    ).toBe(true);
    expect(
      canTransitionApplication(
        ApplicationStatus.REJECTED,
        ApplicationStatus.DRAFT,
      ),
    ).toBe(true);
    expect(
      canTransitionApplication(
        ApplicationStatus.APPROVED,
        ApplicationStatus.DRAFT,
      ),
    ).toBe(false);
    expect(
      canTransitionApplication(
        ApplicationStatus.APPROVED,
        ApplicationStatus.PENDING,
      ),
    ).toBe(false);
    expect(
      canTransitionApplication(
        ApplicationStatus.DRAFT,
        ApplicationStatus.APPROVED,
      ),
    ).toBe(false);
    expect(
      canTransitionApplication(
        ApplicationStatus.REJECTED,
        ApplicationStatus.APPROVED,
      ),
    ).toBe(false);
    expect(
      canTransitionApplication(
        ApplicationStatus.REJECTED,
        ApplicationStatus.PENDING,
      ),
    ).toBe(false);
  });

  it('picks the open application before older history', () => {
    const rows = [
      { id: 'new-rejected', status: ApplicationStatus.REJECTED },
      { id: 'pending', status: ApplicationStatus.PENDING },
      { id: 'draft', status: ApplicationStatus.DRAFT },
      { id: 'old-approved', status: ApplicationStatus.APPROVED },
    ];

    expect(selectCurrentApplication(rows)?.id).toBe('pending');
    expect(
      selectCurrentApplication(rows.filter((row) => row.id !== 'pending'))?.id,
    ).toBe('draft');
    expect(selectCurrentApplication([rows[0], rows[3]])?.id).toBe(
      'new-rejected',
    );
    expect(selectCurrentApplication([])).toBeNull();
  });

  it('requires both agent documents before review', () => {
    expect(
      hasRequiredAgentDocuments(
        new Set([
          AgentDocumentType.TAX_CERTIFICATE,
          AgentDocumentType.AUTHORIZATION_CERTIFICATE,
        ]),
      ),
    ).toBe(true);
    expect(
      hasRequiredAgentDocuments(new Set([AgentDocumentType.TAX_CERTIFICATE])),
    ).toBe(false);
  });
});
