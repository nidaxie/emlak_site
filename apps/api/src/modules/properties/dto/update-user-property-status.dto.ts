import { IsIn } from 'class-validator';
import { PropertyStatus } from '../../../generated/prisma/enums';

export class UpdateUserPropertyStatusDto {
  @IsIn([PropertyStatus.ACTIVE, PropertyStatus.INACTIVE])
  status!: PropertyStatus;
}
