import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { ApplicationStatus, Role } from '../src/generated/prisma/enums';

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
    return `${name} ${Date.now()}-${sequence}`;
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

  function submitMine(token: string) {
    return http()
      .post('/api/v1/agent-applications/me/submit')
      .set('Authorization', `Bearer ${token}`);
  }

  async function sendToReview(token: string) {
    await uploadRequiredDocuments(token);
    const submitted = await submitMine(token);
    expect(submitted.status).toBe(200);
    return submitted;
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
      status: 'DRAFT',
      submittedAt: null,
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
      message: 'Draft application already exists',
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
        where: { userId: user.userId, status: 'DRAFT' },
      }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({
        where: { userId: racer.userId, status: 'DRAFT' },
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
      status: 'DRAFT',
    });
    expect(forbidden.status).toBe(400);
    expect(stored.status).toBe('DRAFT');
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
    const draftUser = await createAccount();
    const pending = await postApplication(pendingUser.token, pendingName);
    const approved = await postApplication(approvedUser.token, approvedName);
    const rejected = await postApplication(rejectedUser.token, rejectedName);
    const draft = await postApplication(draftUser.token, label('Queue Draft'));
    const pendingId = text(responseData(pending).id);
    const approvedId = text(responseData(approved).id);
    const rejectedId = text(responseData(rejected).id);
    const draftId = text(responseData(draft).id);

    await sendToReview(pendingUser.token);
    await sendToReview(approvedUser.token);
    await sendToReview(rejectedUser.token);
    expect((await approve(admin.token, approvedId)).status).toBe(200);
    expect((await reject(admin.token, rejectedId)).status).toBe(200);

    const anonymousList = await http().get('/api/v1/admin/agent-applications');
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
    const draftPage = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'DRAFT', limit: 50, page: 1 })
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
    const draftItems = listItems(draftPage);

    expect(anonymousList.status).toBe(401);
    expect(userList.status).toBe(403);
    expect(agentList.status).toBe(403);
    expect(adminList.status).toBe(200);
    expect(listItems(adminList)).toHaveLength(1);
    expect(responseData(adminList).page).toBe(1);
    expect(responseData(adminList).limit).toBe(1);
    expect(Number(responseData(adminList).total)).toBeGreaterThanOrEqual(1);
    expect(pendingItems.every((item) => item.status === 'PENDING')).toBe(true);
    expect(pendingItems.some((item) => item.id === pendingId)).toBe(true);
    expect(pendingItems.some((item) => item.id === draftId)).toBe(false);
    expect(pendingItems.some((item) => item.id === approvedId)).toBe(false);
    expect(draftItems.every((item) => item.status === 'DRAFT')).toBe(true);
    expect(draftItems.some((item) => item.id === draftId)).toBe(true);
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
    expect((await submitMine(user.token)).status).toBe(200);
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
    expect(storedProfile.isActive).toBe(true);
    const approvalAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: applicationId,
        action: 'AGENT_APPLICATION_APPROVED',
      },
    });
    expect(approvalAudit).toMatchObject({
      actorUserId: admin.userId,
      entityType: 'AGENT_APPLICATION',
      entityId: applicationId,
      metadata: null,
    });
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

    await sendToReview(inactive.token);
    await sendToReview(occupied.token);
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
    await sendToReview(user.token);
    const emptyReason = await reject(admin.token, applicationId, '');
    const blankReason = await reject(admin.token, applicationId, '   ');
    const shortReason = await reject(admin.token, applicationId, 'no');
    const rejected = await reject(admin.token, applicationId);
    const again = await reject(admin.token, applicationId);
    const approvedLater = await approve(admin.token, applicationId);
    const edited = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ city: 'Istanbul' });
    const reapplied = await http()
      .post('/api/v1/agent-applications/me/revise')
      .set('Authorization', `Bearer ${user.token}`);
    const third = await postApplication(user.token, label('Third'));
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    expect(emptyReason.status).toBe(400);
    expect(blankReason.status).toBe(400);
    expect(shortReason.status).toBe(400);
    expect(rejected.status).toBe(200);
    const rejectionAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: applicationId,
        action: 'AGENT_APPLICATION_REJECTED',
      },
    });
    expect(rejectionAudit).toMatchObject({
      actorUserId: admin.userId,
      entityType: 'AGENT_APPLICATION',
      entityId: applicationId,
      metadata: { reason: 'Eksik vergi levhasi' },
    });
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
    expect(stored.status).toBe('DRAFT');
    expect(stored.city).toBe('Konya');
    expect(account.role).toBe('USER');
    expect(
      await prisma.agentProfile.count({ where: { userId: user.userId } }),
    ).toBe(0);
    expect(reapplied.status).toBe(200);
    expect(responseData(reapplied)).toMatchObject({
      id: applicationId,
      status: 'DRAFT',
      submittedAt: null,
      rejectionReason: null,
    });
    expect(third.status).toBe(409);
    expect(responseData(third).message).toBe(
      'Draft application already exists',
    );
    expect(
      await prisma.agentApplication.count({
        where: { userId: user.userId, status: 'DRAFT' },
      }),
    ).toBe(1);
    expect(
      await prisma.agentApplication.count({ where: { userId: user.userId } }),
    ).toBe(1);
  });

  it('serializes two approvals of the same application', async () => {
    const firstAdmin = await createAccount(Role.ADMIN);
    const secondAdmin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const created = await postApplication(user.token, label('Race'));
    const applicationId = text(responseData(created).id);
    await sendToReview(user.token);
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

  it('does not approve a draft or a rejected application', async () => {
    const admin = await createAccount(Role.ADMIN);
    const draftUser = await createAccount();
    const rejectedUser = await createAccount();
    const draftApplication = await postApplication(
      draftUser.token,
      label('Draft Approve'),
    );
    const rejectedApplication = await postApplication(
      rejectedUser.token,
      label('Rejected Approve'),
    );
    const draftId = text(responseData(draftApplication).id);
    const rejectedId = text(responseData(rejectedApplication).id);

    await sendToReview(rejectedUser.token);
    expect((await reject(admin.token, rejectedId)).status).toBe(200);

    const draftDecision = await approve(admin.token, draftId);
    const rejectedDecision = await approve(admin.token, rejectedId);
    const draftStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: draftId },
    });
    const rejectedStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: rejectedId },
    });

    expect(draftDecision.status).toBe(409);
    expect(responseData(draftDecision).message).toBe(
      'Application is no longer pending',
    );
    expect(draftStored.status).toBe('DRAFT');
    expect(rejectedDecision.status).toBe(409);
    expect(responseData(rejectedDecision).message).toBe(
      'Application is no longer pending',
    );
    expect(rejectedStored.status).toBe('REJECTED');
    expect(
      await prisma.agentProfile.count({
        where: { userId: { in: [draftUser.userId, rejectedUser.userId] } },
      }),
    ).toBe(0);
  });

  it('lets one of two simultaneous decisions win', async () => {
    const firstAdmin = await createAccount(Role.ADMIN);
    const secondAdmin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const created = await postApplication(user.token, label('Decision Race'));
    const applicationId = text(responseData(created).id);
    await sendToReview(user.token);

    const results = await Promise.all([
      approve(firstAdmin.token, applicationId),
      reject(secondAdmin.token, applicationId, 'Eksik imza'),
    ]);
    const statuses = results.map((response) => response.status).sort();
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    const profiles = await prisma.agentProfile.count({
      where: { userId: user.userId },
    });

    expect(statuses).toEqual([200, 409]);
    expect(['APPROVED', 'REJECTED']).toContain(stored.status);
    if (stored.status === 'APPROVED') {
      expect(account.role).toBe('AGENT');
      expect(profiles).toBe(1);
      expect(stored.rejectionReason).toBeNull();
    } else {
      expect(account.role).toBe('USER');
      expect(profiles).toBe(0);
      expect(stored.rejectionReason).toBe('Eksik imza');
    }
  });

  it('serves application documents only to the owning admin request', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount();
    const other = await createAccount();
    const created = await postApplication(owner.token, label('Owned Docs'));
    const otherCreated = await postApplication(
      other.token,
      label('Other Docs'),
    );
    const applicationId = text(responseData(created).id);
    const otherId = text(responseData(otherCreated).id);
    const uploaded = await uploadDocument(owner.token, 'TAX_CERTIFICATE');
    const documentId = text(responseData(uploaded).id);
    const stored = await prisma.agentApplicationDocument.findUniqueOrThrow({
      where: { id: documentId },
      select: { fileId: true, file: { select: { storageKey: true } } },
    });
    const anonymous = await http().get(
      `/api/v1/admin/agent-applications/${applicationId}/documents`,
    );
    const ownerList = await http()
      .get(`/api/v1/admin/agent-applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${owner.token}`);
    const ownerFile = await http()
      .get(
        `/api/v1/admin/agent-applications/${applicationId}/documents/${documentId}`,
      )
      .set('Authorization', `Bearer ${owner.token}`);
    const crossed = await http()
      .get(
        `/api/v1/admin/agent-applications/${otherId}/documents/${documentId}`,
      )
      .set('Authorization', `Bearer ${admin.token}`);
    const adminList = await http()
      .get(`/api/v1/admin/agent-applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${admin.token}`);
    const adminFile = await http()
      .get(
        `/api/v1/admin/agent-applications/${applicationId}/documents/${documentId}`,
      )
      .set('Authorization', `Bearer ${admin.token}`);

    expect(anonymous.status).toBe(401);
    expect(ownerList.status).toBe(403);
    expect(ownerFile.status).toBe(403);
    expect(crossed.status).toBe(404);
    expect(adminList.status).toBe(200);
    expect(Array.isArray(adminList.body)).toBe(true);
    expect(
      (adminList.body as Array<{ id: string }>).some(
        (item) => item.id === documentId,
      ),
    ).toBe(true);
    expect(adminFile.status).toBe(200);
    expect(adminFile.headers['content-disposition']).toContain('attachment');
    expect(adminFile.headers['cache-control']).toContain('private');
    expect(JSON.stringify(adminFile.body)).not.toContain(
      stored.file.storageKey,
    );

    await prisma.storedFile.update({
      where: { id: stored.fileId },
      data: { deletedAt: new Date() },
    });
    const hiddenList = await http()
      .get(`/api/v1/admin/agent-applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${admin.token}`);
    const hiddenFile = await http()
      .get(
        `/api/v1/admin/agent-applications/${applicationId}/documents/${documentId}`,
      )
      .set('Authorization', `Bearer ${admin.token}`);

    expect(hiddenList.status).toBe(200);
    expect(hiddenList.body).toEqual([]);
    expect(hiddenFile.status).toBe(404);
  });

  it('stores a draft, review metadata, and only one profile per user', async () => {
    const user = await createAccount();
    const reviewer = await createAccount(Role.ADMIN);
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    expect(account.role).toBe(Role.USER);

    const draft = await prisma.agentApplication.create({
      data: {
        userId: user.userId,
        companyName: label('Draft'),
        authorizedFirstName: 'Ali',
        authorizedLastName: 'Yilmaz',
        phone: '+905551110000',
        email: 'office@example.com',
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Yazir Mahallesi 1',
        status: ApplicationStatus.DRAFT,
      },
    });
    const reviewedAt = new Date('2026-11-24T12:00:00.000Z');
    const rejected = await prisma.agentApplication.update({
      where: { id: draft.id },
      data: {
        status: ApplicationStatus.REJECTED,
        rejectionReason: 'Eksik yetki belgesi',
        reviewedById: reviewer.userId,
        reviewedAt,
      },
    });
    const approved = await prisma.agentApplication.update({
      where: { id: draft.id },
      data: {
        status: ApplicationStatus.APPROVED,
        rejectionReason: null,
      },
    });
    const pendingUser = await createAccount();
    const created = await postApplication(
      pendingUser.token,
      label('Submitted'),
    );
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: text(responseData(created).id) },
    });
    const slug = `domain-profile-${Date.now()}-${sequence}`;
    await prisma.agentProfile.create({
      data: {
        userId: pendingUser.userId,
        slug,
        companyName: 'Domain Ofis',
        phone: '+905551110000',
        email: 'office@example.com',
        taxNumber: '1234567890',
        city: 'Konya',
        district: 'Selcuklu',
        address: 'Yazir Mahallesi 1',
      },
    });

    expect(draft.status).toBe(ApplicationStatus.DRAFT);
    expect(draft.submittedAt).toBeNull();
    expect(draft.rejectionReason).toBeNull();
    expect(draft.reviewedById).toBeNull();
    expect(draft.reviewedAt).toBeNull();
    expect(rejected).toMatchObject({
      status: ApplicationStatus.REJECTED,
      rejectionReason: 'Eksik yetki belgesi',
      reviewedById: reviewer.userId,
      reviewedAt,
    });
    expect(approved.status).toBe(ApplicationStatus.APPROVED);
    expect(approved.rejectionReason).toBeNull();
    expect(created.status).toBe(201);
    expect(responseData(created).status).toBe(ApplicationStatus.DRAFT);
    expect(stored.status).toBe(ApplicationStatus.DRAFT);
    expect(stored.submittedAt).toBeNull();
    await expect(
      prisma.agentProfile.create({
        data: {
          userId: pendingUser.userId,
          slug: `${slug}-2`,
          companyName: 'Ikinci Ofis',
          phone: '+905551110000',
          email: 'office@example.com',
          taxNumber: '1234567890',
          city: 'Konya',
          district: 'Selcuklu',
          address: 'Yazir Mahallesi 1',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(
      await prisma.agentProfile.count({
        where: { userId: pendingUser.userId },
      }),
    ).toBe(1);
  });

  it('submits a draft only after the required documents are present', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const created = await postApplication(user.token, label('Lifecycle'));
    const applicationId = text(responseData(created).id);
    const storedDraft = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const updated = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ city: 'Ankara' });
    const tax = await uploadDocument(user.token, 'TAX_CERTIFICATE');
    const earlySubmit = await submitMine(user.token);
    const earlyStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const authorization = await uploadDocument(
      user.token,
      'AUTHORIZATION_CERTIFICATE',
    );
    const submitted = await submitMine(user.token);
    const pendingStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const pendingPatch = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ city: 'Istanbul' });
    const pendingUpload = await uploadDocument(user.token, 'TAX_CERTIFICATE');
    const secondSubmit = await submitMine(user.token);
    const pendingQueue = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ status: 'PENDING', limit: 50, page: 1 })
      .set('Authorization', `Bearer ${admin.token}`);
    const duplicate = await postApplication(user.token, label('Second'));
    const rejected = await reject(admin.token, applicationId, 'Eksik imza');
    const rejectedPatch = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ district: 'Meram' });
    const revised = await http()
      .post('/api/v1/agent-applications/me/revise')
      .set('Authorization', `Bearer ${user.token}`);
    const revisedPatch = await http()
      .patch('/api/v1/agent-applications/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ district: 'Meram' });
    const resubmitted = await submitMine(user.token);
    const resubmittedStored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const blockedAgain = await postApplication(user.token, label('Third'));

    expect(created.status).toBe(201);
    expect(responseData(created)).toMatchObject({
      status: 'DRAFT',
      submittedAt: null,
    });
    expect(storedDraft.status).toBe('DRAFT');
    expect(storedDraft.submittedAt).toBeNull();
    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      status: 'DRAFT',
      city: 'Ankara',
    });
    expect(tax.status).toBe(201);
    expect(earlySubmit.status).toBe(409);
    expect(responseData(earlySubmit).message).toBe(
      'Required documents are missing',
    );
    expect(earlyStored.status).toBe('DRAFT');
    expect(earlyStored.submittedAt).toBeNull();
    expect(authorization.status).toBe(201);
    expect(submitted.status).toBe(200);
    expect(responseData(submitted)).toMatchObject({
      id: applicationId,
      status: 'PENDING',
    });
    expect(responseData(submitted).submittedAt).toEqual(expect.any(String));
    expect(pendingStored.status).toBe('PENDING');
    expect(pendingStored.submittedAt).toBeInstanceOf(Date);
    expect(pendingStored.rejectionReason).toBeNull();
    expect(pendingPatch.status).toBe(409);
    expect(responseData(pendingPatch).message).toBe(
      'Application is not a draft',
    );
    expect(pendingUpload.status).toBe(409);
    expect(responseData(pendingUpload).message).toBe(
      'Application is not a draft',
    );
    expect(secondSubmit.status).toBe(409);
    expect(responseData(secondSubmit).message).toBe(
      'Application is not a draft',
    );
    expect(
      listItems(pendingQueue).some((item) => item.id === applicationId),
    ).toBe(true);
    expect(duplicate.status).toBe(409);
    expect(responseData(duplicate).message).toBe(
      'Pending application already exists',
    );
    expect(rejected.status).toBe(200);
    expect(responseData(rejected)).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Eksik imza',
    });
    expect(rejectedPatch.status).toBe(409);
    expect(revised.status).toBe(200);
    expect(responseData(revised)).toMatchObject({
      id: applicationId,
      status: 'DRAFT',
      submittedAt: null,
      rejectionReason: null,
    });
    expect(revisedPatch.status).toBe(200);
    expect(responseData(revisedPatch).district).toBe('Meram');
    expect(resubmitted.status).toBe(200);
    expect(responseData(resubmitted).status).toBe('PENDING');
    expect(resubmittedStored.reviewedAt).toBeNull();
    expect(resubmittedStored.reviewedById).toBeNull();
    expect(resubmittedStored.rejectionReason).toBeNull();
    expect(resubmittedStored.submittedAt).toBeInstanceOf(Date);
    expect(blockedAgain.status).toBe(409);
    expect(responseData(blockedAgain).message).toBe(
      'Pending application already exists',
    );
    expect(
      await prisma.agentApplication.count({ where: { userId: user.userId } }),
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
    await sendToReview(first.token);
    await sendToReview(second.token);
    await sendToReview(thirdUser.token);

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
      .send({ isActive: false, reason: 'Yonetim gerekcesi' });
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

  it('accepts one of two simultaneous draft submits', async () => {
    const user = await createAccount();
    const created = await postApplication(user.token, label('Cift'));
    const applicationId = text(responseData(created).id);
    await uploadRequiredDocuments(user.token);
    const [first, second] = await Promise.all([
      submitMine(user.token),
      submitMine(user.token),
    ]);
    const stored = await prisma.agentApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    const count = await prisma.agentApplication.count({
      where: { userId: user.userId },
    });

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(count).toBe(1);
    expect(stored.status).toBe('PENDING');
    expect(stored.submittedAt).toEqual(expect.any(Date));
  });

  it('filters applications across search, place, date, and user without forcing pending', async () => {
    const admin = await createAccount(Role.ADMIN);
    const owner = await createAccount();
    const other = await createAccount();
    const token = `faz331-${Date.now()}-${sequence}`;
    const taxNumber = `9${String(Date.now()).slice(-9)}`;
    const contactEmail = `${token}@office.example`;
    await prisma.user.update({
      where: { id: owner.userId },
      data: { firstName: 'İpek', lastName: 'Yılmaz' },
    });
    const created = await postApplication(owner.token, `${token} Emlak`, {
      taxNumber,
      email: contactEmail,
      city: 'Konya',
      district: 'Selcuklu',
    });
    const otherCreated = await postApplication(other.token, `${token} Diger`, {
      taxNumber: `8${String(Date.now()).slice(-9)}`,
      email: `${token}-other@office.example`,
      city: 'Ankara',
      district: 'Cankaya',
    });
    const id = text(responseData(created).id);
    const otherId = text(responseData(otherCreated).id);
    const createdAt = new Date('2011-06-15T12:00:00.000Z');

    await prisma.agentApplication.update({
      where: { id },
      data: { createdAt },
    });
    await sendToReview(other.token);
    await prisma.agentApplication.update({
      where: { id: otherId },
      data: { submittedAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    const later = await createAccount();
    const laterCreated = await postApplication(later.token, `${token} Sonra`);
    const laterId = text(responseData(laterCreated).id);
    await sendToReview(later.token);
    await prisma.agentApplication.update({
      where: { id: laterId },
      data: { submittedAt: new Date('2024-01-01T00:00:00.000Z') },
    });

    const auth = { Authorization: `Bearer ${admin.token}` };
    const byName = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: '  Yılmaz İpek  ' })
      .set(auth);
    const byEmail = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: owner.email })
      .set(auth);
    const byOffice = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: contactEmail.toUpperCase() })
      .set(auth);
    const byTax = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: taxNumber })
      .set(auth);
    const byFirm = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: `${token} Emlak`, city: 'konya', district: 'selcuklu' })
      .set(auth);
    const wrongPlace = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: token, city: 'Konya', district: 'Meram' })
      .set(auth);
    const byDate = await http()
      .get('/api/v1/admin/agent-applications')
      .query({
        search: token,
        createdFrom: '2011-06-15',
        createdTo: '2011-06-15',
      })
      .set(auth);
    const byUser = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ userId: owner.userId })
      .set(auth);
    const pendingQueue = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ search: token, status: 'PENDING' })
      .set(auth);
    const reversed = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ createdFrom: '2026-02-02', createdTo: '2026-02-01' })
      .set(auth);
    const badLimit = await http()
      .get('/api/v1/admin/agent-applications')
      .query({ limit: 101 })
      .set(auth);

    expect(listItems(byName).some((item) => item.id === id)).toBe(true);
    expect(listItems(byEmail).some((item) => item.id === id)).toBe(true);
    expect(listItems(byOffice).some((item) => item.id === id)).toBe(true);
    expect(listItems(byTax).map((item) => item.id)).toEqual([id]);
    expect(listItems(byFirm).map((item) => item.id)).toEqual([id]);
    expect(listItems(wrongPlace)).toHaveLength(0);
    expect(listItems(byDate).map((item) => item.id)).toEqual([id]);
    expect(listItems(byUser).map((item) => item.id)).toEqual([id]);
    expect(listItems(byUser)[0]?.status).toBe('DRAFT');
    expect(listItems(pendingQueue).map((item) => item.id)).toEqual([
      laterId,
      otherId,
    ]);
    expect(reversed.status).toBe(400);
    expect(badLimit.status).toBe(400);
    expect(responseData(byFirm).total).toBe(1);
  });

  it('reports required document completion without counting a deleted file twice', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const companyName = label('Belge');
    const created = await postApplication(user.token, companyName);
    const id = text(responseData(created).id);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const listed = async () => {
      const response = await http()
        .get('/api/v1/admin/agent-applications')
        .query({ search: companyName })
        .set(auth);
      return nested(nested(listItems(response)[0]).documentCompletion);
    };

    expect(await listed()).toMatchObject({
      requiredCount: 2,
      completedCount: 0,
      isComplete: false,
      missingTypes: ['TAX_CERTIFICATE', 'AUTHORIZATION_CERTIFICATE'],
    });
    expect((await uploadDocument(user.token, 'TAX_CERTIFICATE')).status).toBe(
      201,
    );
    expect((await uploadDocument(user.token, 'TAX_CERTIFICATE')).status).toBe(
      201,
    );
    expect(await listed()).toMatchObject({
      completedCount: 1,
      isComplete: false,
      missingTypes: ['AUTHORIZATION_CERTIFICATE'],
    });
    expect(
      (await uploadDocument(user.token, 'AUTHORIZATION_CERTIFICATE')).status,
    ).toBe(201);
    expect(await listed()).toMatchObject({
      completedCount: 2,
      isComplete: true,
      missingTypes: [],
    });

    const tax = await prisma.agentApplicationDocument.findFirstOrThrow({
      where: { applicationId: id, documentType: 'TAX_CERTIFICATE' },
    });
    await prisma.storedFile.update({
      where: { id: tax.fileId },
      data: { deletedAt: new Date() },
    });
    expect(await listed()).toMatchObject({
      completedCount: 1,
      isComplete: false,
      missingTypes: ['TAX_CERTIFICATE'],
    });
  });

  it('shows the reviewer and the approved profile only on the approved application', async () => {
    const admin = await createAccount(Role.ADMIN);
    await prisma.user.update({
      where: { id: admin.userId },
      data: { firstName: 'Denet', lastName: 'Yonetici' },
    });
    const approvedUser = await createAccount();
    const rejectedUser = await createAccount();
    const approvedCreated = await postApplication(
      approvedUser.token,
      label('Onay Bag'),
    );
    const rejectedCreated = await postApplication(
      rejectedUser.token,
      label('Ret Bag'),
    );
    const approvedId = text(responseData(approvedCreated).id);
    const rejectedId = text(responseData(rejectedCreated).id);
    await sendToReview(approvedUser.token);
    await sendToReview(rejectedUser.token);
    expect((await approve(admin.token, approvedId)).status).toBe(200);
    expect(
      (await reject(admin.token, rejectedId, 'Eksik yetki belgesi')).status,
    ).toBe(200);

    const auth = { Authorization: `Bearer ${admin.token}` };
    const approved = await http()
      .get(`/api/v1/admin/agent-applications/${approvedId}`)
      .set(auth);
    const rejected = await http()
      .get(`/api/v1/admin/agent-applications/${rejectedId}`)
      .set(auth);
    const storedProfile = await prisma.agentProfile.findUniqueOrThrow({
      where: { userId: approvedUser.userId },
    });
    const approvedBody = responseData(approved);
    const rejectedBody = responseData(rejected);

    expect(nested(approvedBody.reviewedBy)).toMatchObject({
      id: admin.userId,
      firstName: 'Denet',
      lastName: 'Yonetici',
    });
    expect(nested(approvedBody.agentProfile).id).toBe(storedProfile.id);
    expect(approvedBody.passwordHash).toBeUndefined();
    expect(nested(rejectedBody.reviewedBy).id).toBe(admin.userId);
    expect(rejectedBody.agentProfile).toBeNull();
    expect(
      (
        await http()
          .post('/api/v1/agent-applications/me/revise')
          .set('Authorization', `Bearer ${rejectedUser.token}`)
      ).status,
    ).toBe(200);
    const revised = await http()
      .get(`/api/v1/admin/agent-applications/${rejectedId}`)
      .set(auth);
    expect(responseData(revised).reviewedBy).toBeNull();
    expect(responseData(revised).reviewedAt).toBeNull();
    expect(responseData(revised).status).toBe('DRAFT');
  });

  it('summarizes every application status independently from the created series', async () => {
    const admin = await createAccount(Role.ADMIN);
    const user = await createAccount();
    const agent = await createAccount(Role.AGENT);
    const inactiveAdmin = await createAccount(Role.ADMIN);
    await prisma.user.update({
      where: { id: inactiveAdmin.userId },
      data: { isActive: false },
    });
    await prisma.agentProfile.create({
      data: {
        userId: agent.userId,
        slug: `faz331-${agent.userId}`,
        companyName: 'Askida Firma',
        phone: '+905550000099',
        email: agent.email,
        taxNumber: '2222222222',
        city: 'Konya',
        district: 'Meram',
        address: 'Adres',
        isActive: false,
      },
    });
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .set(auth);
    const created = await postApplication(user.token, label('Sayac'));
    const after = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .set(auth);
    const ranged = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .query({
        createdFrom: '2001-01-01',
        createdTo: '2001-01-03',
        bucket: 'day',
      })
      .set(auth);
    const month = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .query({
        createdFrom: '2001-01-01',
        createdTo: '2001-03-01',
        bucket: 'month',
      })
      .set(auth);
    const missingBucket = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .query({ createdFrom: '2001-01-01', createdTo: '2001-01-02' })
      .set(auth);
    const reversed = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .query({
        createdFrom: '2001-02-02',
        createdTo: '2001-02-01',
        bucket: 'day',
      })
      .set(auth);
    const tooManyDays = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .query({
        createdFrom: '2000-01-01',
        createdTo: '2001-01-05',
        bucket: 'day',
      })
      .set(auth);
    const anonymous = await http().get(
      '/api/v1/admin/agent-applications/summary',
    );
    const asUser = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .set('Authorization', `Bearer ${user.token}`);
    const asAgent = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .set('Authorization', `Bearer ${agent.token}`);
    const asInactive = await http()
      .get('/api/v1/admin/agent-applications/summary')
      .set('Authorization', `Bearer ${inactiveAdmin.token}`);
    const beforeBody = responseData(before);
    const afterBody = responseData(after);
    const beforeStatuses = nested(beforeBody.statuses);
    const afterStatuses = nested(afterBody.statuses);
    const series = nested(responseData(ranged).created);

    expect(before.status).toBe(200);
    expect(beforeBody.created).toBeNull();
    expect(beforeBody.total).toBe(
      Number(beforeStatuses.DRAFT) +
        Number(beforeStatuses.PENDING) +
        Number(beforeStatuses.APPROVED) +
        Number(beforeStatuses.REJECTED),
    );
    expect(afterStatuses.DRAFT).toBe(Number(beforeStatuses.DRAFT) + 1);
    expect(afterStatuses.PENDING).toBe(beforeStatuses.PENDING);
    expect(afterStatuses.APPROVED).toBe(beforeStatuses.APPROVED);
    expect(afterStatuses.REJECTED).toBe(beforeStatuses.REJECTED);
    expect(responseData(ranged).statuses).toEqual(afterBody.statuses);
    expect(series.total).toBe(0);
    expect(series.points).toEqual([
      { bucketStart: '2001-01-01T00:00:00.000Z', count: 0 },
      { bucketStart: '2001-01-02T00:00:00.000Z', count: 0 },
      { bucketStart: '2001-01-03T00:00:00.000Z', count: 0 },
    ]);
    expect(nested(responseData(month).created).bucket).toBe('month');
    expect(
      (nested(responseData(month).created).points as unknown[]).length,
    ).toBe(3);
    expect(missingBucket.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(tooManyDays.status).toBe(400);
    expect(anonymous.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(asAgent.status).toBe(403);
    expect(asInactive.status).toBe(401);
    expect(text(responseData(created).id).length).toBeGreaterThan(0);
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
