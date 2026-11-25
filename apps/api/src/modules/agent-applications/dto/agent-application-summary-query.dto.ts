import { IsIn, IsOptional, ValidateBy } from 'class-validator';
import { parseCreatedBound } from '../../users/admin-user-query';

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

export class AgentApplicationSummaryQueryDto {
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
