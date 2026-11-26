import { BadRequestException } from '@nestjs/common';
import { PropertyStatus } from '../../generated/prisma/enums';
import {
  agentListWhere,
  agentSearchWhere,
  cityChartLimit,
  listingCountsFromGroups,
  portfoliosByProfile,
  presentCityDistribution,
  presentProfileAccounts,
} from './admin-agent-query';

describe('admin agent query', () => {
  it('searches the firm, both emails, tax number, phones, and either name order', () => {
    const where = agentSearchWhere('  İpek Yılmaz  ');

    expect(where?.OR).toEqual(
      expect.arrayContaining([
        { companyName: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { email: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { taxNumber: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { phone: { contains: 'İpek Yılmaz', mode: 'insensitive' } },
        { user: { email: { contains: 'İpek Yılmaz', mode: 'insensitive' } } },
        { user: { phone: { contains: 'İpek Yılmaz', mode: 'insensitive' } } },
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
    expect(agentSearchWhere('   ')).toBeUndefined();
  });

  it('splits multi-word names across boundaries with a bounded OR list and normalizes whitespace', () => {
    const threeWords = agentSearchWhere('  Ali   Can   Yılmaz  ');

    expect(threeWords?.OR).toEqual(
      expect.arrayContaining([
        { companyName: { contains: 'Ali Can Yılmaz', mode: 'insensitive' } },
        {
          user: {
            AND: [
              { firstName: { contains: 'Ali Can', mode: 'insensitive' } },
              { lastName: { contains: 'Yılmaz', mode: 'insensitive' } },
            ],
          },
        },
        {
          user: {
            AND: [
              { firstName: { contains: 'Yılmaz', mode: 'insensitive' } },
              { lastName: { contains: 'Ali Can', mode: 'insensitive' } },
            ],
          },
        },
        {
          user: {
            AND: [
              { firstName: { contains: 'Ali', mode: 'insensitive' } },
              { lastName: { contains: 'Can Yılmaz', mode: 'insensitive' } },
            ],
          },
        },
        {
          user: {
            AND: [
              { firstName: { contains: 'Can Yılmaz', mode: 'insensitive' } },
              { lastName: { contains: 'Ali', mode: 'insensitive' } },
            ],
          },
        },
      ]),
    );

    const single = agentSearchWhere('Ali');
    const manyWords = agentSearchWhere('Bir Iki Uc Dort Bes Alti Yedi');

    expect(single?.OR).toHaveLength(8);
    expect(manyWords?.OR).toHaveLength(16);
  });

  it('combines filters with AND and rejects a reversed created range', () => {
    expect(
      agentListWhere({
        isActive: 'true',
        userIsActive: 'false',
        userId: '6d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b11',
        search: 'Ada',
        companyName: 'Yuva',
        city: 'Konya',
        district: 'Selcuklu',
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
      }),
    ).toMatchObject({
      isActive: true,
      user: { isActive: false },
      userId: '6d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b11',
      companyName: { contains: 'Yuva', mode: 'insensitive' },
      city: { contains: 'Konya', mode: 'insensitive' },
      district: { contains: 'Selcuklu', mode: 'insensitive' },
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.999Z'),
      },
    });

    expect(() =>
      agentListWhere({
        createdFrom: '2026-02-02',
        createdTo: '2026-02-01',
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps portfolio totals separate from publicly visible counts', () => {
    const counts = listingCountsFromGroups(
      [
        { status: PropertyStatus.ACTIVE, count: 7 },
        { status: PropertyStatus.INACTIVE, count: 1 },
        { status: PropertyStatus.SOLD, count: 1 },
        { status: PropertyStatus.RENTED, count: 1 },
      ],
      0,
    );

    expect(counts).toEqual({
      total: 10,
      active: 7,
      inactive: 1,
      sold: 1,
      rented: 1,
      publiclyVisible: 0,
    });
  });

  it('assigns grouped listing rows to the owning profile only', () => {
    const first = '6d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b11';
    const second = '7d0b0d4e-2d8a-4c3e-9b1a-0a6c2e5f7b22';
    const portfolios = portfoliosByProfile(
      [
        {
          agentProfileId: first,
          status: PropertyStatus.ACTIVE,
          count: 2,
        },
        {
          agentProfileId: second,
          status: PropertyStatus.SOLD,
          count: 1,
        },
        {
          agentProfileId: null,
          status: PropertyStatus.ACTIVE,
          count: 4,
        },
      ],
      [{ agentProfileId: first, count: 1 }],
    );

    expect(portfolios.get(first)).toEqual({
      total: 2,
      active: 2,
      inactive: 0,
      sold: 0,
      rented: 0,
      publiclyVisible: 1,
    });
    expect(portfolios.get(second)?.total).toBe(1);
    expect(portfolios.get(second)?.publiclyVisible).toBe(0);
    expect(portfolios.size).toBe(2);
  });

  it('keeps the four profile and account combinations exhaustive', () => {
    const counts = presentProfileAccounts([
      { profileActive: true, userActive: true, count: 4 },
      { profileActive: true, userActive: false, count: 1 },
      { profileActive: false, userActive: true, count: 2 },
      { profileActive: false, userActive: false, count: 3 },
    ]);

    expect(counts.total).toBe(10);
    expect(counts.active + counts.suspended).toBe(counts.total);
    expect(
      counts.accountStatuses.active + counts.accountStatuses.inactive,
    ).toBe(counts.total);
    expect(counts.publiclyVisible).toBe(4);
    expect(
      counts.profileAccounts.activeProfileActiveAccount +
        counts.profileAccounts.activeProfileInactiveAccount +
        counts.profileAccounts.suspendedProfileActiveAccount +
        counts.profileAccounts.suspendedProfileInactiveAccount,
    ).toBe(counts.total);
  });

  it('keeps blank city names out of named bars and reports the remainder', () => {
    const rows = [
      { city: '   ', count: 2 },
      { city: '', count: 1 },
      ...Array.from({ length: cityChartLimit + 2 }, (_, index) => ({
        city: `Sehir ${String(index).padStart(2, '0')}`,
        count: cityChartLimit + 2 - index,
      })),
    ];
    const cities = presentCityDistribution(rows);
    const shown = cities.items.reduce((sum, item) => sum + item.count, 0);

    expect(cities.blankCount).toBe(3);
    expect(cities.items).toHaveLength(cityChartLimit);
    expect(cities.items.some((item) => item.city.trim().length === 0)).toBe(
      false,
    );
    expect(cities.distinctCount).toBe(cityChartLimit + 2);
    expect(shown + cities.otherCount + cities.blankCount).toBe(
      rows.reduce((sum, row) => sum + row.count, 0),
    );
    expect(cities.items[0]?.city).toBe('Sehir 00');
  });
});
