import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { parseOrigins } from '../../common/http/parse-origins';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertOrigin(request);
    const result = await this.auth.login(dto);
    this.cookies.set(response, result.refreshToken, this.tokens.refreshTtlMs());

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertOrigin(request);
    const result = await this.auth.refresh(this.cookies.read(request));
    this.cookies.set(response, result.refreshToken, this.tokens.refreshTtlMs());

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertOrigin(request);
    await this.auth.logout(this.cookies.read(request));
    this.cookies.clear(response);

    return { ok: true };
  }

  private assertOrigin(request: Request) {
    const origin = request.header('origin');
    const allowed = parseOrigins(this.config.getOrThrow<string>('CORS_ORIGIN'));

    if (!origin || !allowed.includes(origin)) {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
