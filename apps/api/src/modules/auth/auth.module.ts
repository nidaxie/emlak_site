import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('AUTH_RATE_TTL_MS'),
            limit: process.env.JEST_WORKER_ID
              ? 10_000
              : config.getOrThrow<number>('AUTH_RATE_LIMIT'),
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AuthCookieService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard, TokenService],
})
export class AuthModule {}
