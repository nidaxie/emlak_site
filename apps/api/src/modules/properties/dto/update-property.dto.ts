import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimValue } from '../../../common/dto/trim';
import {
  HeatingType,
  ListingType,
  PropertyType,
} from '../../../generated/prisma/enums';
import { normalizeDecimal } from '../property-rules';

export class UpdatePropertyDto {
  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  price?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  grossAreaM2?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  netAreaM2?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  rooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  livingRooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  buildingAge?: number;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  totalFloors?: number;

  @IsOptional()
  @IsEnum(HeatingType)
  heatingType?: HeatingType;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  districtId?: string;

  @IsOptional()
  @IsUUID()
  neighborhoodId?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 6))
  @Matches(/^-?\d+\.\d{6}$/)
  latitude?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 6))
  @Matches(/^-?\d+\.\d{6}$/)
  longitude?: string;

  @IsOptional()
  @IsBoolean()
  isFurnished?: boolean;

  @IsOptional()
  @IsBoolean()
  hasBalcony?: boolean;

  @IsOptional()
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @IsBoolean()
  hasParking?: boolean;

  @IsOptional()
  @IsBoolean()
  inSite?: boolean;
}
