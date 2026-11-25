import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { Role } from '../../../generated/prisma/enums';
import { parseCreatedBound } from '../admin-user-query';

function emptyToUndefined({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function IsAdminDateBound(edge: 'start' | 'end') {
  return ValidateBy({
    name: 'isAdminDateBound',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && parseCreatedBound(value, edge) !== null,
      defaultMessage: () => 'Invalid date',
    },
  });
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsAdminDateBound('start')
  createdFrom?: string;

  @IsOptional()
  @IsAdminDateBound('end')
  createdTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
