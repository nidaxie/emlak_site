import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ListingType,
  PropertyStatus,
  PropertyType,
} from '../../../generated/prisma/enums';

const sorts = ['newest', 'price_asc', 'price_desc'] as const;

export class ListPublicPropertiesQueryDto {
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/)
  minPrice?: string;

  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/)
  maxPrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  rooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  livingRooms?: number;

  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/)
  minArea?: string;

  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/)
  maxArea?: string;

  @IsOptional()
  @IsIn(sorts)
  sort?: (typeof sorts)[number];

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

export class ListMyPropertiesQueryDto {
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

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

export class ListAdminPropertiesQueryDto {
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  deleted?: 'true' | 'false';

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
