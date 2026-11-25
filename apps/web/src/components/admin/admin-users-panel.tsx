import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { UserCheck, UserRound, UserX, Users } from 'lucide-react';
import {
  ActivityBarChart,
  ChartFrame,
  ChartMessage,
  DonutChart,
  InitialsAvatar,
  MetricCard,
  personInitials,
  personName,
  RegistrationChart,
} from '@/components/admin/admin-charts';
import { adminPalette, roleColor } from '@/components/admin/palette';
import {
  customRange,
  formatUtcBucket,
  formatUtcDate,
  listDateOrder,
  presetRange,
  type ChartRange,
} from '@/components/admin/utc-range';
import { EmptyState, ErrorState, inputClass, Pagination } from '@/components/market-ui';
import { useAdminUsers, useAdminUserSummary } from '@/hooks/use-api';
import { ApiRequestError } from '@/lib/api-client';
import type { AdminUserListItem, AdminUserSummary, Role } from '@/types/api';

const roleLabels: Record<Role, string> = {
  USER: 'Bireysel Kullanıcı',
  AGENT: 'Emlak Danışmanı',
  ADMIN: 'Yönetici',
};

function showError(error: unknown) {
  if (error instanceof TypeError) {
    return 'API sunucusuna bağlanılamadı. Sunucu adresini, durumunu ve CORS ayarlarını kontrol edin.';
  }

  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return 'Bir sorun oluştu. Lütfen tekrar deneyin.';
}

function populationIssues(summary: AdminUserSummary) {
  const issues: string[] = [];
  const roleTotal =
    summary.roles.USER.total +
    summary.roles.AGENT.total +
    summary.roles.ADMIN.total;

  if (summary.total !== summary.active + summary.inactive) {
    issues.push('Toplam, aktif ve pasif sayılarıyla örtüşmüyor.');
  }

  if (roleTotal !== summary.total) {
    issues.push('Rol toplamları genel toplamla örtüşmüyor.');
  }

  for (const role of ['USER', 'AGENT', 'ADMIN'] as const) {
    const row = summary.roles[role];

    if (row.total !== row.active + row.inactive) {
      issues.push(`${roleLabels[role]} toplamı aktif ve pasif sayılarıyla örtüşmüyor.`);
    }
  }

  return issues;
}

export function AdminUsersPanel() {
  const [emailInput, setEmailInput] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [active, setActive] = useState<'' | 'true' | 'false'>('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<'7' | '30' | '90' | '12' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const dateWarning = listDateOrder(createdFrom, createdTo);
  const range = useMemo(() => {
    if (preset === 'custom') {
      const custom = customRange(customFrom, customTo);
      return custom.ok ? custom.range : null;
    }

    return presetRange(preset);
  }, [preset, customFrom, customTo]);
  const population = useAdminUserSummary({});
  const series = useAdminUserSummary(
    range
      ? { createdFrom: range.from, createdTo: range.to, bucket: range.bucket }
      : {},
    Boolean(range),
  );
  const users = useAdminUsers(
    {
      page,
      limit: 20,
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
      ...(active ? { isActive: active } : {}),
      ...(!dateWarning && createdFrom ? { createdFrom } : {}),
      ...(!dateWarning && createdTo ? { createdTo } : {}),
    },
    !dateWarning,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = emailInput.trim();
      setEmail((current) => {
        if (current !== next) {
          setPage(1);
        }

        return next;
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [emailInput]);

  const clearFilters = () => {
    setEmailInput('');
    setEmail('');
    setRole('');
    setActive('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(1);
  };

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Hesaplar</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-[#1F2933]">Kullanıcılar</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4B5563]">
          Platformdaki kullanıcı hesaplarını inceleyin ve yönetin.
        </p>
      </header>
      <PopulationSection
        query={population}
        series={series}
        range={range}
        accountFilter={active}
        onAccountFilter={(next) => {
          setActive(next);
          setPage(1);
        }}
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <RoleSection query={population} onRole={(next) => { setRole(next); setPage(1); }} />
        <RegistrationSection query={series} range={range} />
        <div className="lg:col-span-2">
          <ActivitySection query={population} />
        </div>
      </section>
      <ChartRangeControls
        preset={preset}
        customFrom={customFrom}
        customTo={customTo}
        onPreset={(next) => setPreset(next)}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        range={range}
      />
      <section id="kullanici-listesi" className="grid min-w-0 gap-4" aria-labelledby="admin-user-list-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="admin-user-list-title" className="font-display text-2xl font-bold">Kullanıcı Listesi</h3>
            <p className="mt-1 text-sm text-[#4B5563]">
              {users.data ? `${users.data.total} kullanıcı bulundu.` : 'Filtreye göre kayıt sayısı liste sonucundan gelir.'}
            </p>
          </div>
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary">
            Filtreleri temizle
          </button>
        </div>
        <div className="surface grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold xl:col-span-3">
            Arama
            <input
              className={inputClass}
              placeholder="Ad, soyad veya e-posta ile ara..."
              data-testid="input-admin-users-email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Rol
            <select
              className={inputClass}
              aria-label="Rol filtresi"
              data-testid="select-admin-users-role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as '' | Role);
                setPage(1);
              }}
            >
              <option value="">Tüm roller</option>
              <option value="USER">Bireysel kullanıcı</option>
              <option value="AGENT">Emlak danışmanı</option>
              <option value="ADMIN">Yönetici</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Hesap durumu
            <select
              className={inputClass}
              aria-label="Durum filtresi"
              data-testid="select-admin-users-active"
              value={active}
              onChange={(event) => {
                setActive(event.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
            >
              <option value="">Tüm hesap durumları</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Kayıt başlangıcı
              <input
                className={inputClass}
                type="date"
                value={createdFrom}
                onChange={(event) => {
                  setCreatedFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Kayıt bitişi
              <input
                className={inputClass}
                type="date"
                value={createdTo}
                onChange={(event) => {
                  setCreatedTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        </div>
        <p className="text-xs text-[#4B5563]">Kayıt tarihi filtresi UTC gün sınırlarını kullanır. Grafik aralığı bu listeyi değiştirmez.</p>
        {dateWarning && <p role="alert" className="text-sm text-destructive">{dateWarning}</p>}
        {dateWarning ? null : users.isLoading ? (
          <div className="surface p-6"><div className="skeleton h-48" /></div>
        ) : users.error ? (
          <ErrorState retry={() => { void users.refetch(); }} message={showError(users.error)} />
        ) : users.data?.items.length ? (
          <>
            <UserTable items={users.data.items} />
            <Pagination page={users.data.page} limit={users.data.limit} total={users.data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState title="Kullanıcı bulunamadı" text="Bu filtrelerle eşleşen hesap yok." />
        )}
      </section>
    </div>
  );
}

function PopulationSection({
  query,
  series,
  range,
  accountFilter,
  onAccountFilter,
}: {
  query: ReturnType<typeof useAdminUserSummary>;
  series: ReturnType<typeof useAdminUserSummary>;
  range: ChartRange | null;
  accountFilter: '' | 'true' | 'false';
  onAccountFilter: (next: '' | 'true' | 'false') => void;
}) {
  if (query.isLoading && !query.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="surface p-4"><div className="skeleton h-20" /></div>)}
      </div>
    );
  }

  if (query.error && !query.data) {
    return <ErrorState retry={() => { void query.refetch(); }} message="Kullanıcı özeti yüklenemedi. Liste aşağıda kullanılabilir." />;
  }

  if (!query.data) {
    return null;
  }

  const issues = populationIssues(query.data);

  return (
    <div className="grid gap-3">
      {query.error && query.data && (
        <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="text-sm text-[#4B5563]">Özet güncellenemedi. Son başarılı değerler gösteriliyor.</p>
          <button type="button" onClick={() => { void query.refetch(); }} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white">Yeniden dene</button>
        </div>
      )}
      {issues.length > 0 && (
        <p role="alert" className="text-sm text-destructive">{issues.join(' ')} API değerleri değiştirilmeden gösteriliyor.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Kullanıcı" value={String(query.data.total)} hint="Tüm hesaplar" tone={adminPalette.brand} icon={<Users size={20} />} testId="stat-users-total" pressed={accountFilter === ''} onClick={() => onAccountFilter('')} />
        <MetricCard label="Aktif Hesaplar" value={String(query.data.active)} hint="Giriş yapabilen hesaplar" tone={adminPalette.positive} icon={<UserCheck size={20} />} testId="stat-users-active" pressed={accountFilter === 'true'} onClick={() => onAccountFilter('true')} />
        <MetricCard label="Pasif Hesaplar" value={String(query.data.inactive)} hint="Erişimi kapalı hesaplar" tone={adminPalette.neutralText} icon={<UserX size={20} />} testId="stat-users-inactive" pressed={accountFilter === 'false'} onClick={() => onAccountFilter('false')} />
        <RegistrationCard series={series} range={range} />
      </div>
    </div>
  );
}

function RegistrationCard({
  series,
  range,
}: {
  series: ReturnType<typeof useAdminUserSummary>;
  range: ChartRange | null;
}) {
  const total = series.data?.registrations?.total;
  const value = !range || (series.isLoading && total === undefined)
    ? '—'
    : series.error && total === undefined
      ? '—'
      : total === undefined
        ? '—'
        : String(total);
  const hint = !range
    ? 'Geçerli bir grafik aralığı seçin'
    : series.error && total === undefined
      ? 'Kayıt serisi yüklenemedi'
      : range.label;

  return (
    <MetricCard
      label="Yeni Kayıtlar"
      value={value}
      hint={hint}
      tone={adminPalette.info}
      icon={<UserRound size={20} />}
      testId="stat-users-registrations"
    />
  );
}

function RoleSection({
  query,
  onRole,
}: {
  query: ReturnType<typeof useAdminUserSummary>;
  onRole: (role: Role) => void;
}) {
  return (
    <ChartFrame title="Rol dağılımı" description="Tüm kullanıcı nüfusunun rol toplamları." testId="chart-role-distribution">
      {query.isLoading && !query.data ? <div className="skeleton h-48" /> : query.error && !query.data ? (
        <ChartMessage title="Grafik verisi bulunamadı" text="Rol dağılımı yüklenemedi." action={<button type="button" onClick={() => { void query.refetch(); }} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} />
      ) : query.data && query.data.total === 0 ? (
        <ChartMessage title="Henüz kullanıcı yok" text="Hesap oluşturulduğunda dağılım burada görünür." />
      ) : query.data ? (
        <>
          <DonutChart
            center={String(query.data.total)}
            slices={[
              { key: 'USER', label: roleLabels.USER, value: query.data.roles.USER.total, color: roleColor.USER },
              { key: 'AGENT', label: roleLabels.AGENT, value: query.data.roles.AGENT.total, color: roleColor.AGENT },
              { key: 'ADMIN', label: roleLabels.ADMIN, value: query.data.roles.ADMIN.total, color: roleColor.ADMIN },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(['USER', 'AGENT', 'ADMIN'] as const).map((item) => (
              <button key={item} type="button" onClick={() => onRole(item)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                {roleLabels[item]} listesini aç
              </button>
            ))}
          </div>
        </>
      ) : null}
    </ChartFrame>
  );
}

function RegistrationSection({
  query,
  range,
}: {
  query: ReturnType<typeof useAdminUserSummary>;
  range: ChartRange | null;
}) {
  const series = query.data?.registrations;
  const summed = series?.points.reduce((sum, point) => sum + point.count, 0);
  const mismatch = series && summed !== undefined && summed !== series.total;

  return (
    <ChartFrame
      title="Yeni kayıtlar"
      description={range ? `${range.label} · UTC ${range.bucket === 'day' ? 'gün' : 'ay'} kovaları` : 'Geçerli bir aralık seçin.'}
      testId="chart-registrations"
    >
      {!range ? (
        <ChartMessage title="Aralık uygulanmadı" text="Seçilen tarih aralığı API limitine uymuyor." />
      ) : query.isLoading && !query.data ? (
        <div className="skeleton h-56" />
      ) : query.error && !query.data ? (
        <ChartMessage title="Grafik verisi bulunamadı" text="Kayıt eğilimi yüklenemedi. Sahte sıfır gösterilmiyor." action={<button type="button" onClick={() => { void query.refetch(); }} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} />
      ) : series ? (
        <>
          {query.error && (
            <p role="alert" className="mb-3 text-sm text-[#4B5563]">Kayıt eğilimi güncellenemedi. Son başarılı seri gösteriliyor.</p>
          )}
          <p className="mb-3 text-sm font-semibold text-[#1F2933]" data-testid="text-registration-total">
            {range.label}: {series.total} yeni kayıt
          </p>
          {mismatch && <p role="alert" className="mb-3 text-sm text-destructive">Seri toplamı kova sayılarıyla örtüşmüyor. Değerler değiştirilmedi.</p>}
          {series.total === 0 && <p className="mb-3 text-sm text-[#4B5563]">Bu aralıkta yeni kayıt yok. Sıfırlar API kova değerleridir.</p>}
          <RegistrationChart
            points={series.points.map((point) => ({
              label: formatUtcBucket(point.bucketStart, series.bucket),
              count: point.count,
            }))}
          />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">Kova sayılarını gör</summary>
            <ul className="mt-2 grid max-h-40 gap-1 overflow-auto text-[#4B5563]">
              {series.points.map((point) => (
                <li key={point.bucketStart}>{formatUtcBucket(point.bucketStart, series.bucket)}: {point.count}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <ChartMessage title="Zaman serisi yok" text="Özet yanıtı kayıt serisi döndürmedi." />
      )}
    </ChartFrame>
  );
}

function ActivitySection({ query }: { query: ReturnType<typeof useAdminUserSummary> }) {
  return (
    <ChartFrame title="Rol bazında aktif ve pasif hesaplar" description="Her rolün hesap durumu. Rol toplamının ikinci bir gösterimi değildir." testId="chart-role-activity">
      {query.isLoading && !query.data ? <div className="skeleton h-48" /> : query.error && !query.data ? (
        <ChartMessage title="Grafik verisi bulunamadı" text="Aktiflik dağılımı yüklenemedi." action={<button type="button" onClick={() => { void query.refetch(); }} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} />
      ) : query.data ? (
        <>
          <ActivityBarChart
            rows={[
              { label: 'Bireysel', active: query.data.roles.USER.active, inactive: query.data.roles.USER.inactive },
              { label: 'Danışman', active: query.data.roles.AGENT.active, inactive: query.data.roles.AGENT.inactive },
              { label: 'Yönetici', active: query.data.roles.ADMIN.active, inactive: query.data.roles.ADMIN.inactive },
            ]}
          />
          <ul className="mt-3 grid gap-1 text-sm text-[#4B5563] sm:grid-cols-3">
            {(['USER', 'AGENT', 'ADMIN'] as const).map((item) => (
              <li key={item}>{roleLabels[item]}: {query.data?.roles[item].active} aktif, {query.data?.roles[item].inactive} pasif</li>
            ))}
          </ul>
        </>
      ) : null}
    </ChartFrame>
  );
}

function ChartRangeControls({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo,
  range,
}: {
  preset: '7' | '30' | '90' | '12' | 'custom';
  customFrom: string;
  customTo: string;
  onPreset: (preset: '7' | '30' | '90' | '12' | 'custom') => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  range: ChartRange | null;
}) {
  const custom = preset === 'custom' ? customRange(customFrom, customTo) : null;

  return (
    <div className="surface grid gap-3 p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Grafik tarih aralığı">
        {([
          ['7', 'Son 7 gün'],
          ['30', 'Son 30 gün'],
          ['90', 'Son 90 gün'],
          ['12', 'Son 12 ay'],
          ['custom', 'Özel aralık'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            onClick={() => onPreset(value)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${preset === value ? 'bg-primary text-white' : 'bg-[#f4f3ed] text-[#1F2933]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            UTC başlangıç
            <input className={inputClass} type="date" value={customFrom} onChange={(event) => onCustomFrom(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            UTC bitiş
            <input className={inputClass} type="date" value={customTo} onChange={(event) => onCustomTo(event.target.value)} />
          </label>
        </div>
      )}
      <p className="text-xs text-[#4B5563]">
        {range
          ? `${range.label}. Aralık ${formatUtcDate(`${range.from}T00:00:00.000Z`)} ile ${formatUtcDate(`${range.to}T00:00:00.000Z`)} UTC günlerini kapsar. Kovalar UTC başlangıcıdır.`
          : custom && !custom.ok
            ? custom.message
            : 'Grafik aralığı seçin.'}
      </p>
    </div>
  );
}

function UserTable({ items }: { items: AdminUserListItem[] }) {
  return (
    <div className="surface overflow-x-auto">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>Kullanıcı</th>
            <th>Telefon</th>
            <th>Rol</th>
            <th>Hesap durumu</th>
            <th>Bireysel ilanlar</th>
            <th>Emlakçı ilanları</th>
            <th>Kayıt tarihi</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((user) => (
            <tr key={user.id} data-testid={`row-admin-user-${user.id}`}>
              <td>
                <div className="flex min-w-0 items-center gap-3">
                  <InitialsAvatar initials={personInitials(user)} tone={roleColor[user.role]} />
                  <div className="min-w-0">
                    <b className="block truncate">{personName(user)}</b>
                    <small className="block max-w-[220px] truncate">{user.email}</small>
                  </div>
                </div>
              </td>
              <td>{user.phone || '—'}</td>
              <td><span className="rounded-full bg-[#f4f3ed] px-2.5 py-1 text-xs font-semibold">{roleLabels[user.role]}</span></td>
              <td>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-[#E7F6F0] text-[#174D3C]' : 'bg-[#F4F4F5] text-[#4B5563]'}`}>
                  {user.isActive ? 'Aktif' : 'Pasif'}
                </span>
                {user.role === 'AGENT' && user.agentProfile && (
                  <small className="mt-1 block">Emlakçı profili: {user.agentProfile.isActive ? 'Aktif' : 'Askıya Alındı'}</small>
                )}
              </td>
              <td>{user.individualListingCount}</td>
              <td>{user.agentProfile ? user.agentListingCount : 'Profil yok'}</td>
              <td>{formatUtcDate(user.createdAt)}</td>
              <td>
                <Link className="text-sm font-bold text-primary" href={`/admin/kullanicilar/${user.id}`} data-testid={`link-admin-user-${user.id}`}>
                  Detay
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
