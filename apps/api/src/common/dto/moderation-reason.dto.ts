import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimValue } from './trim';

export class ModerationReasonDto {
  @Transform(trimValue)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
