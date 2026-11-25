import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Building2, FileText, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { ChartMessage, InitialsAvatar, personName } from '@/components/admin/admin-charts';
import { adminPalette, applicationStatusColor } from '@/components/admin/palette';
import { formatUtcDate } from '@/components/admin/utc-range';
import { ErrorState, inputClass, labels } from '@/components/market-ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { keys, useAdminApplication, useAdminApplicationDocuments } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { ApiRequestError } from '@/lib/api-client';
import { adminApplicationsApi } from '@/services/api';
import type { AdminAgentApplication, AgentApplicationDocument, AgentDocumentType, ApplicationStatus } from '@/types/api';

const requiredTypes = ['TAX_CERTIFICATE', 'AUTHORIZATION_CERTIFICATE'] as const;

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

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase('tr-TR');
  }

  return (parts[0]?.slice(0, 2) ?? '·').toLocaleUpperCase('tr-TR');
}

function completionPercent(completed: number, required: number) {
  if (required <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / required) * 100));
}

export function AdminApplicationDetailPanel() {
  const [, params] = useRoute('/admin/basvurular/:id');
  const id = params?.id ?? '';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const application = useAdminApplication(id);
  const documents = useAdminApplicationDocuments(id);
  const urls = useRef<string[]>([]);
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [docError, setDocError] = useState('');
  const [busyDoc, setBusyDoc] = useState<string | null>(null);

  useEffect(() => () => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const refreshDecision = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.adminApplication(id) }),
      queryClient.invalidateQueries({ queryKey: ['admin-agent-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-agent-application-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-user-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-user'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
    ]);
  };

  const failDecision = async (error: unknown) => {
    setMessage('');

    if (error instanceof ApiRequestError && error.status === 409) {
      setErrorMsg('Bu başvurunun durumu başka bir işlemle değişti. Güncel kayıt yüklendi.');
      setDialog(null);
      await refreshDecision();
      return;
    }

    setErrorMsg(showError(error));
  };

  const approve = useMutation({
    mutationFn: () => adminApplicationsApi.approveApplication(id),
    onSuccess: async () => {
      setErrorMsg('');
      setDialog(null);
      setMessage('Başvuru onaylandı. Emlakçı profili oluşturuldu ve kullanıcı rolü AGENT olarak güncellendi.');
      toast({ title: 'Başvuru onaylandı.' });
      await refreshDecision();
    },
    onError: (error) => { void failDecision(error); },
  });

  const reject = useMutation({
    mutationFn: () => adminApplicationsApi.rejectApplication(id, reason.trim()),
    onSuccess: async () => {
      setErrorMsg('');
      setDialog(null);
      setMessage('Başvuru reddedildi.');
      toast({ title: 'Başvuru reddedildi.' });
      await refreshDecision();
    },
    onError: (error) => { void failDecision(error); },
  });

  const openBlob = async (doc: AgentApplicationDocument, mode: 'view' | 'download') => {
    setDocError('');
    setBusyDoc(doc.id);

    try {
      const blob = await adminApplicationsApi.getApplicationDocument(id, doc.id);
      const url = URL.createObjectURL(blob);

      if (mode === 'download') {
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.originalName || 'basvuru-belgesi';
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const opened = window.open(url, '_blank', 'noopener');

      if (!opened) {
        URL.revokeObjectURL(url);
        setDocError('Belge yeni sekmede açılamadı. İndirmeyi deneyin.');
        return;
      }

      urls.current.push(url);
    } catch (error) {
      setDocError(showError(error));
    } finally {
      setBusyDoc(null);
    }
  };

  if (application.isLoading) {
    return <div className="surface p-8"><div className="skeleton h-48" /></div>;
  }

  if (application.error || !application.data) {
    return <ErrorState retry={() => { void application.refetch(); }} message={application.error ? showError(application.error) : 'Başvuru bulunamadı'} />;
  }

  const record = application.data;
  const canDecide = record.status === 'PENDING';
  const ratio = completionPercent(record.documentCompletion.completedCount, record.documentCompletion.requiredCount);
  const trimmed = reason.trim();
  const deciding = approve.isPending || reject.isPending;

  return (
    <div className="grid min-w-0 gap-5">
      <Link href="/admin/basvurular" className="inline-flex items-center gap-2 text-sm font-semibold text-[#4B5563]"><ArrowLeft size={15} /> Başvuru listesine dön</Link>
      <Summary record={record} />
      <Lifecycle record={record} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-5">
          <InfoGrid record={record} />
          <DocumentsSection
            record={record}
            documents={documents.data}
            loading={documents.isLoading}
            error={documents.error ? showError(documents.error) : ''}
            retry={() => { void documents.refetch(); }}
            ratio={ratio}
            busyDoc={busyDoc}
            docError={docError}
            onOpen={(doc, mode) => { void openBlob(doc, mode); }}
          />
        </div>
        <DecisionPanel
          record={record}
          canDecide={canDecide}
          message={message}
          errorMsg={errorMsg}
          deciding={deciding}
          onApprove={() => { setErrorMsg(''); setDialog('approve'); }}
          onReject={() => { setReasonError(''); setErrorMsg(''); setDialog('reject'); }}
        />
      </div>
      <Dialog open={dialog === 'approve'} onOpenChange={(open) => { if (!deciding) setDialog(open ? 'approve' : null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başvuruyu onayla</DialogTitle>
            <DialogDescription>
              Bu başvuruyu onayladığınızda kullanıcı için emlakçı profili oluşturulacak ve emlakçı paneline erişim sağlanacaktır.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1 text-sm text-[#1F2933]">
            <li>Firma: {record.companyName}</li>
            <li>Başvuran: {personName(record.user)} · {record.user.email}</li>
            <li>Zorunlu belgeler: {record.documentCompletion.completedCount}/{record.documentCompletion.requiredCount} {record.documentCompletion.isComplete ? 'yüklendi' : 'eksik'}</li>
          </ul>
          <p className="text-sm text-[#4B5563]">Belge yüklenmiş olması, belgenin içeriğinin doğrulandığı anlamına gelmez. Onay sunucu kurallarına bağlıdır.</p>
          <DialogFooter>
            <button type="button" className="h-11 rounded-xl border border-border px-4 font-semibold" disabled={deciding} onClick={() => setDialog(null)}>Vazgeç</button>
            <button type="button" className="h-11 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-60" data-testid="button-confirm-approve" disabled={deciding} onClick={() => approve.mutate()}>{approve.isPending ? 'Onaylanıyor…' : 'Onayla'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'reject'} onOpenChange={(open) => { if (!deciding) setDialog(open ? 'reject' : null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başvuruyu reddet</DialogTitle>
            <DialogDescription>Ret gerekçesi başvurana iletilir. Reddedilen başvuru revise edilerek yeniden gönderilebilir.</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="reject-reason">Ret gerekçesi (3–500 karakter)</label>
          <textarea id="reject-reason" className={`${inputClass} h-28 py-3`} data-testid="textarea-reject-reason" value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setReasonError(''); }} />
          {reasonError && <p role="alert" className="text-sm text-destructive">{reasonError}</p>}
          <DialogFooter>
            <button type="button" className="h-11 rounded-xl border border-border px-4 font-semibold" disabled={deciding} onClick={() => setDialog(null)}>Vazgeç</button>
            <button
              type="button"
              className="h-11 rounded-xl border border-destructive/40 px-4 font-bold text-destructive disabled:opacity-40"
              data-testid="button-confirm-reject"
              disabled={deciding}
              onClick={() => {
                if (trimmed.length < 3 || trimmed.length > 500) {
                  setReasonError('Ret gerekçesi 3 ile 500 karakter arasında olmalıdır.');
                  return;
                }

                reject.mutate();
              }}
            >
              {reject.isPending ? 'Reddediliyor…' : 'Reddet'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ record }: { record: AdminAgentApplication }) {
  return (
    <section className="surface min-w-0 border-l-4 p-5" style={{ borderLeftColor: applicationStatusColor[record.status] }} aria-labelledby="app-summary">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
        <InitialsAvatar initials={companyInitials(record.companyName)} tone={applicationStatusColor[record.status]} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Başvuru profili</p>
          <h2 id="app-summary" className="mt-1 break-words font-display text-3xl font-extrabold">{record.companyName}</h2>
          <p className="mt-2 break-words text-sm text-[#4B5563]">
            Başvuran: <Link href={`/admin/kullanicilar/${record.user.id}`} className="font-semibold text-primary">{personName(record.user)}</Link> · <span className="break-all">{record.user.email}</span>
          </p>
          <p className="mt-1 text-sm text-[#4B5563]">Vergi numarası: <span className="font-mono">{record.taxNumber}</span></p>
          {record.submittedAt && <p className="mt-1 text-sm text-[#4B5563]">İncelemeye gönderilme: {formatUtcDate(record.submittedAt)}</p>}
          <p className="mt-1 text-sm text-[#4B5563]">İnceleyen: {record.reviewedBy ? personName(record.reviewedBy) : 'Kayıtlı inceleyen yok'}</p>
        </div>
        <span className="w-fit rounded-full px-3 py-1 text-xs font-semibold text-white" data-testid="badge-admin-app-status" style={{ background: applicationStatusColor[record.status] }}>{statusLabels[record.status]}</span>
      </div>
    </section>
  );
}

function Lifecycle({ record }: { record: AdminAgentApplication }) {
  const steps = [
    {
      key: 'draft',
      title: 'Taslak',
      detail: `Oluşturulma: ${formatUtcDate(record.createdAt)}`,
      state: record.status === 'DRAFT' ? 'current' : 'done',
    },
    {
      key: 'review',
      title: record.status === 'PENDING' ? 'İnceleme Bekliyor' : record.submittedAt ? 'İncelemeye gönderildi' : 'İncelemeye gönderilmedi',
      detail: record.submittedAt ? `Gönderilme: ${formatUtcDate(record.submittedAt)}` : 'Gönderim tarihi yok',
      state: !record.submittedAt ? 'upcoming' : record.status === 'PENDING' ? 'current' : 'done',
    },
    {
      key: 'decision',
      title: record.status === 'APPROVED' ? 'Onaylandı' : record.status === 'REJECTED' ? 'Reddedildi' : 'Karar',
      detail: record.reviewedAt ? `Karar: ${formatUtcDate(record.reviewedAt)}` : 'Karar bekleniyor',
      state: record.reviewedAt && (record.status === 'APPROVED' || record.status === 'REJECTED') ? 'done' : 'upcoming',
    },
  ] as const;

  return (
    <section className="surface min-w-0 p-5" aria-labelledby="app-lifecycle">
      <h3 id="app-lifecycle" className="font-display text-xl font-bold">Başvuru süreci</h3>
      <p className="mt-1 text-sm text-[#4B5563]">Taslak, incelemeye gönderim ve karar. Ayrı bir incelemeye başlama kaydı tutulmaz.</p>
      <ol className="mt-4 grid gap-4 md:grid-cols-3" aria-label="Başvuru süreci">
        {steps.map((step, index) => (
          <li key={step.key} className="min-w-0 rounded-xl bg-[#f4f3ed] p-4" aria-current={step.state === 'current' ? 'step' : undefined}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">Adım {index + 1}</p>
            <p className="mt-1 font-semibold" style={{ color: step.state === 'upcoming' ? adminPalette.neutralText : applicationStatusColor[record.status] }}>{step.title}</p>
            <p className="mt-1 text-sm text-[#4B5563]">{step.detail}</p>
            <p className="mt-2 text-xs font-semibold">{step.state === 'done' ? 'Tamamlandı' : step.state === 'current' ? 'Şu anki aşama' : 'Henüz değil'}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function InfoGrid({ record }: { record: AdminAgentApplication }) {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <section className="surface min-w-0 p-5" aria-labelledby="app-company">
        <h3 id="app-company" className="flex items-center gap-2 font-display text-xl font-bold"><Building2 size={18} /> Firma bilgileri</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoTerm label="Firma adı" value={record.companyName} />
          <InfoTerm label="Vergi numarası" value={record.taxNumber} mono />
          <div><dt className="text-xs text-[#4B5563]">Açıklama</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-6">{record.description || 'Açıklama yok'}</dd></div>
        </dl>
      </section>
      <section className="surface min-w-0 p-5" aria-labelledby="app-person">
        <h3 id="app-person" className="flex items-center gap-2 font-display text-xl font-bold"><UserRound size={18} /> Yetkili ve başvuran</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoTerm label="Yetkili adı" value={record.authorizedFirstName} />
          <InfoTerm label="Yetkili soyadı" value={record.authorizedLastName} />
          <div>
            <dt className="text-xs text-[#4B5563]">Başvuran hesap</dt>
            <dd className="mt-1 break-words">
              <Link href={`/admin/kullanicilar/${record.user.id}`} className="font-semibold text-primary">{personName(record.user)}</Link>
              <span className="mt-1 block break-all">{record.user.email}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[#4B5563]">Firma yetkilisi ile hesap sahibi ayrı alanlardır.</p>
      </section>
      <section className="surface min-w-0 p-5" aria-labelledby="app-contact">
        <h3 id="app-contact" className="flex items-center gap-2 font-display text-xl font-bold"><Phone size={18} /> İletişim</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoTerm label="Telefon" value={record.phone} />
          <InfoTerm label="Başvuru e-postası" value={record.email} />
        </dl>
      </section>
      <section className="surface min-w-0 p-5" aria-labelledby="app-address">
        <h3 id="app-address" className="flex items-center gap-2 font-display text-xl font-bold"><MapPin size={18} /> Adres</h3>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoTerm label="Şehir" value={record.city} />
          <InfoTerm label="İlçe" value={record.district} />
          <InfoTerm label="Açık adres" value={record.address} />
        </dl>
      </section>
    </div>
  );
}

function DocumentsSection({
  record,
  documents,
  loading,
  error,
  retry,
  ratio,
  busyDoc,
  docError,
  onOpen,
}: {
  record: AdminAgentApplication;
  documents: AgentApplicationDocument[] | undefined;
  loading: boolean;
  error: string;
  retry: () => void;
  ratio: number;
  busyDoc: string | null;
  docError: string;
  onOpen: (doc: AgentApplicationDocument, mode: 'view' | 'download') => void;
}) {
  const byType = new Map((documents ?? []).map((doc) => [doc.documentType, doc]));

  return (
    <section className="surface min-w-0 p-5" aria-labelledby="app-documents">
      <h3 id="app-documents" className="flex items-center gap-2 font-display text-xl font-bold"><FileText size={18} /> Başvuru belgeleri</h3>
      <p className="mt-2 text-sm font-semibold" data-testid="text-doc-completion">
        Zorunlu belgeler: {record.documentCompletion.completedCount}/{record.documentCompletion.requiredCount} · %{ratio}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f4f3ed]" aria-hidden>
        <div className="h-full" style={{ width: `${ratio}%`, background: record.documentCompletion.isComplete ? adminPalette.positive : adminPalette.pending }} />
      </div>
      <p className="mt-2 text-xs text-[#4B5563]">Yüklenmiş belge, içeriğin geçerli veya onaylanmış olduğu anlamına gelmez.</p>
      {loading ? <div className="skeleton mt-4 h-24" /> : error ? (
        <div className="mt-4"><ChartMessage title="Belgeler yüklenemedi" text={error} action={<button type="button" onClick={retry} className="mt-3 text-sm font-bold text-primary">Yeniden dene</button>} /></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {requiredTypes.map((type) => {
            const doc = byType.get(type);
            return <DocumentCard key={type} type={type} doc={doc} busy={busyDoc === doc?.id} onOpen={onOpen} />;
          })}
        </div>
      )}
      {docError && <p role="alert" className="mt-3 text-sm text-destructive" data-testid="text-admin-doc-error">{docError}</p>}
    </section>
  );
}

function DocumentCard({
  type,
  doc,
  busy,
  onOpen,
}: {
  type: AgentDocumentType;
  doc: AgentApplicationDocument | undefined;
  busy: boolean;
  onOpen: (doc: AgentApplicationDocument, mode: 'view' | 'download') => void;
}) {
  const viewable = doc ? doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf' : false;

  return (
    <article className="min-w-0 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: doc ? adminPalette.positive : adminPalette.pending }}><FileText size={18} /></span>
        <div className="min-w-0">
          <h4 className="font-semibold">{labels[type] || type}</h4>
          <p className="text-sm" style={{ color: doc ? adminPalette.positive : adminPalette.pending }}>{doc ? 'Yüklendi' : 'Yüklenmemiş'}</p>
        </div>
      </div>
      {doc ? (
        <>
          <p className="mt-3 break-all text-sm">{doc.originalName}</p>
          <p className="text-xs text-[#4B5563]">{formatUtcDate(doc.createdAt)} · {(doc.sizeBytes / 1024).toFixed(1)} KB</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {viewable && <button type="button" className="h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => onOpen(doc, 'view')}>{busy ? 'Açılıyor…' : 'Görüntüle'}</button>}
            <button type="button" className="h-10 rounded-lg bg-primary px-3 text-sm font-bold text-white disabled:opacity-60" data-testid={`button-admin-download-${type}`} disabled={busy} onClick={() => onOpen(doc, 'download')}>{busy ? 'İndiriliyor…' : 'İndir'}</button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-[#4B5563]">Bu zorunlu belge henüz yok.</p>
      )}
    </article>
  );
}

function DecisionPanel({
  record,
  canDecide,
  message,
  errorMsg,
  deciding,
  onApprove,
  onReject,
}: {
  record: AdminAgentApplication;
  canDecide: boolean;
  message: string;
  errorMsg: string;
  deciding: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <aside className="surface h-fit min-w-0 p-5" aria-labelledby="app-decision">
      <h3 id="app-decision" className="flex items-center gap-2 font-display text-xl font-bold"><ShieldCheck size={18} /> İnceleme kararı</h3>
      <dl className="mt-4 grid gap-3 text-sm">
        <InfoTerm label="Sonuç" value={statusLabels[record.status]} />
        <InfoTerm label="İnceleyen" value={record.reviewedBy ? personName(record.reviewedBy) : 'Kayıtlı inceleyen yok'} />
        <InfoTerm label="Karar tarihi" value={record.reviewedAt ? formatUtcDate(record.reviewedAt) : 'Henüz karar yok'} />
      </dl>
      {record.rejectionReason && <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-rose-50 p-3 text-sm text-rose-800" data-testid="text-rejection-reason"><b>Ret gerekçesi:</b> {record.rejectionReason}</p>}
      {record.agentProfile && (
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="font-semibold">{record.agentProfile.companyName}</p>
          <p className="text-sm text-[#4B5563]">Profil {record.agentProfile.isActive ? 'aktif' : 'pasif'}</p>
          <Link href={`/admin/emlakcilar/${record.agentProfile.id}`} className="mt-2 inline-flex text-sm font-bold text-primary">Emlakçı Profilini İncele</Link>
        </div>
      )}
      {canDecide ? (
        <div className="mt-4 grid gap-2">
          <button type="button" className="h-11 rounded-xl bg-primary font-bold text-white disabled:opacity-60" data-testid="button-approve-application" disabled={deciding} onClick={onApprove}>Başvuruyu onayla</button>
          <button type="button" className="h-11 rounded-xl border border-destructive/40 font-bold text-destructive disabled:opacity-60" data-testid="button-reject-application" disabled={deciding} onClick={onReject}>Başvuruyu reddet</button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#4B5563]">Bu başvuru {statusLabels[record.status]} durumunda. Onay ve ret yalnız inceleme bekleyen kayıtta açılır.</p>
      )}
      {message && <p role="status" className="mt-3 text-sm text-primary" data-testid="text-admin-app-message">{message}</p>}
      {errorMsg && <p role="alert" className="mt-3 text-sm text-destructive" data-testid="text-admin-app-error">{errorMsg}</p>}
    </aside>
  );
}

function InfoTerm({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#4B5563]">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
