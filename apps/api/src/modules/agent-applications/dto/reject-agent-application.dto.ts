import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimValue } from '../../../common/dto/trim';

export class RejectAgentApplicationDto {
  @Transform(trimValue)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
