import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CheckCircle2, Clock3, FilePen, XCircle } from 'lucide-react';
import {
  ChartFrame,
  ChartMessage,
  DonutChart,
  InitialsAvatar,
  MetricCard,
  personName,
  RegistrationChart,
} from '@/components/admin/admin-charts';
import { adminPalette, applicationStatusColor } from '@/components/admin/palette';
import {
  customRange,
  formatUtcBucket,
  formatUtcDate,
  presetRange,
  type ChartRange,
} from '@/components/admin/utc-range';
import { EmptyState, ErrorState, inputClass, Pagination } from '@/components/market-ui';
import { useAdminApplicationSummary, useAdminApps } from '@/hooks/use-api';
import { ApiRequestError } from '@/lib/api-client';
import type {
  AdminAgentApplicationListItem,
  AdminAgentApplicationSummary,
  ApplicationStatus,
} from '@/types/api';

const statuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'] as const;

const statusLabels: Record<ApplicationStatus, string> = {
  DRAFT: 'Taslak',
  PENDING: 'İnceleme Bekleyen',
  APPROVED: 'Onaylanan',
  REJECTED: 'Reddedilen',
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

function readStatus(params: URLSearchParams): '' | ApplicationStatus {
  const raw = params.get('status');

  if (raw === 'DRAFT' || raw === 'PENDING' || raw === 'APPROVED' || raw === 'REJECTED') {
    return raw;
  }

  if (raw === 'ALL' || params.get('userId')) {
    return '';
  }

  return 'PENDING';
}

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase('tr-TR');
  }

  return (parts[0]?.slice(0, 2) ?? '·').toLocaleUpperCase('tr-TR');
}

function waitingLabel(submittedAt: string) {
  const elapsed = Date.now() - Date.parse(submittedAt);

  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return null;
  }

  const days = Math.floor(elapsed / 86_400_000);

  if (days >= 1) {
    return `${days} gündür inceleme bekliyor`;
  }

  const hours = Math.floor(elapsed / 3_600_000);

  if (hours >= 1) {
    return `${hours} saattir inceleme bekliyor`;
  }

  return 'Bugün incelemeye gönderildi';
}

function completionRatio(item: AdminAgentApplicationListItem) {
  const { completedCount, requiredCount } = item.documentCompletion;

  if (requiredCount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completedCount / requiredCount) * 100));
}

export function AdminApplicationsPanel() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const status = readStatus(params);
  const userId = params.get('userId') ?? '';
  const city = params.get('city') ?? '';
  const district = params.get('district') ?? '';
  const createdFrom = params.get('createdFrom') ?? '';
  const createdTo = params.get('createdTo') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const [cityInput, setCityInput] = useState(city);
  const [districtInput, setDistrictInput] = useState(district);
  const [preset, setPreset] = useState<'7' | '30' | '90' | '12' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const dateWarning = createdFrom && createdTo && createdFrom > createdTo
    ? 'Oluşturulma başlangıcı, bitişten sonra olamaz.'
    : null;
  const range = useMemo(() => {
    if (preset === 'custom') {
      const custom = customRange(customFrom, customTo);
      return custom.ok ? custom.range : null;
    }

    return presetRange(preset);
  }, [preset, customFrom, customTo]);
  const population = useAdminApplicationSummary({});
  const series = useAdminApplicationSummary(
    range ? { createdFrom: range.from, createdTo: range.to, bucket: range.bucket } : {},
    Boolean(range),
  );
  const applications = useAdminApps(
    {
      page,
      limit: 20,
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(params.get('search') ? { search: params.get('search') ?? '' } : {}),
      ...(city ? { city } : {}),
      ...(district ? { district } : {}),
      ...(!dateWarning && createdFrom ? { createdFrom } : {}),
      ...(!dateWarning && createdTo ? { createdTo } : {}),
    },
    !dateWarning,
  );

  useEffect(() => {
    const urlSearch = params.get('search') ?? '';
    const urlCity = params.get('city') ?? '';
    const urlDistrict = params.get('district') ?? '';
    setSearchInput((current) => keepDraft(current, urlSearch, 'admin-app-search'));
    setCityInput((current) => keepDraft(current, urlCity, 'admin-app-city'));
    setDistrictInput((current) => keepDraft(current, urlDistrict, 'admin-app-district'));
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeTextParam(search, navigate, 'search', searchInput);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, search, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writePlaceParams(search, navigate, cityInput, districtInput);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [cityInput, districtInput, search, navigate]);

  const replace = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    const query = next.toString();
    navigate(query ? `/admin/basvurular?${query}` : '/admin/basvurular', { replace: true });
  };

  const clearFilters = () => {
    setSearchInput('');
    setCityInput('');
    setDistrictInput('');
    const next = new URLSearchParams();

    if (userId) {
      next.set('userId', userId);
      next.set('status', 'ALL');
    } else {
      next.set('status', 'PENDING');
    }

    const query = next.toString();
    navigate(query ? `/admin/basvurular?${query}` : '/admin/basvurular', { replace: true });
  };

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Emlakçı hesabı</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-[#1F2933]">Emlakçı Başvuruları</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4B5563]">
          Başvuruları, belgeleri ve inceleme süreçlerini yönetin.
        </p>
      </header>
      <SummaryCards
        query={population}
        status={status}
        onStatus={(next) => replace((params) => {
          params.set('status', next || 'ALL');
          params.delete('page');
        })}
      />
      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <StatusChart query={population} />
        <CreatedChart query={series} range={range} preset={preset} customFrom={customFrom} customTo={customTo} onPreset={setPreset} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} />
      </section>
      <section id="basvuru-listesi" className="grid min-w-0 gap-4" aria-labelledby="admin-app-list-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="admin-app-list-title" className="font-display text-2xl font-bold">
              {status === 'PENDING' && !params.get('search') && !city && !district ? 'İnceleme kuyruğu' : 'Başvuru listesi'}
            </h3>
            <p className="mt-1 text-sm text-[#4B5563]">
              {applications.data ? `${applications.data.total} başvuru bulundu.` : 'Liste toplamı sunucudaki filtrelenmiş kayıtlardan gelir.'}
            </p>
          </div>
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Filtreleri temizle
          </button>
        </div>
        {userId && (
          <p className="text-sm text-[#4B5563]">
            Kullanıcı filtresi açık. <Link href="/admin/basvurular" className="font-semibold text-primary">Filtreyi kaldır</Link>
          </p>
        )}
        <div className="surface grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold md:col-span-2 xl:col-span-4">
            Arama
            <input
              className={inputClass}
              placeholder="Firma adı, başvuran, e-posta veya vergi numarası ile ara..."
              id="admin-app-search"
              data-testid="input-admin-apps-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Durum
            <select
              className={inputClass}
              aria-label="Başvuru durumu filtresi"
              data-testid="select-admin-apps-status"
              value={status}
              onChange={(event) => replace((next) => {
                next.set('status', event.target.value || 'ALL');
                next.delete('page');
              })}
            >
              <option value="">Tümü</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Şehir
            <input id="admin-app-city" className={inputClass} aria-label="Şehir filtresi" data-testid="input-admin-apps-city" value={cityInput} onChange={(event) => setCityInput(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            İlçe
            <input id="admin-app-district" className={inputClass} aria-label="İlçe filtresi" data-testid="input-admin-apps-district" value={districtInput} onChange={(event) => setDistrictInput(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Oluşturulma başlangıcı
            <input
              className={inputClass}
              type="date"
              data-testid="input-admin-apps-from"
              value={createdFrom}
              onChange={(event) => replace((next) => {
                if (event.target.value) next.set('createdFrom', event.target.value);
                else next.delete('createdFrom');
                next.delete('page');
              })}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Oluşturulma bitişi
            <input
              className={inputClass}
              type="date"
              data-testid="input-admin-apps-to"
              value={createdTo}
              onChange={(event) => replace((next) => {
                if (event.target.value) next.set('createdTo', event.target.value);
                else next.delete('createdTo');
                next.delete('page');
              })}
            />
          </label>
        </div>
        <p className="text-xs text-[#4B5563]">Liste tarihi başvurunun oluşturulma günüdür ve UTC sınırlarını kullanır. Grafik aralığı bu listeyi değiştirmez. Şehir ve ilçe, başvuruda kayıtlı adla eşleşir.</p>
        {dateWarning && <p role="alert" className="text-sm text-destructive">{dateWarning}</p>}
        {dateWarning ? null : applications.isLoading ? (
          <div className="surface p-6"><div className="skeleton h-48" /></div>
        ) : applications.error ? (
          <ErrorState retry={() => { void applications.refetch(); }} message={showError(applications.error)} />
        ) : applications.data?.items.length ? (
          <>
            <ApplicationTable items={applications.data.items} />
            <Pagination
              page={applications.data.page}
              limit={applications.data.limit}
              total={applications.data.total}
              onChange={(nextPage) => replace((next) => {
                if (nextPage <= 1) next.delete('page');
                else next.set('page', String(nextPage));
              })}
            />
          </>
        ) : (
          <EmptyState
            title={status === 'PENDING' ? 'İnceleme bekleyen başvuru yok' : 'Başvuru bulunamadı'}
            text={status === 'PENDING' ? 'Bu filtrede bekleyen kayıt yok.' : 'Bu filtrelerle eşleşen başvuru yok.'}
          />
        )}
      </section>
    </div>
  );
}

function keepDraft(current: string, urlValue: string, fieldId: string) {
  if (current.trim() === urlValue || document.activeElement?.id === fieldId) {
    return current;
  }

  return urlValue;
}

function writePlaceParams(
  search: string,
  navigate: (to: string, options?: { replace?: boolean }) => void,
  city: string,
  district: string,
) {
  const params = new URLSearchParams(search);
  let changed = false;

  for (const [key, value] of [['city', city], ['district', district]] as const) {
    const next = value.trim();
    const current = params.get(key) ?? '';

    if (next === current) {
      continue;
    }

    changed = true;

    if (next) {
      params.set(key, next);
    } else {
      params.delete(key);
    }
  }

  if (!changed) {
    return;
  }

  params.delete('page');
  const query = params.toString();
  navigate(query ? `/admin/basvurular?${query}` : '/admin/basvurular', { replace: true });
}

function writeTextParam(
  search: string,
  navigate: (to: string, options?: { replace?: boolean }) => void,
  key: 'search' | 'city' | 'district',
  value: string,
) {
  const params = new URLSearchParams(search);
  const next = value.trim();
  const current = params.get(key) ?? '';

  if (next === current) {
    return;
  }

  if (next) {
    params.set(key, next);
  } else {
    params.delete(key);
  }

  params.delete('page');
  const query = params.toString();
  navigate(query ? `/admin/basvurular?${query}` : '/admin/basvurular', { replace: true });
}

function SummaryCards({
  query,
  status,
  onStatus,
}: {
  query: ReturnType<typeof useAdminApplicationSummary>;
  status: '' | ApplicationStatus;
  onStatus: (status: '' | ApplicationStatus) => void;
}) {
  if (query.isLoading && !query.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="surface p-4"><div className="skeleton h-20" /></div>)}
      </div>
    );
  }

  if (query.error && !query.data) {
    return <ErrorState retry={() => { void query.refetch(); }} message="Başvuru özeti yüklenemedi. Liste aşağıda kullanılabilir." />;
  }

  if (!query.data) {
    return null;
  }

  const sum = statuses.reduce((total, item) => total + query.data!.statuses[item], 0);

  return (
    <div className="grid gap-3">
      {query.error && query.data && (
        <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="text-sm text-[#4B5563]">Özet güncellenemedi. Son başarılı değerler gösteriliyor.</p>
          <button type="button" onClick={() => { void query.refetch(); }} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white">Yeniden dene</button>
        </div>
      )}
      {sum !== query.data.total && (
        <p role="alert" className="text-sm text-destructive">Toplam, durum sayılarıyla örtüşmüyor. API değerleri değiştirilmeden gösteriliyor.</p>
      )}
      <p className="text-sm font-semibold text-[#1F2933]" data-testid="stat-admin-apps-total">
        Toplam başvuru: {query.data.total}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="İnceleme Bekleyen" value={String(query.data.statuses.PENDING)} hint={pendingHint(query.data)} tone={applicationStatusColor.PENDING} icon={<Clock3 size={20} />} testId="stat-apps-pending" pressed={status === 'PENDING'} onClick={() => onStatus('PENDING')} />
        <MetricCard label="Onaylanan" value={String(query.data.statuses.APPROVED)} hint="Onaylanmış başvuru kaydı" tone={applicationStatusColor.APPROVED} icon={<CheckCircle2 size={20} />} testId="stat-apps-approved" pressed={status === 'APPROVED'} onClick={() => onStatus('APPROVED')} />
        <MetricCard label="Reddedilen" value={String(query.data.statuses.REJECTED)} hint="Ret kararı verilmiş başvuru" tone={applicationStatusColor.REJECTED} icon={<XCircle size={20} />} testId="stat-apps-rejected" pressed={status === 'REJECTED'} onClick={() => onStatus('REJECTED')} />
        <MetricCard label="Taslak" value={String(query.data.statuses.DRAFT)} hint="Henüz incelemeye gönderilmemiş" tone={applicationStatusColor.DRAFT} icon={<FilePen size={20} />} testId="stat-apps-draft" pressed={status === 'DRAFT'} onClick={() => onStatus('DRAFT')} />
      </div>
    </div>
  );
}

function pendingHint(summary: AdminAgentApplicationSummary) {
  if (!summary.oldestPending) {
    return 'Bekleyen başvuru yok';
  }

  return waitingLabel(summary.oldestPending.submittedAt) ?? 'İnceleme kuyruğu';
}

function StatusChart({ query }: { query: ReturnType<typeof useAdminApplicationSummary> }) {
  return (
    <ChartFrame title="Başvuru durum dağılımı" description="Kayıtlı başvuruların güncel durumu. Geçmiş onay veya ret işlem sayısı değildir." testId="chart-app-status">
      {query.isLoading && !query.data ? <div className="skeleton h-48" /> : query.error && !query.data ? (
        <ChartMessage title="Grafik verisi bulunamadı" text="Durum dağılımı yüklenemedi." action={<button type="button" onClick={() => { void query.refetch(); }} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} />
      ) : query.data && query.data.total === 0 ? (
        <ChartMessage title="Henüz başvuru yok" text="Başvuru oluşturulduğunda dağılım burada görünür." />
      ) : query.data ? (
        <DonutChart
          unit="Başvuru"
          center={String(query.data.total)}
          slices={statuses.map((item) => ({
            key: item,
            label: statusLabels[item],
            value: query.data?.statuses[item] ?? 0,
            color: applicationStatusColor[item],
          }))}
        />
      ) : null}
    </ChartFrame>
  );
}

function CreatedChart({
  query,
  range,
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo,
}: {
  query: ReturnType<typeof useAdminApplicationSummary>;
  range: ChartRange | null;
  preset: '7' | '30' | '90' | '12' | 'custom';
  customFrom: string;
  customTo: string;
  onPreset: (preset: '7' | '30' | '90' | '12' | 'custom') => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}) {
  const series = query.data?.created;
  const summed = series?.points.reduce((sum, point) => sum + point.count, 0);
  const mismatch = series && summed !== undefined && summed !== series.total;
  const custom = preset === 'custom' ? customRange(customFrom, customTo) : null;

  return (
    <ChartFrame title="Yeni Oluşturulan Başvurular" description={range ? `${range.label} · oluşturulma tarihi, UTC ${range.bucket === 'day' ? 'gün' : 'ay'} kovaları` : 'Geçerli bir aralık seçin.'} testId="chart-app-created">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Grafik tarih aralığı">
        {([
          ['7', 'Son 7 gün'],
          ['30', 'Son 30 gün'],
          ['90', 'Son 90 gün'],
          ['12', 'Son 12 ay'],
          ['custom', 'Özel aralık'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={preset === value} onClick={() => onPreset(value)} className={`rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${preset === value ? 'bg-primary text-white' : 'bg-[#f4f3ed] text-[#1F2933]'}`}>
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">UTC başlangıç<input className={inputClass} type="date" value={customFrom} onChange={(event) => onCustomFrom(event.target.value)} /></label>
          <label className="grid gap-1 text-sm font-semibold">UTC bitiş<input className={inputClass} type="date" value={customTo} onChange={(event) => onCustomTo(event.target.value)} /></label>
        </div>
      )}
      <p className="mb-3 text-xs text-[#4B5563]">
        {range ? `${formatUtcDate(`${range.from}T00:00:00.000Z`)} – ${formatUtcDate(`${range.to}T00:00:00.000Z`)}. Bu grafik durum sayaçlarını değiştirmez.` : custom && !custom.ok ? custom.message : 'Grafik aralığı seçin.'}
      </p>
      {!range ? (
        <ChartMessage title="Aralık uygulanmadı" text="Seçilen tarih aralığı API limitine uymuyor." />
      ) : query.isLoading && !query.data ? (
        <div className="skeleton h-56" />
      ) : query.error && !query.data ? (
        <ChartMessage title="Grafik verisi bulunamadı" text="Oluşturulma eğilimi yüklenemedi. Sahte sıfır gösterilmiyor." action={<button type="button" onClick={() => { void query.refetch(); }} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} />
      ) : series ? (
        <>
          {query.error && <p role="alert" className="mb-3 text-sm text-[#4B5563]">Oluşturulma eğilimi güncellenemedi. Son başarılı seri gösteriliyor.</p>}
          <p className="mb-3 text-sm font-semibold text-[#1F2933]" data-testid="text-app-created-total">{range.label}: {series.total} yeni oluşturulan başvuru</p>
          {mismatch && <p role="alert" className="mb-3 text-sm text-destructive">Seri toplamı kova sayılarıyla örtüşmüyor. Değerler değiştirilmedi.</p>}
          {series.total === 0 && <p className="mb-3 text-sm text-[#4B5563]">Bu aralıkta yeni başvuru yok. Sıfırlar API kova değerleridir.</p>}
          <RegistrationChart seriesName="Yeni oluşturulan başvuru" points={series.points.map((point) => ({ label: formatUtcBucket(point.bucketStart, series.bucket), count: point.count }))} />
        </>
      ) : (
        <ChartMessage title="Zaman serisi yok" text="Özet yanıtı oluşturulma serisi döndürmedi." />
      )}
    </ChartFrame>
  );
}

function ApplicationTable({ items }: { items: AdminAgentApplicationListItem[] }) {
  return (
    <div className="surface min-w-0 overflow-x-auto">
      <table className="data-table min-w-[880px]">
        <thead>
          <tr>
            <th>Firma</th>
            <th>Konum</th>
            <th>Başvuru tarihi</th>
            <th>Belgeler</th>
            <th>Durum</th>
            <th>İnceleyen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const ratio = completionRatio(item);
            const complete = item.documentCompletion.isComplete;
            const waiting = item.status === 'PENDING' && item.submittedAt ? waitingLabel(item.submittedAt) : null;

            return (
              <tr key={item.id} data-testid={`row-admin-app-${item.id}`}>
                <td>
                  <div className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar initials={companyInitials(item.companyName)} tone={applicationStatusColor[item.status]} />
                    <div className="min-w-0">
                      <b className="block break-words">{item.companyName}</b>
                      <Link href={`/admin/kullanicilar/${item.user.id}`} className="break-all text-sm font-semibold text-primary">{personName(item.user)}</Link>
                      <small className="block break-all">{item.user.email}</small>
                    </div>
                  </div>
                </td>
                <td className="break-words">{item.city}, {item.district}</td>
                <td>
                  {formatUtcDate(item.createdAt)}
                  {waiting && <small className="mt-1 block text-[#8A6A12]">{waiting}</small>}
                </td>
                <td>
                  <p className="text-sm font-semibold" style={{ color: complete ? adminPalette.positive : adminPalette.pending }}>
                    {item.documentCompletion.completedCount}/{item.documentCompletion.requiredCount} — {complete ? 'Tamamlandı' : 'Eksik Belge'}
                  </p>
                  <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[#f4f3ed]" aria-hidden>
                    <div className="h-full" style={{ width: `${ratio}%`, background: complete ? adminPalette.positive : adminPalette.pending }} />
                  </div>
                </td>
                <td><StatusBadge status={item.status} /></td>
                <td>{item.reviewedBy ? personName(item.reviewedBy) : '—'}</td>
                <td>
                  <Link href={`/admin/basvurular/${item.id}`} className="text-sm font-bold text-primary" data-testid={`link-admin-app-${item.id}`}>
                    {item.status === 'PENDING' ? 'İncele' : 'Detay'}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: applicationStatusColor[status] }}>
      {statusLabels[status]}
    </span>
  );
}
