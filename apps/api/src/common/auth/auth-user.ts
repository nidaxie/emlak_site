import { Role } from '../../generated/prisma/enums';

export type AuthUser = {
  id: string;
  role: Role;
};
