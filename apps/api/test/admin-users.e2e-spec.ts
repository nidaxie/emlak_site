import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { PropertyStatus, Role } from '../src/generated/prisma/enums';
import { AuditService } from '../src/modules/audit/audit.service';

const password = 'password123';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe('Admin users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;
  let sequence = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    origin = app
      .get(ConfigService)
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')[0]
      .trim();
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'faz321-' } },
        select: { id: true },
      });
      const ids = users.map((user) => user.id);

      if (ids.length > 0) {
        await prisma.property.deleteMany({
          where: {
            OR: [
              { ownerUserId: { in: ids } },
              { agentProfile: { userId: { in: ids } } },
            ],
          },
        });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }

      const cities = await prisma.city.findMany({
        where: { name: { startsWith: 'Faz321' } },
        select: { id: true },
      });
      const cityIds = cities.map((city) => city.id);

      if (cityIds.length > 0) {
        const districts = await prisma.district.findMany({
          where: { cityId: { in: cityIds } },
          select: { id: true },
        });
        const districtIds = districts.map((district) => district.id);

        if (districtIds.length > 0) {
          await prisma.neighborhood.deleteMany({
            where: { districtId: { in: districtIds } },
          });
          await prisma.district.deleteMany({
            where: { id: { in: districtIds } },
          });
        }

        await prisma.city.deleteMany({ where: { id: { in: cityIds } } });
      }
    }

    await app?.close();
  });

  function nextEmail() {
    sequence += 1;
    return `faz321-${Date.now()}-${sequence}@example.com`;
  }

  function http() {
    return request(app.getHttpServer());
  }

  function responseData(response: Response) {
    const body: unknown = response.body;

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return {};
    }

    return body as Record<string, unknown>;
  }

  function nested(value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  function text(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  function listItems(response: Response) {
    const items = responseData(response).items;

    return Array.isArray(items)
      ? items.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null,
        )
      : [];
  }

  function cookieFrom(response: Response) {
    const raw: unknown = response.headers['set-cookie'];
    const lines = Array.isArray(raw)
      ? raw.filter((line): line is string => typeof line === 'string')
      : typeof raw === 'string'
        ? [raw]
        : [];

    return lines.map((line) => line.split(';')[0]).join('; ');
  }

  async function createAccount(
    role: Role = Role.USER,
    extra: Record<string, unknown> = {},
  ) {
    const email = nextEmail();
    const registered = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, ...extra });
    expect(registered.status).toBe(201);

    if (role !== Role.USER) {
      await prisma.user.update({ where: { email }, data: { role } });
    }

    const loggedIn = await http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email, password });
    expect(loggedIn.status).toBe(200);
    const body = responseData(loggedIn);

    return {
      email,
      token: text(body.accessToken),
      userId: text(nested(body.user).id),
      cookie: cookieFrom(loggedIn),
    };
  }

  async function ensurePlace(cityName: string) {
    const city = await prisma.city.upsert({
      where: { name: cityName },
      update: {},
      create: { name: cityName },
    });
    const district = await prisma.district.upsert({
      where: { cityId_name: { cityId: city.id, name: 'Selcuklu' } },
      update: {},
      create: { cityId: city.id, name: 'Selcuklu' },
    });
    const neighborhood = await prisma.neighborhood.upsert({
      where: { districtId_name: { districtId: district.id, name: 'Yazir' } },
      update: {},
      create: { districtId: district.id, name: 'Yazir' },
    });

    return {
      cityId: city.id,
      districtId: district.id,
      neighborhoodId: neighborhood.id,
    };
  }

  function propertyBody(place: {
    cityId: string;
    districtId: string;
    neighborhoodId: string;
  }) {
    return {
      title: 'Faz321 ilan',
      description: 'Yonetim sayaci icin gecici ilan.',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      price: '100000.00',
      grossAreaM2: '90.00',
      netAreaM2: '80.00',
      rooms: 2,
      livingRooms: 1,
      buildingAge: 4,
      floor: 2,
      totalFloors: 5,
      heatingType: 'COMBI',
      address: 'Test adresi',
      latitude: '37.870000',
      longitude: '32.490000',
      ...place,
    };
  }

  async function postIndividual(token: string, cityName: string) {
    const place = await ensurePlace(cityName);

    return http()
      .post('/api/v1/user-properties')
      .set('Authorization', `Bearer ${token}`)
      .send(propertyBody(place));
  }

  it('searches names and email, filters, and pages in a stable order', async () => {
    const admin = await createAccount(Role.ADMIN);
    const ada = await createAccount(Role.USER, {
      firstName: 'Faz321Ada',
      lastName: 'Faz321Yilmaz',
    });
    const ipek = await createAccount(Role.USER, {
      firstName: 'İpek',
      lastName: 'Faz321Demir',
    });
    const agent = await createAccount(Role.AGENT, {
      firstName: 'Faz321Ada',
      lastName: 'Faz321Kaya',
    });
    await prisma.user.update({
      where: { id: ada.userId },
      data: {
        createdAt: new Date('2020-01-15T12:00:00.000Z'),
        isActive: false,
      },
    });
    await prisma.user.update({
      where: { id: ipek.userId },
      data: { createdAt: new Date('2020-02-01T00:00:00.000Z') },
    });
    const sameDay = new Date('2020-03-01T08:00:00.000Z');
    const third = await createAccount(Role.USER, {
      firstName: 'Cem',
      lastName: 'Faz321Order',
    });
    const fourth = await createAccount(Role.USER, {
      firstName: 'Deniz',
      lastName: 'Faz321Order',
    });
    await prisma.user.updateMany({
      where: { id: { in: [agent.userId, third.userId, fourth.userId] } },
      data: { createdAt: sameDay },
    });
    const auth = { Authorization: `Bearer ${admin.token}` };
    const byEmail = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: ada.email });
    const byFirst = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Ada' });
    const byLast = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Yilmaz' });
    const byFull = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Ada Faz321Yilmaz' });
    const byReversed = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Yilmaz Faz321Ada' });
    const byTurkish = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'İpek' });
    const byTurkishFold = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'ipek' });
    const combined = await http().get('/api/v1/admin/users').set(auth).query({
      email: 'Faz321Ada',
      role: 'USER',
      isActive: 'false',
      createdFrom: '2020-01-15',
      createdTo: '2020-01-15',
    });
    const ordered = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Order', limit: 1, page: 1 });
    const orderedNext = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: 'Faz321Order', limit: 1, page: 2 });
    const invalidDay = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ createdFrom: '2020-02-31' });
    const reversedRange = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ createdFrom: '2020-03-02', createdTo: '2020-03-01' });
    const badPage = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ page: 0 });
    const badLimit = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ limit: 101 });
    const ids = (response: Response) =>
      listItems(response).map((item) => item.id);
    const expectedOrder = await prisma.user.findMany({
      where: { id: { in: [third.userId, fourth.userId] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });

    expect(byEmail.status).toBe(200);
    expect(ids(byEmail)).toEqual([ada.userId]);
    expect(responseData(byEmail).total).toBe(1);
    expect(ids(byFirst)).toEqual(
      expect.arrayContaining([ada.userId, agent.userId]),
    );
    expect(ids(byLast)).toContain(ada.userId);
    expect(ids(byFull)).toEqual([ada.userId]);
    expect(ids(byReversed)).toEqual([ada.userId]);
    expect(ids(byTurkish)).toContain(ipek.userId);
    expect(ids(byTurkishFold)).toContain(ipek.userId);
    expect(ids(combined)).toEqual([ada.userId]);
    expect(responseData(combined).total).toBe(1);
    expect(listItems(byEmail)[0]).toMatchObject({
      individualListingCount: 0,
      agentListingCount: 0,
      agentProfile: null,
    });
    expect(JSON.stringify(listItems(byEmail)[0])).not.toContain('passwordHash');
    expect(ids(ordered).concat(ids(orderedNext))).toEqual(
      expectedOrder.map((user) => user.id),
    );
    expect(responseData(ordered).total).toBe(2);
    expect(invalidDay.status).toBe(400);
    expect(reversedRange.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(badLimit.status).toBe(400);
  });

  it('counts stored listings separately from deleted and public rows', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.USER, {
      firstName: 'Sayac',
      lastName: 'Bireysel',
    });
    const agentAccount = await createAccount(Role.AGENT);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: agentAccount.userId,
        slug: `faz321-${agentAccount.userId}`,
        companyName: 'Faz321 Emlak',
        phone: '+905551110000',
        email: agentAccount.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Ofis',
      },
    });
    const city = `Faz321-${owner.userId.slice(0, 8)}`;
    const active = await postIndividual(owner.token, city);
    const inactive = await postIndividual(owner.token, city);
    const sold = await postIndividual(owner.token, city);
    const rented = await postIndividual(owner.token, city);
    const removed = await postIndividual(owner.token, city);
    const agentListing = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${agentAccount.token}`)
      .send(propertyBody(await ensurePlace(city)));

    expect(active.status).toBe(201);
    expect(inactive.status).toBe(201);
    expect(sold.status).toBe(201);
    expect(rented.status).toBe(201);
    expect(removed.status).toBe(201);
    expect(agentListing.status).toBe(201);

    const inactiveId = text(responseData(inactive).id);
    const soldId = text(responseData(sold).id);
    const rentedId = text(responseData(rented).id);
    const removedId = text(responseData(removed).id);
    await http()
      .patch(`/api/v1/user-properties/${inactiveId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'INACTIVE' });
    await prisma.property.update({
      where: { id: soldId },
      data: { status: PropertyStatus.SOLD },
    });
    await prisma.property.update({
      where: { id: rentedId },
      data: { status: PropertyStatus.RENTED },
    });
    await http()
      .delete(`/api/v1/user-properties/${removedId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const agentWasUser = await prisma.user.update({
      where: { id: agentAccount.userId },
      data: { role: Role.USER },
    });
    const pastIndividual = await postIndividual(agentAccount.token, city);
    await prisma.user.update({
      where: { id: agentWasUser.id },
      data: { role: Role.AGENT },
    });
    const deletedAgent = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${agentAccount.token}`)
      .send(propertyBody(await ensurePlace(city)));
    await prisma.property.update({
      where: { id: text(responseData(deletedAgent).id) },
      data: { deletedAt: new Date() },
    });

    const listed = await http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ email: owner.email });
    const detail = await http()
      .get(`/api/v1/admin/users/${owner.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const agentDetail = await http()
      .get(`/api/v1/admin/users/${agentAccount.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const empty = await http()
      .get(`/api/v1/admin/users/${admin.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const ownerProperties = await http()
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ ownerUserId: owner.userId, deleted: 'false', limit: 100 });
    const agentProperties = await http()
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        agentUserId: agentAccount.userId,
        deleted: 'false',
        limit: 100,
      });

    expect(pastIndividual.status).toBe(201);
    expect(deletedAgent.status).toBe(201);
    expect(listItems(listed)[0]).toMatchObject({
      individualListingCount: 4,
      agentListingCount: 0,
      agentProfile: null,
    });
    expect(nested(responseData(detail).individualListings)).toEqual({
      total: 4,
      active: 1,
      inactive: 1,
      sold: 1,
      rented: 1,
      publiclyVisible: 1,
    });
    expect(responseData(detail).agentListings).toBeNull();
    expect(nested(responseData(agentDetail).individualListings).total).toBe(1);
    expect(nested(responseData(agentDetail).agentListings)).toMatchObject({
      total: 1,
      active: 1,
      publiclyVisible: 1,
    });
    expect(nested(responseData(agentDetail).agentProfile)).toMatchObject({
      id: profile.id,
      companyName: 'Faz321 Emlak',
      isActive: true,
      slug: profile.slug,
    });
    expect(nested(responseData(empty).individualListings).total).toBe(0);
    expect(responseData(empty).agentListings).toBeNull();
    expect(
      listItems(ownerProperties)
        .map((item) => item.id)
        .sort(),
    ).toEqual(
      [text(responseData(active).id), inactiveId, soldId, rentedId].sort(),
    );
    expect(listItems(agentProperties).map((item) => item.id)).toEqual([
      text(responseData(agentListing).id),
    ]);
    expect(JSON.stringify(responseData(detail))).not.toMatch(
      /passwordHash|refreshToken|accessToken/,
    );
  });

  it('returns applications and user management events without secrets', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount(Role.USER);
    await prisma.agentApplication.create({
      data: {
        userId: user.userId,
        companyName: 'Faz321 Basvuru',
        authorizedFirstName: 'Ada',
        authorizedLastName: 'Yilmaz',
        phone: '+905551110000',
        email: user.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Adres',
        status: 'PENDING',
        submittedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });
    const changed = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const detail = await http()
      .get(`/api/v1/admin/users/${user.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const missing = await http()
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    const filteredApps = await http()
      .get('/api/v1/admin/agent-applications')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ userId: user.userId });
    const events = nested(responseData(detail).managementEvents);
    const applications = nested(responseData(detail).applications);

    expect(changed.status).toBe(200);
    expect(missing.status).toBe(404);
    expect(applications.total).toBe(1);
    expect(
      Array.isArray(applications.items) ? applications.items[0] : {},
    ).toMatchObject({
      companyName: 'Faz321 Basvuru',
      status: 'PENDING',
    });
    expect(listItems(filteredApps).map((item) => item.id)).toEqual([
      text(
        nested(Array.isArray(applications.items) ? applications.items[0] : {})
          .id,
      ),
    ]);
    expect(events.total).toBe(1);
    expect(Array.isArray(events.items) ? events.items[0] : {}).toMatchObject({
      action: 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: user.userId,
      actorUserId: admin.userId,
      metadata: { previousIsActive: true, nextIsActive: false },
    });
    expect(JSON.stringify(responseData(detail))).not.toMatch(
      /passwordHash|refreshToken|refreshTokenHash/,
    );
  });

  it('authorizes only an active admin', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const agent = await createAccount(Role.AGENT);
    await prisma.agentProfile.create({
      data: {
        userId: agent.userId,
        slug: `faz321-suspended-${agent.userId}`,
        companyName: 'Askida',
        phone: '+905551110000',
        email: agent.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Adres',
        isActive: false,
      },
    });
    const inactiveAdmin = await createAccount(Role.ADMIN);
    await http()
      .patch(`/api/v1/admin/users/${inactiveAdmin.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const anonymous = await http().get('/api/v1/admin/users');
    const asUser = await http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${user.token}`);
    const asAgent = await http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${agent.token}`);
    const asInactive = await http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${inactiveAdmin.token}`);
    const asAdmin = await http()
      .get(`/api/v1/admin/users/${user.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(anonymous.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(asAgent.status).toBe(403);
    expect(asInactive.status).toBe(401);
    expect(asAdmin.status).toBe(200);
  });

  it('keeps role, listing status, profile suspension, and application state', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount();
    const city = `Faz321-status-${owner.userId.slice(0, 8)}`;
    const created = await postIndividual(owner.token, city);
    const propertyId = text(responseData(created).id);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: owner.userId,
        slug: `faz321-keep-${owner.userId}`,
        companyName: 'Ayrim',
        phone: '+905551110000',
        email: owner.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Adres',
        isActive: false,
      },
    });
    await prisma.user.update({
      where: { id: owner.userId },
      data: { role: Role.AGENT },
    });
    const application = await prisma.agentApplication.create({
      data: {
        userId: owner.userId,
        companyName: 'Ayrim Basvuru',
        authorizedFirstName: 'Ada',
        authorizedLastName: 'Yilmaz',
        phone: '+905551110000',
        email: owner.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Adres',
        status: 'APPROVED',
      },
    });
    const first = await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const auditsAfterFirst = await prisma.auditLog.count({
      where: { entityType: 'USER', entityId: owner.userId },
    });
    const second = await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const auditsAfterSecond = await prisma.auditLog.count({
      where: { entityType: 'USER', entityId: owner.userId },
    });
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    const storedProperty = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    const storedProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    const storedApplication = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    const restored = await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(responseData(second)).toEqual({ id: owner.userId, isActive: false });
    expect(auditsAfterSecond).toBe(auditsAfterFirst);
    expect(storedUser.role).toBe(Role.AGENT);
    expect(storedUser.isActive).toBe(false);
    expect(storedProperty.status).toBe(PropertyStatus.ACTIVE);
    expect(storedProperty.deletedAt).toBeNull();
    expect(storedProfile.isActive).toBe(false);
    expect(storedApplication.status).toBe('APPROVED');
    expect(restored.status).toBe(200);
    expect(
      (
        await prisma.agentProfile.findUniqueOrThrow({
          where: { id: profile.id },
        })
      ).isActive,
    ).toBe(false);
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .status,
    ).toBe(PropertyStatus.ACTIVE);
  });

  it('keeps old access and refresh tokens invalid after reactivation', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const me = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const deactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const versionAfterDeactivation = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { tokenVersion: true },
    });
    const auditsAfterDeactivation = await prisma.auditLog.count({
      where: { entityType: 'USER', entityId: user.userId },
    });
    const repeated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const versionAfterNoop = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { tokenVersion: true },
    });
    const auditsAfterNoop = await prisma.auditLog.count({
      where: { entityType: 'USER', entityId: user.userId },
    });
    const blockedAccess = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const blockedRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', user.cookie);
    const sessions = await prisma.authSession.findMany({
      where: { userId: user.userId },
    });
    const reactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const versionAfterReactivation = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { tokenVersion: true },
    });
    const oldRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', user.cookie);
    const oldAccess = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const freshLogin = await http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: user.email, password });
    const freshToken = text(responseData(freshLogin).accessToken);
    const freshCookie = cookieFrom(freshLogin);
    const freshAccess = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${freshToken}`);
    const freshRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', freshCookie);

    expect(me.status).toBe(200);
    expect(deactivated.status).toBe(200);
    expect(versionAfterDeactivation.tokenVersion).toBe(1);
    expect(repeated.status).toBe(200);
    expect(versionAfterNoop.tokenVersion).toBe(1);
    expect(auditsAfterNoop).toBe(auditsAfterDeactivation);
    expect(blockedAccess.status).toBe(401);
    expect(blockedRefresh.status).toBe(401);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.revokedAt instanceof Date)).toBe(
      true,
    );
    expect(reactivated.status).toBe(200);
    expect(versionAfterReactivation.tokenVersion).toBe(1);
    expect(oldRefresh.status).toBe(401);
    expect(oldAccess.status).toBe(401);
    expect(freshLogin.status).toBe(200);
    expect(freshAccess.status).toBe(200);
    expect(freshRefresh.status).toBe(200);
  });

  it('revokes a refresh that races account deactivation', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const [refreshResult, deactivated] = await Promise.all([
      http()
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', user.cookie),
      http()
        .patch(`/api/v1/admin/users/${user.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: false }),
    ]);
    const racedToken =
      refreshResult.status === 200
        ? text(responseData(refreshResult).accessToken)
        : user.token;
    const racedCookie =
      refreshResult.status === 200 ? cookieFrom(refreshResult) : user.cookie;
    const reactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const oldAccess = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const racedAccess = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${racedToken}`);
    const racedRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', racedCookie);
    const openSessions = await prisma.authSession.count({
      where: { userId: user.userId, revokedAt: null },
    });

    expect(deactivated.status).toBe(200);
    expect([200, 401]).toContain(refreshResult.status);
    expect(reactivated.status).toBe(200);
    expect(oldAccess.status).toBe(401);
    expect(racedAccess.status).toBe(401);
    expect(racedRefresh.status).toBe(401);
    expect(openSessions).toBe(0);
  });

  it('rejects self deactivation and lets only one side of a mutual admin lock win', async () => {
    const keeper = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        email: { not: { startsWith: 'faz321-' } },
      },
    });
    const admin = await createAccount(Role.ADMIN);
    const other = await createAccount(Role.ADMIN);
    const self = await http()
      .patch(`/api/v1/admin/users/${admin.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const audits = await prisma.auditLog.count({
      where: {
        entityType: 'USER',
        entityId: admin.userId,
        action: 'USER_DEACTIVATED',
      },
    });
    const stillActive = await prisma.user.findUniqueOrThrow({
      where: { id: admin.userId },
    });
    const sessionBefore = await prisma.authSession.count({
      where: { userId: admin.userId, revokedAt: null },
    });
    const [first, second] = await Promise.all([
      http()
        .patch(`/api/v1/admin/users/${other.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: false }),
      http()
        .patch(`/api/v1/admin/users/${admin.userId}/status`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ isActive: false }),
    ]);
    const statuses = [first.status, second.status].sort();
    const survivors = await prisma.user.count({
      where: {
        id: { in: [admin.userId, other.userId] },
        isActive: true,
      },
    });
    const keepersAfter = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        email: { not: { startsWith: 'faz321-' } },
      },
    });

    expect(self.status).toBe(409);
    expect(responseData(self).message).toBe(
      'Admin cannot deactivate their own account',
    );
    expect(audits).toBe(0);
    expect(stillActive.isActive).toBe(true);
    expect(sessionBefore).toBeGreaterThan(0);
    expect(statuses).toEqual([200, 403]);
    expect(survivors).toBe(1);
    expect(keepersAfter).toBe(keeper);
    expect(
      await prisma.user.count({ where: { role: Role.ADMIN, isActive: true } }),
    ).toBeGreaterThan(0);
  });

  it('keeps one consistent result when two status writes race', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const [left, right] = await Promise.all([
      http()
        .patch(`/api/v1/admin/users/${user.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: false }),
      http()
        .patch(`/api/v1/admin/users/${user.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: true }),
    ]);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    const audits = (
      await prisma.auditLog.findMany({
        where: { entityType: 'USER', entityId: user.userId },
      })
    ).sort((left, right) => {
      const leftFirst = nested(left.metadata).previousIsActive === true ? 0 : 1;
      const rightFirst =
        nested(right.metadata).previousIsActive === true ? 0 : 1;
      return leftFirst - rightFirst;
    });
    const oldRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', user.cookie);
    let previous = true;

    expect([left.status, right.status].every((status) => status === 200)).toBe(
      true,
    );
    expect(stored.role).toBe(Role.USER);
    expect(audits.length).toBeGreaterThan(0);
    for (const audit of audits) {
      const metadata = nested(audit.metadata);
      expect(metadata.previousIsActive).toBe(previous);
      previous = metadata.nextIsActive === true;
    }
    expect(previous).toBe(stored.isActive);
    expect(oldRefresh.status).toBe(401);
  });

  it('rolls the status change back when the audit write fails', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const audit = app.get(AuditService);
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValue(new Error('audit failed'));

    try {
      const response = await http()
        .patch(`/api/v1/admin/users/${user.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: false });
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.userId },
      });
      const openSessions = await prisma.authSession.count({
        where: { userId: user.userId, revokedAt: null },
      });

      const stillSignedIn = await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(500);
      expect(stored.isActive).toBe(true);
      expect(stored.tokenVersion).toBe(0);
      expect(openSessions).toBeGreaterThan(0);
      expect(stillSignedIn.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });

  it('hides public profile, files, and listings while the account is inactive', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount();
    const viewer = await createAccount();
    const city = `Faz321-public-${owner.userId.slice(0, 8)}`;
    const created = await postIndividual(owner.token, city);
    const propertyId = text(responseData(created).id);
    const uploaded = await http()
      .post(`/api/v1/user-properties/${propertyId}/images`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', jpeg, {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      });
    const imageUrl = text(responseData(uploaded).url);
    const favorite = await http()
      .post(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    const visible = await http().get(`/api/v1/properties/${propertyId}`);
    const visibleFile = await http().get(imageUrl);
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const hidden = await http().get(`/api/v1/properties/${propertyId}`);
    const hiddenFile = await http().get(imageUrl);
    const home = await http().get('/api/v1/properties').query({ city });
    const hiddenFavorites = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${viewer.token}`);
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const restored = await http().get(`/api/v1/properties/${propertyId}`);
    const restoredFile = await http().get(imageUrl);
    const restoredFavorites = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${viewer.token}`);
    const agent = await createAccount(Role.AGENT);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: agent.userId,
        slug: `faz321-public-${agent.userId}`,
        companyName: 'Public Ayrim',
        phone: '+905551110000',
        email: agent.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Adres',
      },
    });
    const agentCity = `Faz321-agent-${agent.userId.slice(0, 8)}`;
    const agentCreated = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${agent.token}`)
      .send(propertyBody(await ensurePlace(agentCity)));
    const agentPropertyId = text(responseData(agentCreated).id);
    const logo = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${agent.token}`)
      .attach('file', jpeg, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      });
    const logoUrl = text(responseData(logo).logoUrl);
    const publicAgent = await http().get(`/api/v1/agents/${profile.slug}`);
    const publicAgentList = await http().get(
      `/api/v1/agents/${profile.slug}/properties`,
    );
    const publicLogo = await http().get(logoUrl);
    await http()
      .patch(`/api/v1/admin/users/${agent.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const hiddenAgent = await http().get(`/api/v1/agents/${profile.slug}`);
    const hiddenAgentList = await http().get(
      `/api/v1/properties/${agentPropertyId}`,
    );
    const hiddenLogo = await http().get(logoUrl);
    await http()
      .patch(`/api/v1/admin/users/${agent.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const returnedAgent = await http().get(`/api/v1/agents/${profile.slug}`);
    await prisma.agentProfile.update({
      where: { id: profile.id },
      data: { isActive: false },
    });
    const suspendedProfile = await http().get(`/api/v1/agents/${profile.slug}`);
    const suspendedList = await http().get(
      `/api/v1/properties/${agentPropertyId}`,
    );
    const suspendedLogo = await http().get(logoUrl);
    const profileRow = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    const userRow = await prisma.user.findUniqueOrThrow({
      where: { id: agent.userId },
    });

    expect(created.status).toBe(201);
    expect(uploaded.status).toBe(201);
    expect(favorite.status).toBe(200);
    expect(visible.status).toBe(200);
    expect(visibleFile.status).toBe(200);
    expect(hidden.status).toBe(404);
    expect(hiddenFile.status).toBe(404);
    expect(listItems(home).map((item) => item.id)).not.toContain(propertyId);
    expect(listItems(hiddenFavorites).map((item) => item.id)).not.toContain(
      propertyId,
    );
    expect(restored.status).toBe(200);
    expect(restoredFile.status).toBe(200);
    expect(listItems(restoredFavorites).map((item) => item.id)).toContain(
      propertyId,
    );
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .status,
    ).toBe(PropertyStatus.ACTIVE);
    expect(agentCreated.status).toBe(201);
    expect(logo.status).toBe(201);
    expect(publicAgent.status).toBe(200);
    expect(listItems(publicAgentList).map((item) => item.id)).toContain(
      agentPropertyId,
    );
    expect(publicLogo.status).toBe(200);
    expect(hiddenAgent.status).toBe(404);
    expect(hiddenAgentList.status).toBe(404);
    expect(hiddenLogo.status).toBe(404);
    expect(returnedAgent.status).toBe(200);
    expect(suspendedProfile.status).toBe(404);
    expect(suspendedList.status).toBe(404);
    expect(suspendedLogo.status).toBe(404);
    expect(profileRow.isActive).toBe(false);
    expect(userRow.isActive).toBe(true);
    expect(userRow.role).toBe(Role.AGENT);
  });

  it('returns population counts and registration buckets from the database', async () => {
    const admin = await createAccount(Role.ADMIN);
    const plain = await createAccount();
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await http().get('/api/v1/admin/users/summary').set(auth);
    const beforeDays = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2018-02-02',
        createdTo: '2018-02-04',
        bucket: 'day',
      });
    const beforeMonths = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2018-01-15',
        createdTo: '2018-03-02',
        bucket: 'month',
      });
    const user = await createAccount(Role.USER, {
      firstName: 'Faz321Sayac',
      lastName: 'Grafik',
    });
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        createdAt: new Date('2018-02-02T15:00:00.000Z'),
        isActive: false,
      },
    });
    const after = await http().get('/api/v1/admin/users/summary').set(auth);
    const days = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2018-02-02',
        createdTo: '2018-02-04',
        bucket: 'day',
      });
    const months = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2018-01-15',
        createdTo: '2018-03-02',
        bucket: 'month',
      });
    const page = await http()
      .get('/api/v1/admin/users')
      .set(auth)
      .query({ email: user.email, limit: 1 });
    const forbidden = await http()
      .get('/api/v1/admin/users/summary')
      .set('Authorization', `Bearer ${plain.token}`);
    const anonymous = await http().get('/api/v1/admin/users/summary');
    const missingBound = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({ createdFrom: '2018-02-02', bucket: 'day' });
    const reversed = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2018-02-05',
        createdTo: '2018-02-01',
        bucket: 'day',
      });
    const tooWide = await http()
      .get('/api/v1/admin/users/summary')
      .set(auth)
      .query({
        createdFrom: '2010-01-01',
        createdTo: '2012-01-02',
        bucket: 'day',
      });
    const pointsOf = (body: Record<string, unknown>) => {
      const points = nested(body.registrations).points;

      return Array.isArray(points)
        ? points.filter(
            (item): item is Record<string, unknown> =>
              typeof item === 'object' && item !== null,
          )
        : [];
    };
    const countAt = (body: Record<string, unknown>, start: string) => {
      const found = pointsOf(body).find((item) => item.bucketStart === start);

      return typeof found?.count === 'number' ? found.count : -1;
    };
    const roleCount = (
      body: Record<string, unknown>,
      role: string,
      field: string,
    ) => {
      const value = nested(nested(body.roles)[role])[field];

      return typeof value === 'number' ? value : -1;
    };
    const beforeBody = responseData(before);
    const afterBody = responseData(after);
    const dayBody = responseData(days);
    const monthBody = responseData(months);
    const dayPoints = pointsOf(dayBody);

    expect(before.status).toBe(200);
    expect(beforeBody.registrations).toBeNull();
    expect(beforeBody.items).toBeUndefined();
    expect(afterBody.total).toBe(Number(beforeBody.total) + 1);
    expect(afterBody.inactive).toBe(Number(beforeBody.inactive) + 1);
    expect(afterBody.active).toBe(beforeBody.active);
    expect(roleCount(afterBody, 'USER', 'total')).toBe(
      roleCount(beforeBody, 'USER', 'total') + 1,
    );
    expect(roleCount(afterBody, 'USER', 'inactive')).toBe(
      roleCount(beforeBody, 'USER', 'inactive') + 1,
    );
    expect(roleCount(afterBody, 'ADMIN', 'total')).toBe(
      roleCount(beforeBody, 'ADMIN', 'total'),
    );
    expect(dayBody.total).toBe(afterBody.total);
    expect(dayPoints).toHaveLength(3);
    expect(
      countAt(dayBody, '2018-02-02T00:00:00.000Z') -
        countAt(responseData(beforeDays), '2018-02-02T00:00:00.000Z'),
    ).toBe(1);
    expect(
      countAt(dayBody, '2018-02-03T00:00:00.000Z') -
        countAt(responseData(beforeDays), '2018-02-03T00:00:00.000Z'),
    ).toBe(0);
    expect(nested(dayBody.registrations).total).toBe(
      dayPoints.reduce(
        (sum, point) =>
          sum + (typeof point.count === 'number' ? point.count : 0),
        0,
      ),
    );
    expect(
      countAt(monthBody, '2018-02-01T00:00:00.000Z') -
        countAt(responseData(beforeMonths), '2018-02-01T00:00:00.000Z'),
    ).toBe(1);
    expect(pointsOf(monthBody)).toHaveLength(3);
    expect(responseData(page).total).toBe(1);
    expect(listItems(page)).toHaveLength(1);
    expect(afterBody.total).not.toBe(1);
    expect(forbidden.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(missingBound.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(tooWide.status).toBe(400);
  });
});
