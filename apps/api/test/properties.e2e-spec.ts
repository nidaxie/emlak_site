import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { Role } from '../src/generated/prisma/enums';

const password = 'password123';

describe('Properties (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin = '';
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
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'phase4-' } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'phase4-' } },
      });
    }

    await app?.close();
  });

  function nextEmail() {
    sequence += 1;
    return `phase4-${Date.now()}-${sequence}@example.com`;
  }

  function label(name: string) {
    sequence += 1;
    return `${name} ${sequence}`;
  }

  function http() {
    return request(app.getHttpServer());
  }

  async function createAccount(role: Role = Role.USER) {
    const email = nextEmail();
    const registered = await http()
      .post('/api/v1/auth/register')
      .send({ email, password });
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
    const user = nested(body.user);

    return {
      email,
      token: text(body.accessToken),
      userId: text(user.id),
    };
  }

  async function createAgent() {
    const account = await createAccount(Role.AGENT);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: account.userId,
        slug: `phase4-${account.userId}`,
        companyName: 'Phase4 Emlak',
        phone: '+905551110000',
        email: account.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Ofis adresi 1',
      },
    });

    return { ...account, profileId: profile.id, slug: profile.slug };
  }

  function propertyBody(extra: Record<string, unknown> = {}) {
    return {
      title: 'Selcukluda 3+1 Satilik Daire',
      description: 'Genis ve aydinlik bir daire. Okula yakin.',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      price: 4250000.5,
      grossAreaM2: 145,
      netAreaM2: 125,
      rooms: 3,
      livingRooms: 1,
      buildingAge: 5,
      floor: 4,
      totalFloors: 8,
      heatingType: 'COMBI',
      address: 'Yazir Mahallesi 1',
      latitude: 37.87,
      longitude: 32.49,
      hasBalcony: true,
      hasElevator: true,
      hasParking: true,
      isFurnished: false,
      inSite: true,
      ...extra,
    };
  }

  async function ensurePlace(extra: Record<string, unknown> = {}) {
    const cityName = typeof extra.city === 'string' ? extra.city : 'Konya';
    const districtName =
      typeof extra.district === 'string' ? extra.district : 'Selcuklu';
    const neighborhoodName =
      typeof extra.neighborhood === 'string' ? extra.neighborhood : 'Yazir';
    const city = await prisma.city.upsert({
      where: { name: cityName },
      update: {},
      create: { name: cityName },
    });
    const district = await prisma.district.upsert({
      where: { cityId_name: { cityId: city.id, name: districtName } },
      update: {},
      create: { cityId: city.id, name: districtName },
    });
    const neighborhood = await prisma.neighborhood.upsert({
      where: {
        districtId_name: { districtId: district.id, name: neighborhoodName },
      },
      update: {},
      create: { districtId: district.id, name: neighborhoodName },
    });

    return {
      cityId: city.id,
      districtId: district.id,
      neighborhoodId: neighborhood.id,
    };
  }

  async function postProperty(
    token: string,
    extra: Record<string, unknown> = {},
  ) {
    const place = await ensurePlace(extra);
    const rest = { ...extra };
    delete rest.city;
    delete rest.district;
    delete rest.neighborhood;

    return http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...propertyBody(), ...rest, ...place });
  }

  it('lets an active agent create a listing and blocks everyone else', async () => {
    const agent = await createAgent();
    const user = await createAccount();
    const admin = await createAccount(Role.ADMIN);
    const inactiveAgent = await createAgent();
    const inactiveProfile = await createAgent();
    const city = label('CreateCity');
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const created = await postProperty(agent.token, { city });
    const body = responseData(created);
    const stored = await prisma.property.findUniqueOrThrow({
      where: { id: text(body.id) },
    });
    const userAttempt = await postProperty(user.token, { city });
    const adminAttempt = await postProperty(admin.token, { city });
    const spoof = await postProperty(agent.token, {
      city,
      agentProfileId: inactiveAgent.profileId,
    });
    const invalid = await postProperty(agent.token, {
      city,
      price: 0,
      latitude: 95,
      netAreaM2: 500,
    });
    await prisma.user.update({
      where: { id: inactiveAgent.userId },
      data: { isActive: false },
    });
    const inactiveUserAttempt = await postProperty(inactiveAgent.token, {
      city,
    });
    await prisma.agentProfile.update({
      where: { id: inactiveProfile.profileId },
      data: { isActive: false },
    });
    const inactiveProfileAttempt = await postProperty(inactiveProfile.token, {
      city,
    });
    const logText = logSpy.mock.calls.map((call) => String(call[0])).join('\n');

    expect(created.status).toBe(201);
    expect(body).toMatchObject({
      status: 'ACTIVE',
      currency: 'TRY',
      price: '4250000.50',
      grossAreaM2: '145.00',
      netAreaM2: '125.00',
      latitude: '37.870000',
      longitude: '32.490000',
      rooms: 3,
      livingRooms: 1,
      agentProfileId: agent.profileId,
      city,
    });
    expect(stored.price.toFixed(2)).toBe('4250000.50');
    expect(stored.agentProfileId).toBe(agent.profileId);
    expect(userAttempt.status).toBe(403);
    expect(adminAttempt.status).toBe(403);
    expect(spoof.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(inactiveUserAttempt.status).toBe(401);
    expect(inactiveProfileAttempt.status).toBe(403);
    expect(responseData(inactiveProfileAttempt).message).toBe(
      'Agent profile is inactive',
    );
    expect(
      await prisma.property.count({
        where: { agentProfileId: inactiveAgent.profileId },
      }),
    ).toBe(0);
    expect(logText).toContain(
      `property created propertyId=${text(body.id)} userId=${agent.userId}`,
    );
    expect(logText).not.toContain('Yazir Mahallesi 1');
    logSpy.mockRestore();
  });

  it('updates and deletes only the owning agent listing', async () => {
    const owner = await createAgent();
    const other = await createAgent();
    const created = await postProperty(owner.token, { city: label('Own') });
    const id = text(responseData(created).id);
    const updated = await http()
      .patch(`/api/v1/properties/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Yeni baslik burada', price: 10.5 });
    const forbiddenField = await http()
      .patch(`/api/v1/properties/${id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ agentProfileId: other.profileId, status: 'SOLD' });
    const crossUpdate = await http()
      .patch(`/api/v1/properties/${id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Baska emlakci' });
    const crossRead = await http()
      .get(`/api/v1/properties/me/${id}`)
      .set('Authorization', `Bearer ${other.token}`);
    const crossDelete = await http()
      .delete(`/api/v1/properties/${id}`)
      .set('Authorization', `Bearer ${other.token}`);
    const mine = await http()
      .get('/api/v1/properties/me')
      .query({ status: 'ACTIVE' })
      .set('Authorization', `Bearer ${owner.token}`);
    const removed = await http()
      .delete(`/api/v1/properties/${id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    const after = await prisma.property.findUniqueOrThrow({ where: { id } });
    const mineAfter = await http()
      .get('/api/v1/properties/me')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      title: 'Yeni baslik burada',
      price: '10.50',
      agentProfileId: owner.profileId,
    });
    expect(forbiddenField.status).toBe(400);
    expect(crossUpdate.status).toBe(404);
    expect(crossRead.status).toBe(404);
    expect(crossDelete.status).toBe(404);
    expect(listItems(mine).some((item) => item.id === id)).toBe(true);
    expect(removed.status).toBe(200);
    expect(responseData(removed).id).toBe(id);
    expect(after.deletedAt).toEqual(expect.any(Date));
    expect(after.agentProfileId).toBe(owner.profileId);
    expect(listItems(mineAfter).some((item) => item.id === id)).toBe(false);
    expect((await http().get(`/api/v1/properties/${id}`)).status).toBe(404);
  });

  it('hides inactive, sold, rented, deleted, and inactive owner listings', async () => {
    const agent = await createAgent();
    const hiddenProfile = await createAgent();
    const hiddenUser = await createAgent();
    const city = label('Visible');
    const active = await postProperty(agent.token, {
      city,
      title: 'Aktif ilan burada',
    });
    const inactive = await postProperty(agent.token, {
      city,
      title: 'Pasif ilan burada',
    });
    const sold = await postProperty(agent.token, {
      city,
      title: 'Satilan ilan burada',
    });
    const rented = await postProperty(agent.token, {
      city,
      title: 'Kiralanan ilan burada',
    });
    const deleted = await postProperty(agent.token, {
      city,
      title: 'Silinen ilan burada',
    });
    const profileHidden = await postProperty(hiddenProfile.token, {
      city,
      title: 'Profil pasif ilan',
    });
    const userHidden = await postProperty(hiddenUser.token, {
      city,
      title: 'Hesap pasif ilan',
    });
    const activeId = text(responseData(active).id);
    const inactiveId = text(responseData(inactive).id);
    const soldId = text(responseData(sold).id);
    const rentedId = text(responseData(rented).id);
    const deletedId = text(responseData(deleted).id);
    const profileHiddenId = text(responseData(profileHidden).id);
    const userHiddenId = text(responseData(userHidden).id);

    expect(
      (
        await http()
          .patch(`/api/v1/properties/${inactiveId}/status`)
          .set('Authorization', `Bearer ${agent.token}`)
          .send({ status: 'INACTIVE' })
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .patch(`/api/v1/properties/${soldId}/status`)
          .set('Authorization', `Bearer ${agent.token}`)
          .send({ status: 'SOLD' })
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .patch(`/api/v1/properties/${rentedId}/status`)
          .set('Authorization', `Bearer ${agent.token}`)
          .send({ status: 'RENTED' })
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .delete(`/api/v1/properties/${deletedId}`)
          .set('Authorization', `Bearer ${agent.token}`)
      ).status,
    ).toBe(200);
    await prisma.agentProfile.update({
      where: { id: hiddenProfile.profileId },
      data: { isActive: false },
    });
    await prisma.user.update({
      where: { id: hiddenUser.userId },
      data: { isActive: false },
    });

    const list = await http().get('/api/v1/properties').query({ city });
    const ids = listItems(list).map((item) => item.id);
    const detail = await http().get(`/api/v1/properties/${activeId}`);
    const detailBody = responseData(detail);

    expect(list.status).toBe(200);
    expect(ids).toEqual([activeId]);
    expect(detail.status).toBe(200);
    expect(nested(detailBody.agent)).toMatchObject({
      slug: agent.slug,
      companyName: 'Phase4 Emlak',
      phone: '+905551110000',
      logoUrl: null,
    });
    expect(detailBody.passwordHash).toBeUndefined();
    expect(detailBody.agentProfileId).toBeUndefined();
    for (const hiddenId of [
      inactiveId,
      soldId,
      rentedId,
      deletedId,
      profileHiddenId,
      userHiddenId,
    ]) {
      expect((await http().get(`/api/v1/properties/${hiddenId}`)).status).toBe(
        404,
      );
    }
  });

  it('filters, sorts, and paginates the public list', async () => {
    const agent = await createAgent();
    const city = label('Filtertown');
    const apartment = await postProperty(agent.token, {
      city,
      district: 'Merkez',
      neighborhood: 'Bir',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      price: 1000000,
      grossAreaM2: 120,
      netAreaM2: 100,
      rooms: 3,
      livingRooms: 1,
    });
    const house = await postProperty(agent.token, {
      city,
      district: 'Merkez',
      neighborhood: 'Iki',
      listingType: 'RENT',
      propertyType: 'HOUSE',
      price: 20000,
      grossAreaM2: 80,
      netAreaM2: 70,
      rooms: 2,
      livingRooms: 1,
    });
    const land = await postProperty(agent.token, {
      city,
      district: 'Kirsal',
      neighborhood: 'Bir',
      listingType: 'SALE',
      propertyType: 'LAND',
      price: 500000,
      grossAreaM2: 400,
      rooms: 0,
      livingRooms: 0,
    });
    const apartmentId = text(responseData(apartment).id);
    const houseId = text(responseData(house).id);
    const landId = text(responseData(land).id);
    const sale = await http()
      .get('/api/v1/properties')
      .query({ city, listingType: 'SALE' });
    const houses = await http()
      .get('/api/v1/properties')
      .query({ city, propertyType: 'HOUSE' });
    const district = await http()
      .get('/api/v1/properties')
      .query({ city, district: 'Merkez' });
    const neighborhood = await http()
      .get('/api/v1/properties')
      .query({ city, neighborhood: 'Bir' });
    const price = await http()
      .get('/api/v1/properties')
      .query({ city, minPrice: 100000, maxPrice: 600000 });
    const rooms = await http()
      .get('/api/v1/properties')
      .query({ city, rooms: 3, livingRooms: 1 });
    const area = await http()
      .get('/api/v1/properties')
      .query({ city, minArea: 100, maxArea: 150 });
    const sorted = await http()
      .get('/api/v1/properties')
      .query({ city, sort: 'price_asc' });
    const badSort = await http()
      .get('/api/v1/properties')
      .query({ city, sort: 'price;drop' });
    const page = await http()
      .get('/api/v1/properties')
      .query({ city, sort: 'price_asc', page: 1, limit: 1 });
    const nextPage = await http()
      .get('/api/v1/properties')
      .query({ city, sort: 'price_asc', page: 2, limit: 1 });

    expect(idsOf(sale)).toEqual(expect.arrayContaining([apartmentId, landId]));
    expect(idsOf(sale)).not.toContain(houseId);
    expect(idsOf(houses)).toEqual([houseId]);
    expect(idsOf(district).sort()).toEqual([apartmentId, houseId].sort());
    expect(idsOf(neighborhood).sort()).toEqual([apartmentId, landId].sort());
    expect(idsOf(price)).toEqual([landId]);
    expect(idsOf(rooms)).toEqual([apartmentId]);
    expect(idsOf(area)).toEqual([apartmentId]);
    expect(idsOf(sorted)).toEqual([houseId, landId, apartmentId]);
    expect(badSort.status).toBe(400);
    expect(page.status).toBe(200);
    expect(listItems(page)).toHaveLength(1);
    expect(responseData(page).total).toBe(3);
    expect(responseData(page).limit).toBe(1);
    expect(idsOf(page)[0]).not.toBe(idsOf(nextPage)[0]);
  });

  it('enforces status transitions and serializes concurrent changes', async () => {
    const agent = await createAgent();
    const city = label('Status');
    const created = await postProperty(agent.token, { city });
    const id = text(responseData(created).id);
    const sold = await http()
      .patch(`/api/v1/properties/${id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'SOLD' });

    expect(sold.status).toBe(200);
    expect(responseData(sold).status).toBe('SOLD');
    expect(
      idsOf(await http().get('/api/v1/properties').query({ city })),
    ).not.toContain(id);

    const invalid = await http()
      .patch(`/api/v1/properties/${id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'RENTED' });
    const relisted = await http()
      .patch(`/api/v1/properties/${id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'ACTIVE' });
    const same = await http()
      .patch(`/api/v1/properties/${id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'ACTIVE' });
    const raceTarget = await postProperty(agent.token, { city: label('Race') });
    const raceId = text(responseData(raceTarget).id);
    const race = await Promise.all([
      http()
        .patch(`/api/v1/properties/${raceId}/status`)
        .set('Authorization', `Bearer ${agent.token}`)
        .send({ status: 'SOLD' }),
      http()
        .patch(`/api/v1/properties/${raceId}/status`)
        .set('Authorization', `Bearer ${agent.token}`)
        .send({ status: 'INACTIVE' }),
    ]);
    const stored = await prisma.property.findUniqueOrThrow({
      where: { id: raceId },
    });

    expect(invalid.status).toBe(409);
    expect(responseData(invalid).message).toBe('Invalid status transition');
    expect(relisted.status).toBe(200);
    expect(
      idsOf(await http().get('/api/v1/properties').query({ city })),
    ).toContain(id);
    expect(same.status).toBe(409);
    expect(race.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(['SOLD', 'INACTIVE']).toContain(stored.status);
  });

  it('lets an admin review, deactivate, and soft-delete any listing', async () => {
    const admin = await createAccount(Role.ADMIN);
    const agent = await createAgent();
    const user = await createAccount();
    const city = label('AdminCity');
    const created = await postProperty(agent.token, { city });
    const id = text(responseData(created).id);
    const userList = await http()
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${user.token}`);
    const agentList = await http()
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${agent.token}`);
    const adminList = await http()
      .get('/api/v1/admin/properties')
      .query({ city, status: 'ACTIVE' })
      .set('Authorization', `Bearer ${admin.token}`);
    const detail = await http()
      .get(`/api/v1/admin/properties/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: agent.userId },
    });
    const deactivated = await http()
      .patch(`/api/v1/admin/properties/${id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Ilan kurali ihlali' });
    const again = await http()
      .patch(`/api/v1/admin/properties/${id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Ilan kurali ihlali' });
    const removed = await http()
      .delete(`/api/v1/admin/properties/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Ilan kurali ihlali' });
    const deletedList = await http()
      .get('/api/v1/admin/properties')
      .query({ city, deleted: 'true' })
      .set('Authorization', `Bearer ${admin.token}`);
    const secondDelete = await http()
      .delete(`/api/v1/admin/properties/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Ilan kurali ihlali' });
    const profile = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: agent.profileId },
    });
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: agent.userId },
    });

    expect(userList.status).toBe(403);
    expect(agentList.status).toBe(403);
    expect(idsOf(adminList)).toContain(id);
    expect(detail.status).toBe(200);
    expect(nested(responseData(detail).agent).slug).toBe(agent.slug);
    expect(nested(nested(responseData(detail).agent).user).passwordHash).toBe(
      undefined,
    );
    expect(JSON.stringify(responseData(detail))).not.toContain(
      storedUser.passwordHash,
    );
    expect(deactivated.status).toBe(200);
    expect(responseData(deactivated).status).toBe('INACTIVE');
    expect(
      idsOf(await http().get('/api/v1/properties').query({ city })),
    ).not.toContain(id);
    expect(again.status).toBe(409);
    expect(removed.status).toBe(200);
    expect(idsOf(deletedList)).toEqual([id]);
    expect((await http().get(`/api/v1/properties/${id}`)).status).toBe(404);
    expect(secondDelete.status).toBe(404);
    expect(profile.id).toBe(agent.profileId);
    expect(account.role).toBe('AGENT');
    expect(account.isActive).toBe(true);
  });
});

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

function listItems(response: Response) {
  const value = responseData(response).items;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => nested(item));
}

function idsOf(response: Response) {
  return listItems(response).map((item) => text(item.id));
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}
