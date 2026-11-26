import { IsBoolean } from 'class-validator';
import { ModerationReasonDto } from '../../../common/dto/moderation-reason.dto';

export class UpdateAgentStatusDto extends ModerationReasonDto {
  @IsBoolean()
  isActive!: boolean;
}
