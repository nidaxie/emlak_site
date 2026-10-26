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

export class CreateAgentApplicationDto {
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorizedFirstName!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorizedLastName!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  phone!: string;

  @Transform(trimEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimValue)
  @IsString()
  @Matches(/^\d{10,11}$/)
  taxNumber!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  district!: string;

  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address!: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  description?: string;
}
