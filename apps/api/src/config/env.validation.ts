import { plainToInstance, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { parseDurationMs } from './duration';

const environments = ['development', 'production', 'test'] as const;
const sameSiteValues = ['lax', 'strict', 'none'] as const;

class EnvironmentVariables {
  @IsIn(environments)
  NODE_ENV!: (typeof environments)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsIn(sameSiteValues)
  COOKIE_SAMESITE!: (typeof sameSiteValues)[number];

  @IsBoolean()
  COOKIE_SECURE!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_RATE_LIMIT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(3_600_000)
  AUTH_RATE_TTL_MS!: number;

  @IsIn(['local'])
  STORAGE_DRIVER!: 'local';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  STORAGE_LOCAL_ROOT?: string;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
}

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv = config.NODE_ENV ?? 'development';
  const validated = plainToInstance(
    EnvironmentVariables,
    {
      NODE_ENV: nodeEnv,
      PORT: config.PORT ?? 3001,
      DATABASE_URL: config.DATABASE_URL,
      CORS_ORIGIN: config.CORS_ORIGIN ?? 'http://localhost:3000',
      JWT_SECRET: config.JWT_SECRET,
      JWT_ACCESS_EXPIRES_IN: config.JWT_ACCESS_EXPIRES_IN ?? '15m',
      JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET,
      JWT_REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN ?? '7d',
      COOKIE_SAMESITE: config.COOKIE_SAMESITE ?? 'lax',
      COOKIE_SECURE: readBoolean(
        config.COOKIE_SECURE,
        nodeEnv === 'production',
      ),
      AUTH_RATE_LIMIT: config.AUTH_RATE_LIMIT ?? 10,
      AUTH_RATE_TTL_MS: config.AUTH_RATE_TTL_MS ?? 60_000,
      STORAGE_DRIVER: config.STORAGE_DRIVER ?? 'local',
      STORAGE_LOCAL_ROOT: config.STORAGE_LOCAL_ROOT || undefined,
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {});
        return `${error.property}: ${constraints.join(', ')}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${details}`);
  }

  const accessTtl = parseDurationMs(validated.JWT_ACCESS_EXPIRES_IN);
  const refreshTtl = parseDurationMs(validated.JWT_REFRESH_EXPIRES_IN);
  const extra: string[] = [];

  if (accessTtl === null) {
    extra.push('JWT_ACCESS_EXPIRES_IN: use a duration such as 15m');
  }

  if (refreshTtl === null) {
    extra.push('JWT_REFRESH_EXPIRES_IN: use a duration such as 7d');
  }

  if (accessTtl !== null && refreshTtl !== null && accessTtl >= refreshTtl) {
    extra.push(
      'JWT_ACCESS_EXPIRES_IN: must be shorter than JWT_REFRESH_EXPIRES_IN',
    );
  }

  if (validated.JWT_SECRET === validated.JWT_REFRESH_SECRET) {
    extra.push('JWT_REFRESH_SECRET: must be different from JWT_SECRET');
  }

  if (validated.COOKIE_SAMESITE === 'none' && !validated.COOKIE_SECURE) {
    extra.push('COOKIE_SECURE: must be true when COOKIE_SAMESITE is none');
  }

  if (extra.length > 0) {
    throw new Error(`Environment validation failed:\n${extra.join('\n')}`);
  }

  return {
    NODE_ENV: validated.NODE_ENV,
    PORT: validated.PORT,
    DATABASE_URL: validated.DATABASE_URL,
    CORS_ORIGIN: validated.CORS_ORIGIN,
    JWT_SECRET: validated.JWT_SECRET,
    JWT_ACCESS_EXPIRES_IN: validated.JWT_ACCESS_EXPIRES_IN,
    JWT_REFRESH_SECRET: validated.JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN: validated.JWT_REFRESH_EXPIRES_IN,
    COOKIE_SAMESITE: validated.COOKIE_SAMESITE,
    COOKIE_SECURE: validated.COOKIE_SECURE,
    AUTH_RATE_LIMIT: validated.AUTH_RATE_LIMIT,
    AUTH_RATE_TTL_MS: validated.AUTH_RATE_TTL_MS,
    STORAGE_DRIVER: validated.STORAGE_DRIVER,
    STORAGE_LOCAL_ROOT: validated.STORAGE_LOCAL_ROOT ?? '',
  };
}
