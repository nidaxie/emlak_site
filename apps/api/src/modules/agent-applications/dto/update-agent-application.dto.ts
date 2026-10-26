import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimEmail, trimValue } from '../../../common/dto/trim';

export class UpdateAgentApplicationDto {
  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorizedFirstName?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorizedLastName?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @Transform(trimEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @Matches(/^\d{10,11}$/)
  taxNumber?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  description?: string;
}
