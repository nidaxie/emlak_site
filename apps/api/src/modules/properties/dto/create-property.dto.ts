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

export class CreatePropertyDto {
  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @IsEnum(ListingType)
  listingType!: ListingType;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  price!: string;

  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  grossAreaM2!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 2))
  @Matches(/^\d+\.\d{2}$/)
  netAreaM2?: string;

  @IsInt()
  @Min(0)
  @Max(50)
  rooms!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  livingRooms!: number;

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

  @IsUUID()
  cityId!: string;

  @IsUUID()
  districtId!: string;

  @IsUUID()
  neighborhoodId!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address!: string;

  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 6))
  @Matches(/^-?\d+\.\d{6}$/)
  latitude!: string;

  @Transform(({ value }: { value: unknown }) => normalizeDecimal(value, 6))
  @Matches(/^-?\d+\.\d{6}$/)
  longitude!: string;

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
