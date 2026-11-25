import { IsIn, IsOptional, ValidateBy } from 'class-validator';
import { parseCreatedBound } from '../admin-user-query';

function IsAdminDateBound(edge: 'start' | 'end') {
  return ValidateBy({
    name: 'isAdminDateBound',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && parseCreatedBound(value, edge) !== null,
      defaultMessage: () => 'Invalid date',
    },
  });
}

export class UserSummaryQueryDto {
  @IsOptional()
  @IsAdminDateBound('start')
  createdFrom?: string;

  @IsOptional()
  @IsAdminDateBound('end')
  createdTo?: string;

  @IsOptional()
  @IsIn(['day', 'month'])
  bucket?: 'day' | 'month';
}
