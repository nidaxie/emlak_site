import { useState } from 'react';
import { Link, useRoute } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, UserCheck, UserX } from 'lucide-react';
import {
  ChartFrame,
  ChartMessage,
  InitialsAvatar,
  MetricCard,
  personInitials,
  personName,
  StatusDonut,
} from '@/components/admin/admin-charts';
import { adminPalette, listingStatusColor, roleColor } from '@/components/admin/palette';
import { formatUtcDate } from '@/components/admin/utc-range';
import { ErrorState } from '@/components/market-ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/auth-context';
import { keys, useAdminUser } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { ApiRequestError } from '@/lib/api-client';
import { adminUsersApi } from '@/services/api';
import type {
  AdminListingCounts,
  AdminUserDetail,
  ApplicationStatus,
  AuditLog,
  Role,
} from '@/types/api';

const roleLabels: Record<Role, string> = {
  USER: 'Bireysel Kullanıcı',
  AGENT: 'Emlak Danışmanı',
  ADMIN: 'Yönetici',
};

const applicationLabels: Record<ApplicationStatus, string> = {
  DRAFT: 'Taslak',
  PENDING: 'İnceleniyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

const applicationTone: Record<ApplicationStatus, string> = {
  DRAFT: adminPalette.neutralText,
  PENDING: '#8A6A12',
  APPROVED: adminPalette.brand,
  REJECTED: '#8F3D3D',
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

function listingConsistent(counts: AdminListingCounts) {
  return counts.total === counts.active + counts.inactive + counts.sold + counts.rented;
}

export function AdminUserDetailPanel() {
  const [, params] = useRoute('/admin/kullanicilar/:id');
  const id = params?.id ?? '';
  const { user: currentAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useAdminUser(id);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isSelf = Boolean(currentAdmin && query.data && currentAdmin.id === query.data.id);
  const status = useMutation({
    mutationFn: (active: boolean) => adminUsersApi.updateUserStatus(id, active),
    onSuccess: (_result, active) => {
      void queryClient.invalidateQueries({ queryKey: keys.adminUser(id) });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      void queryClient.invalidateQueries({ queryKey: ['agent-properties'] });
      setErrorMsg('');
      setOpen(false);
      toast({ title: active ? 'Hesap aktif edildi.' : 'Hesap pasife alındı.' });
    },
    onError: (error) => {
      setErrorMsg(showError(error));
      void query.refetch();
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user-summary'] });
    },
  });

  if (query.isLoading) {
    return <div className="surface p-8"><div className="skeleton h-48" /></div>;
  }

  if (query.error || !query.data) {
    const missing = query.error instanceof ApiRequestError && query.error.status === 404;
    return missing ? (
      <p className="surface p-6 text-sm">Kullanıcı bulunamadı.</p>
    ) : (
      <ErrorState retry={() => { void query.refetch(); }} message={showError(query.error)} />
    );
  }

  const user = query.data;
  const nextActive = !user.isActive;
  const selfBlocked = isSelf && user.isActive;

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <Link href="/admin/kullanicilar" className="inline-flex w-fit items-center gap-2 text-sm text-[#4B5563]">
        <ArrowLeft size={15} /> Kullanıcılar
      </Link>
      <section className="surface flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <InitialsAvatar initials={personInitials(user)} tone={roleColor[user.role]} size="lg" />
          <div className="min-w-0">
            <h2 className="break-words font-display text-3xl font-extrabold">{personName(user)}</h2>
            <p className="mt-1 break-all text-[#4B5563]">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f4f3ed] px-2.5 py-1 text-xs font-semibold">{roleLabels[user.role]}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-[#E7F6F0] text-[#174D3C]' : 'bg-[#F4F4F5] text-[#4B5563]'}`}>
                Hesap: {user.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#4B5563]">Kayıt: {formatUtcDate(user.createdAt)} UTC</p>
          </div>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={status.isPending || selfBlocked}
            data-testid="button-toggle-user-status"
            onClick={() => { setErrorMsg(''); setOpen(true); }}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {user.isActive ? 'Pasife Al' : 'Hesabı Aktif Et'}
          </button>
          {selfBlocked && (
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#4B5563]">
              Güvenlik kuralı gereği yönetici kendi hesabını pasife alamaz.
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <AccountFacts user={user} />
        <ListingSummary user={user} />
      </div>
      <ListingCharts user={user} />
      <ProfileSection user={user} />
      <ApplicationsSection user={user} />
      <Timeline events={user.managementEvents.items} total={user.managementEvents.total} userId={user.id} />
      <Dialog open={open} onOpenChange={(next) => { if (!status.isPending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.isActive ? 'Kullanıcı Hesabını Pasife Al' : 'Kullanıcı Hesabını Aktif Et'}</DialogTitle>
            <DialogDescription>
              {user.isActive
                ? 'Bu işlem kullanıcının sisteme erişimini engeller. Açık oturumlar kapatılır ve mevcut access tokenlar geçersiz olur. İlgili public ilanlar ve varsa emlakçı profili görüntülenmez. Kullanıcı, ilan ve başvuru kayıtları silinmez.'
                : 'Hesap yeniden giriş yapabilir. Emlakçı profili askıdaysa askı kalkmaz. İlan durumları değişmez; pasif, satılmış veya kiralanmış ilanlar kendiliğinden yayına dönmez.'}
            </DialogDescription>
          </DialogHeader>
          {errorMsg && <p role="alert" className="text-sm text-destructive" data-testid="text-admin-user-error">{errorMsg}</p>}
          <DialogFooter className="gap-2 sm:justify-end">
            <button type="button" disabled={status.isPending} onClick={() => setOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Vazgeç</button>
            <button
              type="button"
              disabled={status.isPending}
              data-testid="button-confirm-user-status"
              onClick={() => status.mutate(nextActive)}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {status.isPending ? 'Güncelleniyor…' : user.isActive ? 'Hesabı Pasife Al' : 'Hesabı Aktif Et'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountFacts({ user }: { user: AdminUserDetail }) {
  const { toast } = useToast();
  const rows = [
    ['Ad', user.firstName || '—'],
    ['Soyad', user.lastName || '—'],
    ['E-posta', user.email],
    ['Telefon', user.phone || '—'],
    ['Rol', roleLabels[user.role]],
    ['Hesap durumu', user.isActive ? 'Aktif' : 'Pasif'],
    ['Kayıt', formatUtcDate(user.createdAt)],
    ['Güncellenme', formatUtcDate(user.updatedAt)],
  ];

  return (
    <section className="surface p-5">
      <h3 className="font-display text-xl font-bold">Hesap bilgileri</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-[#4B5563]">{label}</dt>
            <dd className="mt-1 break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
        <span className="break-all">Kimlik: {user.id}</span>
        <button
          type="button"
          className="font-semibold text-primary"
          onClick={() => {
            void navigator.clipboard.writeText(user.id).then(() => {
              toast({ title: 'Kimlik kopyalandı.' });
            });
          }}
        >
          Kopyala
        </button>
      </div>
    </section>
  );
}

function ListingSummary({ user }: { user: AdminUserDetail }) {
  const agent = user.agentListings;
  const visible = user.individualListings.publiclyVisible + (agent?.publiclyVisible ?? 0);
  const finished =
    user.individualListings.sold +
    user.individualListings.rented +
    (agent ? agent.sold + agent.rented : 0);

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <MetricCard label="Bireysel İlanlar" value={String(user.individualListings.total)} hint="Silinmemiş kayıtlı ilan" tone={adminPalette.info} icon={<UserCheck size={20} />} testId="stat-individual-listings" />
      {agent ? (
        <MetricCard label="Emlakçı İlanları" value={String(agent.total)} hint="Silinmemiş kayıtlı ilan" tone={adminPalette.positive} icon={<Building2 size={20} />} testId="stat-agent-listings" />
      ) : (
        <article className="surface p-4 text-sm text-[#4B5563]">Emlakçı profili olmadığı için profesyonel ilan özeti yok.</article>
      )}
      <MetricCard label="Gerçek Yayındaki İlanlar" value={String(visible)} hint="Public görünürlük. Aktif durumdan ayrıdır." tone={adminPalette.brand} icon={<UserCheck size={20} />} testId="stat-public-listings" />
      <MetricCard label="Sonuçlanan İlanlar" value={String(finished)} hint="Satıldı ve kiralandı toplamı" tone={adminPalette.analytic} icon={<UserX size={20} />} testId="stat-finished-listings" />
    </section>
  );
}

function ListingCharts({ user }: { user: AdminUserDetail }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ListingGroup title="Bireysel ilan durumları" counts={user.individualListings} href={`/admin/ilanlar?ownerUserId=${user.id}`} action="Bireysel ilanları görüntüle" testId="chart-individual-listings" />
      {user.agentListings ? (
        <ListingGroup title="Emlakçı ilan durumları" counts={user.agentListings} href={`/admin/ilanlar?agentUserId=${user.id}`} action="Emlakçı ilanlarını görüntüle" testId="chart-agent-listings" />
      ) : (
        <ChartFrame title="Emlakçı ilan durumları" description="Profil olmadığı için grafik yok." testId="chart-agent-listings">
          <ChartMessage title="Profil yok" text="Bu hesabın emlakçı ilanı bulunmuyor." />
        </ChartFrame>
      )}
    </section>
  );
}

function ListingGroup({
  title,
  counts,
  href,
  action,
  testId,
}: {
  title: string;
  counts: AdminListingCounts;
  href: string;
  action: string;
  testId: string;
}) {
  const slices = [
    { key: 'active', label: 'Aktif durum', value: counts.active, color: listingStatusColor.active },
    { key: 'inactive', label: 'Pasif durum', value: counts.inactive, color: listingStatusColor.inactive },
    { key: 'sold', label: 'Satıldı', value: counts.sold, color: listingStatusColor.sold },
    { key: 'rented', label: 'Kiralandı', value: counts.rented, color: listingStatusColor.rented },
  ];

  return (
    <ChartFrame title={title} description="Durum sayıları kayıtlı ilanlardır. Yayındaki ilan ayrıca gösterilir." testId={testId}>
      {!listingConsistent(counts) && (
        <p role="alert" className="mb-3 text-sm text-destructive">İlan toplamı durum kırılımıyla örtüşmüyor. Değerler değiştirilmedi.</p>
      )}
      <StatusDonut slices={slices} />
      <ul className="mt-3 grid gap-1 text-sm text-[#4B5563]">
        {slices.map((slice) => <li key={slice.key}>{slice.label}: {slice.value}</li>)}
        <li>Yayında görünen: {counts.publiclyVisible}</li>
      </ul>
      <Link href={href} className="mt-4 inline-flex text-sm font-bold text-primary">{action}</Link>
    </ChartFrame>
  );
}

function ProfileSection({ user }: { user: AdminUserDetail }) {
  if (!user.agentProfile) {
    return null;
  }

  const profile = user.agentProfile;
  const initials = profile.companyName.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || 'E';

  return (
    <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <InitialsAvatar initials={initials} tone={adminPalette.positive} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">Bağlı emlakçı profili</h3>
          <p className="mt-1 truncate font-semibold">{profile.companyName}</p>
          <p className="text-sm text-[#4B5563]">{profile.district}, {profile.city}</p>
          <p className="mt-2 text-sm">Hesap: {user.isActive ? 'Aktif' : 'Pasif'} · Emlakçı profili: {profile.isActive ? 'Aktif' : 'Askıya Alındı'}</p>
        </div>
      </div>
      <Link href={`/admin/emlakcilar/${profile.id}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold">
        Emlakçı Profilini İncele
      </Link>
    </section>
  );
}

function ApplicationsSection({ user }: { user: AdminUserDetail }) {
  const preview = user.applications.items.length;
  const hidden = Math.max(user.applications.total - preview, 0);

  return (
    <section className="surface p-5" aria-labelledby="user-applications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="user-applications" className="font-display text-xl font-bold">Başvuru geçmişi</h3>
        <Link href={`/admin/basvurular?userId=${user.id}&status=ALL`} className="text-sm font-bold text-primary">Tüm başvurular</Link>
      </div>
      <p className="mt-1 text-sm text-[#4B5563]">
        {user.applications.total === 0
          ? 'Bu hesaba ait başvuru yok.'
          : hidden > 0
            ? `Son ${preview} başvuru gösteriliyor. Toplam ${user.applications.total}.`
            : `${user.applications.total} başvurunun tamamı listeleniyor.`}
      </p>
      <ol className="mt-4 grid gap-3">
        {user.applications.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/admin/basvurular/${item.id}`} className="font-semibold text-primary">{item.companyName}</Link>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: applicationTone[item.status], background: '#f4f3ed' }}>
                {applicationLabels[item.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#4B5563]">Oluşturma: {formatUtcDate(item.createdAt)}</p>
            {item.submittedAt && <p className="text-sm text-[#4B5563]">İncelemeye gönderilme: {formatUtcDate(item.submittedAt)}</p>}
            {item.reviewedAt && <p className="text-sm text-[#4B5563]">İnceleme: {formatUtcDate(item.reviewedAt)}</p>}
            {item.rejectionReason && <p className="mt-2 text-sm">Red nedeni: {item.rejectionReason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Timeline({
  events,
  total,
  userId,
}: {
  events: AuditLog[];
  total: number;
  userId: string;
}) {
  return (
    <section className="surface p-5" aria-labelledby="user-management-events">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="user-management-events" className="font-display text-xl font-bold">Yönetim işlemleri</h3>
        <Link href={`/admin/audit-logs?entityType=USER&entityId=${userId}`} className="text-sm font-bold text-primary">Tüm işlem kayıtları</Link>
      </div>
      <p className="mt-1 text-sm text-[#4B5563]">
        {total === 0 ? 'Bu hesap için işlem kaydı yok.' : events.length < total ? `Son ${events.length} kayıt gösteriliyor. Toplam ${total}.` : `${total} kayıt listeleniyor.`}
      </p>
      <ol className="mt-4 grid gap-0">
        {events.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </ol>
    </section>
  );
}

function TimelineItem({ event }: { event: AuditLog }) {
  const previous = booleanMeta(event.metadata, 'previousIsActive');
  const next = booleanMeta(event.metadata, 'nextIsActive');
  const tone = event.action === 'USER_DEACTIVATED' ? adminPalette.danger : adminPalette.positive;

  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-l border-[#E5E7EB] pb-5 pl-0 last:pb-0">
      <span className="-ml-3 grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: tone }} aria-hidden>
        {event.action === 'USER_DEACTIVATED' ? <UserX size={14} /> : <UserCheck size={14} />}
      </span>
      <div>
        <p className="font-semibold">{eventTitle(event.action)}</p>
        <p className="mt-1 text-sm text-[#4B5563]">{formatUtcDate(event.createdAt)}</p>
        {previous !== null && next !== null && (
          <p className="mt-1 text-sm">Önceki durum: {previous ? 'Aktif' : 'Pasif'} · Yeni durum: {next ? 'Aktif' : 'Pasif'}</p>
        )}
        <p className="mt-1 break-all text-xs text-[#4B5563]">İşlemi yapan: {event.actorUserId}</p>
      </div>
    </li>
  );
}

function eventTitle(action: string) {
  if (action === 'USER_ACTIVATED') return 'Kullanıcı hesabı aktif edildi.';
  if (action === 'USER_DEACTIVATED') return 'Kullanıcı hesabı pasife alındı.';
  return action;
}

function booleanMeta(metadata: Record<string, unknown> | null, key: string) {
  if (!metadata || !(key in metadata) || typeof metadata[key] !== 'boolean') {
    return null;
  }

  return metadata[key] === true;
}
