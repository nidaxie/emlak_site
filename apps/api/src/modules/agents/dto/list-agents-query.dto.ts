import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { parseCreatedBound } from '../../users/admin-user-query';

function blankToUndefined({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
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

export class ListAgentsQueryDto {
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  userIsActive?: 'true' | 'false';

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

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
