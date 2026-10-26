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

describe('Agent applications and profiles (e2e)', () => {
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
      where: { email: { startsWith: 'phase3-' } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'phase3-' } },
      });
    }

    await app?.close();
  });

  function nextEmail() {
    sequence += 1;
    return `phase3-${Date.now()}-${sequence}@example.com`;
  }

  function label(name: string) {
    sequence += 1;
    return `${name} ${sequence}`;
  }

  function http() {
    return request(app.getHttpServer());
  }

  async function registerUser(email: string) {
    return http().post('/api/v1/auth/register').send({ email, password });
  }

  async function loginUser(email: string) {
    return http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email, password });
  }

  async function createAccount(role: Role = Role.USER) {
    const email = nextEmail();
    const registered = await registerUser(email);
    expect(registered.status).toBe(201);

    if (role !== Role.USER) {
      await prisma.user.update({ where: { email }, data: { role } });
    }

    const loggedIn = await loginUser(email);
    expect(loggedIn.status).toBe(200);
    const body = responseData(loggedIn);
    const user = nested(body.user);

    return {
      email,
      token: text(body.accessToken),
      userId: text(user.id),
    };
  }

  function applicationBody(
    companyName: string,
    extra: Record<string, unknown> = {},
  ) {
    return {
      companyName,
      authorizedFirstName: 'Ali',
      authorizedLastName: 'Yilmaz',
      phone: '+905551110000',
      email: 'Office@Example.com',
      taxNumber: '1234567890',
      city: 'Konya',
      district: 'Selcuklu',
      address: 'Yazir Mahallesi 1',
      description: 'Konut ve arsa',
      ...extra,
    };
  }

  function postApplication(
    token: string,
    companyName: string,
    extra: Record<string, unknown> = {},
  ) {
    return http()
      .post('/api/v1/agent-applications')
      .set('Authorization', `Bearer ${token}`)
      .send(applicationBody(companyName, extra));
  }

  const samplePdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
  );

  function uploadDocument(token: string, documentType: string) {
    return http()
      .post('/api/v1/agent-applications/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', samplePdf, {
        filename: 'belge.pdf',
        contentType: 'application/pdf',
      })
      .field('documentType', documentType);
  }

  async function uploadRequiredDocuments(token: string) {
    expect((await uploadDocument(token, 'TAX_CERTIFICATE')).status).toBe(201);
    expect(
      (await uploadDocument(token, 'AUTHORIZATION_CERTIFICATE')).status,
    ).toBe(201);
  }

  function approve(token: string, id: string) {
    return http()
      .post(`/api/v1/admin/agent-applications/${id}/approve`)
      .set('Authorization', `Bearer ${token}`);
  }

  function reject(token: string, id: string, reason = 'Eksik vergi levhasi') {
    return http()
      .post(`/api/v1/admin/agent-applications/${id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason });
  }

  it('lets a USER create one pending application and hides other users', async () => {
    const user = await createAccount();
    const other = await createAccount();
    const companyName = label('Create');
    const created = await postApplication(user.token, companyName);
    const createdBody = responseData(created);

    expect(created.status).toBe(201);
    expect(createdBody).toMatchObject({
      status: 'PENDING',
      companyName,
      email: 'office@example.com',
      taxNumber: '1234567890',
      city: 'Konya',
    });
    expect(createdBody.rejectionReason).toBeNull();

    const mine = await http()
      .get('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`);
    const otherMine = await http()
      .get('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${other.token}`);
    const anonymous = await http()
      .post('/api/v1/agent-applications')
      .send(applicationBody(label('Anon')));

    expect(mine.status).toBe(200);
    expect(responseData(mine).id).toBe(createdBody.id);
    expect(otherMine.status).toBe(404);
    expect(responseData(otherMine)).toMatchObject({
      statusCode: 404,
      message: 'Agent application not found',
      error: 'Not Found',
      path: '/api/v1/agent-applications/me',
    });
    expect(anonymous.status).toBe(401);
    expect(responseData(anonymous).statusCode).toBe(401);
  });

  it('rejects invalid payloads, agents, and a second pending application', async () => {
    const user = await createAccount();
    const agent = await createAccount(Role.AGENT);
    const admin = await createAccount(Role.ADMIN);
    const racer = await createAccount();
    const companyName = label('Pending');
    const first = await postApplication(user.token, companyName);
    const duplicate = await postApplication(user.token, companyName);
    const parallel = await Promise.all([
      postApplication(racer.token, label('Race Create')),
      postApplication(racer.token, label('Race Create')),
    ]);
    const invalid = await postApplication(user.token, 'A', {
      taxNumber: 'abc',
      role: 'AGENT',
    });
    const agentAttempt = await postApplication(agent.token, label('Agent'));
    const adminAttempt = await postApplication(admin.token, label('Admin'));

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(responseData(duplicate)).toMatchObject({
      statusCode: 409,
      message: 'Pending application already exists',
      error: 'Conflict',
      path: '/api/v1/agent-applications',
    });
    expect(parallel.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(invalid.status).toBe(400);
    expect(responseData(invalid).statusCode).toBe(400);
    expect(agentAttempt.status).toBe(403);
    expect(adminAttempt.status).toBe(403);
    expect(
      await prisma.agentApplication.count({
        where: { userId: user.userId, status: 'PENDING' },
      }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({
        where: { userId: racer.userId, status: 'PENDING' },
      }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({ where: { userId: agent.userId } }),
    ).toBe(0);
  });

  it('updates only the caller pending application', async () => {
    const user = await createAccount();
    const companyName = label('Update');
    const created = await postApplication(user.token, companyName);
    const applicationId = text(responseData(created).id);
    const updated = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ companyName: `${companyName} Ltd`, city: 'Ankara' });
    const forbidden = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'APPROVED' });
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });

    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      id: applicationId,
      companyName: `${companyName} Ltd`,
      city: 'Ankara',
      status: 'PENDING',
    });
    expect(forbidden.status).toBe(400);
    expect(stored.status).toBe('PENDING');
    expect(stored.city).toBe('Ankara');
  });

  it('lists and shows applications only to admins', async () => {
    const user = await createAccount();
    const agent = await createAccount(Role.AGENT);
    const admin = await createAccount(Role.ADMIN);
    const pendingName = label('Queue Pending');
    const approvedName = label('Queue Approved');
    const rejectedName = label('Queue Rejected');
    const pendingUser = await createAccount();
    const approvedUser = await createAccount();
    const rejectedUser = await createAccount();
    const pending = await postApplication(pendingUser.token, pendingName);
    const approved = await postApplication(approvedUser.token, approvedName);
    const rejected = await postApplication(rejectedUser.token, rejectedName);
    const pendingId = text(responseData(pending).id);
    const approvedId = text(responseData(approved).id);
    const rejectedId = text(responseData(rejected).id);

    await uploadRequiredDocuments(approvedUser.token);
    expect((await approve(admin.token, approvedId)).status).toBe(200);
    expect((await reject(admin.token, rejectedId)).status).toBe(200);

    const userList = await http()
      .get('/api/v1/admin/agent-applications')
      .set('Authorization', `Bearer ${user.token}`);
    const agentList = await http()
      .get('/api/v1/admin/agent-applications')
      .set('Authorization', `Bearer ${agent.token}`);
    const adminList = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'PENDING', limit: 1, page: 1 })
      .set('Authorization', `Bearer ${admin.token}`);
    const pendingPage = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'PENDING', limit: 50, page: 1 })
      .set('Authorization', `Bearer ${admin.token}`);
    const approvedPage = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'APPROVED', limit: 50, page: 1 })
      .set('Authorization', `Bearer ${admin.token}`);
    const badFilter = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'CANCELLED' })
      .set('Authorization', `Bearer ${admin.token}`);
    const detail = await http()
      .get(`/api/v1/admin/agent-applications/${pendingId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const userDetail = await http()
      .get(`/api/v1/admin/agent-applications/${pendingId}`)
      .set('Authorization', `Bearer ${user.token}`);
    const missing = await http()
      .get(
        '/api/v1/admin/agent-applications/00000000-0000-4000-8000-000000000000',
      )
      .set('Authorization', `Bearer ${admin.token}`);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: pendingUser.userId },
    });
    const detailBody = responseData(detail);
    const detailUser = nested(detailBody.user);
    const pendingItems = listItems(pendingPage);
    const approvedItems = listItems(approvedPage);

    expect(userList.status).toBe(403);
    expect(agentList.status).toBe(403);
    expect(adminList.status).toBe(200);
    expect(listItems(adminList)).toHaveLength(1);
    expect(responseData(adminList).page).toBe(1);
    expect(responseData(adminList).limit).toBe(1);
    expect(Number(responseData(adminList).total)).toBeGreaterThanOrEqual(1);
    expect(pendingItems.every((item) => item.status === 'PENDING')).toBe(true);
    expect(pendingItems.some((item) => item.id === pendingId)).toBe(true);
    expect(pendingItems.some((item) => item.id === approvedId)).toBe(false);
    expect(approvedItems.some((item) => item.id === approvedId)).toBe(true);
    expect(approvedItems.some((item) => item.id === rejectedId)).toBe(false);
    expect(badFilter.status).toBe(400);
    expect(detail.status).toBe(200);
    expect(detailUser).toMatchObject({
      id: pendingUser.userId,
      email: pendingUser.email,
      role: 'USER',
    });
    expect(detailBody.taxNumber).toBe('1234567890');
    expect(detailBody.passwordHash).toBeUndefined();
    expect(detailUser.passwordHash).toBeUndefined();
    expect(JSON.stringify(detailBody)).not.toContain(storedUser.passwordHash);
    expect(userDetail.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it('approves a pending application once and creates one agent profile', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const companyName = label('Approve');
    const created = await postApplication(user.token, companyName);
    const applicationId = text(responseData(created).id);
    const renamed = `${companyName} Ltd`;
    expect(
      (
        await http()
          .patch('/api/v1/agent-applications/me')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ companyName: renamed })
      ).status,
    ).toBe(200);

    const logSpy = jest.spyOn(Logger.prototype, 'log');
    await uploadRequiredDocuments(user.token);
    const approved = await approve(admin.token, applicationId);
    const body = responseData(approved);
    const profile = nested(body.profile);
    const approvedUser = nested(body.user);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    const storedProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    const again = await approve(admin.token, applicationId);
    const mine = await http()
      .get('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`);
    const blocked = await postApplication(user.token, label('After'));
    const self = await http()
      .get('/api/v1/agents/me')
      .set('Authorization', `Bearer ${user.token}`);
    const profileMe = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`);
    const logText = logSpy.mock.calls.map((call) => String(call[0])).join('\n');

    expect(approved.status).toBe(200);
    expect(body.application).toMatchObject({
      id: applicationId,
      status: 'APPROVED',
      reviewedById: admin.userId,
    });
    expect(nested(body.application).reviewedAt).toEqual(expect.any(String));
    expect(approvedUser).toMatchObject({ id: user.userId, role: 'AGENT' });
    expect(profile.companyName).toBe(renamed);
    expect(typeof profile.slug).toBe('string');
    expect(storedUser.role).toBe('AGENT');
    expect(storedProfile.companyName).toBe(renamed);
    expect(storedProfile.slug).toBe(profile.slug);
    expect(storedProfile.email).toBe('office@example.com');
    expect(again.status).toBe(409);
    expect(responseData(again).message).toBe(
      'Application is no longer pending',
    );
    expect(
      await prisma.agentProfile.count({ where: { userId: user.userId } }),
    ).toBe(1);
    expect(responseData(mine).status).toBe('APPROVED');
    expect(
      (
        await http()
          .patch('/api/v1/agent-applications/me')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ city: 'Istanbul' })
      ).status,
    ).toBe(409);
    expect(blocked.status).toBe(403);
    expect(self.status).toBe(200);
    expect(responseData(profileMe).role).toBe('AGENT');
    expect(logText).toContain(
      `agent application approved applicationId=${applicationId} userId=${user.userId} adminId=${admin.userId}`,
    );
    expect(logText).not.toContain('1234567890');
    logSpy.mockRestore();
  });

  it('blocks approval of inactive users and rolls back when a profile already exists', async () => {
    const admin = await createAccount(Role.ADMIN);
    const inactive = await createAccount();
    const occupied = await createAccount();
    const inactiveApplication = await postApplication(
      inactive.token,
      label('Inactive'),
    );
    const occupiedApplication = await postApplication(
      occupied.token,
      label('Occupied'),
    );
    const inactiveId = text(responseData(inactiveApplication).id);
    const occupiedId = text(responseData(occupiedApplication).id);

    await prisma.user.update({
      where: { id: inactive.userId },
      data: { isActive: false },
    });
    await prisma.agentProfile.create({
      data: {
        userId: occupied.userId,
        slug: `occupied-${occupied.userId}`,
        companyName: 'Existing',
        phone: '+905551110000',
        email: 'existing@example.com',
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Yazir Mahallesi 1',
      },
    });

    const inactiveResult = await approve(admin.token, inactiveId);
    const occupiedResult = await approve(admin.token, occupiedId);
    const inactiveStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: inactiveId },
    });
    const occupiedStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: occupiedId },
    });
    const inactiveUser = await prisma.user.findUniqueOrThrow({
      where: { id: inactive.userId },
    });
    const occupiedUser = await prisma.user.findUniqueOrThrow({
      where: { id: occupied.userId },
    });

    expect(inactiveResult.status).toBe(409);
    expect(responseData(inactiveResult).message).toBe(
      'User account is inactive',
    );
    expect(inactiveStored.status).toBe('PENDING');
    expect(inactiveUser.role).toBe('USER');
    expect(
      await prisma.agentProfile.count({ where: { userId: inactive.userId } }),
    ).toBe(0);
    expect(occupiedResult.status).toBe(409);
    expect(responseData(occupiedResult).message).toBe(
      'Agent profile already exists',
    );
    expect(occupiedStored.status).toBe('PENDING');
    expect(occupiedUser.role).toBe('USER');
    expect(
      await prisma.agentProfile.count({ where: { userId: occupied.userId } }),
    ).toBe(1);
  });

  it('rejects a pending application without creating a profile and allows one new application', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const companyName = label('Reject');
    const created = await postApplication(user.token, companyName);
    const applicationId = text(responseData(created).id);
    const shortReason = await reject(admin.token, applicationId, 'no');
    const rejected = await reject(admin.token, applicationId);
    const again = await reject(admin.token, applicationId);
    const approvedLater = await approve(admin.token, applicationId);
    const edited = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ city: 'Istanbul' });
    const reapplied = await postApplication(user.token, label('Reapply'));
    const third = await postApplication(user.token, label('Third'));
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    expect(shortReason.status).toBe(400);
    expect(rejected.status).toBe(200);
    expect(responseData(rejected)).toMatchObject({
      id: applicationId,
      status: 'REJECTED',
      rejectionReason: 'Eksik vergi levhasi',
      reviewedById: admin.userId,
    });
    expect(again.status).toBe(409);
    expect(responseData(again).message).toBe(
      'Application is no longer pending',
    );
    expect(approvedLater.status).toBe(409);
    expect(edited.status).toBe(409);
    expect(stored.status).toBe('REJECTED');
    expect(stored.city).toBe('Konya');
    expect(account.role).toBe('USER');
    expect(
      await prisma.agentProfile.count({ where: { userId: user.userId } }),
    ).toBe(0);
    expect(reapplied.status).toBe(201);
    expect(responseData(reapplied).status).toBe('PENDING');
    expect(responseData(reapplied).id).not.toBe(applicationId);
    expect(third.status).toBe(409);
    expect(
      await prisma.agentApplication.count({
        where: { userId: user.userId, status: 'PENDING' },
      }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({ where: { userId: user.userId } }),
    ).toBe(2);
  });

  it('serializes two approvals of the same application', async () => {
    const firstAdmin = await createAccount(Role.ADMIN);
    const secondAdmin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const created = await postApplication(user.token, label('Race'));
    const applicationId = text(responseData(created).id);
    await uploadRequiredDocuments(user.token);
    const results = await Promise.all([
      approve(firstAdmin.token, applicationId),
      approve(secondAdmin.token, applicationId),
    ]);
    const statuses = results.map((response) => response.status).sort();
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    expect(statuses).toEqual([200, 409]);
    expect(stored.role).toBe('AGENT');
    expect(
      await prisma.agentProfile.count({ where: { userId: user.userId } }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({
        where: { id: applicationId, status: 'APPROVED' },
      }),
    ).toBe(1);
  });

  it('publishes a unique stable slug and lets the agent update public fields', async () => {
    const admin = await createAccount(Role.ADMIN);
    const first = await createAccount();
    const second = await createAccount();
    const outsider = await createAccount();
    const companyName = label('Çağrı Emlak');
    const sameName = label('Ortak Firma');
    const firstApplication = await postApplication(first.token, companyName);
    const secondApplication = await postApplication(second.token, sameName);
    const thirdUser = await createAccount();
    const thirdApplication = await postApplication(thirdUser.token, sameName);
    await uploadRequiredDocuments(first.token);
    await uploadRequiredDocuments(second.token);
    await uploadRequiredDocuments(thirdUser.token);

    expect(
      (await approve(admin.token, text(responseData(firstApplication).id)))
        .status,
    ).toBe(200);
    expect(
      (await approve(admin.token, text(responseData(secondApplication).id)))
        .status,
    ).toBe(200);
    expect(
      (await approve(admin.token, text(responseData(thirdApplication).id)))
        .status,
    ).toBe(200);

    const firstProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: first.userId },
    });
    const secondProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: second.userId },
    });
    const thirdProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: thirdUser.userId },
    });
    const turkishSlug = slugOf(companyName);
    const publicProfile = await http().get(
      `/api/v1/agents/${firstProfile.slug}`,
    );
    const missingProfile = await http().get('/api/v1/agents/does-not-exist');
    const userProfile = await http()
      .get('/api/v1/agents/me')
      .set('Authorization', `Bearer ${outsider.token}`);
    const anonymousProfile = await http().get('/api/v1/agents/me');
    const updated = await http()
      .patch('/api/v1/agents/me')
      .set('Authorization', `Bearer ${first.token}`)
      .send({
        companyName: 'Yeni Unvan',
        phone: '+905559998877',
        description: '',
      });
    const forbiddenUpdate = await http()
      .patch('/api/v1/agents/me')
      .set('Authorization', `Bearer ${first.token}`)
      .send({
        slug: 'hacked',
        isActive: false,
        role: 'ADMIN',
        userId: outsider.userId,
      });
    const roleUpdate = await http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ role: 'AGENT' });
    const missingRoleRoute = await http()
      .patch(`/api/v1/users/${outsider.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'AGENT' });
    const afterUpdate = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: first.userId },
    });
    const published = await http().get(`/api/v1/agents/${firstProfile.slug}`);
    const agents = await http()
      .get('/api/v1/admin/agents')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${admin.token}`);
    const agentDetail = await http()
      .get(`/api/v1/admin/agents/${firstProfile.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    const hidden = await http()
      .patch(`/api/v1/admin/agents/${firstProfile.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    const hiddenPublic = await http().get(
      `/api/v1/agents/${firstProfile.slug}`,
    );
    const selfWhileHidden = await http()
      .get('/api/v1/agents/me')
      .set('Authorization', `Bearer ${first.token}`);
    const outsiderStillUser = await prisma.user.findUniqueOrThrow({
      where: { id: outsider.userId },
    });

    const sharedSlug = slugOf(sameName);

    expect(firstProfile.slug).toBe(turkishSlug);
    expect(new Set([secondProfile.slug, thirdProfile.slug])).toEqual(
      new Set([sharedSlug, `${sharedSlug}-2`]),
    );
    expect(publicProfile.status).toBe(200);
    expect(responseData(publicProfile)).toMatchObject({
      slug: firstProfile.slug,
      companyName,
      phone: '+905551110000',
      email: 'office@example.com',
      city: 'Konya',
      district: 'Selcuklu',
      description: 'Konut ve arsa',
      logoUrl: null,
    });
    expect(responseData(publicProfile).taxNumber).toBeUndefined();
    expect(responseData(publicProfile).address).toBeUndefined();
    expect(responseData(publicProfile).userId).toBeUndefined();
    expect(missingProfile.status).toBe(404);
    expect(userProfile.status).toBe(403);
    expect(anonymousProfile.status).toBe(401);
    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      slug: firstProfile.slug,
      companyName: 'Yeni Unvan',
      phone: '+905559998877',
      description: null,
    });
    expect(forbiddenUpdate.status).toBe(400);
    expect(afterUpdate.slug).toBe(firstProfile.slug);
    expect(afterUpdate.isActive).toBe(true);
    expect(afterUpdate.companyName).toBe('Yeni Unvan');
    expect(responseData(published).companyName).toBe('Yeni Unvan');
    expect(responseData(published).slug).toBe(firstProfile.slug);
    expect(roleUpdate.status).toBe(400);
    expect(missingRoleRoute.status).toBe(404);
    expect(outsiderStillUser.role).toBe('USER');
    expect(agents.status).toBe(200);
    expect(listItems(agents).some((item) => item.id === firstProfile.id)).toBe(
      true,
    );
    expect(agentDetail.status).toBe(200);
    expect(nested(responseData(agentDetail).user).passwordHash).toBeUndefined();
    expect(responseData(agentDetail).taxNumber).toBe('1234567890');
    expect(hidden.status).toBe(200);
    expect(responseData(hidden)).toMatchObject({
      id: firstProfile.id,
      isActive: false,
    });
    expect(hiddenPublic.status).toBe(404);
    expect(selfWhileHidden.status).toBe(200);
    expect(responseData(selfWhileHidden).isActive).toBe(false);
    expect(
      (
        await http()
          .get('/api/v1/admin/agents')
          .set('Authorization', `Bearer ${outsider.token}`)
      ).status,
    ).toBe(403);
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

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function slugOf(companyName: string) {
  return companyName
    .replaceAll('Ç', 'c')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ü', 'u')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
