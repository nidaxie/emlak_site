import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Roles } from '../src/common/decorators/roles.decorator';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { PrismaModule } from '../src/database/prisma/prisma.module';
import { Role } from '../src/generated/prisma/enums';
import { AuthModule } from '../src/modules/auth/auth.module';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';

const password = 'password123';

@Controller('rbac-probe')
@UseGuards(JwtAuthGuard, RolesGuard)
class RbacProbeController {
  @Get('user')
  @Roles(Role.USER)
  userRoute() {
    return { ok: true };
  }

  @Get('agent')
  @Roles(Role.AGENT)
  agentRoute() {
    return { ok: true };
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  adminRoute() {
    return { ok: true };
  }
}

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [RbacProbeController],
  providers: [RolesGuard],
})
class RbacProbeModule {}

describe('Auth and users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;
  let sequence = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, RbacProbeModule],
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
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'phase2-' } },
      });
    }

    await app?.close();
  });

  function nextEmail() {
    sequence += 1;
    return `phase2-${Date.now()}-${sequence}@example.com`;
  }

  function http() {
    return request(app.getHttpServer());
  }

  async function registerUser(
    email = nextEmail(),
    extra: Record<string, unknown> = {},
  ) {
    return http()
      .post('/api/v1/auth/register')
      .send({ email, password, ...extra });
  }

  async function loginUser(email: string, loginPassword = password) {
    return http()
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email, password: loginPassword });
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

  function parseJson(value: string): unknown {
    return JSON.parse(value) as unknown;
  }

  function text(value: unknown) {
    return typeof value === 'string' ? value : '';
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

  function setCookieHeader(response: Response) {
    const raw: unknown = response.headers['set-cookie'];

    if (Array.isArray(raw)) {
      return typeof raw[0] === 'string' ? raw[0] : undefined;
    }

    return typeof raw === 'string' ? raw : undefined;
  }

  it('registers a USER and does not return or accept a role', async () => {
    const email = nextEmail();
    const created = await registerUser(email, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+905551110000',
    });

    expect(created.status).toBe(201);
    expect(responseData(created)).toMatchObject({
      email,
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+905551110000',
      role: 'USER',
      isActive: true,
    });
    expect(responseData(created).passwordHash).toBeUndefined();
    expect(responseData(created).password).toBeUndefined();
    expect(setCookieHeader(created)).toBeUndefined();
    expect(JSON.stringify(responseData(created))).not.toContain(password);

    const adminEmail = nextEmail();
    const agentEmail = nextEmail();
    const adminAttempt = await registerUser(adminEmail, { role: 'ADMIN' });
    const agentAttempt = await registerUser(agentEmail, { role: 'AGENT' });

    expect(adminAttempt.status).toBe(400);
    expect(agentAttempt.status).toBe(400);
    expect(
      await prisma.user.count({
        where: { email: { in: [adminEmail, agentEmail] } },
      }),
    ).toBe(0);
  });

  it('rejects duplicate, invalid email and short password', async () => {
    const email = nextEmail();
    const mixed = email.replace('phase2-', 'Phase2-');
    const first = await registerUser(mixed);
    const duplicate = await registerUser(mixed.toLowerCase());
    const invalidEmail = await registerUser('not-an-email');
    const shortPassword = await http()
      .post('/api/v1/auth/register')
      .send({ email: nextEmail(), password: 'short' });

    expect(first.status).toBe(201);
    expect(responseData(first).email).toBe(mixed.toLowerCase());
    expect(duplicate.status).toBe(409);
    expect(responseData(duplicate)).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
      error: 'Conflict',
    });
    expect(invalidEmail.status).toBe(400);
    expect(responseData(invalidEmail).statusCode).toBe(400);
    expect(shortPassword.status).toBe(400);
    expect(responseData(shortPassword).statusCode).toBe(400);
  });

  it('logs in with a cookie and rejects unknown, wrong and inactive accounts the same way', async () => {
    const email = nextEmail();
    await registerUser(email);
    const success = await loginUser(email);
    const cookie = cookieFrom(success);
    const successBody = responseData(success);
    const successUser = nested(successBody.user);
    const payload = nested(
      parseJson(
        Buffer.from(
          text(successBody.accessToken).split('.')[1] ?? '',
          'base64url',
        ).toString(),
      ),
    );

    expect(success.status).toBe(200);
    expect(successUser.email).toBe(email);
    expect(successUser.role).toBe('USER');
    expect(successBody.refreshToken).toBeUndefined();
    expect(successUser.passwordHash).toBeUndefined();
    expect(cookie).toContain('refresh_token=');
    expect(setCookieHeader(success)).toContain('HttpOnly');
    expect(setCookieHeader(success)).toContain('Path=/api/v1/auth');
    expect(payload).toMatchObject({ sub: successUser.id, role: 'USER' });
    expect(payload.email).toBeUndefined();

    const unknown = await loginUser(nextEmail());
    const wrong = await loginUser(email, 'wrong-password');
    const unknownBody = responseData(unknown);
    const wrongBody = responseData(wrong);

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknownBody.message).toBe('Invalid email or password');
    expect(wrongBody.message).toBe(unknownBody.message);
    expect(wrongBody.error).toBe(unknownBody.error);

    await prisma.user.update({
      where: { email },
      data: { isActive: false },
    });
    const inactive = await loginUser(email);

    expect(inactive.status).toBe(401);
    expect(responseData(inactive).message).toBe('Invalid email or password');
  });

  it('refreshes with rotation, then rejects the old, expired, revoked and inactive token', async () => {
    const email = nextEmail();
    await registerUser(email);
    const loggedIn = await loginUser(email);
    const firstCookie = cookieFrom(loggedIn);

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', firstCookie);
    const secondCookie = cookieFrom(refreshed);

    const refreshedBody = responseData(refreshed);

    expect(refreshed.status).toBe(200);
    expect(refreshedBody.accessToken).toEqual(expect.any(String));
    expect(refreshedBody.refreshToken).toBeUndefined();
    expect(secondCookie).not.toBe(firstCookie);

    const reused = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', firstCookie);
    const current = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', secondCookie);
    const thirdCookie = cookieFrom(current);

    expect(reused.status).toBe(401);
    expect(current.status).toBe(200);

    const missing = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin);
    const malformed = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', 'refresh_token=not-a-token');

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);

    await prisma.authSession.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', thirdCookie);

    expect(expired.status).toBe(401);

    const again = await loginUser(email);
    const activeCookie = cookieFrom(again);
    await prisma.user.update({
      where: { email },
      data: { isActive: false },
    });
    const inactiveRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', activeCookie);

    expect(inactiveRefresh.status).toBe(401);
  });

  it('revokes the refresh session on logout', async () => {
    const email = nextEmail();
    await registerUser(email);
    const loggedIn = await loginUser(email);
    const cookie = cookieFrom(loggedIn);
    const loggedOut = await http()
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie);
    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookie);

    expect(loggedOut.status).toBe(200);
    expect(responseData(loggedOut)).toEqual({ ok: true });
    expect(setCookieHeader(loggedOut)).toContain('refresh_token=');
    expect(refreshed.status).toBe(401);
  });

  it('returns and updates only the signed-in profile', async () => {
    const email = nextEmail();
    await registerUser(email);
    const loggedIn = await loginUser(email);
    const loggedInBody = responseData(loggedIn);
    const token = text(loggedInBody.accessToken);
    const me = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);
    const updated = await http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Grace', lastName: 'Hopper', phone: '555000' });
    const roleChange = await http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });
    const activeChange = await http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    const anonymous = await http().get('/api/v1/users/me');
    const badToken = await http()
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-token');
    const expiredToken = sign(
      {
        sub: text(nested(loggedInBody.user).id),
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
    );
    const expired = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(me.status).toBe(200);
    expect(responseData(me).email).toBe(email);
    expect(responseData(me).passwordHash).toBeUndefined();
    expect(updated.status).toBe(200);
    expect(responseData(updated)).toMatchObject({
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '555000',
      role: 'USER',
    });
    expect(roleChange.status).toBe(400);
    expect(activeChange.status).toBe(400);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe(Role.USER);
    expect(stored.isActive).toBe(true);
    expect(anonymous.status).toBe(401);
    expect(badToken.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(responseData(anonymous)).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      path: '/api/v1/users/me',
    });

    await prisma.user.update({
      where: { email },
      data: { isActive: false },
    });
    const blocked = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(blocked.status).toBe(401);
  });

  it('authorizes USER, AGENT and ADMIN on role-protected routes', async () => {
    const userEmail = nextEmail();
    const agentEmail = nextEmail();
    const adminEmail = nextEmail();

    await registerUser(userEmail);
    await registerUser(agentEmail);
    await registerUser(adminEmail);
    await prisma.user.update({
      where: { email: agentEmail },
      data: { role: Role.AGENT },
    });
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });

    const userToken = text(
      responseData(await loginUser(userEmail)).accessToken,
    );
    const agentToken = text(
      responseData(await loginUser(agentEmail)).accessToken,
    );
    const adminToken = text(
      responseData(await loginUser(adminEmail)).accessToken,
    );

    const userOk = await http()
      .get('/api/v1/rbac-probe/user')
      .set('Authorization', `Bearer ${userToken}`);
    const userDenied = await http()
      .get('/api/v1/rbac-probe/admin')
      .set('Authorization', `Bearer ${userToken}`);
    const agentOk = await http()
      .get('/api/v1/rbac-probe/agent')
      .set('Authorization', `Bearer ${agentToken}`);
    const adminOk = await http()
      .get('/api/v1/rbac-probe/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(userOk.status).toBe(200);
    expect(userDenied.status).toBe(403);
    expect(responseData(userDenied)).toMatchObject({
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
    });
    expect(agentOk.status).toBe(200);
    expect(adminOk.status).toBe(200);
  });
});
