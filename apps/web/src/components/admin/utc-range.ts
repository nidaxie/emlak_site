export type ChartBucket = 'day' | 'month';

export type ChartRange = {
  from: string;
  to: string;
  bucket: ChartBucket;
  label: string;
};

const dayLimit = 366;
const monthLimit = 36;

export function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number) {
  const [year, month, date] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}

export function presetRange(
  preset: '7' | '30' | '90' | '12',
  today = utcToday(),
): ChartRange {
  if (preset === '12') {
    const [year, month] = today.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 1 - 11, 1))
      .toISOString()
      .slice(0, 10);

    return {
      from,
      to: today,
      bucket: 'month',
      label: 'Son 12 ay',
    };
  }

  const span = preset === '7' ? 6 : preset === '30' ? 29 : 89;

  return {
    from: addUtcDays(today, -span),
    to: today,
    bucket: 'day',
    label: preset === '7' ? 'Son 7 gün' : preset === '30' ? 'Son 30 gün' : 'Son 90 gün',
  };
}

export function customRange(
  from: string,
  to: string,
): { ok: true; range: ChartRange } | { ok: false; message: string } {
  if (!from || !to) {
    return { ok: false, message: 'Özel aralık için başlangıç ve bitiş tarihi birlikte seçilmelidir.' };
  }

  if (from > to) {
    return { ok: false, message: 'Başlangıç tarihi bitişten sonra olamaz.' };
  }

  const dayCount = utcDayCount(from, to);

  if (dayCount <= dayLimit) {
    return {
      ok: true,
      range: {
        from,
        to,
        bucket: 'day',
        label: `${formatUtcDate(from)} – ${formatUtcDate(to)}`,
      },
    };
  }

  const monthCount = utcMonthCount(from, to);

  if (monthCount <= monthLimit) {
    return {
      ok: true,
      range: {
        from,
        to,
        bucket: 'month',
        label: `${formatUtcDate(from)} – ${formatUtcDate(to)}`,
      },
    };
  }

  return {
    ok: false,
    message: 'Özel aralık en fazla 366 UTC günü veya 36 UTC ayı olabilir.',
  };
}

export function utcDayCount(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function utcMonthCount(from: string, to: string) {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

export function formatUtcDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatUtcBucket(iso: string, bucket: ChartBucket) {
  return new Intl.DateTimeFormat(
    'tr-TR',
    bucket === 'month'
      ? { timeZone: 'UTC', month: 'short', year: 'numeric' }
      : { timeZone: 'UTC', day: 'numeric', month: 'short' },
  ).format(new Date(iso));
}

export function listDateOrder(from: string, to: string) {
  if (from && to && from > to) {
    return 'Kayıt başlangıcı, kayıt bitişinden sonra olamaz.';
  }

  return null;
}
