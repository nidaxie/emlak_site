import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  cities() {
    return this.prisma.city.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  async districts(cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    return this.prisma.district.findMany({
      where: { cityId },
      orderBy: { name: 'asc' },
      select: { id: true, cityId: true, name: true },
    });
  }

  async neighborhoods(districtId: string) {
    const district = await this.prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true },
    });

    if (!district) {
      throw new NotFoundException('District not found');
    }

    return this.prisma.neighborhood.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
      select: { id: true, districtId: true, name: true },
    });
  }
}
