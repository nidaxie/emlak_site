import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PropertyStatus } from '../../generated/prisma/enums';

const transitions: Record<PropertyStatus, readonly PropertyStatus[]> = {
  ACTIVE: [PropertyStatus.INACTIVE, PropertyStatus.SOLD, PropertyStatus.RENTED],
  INACTIVE: [PropertyStatus.ACTIVE],
  SOLD: [PropertyStatus.ACTIVE],
  RENTED: [PropertyStatus.ACTIVE],
};

export function canTransition(from: PropertyStatus, to: PropertyStatus) {
  return transitions[from].includes(to);
}

export function normalizeDecimal(value: unknown, scale: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const text = value.toString();
    const fraction = text.split('.')[1];

    if (fraction && fraction.length > scale) {
      return value;
    }

    return value.toFixed(scale);
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const match = new RegExp(`^(-?\\d+)(?:\\.(\\d{1,${scale}}))?$`).exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const sign = trimmed.startsWith('-') ? '-' : '';
  const digits = match[1].replace('-', '');
  const fraction = match[2] ?? '';

  return `${sign}${digits}.${fraction.padEnd(scale, '0')}`;
}

export function formatMoney(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toFixed(2);
}

export function formatArea(value: Prisma.Decimal | string | number | null) {
  if (value === null) {
    return null;
  }

  return new Prisma.Decimal(value).toFixed(2);
}

export function formatCoordinate(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toFixed(6);
}

export function parseMoney(value: string) {
  return parsePositive(
    value,
    '999999999999.99',
    'Price must be greater than zero',
  );
}

export function parseArea(value: string) {
  return parsePositive(value, '99999999.99', 'Area must be greater than zero');
}

export function parseLatitude(value: string) {
  return parseRange(value, -90, 90, 'Latitude is out of range');
}

export function parseLongitude(value: string) {
  return parseRange(value, -180, 180, 'Longitude is out of range');
}

export function assertAreaPair(
  gross: Prisma.Decimal,
  net: Prisma.Decimal | null,
) {
  if (net && net.gt(gross)) {
    throw new BadRequestException('Net area cannot exceed gross area');
  }
}

export function assertFloors(floor: number | null, totalFloors: number | null) {
  if (floor !== null && totalFloors !== null && floor > totalFloors) {
    throw new BadRequestException('Floor cannot exceed total floors');
  }
}

export function assertRangeOrder(
  min: Prisma.Decimal | undefined,
  max: Prisma.Decimal | undefined,
  message: string,
) {
  if (min && max && min.gt(max)) {
    throw new BadRequestException(message);
  }
}

function parsePositive(value: string, maximum: string, message: string) {
  const decimal = decimalOrThrow(value, message);

  if (decimal.lte(0) || decimal.gt(maximum)) {
    throw new BadRequestException(message);
  }

  return decimal;
}

function parseRange(
  value: string,
  minimum: number,
  maximum: number,
  message: string,
) {
  const decimal = decimalOrThrow(value, message);

  if (decimal.lt(minimum) || decimal.gt(maximum)) {
    throw new BadRequestException(message);
  }

  return decimal;
}

function decimalOrThrow(value: string, message: string) {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(message);
  }
}
