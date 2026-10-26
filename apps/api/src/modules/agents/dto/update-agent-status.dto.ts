import { IsBoolean } from 'class-validator';

export class UpdateAgentStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
