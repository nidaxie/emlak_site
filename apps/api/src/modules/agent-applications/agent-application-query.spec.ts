import { BadRequestException } from '@nestjs/common';
import {
  AgentDocumentType,
  ApplicationStatus,
} from '../../generated/prisma/enums';
import {
  applicationListWhere,
  applicationSearchWhere,
  documentCompletion,
} from './agent-application-query';

describe('agent application admin query', () => {
  it('counts each required document type once and ignores deleted gaps', () => {
    expect(documentCompletion([])).toEqual({
      requiredCount: 2,
      completedCount: 0,
      isComplete: false,
      missingTypes: [
        AgentDocumentType.TAX_CERTIFICATE,
        AgentDocumentType.AUTHORIZATION_CERTIFICATE,
      ],
    });
    expect(
      documentCompletion([
        AgentDocumentType.TAX_CERTIFICATE,
        AgentDocumentType.TAX_CERTIFICATE,
      ]),
    ).toMatchObject({
      completedCount: 1,
      isComplete: false,
      missingTypes: [AgentDocumentType.AUTHORIZATION_CERTIFICATE],
    });
    expect(
      documentCompletion([
        AgentDocumentType.AUTHORIZATION_CERTIFICATE,
        AgentDocumentType.TAX_CERTIFICATE,
      ]).isComplete,
    ).toBe(true);
  });

  it('searches the firm, both emails, the tax number, and either name order', () => {
    const where = applicationSearchWhere('  İpek Yılmaz  ');

    expect(where?.OR).toEqual(
      expect.arrayContaining([
        { companyName: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { email: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { taxNumber: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { user: { email: { contains: 'İpek Yılmaz', mode: 'insensitive' } } },
        {
          user: {
            AND: [
              { firstName: { contains: 'İpek', mode: 'insensitive' } },
              { lastName: { contains: 'Yılmaz', mode: 'insensitive' } },
            ],
          },
        },
        {
          user: {
            AND: [
              { firstName: { contains: 'Yılmaz', mode: 'insensitive' } },
              { lastName: { contains: 'İpek', mode: 'insensitive' } },
            ],
          },
        },
      ]),
    );
    expect(applicationSearchWhere('   ')).toBeUndefined();
  });

  it('combines filters with AND and rejects a reversed created range', () => {
    expect(
      applicationListWhere({
        status: ApplicationStatus.PENDING,
        userId: '6d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b11',
        search: 'Ada',
        city: 'Konya',
        district: 'Selcuklu',
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
      }),
    ).toMatchObject({
      status: ApplicationStatus.PENDING,
      userId: '6d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b11',
      city: { equals: 'Konya', mode: 'insensitive' },
      district: { equals: 'Selcuklu', mode: 'insensitive' },
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.999Z'),
      },
    });

    expect(() =>
      applicationListWhere({
        createdFrom: '2026-02-02',
        createdTo: '2026-02-01',
      }),
    ).toThrow(BadRequestException);
  });
});
