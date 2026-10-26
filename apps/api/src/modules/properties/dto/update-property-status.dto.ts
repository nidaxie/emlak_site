import { IsEnum } from 'class-validator';
import { PropertyStatus } from '../../../generated/prisma/enums';

export class UpdatePropertyStatusDto {
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;
}
