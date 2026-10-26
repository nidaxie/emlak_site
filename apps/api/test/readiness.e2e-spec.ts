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
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('Backend readiness (e2e)', () => {
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
      where: { email: { startsWith: 'phase5-' } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'phase5-' } },
      });
      const cities = await prisma.city.findMany({
        where: { name: { startsWith: 'Phase5 ' } },
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
    return `phase5-${Date.now()}-${sequence}@example.com`;
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

    const session = record(loggedIn.body);
    const sessionUser = record(session.user);

    return {
      email: address,
      token: text(session.accessToken),
      userId: text(sessionUser.id),
    };
  }

  async function agent() {
    const user = await account(Role.AGENT);
    const profile = await prisma.agentProfile.create({
      data: {
        userId: user.userId,
        slug: `phase5-${user.userId}`,
        companyName: 'Phase5 Emlak',
        phone: '+905551110000',
        email: user.email,
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Ofis adresi 1',
      },
    });

    return { ...user, profileId: profile.id, slug: profile.slug };
  }

  async function place(suffix: string) {
    const city = await prisma.city.create({
      data: { name: `Phase5 ${suffix} ${Date.now()} ${sequence}` },
    });
    const district = await prisma.district.create({
      data: { cityId: city.id, name: 'Merkez' },
    });
    const otherDistrict = await prisma.district.create({
      data: { cityId: city.id, name: 'Kirsal' },
    });
    const neighborhood = await prisma.neighborhood.create({
      data: { districtId: district.id, name: 'Bir' },
    });

    return { city, district, otherDistrict, neighborhood };
  }

  async function listing(
    token: string,
    location: {
      city: { id: string; name: string };
      district: { id: string };
      neighborhood: { id: string };
    },
  ) {
    const created = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Phase5 satilik daire',
        description: 'Genis ve aydinlik bir daire. Okula yakin.',
        listingType: 'SALE',
        propertyType: 'APARTMENT',
        price: 4250000.5,
        grossAreaM2: 145,
        netAreaM2: 125,
        rooms: 3,
        livingRooms: 1,
        cityId: location.city.id,
        districtId: location.district.id,
        neighborhoodId: location.neighborhood.id,
        address: 'Bir Mahallesi 1',
        latitude: 37.874321,
        longitude: 32.49321,
      });
    expect(created.status).toBe(201);

    return created.body as { id: string; city: string; latitude: string };
  }

  it('stores a public logo and keeps private documents private', async () => {
    const owner = await agent();
    const user = await account();
    const other = await account();
    const admin = await account(Role.ADMIN);
    const logo = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', jpeg, {
        filename: '../../logo.jpg',
        contentType: 'image/jpeg',
      });
    const blocked = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', jpeg, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      });
    const svgUpload = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', svg, {
        filename: 'logo.svg',
        contentType: 'image/svg+xml',
      });
    const huge = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', Buffer.concat([jpeg, Buffer.alloc(5 * 1024 * 1024)]), {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      });
    const logoUrl = text(record(logo.body).logoUrl);
    const fileId = logoUrl.split('/').pop();
    const stored = await prisma.storedFile.findUniqueOrThrow({
      where: { id: fileId },
    });
    const publicFile = await http().get(logoUrl);
    const replaced = await http()
      .post('/api/v1/agents/me/logo')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', jpeg, { filename: 'new.jpg', contentType: 'image/jpeg' });
    const oldFile = await http().get(logoUrl);
    const application = await http()
      .post('/api/v1/agent-applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        companyName: 'Belge Emlak',
        authorizedFirstName: 'Ali',
        authorizedLastName: 'Yilmaz',
        phone: '+905551110000',
        email: 'office@example.com',
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Yazir Mahallesi 1',
      });
    const applicationId = text(record(application.body).id);
    const missingApproval = await http()
      .post(`/api/v1/admin/agent-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    const tax = await http()
      .post('/api/v1/agent-applications/me/documents')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', pdf, {
        filename: 'vergi.pdf',
        contentType: 'application/pdf',
      })
      .field('documentType', 'TAX_CERTIFICATE');
    const authorization = await http()
      .post('/api/v1/agent-applications/me/documents')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', pdf, {
        filename: 'yetki.pdf',
        contentType: 'application/pdf',
      })
      .field('documentType', 'AUTHORIZATION_CERTIFICATE');
    const exe = await http()
      .post('/api/v1/agent-applications/me/documents')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', Buffer.from('MZ\x90\x00'), {
        filename: 'vergi.pdf',
        contentType: 'application/pdf',
      })
      .field('documentType', 'TAX_CERTIFICATE');
    const documentId = text(record(tax.body).id);
    const storedDocument =
      await prisma.agentApplicationDocument.findUniqueOrThrow({
        where: { id: documentId },
        select: { fileId: true },
      });
    const stranger = await http()
      .get(`/api/v1/agent-applications/me/documents/${documentId}`)
      .set('Authorization', `Bearer ${other.token}`);
    const ownerDownload = await http()
      .get(`/api/v1/agent-applications/me/documents/${documentId}`)
      .set('Authorization', `Bearer ${user.token}`);
    const leaked = await http().get(`/api/v1/files/${storedDocument.fileId}`);
    const adminList = await http()
      .get(`/api/v1/admin/agent-applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${admin.token}`);
    const adminFile = await http()
      .get(
        `/api/v1/admin/agent-applications/${applicationId}/documents/${documentId}`,
      )
      .set('Authorization', `Bearer ${admin.token}`);
    const approved = await http()
      .post(`/api/v1/admin/agent-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: applicationId, action: 'AGENT_APPLICATION_APPROVED' },
    });

    expect(logo.status).toBe(201);
    expect(logoUrl).toMatch(/^\/api\/v1\/files\//);
    expect(stored.storageKey).not.toContain('..');
    expect(stored.originalName).toBe('logo.jpg');
    expect(blocked.status).toBe(403);
    expect(svgUpload.status).toBe(415);
    expect(huge.status).toBe(413);
    expect(publicFile.status).toBe(200);
    expect(publicFile.headers['content-type']).toContain('image/jpeg');
    expect(replaced.status).toBe(201);
    expect(oldFile.status).toBe(404);
    expect(missingApproval.status).toBe(409);
    expect(tax.status).toBe(201);
    expect(authorization.status).toBe(201);
    expect(exe.status).toBe(415);
    expect(stranger.status).toBe(404);
    expect(ownerDownload.status).toBe(200);
    expect(ownerDownload.headers['content-disposition']).toContain(
      'attachment',
    );
    expect(JSON.stringify(ownerDownload.body)).not.toContain(stored.storageKey);
    expect(leaked.status).toBe(404);
    expect(adminList.status).toBe(200);
    expect(adminFile.status).toBe(200);
    expect(adminFile.headers['content-type']).toContain('application/pdf');
    expect(approved.status).toBe(200);
    expect(audit?.metadata).toBeNull();
    expect(JSON.stringify(audit)).not.toContain('password');
  });

  it('manages property images, locations, admin access, and audit history', async () => {
    const owner = await agent();
    const otherAgent = await agent();
    const user = await account();
    const admin = await account(Role.ADMIN);
    const location = await place('Loc');
    const created = await listing(owner.token, location);
    const point = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM properties
      WHERE id = ${created.id}::uuid
    `;
    const invalidPlace = await http()
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        title: 'Yanlis konum denemesi',
        description: 'Bu kayit hiyerarsi yuzunden reddedilmeli.',
        listingType: 'SALE',
        propertyType: 'APARTMENT',
        price: 1000000,
        grossAreaM2: 90,
        rooms: 2,
        livingRooms: 1,
        cityId: location.city.id,
        districtId: location.otherDistrict.id,
        neighborhoodId: location.neighborhood.id,
        address: 'Bir Mahallesi 2',
        latitude: 37.87,
        longitude: 32.49,
      });
    const cities = await http().get('/api/v1/locations/cities');
    const districts = await http().get(
      `/api/v1/locations/cities/${location.city.id}/districts`,
    );
    const neighborhoods = await http().get(
      `/api/v1/locations/districts/${location.district.id}/neighborhoods`,
    );
    const first = await http()
      .post(`/api/v1/properties/${created.id}/images`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', jpeg, { filename: 'one.jpg', contentType: 'image/jpeg' });
    const second = await http()
      .post(`/api/v1/properties/${created.id}/images`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', jpeg, { filename: 'two.jpg', contentType: 'image/jpeg' });
    const cross = await http()
      .post(`/api/v1/properties/${created.id}/images`)
      .set('Authorization', `Bearer ${otherAgent.token}`)
      .attach('file', jpeg, {
        filename: 'nope.jpg',
        contentType: 'image/jpeg',
      });
    const userUpload = await http()
      .post(`/api/v1/properties/${created.id}/images`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', jpeg, {
        filename: 'nope.jpg',
        contentType: 'image/jpeg',
      });
    const firstImage = record(first.body);
    const secondImage = record(second.body);
    const ordered = await http()
      .patch(`/api/v1/properties/${created.id}/images/order`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ imageIds: [text(secondImage.id), text(firstImage.id)] });
    const cover = await http()
      .patch(
        `/api/v1/properties/${created.id}/images/${text(secondImage.id)}/cover`,
      )
      .set('Authorization', `Bearer ${owner.token}`);
    const ownerDetailBeforeDelete = await http()
      .get(`/api/v1/properties/me/${created.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    const crossOwnerDetail = await http()
      .get(`/api/v1/properties/me/${created.id}`)
      .set('Authorization', `Bearer ${otherAgent.token}`);
    const detail = await http().get(`/api/v1/properties/${created.id}`);
    const listed = await http()
      .get('/api/v1/properties')
      .query({ city: location.city.name });
    const removed = await http()
      .delete(`/api/v1/properties/${created.id}/images/${text(firstImage.id)}`)
      .set('Authorization', `Bearer ${owner.token}`);
    const ownerDetailAfterDelete = await http()
      .get(`/api/v1/properties/me/${created.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    const hidden = await http().get(text(firstImage.url));
    const adminRemoved = await http()
      .delete(
        `/api/v1/admin/properties/${created.id}/images/${text(secondImage.id)}`,
      )
      .set('Authorization', `Bearer ${admin.token}`);
    const userList = await http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${user.token}`);
    const adminUsers = await http()
      .get('/api/v1/admin/users')
      .query({ role: 'AGENT', email: owner.email, isActive: 'true' })
      .set('Authorization', `Bearer ${admin.token}`);
    const userDetail = await http()
      .get(`/api/v1/admin/users/${owner.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const self = await http()
      .patch(`/api/v1/admin/users/${admin.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const deactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const protectedCall = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const reactivated = await http()
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const agents = await http()
      .get('/api/v1/admin/agents')
      .query({ companyName: 'Phase5', city: 'Konya' })
      .set('Authorization', `Bearer ${admin.token}`);
    const hiddenProfile = await http()
      .patch(`/api/v1/admin/agents/${owner.profileId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const publicAgent = await http().get(`/api/v1/agents/${owner.slug}`);
    const publicListing = await http().get(`/api/v1/properties/${created.id}`);
    const stillIn = await http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: owner.email, password });
    const restored = await http()
      .patch(`/api/v1/admin/agents/${owner.profileId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true });
    const imageAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: text(secondImage.id),
        action: 'PROPERTY_IMAGE_DELETED_BY_ADMIN',
      },
    });
    const mutable = prisma.auditLog.update({
      where: { id: imageAudit?.id ?? created.id },
      data: { entityType: 'CHANGED' },
    });

    expect(Number(point[0]?.lat)).toBeCloseTo(37.874321, 5);
    expect(Number(point[0]?.lng)).toBeCloseTo(32.49321, 5);
    expect(created.city).toBe(location.city.name);
    expect(invalidPlace.status).toBe(400);
    expect(rows(cities.body).some((item) => item.id === location.city.id)).toBe(
      true,
    );
    expect(rows(districts.body)).toHaveLength(2);
    expect(rows(neighborhoods.body)).toEqual([
      expect.objectContaining({
        name: 'Bir',
        districtId: location.district.id,
      }),
    ]);
    expect(firstImage.isCover).toBe(true);
    expect(secondImage.isCover).toBe(false);
    expect(cross.status).toBe(404);
    expect(userUpload.status).toBe(403);
    expect(ordered.status).toBe(200);
    expect(cover.status).toBe(200);
    expect(ownerDetailBeforeDelete.status).toBe(200);
    expect(rows(record(ownerDetailBeforeDelete.body).images)).toEqual([
      {
        id: text(secondImage.id),
        url: text(secondImage.url),
        sortOrder: 0,
        isCover: true,
      },
      {
        id: text(firstImage.id),
        url: text(firstImage.url),
        sortOrder: 1,
        isCover: false,
      },
    ]);
    expect(crossOwnerDetail.status).toBe(404);
    expect(record(crossOwnerDetail.body).images).toBeUndefined();
    expect(rows(record(detail.body).images).map((item) => item.id)).toEqual([
      text(secondImage.id),
      text(firstImage.id),
    ]);
    expect(record(detail.body).coverImageUrl).toBe(secondImage.url);
    expect(rows(record(listed.body).items)[0]?.coverImageUrl).toBe(
      secondImage.url,
    );
    expect(removed.status).toBe(200);
    expect(ownerDetailAfterDelete.status).toBe(200);
    expect(rows(record(ownerDetailAfterDelete.body).images)).toEqual([
      {
        id: text(secondImage.id),
        url: text(secondImage.url),
        sortOrder: 0,
        isCover: true,
      },
    ]);
    expect(hidden.status).toBe(404);
    expect(adminRemoved.status).toBe(200);
    expect(userList.status).toBe(403);
    expect(
      rows(record(adminUsers.body).items).some(
        (item) => item.id === owner.userId,
      ),
    ).toBe(true);
    expect(record(userDetail.body).passwordHash).toBeUndefined();
    expect(JSON.stringify(userDetail.body)).not.toContain('passwordHash');
    expect(self.status).toBe(409);
    expect(record(deactivated.body).isActive).toBe(false);
    expect(protectedCall.status).toBe(401);
    expect(record(reactivated.body).isActive).toBe(true);
    expect(
      rows(record(agents.body).items).some(
        (item) => item.id === owner.profileId,
      ),
    ).toBe(true);
    expect(hiddenProfile.status).toBe(200);
    expect(publicAgent.status).toBe(404);
    expect(publicListing.status).toBe(404);
    expect(stillIn.status).toBe(200);
    expect(record(restored.body).isActive).toBe(true);
    expect(imageAudit?.metadata).toEqual({ propertyId: created.id });
    await expect(mutable).rejects.toThrow('audit_logs are immutable');
  });
});

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
