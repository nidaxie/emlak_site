import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { Role } from '../src/generated/prisma/enums';

const password = 'password123';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe('User properties (e2e)', () => {
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
    await cleanup();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
    }

    await app?.close();
  });

  async function cleanup() {
    await prisma.property.deleteMany({
      where: {
        OR: [
          { ownerUser: { email: { startsWith: 'userprop-' } } },
          { agentProfile: { user: { email: { startsWith: 'userprop-' } } } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'userprop-' } },
    });
  }

  function nextEmail() {
    sequence += 1;
    return `userprop-${Date.now()}-${sequence}@example.com`;
  }

  function label(name: string) {
    sequence += 1;
    return `${name} ${Date.now()}-${sequence}`;
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
        slug: `userprop-${account.userId}`,
        companyName: 'UserProp Emlak',
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
      price: '4250000.50',
      grossAreaM2: '145.00',
      netAreaM2: '125.00',
      rooms: 3,
      livingRooms: 1,
      buildingAge: 5,
      floor: 4,
      totalFloors: 8,
      heatingType: 'COMBI',
      address: 'Yazir Mahallesi 1',
      latitude: '37.870000',
      longitude: '32.490000',
      hasBalcony: true,
      hasElevator: true,
      hasParking: true,
      isFurnished: false,
      inSite: true,
      ...extra,
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
      where: {
        districtId_name: { districtId: district.id, name: 'Yazir' },
      },
      update: {},
      create: { districtId: district.id, name: 'Yazir' },
    });

    return {
      cityId: city.id,
      districtId: district.id,
      neighborhoodId: neighborhood.id,
    };
  }

  async function postUserProperty(
    token: string,
    cityName: string,
    extra: Record<string, unknown> = {},
  ) {
    const place = await ensurePlace(cityName);

    return http()
      .post('/api/v1/user-properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...propertyBody(), ...place, ...extra });
  }

  async function postAgentProperty(token: string, cityName: string) {
    const place = await ensurePlace(cityName);

    return http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...propertyBody(), ...place });
  }

  it('creates an individual listing for the current user only', async () => {
    const userA = await createAccount();
    const userB = await createAccount();
    const agent = await createAgent();
    const admin = await createAccount(Role.ADMIN);
    const city = label('UserCreate');
    const anonymous = await http()
      .post('/api/v1/user-properties')
      .send(propertyBody());
    const created = await postUserProperty(userA.token, city);
    const body = responseData(created);
    const stored = await prisma.property.findUniqueOrThrow({
      where: { id: text(body.id) },
    });
    const spoof = await postUserProperty(userA.token, city, {
      sellerType: 'AGENT',
      ownerUserId: userB.userId,
      agentProfileId: agent.profileId,
      status: 'INACTIVE',
      currency: 'TRY',
    });
    const agentAttempt = await postUserProperty(agent.token, city);
    const adminAttempt = await postUserProperty(admin.token, city);
    const agentListing = await postAgentProperty(agent.token, city);
    const mine = await http()
      .get('/api/v1/user-properties/me')
      .set('Authorization', `Bearer ${userA.token}`);
    const otherMine = await http()
      .get('/api/v1/user-properties/me')
      .set('Authorization', `Bearer ${userB.token}`);
    const agentMine = await http()
      .get('/api/v1/properties/me')
      .set('Authorization', `Bearer ${agent.token}`);

    expect(anonymous.status).toBe(401);
    expect(created.status).toBe(201);
    expect(body).toMatchObject({
      sellerType: 'INDIVIDUAL',
      agentProfileId: null,
      status: 'ACTIVE',
      currency: 'TRY',
      price: '4250000.50',
      grossAreaM2: '145.00',
      netAreaM2: '125.00',
      latitude: '37.870000',
      longitude: '32.490000',
    });
    expect(body.ownerUserId).toBeUndefined();
    expect(body.email).toBeUndefined();
    expect(stored.sellerType).toBe('INDIVIDUAL');
    expect(stored.ownerUserId).toBe(userA.userId);
    expect(stored.agentProfileId).toBeNull();
    expect(stored.currency).toBe('TRY');
    expect(stored.status).toBe('ACTIVE');
    expect(spoof.status).toBe(400);
    expect(agentAttempt.status).toBe(403);
    expect(adminAttempt.status).toBe(403);
    expect(agentListing.status).toBe(201);
    expect(responseData(agentListing).sellerType).toBe('AGENT');
    expect(listItems(mine).map((item) => item.id)).toEqual([text(body.id)]);
    expect(listItems(otherMine)).toEqual([]);
    expect(idsOf(agentMine)).toEqual([text(responseData(agentListing).id)]);
    expect(idsOf(agentMine)).not.toContain(text(body.id));
  });

  it('returns an editable detail and persists safe updates', async () => {
    const user = await createAccount();
    const city = label('UserEdit');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const place = await ensurePlace(city);
    const detail = await http()
      .get(`/api/v1/user-properties/me/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const updated = await http()
      .patch(`/api/v1/user-properties/${id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Yeni bireysel baslik',
        price: '10.50',
        ...place,
      });
    const again = await http()
      .get(`/api/v1/user-properties/me/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const forbidden = await http()
      .patch(`/api/v1/user-properties/${id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'INACTIVE', sellerType: 'AGENT' });

    expect(detail.status).toBe(200);
    expect(responseData(detail)).toMatchObject({
      cityId: place.cityId,
      districtId: place.districtId,
      neighborhoodId: place.neighborhoodId,
      sellerType: 'INDIVIDUAL',
      images: [],
    });
    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      title: 'Yeni bireysel baslik',
      price: '10.50',
      sellerType: 'INDIVIDUAL',
      agentProfileId: null,
      status: 'ACTIVE',
    });
    expect(responseData(again).title).toBe('Yeni bireysel baslik');
    expect(responseData(again).price).toBe('10.50');
    expect(forbidden.status).toBe(400);
  });

  it('toggles ACTIVE and INACTIVE and hides the listing while inactive', async () => {
    const user = await createAccount();
    const city = label('UserStatus');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const inactive = await http()
      .patch(`/api/v1/user-properties/${id}/status`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'INACTIVE' });
    const hidden = await http().get(`/api/v1/properties/${id}`);
    const same = await http()
      .patch(`/api/v1/user-properties/${id}/status`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'INACTIVE' });
    const sold = await http()
      .patch(`/api/v1/user-properties/${id}/status`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'SOLD' });
    const active = await http()
      .patch(`/api/v1/user-properties/${id}/status`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'ACTIVE' });
    const visible = await http().get(`/api/v1/properties/${id}`);

    expect(inactive.status).toBe(200);
    expect(responseData(inactive).status).toBe('INACTIVE');
    expect(hidden.status).toBe(404);
    expect(same.status).toBe(409);
    expect(sold.status).toBe(400);
    expect(active.status).toBe(200);
    expect(visible.status).toBe(200);
    expect(responseData(visible)).toMatchObject({
      sellerType: 'INDIVIDUAL',
      sellerName: 'Bireysel',
      sellerDisplayName: 'Bireysel İlan Sahibi',
      agent: null,
    });
    expect(responseData(visible).ownerUserId).toBeUndefined();
    expect(responseData(visible).email).toBeUndefined();
  });

  it('soft-deletes an individual listing from owner and public reads', async () => {
    const user = await createAccount();
    const city = label('UserDelete');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const removed = await http()
      .delete(`/api/v1/user-properties/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const owner = await http()
      .get(`/api/v1/user-properties/me/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const pub = await http().get(`/api/v1/properties/${id}`);
    const stored = await prisma.property.findUniqueOrThrow({ where: { id } });

    expect(removed.status).toBe(200);
    expect(responseData(removed).id).toBe(id);
    expect(stored.deletedAt).toEqual(expect.any(Date));
    expect(owner.status).toBe(404);
    expect(pub.status).toBe(404);
  });

  it('uploads, reorders, covers, and deletes images for the owner', async () => {
    const user = await createAccount();
    const city = label('UserImage');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const first = await http()
      .post(`/api/v1/user-properties/${id}/images`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', jpeg, { filename: 'one.jpg', contentType: 'image/jpeg' });
    const second = await http()
      .post(`/api/v1/user-properties/${id}/images`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', jpeg, { filename: 'two.jpg', contentType: 'image/jpeg' });
    const firstImage = responseData(first);
    const secondImage = responseData(second);
    const ordered = await http()
      .patch(`/api/v1/user-properties/${id}/images/order`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ imageIds: [text(secondImage.id), text(firstImage.id)] });
    const cover = await http()
      .patch(
        `/api/v1/user-properties/${id}/images/${text(secondImage.id)}/cover`,
      )
      .set('Authorization', `Bearer ${user.token}`);
    const removed = await http()
      .delete(`/api/v1/user-properties/${id}/images/${text(firstImage.id)}`)
      .set('Authorization', `Bearer ${user.token}`);
    const detail = await http()
      .get(`/api/v1/user-properties/me/${id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(firstImage.isCover).toBe(true);
    expect(secondImage.isCover).toBe(false);
    expect(String(firstImage.url)).toMatch(/^\/api\/v1\/files\//);
    expect(ordered.status).toBe(200);
    expect(cover.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(responseData(detail).images).toEqual([
      {
        id: text(secondImage.id),
        url: text(secondImage.url),
        sortOrder: 0,
        isCover: true,
      },
    ]);
  });

  it('hides another user listing and blocks the other role panels', async () => {
    const userA = await createAccount();
    const userB = await createAccount();
    const agent = await createAgent();
    const city = label('UserGuard');
    const individual = await postUserProperty(userA.token, city);
    const agentListing = await postAgentProperty(agent.token, city);
    const individualId = text(responseData(individual).id);
    const agentId = text(responseData(agentListing).id);
    const read = await http()
      .get(`/api/v1/user-properties/me/${individualId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    const update = await http()
      .patch(`/api/v1/user-properties/${individualId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Baska kullanici basligi' });
    const status = await http()
      .patch(`/api/v1/user-properties/${individualId}/status`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ status: 'INACTIVE' });
    const remove = await http()
      .delete(`/api/v1/user-properties/${individualId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    const image = await http()
      .post(`/api/v1/user-properties/${individualId}/images`)
      .set('Authorization', `Bearer ${userB.token}`)
      .attach('file', jpeg, {
        filename: 'nope.jpg',
        contentType: 'image/jpeg',
      });
    const agentOnUser = await http()
      .patch(`/api/v1/user-properties/${individualId}`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ title: 'Emlakci bireysel ilan' });
    const agentImage = await http()
      .post(`/api/v1/properties/${individualId}/images`)
      .set('Authorization', `Bearer ${agent.token}`)
      .attach('file', jpeg, {
        filename: 'nope.jpg',
        contentType: 'image/jpeg',
      });
    const userOnAgent = await http()
      .patch(`/api/v1/properties/${agentId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'Kullanici emlakci ilani' });
    const userPanelOnAgent = await http()
      .patch(`/api/v1/user-properties/${agentId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'Kullanici paneli emlakci' });
    const agentReadUser = await http()
      .get(`/api/v1/properties/me/${individualId}`)
      .set('Authorization', `Bearer ${agent.token}`);

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect(status.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(image.status).toBe(404);
    expect(agentOnUser.status).toBe(403);
    expect(agentImage.status).toBe(404);
    expect(userOnAgent.status).toBe(403);
    expect(userPanelOnAgent.status).toBe(404);
    expect(agentReadUser.status).toBe(404);
    expect(
      (
        await prisma.property.findUniqueOrThrow({
          where: { id: individualId },
        })
      ).ownerUserId,
    ).toBe(userA.userId);
  });

  it('publishes an active individual listing and hides it when the user is inactive', async () => {
    const user = await createAccount();
    const other = await createAccount();
    const admin = await createAccount(Role.ADMIN);
    const city = label('UserPublic');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const listed = await http().get('/api/v1/properties').query({ city });
    const detail = await http().get(`/api/v1/properties/${id}`);
    const favorite = await http()
      .post(`/api/v1/favorites/${id}`)
      .set('Authorization', `Bearer ${other.token}`);
    const favorites = await http()
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${other.token}`);
    const deactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const hiddenList = await http().get('/api/v1/properties').query({ city });
    const hiddenDetail = await http().get(`/api/v1/properties/${id}`);
    const reactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const visible = await http().get(`/api/v1/properties/${id}`);
    const card = listItems(listed).find((item) => item.id === id);

    expect(idsOf(listed)).toContain(id);
    expect(card).toMatchObject({
      sellerType: 'INDIVIDUAL',
      sellerName: 'Bireysel',
      agent: null,
    });
    expect(card?.email).toBeUndefined();
    expect(card?.ownerUserId).toBeUndefined();
    expect(detail.status).toBe(200);
    expect(responseData(detail).sellerType).toBe('INDIVIDUAL');
    expect(favorite.status).toBe(200);
    expect(idsOf(favorites)).toContain(id);
    expect(listItems(favorites)[0]).toMatchObject({
      sellerType: 'INDIVIDUAL',
      sellerName: 'Bireysel',
      agent: null,
    });
    expect(deactivated.status).toBe(200);
    expect(idsOf(hiddenList)).not.toContain(id);
    expect(hiddenDetail.status).toBe(404);
    expect(reactivated.status).toBe(200);
    expect(visible.status).toBe(200);
  });

  it('lets an admin moderate an individual listing', async () => {
    const user = await createAccount();
    const admin = await createAccount(Role.ADMIN);
    const city = label('UserAdmin');
    const created = await postUserProperty(user.token, city);
    const id = text(responseData(created).id);
    const list = await http()
      .get('/api/v1/admin/properties')
      .query({ city, status: 'ACTIVE' })
      .set('Authorization', `Bearer ${admin.token}`);
    const detail = await http()
      .get(`/api/v1/admin/properties/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const deactivated = await http()
      .patch(`/api/v1/admin/properties/${id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Bireysel ilan incelemesi' });
    const removed = await http()
      .delete(`/api/v1/admin/properties/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Bireysel ilan silindi' });
    const owner = nested(responseData(detail).owner);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    expect(idsOf(list)).toContain(id);
    const row = listItems(list).find((item) => item.id === id);
    expect(row).toMatchObject({
      sellerType: 'INDIVIDUAL',
      agent: null,
    });
    expect(nested(row?.owner).id).toBe(user.userId);
    expect(nested(row?.owner).email).toBeUndefined();
    expect(detail.status).toBe(200);
    expect(responseData(detail).sellerType).toBe('INDIVIDUAL');
    expect(responseData(detail).agent).toBeNull();
    expect(owner).toMatchObject({
      id: user.userId,
      email: user.email,
      role: 'USER',
      isActive: true,
    });
    expect(JSON.stringify(detail.body)).not.toContain(storedUser.passwordHash);
    expect(deactivated.status).toBe(200);
    expect(responseData(deactivated).status).toBe('INACTIVE');
    expect((await http().get(`/api/v1/properties/${id}`)).status).toBe(404);
    expect(removed.status).toBe(200);
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id } })).deletedAt,
    ).toEqual(expect.any(Date));
  });

  it('keeps the agent public contract beside an individual listing', async () => {
    const agent = await createAgent();
    const city = label('AgentBeside');
    const created = await postAgentProperty(agent.token, city);
    const id = text(responseData(created).id);
    const detail = await http().get(`/api/v1/properties/${id}`);
    const body = responseData(detail);
    const stored = await prisma.property.findUniqueOrThrow({ where: { id } });

    expect(created.status).toBe(201);
    expect(stored.sellerType).toBe('AGENT');
    expect(stored.agentProfileId).toBe(agent.profileId);
    expect(stored.ownerUserId).toBeNull();
    expect(detail.status).toBe(200);
    expect(body.sellerType).toBe('AGENT');
    expect(body.sellerName).toBe('UserProp Emlak');
    expect(nested(body.agent)).toMatchObject({
      slug: agent.slug,
      companyName: 'UserProp Emlak',
      phone: '+905551110000',
      logoUrl: null,
    });
    expect(body.agentProfileId).toBeUndefined();
    expect(body.ownerUserId).toBeUndefined();
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
