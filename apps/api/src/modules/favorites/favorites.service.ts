import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';

const favoriteSelect = {
  propertyId: true,
  createdAt: true,
} as const;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
  ) {}

  async add(userId: string, propertyId: string) {
    await this.properties.assertPublic(propertyId);
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
      select: favoriteSelect,
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.favorite.create({
        data: { userId, propertyId },
        select: favoriteSelect,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const favorite = await this.prisma.favorite.findUnique({
        where: { userId_propertyId: { userId, propertyId } },
        select: favoriteSelect,
      });

      if (!favorite) {
        throw error;
      }

      return favorite;
    }
  }

  async remove(userId: string, propertyId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, propertyId },
    });

    return { propertyId };
  }

  list(userId: string, page = 1, limit = 20) {
    return this.properties.listFavorites(userId, page, limit);
  }
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
