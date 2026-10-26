import { Injectable, UnauthorizedException } from '@nestjs/common';
import { toPublicUser } from '../../common/auth/public-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { blankToNull } from '../auth/normalize';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    return toPublicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined
          ? { firstName: blankToNull(dto.firstName) }
          : {}),
        ...(dto.lastName !== undefined
          ? { lastName: blankToNull(dto.lastName) }
          : {}),
        ...(dto.phone !== undefined ? { phone: blankToNull(dto.phone) } : {}),
      },
      select: publicUserSelect,
    });

    return toPublicUser(user);
  }
}
