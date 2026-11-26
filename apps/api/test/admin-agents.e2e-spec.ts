import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { ApplicationStatus, Role } from '../src/generated/prisma/enums';
import { AuditService } from '../src/modules/audit/audit.service';
import { StorageService } from '../src/modules/storage/storage.service';

const password = 'password123';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const reason = 'Yonetim gerekcesi';

describe('Admin agents (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: StorageService;
  let origin: string;
  let sequence = 0;
  const fileIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    origin = app
      .get(ConfigService)
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')[0]
      .trim();
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'faz341-' } },
        select: { id: true },
      });
      const ids = users.map((user) => user.id);

      if (ids.length > 0) {
        const profiles = await prisma.agentProfile.findMany({
          where: { userId: { in: ids } },
          select: { id: true, logoFileId: true },
        });
        const profileIds = profiles.map((profile) => profile.id);
        const logoIds = profiles
          .map((profile) => profile.logoFileId)
          .filter((id): id is string => Boolean(id));
        const images =
          profileIds.length === 0
            ? []
            : await prisma.propertyImage.findMany({
                where: { property: { agentProfileId: { in: profileIds } } },
                select: { fileId: true },
              });

        await prisma.property.deleteMany({
          where: {
            OR: [
              { ownerUserId: { in: ids } },
              { agentProfileId: { in: profileIds } },
            ],
          },
        });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });

        const storedIds = [
          ...new Set([
            ...fileIds,
            ...logoIds,
            ...images.map((image) => image.fileId),
          ]),
        ];
        if (storedIds.length > 0) {
          const files = await prisma.storedFile.findMany({
            where: { id: { in: storedIds } },
            select: { id: true, storageKey: true },
          });

          for (const file of files) {
            await storage.discard(file.storageKey);
          }

          await prisma.storedFile.deleteMany({
            where: { id: { in: storedIds } },
          });
        }
      }

      const cities = await prisma.city.findMany({
        where: { name: { startsWith: 'Faz341' } },
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
    return `faz341-${Date.now()}-${sequence}@example.com`;
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

  function numberOf(value: unknown) {
    return typeof value === 'number' ? value : -1;
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

  async function createProfile(
    account: { userId: string; email: string },
    extra: Record<string, unknown> = {},
  ) {
    return prisma.agentProfile.create({
      data: {
        userId: account.userId,
        slug: `faz341-${account.userId}`,
        companyName: 'Faz341 Firma',
        phone: '+905551110000',
        email: `office-${account.userId}@example.com`,
        taxNumber: '1234567890',
        city: 'Faz341Konya',
        district: 'Faz341Selcuklu',
        address: 'Ofis adresi',
        ...extra,
      },
    });
  }

  async function ensurePlace(cityName: string) {
    const city = await prisma.city.upsert({
      where: { name: cityName },
      update: {},
      create: { name: cityName },
    });
    const district = await prisma.district.upsert({
      where: { cityId_name: { cityId: city.id, name: 'Faz341Ilce' } },
      update: {},
      create: { cityId: city.id, name: 'Faz341Ilce' },
    });
    const neighborhood = await prisma.neighborhood.upsert({
      where: {
        districtId_name: { districtId: district.id, name: 'Faz341Mahalle' },
      },
      update: {},
      create: { districtId: district.id, name: 'Faz341Mahalle' },
    });

    return {
      cityId: city.id,
      districtId: district.id,
      neighborhoodId: neighborhood.id,
    };
  }

  function propertyBody(
    place: { cityId: string; districtId: string; neighborhoodId: string },
    extra: Record<string, unknown> = {},
  ) {
    return {
      title: 'Faz341 ilan',
      description: 'Portfoy sayaci icin gecici ilan.',
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
      ...extra,
    };
  }

  async function postProfessional(
    token: string,
    cityName: string,
    extra: Record<string, unknown> = {},
  ) {
    const place = await ensurePlace(cityName);

    return http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(propertyBody(place, extra));
  }

  function authOf(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function counts(value: unknown) {
    const body = nested(value);

    return {
      total: numberOf(body.total),
      active: numberOf(body.active),
      inactive: numberOf(body.inactive),
      sold: numberOf(body.sold),
      rented: numberOf(body.rented),
      publiclyVisible: numberOf(body.publiclyVisible),
    };
  }

  it('searches, filters, and pages agent profiles without mixing account state', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.USER, {
      firstName: 'Faz341İpek',
      lastName: 'Faz341Yılmaz',
      phone: '+905559991111',
    });
    await prisma.user.update({
      where: { id: owner.userId },
      data: { role: Role.AGENT },
    });
    const profile = await createProfile(owner, {
      companyName: 'Faz341 Çınar Emlak',
      email: 'faz341-ofis@example.com',
      taxNumber: '3413413410',
      phone: '+905558887766',
      city: 'Faz341Konya',
      district: 'Faz341Meram',
      createdAt: new Date('2024-05-02T08:00:00.000Z'),
    });
    await prisma.agentApplication.create({
      data: {
        userId: owner.userId,
        companyName: 'Faz341 Çınar Emlak',
        authorizedFirstName: 'Faz341YetkiliBenzersiz',
        authorizedLastName: 'Faz341Kisi',
        phone: '+905550000777',
        email: 'faz341-yetkili@example.com',
        taxNumber: '9999999999',
        city: 'Ankara',
        district: 'Cankaya',
        address: 'Basvuru adresi',
        status: ApplicationStatus.APPROVED,
        submittedAt: new Date('2024-04-01T00:00:00.000Z'),
        reviewedAt: new Date('2024-04-02T00:00:00.000Z'),
      },
    });
    await prisma.agentApplication.create({
      data: {
        userId: owner.userId,
        companyName: 'Faz341 Eski Basvuru',
        authorizedFirstName: 'Faz341EskiYetkili',
        authorizedLastName: 'Faz341Kayit',
        phone: '+905550000778',
        email: 'faz341-eski@example.com',
        taxNumber: '8888888888',
        city: 'Ankara',
        district: 'Cankaya',
        address: 'Eski adres',
        status: ApplicationStatus.APPROVED,
        submittedAt: new Date('2023-04-01T00:00:00.000Z'),
        reviewedAt: new Date('2023-04-02T00:00:00.000Z'),
      },
    });
    const other = await createAccount(Role.AGENT);
    const otherProfile = await createProfile(other, {
      companyName: 'Faz341 Diger',
      city: 'Faz341Ankara',
      district: 'Faz341Cankaya',
      createdAt: new Date('2024-05-03T08:00:00.000Z'),
    });
    const suspended = await createAccount(Role.AGENT);
    await createProfile(suspended, {
      companyName: 'Faz341 Askida',
      city: 'Faz341Konya',
      district: 'Faz341Selcuklu',
      isActive: false,
      createdAt: new Date('2024-05-01T08:00:00.000Z'),
    });
    const inactiveOwner = await createAccount(Role.AGENT);
    await prisma.user.update({
      where: { id: inactiveOwner.userId },
      data: { isActive: false },
    });
    await createProfile(inactiveOwner, {
      companyName: 'Faz341 Pasif Hesap',
      city: 'Faz341Konya',
      district: 'Faz341Meram',
    });
    const auth = authOf(admin.token);
    const byCompany = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'çınar emlak' });
    const byName = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341Yılmaz Faz341İpek' });
    const byEmail = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: owner.email.toUpperCase() });
    const byOfficeEmail = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'faz341-ofis@example.com' });
    const byTax = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: '3413413410' });
    const byPhone = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: '5558887766' });
    const byAuthorized = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341YetkiliBenzersiz' });
    const dotted = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341ipek' });
    const byFirstName = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341İpek' });
    const byLastName = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341Yılmaz' });
    const byForwardName = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341İpek Faz341Yılmaz' });
    const byUserPhone = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: '5559991111' });
    const filtered = await http().get('/api/v1/admin/agents').set(auth).query({
      search: 'Faz341',
      isActive: 'true',
      userIsActive: 'true',
      city: 'faz341konya',
      district: 'meram',
      userId: owner.userId,
      createdFrom: '2024-05-02',
      createdTo: '2024-05-02T23:59:59.000Z',
    });
    const accountFilter = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({
        companyName: 'Faz341 Pasif Hesap',
        userIsActive: 'false',
        isActive: 'true',
      });
    const suspendedOnly = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ companyName: 'Faz341 Askida', isActive: 'false' });
    const firstPage = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341', limit: 2, page: 1 });
    const secondPage = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ search: 'Faz341', limit: 2, page: 2 });
    const reversed = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ createdFrom: '2024-06-02', createdTo: '2024-06-01' });
    const badDate = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ createdFrom: '2024-02-31' });
    const badLimit = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ limit: 101 });
    const badUser = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ userId: 'not-a-uuid' });
    const badPage = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ page: 0 });
    const badIsActive = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ isActive: 'yes' });
    const badUserIsActive = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ userIsActive: 'yes' });
    const naiveTimestamp = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ createdFrom: '2024-05-02T08:00:00' });
    const unknownParam = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ unknownField: '1' });
    const detail = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const approved = nested(responseData(detail).approvedApplications);
    const linked = await http().get(text(approved.listPath)).set(auth);
    const ids = (response: Response) =>
      listItems(response).map((item) => item.id);
    const firstIds = ids(firstPage);
    const secondIds = ids(secondPage);
    const ordered = [...listItems(firstPage), ...listItems(secondPage)];

    expect(ids(byCompany)).toContain(profile.id);
    expect(ids(byName)).toContain(profile.id);
    expect(ids(byEmail)).toContain(profile.id);
    expect(ids(byOfficeEmail)).toContain(profile.id);
    expect(ids(byTax)).toEqual([profile.id]);
    expect(ids(byPhone)).toContain(profile.id);
    expect(ids(byAuthorized)).not.toContain(profile.id);
    expect(ids(dotted)).toContain(profile.id);
    expect(ids(byFirstName)).toContain(profile.id);
    expect(ids(byLastName)).toContain(profile.id);
    expect(ids(byForwardName)).toContain(profile.id);
    expect(ids(byUserPhone)).toContain(profile.id);
    expect(ids(filtered)).toEqual([profile.id]);
    expect(numberOf(responseData(filtered).total)).toBe(1);
    expect(listItems(filtered)[0]?.taxNumber).toBeUndefined();
    expect(nested(listItems(filtered)[0]?.user).tokenVersion).toBeUndefined();
    expect(nested(listItems(filtered)[0]?.listingSummary).total).toBe(0);
    expect(ids(accountFilter)).toHaveLength(1);
    expect(nested(listItems(accountFilter)[0]?.user).isActive).toBe(false);
    expect(listItems(accountFilter)[0]?.isActive).toBe(true);
    expect(ids(suspendedOnly)).toHaveLength(1);
    expect(listItems(suspendedOnly)[0]?.isActive).toBe(false);
    expect(nested(listItems(suspendedOnly)[0]?.user).isActive).toBe(true);
    expect(numberOf(responseData(firstPage).total)).toBe(
      numberOf(responseData(secondPage).total),
    );
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    expect(otherProfile.id).toBeTruthy();
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const previousTime = Date.parse(text(previous?.createdAt));
      const currentTime = Date.parse(text(current?.createdAt));

      expect(previousTime).toBeGreaterThanOrEqual(currentTime);
      if (previousTime === currentTime) {
        expect(text(previous?.id) > text(current?.id)).toBe(true);
      }
    }
    expect(reversed.status).toBe(400);
    expect(badDate.status).toBe(400);
    expect(badLimit.status).toBe(400);
    expect(badUser.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(badIsActive.status).toBe(400);
    expect(badUserIsActive.status).toBe(400);
    expect(naiveTimestamp.status).toBe(400);
    expect(unknownParam.status).toBe(400);
    expect(approved.total).toBe(2);
    expect(approved.applicationId).toBeUndefined();
    expect(text(approved.listPath)).toBe(
      `/api/v1/admin/agent-applications?userId=${owner.userId}&status=APPROVED`,
    );
    expect(linked.status).toBe(200);
    expect(listItems(linked)).toHaveLength(2);
    expect(responseData(detail).authorizedFirstName).toBeUndefined();
  });

  it('searches multi-word first and last names in both orders with whitespace normalization', async () => {
    const admin = await createAccount(Role.ADMIN);
    const auth = authOf(admin.token);
    const firstMulti = await createAccount(Role.AGENT, {
      firstName: 'Faz341 Ali Can',
      lastName: 'Faz341Soyad',
    });
    const firstMultiProfile = await createProfile(firstMulti, {
      companyName: 'Faz341 Coklu Ad Emlak',
      slug: `faz341-multi-1-${firstMulti.userId}`,
    });
    const lastMulti = await createAccount(Role.AGENT, {
      firstName: 'Faz341Ayşe',
      lastName: 'Kaya Demir',
    });
    const lastMultiProfile = await createProfile(lastMulti, {
      companyName: 'Faz341 Coklu Soyad Emlak',
      slug: `faz341-multi-2-${lastMulti.userId}`,
    });

    const queries = [
      { term: 'Faz341 Ali Can Faz341Soyad', expectedId: firstMultiProfile.id },
      { term: 'Faz341Soyad Faz341 Ali Can', expectedId: firstMultiProfile.id },
      {
        term: '  faz341   ali   can   faz341soyad  ',
        expectedId: firstMultiProfile.id,
      },
      { term: 'Faz341Ayşe Kaya Demir', expectedId: lastMultiProfile.id },
      { term: 'Kaya Demir Faz341Ayşe', expectedId: lastMultiProfile.id },
    ];

    for (const entry of queries) {
      const response = await http()
        .get('/api/v1/admin/agents')
        .set(auth)
        .query({ search: entry.term });

      expect(response.status).toBe(200);
      expect(listItems(response).map((item) => item.id)).toContain(
        entry.expectedId,
      );
    }
  });

  it('counts only that profile professional listings and keeps visibility separate', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.USER, {
      firstName: 'Faz341Portfoy',
      lastName: 'Sahip',
    });
    const city = `Faz341Loc-${owner.userId.slice(0, 8)}`;
    const individual = await http()
      .post('/api/v1/user-properties')
      .set(authOf(owner.token))
      .send(propertyBody(await ensurePlace(city)));
    const individualId = text(responseData(individual).id);
    await prisma.user.update({
      where: { id: owner.userId },
      data: { role: Role.AGENT },
    });
    const profile = await createProfile(owner, {
      companyName: 'Faz341 Portfoy',
    });
    const active = await postProfessional(owner.token, city, {
      listingType: 'SALE',
      propertyType: 'APARTMENT',
    });
    const inactive = await postProfessional(owner.token, city, {
      listingType: 'SALE',
      propertyType: 'HOUSE',
    });
    const sold = await postProfessional(owner.token, city, {
      listingType: 'RENT',
      propertyType: 'VILLA',
    });
    const rented = await postProfessional(owner.token, city, {
      listingType: 'SALE',
      propertyType: 'LAND',
    });
    const removed = await postProfessional(owner.token, city, {
      listingType: 'SALE',
      propertyType: 'WORKPLACE',
    });
    const activeId = text(responseData(active).id);
    const inactiveId = text(responseData(inactive).id);
    const soldId = text(responseData(sold).id);
    const rentedId = text(responseData(rented).id);
    const removedId = text(responseData(removed).id);
    const cover = await http()
      .post(`/api/v1/properties/${activeId}/images`)
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      });
    const coverUrl = text(responseData(cover).url);
    fileIds.push(coverUrl.split('/').pop() ?? '');
    await http()
      .patch(`/api/v1/properties/${inactiveId}/status`)
      .set(authOf(owner.token))
      .send({ status: 'INACTIVE' });
    await http()
      .patch(`/api/v1/properties/${soldId}/status`)
      .set(authOf(owner.token))
      .send({ status: 'SOLD' });
    await http()
      .patch(`/api/v1/properties/${rentedId}/status`)
      .set(authOf(owner.token))
      .send({ status: 'RENTED' });
    await http()
      .delete(`/api/v1/properties/${removedId}`)
      .set(authOf(owner.token));
    const other = await createAccount(Role.AGENT);
    const otherProfile = await createProfile(other, {
      companyName: 'Faz341 Baska Portfoy',
      slug: `faz341-other-${other.userId}`,
    });
    const otherListing = await postProfessional(other.token, city);
    const viewer = await createAccount();
    await http()
      .post(`/api/v1/favorites/${activeId}`)
      .set(authOf(viewer.token));
    const auth = authOf(admin.token);
    const beforeSummary = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth);
    const detail = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const listBefore = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ userId: owner.userId });
    const adminList = await http()
      .get('/api/v1/admin/properties')
      .set(auth)
      .query({ agentUserId: owner.userId, limit: 20 });
    const visibleProfile = await http().get(`/api/v1/agents/${profile.slug}`);
    const visibleList = await http().get(
      `/api/v1/agents/${profile.slug}/properties`,
    );
    const visibleListing = await http().get(`/api/v1/properties/${activeId}`);
    const home = await http().get('/api/v1/properties').query({ city });
    const favorites = await http()
      .get('/api/v1/favorites')
      .set(authOf(viewer.token));
    const visibleFile = await http().get(coverUrl);
    const visibleIndividual = await http().get(
      `/api/v1/properties/${individualId}`,
    );
    const versionBefore = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
      select: { tokenVersion: true, isActive: true, role: true },
    });
    const suspended = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason });
    const afterSuspend = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const hiddenProfile = await http().get(`/api/v1/agents/${profile.slug}`);
    const hiddenListing = await http().get(`/api/v1/properties/${activeId}`);
    const hiddenHome = await http().get('/api/v1/properties').query({ city });
    const hiddenFavorites = await http()
      .get('/api/v1/favorites')
      .set(authOf(viewer.token));
    const hiddenFile = await http().get(coverUrl);
    const stillIndividual = await http().get(
      `/api/v1/properties/${individualId}`,
    );
    const stored = await prisma.property.findMany({
      where: {
        id: { in: [activeId, inactiveId, soldId, rentedId, removedId] },
      },
      select: { id: true, status: true, deletedAt: true },
    });
    const userAfter = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set(auth)
      .send({ isActive: false });
    const inactiveAccount = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const hiddenIndividual = await http().get(
      `/api/v1/properties/${individualId}`,
    );
    const profileRow = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set(auth)
      .send({ isActive: true });
    await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: true, reason: 'Uygunsuzluk giderildi' });
    const restored = await http().get(`/api/v1/properties/${activeId}`);
    const restoredInactive = await http().get(
      `/api/v1/properties/${inactiveId}`,
    );
    const restoredIndividual = await http().get(
      `/api/v1/properties/${individualId}`,
    );

    // Passive user + active profile rules and reactivation independence
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set(auth)
      .send({ isActive: false });
    const loginBlockedWhileUserInactive = await http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: owner.email, password });
    const publicProfileWhileUserInactive = await http().get(
      `/api/v1/agents/${profile.slug}`,
    );
    const publicAgentListingsWhileUserInactive = await http().get(
      `/api/v1/agents/${profile.slug}/properties`,
    );
    const publicPropertyWhileUserInactive = await http().get(
      `/api/v1/properties/${activeId}`,
    );
    const publicFileWhileUserInactive = await http().get(coverUrl);
    const activeProfileWhileUserInactive =
      await prisma.agentProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });

    // Suspend then reactivate profile while user stays inactive -> user must NOT auto-activate
    await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: 'Pasif hesapta aski' });
    await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: true, reason: 'Pasif hesapta profil acildi' });
    const userAfterProfileReactivate = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    const publicAfterProfileReactivateOnly = await http().get(
      `/api/v1/agents/${profile.slug}`,
    );

    // Suspend profile, reactivate user -> profile must stay suspended & public hidden
    await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: 'Kullanici acilirken askida kalsin' });
    await http()
      .patch(`/api/v1/admin/users/${owner.userId}/status`)
      .set(auth)
      .send({ isActive: true });
    const profileAfterUserReactivate =
      await prisma.agentProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });
    const publicWhileUserActiveProfileSuspended = await http().get(
      `/api/v1/agents/${profile.slug}`,
    );

    const statuses = new Map(stored.map((row) => [row.id, row]));
    const summary = nested(responseData(detail).listingSummary);
    const after = nested(responseData(afterSuspend).listingSummary);
    const homeIds = listItems(home).map((item) => item.id);
    const hiddenHomeIds = listItems(hiddenHome).map((item) => item.id);
    const adminIds = listItems(adminList).map((item) => item.id);
    const applications = nested(responseData(detail).approvedApplications);

    expect(individual.status).toBe(201);
    expect(active.status).toBe(201);
    expect(summary).toMatchObject({
      total: 4,
      active: 1,
      inactive: 1,
      sold: 1,
      rented: 1,
      publiclyVisible: 1,
      listingTypes: { SALE: 3, RENT: 1 },
      propertyTypes: {
        APARTMENT: 1,
        HOUSE: 1,
        VILLA: 1,
        LAND: 1,
        WORKPLACE: 0,
      },
    });
    expect(
      counts(nested(listItems(listBefore)[0]?.listingSummary)),
    ).toMatchObject({
      total: 4,
      publiclyVisible: 1,
    });
    expect(adminIds).toEqual(
      expect.arrayContaining([activeId, inactiveId, soldId, rentedId]),
    );
    expect(adminIds).not.toContain(removedId);
    expect(adminIds).not.toContain(individualId);
    expect(adminIds).not.toContain(text(responseData(otherListing).id));
    expect(text(responseData(detail).propertiesPath)).toBe(
      `/api/v1/admin/properties?agentUserId=${owner.userId}`,
    );
    expect(applications).toMatchObject({
      userId: owner.userId,
      status: 'APPROVED',
      total: 0,
    });
    expect(applications.applicationId).toBeUndefined();
    expect(responseData(detail).authorizedFirstName).toBeUndefined();
    expect(visibleProfile.status).toBe(200);
    expect(visibleList.status).toBe(200);
    expect(listItems(visibleList).map((item) => item.id)).toContain(activeId);
    expect(visibleListing.status).toBe(200);
    expect(homeIds).toContain(activeId);
    expect(homeIds).not.toContain(inactiveId);
    expect(listItems(favorites).map((item) => item.id)).toContain(activeId);
    expect(visibleFile.status).toBe(200);
    expect(visibleIndividual.status).toBe(200);
    expect(suspended.status).toBe(200);
    expect(after).toMatchObject({
      total: 4,
      active: 1,
      inactive: 1,
      sold: 1,
      rented: 1,
      publiclyVisible: 0,
    });
    expect(hiddenProfile.status).toBe(404);
    expect(hiddenListing.status).toBe(404);
    expect(hiddenHomeIds).not.toContain(activeId);
    expect(hiddenFile.status).toBe(404);
    expect(listItems(hiddenFavorites).map((item) => item.id)).not.toContain(
      activeId,
    );
    expect(stillIndividual.status).toBe(200);
    expect(statuses.get(activeId)?.status).toBe('ACTIVE');
    expect(statuses.get(inactiveId)?.status).toBe('INACTIVE');
    expect(statuses.get(soldId)?.status).toBe('SOLD');
    expect(statuses.get(rentedId)?.status).toBe('RENTED');
    expect(statuses.get(removedId)?.deletedAt).toBeTruthy();
    expect(userAfter.role).toBe(Role.AGENT);
    expect(userAfter.isActive).toBe(true);
    expect(userAfter.tokenVersion).toBe(versionBefore.tokenVersion);
    expect(profileRow.isActive).toBe(false);
    expect(
      counts(nested(responseData(inactiveAccount).listingSummary))
        .publiclyVisible,
    ).toBe(0);
    expect(
      counts(nested(responseData(inactiveAccount).listingSummary)).total,
    ).toBe(4);
    expect(hiddenIndividual.status).toBe(404);
    expect(restored.status).toBe(200);
    expect(restoredInactive.status).toBe(404);
    expect(restoredIndividual.status).toBe(200);
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: inactiveId } }))
        .status,
    ).toBe('INACTIVE');
    expect(otherProfile.id).not.toBe(profile.id);
    const summaryAfter = counts(
      nested(responseData(beforeSummary).listingSummary),
    );
    expect(summaryAfter.total).toBe(
      summaryAfter.active +
        summaryAfter.inactive +
        summaryAfter.sold +
        summaryAfter.rented,
    );
    expect(loginBlockedWhileUserInactive.status).toBe(401);
    expect(publicProfileWhileUserInactive.status).toBe(404);
    expect(publicAgentListingsWhileUserInactive.status).toBe(404);
    expect(publicPropertyWhileUserInactive.status).toBe(404);
    expect(publicFileWhileUserInactive.status).toBe(404);
    expect(activeProfileWhileUserInactive.isActive).toBe(true);
    expect(userAfterProfileReactivate.isActive).toBe(false);
    expect(publicAfterProfileReactivateOnly.status).toBe(404);
    expect(profileAfterUserReactivate.isActive).toBe(false);
    expect(publicWhileUserActiveProfileSuspended.status).toBe(404);
  });

  it('serves the current logo to an active admin and keeps every other file private', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const other = await createAccount(Role.AGENT);
    const user = await createAccount();
    const suspended = await createAccount(Role.AGENT);
    const inactiveAdmin = await createAccount(Role.ADMIN);
    const profile = await createProfile(owner);
    const otherProfile = await createProfile(other, {
      slug: `faz341-logo-${other.userId}`,
    });
    await prisma.agentProfile.update({
      where: {
        id: (
          await createProfile(suspended, {
            slug: `faz341-sus-${suspended.userId}`,
          })
        ).id,
      },
      data: { isActive: false },
    });
    await prisma.user.update({
      where: { id: inactiveAdmin.userId },
      data: { isActive: false },
    });
    const uploaded = await http()
      .post('/api/v1/agents/me/logo')
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      });
    const publicUrl = text(responseData(uploaded).logoUrl);
    const fileId = publicUrl.split('/').pop() ?? '';
    fileIds.push(fileId);
    const listing = await postProfessional(
      owner.token,
      `Faz341Loc-${owner.userId.slice(0, 8)}`,
    );
    const image = await http()
      .post(`/api/v1/properties/${text(responseData(listing).id)}/images`)
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'room.jpg',
        contentType: 'image/jpeg',
      });
    const imageId = text(responseData(image).url).split('/').pop() ?? '';
    fileIds.push(imageId);
    const document = await prisma.storedFile.create({
      data: {
        storageKey: `agents/${profile.id}/documents/${randomUUID()}.pdf`,
        originalName: 'vergi.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5,
        visibility: 'PRIVATE',
        category: 'AGENT_TAX_DOCUMENT',
      },
    });
    fileIds.push(document.id);
    const logoPath = `/api/v1/admin/agents/${profile.id}/files/${fileId}`;
    const auth = authOf(admin.token);
    const anonymous = await http().get(logoPath);
    const asUser = await http().get(logoPath).set(authOf(user.token));
    const asAgent = await http().get(logoPath).set(authOf(owner.token));
    const asSuspended = await http().get(logoPath).set(authOf(suspended.token));
    const asInactiveAdmin = await http()
      .get(logoPath)
      .set(authOf(inactiveAdmin.token));
    const opened = await http().get(logoPath).set(auth);
    const missingProfile = await http()
      .get(`/api/v1/admin/agents/${randomUUID()}/files/${fileId}`)
      .set(auth);
    const otherProfileFile = await http()
      .get(`/api/v1/admin/agents/${otherProfile.id}/files/${fileId}`)
      .set(auth);
    const documentFile = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${document.id}`)
      .set(auth);
    const imageFile = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${imageId}`)
      .set(auth);
    const replaced = await http()
      .post('/api/v1/agents/me/logo')
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'next.jpg',
        contentType: 'image/jpeg',
      });
    const nextId = text(responseData(replaced).logoUrl).split('/').pop() ?? '';
    fileIds.push(nextId);
    const oldLogo = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${fileId}`)
      .set(auth);
    const currentLogo = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${nextId}`)
      .set(auth);
    const currentRow = await prisma.storedFile.findUniqueOrThrow({
      where: { id: nextId },
    });
    const missingKey = `agents/${profile.id}/logo/${randomUUID()}.jpg`;
    await prisma.storedFile.update({
      where: { id: nextId },
      data: { storageKey: missingKey },
    });
    const missingBytes = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${nextId}`)
      .set(auth);
    await prisma.storedFile.update({
      where: { id: nextId },
      data: { storageKey: currentRow.storageKey, deletedAt: new Date() },
    });
    const deleted = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${nextId}`)
      .set(auth);
    const publicWhileActive = await http().get(publicUrl);
    await prisma.storedFile.update({
      where: { id: nextId },
      data: { deletedAt: null },
    });
    await prisma.agentProfile.update({
      where: { id: profile.id },
      data: { logoFileId: nextId, isActive: false },
    });
    const publicWhileSuspended = await http().get(`/api/v1/files/${nextId}`);
    const adminWhileSuspended = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${nextId}`)
      .set(auth);
    await prisma.user.update({
      where: { id: owner.userId },
      data: { isActive: false },
    });
    const adminWhileUserInactive = await http()
      .get(`/api/v1/admin/agents/${profile.id}/files/${nextId}`)
      .set(auth);
    const publicWhileUserInactive = await http().get(`/api/v1/files/${nextId}`);
    const detail = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);

    expect(uploaded.status).toBe(201);
    expect(anonymous.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(asAgent.status).toBe(403);
    expect(asSuspended.status).toBe(403);
    expect(asInactiveAdmin.status).toBe(401);
    expect(opened.status).toBe(200);
    expect(opened.headers['cache-control']).toBe('private, no-store');
    expect(opened.headers['content-type']).toMatch(/image\/jpeg/);
    expect(missingProfile.status).toBe(404);
    expect(otherProfileFile.status).toBe(404);
    expect(documentFile.status).toBe(404);
    expect(imageFile.status).toBe(404);
    expect(oldLogo.status).toBe(404);
    expect(currentLogo.status).toBe(200);
    expect(missingBytes.status).toBe(404);
    expect(deleted.status).toBe(404);
    expect(publicWhileActive.status).toBe(404);
    expect(publicWhileSuspended.status).toBe(404);
    expect(adminWhileSuspended.status).toBe(200);
    expect(adminWhileUserInactive.status).toBe(200);
    expect(publicWhileUserInactive.status).toBe(404);
    expect(nested(responseData(detail).logo).url).toBe(
      `/api/v1/admin/agents/${profile.id}/files/${nextId}`,
    );
    expect(JSON.stringify(responseData(detail))).not.toContain('storageKey');
  });

  it('requires a reason, writes one audit, and keeps concurrent status changes consistent', async () => {
    const admin = await createAccount(Role.ADMIN);
    const otherAdmin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner);
    const auth = authOf(admin.token);
    const empty = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: '   ' });
    const short = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: 'ab' });
    const long = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: 'a'.repeat(501) });
    const missingProfile = await http()
      .patch(`/api/v1/admin/agents/${randomUUID()}/status`)
      .set(auth)
      .send({ isActive: false, reason });
    const versionBefore = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
      select: { tokenVersion: true, isActive: true, role: true },
    });
    const suspended = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: '  Platform kurali  ' });
    const noop = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: false, reason: 'Tekrar askida' });
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'AGENT_PROFILE', entityId: profile.id },
    });
    const detail = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const eventPage = nested(responseData(detail).managementEvents);
    const events = Array.isArray(eventPage.items)
      ? eventPage.items.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null,
        )
      : [];
    const activated = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: true, reason: 'Gerekce kapandi' });
    const noopActive = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(auth)
      .send({ isActive: true, reason: 'Zaten aktif' });
    const versionAfter = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    const stillSignedIn = await http()
      .get('/api/v1/agents/me')
      .set(authOf(owner.token));
    const auditCount = await prisma.auditLog.count({
      where: { entityType: 'AGENT_PROFILE', entityId: profile.id },
    });
    const racedOwner = await createAccount(Role.AGENT);
    const racedProfile = await createProfile(racedOwner, {
      slug: `faz341-race-${racedOwner.userId}`,
    });
    const [left, right] = await Promise.all([
      http()
        .patch(`/api/v1/admin/agents/${racedProfile.id}/status`)
        .set(auth)
        .send({ isActive: false, reason: 'Sol yonetici' }),
      http()
        .patch(`/api/v1/admin/agents/${racedProfile.id}/status`)
        .set(authOf(otherAdmin.token))
        .send({ isActive: true, reason: 'Sag yonetici' }),
    ]);
    const raced = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: racedProfile.id },
    });
    const racedUser = await prisma.user.findUniqueOrThrow({
      where: { id: racedOwner.userId },
    });
    const racedAudits = (
      await prisma.auditLog.findMany({
        where: { entityType: 'AGENT_PROFILE', entityId: racedProfile.id },
      })
    ).sort((first, second) => {
      const firstStart =
        nested(first.metadata).previousIsActive === true ? 0 : 1;
      const secondStart =
        nested(second.metadata).previousIsActive === true ? 0 : 1;
      return firstStart - secondStart;
    });
    let previous = true;

    // Verify managementEvents caps items at 10 while reporting true total
    for (let step = 0; step < 9; step += 1) {
      await http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(auth)
        .send({
          isActive: step % 2 === 0 ? false : true,
          reason: `Tarihce adimi ${step + 1}`,
        });
    }
    const cappedDetail = await http()
      .get(`/api/v1/admin/agents/${profile.id}`)
      .set(auth);
    const cappedEvents = nested(responseData(cappedDetail).managementEvents);
    const cappedItems = Array.isArray(cappedEvents.items)
      ? cappedEvents.items
      : [];

    expect(empty.status).toBe(400);
    expect(short.status).toBe(400);
    expect(long.status).toBe(400);
    expect(missingProfile.status).toBe(404);
    expect(suspended.status).toBe(200);
    expect(responseData(suspended)).toEqual({
      id: profile.id,
      isActive: false,
    });
    expect(noop.status).toBe(200);
    expect(responseData(noop)).toEqual({ id: profile.id, isActive: false });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorUserId: admin.userId,
      action: 'AGENT_PROFILE_DEACTIVATED',
      entityType: 'AGENT_PROFILE',
      entityId: profile.id,
    });
    expect(nested(audits[0]?.metadata)).toEqual({
      previousIsActive: true,
      nextIsActive: false,
      reason: 'Platform kurali',
    });
    expect(numberOf(nested(responseData(detail).managementEvents).total)).toBe(
      1,
    );
    expect(events[0]?.action).toBe('AGENT_PROFILE_DEACTIVATED');
    expect(events[0]?.actorUserId).toBe(admin.userId);
    expect(activated.status).toBe(200);
    expect(noopActive.status).toBe(200);
    expect(auditCount).toBe(2);
    expect(versionAfter.tokenVersion).toBe(versionBefore.tokenVersion);
    expect(versionAfter.isActive).toBe(true);
    expect(versionAfter.role).toBe(Role.AGENT);
    expect(stillSignedIn.status).toBe(200);
    expect([left.status, right.status].every((status) => status === 200)).toBe(
      true,
    );
    expect(racedAudits.length).toBeGreaterThan(0);
    for (const audit of racedAudits) {
      const metadata = nested(audit.metadata);
      expect(metadata.previousIsActive).toBe(previous);
      previous = metadata.nextIsActive === true;
    }
    expect(previous).toBe(raced.isActive);
    expect(racedUser.tokenVersion).toBe(0);
    expect(racedUser.role).toBe(Role.AGENT);
    expect(racedUser.isActive).toBe(true);
    expect(cappedItems).toHaveLength(10);
    expect(numberOf(cappedEvents.total)).toBe(11);
  });

  it('rolls the profile change back when the audit write fails', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner);
    const audit = app.get(AuditService);
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValue(new Error('audit failed'));

    try {
      const response = await http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(admin.token))
        .send({ isActive: false, reason });
      const stored = await prisma.agentProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });
      const audits = await prisma.auditLog.count({
        where: { entityType: 'AGENT_PROFILE', entityId: profile.id },
      });

      expect(response.status).toBe(500);
      expect(stored.isActive).toBe(true);
      expect(audits).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects the status change when the admin loses access while the profile lock is held', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner);
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM agent_profiles WHERE id = ${profile.id}::uuid FOR UPDATE
        `;
        await released;
      },
      { timeout: 20000 },
    );
    let response: Response;

    try {
      await waitForGrantedLock(prisma);
      const pending = http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(admin.token))
        .send({ isActive: false, reason: 'Kilit altinda yetki' });
      const gate = await Promise.race([
        pending.then((result) => ({
          kind: 'done' as const,
          status: result.status,
          body: result.body as unknown,
        })),
        waitForWaitingLock(prisma).then(() => ({ kind: 'waiting' as const })),
      ]);

      if (gate.kind === 'done') {
        throw new Error(
          `status request finished without waiting: ${gate.status} ${JSON.stringify(gate.body)}`,
        );
      }
      await prisma.user.update({
        where: { id: admin.userId },
        data: { isActive: false },
      });
      release();
      response = await pending;
    } finally {
      release();
      await holder;
    }
    const stored = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    const audits = await prisma.auditLog.count({
      where: { entityType: 'AGENT_PROFILE', entityId: profile.id },
    });

    expect(response.status).toBe(403);
    expect(stored.isActive).toBe(true);
    expect(audits).toBe(0);
  }, 20000);

  it('lets a profile lock decide the write that overlaps suspension', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner);
    const city = `Faz341Loc-${owner.userId.slice(0, 8)}`;
    const uploadedLogo = await http()
      .post('/api/v1/agents/me/logo')
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      });
    const logoFileId =
      text(responseData(uploadedLogo).logoUrl).split('/').pop() ?? '';
    fileIds.push(logoFileId);
    const created = await postProfessional(owner.token, city);
    const id = text(responseData(created).id);
    const firstImage = await http()
      .post(`/api/v1/properties/${id}/images`)
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'first.jpg',
        contentType: 'image/jpeg',
      });
    const firstImageId = text(responseData(firstImage).id);
    const firstImageFileId =
      text(responseData(firstImage).url).split('/').pop() ?? '';
    fileIds.push(firstImageFileId);
    const before = await prisma.property.count({
      where: { agentProfileId: profile.id, deletedAt: null },
    });
    const [suspended, raced] = await Promise.all([
      http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(admin.token))
        .send({ isActive: false, reason: 'Yazi yarisi' }),
      postProfessional(owner.token, city, { title: 'Yaris ilani' }),
    ]);
    const after = await prisma.property.count({
      where: { agentProfileId: profile.id, deletedAt: null },
    });
    const profileRow = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    const updateDenied = await http()
      .patch(`/api/v1/properties/${id}`)
      .set(authOf(owner.token))
      .send({ title: 'Askidayken degismemeli' });
    const statusDenied = await http()
      .patch(`/api/v1/properties/${id}/status`)
      .set(authOf(owner.token))
      .send({ status: 'INACTIVE' });
    const deleteDenied = await http()
      .delete(`/api/v1/properties/${id}`)
      .set(authOf(owner.token));
    const imageUploadDenied = await http()
      .post(`/api/v1/properties/${id}/images`)
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'blocked.jpg',
        contentType: 'image/jpeg',
      });
    const coverDenied = await http()
      .patch(`/api/v1/properties/${id}/images/${firstImageId}/cover`)
      .set(authOf(owner.token));
    const orderDenied = await http()
      .patch(`/api/v1/properties/${id}/images/order`)
      .set(authOf(owner.token))
      .send({ imageIds: [firstImageId] });
    const imageDeleteDenied = await http()
      .delete(`/api/v1/properties/${id}/images/${firstImageId}`)
      .set(authOf(owner.token));
    const profileDenied = await http()
      .patch('/api/v1/agents/me')
      .set(authOf(owner.token))
      .send({ companyName: 'Askida Unvan' });
    const logoDenied = await http()
      .post('/api/v1/agents/me/logo')
      .set(authOf(owner.token))
      .attach('file', jpeg, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      });
    const readable = await http()
      .get('/api/v1/properties/me')
      .set(authOf(owner.token));
    const readableDetail = await http()
      .get(`/api/v1/properties/me/${id}`)
      .set(authOf(owner.token));
    const readablePropertyImage = await http()
      .get(`/api/v1/properties/me/files/${firstImageFileId}`)
      .set(authOf(owner.token));
    const readableProfile = await http()
      .get('/api/v1/agents/me')
      .set(authOf(owner.token));
    const readableOwnedLogo = await http()
      .get(`/api/v1/agents/me/files/${logoFileId}`)
      .set(authOf(owner.token));
    const again = await postProfessional(owner.token, city);
    const restored = await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(authOf(admin.token))
      .send({ isActive: true, reason: 'Yazi tekrar acildi' });
    const allowed = await http()
      .patch(`/api/v1/properties/${id}`)
      .set(authOf(owner.token))
      .send({ title: 'Tekrar yazilabilir ilan' });

    // Edit listing race with suspend
    const [suspendForEdit, racedEdit] = await Promise.all([
      http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(admin.token))
        .send({ isActive: false, reason: 'Duzenleme yarisi' }),
      http()
        .patch(`/api/v1/properties/${id}`)
        .set(authOf(owner.token))
        .send({ title: 'Yarisan duzenleme' }),
    ]);
    await http()
      .patch(`/api/v1/admin/agents/${profile.id}/status`)
      .set(authOf(admin.token))
      .send({ isActive: true, reason: 'Profil yarisi oncesi acildi' });

    // Edit profile race with suspend
    const [suspendForProfile, racedProfile] = await Promise.all([
      http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(admin.token))
        .send({ isActive: false, reason: 'Profil guncelleme yarisi' }),
      http()
        .patch('/api/v1/agents/me')
        .set(authOf(owner.token))
        .send({ companyName: 'Yarisan Firma' }),
    ]);
    const afterEditTitle = (
      await prisma.property.findUniqueOrThrow({ where: { id } })
    ).title;
    const afterProfileName = (
      await prisma.agentProfile.findUniqueOrThrow({ where: { id: profile.id } })
    ).companyName;

    expect(suspended.status).toBe(200);
    expect(profileRow.isActive).toBe(false);
    if (raced.status === 201) {
      expect(after).toBe(before + 1);
    } else {
      expect(raced.status).toBe(403);
      expect(after).toBe(before);
    }
    expect(updateDenied.status).toBe(403);
    expect(statusDenied.status).toBe(403);
    expect(deleteDenied.status).toBe(403);
    expect(imageUploadDenied.status).toBe(403);
    expect(coverDenied.status).toBe(403);
    expect(orderDenied.status).toBe(403);
    expect(imageDeleteDenied.status).toBe(403);
    expect(profileDenied.status).toBe(403);
    expect(logoDenied.status).toBe(403);
    expect(readable.status).toBe(200);
    expect(readableDetail.status).toBe(200);
    expect(readablePropertyImage.status).toBe(200);
    expect(readableProfile.status).toBe(200);
    expect(readableOwnedLogo.status).toBe(200);
    expect(again.status).toBe(403);
    expect(restored.status).toBe(200);
    expect(allowed.status).toBe(200);
    expect(suspendForEdit.status).toBe(200);
    expect([200, 403]).toContain(racedEdit.status);
    expect(afterEditTitle).toBe(
      racedEdit.status === 200
        ? 'Yarisan duzenleme'
        : 'Tekrar yazilabilir ilan',
    );
    expect(suspendForProfile.status).toBe(200);
    expect([200, 403]).toContain(racedProfile.status);
    expect(afterProfileName).toBe(
      racedProfile.status === 200 ? 'Yarisan Firma' : 'Faz341 Firma',
    );
  });

  it('serializes concurrent user deactivation with agent writes and admin actor revocation', async () => {
    const superAdmin = await createAccount(Role.ADMIN);
    const actingAdmin = await createAccount(Role.ADMIN);
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner, {
      slug: `faz341-userlock-1-${owner.userId}`,
    });
    const city = `Faz341Loc-${owner.userId.slice(0, 8)}`;
    const created = await postProfessional(owner.token, city, {
      title: 'Baslangic Ilani',
    });
    const propertyId = text(responseData(created).id);

    // 1) AGENT mutation passes lockActiveAgent (holding users FOR SHARE) and waits on property lock.
    // Concurrent user deactivation MUST wait for the in-flight AGENT transaction to finish rather than
    // committing User.isActive = false underneath it.
    let releaseProperty: () => void = () => undefined;
    const propertyReleased = new Promise<void>((resolve) => {
      releaseProperty = resolve;
    });
    let markPropertyHeld: () => void = () => undefined;
    const propertyHeld = new Promise<void>((resolve) => {
      markPropertyHeld = resolve;
    });
    const propertyHolder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE
        `;
        markPropertyHeld();
        await propertyReleased;
      },
      { timeout: 20000 },
    );

    let editResponse: Response;
    let deactivateResponse: Response;

    try {
      await propertyHeld;
      const pendingEdit = http()
        .patch(`/api/v1/properties/${propertyId}`)
        .set(authOf(owner.token))
        .send({ title: 'Aktifken Baslayan Duzenleme' })
        .then((result) => result);

      await waitForWaitingQuery(prisma, 'properties', 'FOR UPDATE');

      const pendingDeactivate = http()
        .patch(`/api/v1/admin/users/${owner.userId}/status`)
        .set(authOf(superAdmin.token))
        .send({ isActive: false })
        .then((result) => result);

      const gate = await Promise.race([
        pendingDeactivate.then((result) => ({
          kind: 'done' as const,
          status: result.status,
        })),
        delay(300).then(() => ({ kind: 'waiting' as const })),
      ]);

      expect(gate.kind).toBe('waiting');
      releaseProperty();
      [editResponse, deactivateResponse] = await Promise.all([
        pendingEdit,
        pendingDeactivate,
      ]);
    } finally {
      releaseProperty();
      await propertyHolder;
    }

    const updatedProp = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    const deactivatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });

    expect(editResponse.status).toBe(200);
    expect(deactivateResponse.status).toBe(200);
    expect(updatedProp.title).toBe('Aktifken Baslayan Duzenleme');
    expect(deactivatedUser.isActive).toBe(false);

    // 2) Once user deactivation commits while AGENT mutation is waiting on users FOR SHARE,
    // the waiting AGENT mutation MUST abort with 401 and persist zero changes.
    const secondOwner = await createAccount(Role.AGENT);
    await createProfile(secondOwner, {
      slug: `faz341-userlock-2-${secondOwner.userId}`,
    });
    const secondCity = `Faz341Loc-${secondOwner.userId.slice(0, 8)}`;
    const secondCreated = await postProfessional(
      secondOwner.token,
      secondCity,
      {
        title: 'Kilitli Kalacak Ilan',
      },
    );
    const secondPropertyId = text(responseData(secondCreated).id);

    let blockedEdit: Response;
    let releaseUserGate: () => void = () => undefined;
    const userGatePromise = new Promise<void>((resolve) => {
      releaseUserGate = resolve;
    });
    let markUserHeld: () => void = () => undefined;
    const userHeld = new Promise<void>((resolve) => {
      markUserHeld = resolve;
    });
    const userGate = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM users WHERE id = ${secondOwner.userId}::uuid FOR UPDATE
        `;
        markUserHeld();
        await userGatePromise;
        await tx.user.update({
          where: { id: secondOwner.userId },
          data: { isActive: false, tokenVersion: { increment: 1 } },
        });
      },
      { timeout: 20000 },
    );

    try {
      await userHeld;
      const pendingBlockedEdit = http()
        .patch(`/api/v1/properties/${secondPropertyId}`)
        .set(authOf(secondOwner.token))
        .send({ title: 'Pasif Hesapla Degismemeli' })
        .then((result) => result);
      await waitForWaitingQuery(prisma, 'users', 'FOR SHARE');
      releaseUserGate();
      await userGate;
      blockedEdit = await pendingBlockedEdit;
    } finally {
      releaseUserGate();
      await userGate.catch(() => undefined);
    }

    const unchangedSecond = await prisma.property.findUniqueOrThrow({
      where: { id: secondPropertyId },
    });
    expect(blockedEdit.status).toBe(401);
    expect(unchangedSecond.title).toBe('Kilitli Kalacak Ilan');

    // 3) Admin actor deactivation via API while AgentsService.setActive waits on profile lock
    let releaseProfile: () => void = () => undefined;
    const profileReleased = new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });
    let markProfileHeld: () => void = () => undefined;
    const profileHeld = new Promise<void>((resolve) => {
      markProfileHeld = resolve;
    });
    const profileHolder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM agent_profiles WHERE id = ${profile.id}::uuid FOR UPDATE
        `;
        markProfileHeld();
        await profileReleased;
      },
      { timeout: 20000 },
    );

    let revokedStatusCall: Response;
    let adminRevokeCall: Response;

    try {
      await profileHeld;
      const pendingSetActive = http()
        .patch(`/api/v1/admin/agents/${profile.id}/status`)
        .set(authOf(actingAdmin.token))
        .send({ isActive: false, reason: 'API ile eszamanli yetki kaybi' })
        .then((result) => result);
      await waitForWaitingLock(prisma);

      adminRevokeCall = await http()
        .patch(`/api/v1/admin/users/${actingAdmin.userId}/status`)
        .set(authOf(superAdmin.token))
        .send({ isActive: false });
      releaseProfile();
      revokedStatusCall = await pendingSetActive;
    } finally {
      releaseProfile();
      await profileHolder;
    }

    const finalProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    expect(adminRevokeCall.status).toBe(200);
    expect(revokedStatusCall.status).toBe(403);
    expect(finalProfile.isActive).toBe(true);
  }, 25000);

  it('returns global agent counters and a profile created series', async () => {
    const admin = await createAccount(Role.ADMIN);
    const auth = authOf(admin.token);
    const before = await http().get('/api/v1/admin/agents/summary').set(auth);
    const beforeDays = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2017-04-04',
        createdTo: '2017-04-06',
        bucket: 'day',
      });
    const beforeMonths = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2017-03-01',
        createdTo: '2017-05-01',
        bucket: 'month',
      });
    const owner = await createAccount(Role.AGENT);
    const profile = await createProfile(owner, {
      companyName: 'Faz341 Sayac',
      city: `Faz341Sehir${owner.userId.slice(0, 8)}`,
      createdAt: new Date('2017-04-04T15:00:00.000Z'),
    });
    const after = await http().get('/api/v1/admin/agents/summary').set(auth);
    const days = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2017-04-04',
        createdTo: '2017-04-06',
        bucket: 'day',
      });
    const months = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2017-03-01',
        createdTo: '2017-05-01',
        bucket: 'month',
      });
    const emptyRange = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2098-01-01',
        createdTo: '2098-01-03',
        bucket: 'day',
      });
    const page = await http()
      .get('/api/v1/admin/agents')
      .set(auth)
      .query({ userId: owner.userId, limit: 1 });
    const missing = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({ createdFrom: '2017-04-04', bucket: 'day' });
    const reversed = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2017-05-02',
        createdTo: '2017-05-01',
        bucket: 'day',
      });
    const tooWide = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2010-01-01',
        createdTo: '2012-01-02',
        bucket: 'day',
      });
    const tooManyMonths = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth)
      .query({
        createdFrom: '2010-01-01',
        createdTo: '2013-02-01',
        bucket: 'month',
      });
    const anonymous = await http().get('/api/v1/admin/agents/summary');
    const plain = await createAccount();
    const asUser = await http()
      .get('/api/v1/admin/agents/summary')
      .set(authOf(plain.token));
    const beforeBody = responseData(before);
    const afterBody = responseData(after);
    const beforeAccounts = nested(beforeBody.profileAccounts);
    const afterAccounts = nested(afterBody.profileAccounts);
    const beforeCities = nested(beforeBody.cities);
    const afterCities = nested(afterBody.cities);
    const dayCount = countAt(responseData(days), '2017-04-04T00:00:00.000Z');
    const beforeDay = countAt(
      responseData(beforeDays),
      '2017-04-04T00:00:00.000Z',
    );
    const emptyPoints = pointsOf(responseData(emptyRange));
    const cityItems = Array.isArray(afterCities.items) ? afterCities.items : [];
    const named = cityItems.reduce<number>(
      (sum, item) => sum + numberOf(nested(item).count),
      0,
    );

    expect(before.status).toBe(200);
    expect(beforeBody.created).toBeNull();
    expect(numberOf(beforeBody.total)).toBe(
      numberOf(beforeBody.active) + numberOf(beforeBody.suspended),
    );
    expect(numberOf(beforeBody.total)).toBe(
      numberOf(nested(beforeBody.accountStatuses).active) +
        numberOf(nested(beforeBody.accountStatuses).inactive),
    );
    expect(numberOf(afterBody.total)).toBe(numberOf(beforeBody.total) + 1);
    expect(numberOf(afterBody.active)).toBe(numberOf(beforeBody.active) + 1);
    expect(numberOf(afterBody.publiclyVisible)).toBe(
      numberOf(beforeBody.publiclyVisible) + 1,
    );
    expect(numberOf(afterAccounts.activeProfileActiveAccount)).toBe(
      numberOf(beforeAccounts.activeProfileActiveAccount) + 1,
    );
    expect(numberOf(afterBody.total)).toBe(numberOf(beforeBody.total) + 1);
    expect(dayCount).toBe(beforeDay + 1);
    expect(countAt(responseData(days), '2017-04-05T00:00:00.000Z')).toBe(
      countAt(responseData(beforeDays), '2017-04-05T00:00:00.000Z'),
    );
    expect(numberOf(nested(responseData(days).created).total)).toBe(
      pointsOf(responseData(days)).reduce(
        (sum, point) => sum + numberOf(point.count),
        0,
      ),
    );
    expect(countAt(responseData(months), '2017-04-01T00:00:00.000Z')).toBe(
      countAt(responseData(beforeMonths), '2017-04-01T00:00:00.000Z') + 1,
    );
    expect(numberOf(responseData(days).total)).toBe(numberOf(afterBody.total));
    expect(numberOf(responseData(emptyRange).total)).toBe(
      numberOf(afterBody.total),
    );
    expect(emptyPoints).toHaveLength(3);
    expect(emptyPoints.every((point) => point.count === 0)).toBe(true);
    expect(numberOf(nested(responseData(emptyRange).created).total)).toBe(0);
    expect(numberOf(responseData(page).total)).toBe(1);
    expect(listItems(page)).toHaveLength(1);
    expect(numberOf(afterBody.total)).not.toBe(listItems(page).length);
    expect(
      named +
        numberOf(afterCities.otherCount) +
        numberOf(afterCities.blankCount),
    ).toBe(numberOf(afterBody.total));
    expect(numberOf(afterCities.distinctCount)).toBe(
      numberOf(beforeCities.distinctCount) + 1,
    );
    expect(numberOf(beforeCities.blankCount)).toBe(
      numberOf(afterCities.blankCount),
    );
    expect(missing.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(tooWide.status).toBe(400);
    expect(tooManyMonths.status).toBe(400);
    expect(anonymous.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(profile.city.startsWith('Faz341Sehir')).toBe(true);

    // Create the remaining 3 profile/account combinations + blank city and verify deltas
    const activeProfileInactiveUser = await createAccount(Role.AGENT);
    await prisma.user.update({
      where: { id: activeProfileInactiveUser.userId },
      data: { isActive: false },
    });
    await createProfile(activeProfileInactiveUser, {
      slug: `faz341-sum-apiu-${activeProfileInactiveUser.userId}`,
      city: '   ',
      isActive: true,
    });
    const suspendedProfileActiveUser = await createAccount(Role.AGENT);
    await createProfile(suspendedProfileActiveUser, {
      slug: `faz341-sum-spau-${suspendedProfileActiveUser.userId}`,
      city: `Faz341Sehir${suspendedProfileActiveUser.userId.slice(0, 8)}`,
      isActive: false,
    });
    const suspendedProfileInactiveUser = await createAccount(Role.AGENT);
    await prisma.user.update({
      where: { id: suspendedProfileInactiveUser.userId },
      data: { isActive: false },
    });
    await createProfile(suspendedProfileInactiveUser, {
      slug: `faz341-sum-spiu-${suspendedProfileInactiveUser.userId}`,
      city: `Faz341Sehir${suspendedProfileInactiveUser.userId.slice(0, 8)}`,
      isActive: false,
    });

    const matrixSummary = await http()
      .get('/api/v1/admin/agents/summary')
      .set(auth);
    const matrixBody = responseData(matrixSummary);
    const matrixAccounts = nested(matrixBody.profileAccounts);
    const matrixStatuses = nested(matrixBody.accountStatuses);
    const matrixCities = nested(matrixBody.cities);

    expect(matrixSummary.status).toBe(200);
    expect(numberOf(matrixBody.total)).toBe(numberOf(afterBody.total) + 3);
    expect(numberOf(matrixBody.active)).toBe(numberOf(afterBody.active) + 1);
    expect(numberOf(matrixBody.suspended)).toBe(
      numberOf(afterBody.suspended) + 2,
    );
    expect(numberOf(matrixBody.publiclyVisible)).toBe(
      numberOf(afterBody.publiclyVisible),
    );
    expect(numberOf(matrixStatuses.active)).toBe(
      numberOf(nested(afterBody.accountStatuses).active) + 1,
    );
    expect(numberOf(matrixStatuses.inactive)).toBe(
      numberOf(nested(afterBody.accountStatuses).inactive) + 2,
    );
    expect(numberOf(matrixAccounts.activeProfileActiveAccount)).toBe(
      numberOf(afterAccounts.activeProfileActiveAccount),
    );
    expect(numberOf(matrixAccounts.activeProfileInactiveAccount)).toBe(
      numberOf(afterAccounts.activeProfileInactiveAccount) + 1,
    );
    expect(numberOf(matrixAccounts.suspendedProfileActiveAccount)).toBe(
      numberOf(afterAccounts.suspendedProfileActiveAccount) + 1,
    );
    expect(numberOf(matrixAccounts.suspendedProfileInactiveAccount)).toBe(
      numberOf(afterAccounts.suspendedProfileInactiveAccount) + 1,
    );
    expect(numberOf(matrixCities.blankCount)).toBe(
      numberOf(afterCities.blankCount) + 1,
    );
  });

  it('enforces admin authorization and tokenVersion across all admin agent endpoints', async () => {
    const admin = await createAccount(Role.ADMIN);
    const revokedAdmin = await createAccount(Role.ADMIN);
    const secondAdmin = await createAccount(Role.ADMIN);
    const plainUser = await createAccount(Role.USER);
    const activeAgent = await createAccount(Role.AGENT);
    const suspendedAgent = await createAccount(Role.AGENT);
    const targetOwner = await createAccount(Role.AGENT);
    const targetProfile = await createProfile(targetOwner, {
      slug: `faz341-auth-target-${targetOwner.userId}`,
    });
    await createProfile(activeAgent, {
      slug: `faz341-auth-act-${activeAgent.userId}`,
    });
    await createProfile(suspendedAgent, {
      slug: `faz341-auth-sus-${suspendedAgent.userId}`,
      isActive: false,
    });
    const uploaded = await http()
      .post('/api/v1/agents/me/logo')
      .set(authOf(targetOwner.token))
      .attach('file', jpeg, {
        filename: 'auth-logo.jpg',
        contentType: 'image/jpeg',
      });
    const fileId = text(responseData(uploaded).logoUrl).split('/').pop() ?? '';
    fileIds.push(fileId);

    // Deactivate and reactivate revokedAdmin via API -> bumps tokenVersion so old token stays 401
    const deactivated = await http()
      .patch(`/api/v1/admin/users/${revokedAdmin.userId}/status`)
      .set(authOf(secondAdmin.token))
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const inactiveAdmin = await createAccount(Role.ADMIN);
    await prisma.user.update({
      where: { id: inactiveAdmin.userId },
      data: { isActive: false },
    });

    const paths = [
      { method: 'get' as const, url: '/api/v1/admin/agents' },
      { method: 'get' as const, url: '/api/v1/admin/agents/summary' },
      {
        method: 'get' as const,
        url: `/api/v1/admin/agents/${targetProfile.id}`,
      },
      {
        method: 'get' as const,
        url: `/api/v1/admin/agents/${targetProfile.id}/files/${fileId}`,
      },
      {
        method: 'patch' as const,
        url: `/api/v1/admin/agents/${targetProfile.id}/status`,
        body: { isActive: false, reason: 'Yetki testi' },
      },
    ];

    for (const entry of paths) {
      const send = (token?: string) => {
        const req =
          entry.method === 'get'
            ? http().get(entry.url)
            : http().patch(entry.url).send(entry.body);
        return token ? req.set(authOf(token)) : req;
      };

      expect((await send()).status).toBe(401);
      expect((await send(plainUser.token)).status).toBe(403);
      expect((await send(activeAgent.token)).status).toBe(403);
      expect((await send(suspendedAgent.token)).status).toBe(403);
      expect((await send(inactiveAdmin.token)).status).toBe(401);
      expect((await send(revokedAdmin.token)).status).toBe(401);
    }

    // Reactivate revokedAdmin -> old token STILL rejected because tokenVersion was bumped
    await http()
      .patch(`/api/v1/admin/users/${revokedAdmin.userId}/status`)
      .set(authOf(secondAdmin.token))
      .send({ isActive: true });
    expect(
      (await http().get('/api/v1/admin/agents').set(authOf(revokedAdmin.token)))
        .status,
    ).toBe(401);

    // Active admin succeeds on every endpoint
    expect(
      (await http().get('/api/v1/admin/agents').set(authOf(admin.token)))
        .status,
    ).toBe(200);
    expect(
      (
        await http()
          .get('/api/v1/admin/agents/summary')
          .set(authOf(admin.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .get(`/api/v1/admin/agents/${targetProfile.id}`)
          .set(authOf(admin.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .get(`/api/v1/admin/agents/${targetProfile.id}/files/${fileId}`)
          .set(authOf(admin.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .patch(`/api/v1/admin/agents/${targetProfile.id}/status`)
          .set(authOf(admin.token))
          .send({ isActive: false, reason: 'Aktif admin testi' })
      ).status,
    ).toBe(200);
  });
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGrantedLock(prisma: PrismaService) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await prisma.$queryRaw<Array<{ granted: number }>>`
      SELECT COUNT(*)::int AS granted
      FROM pg_locks
      WHERE relation = 'agent_profiles'::regclass
        AND granted
    `;

    if (Number(rows[0]?.granted) > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error('profile lock was not acquired');
}

async function waitForWaitingLock(prisma: PrismaService) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await prisma.$queryRaw<Array<{ waiting: number }>>`
      SELECT COUNT(*)::int AS waiting
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND query LIKE '%agent_profiles%'
        AND query LIKE '%FOR UPDATE%'
    `;

    if (Number(rows[0]?.waiting) > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error('status request did not wait on the profile lock');
}

async function waitForWaitingQuery(
  prisma: PrismaService,
  table: 'properties' | 'users',
  lockClause: 'FOR UPDATE' | 'FOR SHARE',
) {
  const tablePattern = `%${table}%`;
  const lockPattern = `%${lockClause}%`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await prisma.$queryRaw<Array<{ waiting: number }>>`
      SELECT COUNT(*)::int AS waiting
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND query LIKE ${tablePattern}
        AND query LIKE ${lockPattern}
    `;

    if (Number(rows[0]?.waiting) > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error(`request did not wait on ${table} ${lockClause}`);
}

function pointsOf(body: Record<string, unknown>) {
  const points = nestedRecord(body.created).points;

  return Array.isArray(points)
    ? points.filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
    : [];
}

function countAt(body: Record<string, unknown>, start: string) {
  const found = pointsOf(body).find((item) => item.bucketStart === start);

  return typeof found?.count === 'number' ? found.count : -1;
}

function nestedRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
