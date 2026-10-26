import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { Role } from '../src/generated/prisma/enums';

const password = 'password123';

describe('Public web backend (e2e)', () => {
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
      where: { email: { startsWith: 'phase6-' } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'phase6-' } },
      });
      const cities = await prisma.city.findMany({
        where: { name: { startsWith: 'Phase6 ' } },
        select: { id: true },
      });
      const cityIds = cities.map((city) => city.id);

      if (cityIds.length > 0) {
        await prisma.neighborhood.deleteMany({
          where: { district: { cityId: { in: cityIds } } },
        });
        await prisma.district.deleteMany({
          where: { cityId: { in: cityIds } },
        });
        await prisma.city.deleteMany({ where: { id: { in: cityIds } } });
      }
    }

    await app?.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  function email() {
    sequence += 1;
    return `phase6-${Date.now()}-${sequence}@example.com`;
  }

  async function account(role: Role = Role.USER) {
    const address = email();
    const registered = await http()
      .post('/api/v1/auth/register')
      .send({ email: address, password });
    expect(registered.status).toBe(201);

    if (role !== Role.USER) {
      await prisma.user.update({ where: { email: address }, data: { role } });
    }

    const loggedIn = await http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: address, password });
    expect(loggedIn.status).toBe(200);
    const body = record(loggedIn.body);

    return {
      email: address,
      token: text(body.accessToken),
      userId: text(record(body.user).id),
    };
  }

  async function agent() {
    const owner = await account(Role.AGENT);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: owner.userId,
        slug: `phase6-${owner.userId}`,
        companyName: 'Phase6 Emlak',
        phone: '+905551110000',
        email: owner.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Ofis adresi 1',
      },
    });

    return { ...owner, profileId: profile.id, slug: profile.slug };
  }

  async function place() {
    sequence += 1;
    const stamp = `${Date.now()} ${sequence}`;
    const city = await prisma.city.create({
      data: { name: `Phase6 ${stamp}` },
    });
    const district = await prisma.district.create({
      data: { cityId: city.id, name: 'Merkez' },
    });
    const neighborhood = await prisma.neighborhood.create({
      data: { districtId: district.id, name: 'Bir' },
    });

    return {
      city: city.name,
      cityId: city.id,
      districtId: district.id,
      neighborhoodId: neighborhood.id,
    };
  }

  async function listing(
    token: string,
    location: Awaited<ReturnType<typeof place>>,
    extra: Record<string, unknown> = {},
  ) {
    const created = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Selcukluda 3+1 Satilik Daire',
        description: 'Genis ve aydinlik bir daire. Okula yakin.',
        listingType: 'SALE',
        propertyType: 'APARTMENT',
        price: 1000000,
        grossAreaM2: 100,
        netAreaM2: 80,
        rooms: 3,
        livingRooms: 1,
        address: 'Deneme adresi 1',
        latitude: 37.87,
        longitude: 32.49,
        cityId: location.cityId,
        districtId: location.districtId,
        neighborhoodId: location.neighborhoodId,
        ...extra,
      });
    expect(created.status).toBe(201);

    return text(record(created.body).id);
  }

  it('lets every active role favorite a public listing and keeps the action idempotent', async () => {
    const owner = await agent();
    const location = await place();
    const propertyId = await listing(owner.token, location);
    const user = await account(Role.USER);
    const agentFan = await account(Role.AGENT);
    const admin = await account(Role.ADMIN);
    const anonymous = await http().post(`/api/v1/favorites/${propertyId}`);
    const added = await http()
      .post(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${user.token}`);
    const again = await http()
      .post(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${user.token}`);
    const byAgent = await http()
      .post(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${agentFan.token}`);
    const byAdmin = await http()
      .post(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const removed = await http()
      .delete(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${agentFan.token}`);
    const userStill = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${user.token}`);
    const missing = await http()
      .delete(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${user.token}`);
    const afterDelete = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${user.token}`);

    expect(anonymous.status).toBe(401);
    expect(added.status).toBe(200);
    expect(record(added.body).propertyId).toBe(propertyId);
    expect(again.status).toBe(200);
    expect(record(again.body).createdAt).toBe(record(added.body).createdAt);
    expect(byAgent.status).toBe(200);
    expect(byAdmin.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(rows(record(userStill.body).items).map((item) => item.id)).toEqual([
      propertyId,
    ]);
    expect(record(rows(record(userStill.body).items)[0]).isFavorite).toBe(true);
    expect(missing.status).toBe(200);
    expect(rows(record(afterDelete.body).items)).toEqual([]);
  });

  it('rejects favorites for listings that are not publicly visible', async () => {
    const owner = await agent();
    const location = await place();
    const inactiveId = await listing(owner.token, location);
    const soldId = await listing(owner.token, location, {
      title: 'Satilan ilan burada',
    });
    const rentedId = await listing(owner.token, location, {
      title: 'Kiralanan ilan burada',
      listingType: 'RENT',
    });
    const deletedId = await listing(owner.token, location, {
      title: 'Silinen ilan burada',
    });
    const hiddenAgent = await agent();
    const hiddenLocation = await place();
    const hiddenId = await listing(hiddenAgent.token, hiddenLocation);
    const inactiveOwner = await agent();
    const ownerLocation = await place();
    const ownerHiddenId = await listing(inactiveOwner.token, ownerLocation);
    const fan = await account();

    await http()
      .patch(`/api/v1/properties/${inactiveId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'INACTIVE' });
    await http()
      .patch(`/api/v1/properties/${soldId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'SOLD' });
    await http()
      .patch(`/api/v1/properties/${rentedId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'RENTED' });
    await http()
      .delete(`/api/v1/properties/${deletedId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    await prisma.agentProfile.update({
      where: { id: hiddenAgent.profileId },
      data: { isActive: false },
    });
    await prisma.user.update({
      where: { id: inactiveOwner.userId },
      data: { isActive: false },
    });

    const responses = await Promise.all(
      [inactiveId, soldId, rentedId, deletedId, hiddenId, ownerHiddenId].map(
        (id) =>
          http()
            .post(`/api/v1/favorites/${id}`)
            .set('Authorization', `Bearer ${fan.token}`),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
  });

  it('paginates visible favorites and hides a listing that leaves the public catalog', async () => {
    const owner = await agent();
    const location = await place();
    const firstId = await listing(owner.token, location);
    const secondId = await listing(owner.token, location, {
      title: 'Ikinci favori ilani',
    });
    const fan = await account();

    await http()
      .post(`/api/v1/favorites/${firstId}`)
      .set('Authorization', `Bearer ${fan.token}`);
    await http()
      .post(`/api/v1/favorites/${secondId}`)
      .set('Authorization', `Bearer ${fan.token}`);

    const pageOne = await http()
      .get('/api/v1/favorites')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${fan.token}`);
    const pageTwo = await http()
      .get('/api/v1/favorites')
      .query({ page: 2, limit: 1 })
      .set('Authorization', `Bearer ${fan.token}`);

    await http()
      .patch(`/api/v1/properties/${firstId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'SOLD' });

    const hidden = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${fan.token}`);
    const stored = await prisma.favorite.count({
      where: { userId: fan.userId, propertyId: firstId },
    });

    await http()
      .patch(`/api/v1/properties/${firstId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'ACTIVE' });

    const restored = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${fan.token}`);
    const pageOneBody = record(pageOne.body);
    const visibleIds = [
      ...rows(pageOneBody.items).map((item) => text(item.id)),
      ...rows(record(pageTwo.body).items).map((item) => text(item.id)),
    ];

    expect(pageOne.status).toBe(200);
    expect(pageOneBody.page).toBe(1);
    expect(pageOneBody.limit).toBe(1);
    expect(pageOneBody.total).toBe(2);
    expect(new Set(visibleIds)).toEqual(new Set([firstId, secondId]));
    expect(rows(record(hidden.body).items).map((item) => item.id)).toEqual([
      secondId,
    ]);
    expect(record(hidden.body).total).toBe(1);
    expect(stored).toBe(1);
    expect(record(restored.body).total).toBe(2);
  });

  it('reports isFavorite on public list and detail without requiring authentication', async () => {
    const owner = await agent();
    const location = await place();
    const favoriteId = await listing(owner.token, location);
    const otherId = await listing(owner.token, location, {
      title: 'Favori olmayan ilan',
    });
    const fan = await account();

    await http()
      .post(`/api/v1/favorites/${favoriteId}`)
      .set('Authorization', `Bearer ${fan.token}`);

    const anonymousList = await http()
      .get('/api/v1/properties')
      .query({ city: location.city });
    const anonymousDetail = await http().get(
      `/api/v1/properties/${favoriteId}`,
    );
    const authedList = await http()
      .get('/api/v1/properties')
      .query({ city: location.city })
      .set('Authorization', `Bearer ${fan.token}`);
    const authedDetail = await http()
      .get(`/api/v1/properties/${favoriteId}`)
      .set('Authorization', `Bearer ${fan.token}`);
    const otherDetail = await http()
      .get(`/api/v1/properties/${otherId}`)
      .set('Authorization', `Bearer ${fan.token}`);
    const invalid = await http()
      .get(`/api/v1/properties/${favoriteId}`)
      .set('Authorization', 'Bearer not-a-token');
    const flags = new Map(
      rows(record(authedList.body).items).map((item) => [
        text(item.id),
        item.isFavorite,
      ]),
    );

    expect(anonymousList.status).toBe(200);
    expect(
      rows(record(anonymousList.body).items).every(
        (item) => item.isFavorite === false,
      ),
    ).toBe(true);
    expect(record(anonymousDetail.body).isFavorite).toBe(false);
    expect(flags.get(favoriteId)).toBe(true);
    expect(flags.get(otherId)).toBe(false);
    expect(record(authedDetail.body).isFavorite).toBe(true);
    expect(record(otherDetail.body).isFavorite).toBe(false);
    expect(invalid.status).toBe(401);
  });

  it('lists only the public listings of one agent, with the shared filters', async () => {
    const owner = await agent();
    const other = await agent();
    const location = await place();
    const saleId = await listing(owner.token, location, {
      price: 3000000,
      rooms: 3,
      livingRooms: 1,
      grossAreaM2: 140,
    });
    const rentId = await listing(owner.token, location, {
      title: 'Kiralik ev ilani burada',
      listingType: 'RENT',
      propertyType: 'HOUSE',
      price: 1000000,
      rooms: 4,
      livingRooms: 1,
      grossAreaM2: 200,
    });
    const cheapId = await listing(owner.token, location, {
      title: 'Uygun fiyatli arsa',
      propertyType: 'LAND',
      price: 2000000,
      rooms: 0,
      livingRooms: 0,
      grossAreaM2: 500,
    });
    const soldId = await listing(owner.token, location, {
      title: 'Satilmis daire ilani',
      price: 4000000,
    });
    const inactiveId = await listing(owner.token, location, {
      title: 'Pasif daire ilani burada',
      price: 5000000,
    });
    const deletedId = await listing(owner.token, location, {
      title: 'Silinmis daire ilani',
      price: 6000000,
    });
    const rentedId = await listing(owner.token, location, {
      title: 'Kiralanmis daire ilani',
      listingType: 'RENT',
      price: 7000000,
    });
    const otherId = await listing(other.token, location, {
      title: 'Baska emlakci ilani',
    });
    const fan = await account();

    await http()
      .patch(`/api/v1/properties/${soldId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'SOLD' });
    await http()
      .patch(`/api/v1/properties/${inactiveId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'INACTIVE' });
    await http()
      .patch(`/api/v1/properties/${rentedId}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'RENTED' });
    await http()
      .delete(`/api/v1/properties/${deletedId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    await http()
      .post(`/api/v1/favorites/${saleId}`)
      .set('Authorization', `Bearer ${fan.token}`);

    const listed = await http().get(`/api/v1/agents/${owner.slug}/properties`);
    const authed = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .set('Authorization', `Bearer ${fan.token}`);
    const missing = await http().get(
      '/api/v1/agents/missing-phase6-slug/properties',
    );
    const rents = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ listingType: 'RENT' });
    const houses = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ propertyType: 'HOUSE' });
    const price = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ minPrice: 1500000, maxPrice: 2500000 });
    const rooms = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ rooms: 3, livingRooms: 1 });
    const area = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ minArea: 100, maxArea: 150 });
    const sorted = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ sort: 'price_asc' });
    const page = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ page: 1, limit: 1, sort: 'price_asc' });
    const rawSort = await http()
      .get(`/api/v1/agents/${owner.slug}/properties`)
      .query({ sort: 'createdAt' });

    await prisma.agentProfile.update({
      where: { id: owner.profileId },
      data: { isActive: false },
    });

    const inactiveAgent = await http().get(
      `/api/v1/agents/${owner.slug}/properties`,
    );
    const ids = rows(record(listed.body).items).map((item) => text(item.id));
    const favoriteCard = rows(record(authed.body).items).find(
      (item) => item.id === saleId,
    );

    expect(listed.status).toBe(200);
    expect(new Set(ids)).toEqual(new Set([saleId, rentId, cheapId]));
    expect(ids).not.toContain(otherId);
    expect(record(favoriteCard).isFavorite).toBe(true);
    expect(missing.status).toBe(404);
    expect(idsOf(rents)).toEqual([rentId]);
    expect(idsOf(houses)).toEqual([rentId]);
    expect(idsOf(price)).toEqual([cheapId]);
    expect(idsOf(rooms)).toEqual([saleId]);
    expect(idsOf(area)).toEqual([saleId]);
    expect(idsOf(sorted)).toEqual([rentId, cheapId, saleId]);
    expect(record(page.body).total).toBe(3);
    expect(rows(record(page.body).items)).toHaveLength(1);
    expect(rawSort.status).toBe(400);
    expect(inactiveAgent.status).toBe(404);
  });
});

function idsOf(response: { body: unknown }) {
  return rows(record(response.body).items).map((item) => text(item.id));
}

function record(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function rows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => record(item));
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}
