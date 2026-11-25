import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminPalette } from '@/components/admin/palette';

export function percentLabel(part: number, total: number) {
  if (total <= 0) {
    return '—';
  }

  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format((part / total) * 100)}%`;
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
  testId,
  pressed,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
  icon: ReactNode;
  testId: string;
  pressed?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
        style={{ background: tone }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#1F2933]">{label}</span>
        <span className="mt-1 block font-display text-3xl font-extrabold text-[#1F2933]" data-testid={testId}>
          {value}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[#4B5563]">{hint}</span>
      </span>
    </>
  );

  if (!onClick) {
    return <article className="surface flex min-w-0 gap-4 p-4">{body}</article>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="surface flex min-w-0 gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {body}
    </button>
  );
}

export function InitialsAvatar({
  initials,
  tone,
  size = 'md',
}: {
  initials: string;
  tone: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl font-bold text-white ${size === 'lg' ? 'h-16 w-16 text-xl' : 'h-11 w-11 text-sm'}`}
      style={{ background: tone }}
      aria-hidden
    >
      {initials || '·'}
    </span>
  );
}

export function personInitials(person: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const first = person.firstName?.trim() ?? '';
  const last = person.lastName?.trim() ?? '';

  if (first && last) {
    return `${first[0]}${last[0]}`.toLocaleUpperCase('tr-TR');
  }

  if (first) {
    return first.slice(0, 2).toLocaleUpperCase('tr-TR');
  }

  if (last) {
    return last.slice(0, 2).toLocaleUpperCase('tr-TR');
  }

  return person.email.trim().slice(0, 1).toLocaleUpperCase('tr-TR');
}

export function personName(person: {
  firstName: string | null;
  lastName: string | null;
}) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Ad belirtilmemiş';
}

export function ChartFrame({
  title,
  description,
  testId,
  children,
  summary,
}: {
  title: string;
  description: string;
  testId: string;
  children: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <section className="surface min-w-0 p-4 sm:p-5" aria-labelledby={testId} data-testid={testId}>
      <h3 id={testId} className="font-display text-lg font-bold text-[#1F2933]">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-5 text-[#4B5563]">{description}</p>
      <div className="mt-4">{children}</div>
      {summary}
    </section>
  );
}

export function ChartMessage({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-xl bg-[#f4f3ed] px-4 py-8 text-center">
      <div>
        <p className="font-semibold text-[#1F2933]">{title}</p>
        <p className="mt-1 text-sm text-[#4B5563]">{text}</p>
        {action}
      </div>
    </div>
  );
}

type Slice = { key: string; label: string; value: number; color: string };

export function DonutChart({
  slices,
  center,
  unit = 'Kullanıcı',
}: {
  slices: Slice[];
  center: string;
  unit?: string;
}) {
  const drawn = slices.filter((slice) => slice.value > 0);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto h-44 w-44">
        {drawn.length === 0 ? (
          <div className="grid h-full place-items-center rounded-full border border-dashed border-[#9CA3AF] text-sm text-[#4B5563]">
            Veri yok
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="label"
                innerRadius={52}
                outerRadius={74}
                paddingAngle={2}
                stroke="#fff"
              >
                {drawn.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [typeof value === 'number' ? value : 0, unit]} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {drawn.length > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="text-center">
              <span className="block font-display text-2xl font-extrabold text-[#1F2933]">{center}</span>
              <span className="block text-[11px] text-[#4B5563]">toplam</span>
            </span>
          </div>
        )}
      </div>
      <ul className="grid gap-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate text-[#1F2933]">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-[#1F2933]">
              {slice.value} · {percentLabel(slice.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusDonut({ slices }: { slices: Slice[] }) {
  const drawn = slices.filter((slice) => slice.value > 0);

  if (drawn.length === 0) {
    return <ChartMessage title="İlan yok" text="Bu grupta silinmemiş ilan bulunmuyor." />;
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={drawn} dataKey="value" nameKey="label" innerRadius={46} outerRadius={72} stroke="#fff">
            {drawn.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [typeof value === 'number' ? value : 0, 'İlan']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type ActivityRow = { label: string; active: number; inactive: number };

export function ActivityBarChart({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid horizontal={false} stroke="#E5E7EB" />
          <XAxis type="number" allowDecimals={false} tick={{ fill: adminPalette.neutralText, fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={118} tick={{ fill: adminPalette.ink, fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="active" name="Aktif" stackId="account" fill={adminPalette.positive} radius={[0, 0, 0, 0]} />
          <Bar dataKey="inactive" name="Pasif" stackId="account" fill={adminPalette.neutral} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegistrationChart({
  points,
  seriesName = 'Yeni kayıt',
}: {
  points: Array<{ label: string; count: number }>;
  seriesName?: string;
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="label"
            interval={points.length > 12 ? Math.ceil(points.length / 6) : 0}
            tick={{ fill: adminPalette.neutralText, fontSize: 11 }}
          />
          <YAxis allowDecimals={false} width={32} tick={{ fill: adminPalette.neutralText, fontSize: 12 }} />
          <Tooltip formatter={(value) => [typeof value === 'number' ? value : 0, seriesName]} />
          <Bar dataKey="count" name={seriesName} fill={adminPalette.info} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
