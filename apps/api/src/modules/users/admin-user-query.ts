import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';

const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTime =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export function parseCreatedBound(
  value: string,
  edge: 'start' | 'end',
): Date | null {
  const day = dateOnly.exec(value);

  if (day) {
    const year = Number(day[1]);
    const month = Number(day[2]);
    const date = Number(day[3]);
    const parsed = new Date(
      Date.UTC(
        year,
        month - 1,
        date,
        edge === 'start' ? 0 : 23,
        edge === 'start' ? 0 : 59,
        edge === 'start' ? 0 : 59,
        edge === 'start' ? 0 : 999,
      ),
    );

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== date
    ) {
      return null;
    }

    return parsed;
  }

  const stamp = dateTime.exec(value);

  if (!stamp) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = Number(stamp[1]);
  const month = Number(stamp[2]);
  const date = Number(stamp[3]);
  const hour = Number(stamp[4]);
  const minute = Number(stamp[5]);
  const second = Number(stamp[6]);

  if (
    month < 1 ||
    month > 12 ||
    date < 1 ||
    date > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, date));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== date
  ) {
    return null;
  }

  return parsed;
}

export function createdAtFilter(
  createdFrom: string | undefined,
  createdTo: string | undefined,
): Prisma.DateTimeFilter | undefined {
  const gte = createdFrom ? parseCreatedBound(createdFrom, 'start') : undefined;
  const lte = createdTo ? parseCreatedBound(createdTo, 'end') : undefined;

  if (!gte && !lte) {
    return undefined;
  }

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}

export function userSearchWhere(
  raw: string | undefined,
): Prisma.UserWhereInput | undefined {
  const term = raw?.trim();

  if (!term) {
    return undefined;
  }

  const contains = (value: string) => ({
    contains: value,
    mode: 'insensitive' as const,
  });
  const or: Prisma.UserWhereInput[] = [
    { email: contains(term) },
    { firstName: contains(term) },
    { lastName: contains(term) },
  ];
  const parts = term.split(/\s+/).filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(' ');

    or.push({
      AND: [{ firstName: contains(first) }, { lastName: contains(rest) }],
    });
    or.push({
      AND: [{ firstName: contains(rest) }, { lastName: contains(first) }],
    });
  }

  return { OR: or };
}

const dayBucketLimit = 366;
const monthBucketLimit = 36;

export type RegistrationBucket = 'day' | 'month';

export function registrationPoints(
  from: Date,
  to: Date,
  bucket: RegistrationBucket,
  rows: Array<{ bucket: string; count: number }>,
): Array<{ bucketStart: string; count: number }> | null {
  const start = truncateUtc(from, bucket);
  const end = truncateUtc(to, bucket);
  const counts = new Map<string, number>();

  for (const row of rows) {
    const parsed = new Date(row.bucket);

    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    counts.set(truncateUtc(parsed, bucket).toISOString(), Number(row.count));
  }

  const points: Array<{ bucketStart: string; count: number }> = [];
  const limit = bucket === 'day' ? dayBucketLimit : monthBucketLimit;

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = nextUtcBucket(cursor, bucket)
  ) {
    const bucketStart = cursor.toISOString();

    points.push({
      bucketStart,
      count: counts.get(bucketStart) ?? 0,
    });

    if (points.length > limit) {
      return null;
    }
  }

  return points;
}

function truncateUtc(value: Date, bucket: RegistrationBucket) {
  return bucket === 'day'
    ? new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate(),
        ),
      )
    : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function nextUtcBucket(value: Date, bucket: RegistrationBucket) {
  return bucket === 'day'
    ? new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate() + 1,
        ),
      )
    : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

export function wouldRemoveLastAdmin(input: {
  targetRole: Role;
  targetIsActive: boolean;
  nextIsActive: boolean;
  activeAdminCount: number;
}) {
  return (
    !input.nextIsActive &&
    input.targetIsActive &&
    input.targetRole === Role.ADMIN &&
    input.activeAdminCount <= 1
  );
}
