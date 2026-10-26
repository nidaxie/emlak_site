import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import {
  AuditAction,
  Currency,
  PropertyStatus,
  Role,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicFileUrl } from '../storage/public-file-url';
import { ListAdminPropertiesQueryDto } from './dto/list-properties-query.dto';
import { ListMyPropertiesQueryDto } from './dto/list-properties-query.dto';
import { ListPublicPropertiesQueryDto } from './dto/list-properties-query.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  assertAreaPair,
  assertFloors,
  assertRangeOrder,
  canTransition,
  formatArea,
  formatCoordinate,
  formatMoney,
  normalizeDecimal,
  parseArea,
  parseLatitude,
  parseLongitude,
  parseMoney,
} from './property-rules';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const locationSelect = {
  cityId: true,
  districtId: true,
  neighborhoodId: true,
  city: { select: { name: true } },
  district: { select: { name: true } },
  neighborhood: { select: { name: true } },
} as const;

const managedSelect = {
  id: true,
  agentProfileId: true,
  title: true,
  description: true,
  listingType: true,
  propertyType: true,
  status: true,
  price: true,
  currency: true,
  grossAreaM2: true,
  netAreaM2: true,
  rooms: true,
  livingRooms: true,
  buildingAge: true,
  floor: true,
  totalFloors: true,
  heatingType: true,
  ...locationSelect,
  address: true,
  latitude: true,
  longitude: true,
  isFurnished: true,
  hasBalcony: true,
  hasElevator: true,
  hasParking: true,
  inSite: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

const publicSelect = {
  id: true,
  title: true,
  description: true,
  listingType: true,
  propertyType: true,
  status: true,
  price: true,
  currency: true,
  grossAreaM2: true,
  netAreaM2: true,
  rooms: true,
  livingRooms: true,
  buildingAge: true,
  floor: true,
  totalFloors: true,
  heatingType: true,
  cityId: true,
  districtId: true,
  neighborhoodId: true,
  city: { select: { name: true } },
  district: { select: { name: true } },
  neighborhood: { select: { name: true } },
  address: true,
  latitude: true,
  longitude: true,
  isFurnished: true,
  hasBalcony: true,
  hasElevator: true,
  hasParking: true,
  inSite: true,
  createdAt: true,
  agentProfile: {
    select: {
      slug: true,
      companyName: true,
      phone: true,
      logoFileId: true,
    },
  },
} as const;

const coverSelect = {
  where: { deletedAt: null, isCover: true },
  take: 1,
  select: { fileId: true },
} as const;

const gallerySelect = {
  where: { deletedAt: null },
  orderBy: { sortOrder: 'asc' as const },
  select: { id: true, sortOrder: true, isCover: true, fileId: true },
} as const;

export const publicPropertyWhere = {
  status: PropertyStatus.ACTIVE,
  deletedAt: null,
  agentProfile: {
    isActive: true,
    user: { isActive: true },
  },
} satisfies Prisma.PropertyWhereInput;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreatePropertyDto) {
    const data = propertyData(dto);
    const created = await this.prisma.$transaction(async (tx) => {
      const agentProfileId = await this.lockProfile(tx, userId, true);
      await assertLocation(tx, dto.cityId, dto.districtId, dto.neighborhoodId);

      return tx.property.create({
        data: {
          ...data,
          agentProfileId,
          status: PropertyStatus.ACTIVE,
          currency: Currency.TRY,
        },
        select: managedSelect,
      });
    });

    this.logger.log(
      `property created propertyId=${created.id} userId=${userId}`,
    );

    return presentManaged(created);
  }

  async listMine(userId: string, query: ListMyPropertiesQueryDto) {
    const profileId = await this.profileId(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      agentProfileId: profileId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: managedSelect,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((item) => presentManaged(item)),
      page,
      limit,
      total,
    };
  }

  async getMine(userId: string, id: string) {
    const profileId = await this.profileId(userId);
    const property = await this.prisma.property.findFirst({
      where: { id, agentProfileId: profileId, deletedAt: null },
      select: managedSelect,
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return presentManaged(property);
  }

  async update(userId: string, id: string, dto: UpdatePropertyDto) {
    const data = buildPatch(dto);
    const locationIds = [dto.cityId, dto.districtId, dto.neighborhoodId];
    const providedLocations = locationIds.filter(
      (value) => value !== undefined,
    );

    if (providedLocations.length > 0 && providedLocations.length < 3) {
      throw new BadRequestException('Location fields must be updated together');
    }

    if (Object.keys(data).length === 0 && providedLocations.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId, false);
      this.assertOwner(await this.lockProperty(tx, id), profileId);

      if (dto.cityId && dto.districtId && dto.neighborhoodId) {
        await assertLocation(
          tx,
          dto.cityId,
          dto.districtId,
          dto.neighborhoodId,
        );
        Object.assign(data, {
          cityId: dto.cityId,
          districtId: dto.districtId,
          neighborhoodId: dto.neighborhoodId,
        });
      }
      const current = await tx.property.findUniqueOrThrow({
        where: { id },
        select: {
          grossAreaM2: true,
          netAreaM2: true,
          floor: true,
          totalFloors: true,
        },
      });
      const grossAreaM2 = data.grossAreaM2 ?? current.grossAreaM2;
      const netAreaM2 =
        data.netAreaM2 === undefined ? current.netAreaM2 : data.netAreaM2;
      const floor = data.floor === undefined ? current.floor : data.floor;
      const totalFloors =
        data.totalFloors === undefined ? current.totalFloors : data.totalFloors;
      assertAreaPair(grossAreaM2, netAreaM2);
      assertFloors(floor, totalFloors);

      return tx.property.update({
        where: { id },
        data,
        select: managedSelect,
      });
    });

    this.logger.log(`property updated propertyId=${id} userId=${userId}`);

    return presentManaged(updated);
  }

  async changeStatus(userId: string, id: string, status: PropertyStatus) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId, false);
      const current = this.assertOwner(
        await this.lockProperty(tx, id),
        profileId,
      );

      if (!canTransition(current.status, status)) {
        throw new ConflictException('Invalid status transition');
      }

      return tx.property.update({
        where: { id },
        data: { status },
        select: managedSelect,
      });
    });

    this.logger.log(
      `property status propertyId=${id} userId=${userId} status=${status}`,
    );

    return presentManaged(updated);
  }

  async removeMine(userId: string, id: string) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId, false);
      this.assertOwner(await this.lockProperty(tx, id), profileId);

      return tx.property.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true, deletedAt: true },
      });
    });

    this.logger.log(`property deleted propertyId=${id} userId=${userId}`);

    return deleted;
  }

  async listPublic(
    query: ListPublicPropertiesQueryDto,
    scope: { userId?: string; agentProfileId?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const minPrice = queryDecimal(query.minPrice);
    const maxPrice = queryDecimal(query.maxPrice);
    const minArea = queryDecimal(query.minArea);
    const maxArea = queryDecimal(query.maxArea);
    assertRangeOrder(minPrice, maxPrice, 'Invalid price range');
    assertRangeOrder(minArea, maxArea, 'Invalid area range');

    const where = {
      ...publicPropertyWhere,
      ...(scope.agentProfileId ? { agentProfileId: scope.agentProfileId } : {}),
      ...(query.listingType ? { listingType: query.listingType } : {}),
      ...(query.propertyType ? { propertyType: query.propertyType } : {}),
      ...(query.city ? { city: { name: query.city } } : {}),
      ...(query.district ? { district: { name: query.district } } : {}),
      ...(query.neighborhood
        ? { neighborhood: { name: query.neighborhood } }
        : {}),
      ...(query.rooms !== undefined ? { rooms: query.rooms } : {}),
      ...(query.livingRooms !== undefined
        ? { livingRooms: query.livingRooms }
        : {}),
      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice ? { gte: minPrice } : {}),
              ...(maxPrice ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(minArea || maxArea
        ? {
            grossAreaM2: {
              ...(minArea ? { gte: minArea } : {}),
              ...(maxArea ? { lte: maxArea } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: orderBy(query.sort ?? 'newest'),
        skip: (page - 1) * limit,
        take: limit,
        select: { ...publicSelect, images: coverSelect },
      }),
      this.prisma.property.count({ where }),
    ]);

    const favoriteIds = await this.favoriteIds(
      scope.userId,
      items.map((item) => item.id),
    );

    return {
      items: items.map((item) =>
        presentPublic(item, false, favoriteIds.has(item.id)),
      ),
      page,
      limit,
      total,
    };
  }

  async listPublicForAgent(
    slug: string,
    query: ListPublicPropertiesQueryDto,
    userId?: string,
  ) {
    const profile = await this.prisma.agentProfile.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    return this.listPublic(query, { userId, agentProfileId: profile.id });
  }

  async getPublic(id: string, userId?: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, ...publicPropertyWhere },
      select: { ...publicSelect, images: gallerySelect },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const favoriteIds = await this.favoriteIds(userId, [property.id]);

    return presentPublic(property, true, favoriteIds.has(property.id));
  }

  async assertPublic(propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ...publicPropertyWhere },
      select: { id: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }
  }

  async listFavorites(userId: string, page: number, limit: number) {
    const where = { userId, property: publicPropertyWhere };
    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { propertyId: true },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    const items = await this.publicCards(
      favorites.map((favorite) => favorite.propertyId),
    );

    return { items, page, limit, total };
  }

  async listForAdmin(query: ListAdminPropertiesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      ...(query.deleted === 'true'
        ? { deletedAt: { not: null } }
        : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.listingType ? { listingType: query.listingType } : {}),
      ...(query.city ? { city: { name: query.city } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...managedSelect,
          agentProfile: {
            select: {
              id: true,
              slug: true,
              companyName: true,
              isActive: true,
              user: { select: { id: true, isActive: true, role: true } },
            },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((item) => presentAdmin(item)),
      page,
      limit,
      total,
    };
  }

  async getForAdmin(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        ...managedSelect,
        agentProfile: {
          select: {
            id: true,
            slug: true,
            companyName: true,
            phone: true,
            email: true,
            city: true,
            district: true,
            isActive: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return presentAdmin(property);
  }

  async deactivate(adminId: string, id: string, reason: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockProperty(tx, id);

      if (!current || current.deletedAt !== null) {
        throw new NotFoundException('Property not found');
      }

      if (!canTransition(current.status, PropertyStatus.INACTIVE)) {
        throw new ConflictException('Invalid status transition');
      }

      const property = await tx.property.update({
        where: { id },
        data: { status: PropertyStatus.INACTIVE },
        select: managedSelect,
      });
      await this.audit.record(tx, {
        actorUserId: adminId,
        action: AuditAction.PROPERTY_DEACTIVATED_BY_ADMIN,
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { reason },
      });

      return property;
    });

    this.logger.log(`property deactivated propertyId=${id} adminId=${adminId}`);

    return presentManaged(updated);
  }

  async removeForAdmin(adminId: string, id: string, reason: string) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockProperty(tx, id);

      if (!current || current.deletedAt !== null) {
        throw new NotFoundException('Property not found');
      }

      const property = await tx.property.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true, deletedAt: true, agentProfileId: true },
      });
      await this.audit.record(tx, {
        actorUserId: adminId,
        action: AuditAction.PROPERTY_DELETED_BY_ADMIN,
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { reason },
      });

      return property;
    });

    this.logger.log(`property deleted propertyId=${id} adminId=${adminId}`);

    return { id: deleted.id, deletedAt: deleted.deletedAt };
  }

  private async profileId(userId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true, isActive: true } } },
    });

    if (!profile || profile.user.role !== Role.AGENT) {
      throw new ForbiddenException('Agent profile not found');
    }

    if (!profile.user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    return profile.id;
  }

  private async lockProfile(tx: Tx, userId: string, requireActive: boolean) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        isActive: boolean;
        userActive: boolean;
        role: string;
      }>
    >`
      SELECT p.id,
             p."isActive" AS "isActive",
             u."isActive" AS "userActive",
             u.role::text AS role
      FROM agent_profiles p
      JOIN users u ON u.id = p."userId"
      WHERE p."userId" = ${userId}::uuid
      FOR UPDATE OF p
    `;
    const row = rows[0];

    if (!row || row.role !== Role.AGENT) {
      throw new ForbiddenException('Agent profile not found');
    }

    if (!row.userActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (requireActive && !row.isActive) {
      throw new ForbiddenException('Agent profile is inactive');
    }

    return row.id;
  }

  private async lockProperty(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: PropertyStatus;
        agentProfileId: string;
        deletedAt: Date | null;
      }>
    >`
      SELECT id, status::text AS status, "agentProfileId", "deletedAt"
      FROM properties
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private assertOwner(
    row: {
      status: PropertyStatus;
      agentProfileId: string;
      deletedAt: Date | null;
    } | null,
    profileId: string,
  ) {
    if (!row || row.deletedAt !== null || row.agentProfileId !== profileId) {
      throw new NotFoundException('Property not found');
    }

    return row;
  }

  private async favoriteIds(userId: string | undefined, propertyIds: string[]) {
    if (!userId || propertyIds.length === 0) {
      return new Set<string>();
    }

    const rows = await this.prisma.favorite.findMany({
      where: { userId, propertyId: { in: propertyIds } },
      select: { propertyId: true },
    });

    return new Set(rows.map((row) => row.propertyId));
  }

  private async publicCards(propertyIds: string[]) {
    if (propertyIds.length === 0) {
      return [];
    }

    const items = await this.prisma.property.findMany({
      where: { id: { in: propertyIds }, ...publicPropertyWhere },
      select: { ...publicSelect, images: coverSelect },
    });
    const byId = new Map(
      items.map((item) => [item.id, presentPublic(item, false, true)]),
    );

    return propertyIds.flatMap((id) => {
      const card = byId.get(id);
      return card ? [card] : [];
    });
  }
}

function propertyData(dto: CreatePropertyDto) {
  const grossAreaM2 = parseArea(dto.grossAreaM2);
  const netAreaM2 = dto.netAreaM2 ? parseArea(dto.netAreaM2) : null;
  assertAreaPair(grossAreaM2, netAreaM2);
  assertFloors(dto.floor ?? null, dto.totalFloors ?? null);

  return {
    title: dto.title,
    description: dto.description,
    listingType: dto.listingType,
    propertyType: dto.propertyType,
    price: parseMoney(dto.price),
    grossAreaM2,
    netAreaM2,
    rooms: dto.rooms,
    livingRooms: dto.livingRooms,
    buildingAge: dto.buildingAge ?? null,
    floor: dto.floor ?? null,
    totalFloors: dto.totalFloors ?? null,
    heatingType: dto.heatingType ?? null,
    cityId: dto.cityId,
    districtId: dto.districtId,
    neighborhoodId: dto.neighborhoodId,
    address: dto.address,
    latitude: parseLatitude(dto.latitude),
    longitude: parseLongitude(dto.longitude),
    isFurnished: dto.isFurnished ?? false,
    hasBalcony: dto.hasBalcony ?? false,
    hasElevator: dto.hasElevator ?? false,
    hasParking: dto.hasParking ?? false,
    inSite: dto.inSite ?? false,
  };
}

function buildPatch(dto: UpdatePropertyDto) {
  return {
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(dto.listingType !== undefined ? { listingType: dto.listingType } : {}),
    ...(dto.propertyType !== undefined
      ? { propertyType: dto.propertyType }
      : {}),
    ...(dto.price !== undefined ? { price: parseMoney(dto.price) } : {}),
    ...(dto.grossAreaM2 !== undefined
      ? { grossAreaM2: parseArea(dto.grossAreaM2) }
      : {}),
    ...(dto.netAreaM2 !== undefined
      ? { netAreaM2: parseArea(dto.netAreaM2) }
      : {}),
    ...(dto.rooms !== undefined ? { rooms: dto.rooms } : {}),
    ...(dto.livingRooms !== undefined ? { livingRooms: dto.livingRooms } : {}),
    ...(dto.buildingAge !== undefined ? { buildingAge: dto.buildingAge } : {}),
    ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
    ...(dto.totalFloors !== undefined ? { totalFloors: dto.totalFloors } : {}),
    ...(dto.heatingType !== undefined ? { heatingType: dto.heatingType } : {}),
    ...(dto.address !== undefined ? { address: dto.address } : {}),
    ...(dto.latitude !== undefined
      ? { latitude: parseLatitude(dto.latitude) }
      : {}),
    ...(dto.longitude !== undefined
      ? { longitude: parseLongitude(dto.longitude) }
      : {}),
    ...(dto.isFurnished !== undefined ? { isFurnished: dto.isFurnished } : {}),
    ...(dto.hasBalcony !== undefined ? { hasBalcony: dto.hasBalcony } : {}),
    ...(dto.hasElevator !== undefined ? { hasElevator: dto.hasElevator } : {}),
    ...(dto.hasParking !== undefined ? { hasParking: dto.hasParking } : {}),
    ...(dto.inSite !== undefined ? { inSite: dto.inSite } : {}),
  };
}

function orderBy(sort: 'newest' | 'price_asc' | 'price_desc') {
  if (sort === 'price_asc') {
    return [{ price: 'asc' as const }, { id: 'asc' as const }];
  }

  if (sort === 'price_desc') {
    return [{ price: 'desc' as const }, { id: 'desc' as const }];
  }

  return [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
}

function queryDecimal(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeDecimal(value, 2);

  if (typeof normalized !== 'string') {
    throw new BadRequestException('Invalid price range');
  }

  return new Prisma.Decimal(normalized);
}

type PlaceName = { name: string };

type Located = {
  cityId: string;
  districtId: string;
  neighborhoodId: string;
  city: PlaceName;
  district: PlaceName;
  neighborhood: PlaceName;
};

function presentManaged(
  row: Located & {
    id: string;
    agentProfileId: string;
    title: string;
    description: string;
    listingType: string;
    propertyType: string;
    status: string;
    price: Prisma.Decimal;
    currency: string;
    grossAreaM2: Prisma.Decimal;
    netAreaM2: Prisma.Decimal | null;
    rooms: number;
    livingRooms: number;
    buildingAge: number | null;
    floor: number | null;
    totalFloors: number | null;
    heatingType: string | null;
    address: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    isFurnished: boolean;
    hasBalcony: boolean;
    hasElevator: boolean;
    hasParking: boolean;
    inSite: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  },
) {
  return {
    ...presentFields(row),
    agentProfileId: row.agentProfileId,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function presentPublic(
  row: Located & {
    id: string;
    title: string;
    description: string;
    listingType: string;
    propertyType: string;
    status: string;
    price: Prisma.Decimal;
    currency: string;
    grossAreaM2: Prisma.Decimal;
    netAreaM2: Prisma.Decimal | null;
    rooms: number;
    livingRooms: number;
    buildingAge: number | null;
    floor: number | null;
    totalFloors: number | null;
    heatingType: string | null;
    address: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    isFurnished: boolean;
    hasBalcony: boolean;
    hasElevator: boolean;
    hasParking: boolean;
    inSite: boolean;
    createdAt: Date;
    images?: Array<{
      id?: string;
      sortOrder?: number;
      isCover?: boolean;
      fileId: string;
    }>;
    agentProfile: {
      slug: string;
      companyName: string;
      phone: string;
      logoFileId: string | null;
    };
  },
  detail: boolean,
  isFavorite: boolean,
) {
  const images = row.images ?? [];
  const cover = images.find((image) => image.isCover) ?? images[0];

  return {
    ...presentFields(row),
    coverImageUrl: publicFileUrl(cover?.fileId),
    isFavorite,
    ...(detail
      ? {
          images: images.map((image) => ({
            id: image.id,
            url: publicFileUrl(image.fileId),
            sortOrder: image.sortOrder,
            isCover: image.isCover,
          })),
        }
      : {}),
    agent: detail
      ? {
          slug: row.agentProfile.slug,
          companyName: row.agentProfile.companyName,
          phone: row.agentProfile.phone,
          logoUrl: publicFileUrl(row.agentProfile.logoFileId),
        }
      : {
          slug: row.agentProfile.slug,
          companyName: row.agentProfile.companyName,
        },
  };
}

function presentAdmin(
  row: Located & {
    id: string;
    agentProfileId: string;
    title: string;
    description: string;
    listingType: string;
    propertyType: string;
    status: string;
    price: Prisma.Decimal;
    currency: string;
    grossAreaM2: Prisma.Decimal;
    netAreaM2: Prisma.Decimal | null;
    rooms: number;
    livingRooms: number;
    buildingAge: number | null;
    floor: number | null;
    totalFloors: number | null;
    heatingType: string | null;
    address: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    isFurnished: boolean;
    hasBalcony: boolean;
    hasElevator: boolean;
    hasParking: boolean;
    inSite: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    agentProfile: {
      id: string;
      slug: string;
      companyName: string;
      isActive: boolean;
      phone?: string;
      email?: string;
      city?: string;
      district?: string;
      user?: { id: string; email?: string; role: string; isActive: boolean };
    };
  },
) {
  return {
    ...presentManaged(row),
    agent: row.agentProfile,
  };
}

function presentFields(
  row: Located & {
    id: string;
    title: string;
    description: string;
    listingType: string;
    propertyType: string;
    status: string;
    price: Prisma.Decimal;
    currency: string;
    grossAreaM2: Prisma.Decimal;
    netAreaM2: Prisma.Decimal | null;
    rooms: number;
    livingRooms: number;
    buildingAge: number | null;
    floor: number | null;
    totalFloors: number | null;
    heatingType: string | null;
    address: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    isFurnished: boolean;
    hasBalcony: boolean;
    hasElevator: boolean;
    hasParking: boolean;
    inSite: boolean;
    createdAt: Date;
  },
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    listingType: row.listingType,
    propertyType: row.propertyType,
    status: row.status,
    price: formatMoney(row.price),
    currency: row.currency,
    grossAreaM2: formatArea(row.grossAreaM2),
    netAreaM2: formatArea(row.netAreaM2),
    rooms: row.rooms,
    livingRooms: row.livingRooms,
    buildingAge: row.buildingAge,
    floor: row.floor,
    totalFloors: row.totalFloors,
    heatingType: row.heatingType,
    cityId: row.cityId,
    districtId: row.districtId,
    neighborhoodId: row.neighborhoodId,
    city: row.city.name,
    district: row.district.name,
    neighborhood: row.neighborhood.name,
    address: row.address,
    latitude: formatCoordinate(row.latitude),
    longitude: formatCoordinate(row.longitude),
    isFurnished: row.isFurnished,
    hasBalcony: row.hasBalcony,
    hasElevator: row.hasElevator,
    hasParking: row.hasParking,
    inSite: row.inSite,
    createdAt: row.createdAt,
  };
}

async function assertLocation(
  tx: Tx,
  cityId: string,
  districtId: string,
  neighborhoodId: string,
) {
  const neighborhood = await tx.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { districtId: true, district: { select: { cityId: true } } },
  });

  if (
    !neighborhood ||
    neighborhood.districtId !== districtId ||
    neighborhood.district.cityId !== cityId
  ) {
    throw new BadRequestException('Invalid location');
  }
}
