import { Role } from '../../generated/prisma/enums';
import {
  createdAtFilter,
  parseCreatedBound,
  registrationPoints,
  userSearchWhere,
  wouldRemoveLastAdmin,
} from './admin-user-query';

describe('admin user query', () => {
  it('parses an inclusive UTC day and a zoned instant', () => {
    expect(parseCreatedBound('2026-11-25', 'start')?.toISOString()).toBe(
      '2026-11-25T00:00:00.000Z',
    );
    expect(parseCreatedBound('2026-11-25', 'end')?.toISOString()).toBe(
      '2026-11-25T23:59:59.999Z',
    );
    expect(
      parseCreatedBound(
        '2026-11-25T00:00:00.000+03:00',
        'start',
      )?.toISOString(),
    ).toBe('2026-11-24T21:00:00.000Z');
    expect(parseCreatedBound('2026-02-31', 'start')).toBeNull();
    expect(parseCreatedBound('2026-11-25T00:00:00', 'start')).toBeNull();
  });

  it('builds an inclusive createdAt range', () => {
    expect(createdAtFilter('2026-01-02', '2026-01-02')).toEqual({
      gte: new Date('2026-01-02T00:00:00.000Z'),
      lte: new Date('2026-01-02T23:59:59.999Z'),
    });
  });

  it('searches email, names, and a two-part name in either order', () => {
    expect(userSearchWhere('  Ada Yilmaz  ')).toEqual({
      OR: [
        { email: { contains: 'Ada Yilmaz', mode: 'insensitive' } },
        { firstName: { contains: 'Ada Yilmaz', mode: 'insensitive' } },
        { lastName: { contains: 'Ada Yilmaz', mode: 'insensitive' } },
        {
          AND: [
            { firstName: { contains: 'Ada', mode: 'insensitive' } },
            { lastName: { contains: 'Yilmaz', mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { contains: 'Yilmaz', mode: 'insensitive' } },
            { lastName: { contains: 'Ada', mode: 'insensitive' } },
          ],
        },
      ],
    });
    expect(userSearchWhere('   ')).toBeUndefined();
  });

  it('protects the last active admin only when an active admin would be removed', () => {
    expect(
      wouldRemoveLastAdmin({
        targetRole: Role.ADMIN,
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 1,
      }),
    ).toBe(true);
    expect(
      wouldRemoveLastAdmin({
        targetRole: Role.ADMIN,
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 2,
      }),
    ).toBe(false);
    expect(
      wouldRemoveLastAdmin({
        targetRole: Role.USER,
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 1,
      }),
    ).toBe(false);
    expect(
      wouldRemoveLastAdmin({
        targetRole: Role.ADMIN,
        targetIsActive: false,
        nextIsActive: false,
        activeAdminCount: 1,
      }),
    ).toBe(false);
  });

  it('fills empty registration buckets and rejects an oversized span', () => {
    expect(
      registrationPoints(
        new Date('2018-02-02T15:00:00.000Z'),
        new Date('2018-02-04T23:59:59.999Z'),
        'day',
        [{ bucket: '2018-02-02T00:00:00Z', count: 2 }],
      ),
    ).toEqual([
      { bucketStart: '2018-02-02T00:00:00.000Z', count: 2 },
      { bucketStart: '2018-02-03T00:00:00.000Z', count: 0 },
      { bucketStart: '2018-02-04T00:00:00.000Z', count: 0 },
    ]);
    expect(
      registrationPoints(
        new Date('2018-01-15T00:00:00.000Z'),
        new Date('2018-03-02T00:00:00.000Z'),
        'month',
        [{ bucket: '2018-02-01T00:00:00Z', count: 4 }],
      )?.map((point) => point.bucketStart),
    ).toEqual([
      '2018-01-01T00:00:00.000Z',
      '2018-02-01T00:00:00.000Z',
      '2018-03-01T00:00:00.000Z',
    ]);
    expect(
      registrationPoints(
        new Date('2010-01-01T00:00:00.000Z'),
        new Date('2012-01-02T00:00:00.000Z'),
        'day',
        [],
      ),
    ).toBeNull();
  });
});
