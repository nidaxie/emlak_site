import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, useRoute, useSearch, Router as WouterRouter } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, type RegisterOptions } from 'react-hook-form';
import { AuthProvider, useAuth } from '@/hooks/auth-context';
import { keys, useAgent, useAgentProperties, useApplication, useApplicationDocs, useApiCities, useApiDistricts, useApiNeighborhoods, useCities, useDistricts, useFavorites, useInvalidateMarketplace, useInvalidateUserProperties, useMineProperties, useMineProperty, useMyAgentProfile, useMyUserProperties, useMyUserProperty, useNeighborhoods, useProperties, useProperty, useToggleFavorite, useAdminUsers, useAdminAgents, useAdminAgent, useAdminApps, useAdminProperties, useAdminProperty, useAdminAudit, useMe } from '@/hooks/use-api';
import { adminAgentsApi, adminPropertiesApi, agentsApi, applicationsApi, propertiesApi, propertyImagesApi, userPropertiesApi, usersApi } from '@/services/api';
import { ApiRequestError, fileUrl, request } from '@/lib/api-client';
import { EmptyState, ErrorState, labels, money, area, Pagination, PropertyCardView, SectionTitle, SkeletonGrid, inputClass } from '@/components/market-ui';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Heart, Home, MapPin, Menu, Phone, Search, ShieldCheck, SlidersHorizontal, UserRound, X } from 'lucide-react';
import type { AgentDocumentType, CreateAgentApplicationRequest, CreatePropertyRequest, MyPropertyListQuery, PropertyCard, PropertyImage, PropertyStatus, PublicPropertyListQuery, RegisterRequest, UpdateAgentProfileRequest, UpdatePropertyRequest, UserPropertyRecord } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { DATA_MODE } from '@/lib/data-mode';
import { YuvaLogo } from '@/components/yuva-logo';

const AdminUsersPanel = lazy(() =>
  import('@/components/admin/admin-users-panel').then((module) => ({
    default: module.AdminUsersPanel,
  })),
);
const AdminUserDetailPanel = lazy(() =>
  import('@/components/admin/admin-user-detail-panel').then((module) => ({
    default: module.AdminUserDetailPanel,
  })),
);
const AdminApplicationsPanel = lazy(() =>
  import('@/components/admin/admin-applications-panel').then((module) => ({
    default: module.AdminApplicationsPanel,
  })),
);
const AdminApplicationDetailPanel = lazy(() =>
  import('@/components/admin/admin-application-detail-panel').then((module) => ({
    default: module.AdminApplicationDetailPanel,
  })),
);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (failureCount, error) => !(error instanceof TypeError) && failureCount < 1, staleTime: 25000, refetchOnWindowFocus: false } } });
const showError = (e: unknown) => e instanceof TypeError ? 'API sunucusuna bağlanılamadı. Sunucu adresini, durumunu ve CORS ayarlarını kontrol edin.' : e instanceof ApiRequestError ? e.message : 'Bir sorun oluştu. Lütfen tekrar deneyin.';
function favoritesNavHref(user: { role: string } | null | undefined, isLoading: boolean, isAuthenticated: boolean) {
  if (isLoading) return '/favoriler';
  if (!isAuthenticated || !user) return `/giris?returnTo=${encodeURIComponent('/hesabim/favoriler')}`;
  return user.role === 'USER' ? '/hesabim/favoriler' : '/favoriler';
}
function platformNavItem(
  user: { role: string } | null | undefined,
  isLoading: boolean,
  isAuthenticated: boolean,
  applicationStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED',
  applicationLoading = false,
): [string, string] | null {
  if (isLoading) return null;
  if (!isAuthenticated || !user) return [`/giris?returnTo=${encodeURIComponent('/emlakci-basvuru')}`, 'Emlakçı Ol'];
  if (user.role === 'ADMIN') return ['/admin', 'Yönetim'];
  if (user.role === 'AGENT') return ['/panel', 'Emlakçı Paneli'];
  if (user.role !== 'USER') return null;
  if (applicationStatus === 'DRAFT' || applicationStatus === 'REJECTED') return ['/emlakci-basvuru', 'Emlakçı Başvurusu'];
  if (applicationStatus === 'PENDING' || applicationStatus === 'APPROVED') return ['/emlakci-basvuru', 'Başvuru Durumu'];
  return ['/emlakci-basvuru', applicationLoading ? 'Emlakçı Başvurusu' : 'Emlakçı Ol'];
}
function navItemTestId(label: string, mobile = false) {
  if (label === 'İlan Ver') return mobile ? 'link-ilan-ver-mobile' : 'link-ilan-ver';
  if (label === 'Emlakçı Ol' || label === 'Emlakçı Başvurusu' || label === 'Başvuru Durumu' || label === 'Emlakçı Paneli' || label === 'Yönetim') {
    return mobile ? 'link-platform-nav-mobile' : 'link-platform-nav';
  }
  return undefined;
}
function Header() {
  const { user, isAuthenticated, isLoading, logout } = useAuth(); const [open, setOpen] = useState(false);
  const application = useApplication(!isLoading && isAuthenticated && user?.role === 'USER');
  const agentProfile = useMyAgentProfile(!isLoading && isAuthenticated && user?.role === 'AGENT');
  const suspendedAgent = user?.role === 'AGENT' && (agentProfile.isLoading || agentProfile.data?.isActive === false);
  const platformItem = platformNavItem(user, isLoading, isAuthenticated, application.data?.status, application.isLoading);
  const ilanVerHref = isLoading
    ? '/ilan-ver'
    : !isAuthenticated || !user
      ? `/giris?returnTo=${encodeURIComponent('/ilan-ver')}`
      : user.role === 'AGENT'
        ? suspendedAgent ? null : '/panel/ilanlar/yeni'
        : user.role === 'ADMIN'
          ? null
          : '/ilan-ver';
  const navItems: [string, string][] = [['/', 'Ana Sayfa'], ['/ilanlar', 'İlanlar'], [favoritesNavHref(user, isLoading, isAuthenticated), 'Favoriler'], ...(ilanVerHref ? [[ilanVerHref, 'İlan Ver'] as [string, string]] : []), ...(platformItem ? [platformItem] : [])];
  const logoutNow = async () => { await logout(); setOpen(false); };
  return <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur"><div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
    <YuvaLogo/><nav className="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Ana menü">{navItems.map(([href, label]) => <Link key={href + label} href={href} data-testid={navItemTestId(label)} className={label === 'İlan Ver' ? 'rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground' : 'nav-link'}>{label}</Link>)}</nav>
    <div className="hidden items-center gap-3 lg:flex">{isLoading ? <div className="skeleton h-10 w-36 rounded-full" aria-hidden="true"/> : isAuthenticated && user ? <div className="relative"><button className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold" onClick={() => setOpen(!open)} data-testid="button-account-menu"><CircleUserRound size={17}/>{user.firstName || user.email || 'Hesabım'}<ChevronDown size={14}/></button>{open && <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-border bg-card p-2 shadow-xl">
      <div className="mb-1 border-b border-border px-3 py-2"><p className="truncate text-xs font-semibold text-foreground">{user.email}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{labels[user.role]}</p></div>
      {user.role === 'USER' && <><MenuLink href="/hesabim">Hesabım</MenuLink><MenuLink href="/hesabim/ilanlar">İlanlarım</MenuLink><MenuLink href="/hesabim/favoriler">Favorilerim</MenuLink><MenuLink href="/hesabim/bilgiler">Hesap Bilgilerim</MenuLink></>}
      {user.role === 'AGENT' && <><MenuLink href="/panel">Emlakçı Paneli</MenuLink><MenuLink href="/panel/ilanlar">İlanlarım</MenuLink><MenuLink href="/panel/emlakci-profili">Emlakçı Profilim</MenuLink><MenuLink href="/favoriler">Favorilerim</MenuLink></>}
      {user.role === 'ADMIN' && <><MenuLink href="/admin">Yönetim</MenuLink><MenuLink href="/admin/kullanicilar">Kullanıcılar</MenuLink><MenuLink href="/admin/basvurular">Başvurular</MenuLink></>}
      <button onClick={logoutNow} className="mt-1 w-full rounded-lg border-t border-border px-3 py-2 text-left text-sm text-destructive hover:bg-muted" data-testid="button-logout">Çıkış Yap</button></div>}</div> : <><Link href="/giris" className="rounded-xl px-4 py-2.5 text-sm font-semibold">Giriş yap</Link><Link href="/kayit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Ücretsiz kayıt</Link></>}</div>
    <button className="grid h-10 w-10 place-items-center rounded-xl border border-border lg:hidden" onClick={() => setOpen(!open)} aria-label="Menüyü aç" data-testid="button-mobile-menu">{open ? <X/> : <Menu/>}</button></div>
    {open && <div className="border-t border-border bg-background px-5 py-4 lg:hidden"><nav className="grid gap-1">{navItems.map(([href, label]) => <Link key={href + label} href={href} onClick={() => setOpen(false)} data-testid={navItemTestId(label, true)} className={label === 'İlan Ver' ? 'rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground' : 'rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted'}>{label}</Link>)}{isLoading ? null : isAuthenticated && user ? <>{user.role === 'USER' ? <><Link href="/hesabim" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Hesabım</Link><Link href="/hesabim/ilanlar" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">İlanlarım</Link><Link href="/hesabim/favoriler" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Favorilerim</Link><Link href="/hesabim/bilgiler" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Hesap Bilgilerim</Link></> : user.role === 'AGENT' ? <><Link href="/panel" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Emlakçı Paneli</Link><Link href="/panel/ilanlar" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">İlanlarım</Link><Link href="/panel/emlakci-profili" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Emlakçı Profilim</Link><Link href="/favoriler" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Favorilerim</Link></> : user.role === 'ADMIN' ? <><Link href="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Yönetim</Link><Link href="/admin/basvurular" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Başvurular</Link></> : <Link href="/profil" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Profilim</Link>}<button onClick={logoutNow} className="px-3 py-3 text-left text-sm text-destructive">Çıkış Yap</button></> : <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3"><Link href="/giris" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-center text-sm font-semibold">Giriş yap</Link><Link href="/kayit" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground">Ücretsiz kayıt</Link></div>}</nav></div>}
  </header>;
}
function MenuLink({ href, children }: { href: string; children: ReactNode }) { return <Link href={href} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">{children}</Link>; }
function Footer() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const links: [string, string][] = isLoading
    ? [['/ilanlar', 'İlanlar'], ['/nasil-ilan-verilir', 'Nasıl İlan Verilir?']]
    : !isLoading && isAuthenticated && user?.role === 'USER'
    ? [['/ilanlar', 'İlanlar'], ['/ilan-ver', 'İlan Ver'], ['/hesabim/ilanlar', 'İlanlarım'], ['/hesabim/favoriler', 'Favorilerim'], ['/hesabim', 'Hesabım']]
    : !isLoading && isAuthenticated && user?.role === 'AGENT'
      ? [['/ilanlar', 'İlanlar'], ['/panel', 'Panelim'], ['/favoriler', 'Favoriler'], ['/nasil-ilan-verilir', 'Nasıl İlan Verilir?']]
      : !isLoading && isAuthenticated && user?.role === 'ADMIN'
        ? [['/ilanlar', 'İlanlar'], ['/admin', 'Yönetim'], ['/nasil-ilan-verilir', 'Nasıl İlan Verilir?']]
        : [['/ilanlar', 'İlanlar'], [favoritesNavHref(user, isLoading, isAuthenticated), 'Favoriler'], ['/nasil-ilan-verilir', 'Nasıl İlan Verilir?'], ['/emlakci-basvuru', 'Emlakçı Ol'], ['/giris', 'Giriş yap']];
  return <footer className="mt-20 bg-[#213c38] text-white"><div className="mx-auto max-w-[1280px] px-5 py-10 lg:px-10"><div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><YuvaLogo tone="cream"/><p className="mt-2 max-w-sm text-sm leading-6 text-white/65">Yeni bir eve giden yolu biraz daha anlaşılır kılmak için buradayız.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/80" aria-label="Alt menü">{links.map(([href, label]) => <Link key={href + label} href={href} className="hover:text-white">{label}</Link>)}</nav></div><div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-white/45 sm:text-left">© Yuva · Türkiye</div></div></footer>;
}
function PublicLayout({ children }: { children: ReactNode }) { return <><Header/><main className="min-h-[65vh]">{children}</main><Footer/></>; }
function Guard({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, go] = useLocation();
  const search = useSearch();
  const currentTarget = `${location}${search ? `?${search}` : ''}`;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnTo = encodeURIComponent(currentTarget);
      go(`/giris?returnTo=${returnTo}`);
    }
  }, [isLoading, isAuthenticated, currentTarget, go]);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-6 py-16"><div className="skeleton h-48"/></div>;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    const isAgentOnApplication = location === '/emlakci-basvuru' && user.role === 'AGENT';
    return <PublicLayout><div className="mx-auto max-w-5xl px-5 py-16"><EmptyState title={isAgentOnApplication ? 'Emlak danışmanı hesabınız zaten aktif.' : 'Bu sayfaya erişim yetkiniz bulunmuyor'} text={isAgentOnApplication ? 'Başvurunuz onaylandığı için emlak danışmanı çalışma alanını kullanabilirsiniz.' : 'Hesap rolünüz bu alanı görüntülemek için uygun değil.'} href={isAgentOnApplication ? '/panel' : '/'} action={isAgentOnApplication ? 'Panelime git' : 'Ana sayfaya dön'}/></div></PublicLayout>;
  }

  return <>{children}</>;
}
function RequireAuth({ children }: { children: ReactNode }) { return <Guard>{children}</Guard>; }
function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) { return <Guard roles={roles}>{children}</Guard>; }
function HeroSearch() {
  const cities = useCities(); const [listingType,setType] = useState<'SALE'|'RENT'>('SALE'); const [city,setCity] = useState(''); const [district,setDistrict] = useState(''); const [propertyType,setPropertyType] = useState('');
  const selectedCity = cities.data?.find(item => item.name === city);
  const districts = useDistricts(selectedCity?.id ?? '');
  const [,go] = useLocation();
  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const p = new URLSearchParams(); p.set('listingType',listingType); if(city) p.set('city',city); if(district) p.set('district',district); if(propertyType) p.set('propertyType',propertyType); go(`/ilanlar?${p.toString()}`); };
  return <form onSubmit={search} aria-label="İlan arama" className="home-search-card surface relative z-10 mx-auto mt-8 max-w-[1280px] rounded-2xl border border-[#e5e2d8] p-4 sm:p-5 md:p-6">
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Aramanızı başlatın</p><p className="mt-1 text-sm text-muted-foreground">Size uygun yaşam alanını birkaç adımda bulun.</p></div>
      <div className="home-search-tabs" role="group" aria-label="İlan türü">
        {([['SALE','Satılık'],['RENT','Kiralık']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={listingType===value} onClick={()=>setType(value)} className={listingType===value?'home-search-tab is-active':'home-search-tab'}>{label}</button>)}
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_132px]">
      <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">Şehir<select aria-label="Şehir" className={inputClass} value={city} onChange={e=>{setCity(e.target.value);setDistrict('');}}><option value="">Tüm şehirler</option>{cities.data?.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">İlçe<select aria-label="İlçe" className={inputClass} value={district} disabled={!selectedCity||districts.isLoading||!districts.data?.length} onChange={e=>setDistrict(e.target.value)}><option value="">{!selectedCity?'Önce şehir seçin':districts.isLoading?'İlçeler yükleniyor…':districts.data?.length?'Tüm ilçeler':'İlçe verisi yok'}</option>{districts.data?.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">Emlak tipi<select aria-label="Emlak tipi" className={inputClass} value={propertyType} onChange={e=>setPropertyType(e.target.value)}><option value="">Tüm emlak tipleri</option>{['APARTMENT','HOUSE','VILLA','LAND','WORKPLACE'].map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
      <button type="submit" className="mt-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-[#194d44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:col-span-2 xl:col-span-1" data-testid="button-hero-search"><Search size={17}/>İlan ara</button>
    </div>
  </form>;
}
function HeroSpotlight({ property }: { property?: PropertyCard }) {
  const image = fileUrl(property?.coverImageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [image]);
  return <div className="home-hero-visual">
    {image && !imageFailed ? <img src={image} alt={property?.title || 'Güncel konut ilanı'} onError={() => setImageFailed(true)} className="h-full w-full object-cover"/> : <div className="home-hero-image-fallback"><Home size={58} strokeWidth={1.1}/></div>}
    <div className="home-hero-image-shade"/>
    {property && <div className="home-hero-spotlight"><span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"><BadgeCheck size={13}/> Yuva’dan bir keşif</span><Link href={`/ilan/${property.id}`} className="group/spotlight flex items-center justify-between gap-3 text-white"><span className="line-clamp-2 font-display text-xl font-bold leading-snug md:text-2xl">{property.title}</span><ArrowRight className="shrink-0 transition-transform group-hover/spotlight:translate-x-1"/></Link><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-3 text-sm text-white/80"><span className="flex items-center gap-1.5"><MapPin size={14}/>{property.neighborhood}, {property.city}</span><strong className="text-base text-white">{money(property.price)}</strong></div></div>}
  </div>;
}
const featuredCityPhoto: Record<string, string> = {
  Konya: '/cities/konya.jpg',
  İstanbul: '/cities/istanbul-bogaz.jpg',
  Ankara: '/cities/ankara.jpg',
};
function HomeCityCard({ city, property, photo }: { city: { id: string; name: string }; property?: PropertyCard; photo?: string }) {
  const image = photo || fileUrl(property?.coverImageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [image]);
  return <Link href={`/ilanlar?city=${encodeURIComponent(city.name)}`} className="home-city-card group" aria-label={`${city.name} ilanlarını keşfet`}>
    {image && !imageFailed ? <img src={image} alt={`${city.name} gayrimenkul ilanlarından bir görünüm`} onError={()=>setImageFailed(true)} className="home-city-image"/> : <span className="home-city-image-fallback" aria-hidden="true"><Building2 size={25}/></span>}
    <span className="home-city-overlay" aria-hidden="true"/>
    <span className="home-city-copy"><small>ŞEHRİ KEŞFET</small><b>{city.name}</b></span><ArrowRight size={18} className="home-city-arrow" aria-hidden="true"/>
  </Link>;
}
function HomePage() {
  const q = useProperties({ page: 1, limit: 9, sort: 'newest' }); const cities = useCities();
  const listings = q.data?.items ?? []; const spotlight = listings[0]; const newest = listings.slice(0, 6);
  return <PublicLayout><section className="home-hero relative"><div className="relative mx-auto max-w-[1440px] px-5 pb-10 pt-10 md:pb-12 md:pt-14 lg:px-10 lg:pb-14 lg:pt-16"><div className="grid items-center gap-8 lg:grid-cols-[minmax(0,.92fr)_minmax(440px,1.08fr)] lg:gap-14"><div className="max-w-2xl"><p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#45675b]"><ShieldCheck size={15}/> YUVA · Yeni yaşam alanları</p><h1 className="mt-5 font-display text-[2.65rem] font-extrabold leading-[1.05] tracking-[-.045em] text-[#203b34] sm:text-5xl xl:text-[3.65rem]">Size ait bir yer,<br/><span className="text-[#315f50]">yeni bir başlangıç.</span></h1><p className="mt-5 max-w-lg text-base leading-7 text-[#56665e] md:text-lg">Satılık ve kiralık evleri keşfedin, size en uygun yaşam alanını bulun.</p><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#365a50]"><span className="inline-flex items-center gap-2"><MapPin size={16}/> Şehir ve ilçe seçimi</span><span className="inline-flex items-center gap-2"><Building2 size={16}/> Farklı emlak türleri</span></div></div><HeroSpotlight property={spotlight}/></div><HeroSearch/></div></section>
    <section className="home-section mx-auto max-w-[1440px] px-5 py-14 md:py-16 lg:px-10 lg:py-20"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><SectionTitle eyebrow="YUVA · güncel portföy" title="Yeni İlanlar" description={DATA_MODE==='mock'?'Örnek portföydeki yeni ilanları keşfedin.':'Piyasaya yeni eklenen yaşam alanlarına göz atın.'}/><Link href="/ilanlar?sort=newest" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-primary">Tüm ilanlar <ArrowRight size={16}/></Link></div>{q.isLoading?<SkeletonGrid/>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:newest.length?<div className="home-property-grid grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">{newest.map(p=><PropertyCardView key={p.id} property={p}/>)}</div>:<EmptyState title="Henüz ilan yok" text="Yeni ilanlar eklendiğinde burada görebilirsiniz." href="/ilanlar" action="İlanları keşfet"/>}</section>
    <section className="home-cities border-y border-[#e4e0d5] bg-[#f1eee5]"><div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-10 lg:py-16"><SectionTitle eyebrow="Lokasyona göre keşfet" title="Şehirlere Göre Keşfet" description="Şehir seçin, o bölgedeki gayrimenkul ilanlarını inceleyin."/><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">{cities.isLoading?[1,2,3].map(i=><span className="skeleton h-36 rounded-xl" key={i}/>):cities.error?<ErrorState retry={()=>cities.refetch()} message={showError(cities.error)}/>:['Konya','İstanbul','Ankara'].flatMap(name=>{const city=cities.data?.find(item=>item.name===name);return city?[city]:[];}).map(city=><HomeCityCard key={city.id} city={city} photo={featuredCityPhoto[city.name]} property={listings.find(item=>item.city===city.name)}/>)}</div></div></section>
    <section className="mx-auto max-w-[1440px] px-5 py-14 md:py-16 lg:px-10 lg:py-20"><div className="home-agent-cta relative overflow-hidden rounded-2xl bg-[#173d32] px-6 py-9 text-white md:px-12 md:py-12"><div className="cta-circle"/><div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="max-w-2xl"><p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#c8dbcf]">Emlakçılar ve ev sahipleri için</p><h2 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">Gayrimenkulünüzü doğru kişilerle buluşturun.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/75 md:text-base">Evinizi satmak veya kiralamak için ilan verin. Emlakçılar başvuru sonrası panelden ilan yönetmeye devam eder.</p></div><div className="relative flex flex-col gap-3 sm:flex-row"><Link href="/ilan-ver" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-5 font-semibold text-white transition-colors hover:bg-white/10" data-testid="link-home-ilan-ver">İlan Ver <ArrowRight size={17}/></Link><Link href="/nasil-ilan-verilir?audience=advisor" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f0cf9c] px-5 font-bold text-[#253b35] transition-colors hover:bg-[#f6ddb4]">Emlakçı süreci <ArrowRight size={17}/></Link></div></div></div></section>
  </PublicLayout>;
}

function ListingPage() {
  const [, go] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initial = useMemo(() => Object.fromEntries(params.entries()), [search]);
  const [filters, setFilters] = useState<Record<string, string>>(initial);
  const [mobileFilter, setMobileFilter] = useState(false);

  useEffect(() => setFilters(initial), [initial]);
  useEffect(() => {
    if (!mobileFilter) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFilter(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileFilter]);

  const page = Number(params.get('page') || 1);
  const query: PublicPropertyListQuery = {
    page,
    limit: 12,
    ...(initial.listingType ? { listingType: initial.listingType as 'SALE' | 'RENT' } : {}),
    ...(initial.propertyType ? { propertyType: initial.propertyType as PublicPropertyListQuery['propertyType'] } : {}),
    ...(initial.city ? { city: initial.city } : {}),
    ...(initial.district ? { district: initial.district } : {}),
    ...(initial.neighborhood ? { neighborhood: initial.neighborhood } : {}),
    ...(initial.minPrice ? { minPrice: initial.minPrice } : {}),
    ...(initial.maxPrice ? { maxPrice: initial.maxPrice } : {}),
    ...(initial.rooms ? { rooms: Number(initial.rooms) } : {}),
    ...(initial.livingRooms ? { livingRooms: Number(initial.livingRooms) } : {}),
    ...(initial.minArea ? { minArea: initial.minArea } : {}),
    ...(initial.maxArea ? { maxArea: initial.maxArea } : {}),
    sort: (initial.sort || 'newest') as PublicPropertyListQuery['sort'],
  };
  const results = useProperties(query);
  const cities = useCities();
  const selectedCity = cities.data?.find(city => city.name === filters.city);
  const districts = useDistricts(selectedCity?.id || '');
  const selectedDistrict = districts.data?.find(district => district.name === filters.district);
  const hoods = useNeighborhoods(selectedDistrict?.id || '');

  const apply = (nextPage = 1, nextFilters: Record<string, string> = filters) => {
    const next = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value && key !== 'page') next.set(key, value);
    });
    if (nextPage > 1) next.set('page', String(nextPage));
    const queryString = next.toString();
    setFilters(nextFilters);
    go(queryString ? '/ilanlar?' + queryString : '/ilanlar');
    setMobileFilter(false);
  };
  const change = (key: string, value: string) => setFilters(previous => ({
    ...previous,
    [key]: value,
    ...(key === 'city' ? { district: '', neighborhood: '' } : {}),
    ...(key === 'district' ? { neighborhood: '' } : {}),
  }));
  const clearFilters = () => apply(1, {});
  const filterKeys = ['listingType', 'propertyType', 'city', 'district', 'neighborhood', 'minPrice', 'maxPrice', 'rooms', 'livingRooms', 'minArea', 'maxArea'];
  const activeFilters = filterKeys.flatMap(key => initial[key] ? [{ key, value: initial[key] }] : []);
  const chipLabel = (key: string, value: string) => {
    const formatted = Number(value).toLocaleString('tr-TR');
    if (key === 'minPrice') return 'En az ₺' + formatted;
    if (key === 'maxPrice') return 'En çok ₺' + formatted;
    if (key === 'minArea') return 'En az ' + formatted + ' m²';
    if (key === 'maxArea') return 'En çok ' + formatted + ' m²';
    if (key === 'rooms') return value + ' oda';
    if (key === 'livingRooms') return value + ' salon';
    if (key === 'listingType' || key === 'propertyType') return labels[value] || value;
    return value;
  };
  const removeFilter = (key: string) => {
    const next = { ...initial };
    delete next[key];
    if (key === 'city') {
      delete next.district;
      delete next.neighborhood;
    }
    if (key === 'district') delete next.neighborhood;
    apply(1, next);
  };

  const filterPanel = (
    <form className="filter-panel surface h-fit p-5" onSubmit={event => { event.preventDefault(); apply(); }}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Filtreler</h2>
        <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={clearFilters}>Temizle</button>
      </div>
      <div className="filter-panel-fields">
      <FilterSelect label="İlan türü" value={filters.listingType || ''} onChange={value => change('listingType', value)} options={[["SALE", "Satılık"], ["RENT", "Kiralık"]]} empty="Satılık veya kiralık" />
      <FilterSelect label="Emlak tipi" value={filters.propertyType || ''} onChange={value => change('propertyType', value)} options={['APARTMENT', 'HOUSE', 'VILLA', 'LAND', 'WORKPLACE'].map(key => [key, labels[key]])} empty="Tüm emlak tipleri" />
      <FilterSelect label="Şehir" value={filters.city || ''} onChange={value => change('city', value)} options={(cities.data || []).map(city => [city.name, city.name])} empty="Tüm şehirler" />
      <FilterSelect label="İlçe" value={filters.district || ''} onChange={value => change('district', value)} options={(districts.data || []).map(district => [district.name, district.name])} empty="Tüm ilçeler" disabled={!selectedCity} />
      <FilterSelect label="Mahalle" value={filters.neighborhood || ''} onChange={value => change('neighborhood', value)} options={(hoods.data || []).map(neighborhood => [neighborhood.name, neighborhood.name])} empty="Tüm mahalleler" disabled={!selectedDistrict} />
      <FilterRange label="Fiyat aralığı (₺)" min={filters.minPrice || ''} max={filters.maxPrice || ''} onMin={value => change('minPrice', value)} onMax={value => change('maxPrice', value)} />
      <div className="grid grid-cols-2 gap-x-3">
        <FilterSelect label="Oda sayısı" value={filters.rooms || ''} onChange={value => change('rooms', value)} options={['1', '2', '3', '4', '5'].map(value => [value, value + ' oda'])} empty="Fark etmez" />
        <FilterSelect label="Salon sayısı" value={filters.livingRooms || ''} onChange={value => change('livingRooms', value)} options={['0', '1', '2', '3'].map(value => [value, value + ' salon'])} empty="Fark etmez" />
      </div>
      <FilterRange label="Brüt alan (m²)" min={filters.minArea || ''} max={filters.maxArea || ''} onMin={value => change('minArea', value)} onMax={value => change('maxArea', value)} />
      </div>
      <div className="filter-panel-actions"><button type="submit" className="mt-1 h-11 w-full rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-[#194d44]">Sonuçları göster</button></div>
    </form>
  );

  return <PublicLayout>
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:py-10 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">YUVA’da keşfedin</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Emlak ilanları</h1>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {results.isLoading ? 'İlanlar aranıyor…' : results.data ? results.data.total.toLocaleString('tr-TR') + ' ilan bulundu' : results.error ? 'Sonuçlar yüklenemedi' : '— ilan bulundu'}
          </p>
        </div>
        <div className="listing-toolbar">
          <button className="filter-mobile-button" aria-haspopup="dialog" aria-expanded={mobileFilter} onClick={() => setMobileFilter(true)}>
            <SlidersHorizontal size={16} />Filtrele{activeFilters.length > 0 && <span className="filter-count">{activeFilters.length}</span>}
          </button>
          <label className="text-sm text-muted-foreground">Sırala
            <select aria-label="İlanları sırala" className={inputClass + ' mt-1 min-w-44'} value={initial.sort || 'newest'} onChange={event => apply(1, { ...filters, sort: event.target.value })}>
              <option value="newest">En yeni</option>
              <option value="price_asc">Fiyat: artan</option>
              <option value="price_desc">Fiyat: azalan</option>
            </select>
          </label>
        </div>
      </div>

      {activeFilters.length > 0 && <div className="active-filter-list" aria-label="Uygulanan filtreler">
        <span className="active-filter-heading">Uygulanan filtreler</span>
        {activeFilters.map(({ key, value }) => <button key={key} type="button" className="active-filter-chip" aria-label={chipLabel(key, value) + ' filtresini kaldır'} onClick={() => removeFilter(key)}>{chipLabel(key, value)}<X size={14} /></button>)}
        <button type="button" className="clear-active-filters" onClick={clearFilters}>Tümünü temizle</button>
      </div>}

      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7">
        <aside className="hidden lg:block">{filterPanel}</aside>
        <section aria-label="İlan sonuçları" aria-busy={results.isLoading}>
          {results.isLoading ? <SkeletonGrid /> : results.error ? <ErrorState retry={() => results.refetch()} message={showError(results.error)} /> : results.data?.items.length ? <>
            <div className="home-property-grid grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.data.items.map(property => <PropertyCardView key={property.id} property={property} />)}
            </div>
            <Pagination page={results.data.page} limit={results.data.limit} total={results.data.total} onChange={nextPage => apply(nextPage, initial)} />
          </> : <div className="surface flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e9eee8] text-primary"><Search size={21} /></span>
            <h2 className="mt-4 font-display text-xl font-bold">Aramanıza uygun ilan bulunamadı</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Fiyat, konum veya oda tercihlerinizi değiştirip yeniden deneyin.</p>
            {activeFilters.length > 0 ? <button type="button" className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white" onClick={clearFilters}>Filtreleri temizle</button> : <Link href="/" className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Yeni arama yap</Link>}
          </div>}
        </section>
      </div>

      {mobileFilter && <div className="filter-backdrop fixed inset-0 z-50 flex items-end bg-black/40 p-3 lg:hidden" onClick={() => setMobileFilter(false)}>
        <div role="dialog" aria-modal="true" aria-label="İlan filtreleri" className="filter-mobile-panel max-h-[90dvh] w-full overflow-auto rounded-2xl bg-background" onClick={event => event.stopPropagation()}>
          <div className="flex justify-end px-4 pt-3"><button type="button" onClick={() => setMobileFilter(false)} aria-label="Filtre panelini kapat" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"><X size={19} /></button></div>
          {filterPanel}
        </div>
      </div>}
    </div>
  </PublicLayout>;
}
function FilterSelect({label,value,onChange,options,empty='Seçin',disabled=false,compact=false}:{label:string;value:string;onChange:(v:string)=>void;options:string[][];empty?:string;disabled?:boolean;compact?:boolean}) { return <label className={compact?'grid min-w-0 gap-1.5 text-sm font-semibold':'mb-4 block text-xs font-semibold text-muted-foreground'}>{label}<select className={inputClass+(compact?' min-w-0':' mt-1.5')} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>; }
function FilterRange({label,min,max,onMin,onMax}:{label:string;min:string;max:string;onMin:(v:string)=>void;onMax:(v:string)=>void}) { return <fieldset className="mb-4"><legend className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</legend><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="any" className={inputClass} placeholder="Minimum" aria-label={label + ' minimum'} inputMode="decimal" value={min} onChange={e=>onMin(e.target.value)}/><input type="number" min="0" step="any" className={inputClass} placeholder="Maksimum" aria-label={label + ' maksimum'} inputMode="decimal" value={max} onChange={e=>onMax(e.target.value)}/></div></fieldset>; }

function PropertyDetailPage() {
  const [match,params]=useRoute('/ilan/:id'); const id=params?.id||''; const q=useProperty(id); const [imageIndex,setImageIndex]=useState(0); const [lightbox,setLightbox]=useState(false); const [imageError,setImageError]=useState<string|null>(null); const {isAuthenticated}=useAuth(); const [location,go]=useLocation(); const search=useSearch(); const fav=useToggleFavorite();
  const currentTarget = `${location}${search ? `?${search}` : ''}`;
  useEffect(()=>setImageError(null),[q.data?.images[imageIndex]?.url,q.data?.coverImageUrl]);
  if(!match)return null;
  if(q.isLoading)return <PublicLayout><div className="mx-auto max-w-6xl p-8"><div className="skeleton h-[420px] rounded-3xl"/><div className="skeleton mt-8 h-32"/></div></PublicLayout>;
  if(q.error){const notFound=(q.error instanceof ApiRequestError&&(q.error.status===404||q.error.status===400))||(DATA_MODE==='mock'&&q.error instanceof Error&&q.error.message==='Demo ilanı bulunamadı.');return <PublicLayout><div className="mx-auto max-w-5xl px-5 py-16">{notFound?<EmptyState title="İlan bulunamadı" text="Bu ilan mevcut değil veya yayından kaldırılmış olabilir." href="/ilanlar" action="İlanlara dön"/>:<ErrorState message={showError(q.error)}/>}</div></PublicLayout>;}
  const p=q.data; if(!p)return null; const images=p.images.slice().sort((a,b)=>a.sortOrder-b.sortOrder); const src=fileUrl(images[imageIndex]?.url || p.coverImageUrl); const imageAvailable=!!src&&imageError!==src;
  const facts=([['Oda',`${p.rooms}+${p.livingRooms}`],['Brüt alan',`${area(p.grossAreaM2)} m²`],['Net alan',p.netAreaM2?`${area(p.netAreaM2)} m²`:'—'],['Bina yaşı',p.buildingAge??'—'],['Bulunduğu kat',p.floor??'—'],['Toplam kat',p.totalFloors??'—'],['Isıtma',p.heatingType?labels[p.heatingType]:'—'],['Eşyalı',p.isFurnished?'Evet':'Hayır'],['Balkon',p.hasBalcony?'Var':'Yok'],['Asansör',p.hasElevator?'Var':'Yok'],['Otopark',p.hasParking?'Var':'Yok'],['Site içinde',p.inSite?'Evet':'Hayır']] as const).filter(([key])=>p.propertyType!=='LAND'||!['Oda','Bulunduğu kat','Toplam kat','Isıtma','Asansör'].includes(key));
  return <PublicLayout><div className="mx-auto max-w-[1280px] px-5 py-8"><Link href="/ilanlar" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16}/> İlanlara dön</Link><div className="grid gap-8 lg:grid-cols-[1.45fr_.8fr]"><section><div className="detail-image relative overflow-hidden rounded-[1.5rem] bg-muted">{imageAvailable?<img src={src!} alt={p.title} role="button" tabIndex={0} onClick={()=>setLightbox(true)} onError={()=>setImageError(src)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setLightbox(true);}}} className="h-full w-full cursor-zoom-in object-cover"/>:<div className="property-image-fallback grid h-full min-h-[340px] place-items-center" role="img" aria-label="İlan görseli kullanılamıyor"><Home size={58} className="text-emerald-900/30"/></div>}{images.length>1&&<div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between"><button className="gallery-arrow" onClick={()=>setImageIndex((imageIndex-1+images.length)%images.length)} aria-label="Önceki fotoğraf"><ChevronLeft/></button><button className="gallery-arrow" onClick={()=>setImageIndex((imageIndex+1)%images.length)} aria-label="Sonraki fotoğraf"><ChevronRight/></button></div>}<span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{images.length?`${imageIndex+1} / ${images.length}`:'Fotoğraf bulunmuyor'}</span></div>{images.length>1&&<div className="mt-3 flex gap-2 overflow-x-auto">{images.map((im,i)=><button key={im.id} className={`h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 ${i===imageIndex?'border-primary':'border-transparent'}`} onClick={()=>setImageIndex(i)}><img src={fileUrl(im.url)||''} alt={`${p.title} ${i+1}`} onError={e=>{e.currentTarget.style.opacity='0';}} className="h-full w-full object-cover"/></button>)}</div>}
      {lightbox&&imageAvailable&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#14211e]/95 p-4" role="dialog" aria-modal="true" aria-label="İlan fotoğrafı görüntüleyici" onClick={()=>setLightbox(false)}><button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white" aria-label="Görüntüleyiciyi kapat" onClick={()=>setLightbox(false)}><X/></button>{images.length>1&&<button className="gallery-arrow absolute left-4 top-1/2 -translate-y-1/2" onClick={e=>{e.stopPropagation();setImageIndex((imageIndex-1+images.length)%images.length);}} aria-label="Önceki fotoğraf"><ChevronLeft/></button>}<img src={src!} alt={p.title} className="max-h-[88dvh] max-w-[92vw] rounded-lg object-contain" onError={()=>setImageError(src)} onClick={e=>e.stopPropagation()}/>{images.length>1&&<button className="gallery-arrow absolute right-4 top-1/2 -translate-y-1/2" onClick={e=>{e.stopPropagation();setImageIndex((imageIndex+1)%images.length);}} aria-label="Sonraki fotoğraf"><ChevronRight/></button>}</div>}
      <div className="mt-10"><SectionTitle eyebrow="İlan detayları" title="Öne çıkan özellikler"/><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{facts.map(([key,val])=><div key={key} className="rounded-xl bg-card p-4"><p className="text-xs text-muted-foreground">{key}</p><p className="mt-1 font-semibold">{val}</p></div>)}</div></div><div className="mt-10"><SectionTitle title="Açıklama"/><p className="whitespace-pre-line leading-7 text-muted-foreground">{p.description}</p></div><div className="mt-10"><SectionTitle title="Konum"/><div className="surface p-5"><p className="flex items-center gap-2 font-semibold"><span className="text-primary"><Home size={17}/></span>{p.neighborhood}, {p.district}, {p.city}</p><p className="mt-2 text-sm text-muted-foreground">{p.address}</p>{p.latitude && p.longitude ? <p className="mt-3 text-xs text-muted-foreground">Konum koordinatları: {p.latitude}, {p.longitude}</p> : null}</div></div></section>
      <aside><div className="surface sticky top-28 p-6"><div className="flex items-center justify-between"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">{labels[p.listingType]} · {labels[p.propertyType]}</span><button type="button" disabled={fav.isPending} onClick={()=>isAuthenticated?fav.mutate({id:p.id,favorite:p.isFavorite}):go(`/giris?returnTo=${encodeURIComponent(currentTarget)}`)} aria-label={p.isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={p.isFavorite} data-testid={`button-detail-favorite-${p.id}`} className={`grid h-10 w-10 place-items-center rounded-full bg-muted ${p.isFavorite?'text-rose-600':''}`}><Heart fill={p.isFavorite?'currentColor':'none'}/></button></div><p className="mt-5 font-display text-4xl font-extrabold text-primary">{money(p.price)}</p><h1 className="mt-3 font-display text-2xl font-bold leading-snug">{p.title}</h1><p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">{p.neighborhood}, {p.district}, {p.city}</p><div className={`my-5 grid border-y border-border py-4 text-center ${p.propertyType==='LAND'?'grid-cols-2':'grid-cols-3'}`}>{p.propertyType!=='LAND'&&<span><b className="block">{p.rooms}+{p.livingRooms}</b><small className="text-xs text-muted-foreground">Oda</small></span>}<span><b className="block">{area(p.grossAreaM2)} m²</b><small className="text-xs text-muted-foreground">Brüt</small></span><span><b className="block">{p.buildingAge??'—'}</b><small className="text-xs text-muted-foreground">Bina yaşı</small></span></div><div className="flex items-center gap-3 rounded-xl bg-muted/70 p-4"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-primary">{p.agent?.logoUrl&&fileUrl(p.agent.logoUrl)?<img src={fileUrl(p.agent.logoUrl)!} alt="" className="h-full w-full object-cover"/>:<Building2 size={22}/>}</div><div className="min-w-0 flex-1">{p.agent?<><Link href={`/emlakci/${p.agent.slug}`} className="block truncate font-bold hover:text-primary">{p.agent.companyName}</Link><Link href={`/emlakci/${p.agent.slug}`} className="text-xs text-primary">Emlakçı profili</Link></>:<><p className="truncate font-bold">{p.sellerDisplayName}</p><p className="text-xs text-muted-foreground">Bireysel ilan</p></>}</div></div>{p.agent?<a href={`tel:${p.agent.phone}`} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"><Phone size={17}/> {p.agent.phone}</a>:<p className="mt-4 rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">İletişim bilgisi bu ilanda yayımlanmıyor.</p>}<p className="mt-3 text-center text-[11px] text-muted-foreground">{p.agent?'İlan hakkında bilgi almak için emlakçıyla iletişime geçin.':'Bireysel ilan sahibi.'}</p></div></aside></div></div></PublicLayout>;
}

function AgentPage() {
  const [match,params]=useRoute('/emlakci/:slug'); const slug=params?.slug||''; const [page,setPage]=useState(1); const agent=useAgent(slug); const listings=useAgentProperties(slug,{page,limit:12,sort:'newest'});
  useEffect(()=>setPage(1),[slug]);
  if(!match)return null;
  if(agent.isLoading)return <PublicLayout><div className="mx-auto max-w-6xl p-8"><div className="skeleton h-52 rounded-3xl"/><div className="mt-8"><SkeletonGrid/></div></div></PublicLayout>;
  if(agent.error||!agent.data){const notFound=(agent.error instanceof ApiRequestError&&agent.error.status===404)||(DATA_MODE==='mock'&&agent.error instanceof Error&&agent.error.message==='Demo emlakçı profili bulunamadı.');return <PublicLayout><div className="mx-auto max-w-5xl px-5 py-16">{notFound?<EmptyState title="Emlakçı profili bulunamadı" text="Bu emlakçı profili mevcut değil veya yayında değil." href="/ilanlar" action="İlanlara dön"/>:<ErrorState retry={()=>agent.refetch()} message={showError(agent.error)}/>}</div></PublicLayout>;}
  const a=agent.data;
  return <PublicLayout><div className="mx-auto max-w-[1280px] px-5 py-10"><div className="agent-cover surface relative overflow-hidden p-7 md:p-10"><div className="absolute -right-12 -top-24 h-80 w-80 rounded-full border-[1px] border-[#d4e1d5]"/><div className="relative flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.5rem] bg-[#e5eee6] text-primary">{a.logoUrl&&fileUrl(a.logoUrl)?<img src={fileUrl(a.logoUrl)!} alt={`${a.companyName} logosu`} className="h-full w-full object-cover"/>:<Building2 size={38}/>}</div><div className="flex-1"><div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary"><BadgeCheck size={14}/> Emlakçı profili</div><h1 className="font-display text-4xl font-extrabold">{a.companyName}</h1><p className="mt-2 text-muted-foreground">{a.city}, {a.district}</p></div><a href={`tel:${a.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white"><Phone size={17}/>{a.phone}</a></div><div className="relative mt-8 grid gap-5 border-t border-border pt-6 md:grid-cols-3"><div><small className="text-xs text-muted-foreground">E-posta</small><a className="mt-1 block font-semibold" href={`mailto:${a.email}`}>{a.email}</a></div><div><small className="text-xs text-muted-foreground">Konum</small><p className="mt-1 font-semibold">{a.city}, {a.district}</p></div><div><small className="text-xs text-muted-foreground">Hakkında</small><p className="mt-1 text-sm leading-6">{a.description||'Emlakçı hakkında açıklama eklenmemiş.'}</p></div></div></div>
  <div className="mt-12"><SectionTitle eyebrow="Portföy" title={`${a.companyName} ilanları`} description="Emlakçı tarafından yayında tutulan ilanlar."/>
    {listings.isLoading?<SkeletonGrid/>:listings.error?<ErrorState retry={()=>listings.refetch()} message={showError(listings.error)}/>:listings.data?.items.length?<><div className="home-property-grid grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.data.items.map(p=><PropertyCardView key={p.id} property={p}/>)}</div><Pagination page={listings.data.page} limit={listings.data.limit} total={listings.data.total} onChange={setPage}/></>:<EmptyState title="Yayında ilan bulunmuyor" text="Bu emlakçının şu anda görüntülenebilir ilanı yok."/>}
  </div></div></PublicLayout>;
}

function AuthPage({mode}:{mode:'login'|'register'}) {
  const isLogin=mode==='login'; const {user,isAuthenticated,isLoading,login,register}=useAuth(); const [,go]=useLocation(); const search=useSearch(); const [error,setError]=useState(''); const [success,setSuccess]=useState(false);
  const rawReturnTo=new URLSearchParams(search).get('returnTo');
  const safeReturnTo=rawReturnTo&&rawReturnTo.startsWith('/')&&!rawReturnTo.startsWith('//')&&!rawReturnTo.startsWith('/giris')&&!rawReturnTo.startsWith('/kayit')?rawReturnTo:null;
  const loginHref=safeReturnTo?`/giris?returnTo=${encodeURIComponent(safeReturnTo)}`:'/giris';
  const registerHref=safeReturnTo?`/kayit?returnTo=${encodeURIComponent(safeReturnTo)}`:'/kayit';
  useEffect(()=>{if(!isLoading&&isAuthenticated&&user){go(safeReturnTo||(user.role==='ADMIN'?'/admin':user.role==='AGENT'?'/panel':'/'));}},[isLoading,isAuthenticated,user,safeReturnTo,go]);
  const form=useForm<RegisterRequest>({defaultValues:{email:'',password:'',firstName:'',lastName:'',phone:''}});
  const onSubmit=form.handleSubmit(async values=>{setError('');try{if(isLogin){const res=await login({email:values.email.trim(),password:values.password});go(safeReturnTo||(res.user.role==='ADMIN'?'/admin':res.user.role==='AGENT'?'/panel':'/'));}else{const body:RegisterRequest={email:values.email.trim(),password:values.password,...(values.firstName?.trim()?{firstName:values.firstName.trim()}:{}),...(values.lastName?.trim()?{lastName:values.lastName.trim()}:{}),...(values.phone?.trim()?{phone:values.phone.trim()}:{})};await register(body);setSuccess(true);}}catch(e){setError(showError(e));}});
  if(!isLogin&&success)return <PublicLayout><div className="mx-auto max-w-xl px-5 py-20"><div className="surface p-10 text-center"><BadgeCheck className="mx-auto text-primary" size={40}/><h1 className="mt-4 font-display text-3xl font-bold">Hesabınız hazır</h1><p className="mt-2 text-muted-foreground">Kaydınız tamamlandı. Devam etmek için giriş yapın.</p><Link href={loginHref} className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-white">Giriş sayfasına git</Link></div></div></PublicLayout>;
  const field=(name:keyof RegisterRequest,label:string,type='text',required=false)=><FormField key={name} control={form.control} name={name} rules={{required:required?`${label} zorunludur.`:false,...(name==='password'&&!isLogin?{minLength:{value:8,message:'Şifre en az 8 karakter olmalıdır.'},maxLength:{value:128,message:'Şifre en fazla 128 karakter olabilir.'}}:name==='password'&&isLogin?{maxLength:{value:128,message:'Şifre en fazla 128 karakter olabilir.'}}:{}),...(name==='firstName'||name==='lastName'?{maxLength:{value:80,message:`${label} en fazla 80 karakter olabilir.`}}:{}),...(name==='phone'?{maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}}:{})}} render={({field:input})=><FormItem><FormLabel>{label}{required?' *':''}</FormLabel><FormControl><input {...input} type={type} className={inputClass} autoComplete={name==='password'?(isLogin?'current-password':'new-password'):name==='email'?'email':'off'} data-testid={`input-${name}`}/></FormControl><FormMessage/></FormItem>}/>;
  return <PublicLayout><div className="auth-stage px-5 py-12 md:py-20"><div className="mx-auto grid max-w-[1020px] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-xl shadow-[#384d42]/8 md:grid-cols-[.85fr_1fr]"><div className="auth-aside relative hidden p-10 text-white md:flex md:flex-col md:justify-between"><YuvaLogo tone="cream"/><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#cbdacf]">Yuva’ya hoş geldiniz</p><h2 className="mt-4 font-display text-4xl font-extrabold leading-tight">Yeni bir yer,<br/>yeni bir hikâye.</h2><p className="mt-4 max-w-xs text-sm leading-6 text-white/70">Yaşamınıza uygun evi bulmak için ilanları güvenle keşfedin.</p></div><small className="text-white/50">Türkiye’de yaşam alanları için.</small></div><div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{isLogin?'Hesabınıza dönün':'Aramıza katılın'}</p><h1 className="mt-2 font-display text-3xl font-extrabold">{isLogin?'Giriş yap':'Hesap oluştur'}</h1><p className="mt-2 text-sm text-muted-foreground">{isLogin?'İlanları kaydetmek ve hesabınızı yönetmek için giriş yapın.':'Ücretsiz hesabınızla size uygun yaşam alanını bulun.'}</p>
    {error&&<div role="alert" className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    <Form {...form}><form onSubmit={onSubmit} className="mt-6 grid gap-4">{!isLogin&&<div className="grid gap-4 sm:grid-cols-2">{field('firstName','Ad')}{field('lastName','Soyad')}</div>}{field('email','E-posta','email',true)}{!isLogin&&field('phone','Telefon','tel')}{field('password','Şifre','password',true)}<button disabled={form.formState.isSubmitting} className="mt-2 h-12 rounded-xl bg-primary font-bold text-white disabled:opacity-60">{form.formState.isSubmitting?'İşleniyor…':isLogin?'Giriş yap':'Ücretsiz kayıt ol'}</button></form></Form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{isLogin?'Henüz hesabınız yok mu?':'Zaten hesabınız var mı?'} <Link href={isLogin?registerHref:loginHref} className="font-bold text-primary">{isLogin?'Kayıt olun':'Giriş yapın'}</Link></p>
  </div></div></div></PublicLayout>;
}

function FavoritesContent() {
  const [page,setPage]=useState(1); const q=useFavorites(page); const fav=useToggleFavorite();
  return <><SectionTitle eyebrow="Sizin seçtikleriniz" title="Favorilerim" description="Beğendiğiniz ilanlara daha sonra buradan ulaşın."/>
    {DATA_MODE==='mock'?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Favorilerinizi görüntülemek ve yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları Keşfet"/>:q.isLoading?<SkeletonGrid/>:q.error?<ErrorState retry={()=>q.refetch()} message="Favorileriniz yüklenemedi."/>:q.data?.items.length?<><div className="home-property-grid grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">{q.data.items.map(p=><PropertyCardView key={p.id} property={p} onFavorite={(id,is)=>fav.mutate({id,favorite:is})} favoriteBusy={fav.isPending}/>)}</div><Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/></>:<EmptyState title="Henüz favori ilanınız yok." text="Beğendiğiniz ilanları kalp simgesine basarak burada saklayabilirsiniz." href="/ilanlar" action="İlanları Keşfet"/>}</>;
}
function ProfileContent() {
  const me=useMe(),qc=useQueryClient(); const {syncUser}=useAuth(); const {toast}=useToast(); const [message,setMessage]=useState(''); const form=useForm<{firstName:string;lastName:string;phone:string}>({defaultValues:{firstName:'',lastName:'',phone:''}});
  useEffect(()=>{if(me.data)form.reset({firstName:me.data.firstName??'',lastName:me.data.lastName??'',phone:me.data.phone??''});},[me.data,form]);
  const save=useMutation({mutationFn:usersApi.updateMe,onSuccess:data=>{qc.setQueryData(keys.me,data);syncUser(data);setMessage('Hesap bilgileriniz güncellendi.');toast({title:'Hesap bilgileriniz güncellendi.'});}});
  const profileError=save.error?`Bilgileriniz güncellenemedi. ${showError(save.error)}`:'';
  return <><SectionTitle eyebrow="Hesap ayarları" title="Hesap Bilgilerim" description="Hesap ve iletişim bilgilerinizi yönetin."/>
    {DATA_MODE==='mock'?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Profil bilgilerinizi görüntülemek ve düzenlemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>:me.isLoading?<div className="surface p-8"><div className="skeleton h-40"/></div>:me.error?<ErrorState retry={()=>me.refetch()} message="Hesap bilgileriniz yüklenemedi."/>:<div className="surface p-7"><div className="mb-6 grid gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">E-posta<input className={inputClass+' cursor-not-allowed opacity-70'} value={me.data?.email||''} readOnly disabled aria-readonly="true" data-testid="input-profile-email"/></label><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Hesap Türü<input className={inputClass+' cursor-not-allowed opacity-70'} value={labels[me.data?.role||'USER']||me.data?.role||''} readOnly disabled aria-readonly="true" data-testid="input-profile-role"/></label></div><form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(v=>{setMessage('');save.mutate({firstName:v.firstName.trim(),lastName:v.lastName.trim(),phone:v.phone.trim()});})}><label className="grid gap-1.5 text-sm font-semibold">Ad<input className={inputClass} data-testid="input-profile-firstName" {...form.register('firstName',{maxLength:{value:80,message:'Ad en fazla 80 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.firstName?.message}</span></label><label className="grid gap-1.5 text-sm font-semibold">Soyad<input className={inputClass} data-testid="input-profile-lastName" {...form.register('lastName',{maxLength:{value:80,message:'Soyad en fazla 80 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.lastName?.message}</span></label><label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Telefon<input className={inputClass} type="tel" data-testid="input-profile-phone" {...form.register('phone',{maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.phone?.message}</span></label>{message&&<p role="status" className="text-sm text-primary sm:col-span-2">{message}</p>}{profileError&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{profileError}</p>}<button className="h-11 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={save.isPending} data-testid="button-profile-save">{save.isPending?'Kaydediliyor…':'Değişiklikleri Kaydet'}</button></form></div>}</>;
}

function ApplicationPage() {
  const {user,refresh}=useAuth(); const {toast}=useToast(); const isMock=DATA_MODE==='mock';
  const app=useApplication(!isMock); const docs=useApplicationDocs(!isMock&&!!app.data);
  const qc=useQueryClient(); const [feedback,setFeedback]=useState(''); const [errorMsg,setErrorMsg]=useState('');
  const [uploadingType,setUploadingType]=useState<AgentDocumentType|null>(null); const [downloadingId,setDownloadingId]=useState<string|null>(null);
  const syncedApprovedId=useRef<string|null>(null);

  const form=useForm<CreateAgentApplicationRequest>({
    defaultValues:{
      companyName:'',
      authorizedFirstName:user?.firstName||'',
      authorizedLastName:user?.lastName||'',
      phone:user?.phone||'',
      email:user?.email||'',
      taxNumber:'',
      city:'',
      district:'',
      address:'',
      description:'',
    },
  });

  useEffect(()=>{
    if(app.data){
      form.reset({
        companyName:app.data.companyName,
        authorizedFirstName:app.data.authorizedFirstName,
        authorizedLastName:app.data.authorizedLastName,
        phone:app.data.phone,
        email:app.data.email,
        taxNumber:app.data.taxNumber,
        city:app.data.city,
        district:app.data.district,
        address:app.data.address,
        description:app.data.description||'',
      });
    }else if(user&&app.error instanceof ApiRequestError&&app.error.status===404){
      form.reset({
        companyName:'',
        authorizedFirstName:user.firstName||'',
        authorizedLastName:user.lastName||'',
        phone:user.phone||'',
        email:user.email||'',
        taxNumber:'',
        city:'',
        district:'',
        address:'',
        description:'',
      });
    }
  },[app.data,app.error,user,form]);

  useEffect(()=>{
    if(app.data?.status==='APPROVED'&&user?.role==='USER'&&syncedApprovedId.current!==app.data.id){
      syncedApprovedId.current=app.data.id;
      void refresh();
    }
  },[app.data?.id,app.data?.status,user?.role,refresh]);

  const mutation=useMutation({
    mutationFn:(v:CreateAgentApplicationRequest)=>{
      const isDraft=app.data?.status==='DRAFT';
      const trimmedDesc=v.description?.trim()||'';
      const payload:CreateAgentApplicationRequest={
        companyName:v.companyName.trim(),
        authorizedFirstName:v.authorizedFirstName.trim(),
        authorizedLastName:v.authorizedLastName.trim(),
        phone:v.phone.trim(),
        email:v.email.trim(),
        taxNumber:v.taxNumber.trim(),
        city:v.city.trim(),
        district:v.district.trim(),
        address:v.address.trim(),
        ...(isDraft?{description:trimmedDesc}:trimmedDesc?{description:trimmedDesc}:{}),
      };
      return isDraft?applicationsApi.updateMyApplication(payload):applicationsApi.createApplication(payload);
    },
    onSuccess:(saved)=>{
      const wasDraft=app.data?.status==='DRAFT';
      qc.setQueryData(keys.application,saved);
      void qc.invalidateQueries({queryKey:keys.application});
      void qc.invalidateQueries({queryKey:keys.applicationDocs});
      const msg=wasDraft?'Başvuru bilgileriniz güncellendi.':'Başvurunuz taslak olarak kaydedildi. Başvuruya devam edin.';
      setErrorMsg('');
      setFeedback(msg);
      toast({title:msg});
    },
    onError:(err)=>{
      const msg=showError(err);
      setFeedback('');
      setErrorMsg(msg);
    },
  });

  const submitReview=useMutation({
    mutationFn:()=>applicationsApi.submitMyApplication(),
    onSuccess:(saved)=>{
      qc.setQueryData(keys.application,saved);
      void qc.invalidateQueries({queryKey:keys.application});
      const msg='Başvurunuz incelemeye gönderildi.';
      setErrorMsg('');
      setFeedback(msg);
      toast({title:msg});
    },
    onError:(err)=>{
      setFeedback('');
      setErrorMsg(showError(err));
    },
  });

  const reviseApplication=useMutation({
    mutationFn:()=>applicationsApi.reviseMyApplication(),
    onSuccess:(saved)=>{
      qc.setQueryData(keys.application,saved);
      void qc.invalidateQueries({queryKey:keys.application});
      void qc.invalidateQueries({queryKey:keys.applicationDocs});
      const msg='Başvurunuz yeniden düzenlemeye açıldı.';
      setErrorMsg('');
      setFeedback(msg);
      toast({title:msg});
    },
    onError:(err)=>{
      setFeedback('');
      setErrorMsg(showError(err));
    },
  });

  const upload=async(file:File,type:AgentDocumentType)=>{
    setFeedback('');
    setErrorMsg('');
    if(file.size>10*1024*1024){
      setErrorMsg('Dosya boyutu 10 MB sınırını aşamaz.');
      return;
    }
    const allowedMimes=['application/pdf','image/jpeg','image/png'];
    const lowerName=file.name.toLowerCase();
    const validExt=lowerName.endsWith('.pdf')||lowerName.endsWith('.jpg')||lowerName.endsWith('.jpeg')||lowerName.endsWith('.png');
    if((file.type&&!allowedMimes.includes(file.type))||(!file.type&&!validExt)){
      setErrorMsg('Yalnızca PDF, JPEG veya PNG formatında belge yüklenebilir.');
      return;
    }
    setUploadingType(type);
    try{
      await applicationsApi.uploadDocument(file,type);
      await qc.invalidateQueries({queryKey:keys.applicationDocs});
      const msg=`${labels[type]||type} yüklendi.`;
      setFeedback(msg);
      toast({title:msg});
    }catch(e){
      setErrorMsg(showError(e));
    }finally{
      setUploadingType(null);
    }
  };

  const download=async(id:string,originalName:string)=>{
    setErrorMsg('');
    setDownloadingId(id);
    try{
      const blob=await applicationsApi.getMyDocument(id);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=originalName||'basvuru-belgesi';
      a.click();
      URL.revokeObjectURL(url);
    }catch(e){
      setErrorMsg(showError(e));
    }finally{
      setDownloadingId(null);
    }
  };

  const fieldConfigs:Array<{key:Exclude<keyof CreateAgentApplicationRequest,'description'>;label:string;type?:string;rules:RegisterOptions<CreateAgentApplicationRequest,Exclude<keyof CreateAgentApplicationRequest,'description'>>}>=[
    {key:'companyName',label:'Firma adı',rules:{required:'Firma adı zorunludur.',minLength:{value:2,message:'Firma adı en az 2 karakter olmalıdır.'},maxLength:{value:120,message:'Firma adı en fazla 120 karakter olabilir.'}}},
    {key:'authorizedFirstName',label:'Yetkili adı',rules:{required:'Yetkili adı zorunludur.',minLength:{value:2,message:'Yetkili adı en az 2 karakter olmalıdır.'},maxLength:{value:80,message:'Yetkili adı en fazla 80 karakter olabilir.'}}},
    {key:'authorizedLastName',label:'Yetkili soyadı',rules:{required:'Yetkili soyadı zorunludur.',minLength:{value:2,message:'Yetkili soyadı en az 2 karakter olmalıdır.'},maxLength:{value:80,message:'Yetkili soyadı en fazla 80 karakter olabilir.'}}},
    {key:'phone',label:'Telefon',type:'tel',rules:{required:'Telefon zorunludur.',minLength:{value:7,message:'Telefon en az 7 karakter olmalıdır.'},maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}}},
    {key:'email',label:'Firma e-postası',type:'email',rules:{required:'Firma e-postası zorunludur.',maxLength:{value:254,message:'E-posta en fazla 254 karakter olabilir.'}}},
    {key:'taxNumber',label:'Vergi numarası',rules:{required:'Vergi numarası zorunludur.',pattern:{value:/^\d{10,11}$/,message:'Vergi numarası 10 veya 11 rakam olmalı.'}}},
    {key:'city',label:'Şehir',rules:{required:'Şehir zorunludur.',minLength:{value:2,message:'Şehir en az 2 karakter olmalıdır.'},maxLength:{value:80,message:'Şehir en fazla 80 karakter olabilir.'}}},
    {key:'district',label:'İlçe',rules:{required:'İlçe zorunludur.',minLength:{value:2,message:'İlçe en az 2 karakter olmalıdır.'},maxLength:{value:80,message:'İlçe en fazla 80 karakter olabilir.'}}},
    {key:'address',label:'Açık adres',rules:{required:'Açık adres zorunludur.',minLength:{value:5,message:'Açık adres en az 5 karakter olmalıdır.'},maxLength:{value:300,message:'Açık adres en fazla 300 karakter olabilir.'}}},
  ];

  const isNoApplication=app.error instanceof ApiRequestError&&app.error.status===404;
  const hasRealError=Boolean(app.error&&!isNoApplication);
  const currentApp=isNoApplication?undefined:app.data;
  const isDraft=currentApp?.status==='DRAFT';
  const isPendingReview=currentApp?.status==='PENDING';
  const isRejected=currentApp?.status==='REJECTED';
  const isApproved=currentApp?.status==='APPROVED';
  const canEditFields=!currentApp||isDraft;
  const formBusy=mutation.isPending||submitReview.isPending||reviseApplication.isPending;

  return <Guard roles={['USER']}><PublicLayout><div className="mx-auto max-w-4xl px-5 py-12"><SectionTitle eyebrow="Profesyonel hesabı" title="Emlakçı başvurusu" description="Başvurunuzu ve gerekli belgeleri tek yerden yönetin."/>
    {isMock?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı başvurusu oluşturmak ve belge yüklemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>:app.isLoading?<div className="surface p-8"><div className="skeleton h-40"/></div>:hasRealError?<ErrorState retry={()=>app.refetch()} message={showError(app.error)}/>:<div className="grid gap-6">
      {currentApp&&<div className="surface flex flex-wrap items-center justify-between gap-3 p-5" data-testid="card-application-status">
        <div>
          <p className="text-xs text-muted-foreground">Başvuru durumu</p>
          <p className="mt-1 font-bold" data-testid="text-application-status">{labels[currentApp.status]||currentApp.status}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">{new Date(currentApp.updatedAt).toLocaleDateString('tr-TR')}</span>
        {isDraft&&<p className="w-full text-xs text-muted-foreground">Başvurunuz henüz tamamlanmadı. Başvuruya devam edin.</p>}
        {isPendingReview&&<p className="w-full text-xs text-muted-foreground">Başvurunuz inceleniyor.</p>}
        {isApproved&&<div className="w-full rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Başvurunuz onaylandı.</div>}
        {isRejected&&<div className="w-full rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p className="font-semibold">Başvurunuz reddedildi.</p><p className="mt-1">Ret gerekçesi: {currentApp.rejectionReason||'Belirtilmedi'}</p></div>}
      </div>}

      <div className="surface p-6">
        <h2 className="mb-5 font-display text-xl font-bold">{isDraft?'Başvuru bilgilerini güncelle':isRejected?'Reddedilen başvuru':'Firma bilgileri'}</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(v=>{if(canEditFields)mutation.mutate(v);})}>
          {fieldConfigs.map(({key,label,type='text',rules})=><label className="grid gap-1.5 text-sm font-semibold" key={key}>{label} *<input className={inputClass} type={type} disabled={!canEditFields||formBusy} data-testid={`input-app-${key}`} {...form.register(key,rules)}/><span className="text-xs text-destructive">{form.formState.errors[key]?.message}</span></label>)}
          <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Açıklama<textarea className={`${inputClass} h-24 py-3`} disabled={!canEditFields||formBusy} data-testid="input-app-description" {...form.register('description',{maxLength:{value:2000,message:'Açıklama en fazla 2000 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.description?.message}</span></label>
          {canEditFields&&<button disabled={formBusy} data-testid="button-submit-application" className="h-11 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60 sm:col-span-2">{mutation.isPending?'Kaydediliyor…':isDraft?'Bilgileri kaydet':'Başvuruyu başlat'}</button>}
        </form>
        {isDraft&&<button type="button" disabled={formBusy} data-testid="button-send-application" className="mt-3 h-11 w-full rounded-xl border border-primary px-5 font-bold text-primary disabled:opacity-60" onClick={()=>submitReview.mutate()}>{submitReview.isPending?'Gönderiliyor…':'İncelemeye gönder'}</button>}
        {isRejected&&<button type="button" disabled={formBusy} data-testid="button-revise-application" className="mt-3 h-11 w-full rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60" onClick={()=>reviseApplication.mutate()}>{reviseApplication.isPending?'Açılıyor…':'Başvuruyu düzenle'}</button>}
        <p className="mt-3 text-xs text-muted-foreground">{isPendingReview?'İncelemedeki başvuru bilgileri ve belgeleri değiştirilemez.':isDraft?'Bilgileri kaydedin, belgeleri yükleyin ve hazır olduğunda incelemeye gönderin.':isRejected?'Düzenlemeye geçince aynı başvuru taslağa döner. Yüklü belgeler durur.':'Başvuruyu başlatmak taslak oluşturur. İncelemeye gönderilene kadar admin kuyruğuna düşmez.'}</p>
      </div>

      {currentApp&&<div className="surface p-6" data-testid="section-application-documents">
        <h2 className="font-display text-xl font-bold">Başvuru belgeleri</h2>
        <p className="mt-1 text-sm text-muted-foreground">PDF, JPEG veya PNG · dosya başına en fazla 10 MB · Onay için her iki belge de zorunludur</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(['TAX_CERTIFICATE','AUTHORIZATION_CERTIFICATE'] as AgentDocumentType[]).map((type)=>{
            const doc=docs.data?.find(d=>d.documentType===type);
            const isUploading=uploadingType===type;
            return <div key={type} className="rounded-xl border border-border p-4" data-testid={`card-document-${type}`}>
              <p className="font-semibold">{labels[type]||type}</p>
              {doc?<div className="mt-2">
                <button type="button" disabled={downloadingId===doc.id} data-testid={`button-download-${type}`} className="text-left text-sm font-semibold text-primary underline disabled:opacity-60" onClick={()=>void download(doc.id,doc.originalName)}>{doc.originalName} · {downloadingId===doc.id?'İndiriliyor…':'İndir'}</button>
                <p className="mt-1 text-xs text-muted-foreground">{(doc.sizeBytes/1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>:<p className="mt-2 text-xs text-muted-foreground">Henüz belge eklenmedi</p>}
              {isDraft?<label className={`mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border px-3 py-3 text-sm font-semibold hover:border-primary ${isUploading?'pointer-events-none opacity-60':''}`}>{isUploading?'Yükleniyor…':doc?'Belgeyi değiştir':'Belge yükle'}<input className="sr-only" type="file" disabled={isUploading} data-testid={`input-file-${type}`} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,type);e.currentTarget.value='';}}/></label>:<p className="mt-3 text-xs text-muted-foreground">{isPendingReview?'Belgeler inceleme sırasında değiştirilemez.':isRejected?'Başvuruyu düzenlemeye açtıktan sonra belgeleri değiştirebilirsiniz.':'Onaylanmış başvurunun belgeleri değiştirilemez.'}</p>}
            </div>;
          })}
        </div>
        {docs.error&&<p className="mt-3 text-sm text-destructive">{showError(docs.error)}</p>}
      </div>}

      {feedback&&<p role="status" className="text-sm text-primary" data-testid="text-application-feedback">{feedback}</p>}
      {errorMsg&&<p role="alert" className="text-sm text-destructive" data-testid="text-application-error">{errorMsg}</p>}
    </div>}</div></PublicLayout></Guard>;
}

function SuspendedAgentNotice() {
  return <div role="status" data-testid="text-agent-suspended" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Emlakçı hesabınız askıya alınmıştır. Profesyonel işlemler geçici olarak kullanılamaz.</div>;
}
const agentNavItems = [
  ['/panel', 'Genel Bakış'],
  ['/panel/ilanlar', 'İlanlarım'],
  ['/panel/ilanlar/yeni', 'Yeni İlan'],
  ['/panel/emlakci-profili', 'Emlakçı Profilim'],
  ['/favoriler', 'Favoriler'],
] as const;
function isAgentNavActive(href: string, location: string) {
  if (href === '/panel') return location === '/panel';
  if (href === '/panel/ilanlar') return location === '/panel/ilanlar' || /^\/panel\/ilanlar\/[^/]+\/duzenle$/.test(location);
  return location === href;
}
function AgentNavLinks({ location, mobile = false, onNavigate }: { location: string; mobile?: boolean; onNavigate?: () => void }) {
  const profile = useMyAgentProfile(DATA_MODE !== 'mock');
  const suspended = profile.data?.isActive === false;
  return <>{agentNavItems.map(([href, label]) => {
    const active = isAgentNavActive(href, location);
    const className = `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? 'bg-secondary text-primary' : 'text-foreground hover:bg-secondary/70 hover:text-primary'}`;
    if (href === '/panel/ilanlar/yeni' && suspended) {
      return <button key={href} type="button" disabled aria-disabled="true" aria-current={active ? 'page' : undefined} data-testid={`${mobile ? 'link-agent-nav-mobile' : 'link-agent-nav'}-${href}`} className={`${className} cursor-not-allowed opacity-50 hover:bg-transparent hover:text-foreground`}><span aria-hidden="true" className={`h-5 w-0.5 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`}/>{label}</button>;
    }
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined} data-testid={`${mobile ? 'link-agent-nav-mobile' : 'link-agent-nav'}-${href}`} onClick={onNavigate} className={className}><span aria-hidden="true" className={`h-5 w-0.5 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`}/>{label}</Link>;
  })}</>;
}
function PanelLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => {
    setOpen(false);
    menuBtnRef.current?.focus();
  }, []);
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeDrawer]);
  return <Guard roles={['AGENT']}>
    <div className="min-h-[75vh] overflow-x-hidden bg-[#f4f3ed]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-5 lg:px-8 lg:py-8">
        <header className="mb-5 flex items-start justify-between gap-3 lg:mb-8 lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <YuvaLogo className="max-lg:[&_img]:h-9 max-lg:[&_img]:max-w-[8.75rem]"/>
              <button ref={menuBtnRef} type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden" aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={open} aria-controls="agent-panel-drawer" data-testid="button-agent-menu" onClick={() => { if (open) closeDrawer(); else setOpen(true); }}>{open ? <X size={18}/> : <Menu size={18}/>}</button>
            </div>
            <div className="hidden min-w-0 border-l border-[#d8dbd1] pl-5 lg:block">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Emlakçı çalışma alanı</p>
              <h1 className="mt-1 truncate font-display text-3xl font-extrabold">İşinizi yönetin</h1>
            </div>
            <p className="truncate text-sm font-semibold text-primary lg:hidden">Emlakçı Paneli</p>
          </div>
          <Link href="/" className="hidden shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:flex"><ArrowLeft size={16}/> Ana sayfaya dön</Link>
        </header>
        {open && <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-[#203b34]/40" aria-label="Menüyü kapat" data-testid="button-agent-overlay" onClick={closeDrawer}/>
          <div ref={drawerRef} id="agent-panel-drawer" role="dialog" aria-modal="true" aria-label="Emlakçı paneli menüsü" className="absolute inset-y-0 left-0 flex w-[min(18.5rem,calc(100%-2.75rem))] max-w-full flex-col border-r border-border bg-card shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
              <YuvaLogo className="[&_img]:h-9 [&_img]:max-w-[8.75rem]"/>
              <button ref={closeBtnRef} type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Menüyü kapat" data-testid="button-agent-menu-close" onClick={closeDrawer}><X size={18}/></button>
            </div>
            <nav className="grid gap-1 overflow-y-auto p-3" aria-label="Emlakçı paneli"><AgentNavLinks location={location} mobile onNavigate={closeDrawer}/><Link href="/" onClick={closeDrawer} className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border-t border-border px-3 pt-3 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft size={16}/> Ana sayfaya dön</Link></nav>
          </div>
        </div>}
        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <aside className="surface sticky top-6 hidden h-fit p-3 lg:block">
            <nav className="grid gap-1" aria-label="Emlakçı paneli"><AgentNavLinks location={location}/></nav>
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  </Guard>;
}
function AgentHome() {
  const isMock = DATA_MODE === 'mock';
  const enabled = !isMock;
  const recent = useMineProperties({ page: 1, limit: 5 }, enabled);
  const active = useMineProperties({ page: 1, limit: 1, status: 'ACTIVE' }, enabled);
  const inactive = useMineProperties({ page: 1, limit: 1, status: 'INACTIVE' }, enabled);
  const sold = useMineProperties({ page: 1, limit: 1, status: 'SOLD' }, enabled);
  const rented = useMineProperties({ page: 1, limit: 1, status: 'RENTED' }, enabled);
  const profile = useMyAgentProfile(enabled);
  if (isMock) return <PanelLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı çalışma alanını kullanmak için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></PanelLayout>;
  const suspended = profile.data?.isActive === false;
  const completed = sold.data && rented.data ? sold.data.total + rented.data.total : undefined;
  const reloadListings = () => { void recent.refetch(); void active.refetch(); void inactive.refetch(); void sold.refetch(); void rented.refetch(); };
  const stats = [
    { label: 'Toplam İlan', value: recent.data?.total, error: recent.error, loading: recent.isLoading, hint: 'Silinmemiş ilanlar', testId: 'stat-total-properties' },
    { label: 'Yayındaki İlan', value: active.data?.total, error: active.error, loading: active.isLoading, hint: 'Yayında olanlar', testId: 'stat-active-properties' },
    { label: 'Pasif İlan', value: inactive.data?.total, error: inactive.error, loading: inactive.isLoading, hint: 'Pasif durumundaki ilanlar', testId: 'stat-inactive-properties' },
    { label: 'Sonuçlanan', value: completed, error: sold.error || rented.error, loading: sold.isLoading || rented.isLoading, hint: 'Satıldı veya kiralandı', testId: 'stat-completed-properties' },
  ];
  const countsPending = stats.some(stat => stat.loading && stat.value === undefined);
  const anyCountValue = stats.some(stat => stat.value !== undefined);
  const anyCountError = stats.some(stat => stat.error);
  const initialCountsError = anyCountError && !anyCountValue && !countsPending;
  const partialCountError = stats.some(stat => stat.error && stat.value === undefined) && anyCountValue;
  const staleCountError = stats.some(stat => stat.error && stat.value !== undefined) && !partialCountError;
  return <PanelLayout>
    {suspended && <SuspendedAgentNotice/>}
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <section className="surface p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Genel Bakış</p>
        {profile.isLoading ? <div className="skeleton mt-3 h-10 w-56 max-w-full"/> : profile.error ? <h2 className="mt-2 font-display text-3xl font-extrabold">Bilgiler yüklenemedi</h2> : <h2 className="mt-2 break-words font-display text-3xl font-extrabold [overflow-wrap:anywhere]">{profile.data?.companyName || 'Portföyünüze hoş geldiniz'}</h2>}
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Portföyünüzü ve ilanlarınızı buradan yönetebilirsiniz.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {suspended
            ? <button type="button" disabled className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white disabled:opacity-50" data-testid="link-dashboard-new-property">+ Yeni İlan</button>
            : <Link href="/panel/ilanlar/yeni" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white" data-testid="link-dashboard-new-property">+ Yeni İlan</Link>}
          <Link href="/panel/ilanlar" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-bold">İlanlarımı Görüntüle</Link>
        </div>
      </section>
      {initialCountsError ? <ErrorState retry={reloadListings} message="Bilgiler yüklenirken bir sorun oluştu."/> : <>
        {(partialCountError || staleCountError) && <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid={partialCountError ? 'alert-dashboard-counts-partial' : 'alert-dashboard-counts-stale'}>
          <p className="text-sm text-muted-foreground">{partialCountError ? 'Bazı sayaçlar yüklenemedi.' : 'Sayaçlar güncellenemedi. Son başarılı değerler gösteriliyor.'}</p>
          <button type="button" onClick={reloadListings} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white" data-testid="button-dashboard-counts-retry">Yeniden dene</button>
        </div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={countsPending}>
          {stats.map(stat => <div key={stat.testId} className="surface p-5"><p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>{stat.loading && stat.value === undefined ? <div className="skeleton mt-3 h-9 w-16"/> : <p className="mt-2 font-display text-3xl font-extrabold" data-testid={stat.testId}>{stat.value ?? '—'}</p>}<p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p></div>)}
        </div>
      </>}
      <section className="surface p-5" aria-labelledby="agent-profile-summary">
        <h3 id="agent-profile-summary" className="font-display text-xl font-bold">Emlakçı Profiliniz</h3>
        {profile.isLoading ? <div className="skeleton mt-4 h-20"/> : profile.error ? <div className="mt-4"><ErrorState retry={() => { void profile.refetch(); }} message="Bilgiler yüklenirken bir sorun oluştu."/></div> : profile.data && <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileLogo url={profile.data.logoUrl} alt="Şirket logosu" className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl object-cover"/>
            <div className="min-w-0">
              <p className="truncate font-bold">{profile.data.companyName}</p>
              <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${profile.data.isActive ? 'bg-secondary text-primary' : 'bg-amber-50 text-amber-950'}`} data-testid="text-agent-profile-status">{profile.data.isActive ? 'Aktif' : 'Askıya Alındı'}</p>
              <p className="mt-2 truncate text-sm text-muted-foreground">{profile.data.email}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.data.phone}</p>
            </div>
          </div>
          <Link href="/panel/emlakci-profili" className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-border px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-dashboard-profile">{suspended ? 'Profili Görüntüle' : 'Profili Düzenle'}</Link>
        </div>}
      </section>
      <section aria-labelledby="recent-properties">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="recent-properties" className="font-display text-xl font-bold">Son İlanlar</h3>
          <Link href="/panel/ilanlar" className="shrink-0 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-dashboard-all-listings">Tümünü Gör</Link>
        </div>
        {initialCountsError ? null : recent.isLoading && !recent.data ? <div className="grid gap-3">{[1, 2, 3].map(item => <div key={item} className="surface p-4"><div className="skeleton h-14"/></div>)}</div> : recent.error && !recent.data ? <ErrorState retry={() => { void recent.refetch(); }} message="Son ilanlar yüklenemedi."/> : recent.data?.items.length ? <div className="grid gap-3">{recent.data.items.map(property => <article key={property.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-dashboard-property-${property.id}`}>
          <div className="flex min-w-0 flex-1 gap-3">
          <ListingCover url={property.coverImageUrl} title={property.title} compact className="h-16 w-20 shrink-0 rounded-lg"/>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-bold [overflow-wrap:anywhere]">{property.title}</h4><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{labels[property.status]}</span></div>
            <p className="mt-1 font-extrabold text-primary">{money(property.price)}</p>
            <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{[property.neighborhood, property.district, property.city].filter(Boolean).join(', ')} · {new Date(property.createdAt).toLocaleDateString('tr-TR')}</p>
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {property.status === 'ACTIVE' && !suspended && <Link href={`/ilan/${property.id}`} className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground">İlanı gör</Link>}
            <Link href={`/panel/ilanlar/${property.id}/duzenle`} className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold">{suspended ? 'Görüntüle' : 'Düzenle'}</Link>
          </div>
        </article>)}</div> : <div className="surface px-5 py-8 text-center"><h4 className="font-display text-xl font-bold">Henüz ilanınız bulunmuyor.</h4>{!suspended && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">İlk ilanınızı oluşturarak portföyünüzü oluşturmaya başlayın.</p>}{!suspended && <Link href="/panel/ilanlar/yeni" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white">+ Yeni İlan</Link>}</div>}
      </section>
    </div>
  </PanelLayout>;
}
function isOwnedFilePath(path: string) {
  return path.includes('/me/files/');
}
function ownerImagePath(url: string | null | undefined, individual: boolean) {
  if (!url) return null;
  if (isOwnedFilePath(url)) return url;
  const fileId = url.match(/\/files\/([0-9a-f-]{36})(?:$|[/?#])/i)?.[1];
  if (!fileId) return url;
  return individual ? `/api/v1/user-properties/me/files/${fileId}` : `/api/v1/properties/me/files/${fileId}`;
}
function useOwnedImage(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path) {
      setSrc(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    if (!isOwnedFilePath(path)) {
      setSrc(fileUrl(path));
      setFailed(false);
      setLoading(false);
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    setLoading(true);
    const requestPath = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) : path;
    request<Blob>(requestPath, {}, { auth: true }).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setFailed(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return { src, failed, loading, fail: () => setFailed(true) };
}
function EditorImage({ url, individual }: { url: string; individual: boolean }) {
  const image = useOwnedImage(ownerImagePath(url, individual));
  if (image.src && !image.failed) return <img src={image.src} alt="Yüklenen ilan fotoğrafı" onError={image.fail} className="aspect-[4/3] w-full object-cover"/>;
  if (image.loading) return <div className="aspect-[4/3] w-full bg-muted" aria-busy="true" aria-label="Fotoğraf yükleniyor"/>;
  return <div className="grid aspect-[4/3] w-full place-items-center bg-muted px-2 text-center text-xs font-semibold text-muted-foreground" role="img" aria-label="Görsel yüklenemedi">Görsel yüklenemedi</div>;
}
function ListingCover({ url, title, className, compact = false }: { url?: string | null; title: string; className: string; compact?: boolean }) {
  const image = useOwnedImage(url);
  return <div className={`overflow-hidden bg-muted ${className}`}>
    {image.src && !image.failed ? <img src={image.src} alt={title} onError={image.fail} className="h-full w-full object-cover"/> : image.loading ? <div className="h-full w-full" aria-busy="true" aria-label="Kapak görseli yükleniyor"/> : <div className="grid h-full w-full place-items-center gap-1 px-2 text-center text-primary" role="img" aria-label="Görsel yok"><Home size={compact ? 18 : 22} strokeWidth={1.4}/>{!compact && <span className="text-[11px] font-semibold text-muted-foreground">Görsel yok</span>}</div>}
  </div>;
}
const transitions:Record<PropertyStatus,PropertyStatus[]>={ACTIVE:['INACTIVE','SOLD','RENTED'],INACTIVE:['ACTIVE'],SOLD:['ACTIVE'],RENTED:['ACTIVE']};
const propertyStatusFilters = [
  ['', 'Tümü'],
  ['ACTIVE', 'Yayında'],
  ['INACTIVE', 'Pasif'],
  ['SOLD', 'Satıldı'],
  ['RENTED', 'Kiralandı'],
] as const;
function listingFacts(property: { listingType: string; propertyType: string; rooms: number; livingRooms: number; grossAreaM2: string }) {
  const rooms = property.propertyType === 'LAND' ? '' : ` · ${property.rooms}+${property.livingRooms}`;
  return `${labels[property.listingType]} · ${labels[property.propertyType]}${rooms} · ${area(property.grossAreaM2)} m²`;
}
function AgentPropertiesPage() {
  const isMock=DATA_MODE==='mock';
  const [page,setPage]=useState(1); const [statusFilter,setStatusFilter]=useState<PropertyStatus|''>('');
  const q=useMineProperties({page,limit:20,...(statusFilter?{status:statusFilter}:{})},!isMock);
  const profile=useMyAgentProfile(!isMock);
  useEffect(()=>{
    if(!q.data)return;
    const pages=Math.max(1, Math.ceil(q.data.total / q.data.limit));
    if(page>pages)setPage(pages);
  },[q.data,page]);
  const suspended=profile.data?.isActive===false;
  const invalidate=useInvalidateMarketplace(); const {toast}=useToast();
  const [notice,setNotice]=useState(''); const [errorMsg,setErrorMsg]=useState('');
  const action=useMutation({
    mutationFn:({id,status}:{id:string;status:PropertyStatus})=>propertiesApi.updatePropertyStatus(id,{status}),
    onSuccess:(_res,vars)=>{
      invalidate(vars.id);
      setErrorMsg('');
      setNotice('İlan durumu güncellendi.');
      toast({title:'İlan durumu güncellendi.'});
    },
    onError:(err)=>{setNotice('');setErrorMsg(showError(err));},
  });
  const remove=useMutation({
    mutationFn:(id:string)=>propertiesApi.deleteProperty(id),
    onSuccess:(_res,deletedId)=>{
      invalidate(deletedId);
      setErrorMsg('');
      setNotice('İlan silindi.');
      toast({title:'İlan silindi.'});
    },
    onError:(err)=>{setNotice('');setErrorMsg(showError(err));},
  });
  if(isMock)return <PanelLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="İlanlarınızı yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></PanelLayout>;
  const actionClass = 'inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';
  return <PanelLayout>
    {suspended&&<SuspendedAgentNotice/>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h2 className="font-display text-2xl font-extrabold">İlanlarım</h2><p className="mt-1 text-sm text-muted-foreground">Portföyünüzdeki ilanları yönetin.</p></div>
      {suspended?<button type="button" disabled className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50" data-testid="link-create-property">+ Yeni İlan</button>:<Link href="/panel/ilanlar/yeni" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white" data-testid="link-create-property">+ Yeni İlan</Link>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Duruma göre filtrele">
      {propertyStatusFilters.map(([value, label]) => <button key={label} type="button" aria-pressed={statusFilter === value} data-testid={`button-filter-${value || 'all'}`} className={`rounded-full border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusFilter === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`} onClick={() => { setStatusFilter(value); setPage(1); }}>{label}</button>)}
    </div>
    {notice&&<p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
    {errorMsg&&<p role="alert" className="mt-3 text-sm text-destructive">{errorMsg}</p>}
    <div className="mt-5 grid gap-3">
      {q.isLoading?[1,2,3].map(i=><div className="surface p-4" key={i}><div className="skeleton aspect-video w-full rounded-xl md:h-[100px] md:w-[140px]"/></div>):q.error?<ErrorState retry={()=>q.refetch()} message="İlanlar yüklenirken bir sorun oluştu."/>:q.data?.items.length?q.data.items.map(p=><article key={p.id} className="surface min-w-0 p-4" data-testid={`row-my-property-${p.id}`}>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-start">
            <ListingCover url={p.coverImageUrl} title={p.title} className="aspect-video w-full rounded-xl md:aspect-auto md:h-[100px] md:w-[140px] md:shrink-0"/>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><h3 className="font-bold [overflow-wrap:anywhere]">{p.title}</h3><span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary" data-testid={`badge-status-${p.id}`}>{labels[p.status]}</span></div>
              <p className="mt-2 text-lg font-extrabold text-primary">{money(p.price)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{listingFacts(p)}</p>
              <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{[p.neighborhood, p.district, p.city].filter(Boolean).join(', ')}</p>
              <p className="mt-1 text-xs text-muted-foreground">Güncellendi: {new Date(p.updatedAt).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:max-w-xs lg:justify-end">
            {p.status==='ACTIVE'&&!suspended&&<Link href={`/ilan/${p.id}`} className={actionClass}>İlanı Gör</Link>}
            <Link href={`/panel/ilanlar/${p.id}/duzenle`} className={actionClass} data-testid={`link-edit-property-${p.id}`}>{suspended?'Görüntüle':'Düzenle'}</Link>
            <select aria-label="İlan durumunu değiştir" disabled={action.isPending||suspended} data-testid={`select-status-${p.id}`} className="h-10 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" value="" onChange={e=>{if(e.target.value)action.mutate({id:p.id,status:e.target.value as PropertyStatus});e.currentTarget.value='';}}>
              <option value="">Durum</option>
              {transitions[p.status].map(s=><option key={s} value={s}>{labels[s]}</option>)}
            </select>
            <button type="button" disabled={remove.isPending||suspended} data-testid={`button-delete-property-${p.id}`} className="inline-flex h-10 items-center rounded-lg border border-destructive/30 px-3 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" onClick={()=>{if(window.confirm('İlanı silmek istediğinize emin misiniz?'))remove.mutate(p.id);}}>Sil</button>
          </div>
        </div>
      </article>):statusFilter?<div className="surface px-5 py-8 text-center"><h3 className="font-display text-xl font-bold">{labels[statusFilter]} ilan bulunamadı.</h3></div>:<EmptyState title="Henüz ilanınız bulunmuyor." text={suspended?'Emlakçı hesabınız askıya alınmıştır. Profesyonel işlemler geçici olarak kullanılamaz.':'İlk ilanınızı oluşturarak portföyünüzü oluşturmaya başlayın.'} {...(suspended?{}:{href:'/panel/ilanlar/yeni',action:'+ Yeni İlan'})}/>}
    </div>
    {q.data&&!q.error&&<Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/>}
  </PanelLayout>;
}
type DraftImage = { key: string; file: File; previewUrl: string; isCover: boolean };

function decimalString(value: string, scale: number) {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');
  return `${negative ? '-' : ''}${whole}.${fraction.padEnd(scale, '0').slice(0, scale)}`;
}

function propertyPayload(v: CreatePropertyRequest, land: boolean): CreatePropertyRequest {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    listingType: v.listingType,
    propertyType: v.propertyType,
    price: decimalString(v.price, 2),
    grossAreaM2: decimalString(v.grossAreaM2, 2),
    ...(v.netAreaM2?.trim() ? { netAreaM2: decimalString(v.netAreaM2, 2) } : {}),
    rooms: land ? 0 : Number(v.rooms),
    livingRooms: land ? 0 : Number(v.livingRooms),
    ...(Number.isFinite(v.buildingAge) ? { buildingAge: Number(v.buildingAge) } : {}),
    ...(!land && Number.isFinite(v.floor) ? { floor: Number(v.floor) } : {}),
    ...(!land && Number.isFinite(v.totalFloors) ? { totalFloors: Number(v.totalFloors) } : {}),
    ...(!land && v.heatingType ? { heatingType: v.heatingType } : {}),
    cityId: v.cityId,
    districtId: v.districtId,
    neighborhoodId: v.neighborhoodId,
    address: v.address.trim(),
    ...(v.latitude?.trim() ? { latitude: decimalString(v.latitude, 6) } : {}),
    ...(v.longitude?.trim() ? { longitude: decimalString(v.longitude, 6) } : {}),
    isFurnished: Boolean(v.isFurnished),
    hasBalcony: Boolean(v.hasBalcony),
    hasElevator: land ? false : Boolean(v.hasElevator),
    hasParking: Boolean(v.hasParking),
    inSite: Boolean(v.inSite),
  };
}

function assertPropertyFields(v: CreatePropertyRequest, land: boolean) {
  if (!v.cityId || !v.districtId || !v.neighborhoodId) {
    throw new ApiRequestError(400, { statusCode: 400, message: 'Lütfen şehir, ilçe ve mahalle seçimlerini tamamlayın.', error: 'Bad Request', timestamp: new Date().toISOString(), path: '/api/v1/properties' });
  }
  const gross = Number(v.grossAreaM2);
  const net = v.netAreaM2?.trim() ? Number(v.netAreaM2.trim()) : undefined;
  if (net !== undefined && net > gross) {
    throw new ApiRequestError(400, { statusCode: 400, message: 'Net area cannot exceed gross area', error: 'Bad Request', timestamp: new Date().toISOString(), path: '/api/v1/properties' });
  }
  if (!land && Number.isFinite(v.floor) && Number.isFinite(v.totalFloors) && (v.floor as number) > (v.totalFloors as number)) {
    throw new ApiRequestError(400, { statusCode: 400, message: 'Floor cannot exceed total floors', error: 'Bad Request', timestamp: new Date().toISOString(), path: '/api/v1/properties' });
  }
}

function imageFileError(file: File) {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const lower = file.name.toLowerCase();
  const validExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  if ((file.type && !allowedMimes.includes(file.type)) || (!file.type && !validExt)) return 'Yalnızca JPEG, PNG veya WebP formatında fotoğraf yüklenebilir.';
  if (file.size > 10 * 1024 * 1024) return 'Fotoğraf 10 MB sınırını aşamaz.';
  return null;
}

function UserAccountGate({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, go] = useLocation();
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'AGENT') go('/panel');
    if (!isLoading && isAuthenticated && user?.role === 'ADMIN') go('/admin');
  }, [isLoading, isAuthenticated, user, go]);
  if (isLoading || !isAuthenticated || !user || user.role !== 'USER') return null;
  return <>{children}</>;
}
const accountLinks = [
  ['/hesabim', 'Genel Bakış'],
  ['/hesabim/ilanlar', 'İlanlarım'],
  ['/hesabim/favoriler', 'Favorilerim'],
  ['/hesabim/bilgiler', 'Hesap Bilgilerim'],
] as const;
function AccountLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <PublicLayout><div className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-5">
    <nav aria-label="Hesap menüsü" className="mb-6 flex flex-wrap gap-2" data-testid="nav-account">{accountLinks.map(([href, label]) => {
      const active = href === '/hesabim' ? location === '/hesabim' : location === href || location.startsWith(`${href}/`);
      return <Link key={href} href={href} className={`max-w-full rounded-full border px-3 py-2 text-sm font-semibold ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>{label}</Link>;
    })}</nav>
    {children}
  </div></PublicLayout>;
}
function AccountStat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return <div className="surface min-w-0 p-5"><p className="text-sm text-muted-foreground">{label}</p>{loading ? <div className="skeleton mt-3 h-8 w-16"/> : <p className="mt-2 font-display text-3xl font-extrabold">{value ?? 0}</p>}</div>;
}
function AccountDashboardPage() {
  const { user } = useAuth();
  const isMock = DATA_MODE === 'mock';
  const active = useMyUserProperties({ status: 'ACTIVE', page: 1, limit: 1 }, !isMock);
  const passive = useMyUserProperties({ status: 'INACTIVE', page: 1, limit: 1 }, !isMock);
  const recent = useMyUserProperties({ page: 1, limit: 3 }, !isMock);
  const favorites = useFavorites(1, 1, !isMock);
  const name = user?.firstName?.trim();
  const retry = () => { void active.refetch(); void passive.refetch(); void favorites.refetch(); void recent.refetch(); };
  return <AccountLayout>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold" data-testid="text-account-greeting">Merhaba{name ? ` ${name}` : ''} 👋</h1>
        <p className="mt-1 text-sm font-semibold">Bireysel Kullanıcı</p>
        <p className="truncate text-sm text-muted-foreground">{user?.email || 'E-posta bilgisi yok'}</p>
      </div>
      <Link href="/ilan-ver" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="link-account-create">+ İlan Ver</Link>
    </div>
    {isMock ? <div className="mt-6"><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir." text="Hesap özeti gerçek API bağlantısı gerektirir."/></div> : <>
      {(active.isError || passive.isError || favorites.isError) ? <div className="mt-6"><ErrorState message="Hesap özeti yüklenemedi." retry={retry}/></div> : <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <AccountStat label="Yayındaki İlanlar" value={active.data?.total} loading={active.isLoading}/>
        <AccountStat label="Pasif İlan" value={passive.data?.total} loading={passive.isLoading}/>
        <AccountStat label="Favoriler" value={favorites.data?.total} loading={favorites.isLoading}/>
      </div>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/ilan-ver" className="surface px-4 py-3 text-sm font-semibold">İlan Ver</Link>
        <Link href="/hesabim/ilanlar" className="surface px-4 py-3 text-sm font-semibold">İlanlarımı Gör</Link>
        <Link href="/hesabim/favoriler" className="surface px-4 py-3 text-sm font-semibold">Favorilerim</Link>
        <Link href="/hesabim/bilgiler" className="surface px-4 py-3 text-sm font-semibold">Hesap Bilgilerim</Link>
      </div>
      <section className="mt-8" aria-labelledby="recent-listings-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="recent-listings-title" className="font-display text-xl font-bold">Son İlanlarım</h2><Link href="/hesabim/ilanlar" className="text-sm font-semibold text-primary">İlanlarımın Tümünü Gör</Link></div>
        {recent.isLoading ? <div className="mt-4 grid gap-3"><div className="skeleton h-20"/><div className="skeleton h-20"/></div> : recent.isError ? <div className="mt-4"><ErrorState message="İlanlarınız yüklenemedi." retry={() => recent.refetch()}/></div> : !recent.data?.items.length ? <div className="mt-4"><p className="font-semibold">Henüz ilanınız yok.</p><p className="mt-1 text-sm text-muted-foreground">İlk ilanınızı yayınlayarak başlayın.</p><Link href="/ilan-ver" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">İlan Ver</Link></div> : <ul className="mt-4 grid gap-3">{recent.data.items.map(item => <li key={item.id}><UserPropertyRow item={item}/></li>)}</ul>}
      </section>
    </>}
  </AccountLayout>;
}
function AccountListingThumb({ url }: { url?: string | null }) {
  const image = useOwnedImage(url);
  if (image.src && !image.failed) {
    return <img src={image.src} alt="" className="h-20 w-20 shrink-0 overflow-hidden rounded-lg object-cover" onError={image.fail}/>;
  }
  return <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true" aria-busy={image.loading}><Home size={18}/></span>;
}
function UserPropertyRow({ item }: { item: UserPropertyRecord }) {
  return <div className="surface flex min-w-0 items-center gap-3 p-3">
    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true"><Home size={18}/></span>
    <div className="min-w-0">
      <p className="truncate font-semibold">{item.title}</p>
      <p className="text-sm">{money(item.price)}</p>
      <p className="text-xs text-muted-foreground">{labels[item.status] || item.status}</p>
    </div>
  </div>;
}
function MyListingsPage() {
  const isMock = DATA_MODE === 'mock';
  const { toast } = useToast();
  const invalidate = useInvalidateUserProperties();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');
  const query: MyPropertyListQuery = { page, limit: 12, ...(status ? { status } : {}) };
  const list = useMyUserProperties(query, !isMock);
  const statusMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'INACTIVE' }) => userPropertiesApi.updateUserPropertyStatus(id, { status: next }),
    onSuccess: (result) => {
      invalidate(result.id);
      toast({ title: result.status === 'INACTIVE' ? 'İlan pasife alındı.' : 'İlan tekrar yayına alındı.' });
    },
    onError: (err) => toast({ title: err instanceof ApiRequestError && err.status === 409 ? 'İlan durumu değiştirilemedi. Sayfayı yenileyip tekrar deneyin.' : showError(err) }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => userPropertiesApi.deleteUserProperty(id),
    onSuccess: (_result, id) => { invalidate(id); toast({ title: 'İlan silindi.' }); },
    onError: (err) => toast({ title: showError(err) }),
  });
  const busyId = statusMut.isPending ? statusMut.variables?.id : deleteMut.isPending ? deleteMut.variables : undefined;
  const changeStatus = (item: UserPropertyRecord) => {
    const next = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE' && !window.confirm('Bu ilanı pasife almak istediğinize emin misiniz?\n\nİlanınız artık ziyaretçiler tarafından görüntülenmeyecek.')) return;
    statusMut.mutate({ id: item.id, next });
  };
  const remove = (id: string) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) deleteMut.mutate(id);
  };
  return <AccountLayout>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl font-extrabold">İlanlarım</h1>
      <Link href="/ilan-ver" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="link-new-listing">+ Yeni İlan Ver</Link>
    </div>
    {isMock ? <div className="mt-6"><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir." text="İlan yönetimi gerçek API bağlantısı gerektirir."/></div> : <>
      <p className="mt-2 text-sm text-muted-foreground">{list.data ? `Toplam ${list.data.total} ilan` : ' '}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="İlan durumu">
        {([['', 'Tümü'], ['ACTIVE', 'Yayında'], ['INACTIVE', 'Pasif']] as const).map(([value, label]) => <button key={label} type="button" className={`rounded-full border px-3 py-2 text-sm font-semibold ${status === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}
      </div>
      {list.isLoading ? <div className="mt-5 grid gap-3"><div className="skeleton h-36"/><div className="skeleton h-36"/></div> : list.isError ? <div className="mt-5"><ErrorState message="İlanlarınız yüklenemedi." retry={() => list.refetch()}/></div> : !list.data?.items.length ? <div className="mt-5">{status ? <p className="text-sm text-muted-foreground">Bu durumda ilan yok.</p> : <EmptyState title="Henüz ilanınız yok." text="İlk ilanınızı yayınlayarak başlayın." href="/ilan-ver" action="İlan Ver"/>}</div> : <>
        <ul className="mt-5 grid gap-3">{list.data.items.map(item => {
          const pending = busyId === item.id;
          const deactivating = pending && statusMut.isPending && statusMut.variables?.next === 'INACTIVE';
          const activating = pending && statusMut.isPending && statusMut.variables?.next === 'ACTIVE';
          const deleting = pending && deleteMut.isPending;
          return <li key={item.id} className="surface min-w-0 p-4" data-testid={`card-my-property-${item.id}`}>
            <div className="flex min-w-0 gap-3">
              <AccountListingThumb url={item.coverImageUrl}/>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">{item.title}</h2>
                <p className="text-sm font-semibold">{money(item.price)} · {labels[item.listingType]} · {labels[item.propertyType]}</p>
                <p className="truncate text-sm text-muted-foreground">{item.neighborhood}, {item.district}, {item.city}</p>
                <p className="text-xs text-muted-foreground">{labels[item.status] || item.status} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status === 'ACTIVE' && <Link href={`/ilan/${item.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold" data-testid={`link-view-${item.id}`}>Görüntüle</Link>}
              <Link href={`/hesabim/ilanlar/${item.id}/duzenle`} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold" data-testid={`link-edit-${item.id}`}>Düzenle</Link>
              {item.status === 'ACTIVE' && <button type="button" disabled={pending} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60" data-testid={`button-deactivate-${item.id}`} onClick={() => changeStatus(item)}>{deactivating ? 'Pasife alınıyor...' : 'Pasife Al'}</button>}
              {item.status === 'INACTIVE' && <button type="button" disabled={pending} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60" data-testid={`button-activate-${item.id}`} onClick={() => changeStatus(item)}>{activating ? 'Yayına alınıyor...' : 'Yayına Al'}</button>}
              <button type="button" disabled={pending} className="inline-flex min-h-11 items-center rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive disabled:opacity-60" data-testid={`button-delete-${item.id}`} onClick={() => remove(item.id)}>{deleting ? 'Siliniyor...' : 'Sil'}</button>
            </div>
          </li>;
        })}</ul>
        {list.data && <Pagination page={list.data.page} limit={list.data.limit} total={list.data.total} onChange={setPage}/>}
      </>}
    </>}
  </AccountLayout>;
}
function PropertyEditor({ edit = false, mode = 'AGENT' }: { edit?: boolean; mode?: 'AGENT' | 'INDIVIDUAL' }) {
  const individual = mode === 'INDIVIDUAL';
  const isMock=DATA_MODE==='mock';
  const agentProfile=useMyAgentProfile(!isMock&&!individual);
  const suspended=!individual&&agentProfile.data?.isActive===false;
  const [,agentParams]=useRoute('/panel/ilanlar/:id/duzenle');
  const [,userParams]=useRoute('/hesabim/ilanlar/:id/duzenle');
  const id=edit?((individual?userParams?.id:agentParams?.id)||''):'';
  const [,go]=useLocation(); const qc=useQueryClient(); const invalidate=useInvalidateMarketplace(); const invalidateUser=useInvalidateUserProperties(); const {toast}=useToast();
  const cities=useApiCities();
  const [cityId,setCityId]=useState(''),[districtId,setDistrictId]=useState('');
  const [uploads,setUploads]=useState<PropertyImage[]>([]);
  const [drafts,setDrafts]=useState<DraftImage[]>([]);
  const draftsRef=useRef<DraftImage[]>([]);
  const createdIdRef=useRef<string | null>(null);
  const uploadedIds=useRef(new Map<string, string>());
  const uploadSequence=useRef<string[]>([]);
  const backendCoverId=useRef<string | null>(null);
  const orderDirty=useRef(false);
  const publishingRef=useRef(false);
  const [publishing,setPublishing]=useState(false);
  const [partialId,setPartialId]=useState<string | null>(null);
  const [imageBusy,setImageBusy]=useState(false);
  const [message,setMessage]=useState(''); const [errorMsg,setErrorMsg]=useState('');
  const setDraftList=(next: DraftImage[])=>{ draftsRef.current=next; setDrafts(next); };
  useEffect(()=>()=>{ for (const draft of draftsRef.current) URL.revokeObjectURL(draft.previewUrl); },[]);
  const districts=useApiDistricts(cityId), neighborhoods=useApiNeighborhoods(districtId);
  const agentRecord=useMineProperty(id,!individual&&edit&&!isMock);
  const userRecord=useMyUserProperty(id,individual&&edit&&!isMock);
  const record=individual?userRecord:agentRecord;
  const imageApi=individual?{
    upload:userPropertiesApi.uploadUserPropertyImage,
    cover:userPropertiesApi.setUserPropertyCover,
    remove:userPropertiesApi.deleteUserPropertyImage,
    order:userPropertiesApi.updateUserPropertyImageOrder,
  }:{
    upload:propertyImagesApi.uploadPropertyImage,
    cover:propertyImagesApi.setCoverImage,
    remove:propertyImagesApi.deletePropertyImage,
    order:propertyImagesApi.updateImageOrder,
  };

  const form=useForm<CreatePropertyRequest>({
    defaultValues:{
      title:'',
      description:'',
      listingType:'SALE',
      propertyType:'APARTMENT',
      price:'',
      grossAreaM2:'',
      netAreaM2:'',
      rooms:0,
      livingRooms:0,
      cityId:'',
      districtId:'',
      neighborhoodId:'',
      address:'',
      latitude:'',
      longitude:'',
      isFurnished:false,
      hasBalcony:false,
      hasElevator:false,
      hasParking:false,
      inSite:false,
    },
  });

  useEffect(()=>{
    if(record.data){
      const r=record.data;
      setUploads((r.images??[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder));
      if(form.formState.isDirty)return;
      setCityId(r.cityId);
      setDistrictId(r.districtId);
      form.reset({
        title:r.title,
        description:r.description,
        listingType:r.listingType,
        propertyType:r.propertyType,
        price:r.price,
        grossAreaM2:r.grossAreaM2,
        netAreaM2:r.netAreaM2??'',
        rooms:r.rooms,
        livingRooms:r.livingRooms,
        ...(r.buildingAge!==null?{buildingAge:r.buildingAge}:{buildingAge:undefined}),
        ...(r.floor!==null?{floor:r.floor}:{floor:undefined}),
        ...(r.totalFloors!==null?{totalFloors:r.totalFloors}:{totalFloors:undefined}),
        ...(r.heatingType?{heatingType:r.heatingType}:{heatingType:undefined}),
        cityId:r.cityId,
        districtId:r.districtId,
        neighborhoodId:r.neighborhoodId,
        address:r.address,
        latitude:r.latitude??'',
        longitude:r.longitude??'',
        isFurnished:r.isFurnished,
        hasBalcony:r.hasBalcony,
        hasElevator:r.hasElevator,
        hasParking:r.hasParking,
        inSite:r.inSite,
      });
    }
  },[record.data,form]);

  const mutation=useMutation({
    mutationFn:async(v:CreatePropertyRequest)=>{
      if(individual){
        const land=v.propertyType==='LAND';
        assertPropertyFields(v, land);
        return userPropertiesApi.updateUserProperty(id, propertyPayload(v, land));
      }
      const land=v.propertyType==='LAND';
      assertPropertyFields(v, land);
      const data = propertyPayload(v, land);
      return edit
        ? propertiesApi.updateProperty(id,data as UpdatePropertyRequest)
        : propertiesApi.createProperty(data);
    },
    onSuccess:async result=>{
      form.reset(form.getValues());
      if(individual){
        qc.setQueryData(keys.userProperty(result.id),(prev:typeof record.data)=>({
          ...result,
          images:result.images??prev?.images??uploads,
        }));
        invalidateUser(result.id);
        setErrorMsg('');
        toast({title:'İlanınız güncellendi.'});
        go('/hesabim/ilanlar');
        return;
      }
      qc.setQueryData(keys.myProperty(result.id),(prev:typeof record.data)=>({
        ...result,
        images:result.images??prev?.images??uploads,
      }));
      invalidate(result.id);
      setErrorMsg('');
      const msg=edit?'İlan bilgileri güncellendi.':'İlan oluşturuldu. Şimdi fotoğraflarınızı ekleyebilirsiniz.';
      setMessage(msg);
      toast({title:edit?'İlan güncellendi.':'İlan oluşturuldu.'});
      if(!edit){
        go(`/panel/ilanlar/${result.id}/duzenle`);
      }
    },
    onError:(err)=>{
      setMessage('');
      setErrorMsg(showError(err));
    },
  });

  const publish=async(v:CreatePropertyRequest)=>{
    if(publishingRef.current) return;
    publishingRef.current=true;
    setPublishing(true);
    setMessage('');
    setErrorMsg('');
    const land=v.propertyType==='LAND';
    try{
      let propertyId=createdIdRef.current;
      if(!propertyId){
        assertPropertyFields(v, land);
        for(const draft of draftsRef.current){
          const problem=imageFileError(draft.file);
          if(problem){ setErrorMsg(problem); return; }
        }
        const created=await userPropertiesApi.createUserProperty(propertyPayload(v, land));
        propertyId=created.id;
        createdIdRef.current=propertyId;
      }
      for(const draft of draftsRef.current){
        if(uploadedIds.current.has(draft.key)) continue;
        try{
          const image=await userPropertiesApi.uploadUserPropertyImage(propertyId, draft.file);
          uploadedIds.current.set(draft.key, image.id);
          uploadSequence.current.push(image.id);
          if(!backendCoverId.current) backendCoverId.current=image.id;
        }catch{
          setPartialId(propertyId);
          setErrorMsg('İlan oluşturuldu ancak bazı fotoğraflar yüklenemedi.');
          return;
        }
      }
      const currentDrafts=draftsRef.current;
      if(orderDirty.current && currentDrafts.length){
        try{
          await userPropertiesApi.updateUserPropertyImageOrder(propertyId, currentDrafts.map(d=>uploadedIds.current.get(d.key)!));
          orderDirty.current=false;
        }catch{
          setPartialId(propertyId);
          setErrorMsg('İlan oluşturuldu ancak fotoğraf sırası kaydedilemedi.');
          return;
        }
      }
      const cover=currentDrafts.find(d=>d.isCover) ?? currentDrafts[0];
      const coverId=cover ? uploadedIds.current.get(cover.key) : undefined;
      if(coverId && coverId!==backendCoverId.current){
        try{
          await userPropertiesApi.setUserPropertyCover(propertyId, coverId);
          backendCoverId.current=coverId;
        }catch{
          setPartialId(propertyId);
          setErrorMsg('İlan oluşturuldu ancak kapak fotoğrafı kaydedilemedi.');
          return;
        }
      }
      invalidate(propertyId);
      invalidateUser(propertyId);
      toast({title:'İlanınız başarıyla yayınlandı.'});
      go(`/ilan/${propertyId}`);
    }catch(error){
      setErrorMsg(showError(error));
    }finally{
      publishingRef.current=false;
      setPublishing(false);
    }
  };

  const addLocalFiles=(files:FileList|null)=>{
    if(!files) return;
    const next=[...draftsRef.current];
    for(const file of Array.from(files)){
      if(next.length>=20){
        setErrorMsg('Bir ilanda en fazla 20 canlı fotoğraf olabilir.');
        break;
      }
      const problem=imageFileError(file);
      if(problem){ setErrorMsg(problem); continue; }
      next.push({ key:crypto.randomUUID(), file, previewUrl:URL.createObjectURL(file), isCover:next.length===0 });
    }
    if(next.length && !next.some(d=>d.isCover)) next[0]={...next[0], isCover:true};
    setDraftList(next);
  };

  const moveDraft=(from:number,to:number)=>{
    const next=[...draftsRef.current];
    const [item]=next.splice(from,1);
    if(!item) return;
    next.splice(to,0,item);
    if(uploadedIds.current.size>0) orderDirty.current=true;
    setDraftList(next);
  };

  const coverDraft=(key:string)=>setDraftList(draftsRef.current.map(d=>({...d, isCover:d.key===key})));

  const removeDraft=async(key:string)=>{
    const imageId=uploadedIds.current.get(key);
    const propertyId=createdIdRef.current;
    if(imageId && propertyId){
      if(publishingRef.current) return;
      publishingRef.current=true;
      setPublishing(true);
      setErrorMsg('');
      try{
        await userPropertiesApi.deleteUserPropertyImage(propertyId, imageId);
        uploadedIds.current.delete(key);
        uploadSequence.current=uploadSequence.current.filter(id=>id!==imageId);
        if(backendCoverId.current===imageId) backendCoverId.current=uploadSequence.current[0]??null;
      }catch(error){
        setErrorMsg(showError(error));
        return;
      }finally{
        publishingRef.current=false;
        setPublishing(false);
      }
    }
    const current=draftsRef.current;
    const target=current.find(d=>d.key===key);
    if(target) URL.revokeObjectURL(target.previewUrl);
    let remaining=current.filter(d=>d.key!==key);
    if(target?.isCover && remaining[0]) remaining=remaining.map((d,i)=>({...d, isCover:i===0}));
    setDraftList(remaining);
  };

  const upload=async(file:File)=>{
    const problem=imageFileError(file);
    if(problem){
      setErrorMsg(problem);
      return;
    }
    setImageBusy(true);
    setErrorMsg('');
    try{
      const result=await imageApi.upload(id,file);
      setUploads(prev=>[...prev,{id:result.id,url:result.url,sortOrder:result.sortOrder,isCover:result.isCover}].sort((a,b)=>a.sortOrder-b.sortOrder));
      if(individual) invalidateUser(id); else invalidate(id);
      setMessage('Fotoğraf yüklendi.');
      toast({title:'Fotoğraf yüklendi.'});
    }catch(e){
      setErrorMsg(showError(e));
    }finally{
      setImageBusy(false);
    }
  };

  const addFiles=async(files:FileList|null)=>{
    if(!files)return;
    let currentCount=uploads.length;
    for(const file of Array.from(files)){
      if(currentCount>=20){
        setErrorMsg('Bir ilanda en fazla 20 canlı fotoğraf olabilir.');
        break;
      }
      await upload(file);
      currentCount+=1;
    }
  };

  const chooseCover=async(imageId:string)=>{
    setImageBusy(true);
    setErrorMsg('');
    try{
      await imageApi.cover(id,imageId);
      setUploads(xs=>xs.map(x=>({...x,isCover:x.id===imageId})));
      if(individual) invalidateUser(id); else invalidate(id);
      setMessage('Kapak fotoğrafı güncellendi.');
    }catch(e){
      setErrorMsg(showError(e));
    }finally{
      setImageBusy(false);
    }
  };

  const deleteImage=async(imageId:string)=>{
    setImageBusy(true);
    setErrorMsg('');
    try{
      await imageApi.remove(id,imageId);
      setUploads(xs=>{
        const removed=xs.find(x=>x.id===imageId);
        const remaining=xs.filter(x=>x.id!==imageId);
        if(removed?.isCover&&remaining.length>0&&!remaining.some(x=>x.isCover)){
          return remaining.map((x,idx)=>({...x,isCover:idx===0}));
        }
        return remaining;
      });
      if(individual) invalidateUser(id); else invalidate(id);
      setMessage('Fotoğraf silindi.');
    }catch(e){
      setErrorMsg(showError(e));
    }finally{
      setImageBusy(false);
    }
  };

  const reorder=async(from:number,to:number)=>{
    const previous=[...uploads];
    const next=[...uploads];
    const [item]=next.splice(from,1);
    next.splice(to,0,item);
    const reindexed=next.map((img,idx)=>({...img,sortOrder:idx}));
    setUploads(reindexed);
    setImageBusy(true);
    setErrorMsg('');
    try{
      await imageApi.order(id,reindexed.map(x=>x.id));
      if(individual) invalidateUser(id); else invalidate(id);
      setMessage('Fotoğraf sıralaması güncellendi.');
    }catch(e){
      setUploads(previous);
      setErrorMsg(showError(e));
    }finally{
      setImageBusy(false);
    }
  };

  const field=(name:keyof CreatePropertyRequest,label:string,type='text',required=true,placeholder?:string,extraRules?:RegisterOptions<CreatePropertyRequest,keyof CreatePropertyRequest>)=><label key={name} className="grid min-w-0 gap-1.5 text-sm font-semibold">{label}{required?' *':''}<input className={`${inputClass} min-w-0`} type={type} required={required} disabled={suspended} aria-invalid={Boolean(form.formState.errors[name])} step={type==='number'?'1':undefined} placeholder={placeholder} data-testid={`input-prop-${name}`} {...form.register(name,{required:required?`${label} zorunludur.`:false,...(type==='number'?{setValueAs:(v:string)=>v===''||v===null||v===undefined?undefined:Number(v)}:{}),...(name==='title'?{minLength:{value:5,message:'Başlık en az 5 karakter olmalıdır.'},maxLength:{value:160,message:'Başlık en fazla 160 karakter olabilir.'}}:{}),...(name==='address'?{minLength:{value:5,message:'Açık adres en az 5 karakter olmalıdır.'},maxLength:{value:300,message:'Açık adres en fazla 300 karakter olabilir.'}}:{}),...extraRules})}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors[name]?.message as string}</span></label>;

  const land=form.watch('propertyType')==='LAND';
  const busy=individual&&!edit?publishing:mutation.isPending;
  const frame=(children:ReactNode)=>individual&&edit
    ? <AccountLayout>{children}</AccountLayout>
    : individual
      ? <PublicLayout><div className="mx-auto max-w-4xl px-5 py-10">{children}</div></PublicLayout>
      : <PanelLayout>{children}</PanelLayout>;
  const features:(string[])[]=[['isFurnished','Eşyalı'],['hasBalcony','Balkon'],...(land?[]:[['hasElevator','Asansör']]),['hasParking','Otopark'],['inSite','Site içinde']];

  useUnsavedChanges(!suspended && (form.formState.isDirty || (individual && !edit && drafts.length > 0)));
  const missingRecord=edit&&!id;
  if(isMock)return frame(<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="İlan oluşturmak ve düzenlemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>);
  if(edit&&id&&(record.isLoading||record.isPending))return frame(<div className="surface p-8"><div className="skeleton h-80"/></div>);
  if(missingRecord||(edit&&record.error)){
    const notFound=missingRecord||(record.error instanceof ApiRequestError&&(record.error.status===404||(individual&&record.error.status===400)));
    return frame(notFound?<EmptyState title={individual?'İlan bulunamadı veya bu ilana erişim yetkiniz yok.':'İlan bulunamadı'} text={individual?'Adres hatalı olabilir ya da ilan başka bir hesaba aittir.':'Bu ilan mevcut değil, silinmiş veya başka bir hesaba ait.'} href={individual?'/hesabim/ilanlar':'/panel/ilanlar'} action="İlanlarıma dön"/>:<ErrorState retry={()=>record.refetch()} message={showError(record.error)}/>);
  }

  const heading=individual&&!edit?'İlan Ver':edit?'İlanı Düzenle':'Yeni İlan';
  const intro=individual&&!edit?'Bilgileri doldurun, fotoğrafları seçin ve ilanı yayınlayın.':edit?'İlan bilgilerini ve görsellerini güncelleyin.':'Portföyünüze yeni bir ilan ekleyin.';
  const confirmImageDelete=()=>window.confirm('Fotoğrafı silmek istediğinize emin misiniz?');
  return frame(<>
    {suspended&&<SuspendedAgentNotice/>}
    <div className="mx-auto mb-5 w-full min-w-0 max-w-4xl">
      <Link href={individual&&edit?'/hesabim/ilanlar':individual?'/ilanlar':'/panel/ilanlar'} className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft size={15}/> {individual&&edit?'İlanlarıma dön':'İlanlara dön'}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
          {edit&&record.data?.title&&<p className="mt-2 text-sm font-semibold [overflow-wrap:anywhere]" data-testid="text-editor-title">{record.data.title}</p>}
        </div>
        {edit&&record.data&&<span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary" data-testid="badge-editor-status">Durum: {labels[record.data.status]} · {record.data.currency}</span>}
      </div>
    </div>

    <form className="mx-auto grid w-full min-w-0 max-w-4xl gap-5" aria-busy={busy||imageBusy} data-testid={individual&&edit?'form-user-property-edit':individual?'form-ilan-ver':'form-agent-property'} onSubmit={form.handleSubmit(v=>{ if(suspended)return; if(individual&&!edit){ void publish(v); return; } setMessage(''); setErrorMsg(''); mutation.mutate(v); })}>
      <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="section-listing">
        <h3 id="section-listing" className="font-display text-xl font-bold">İlan Bilgileri</h3>
        <p className="mt-1 text-sm text-muted-foreground">Başlık, açıklama, ilan türü ve fiyat.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FilterSelect compact disabled={suspended} label="İlan türü *" value={form.watch('listingType')} onChange={v=>form.setValue('listingType',(v||'SALE') as CreatePropertyRequest['listingType'],{shouldDirty:true})} options={[['SALE','Satılık'],['RENT','Kiralık']]}/>
          <FilterSelect compact disabled={suspended} label="Emlak tipi *" value={form.watch('propertyType')} onChange={v=>form.setValue('propertyType',(v||'APARTMENT') as CreatePropertyRequest['propertyType'],{shouldDirty:true})} options={['APARTMENT','HOUSE','VILLA','LAND','WORKPLACE'].map(k=>[k,labels[k]])}/>
          <div className="sm:col-span-2">{field('title','İlan başlığı','text',true,'5–160 karakter')}</div>
          {field('price','Fiyat','text',true,'Örn. 4250000.50',{pattern:{value:/^\d+(\.\d{1,2})?$/,message:'Fiyat geçerli değildir.'},validate:(val)=>Number(val)>0||'Fiyat 0’dan büyük olmalıdır.'})}
          <label className="grid min-w-0 gap-1.5 text-sm font-semibold sm:col-span-2">Açıklama *<textarea required disabled={suspended} aria-invalid={Boolean(form.formState.errors.description)} className={`${inputClass} h-32 min-w-0 py-3`} data-testid="input-prop-description" {...form.register('description',{required:'Açıklama zorunludur.',minLength:{value:20,message:'Açıklama en az 20 karakter olmalıdır.'},maxLength:{value:5000,message:'Açıklama en fazla 5000 karakter olabilir.'}})}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.description?.message as string}</span></label>
        </div>
      </section>

      <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="section-location">
        <h3 id="section-location" className="font-display text-xl font-bold">Konum Bilgileri</h3>
        <p className="mt-1 text-sm text-muted-foreground">Şehir, ilçe ve mahalle birlikte seçilir.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FilterSelect compact disabled={suspended} label="Şehir *" value={cityId} onChange={v=>{setCityId(v);setDistrictId('');form.setValue('cityId',v,{shouldDirty:true});form.setValue('districtId','',{shouldDirty:true});form.setValue('neighborhoodId','',{shouldDirty:true});}} options={(cities.data||[]).map(c=>[c.id,c.name])} empty={cities.isLoading?'Şehirler yükleniyor…':'Seçin'}/>
          <FilterSelect compact label="İlçe *" value={districtId} onChange={v=>{setDistrictId(v);form.setValue('districtId',v,{shouldDirty:true});form.setValue('neighborhoodId','',{shouldDirty:true});}} options={(districts.data||[]).map(c=>[c.id,c.name])} disabled={suspended||!cityId} empty={!cityId?'Önce şehir seçin':districts.isLoading?'İlçeler yükleniyor…':'Seçin'}/>
          <FilterSelect compact label="Mahalle *" value={form.watch('neighborhoodId')} onChange={v=>form.setValue('neighborhoodId',v,{shouldDirty:true})} options={(neighborhoods.data||[]).map(c=>[c.id,c.name])} disabled={suspended||!districtId} empty={!districtId?'Önce ilçe seçin':neighborhoods.isLoading?'Mahalleler yükleniyor…':'Seçin'}/>
        </div>
        <label className="mt-4 grid min-w-0 gap-1.5 text-sm font-semibold">Açık adres *<textarea required disabled={suspended} rows={3} aria-invalid={Boolean(form.formState.errors.address)} placeholder="Mahalle, cadde/sokak, bina no ve diğer adres bilgilerini girin." className={`${inputClass} min-h-24 w-full min-w-0 resize-y py-3`} data-testid="input-prop-address" {...form.register('address',{required:'Açık adres zorunludur.',minLength:{value:5,message:'Açık adres en az 5 karakter olmalıdır.'},maxLength:{value:300,message:'Açık adres en fazla 300 karakter olabilir.'}})}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.address?.message as string}</span></label>
      </section>

      <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="section-features">
        <h3 id="section-features" className="font-display text-xl font-bold">Emlak Özellikleri</h3>
        <p className="mt-1 text-sm text-muted-foreground">Alan, oda ve bina bilgileri.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {field('grossAreaM2','Brüt alan (m²)','text',true,'Örn. 145.00',{pattern:{value:/^\d+(\.\d{1,2})?$/,message:'Brüt alan geçerli değildir.'},validate:(val)=>Number(val)>0||'Brüt alan 0’dan büyük olmalıdır.'})}
          {field('netAreaM2','Net alan (m²)','text',false,'Örn. 125.00',{pattern:{value:/^\d+(\.\d{1,2})?$/,message:'Net alan geçerli değildir.'},validate:(val)=>!val||Number(val)>0||'Net alan 0’dan büyük olmalıdır.'})}
          {!land&&field('rooms','Oda sayısı','number',true,'0–50',{min:{value:0,message:'En az 0 olabilir.'},max:{value:50,message:'En fazla 50 olabilir.'}})}
          {!land&&field('livingRooms','Salon sayısı','number',true,'0–20',{min:{value:0,message:'En az 0 olabilir.'},max:{value:20,message:'En fazla 20 olabilir.'}})}
          {field('buildingAge','Bina yaşı','number',false,'0–300',{min:{value:0,message:'En az 0 olabilir.'},max:{value:300,message:'En fazla 300 olabilir.'}})}
          {!land&&field('floor','Bulunduğu kat','number',false,'-5 ile 200 arası',{min:{value:-5,message:'En az -5 olabilir.'},max:{value:200,message:'En fazla 200 olabilir.'}})}
          {!land&&field('totalFloors','Toplam kat','number',false,'1–200',{min:{value:1,message:'En az 1 olabilir.'},max:{value:200,message:'En fazla 200 olabilir.'}})}
          {!land&&<FilterSelect compact disabled={suspended} label="Isıtma" value={form.watch('heatingType')||''} onChange={v=>form.setValue('heatingType',v?v as NonNullable<CreatePropertyRequest['heatingType']>:undefined,{shouldDirty:true})} options={['COMBI','CENTRAL','FLOOR_HEATING','STOVE','NONE','OTHER'].map(k=>[k,labels[k]])} empty="Belirtilmedi"/>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map(([k,l])=><label key={k} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium"><input type="checkbox" disabled={suspended} className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={`checkbox-prop-${k}`} {...form.register(k as keyof CreatePropertyRequest)}/>{l}</label>)}
        </div>
        {land&&<p className="mt-3 text-xs text-muted-foreground">Arsa ilanında oda, kat, ısıtma ve asansör alanları istenmez. Kayıtta oda ve salon 0 gönderilir.</p>}
      </section>

      <section className="surface min-w-0 p-5 sm:p-6" data-testid="section-property-images" aria-labelledby="section-images">
        <h3 id="section-images" className="font-display text-xl font-bold">Fotoğraflar</h3>
        <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG veya WebP · en fazla 10 MB / fotoğraf · en çok 20 fotoğraf</p>
        {individual&&!edit?<>
          <label className={`mt-4 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm font-semibold hover:border-primary focus-within:ring-2 focus-within:ring-primary ${busy?'pointer-events-none opacity-60':''}`}>
            {busy?'Fotoğraf işlemi yapılıyor…':'+ Fotoğraf Yükle'}
            <input className="sr-only" type="file" disabled={busy} data-testid="input-user-property-images" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={e=>{addLocalFiles(e.target.files);e.currentTarget.value='';}}/>
          </label>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((image,i)=><div key={image.key} className="min-w-0 overflow-hidden rounded-xl border border-border" data-testid={`card-draft-image-${image.key}`}>
              <div className="relative">
                <img src={image.previewUrl} alt="Seçilen ilan fotoğrafı" className="aspect-[4/3] w-full object-cover"/>
                {image.isCover&&<span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">Kapak Görseli</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 p-2">
                <button type="button" disabled={busy||image.isCover} data-testid={`button-cover-draft-${image.key}`} onClick={()=>coverDraft(image.key)} className="text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">{image.isCover?'Kapak':'Kapak yap'}</button>
                <button type="button" disabled={busy} data-testid={`button-delete-draft-${image.key}`} onClick={()=>{if(confirmImageDelete())void removeDraft(image.key);}} className="text-xs text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">Sil</button>
              </div>
              <div className="flex items-center justify-between border-t border-border px-2 py-1.5 text-xs">
                <button type="button" disabled={busy||i===0} onClick={()=>moveDraft(i,i-1)} aria-label="Öne taşı" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35"><ChevronLeft size={14}/>Öne taşı</button>
                <button type="button" disabled={busy||i===drafts.length-1} onClick={()=>moveDraft(i,i+1)} aria-label="Geri taşı" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35">Geri taşı<ChevronRight size={14}/></button>
              </div>
            </div>)}
          </div>
          {!drafts.length&&<p className="mt-3 text-xs text-muted-foreground">Fotoğraf seçmek zorunlu değil. Seçilenler ilan yayınlanırken yüklenir.</p>}
        </>:edit?<>
          <label className={`mt-4 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm font-semibold hover:border-primary focus-within:ring-2 focus-within:ring-primary ${imageBusy||suspended?'pointer-events-none opacity-60':''}`}>
            {imageBusy?'Fotoğraf işlemi yapılıyor…':'+ Fotoğraf Yükle'}
            <input className="sr-only" type="file" disabled={imageBusy||suspended} data-testid="input-property-images" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{void addFiles(e.target.files);e.currentTarget.value='';}}/>
          </label>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uploads.map((image,i)=><div key={image.id} className="min-w-0 overflow-hidden rounded-xl border border-border" data-testid={`card-property-image-${image.id}`}>
              <div className="relative">
                <EditorImage url={image.url} individual={individual}/>
                {image.isCover&&<span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">Kapak Görseli</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 p-2">
                <button type="button" disabled={imageBusy||suspended||image.isCover} data-testid={`button-cover-image-${image.id}`} onClick={()=>void chooseCover(image.id)} className="text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">{image.isCover?'Kapak':'Kapak yap'}</button>
                <button type="button" disabled={imageBusy||suspended} data-testid={`button-delete-image-${image.id}`} onClick={()=>{if(confirmImageDelete())void deleteImage(image.id);}} className="text-xs text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">Sil</button>
              </div>
              <div className="flex items-center justify-between border-t border-border px-2 py-1.5 text-xs">
                <button type="button" disabled={imageBusy||suspended||i===0} data-testid={`button-move-prev-${image.id}`} onClick={()=>void reorder(i,i-1)} aria-label="Öne taşı" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35"><ChevronLeft size={14}/>Öne taşı</button>
                <button type="button" disabled={imageBusy||suspended||i===uploads.length-1} data-testid={`button-move-next-${image.id}`} onClick={()=>void reorder(i,i+1)} aria-label="Geri taşı" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35">Geri taşı<ChevronRight size={14}/></button>
              </div>
            </div>)}
          </div>
          {!uploads.length&&<p className="mt-3 text-xs text-muted-foreground">Bu ilana henüz fotoğraf eklenmemiş.</p>}
        </>:<p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">İlanı ilk kez kaydettikten sonra fotoğraflarınızı ekleyebilirsiniz.</p>}
      </section>

      <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="section-publish">
        <h3 id="section-publish" className="font-display text-xl font-bold">{edit?'Kaydetme':'Yayın'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{edit?'Değişiklikler bu ilana yazılır.':individual?'İlan ve seçilen fotoğraflar birlikte yayınlanır.':'Kayıttan sonra fotoğrafları ekleyebilirsiniz.'}</p>
        {message&&<p role="status" className="mt-4 text-sm text-primary" data-testid="text-property-feedback">{message}</p>}
        {errorMsg&&<p role="alert" className="mt-4 text-sm text-destructive" data-testid="text-property-error">{errorMsg}</p>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link href={individual?'/ilanlar':'/panel/ilanlar'} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Vazgeç</Link>
          {partialId&&<Link href={`/ilan/${partialId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-view-created-property">İlanı görüntüle</Link>}
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60" disabled={busy||imageBusy||suspended} data-testid="button-submit-property">{individual&&!edit?(publishing?'İlan yayınlanıyor...':partialId?'Tekrar dene':'İlanı Yayınla'):mutation.isPending?'Kaydediliyor…':edit?'Değişiklikleri Kaydet':'İlanı oluştur'}</button>
        </div>
      </section>
    </form>
  </>);
}
function UserListingPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, go] = useLocation();
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'AGENT') go('/panel/ilanlar/yeni');
  }, [isLoading, isAuthenticated, user, go]);
  if (isLoading || !isAuthenticated || !user) return null;
  if (user.role === 'AGENT') return null;
  if (user.role !== 'USER') {
    return <PublicLayout><div className="mx-auto max-w-5xl px-5 py-16"><EmptyState title="Bu sayfa bireysel ilan içindir" text="Yönetici hesabıyla bireysel ilan formu kullanılmaz." href="/admin" action="Yönetime dön"/></div></PublicLayout>;
  }
  return <PropertyEditor mode="INDIVIDUAL"/>;
}
function ProfileLogo({ url, alt, className, testId }: { url?: string | null; alt: string; className: string; testId?: string }) {
  const image = useOwnedImage(url);
  if (image.loading) return <div className={`bg-muted ${className}`} aria-busy="true" aria-label="Logo yükleniyor"/>;
  if (image.src && !image.failed) return <img src={image.src} alt={alt} onError={image.fail} className={className} data-testid={testId}/>;
  return <div className={`grid place-items-center bg-muted text-primary ${className}`} role="img" aria-label="Logo yok"><Building2 size={28}/></div>;
}
function AgentProfilePage() {
  const isMock=DATA_MODE==='mock';
  const qc=useQueryClient(); const {toast}=useToast();
  const q=useMyAgentProfile(!isMock);
  const form=useForm<UpdateAgentProfileRequest>({defaultValues:{companyName:'',phone:'',email:'',address:'',description:''}});
  const [notice,setNotice]=useState(''); const [errorMsg,setErrorMsg]=useState(''); const [feedbackFor,setFeedbackFor]=useState<'logo'|'profile'|null>(null);
  useEffect(()=>{
    if(!q.data||form.formState.isDirty)return;
    form.reset({
      companyName:q.data.companyName,
      phone:q.data.phone,
      email:q.data.email,
      address:q.data.address,
      description:q.data.description||'',
    });
  },[q.data,form]);

  const update=useMutation({
    mutationFn:(v:UpdateAgentProfileRequest)=>agentsApi.updateMyAgentProfile(v),
    onSuccess:(saved)=>{
      form.reset({
        companyName:saved.companyName,
        phone:saved.phone,
        email:saved.email,
        address:saved.address,
        description:saved.description||'',
      });
      qc.setQueryData(keys.agentMe,saved);
      void qc.invalidateQueries({queryKey:keys.agentMe});
      if(saved.slug)void qc.invalidateQueries({queryKey:keys.agent(saved.slug)});
      setErrorMsg('');
      setNotice('Emlakçı profili güncellendi.');
      toast({title:'Emlakçı profili güncellendi.'});
    },
    onError:(err)=>{
      setNotice('');
      setErrorMsg(showError(err));
    },
  });

  const logo=useMutation({
    mutationFn:(file:File)=>agentsApi.uploadAgentLogo(file),
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:keys.agentMe});
      if(q.data?.slug)void qc.invalidateQueries({queryKey:keys.agent(q.data.slug)});
      setErrorMsg('');
      setNotice('Logo güncellendi.');
      toast({title:'Logo güncellendi.'});
    },
    onError:(err)=>{
      setNotice('');
      setErrorMsg(showError(err));
    },
  });

  const onLogoSelect=(file:File|undefined)=>{
    if(!file)return;
    setFeedbackFor('logo');
    setNotice('');
    setErrorMsg('');
    const allowedMimes=['image/jpeg','image/png','image/webp'];
    const lower=file.name.toLowerCase();
    const validExt=lower.endsWith('.jpg')||lower.endsWith('.jpeg')||lower.endsWith('.png')||lower.endsWith('.webp');
    if((file.type&&!allowedMimes.includes(file.type))||(!file.type&&!validExt)){
      setErrorMsg('Logo yalnızca JPEG, PNG veya WebP formatında olabilir.');
      return;
    }
    if(file.size>5*1024*1024){
      setErrorMsg('Logo 5 MB sınırını aşamaz.');
      return;
    }
    logo.mutate(file);
  };

  useUnsavedChanges(!isMock && q.data?.isActive !== false && form.formState.isDirty);
  if(isMock)return <PanelLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı profilinizi yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></PanelLayout>;
  const suspended=q.data?.isActive===false;

  const readOnly=(label:string,value:string)=><div className="min-w-0"><p className="text-sm font-semibold">{label}</p><p className="mt-1.5 min-h-11 break-words rounded-xl border border-border bg-muted px-3.5 py-3 text-sm [overflow-wrap:anywhere]">{value}</p></div>;
  const feedback=(where:'logo'|'profile')=>feedbackFor===where?<>
    {notice&&<p role="status" className="mt-4 break-words text-sm text-primary [overflow-wrap:anywhere]" data-testid="text-agent-profile-notice">{notice}</p>}
    {errorMsg&&<p role="alert" className="mt-4 break-words text-sm text-destructive [overflow-wrap:anywhere]" data-testid="text-agent-profile-error">{errorMsg}</p>}
  </>:null;
  return <PanelLayout>
    {suspended&&<SuspendedAgentNotice/>}
    {q.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data&&<div className="mx-auto grid w-full min-w-0 max-w-4xl gap-5">
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-extrabold">Emlakçı Profilim</h2>
        <p className="mt-1 text-sm text-muted-foreground">Müşterilerinize gösterilen firma bilgilerinizi yönetin.</p>
      </div>
      <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-profile-overview">
        <h3 id="agent-profile-overview" className="font-display text-xl font-bold">Profil Özeti</h3>
        <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileLogo url={q.data.logoUrl} alt={`${q.data.companyName} logosu`} className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl object-cover"/>
            <div className="min-w-0">
              <p className="break-words font-bold [overflow-wrap:anywhere]">{q.data.companyName}</p>
              <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${q.data.isActive?'bg-secondary text-primary':'bg-amber-50 text-amber-950'}`} data-testid="badge-agent-profile-status">{q.data.isActive?'Aktif':'Askıya Alındı'}</p>
              <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{q.data.email}</p>
              <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{q.data.phone}</p>
            </div>
          </div>
          {q.data.isActive&&<Link href={`/emlakci/${q.data.slug}`} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto" data-testid="link-agent-public-profile">Public Profili Görüntüle</Link>}
        </div>
      </section>
      <form className="grid min-w-0 gap-5" aria-busy={update.isPending} onSubmit={form.handleSubmit(v=>{if(suspended||update.isPending)return;setFeedbackFor('profile');setNotice('');setErrorMsg('');update.mutate(v);})}>
        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
          <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-logo-heading">
            <h3 id="agent-logo-heading" className="font-display text-xl font-bold">Şirket Logosu</h3>
            <p className="mt-1 text-sm text-muted-foreground">Firmanızı temsil eden logoyu yükleyin.</p>
            <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <ProfileLogo url={q.data.logoUrl} alt="Şirket logosu" className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl object-cover" testId="img-agent-logo"/>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">JPEG, PNG veya WebP · en fazla 5 MB</p>
                <label className={`mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary sm:w-auto ${logo.isPending||suspended?'pointer-events-none opacity-60':''}`}>
                  {logo.isPending?'Yükleniyor…':q.data.logoUrl?'Logoyu Değiştir':'Logo Yükle'}
                  <input className="sr-only" type="file" disabled={logo.isPending||suspended} aria-label="Logo yükle" data-testid="input-agent-logo" accept="image/jpeg,image/png,image/webp" onChange={e=>{onLogoSelect(e.target.files?.[0]);e.currentTarget.value='';}}/>
                </label>
              </div>
            </div>
            {feedback('logo')}
          </section>
          <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-company-heading">
            <h3 id="agent-company-heading" className="font-display text-xl font-bold">Firma Bilgileri</h3>
            <div className="mt-5 grid gap-4">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Firma adı *<input className={`${inputClass} min-w-0`} data-testid="input-agent-companyName" {...form.register('companyName',{required:'Firma adı zorunludur.',minLength:{value:2,message:'Firma adı en az 2 karakter olmalıdır.'},maxLength:{value:120,message:'Firma adı en fazla 120 karakter olabilir.'}})} disabled={suspended}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.companyName?.message}</span></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold"><span>Açıklama</span><span className="font-normal text-muted-foreground">En fazla 2000 karakter.</span><textarea className={`${inputClass} h-32 min-w-0 py-3`} data-testid="input-agent-description" {...form.register('description',{maxLength:{value:2000,message:'Açıklama en fazla 2000 karakter olabilir.'}})} disabled={suspended}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.description?.message}</span></label>
            </div>
          </section>
        </div>
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-contact-heading">
          <h3 id="agent-contact-heading" className="font-display text-xl font-bold">İletişim Bilgileri</h3>
          <p className="mt-1 text-sm text-muted-foreground">Public profilde görünen telefon ve e-posta.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Telefon *<input className={`${inputClass} min-w-0`} type="tel" data-testid="input-agent-phone" {...form.register('phone',{required:'Telefon zorunludur.',minLength:{value:7,message:'Telefon en az 7 karakter olmalıdır.'},maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}})} disabled={suspended}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.phone?.message}</span></label>
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold">E-posta *<input className={`${inputClass} min-w-0`} type="email" data-testid="input-agent-email" {...form.register('email',{required:'E-posta zorunludur.',maxLength:{value:254,message:'E-posta en fazla 254 karakter olabilir.'}})} disabled={suspended}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.email?.message}</span></label>
          </div>
        </section>
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-address-heading">
          <h3 id="agent-address-heading" className="font-display text-xl font-bold">Adres Bilgileri</h3>
          <p className="mt-1 text-sm text-muted-foreground">Şehir, ilçe ve vergi numarası başvuru kaydından gelir.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {readOnly('Şehir',q.data.city)}
            {readOnly('İlçe',q.data.district)}
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold sm:col-span-2">Açık adres *<input className={`${inputClass} min-w-0`} data-testid="input-agent-address" {...form.register('address',{required:'Açık adres zorunludur.',minLength:{value:5,message:'Açık adres en az 5 karakter olmalıdır.'},maxLength:{value:300,message:'Açık adres en fazla 300 karakter olabilir.'}})} disabled={suspended}/><span className="min-h-4 text-xs text-destructive">{form.formState.errors.address?.message}</span></label>
            {readOnly('Vergi numarası',q.data.taxNumber)}
            {readOnly('Profil adresi',`/emlakci/${q.data.slug}`)}
          </div>
        </section>
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="agent-save-heading">
          <h3 id="agent-save-heading" className="font-display text-xl font-bold">Kaydet</h3>
          {feedback('profile')}
          <button type="submit" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-6 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto" disabled={update.isPending||suspended} data-testid="button-save-agent-profile">{update.isPending?'Kaydediliyor…':'Değişiklikleri Kaydet'}</button>
        </section>
      </form>
    </div>}
  </PanelLayout>;
}

function AdminLayout({ children }: { children: ReactNode }) {
  return <Guard roles={['ADMIN']}>
    <div className="min-h-[75vh] bg-[#f4f3ed]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <YuvaLogo />
            <div className="sm:border-l sm:border-[#d8dbd1] sm:pl-5">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Yuva operasyonları</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold">Yönetim paneli</h1>
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-muted-foreground">Ana sayfaya dön</Link>
        </div>
        <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
          <aside className="surface h-fit p-3">
            <nav className="grid gap-1">{[['/admin','Genel Bakış'],['/admin/kullanicilar','Kullanıcılar'],['/admin/basvurular','Emlakçı başvuruları'],['/admin/emlakcilar','Emlakçılar'],['/admin/ilanlar','İlanlar'],['/admin/audit-logs','İşlem kayıtları']].map(([href,label])=><Link key={href} href={href} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-secondary hover:text-primary">{label}</Link>)}</nav>
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  </Guard>;
}
function AdminHome() {
  const isMock=DATA_MODE==='mock';
  const users=useAdminUsers({page:1,limit:1},!isMock);
  const pendingApps=useAdminApps({page:1,limit:1,status:'PENDING'},!isMock);
  const agents=useAdminAgents({page:1,limit:1},!isMock);
  const properties=useAdminProperties({page:1,limit:1,deleted:'false'},!isMock);
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Yönetim panelini kullanmak için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout>
    <div className="surface p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">Yönetim alanı</p><h2 className="mt-2 font-display text-3xl font-extrabold">Merhaba</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kullanıcıları, emlakçı başvurularını ve ilan moderasyonunu buradan yönetin. Yalnızca gerçek liste toplamları gösterilir; tahmini metrik üretilmez.</p></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="surface p-5"><small className="text-xs text-muted-foreground">Toplam kullanıcı</small><p className="mt-1 text-3xl font-extrabold" data-testid="stat-admin-users">{users.data?.total??'—'}</p><small className="text-xs text-muted-foreground">Kayıtlı tüm hesaplar</small></div>
      <div className="surface p-5"><small className="text-xs text-muted-foreground">Bekleyen başvuru</small><p className="mt-1 text-3xl font-extrabold" data-testid="stat-admin-pending-apps">{pendingApps.data?.total??'—'}</p><small className="text-xs text-muted-foreground">İnceleme bekleyen (PENDING)</small></div>
      <div className="surface p-5"><small className="text-xs text-muted-foreground">Kayıtlı emlakçı</small><p className="mt-1 text-3xl font-extrabold" data-testid="stat-admin-agents">{agents.data?.total??'—'}</p><small className="text-xs text-muted-foreground">Onaylı emlakçı profilleri</small></div>
      <div className="surface p-5"><small className="text-xs text-muted-foreground">Silinmemiş ilanlar</small><p className="mt-1 text-3xl font-extrabold" data-testid="stat-admin-properties">{properties.data?.total??'—'}</p><small className="text-xs text-muted-foreground">Moderasyon kapsamındaki kayıtlar</small></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {[['/admin/kullanicilar','Kullanıcıları incele','Hesap rolü ve aktiflik durumlarını görüntüleyin.'],['/admin/basvurular','Başvuruları incele','Yeni emlakçı başvurularını değerlendirin.'],['/admin/emlakcilar','Emlakçı kayıtları','Hesap ve profil durumlarını ayrı ayrı yönetin.'],['/admin/ilanlar','İlan moderasyonu','İlanları gözden geçirin ve gerektiğinde müdahale edin.'],['/admin/audit-logs','Audit kayıtları','Yönetim değişikliklerini salt okunur görüntüleyin.']].map(([href,label,text])=><Link key={href} href={href} className="surface p-5 transition hover:-translate-y-0.5 hover:border-primary"><h3 className="font-bold">{label} <ArrowRight className="inline" size={15}/></h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></Link>)}
    </div>
  </AdminLayout>;
}
function AdminUsersPage() {
  const isMock=DATA_MODE==='mock';
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Kullanıcıları yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout><Suspense fallback={<div className="surface p-6"><div className="skeleton h-48"/></div>}><AdminUsersPanel/></Suspense></AdminLayout>;
}
function StatusPill({active}:{active:boolean}) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{active?'Aktif':'Pasif'}</span>; }
function AdminUserDetailPage() {
  const isMock=DATA_MODE==='mock';
  const [match]=useRoute('/admin/kullanicilar/:id');
  if(!match)return null;
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Kullanıcı detayını görüntülemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout><Suspense fallback={<div className="surface p-6"><div className="skeleton h-48"/></div>}><AdminUserDetailPanel/></Suspense></AdminLayout>;
}
function Info({label,value}:{label:string;value:string}) { return <div><small className="text-xs text-muted-foreground">{label}</small><p className="mt-1 font-semibold">{value}</p></div>; }

function AdminApplicationsPage() {
  const isMock=DATA_MODE==='mock';
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı başvurularını incelemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout><Suspense fallback={<div className="surface p-6"><div className="skeleton h-48"/></div>}><AdminApplicationsPanel/></Suspense></AdminLayout>;
}
function AdminApplicationDetailPage() {
  const isMock=DATA_MODE==='mock';
  const [match]=useRoute('/admin/basvurular/:id');
  if(!match)return null;
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Başvuru detayını görüntülemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout><Suspense fallback={<div className="surface p-6"><div className="skeleton h-48"/></div>}><AdminApplicationDetailPanel/></Suspense></AdminLayout>;
}
function AdminAgentsPage() {
  const isMock=DATA_MODE==='mock';
  const [companyName,setCompanyName]=useState(''),[city,setCity]=useState(''),[district,setDistrict]=useState(''),[active,setActive]=useState(''),[page,setPage]=useState(1);
  const data=useAdminAgents({
    page,
    limit:20,
    ...(companyName.trim()?{companyName:companyName.trim()}:{}),
    ...(city.trim()?{city:city.trim()}:{}),
    ...(district.trim()?{district:district.trim()}:{}),
    ...(active?{isActive:active as 'true'|'false'}:{}),
  },!isMock);
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçıları yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout>
    <SectionTitle eyebrow="Emlakçı yönetimi" title="Emlakçılar" description="Emlakçı profili ve bağlı kullanıcı hesabı farklı durumlara sahiptir."/>
    <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className={inputClass} placeholder="Firma adında ara" data-testid="input-admin-agents-company" value={companyName} onChange={e=>{setCompanyName(e.target.value);setPage(1);}}/>
      <input className={inputClass} placeholder="Şehirde ara" data-testid="input-admin-agents-city" value={city} onChange={e=>{setCity(e.target.value);setPage(1);}}/>
      <input className={inputClass} placeholder="İlçede ara" data-testid="input-admin-agents-district" value={district} onChange={e=>{setDistrict(e.target.value);setPage(1);}}/>
      <select className={inputClass} aria-label="Profil durumu filtresi" data-testid="select-admin-agents-active" value={active} onChange={e=>{setActive(e.target.value);setPage(1);}}>
        <option value="">Tüm profil durumları</option>
        <option value="true">Profil aktif</option>
        <option value="false">Profil pasif</option>
      </select>
    </div>
    {data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<>
      <div className="surface overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Firma</th><th>Konum</th><th>Hesap durumu</th><th>Emlakçı profil durumu</th><th></th></tr></thead>
          <tbody>{data.data.items.map(a=><tr key={a.id} data-testid={`row-admin-agent-${a.id}`}><td><b>{a.companyName}</b><small>{a.user.email} · /emlakci/{a.slug}</small></td><td>{a.city}, {a.district}</td><td><StatusPill active={a.user.isActive}/></td><td><StatusPill active={a.isActive}/></td><td><Link href={`/admin/emlakcilar/${a.id}`} className="text-sm font-bold text-primary" data-testid={`link-admin-agent-${a.id}`}>Detay</Link></td></tr>)}</tbody>
        </table>
      </div>
      <Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/>
    </>:<EmptyState title="Emlakçı kaydı bulunamadı" text="Sonuçlar filtreyle eşleşmiyor."/>}
  </AdminLayout>;
}
function AdminAgentDetailPage() {
  const isMock=DATA_MODE==='mock';
  const [match,params]=useRoute('/admin/emlakcilar/:id'); const id=params?.id||'';
  const {toast}=useToast();
  const q=useAdminAgent(id,!isMock); const qc=useQueryClient();
  const [message,setMessage]=useState(''); const [errorMsg,setErrorMsg]=useState('');
  const mutation=useMutation({
    mutationFn:(active:boolean)=>adminAgentsApi.updateAgentStatus(id,active),
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:keys.adminAgent(id)});
      void qc.invalidateQueries({queryKey:['admin-agents']});
      if(q.data?.slug)void qc.invalidateQueries({queryKey:keys.agent(q.data.slug)});
      void qc.invalidateQueries({queryKey:['agent-properties']});
      void qc.invalidateQueries({queryKey:['properties']});
      void qc.invalidateQueries({queryKey:['property']});
      void qc.invalidateQueries({queryKey:['admin-audit-logs']});
      setErrorMsg('');
      setMessage('Emlakçı profil durumu güncellendi.');
      toast({title:'Emlakçı profil durumu güncellendi.'});
    },
    onError:(err)=>{setMessage('');setErrorMsg(showError(err));},
  });
  if(!match)return null;
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı detayını görüntülemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  const toggleAgentStatus=()=>{
    if(!q.data)return;
    if(q.data.isActive&&!window.confirm('Emlakçı profilini pasife almak istediğinize emin misiniz? Pasif profilin public sayfası ve ilanları gizlenir.'))return;
    setMessage('');setErrorMsg('');
    mutation.mutate(!q.data.isActive);
  };
  return <AdminLayout>
    <Link href="/admin/emlakcilar" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> Emlakçılar</Link>
    {q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data&&<div className="surface p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted text-primary">
            {q.data.logoUrl&&fileUrl(q.data.logoUrl)?<img src={fileUrl(q.data.logoUrl)!} alt={`${q.data.companyName} logosu`} className="h-full w-full object-cover"/>:<Building2 size={28}/>}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Emlakçı profili</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">{q.data.companyName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{q.data.city}, {q.data.district} · /emlakci/{q.data.slug}</p>
          </div>
        </div>
        <button type="button" disabled={mutation.isPending} data-testid="button-toggle-agent-status" onClick={toggleAgentStatus} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{mutation.isPending?'Güncelleniyor…':q.data.isActive?'Profili pasife al':'Profili aktifleştir'}</button>
      </div>
      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Info label="Hesap durumu (User.isActive)" value={q.data.user.isActive?'Aktif':'Pasif'}/>
        <Info label="Emlakçı profil durumu (AgentProfile.isActive)" value={q.data.isActive?'Aktif':'Pasif'}/>
        <Info label="Kullanıcı hesabı" value={q.data.user.email}/>
        <Info label="Telefon" value={q.data.phone}/>
        <Info label="Firma e-postası" value={q.data.email}/>
        <Info label="Adres" value={q.data.address}/>
        <Info label="Vergi numarası" value={q.data.taxNumber}/>
        <Info label="Kayıt tarihi" value={new Date(q.data.createdAt).toLocaleString('tr-TR')}/>
      </div>
      {q.data.description&&<p className="mt-5 rounded-xl bg-muted p-4 text-sm">{q.data.description}</p>}
      {message&&<p role="status" className="mt-4 text-sm text-primary" data-testid="text-admin-agent-message">{message}</p>}
      {errorMsg&&<p role="alert" className="mt-3 text-sm text-destructive" data-testid="text-admin-agent-error">{errorMsg}</p>}
    </div>}
  </AdminLayout>;
}
function AdminPropertiesPage() {
  const isMock=DATA_MODE==='mock';
  const search=useSearch();
  const params=new URLSearchParams(search);
  const ownerUserId=params.get('ownerUserId')??'';
  const agentUserId=params.get('agentUserId')??'';
  const conflictingOwners=Boolean(ownerUserId&&agentUserId);
  const [status,setStatus]=useState(''),[listingType,setListingType]=useState(''),[city,setCity]=useState(''),[deleted,setDeleted]=useState('false'),[page,setPage]=useState(1);
  const data=useAdminProperties({
    page,
    limit:20,
    ...(status?{status:status as PropertyStatus}:{}),
    ...(listingType?{listingType:listingType as 'SALE'|'RENT'}:{}),
    ...(city.trim()?{city:city.trim()}:{}),
    deleted:deleted as 'true'|'false',
    ...(!conflictingOwners&&ownerUserId?{ownerUserId}:{}),
    ...(!conflictingOwners&&agentUserId?{agentUserId}:{}),
  },!isMock);
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="İlan moderasyonunu kullanmak için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout>
    <SectionTitle eyebrow="İçerik denetimi" title="İlanlar" description="İlan durumlarını ve emlakçı kayıtlarını gözden geçirin."/>
    {conflictingOwners&&<p role="alert" className="mb-3 text-sm text-destructive">Bireysel ve emlakçı sahiplik filtreleri birlikte gönderilmedi.</p>}
    {(ownerUserId||agentUserId)&&!conflictingOwners&&<p className="mb-3 text-sm text-muted-foreground">{ownerUserId?'Bireysel ilan filtresi açık.':'Emlakçı ilan filtresi açık.'} <Link href="/admin/ilanlar" className="font-semibold text-primary">Filtreyi kaldır</Link></p>}
    <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <select className={inputClass} aria-label="Durum filtresi" data-testid="select-admin-props-status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
        <option value="">Tüm durumlar</option>
        {['ACTIVE','INACTIVE','SOLD','RENTED'].map(s=><option key={s} value={s}>{labels[s]}</option>)}
      </select>
      <select className={inputClass} aria-label="İlan türü filtresi" data-testid="select-admin-props-listingType" value={listingType} onChange={e=>{setListingType(e.target.value);setPage(1);}}>
        <option value="">Satılık ve kiralık</option>
        <option value="SALE">Satılık</option>
        <option value="RENT">Kiralık</option>
      </select>
      <input className={inputClass} placeholder="Şehir adı (tam eşleşme)" data-testid="input-admin-props-city" value={city} onChange={e=>{setCity(e.target.value);setPage(1);}}/>
      <select className={inputClass} aria-label="Silinme durumu" data-testid="select-admin-props-deleted" value={deleted} onChange={e=>{setDeleted(e.target.value);setPage(1);}}>
        <option value="false">Silinmemiş ilanlar</option>
        <option value="true">Silinmiş ilanlar</option>
      </select>
    </div>
    {data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<>
      <div className="surface overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>İlan</th><th>Konum</th><th>Durum</th><th>Emlakçı</th><th>Tarih</th><th></th></tr></thead>
          <tbody>{data.data.items.map(p=><tr key={p.id} data-testid={`row-admin-prop-${p.id}`}><td><b>{p.title}</b><small>{money(p.price)} · {labels[p.listingType]} · {labels[p.propertyType]}</small></td><td>{p.city}, {p.district}</td><td>{labels[p.status]}{p.deletedAt?' (Silinmiş)':''}</td><td>{p.agent?<>{p.agent.companyName}<small>{p.agent.isActive?'Profil aktif':'Profil pasif'} · {p.agent.user.isActive?'Hesap aktif':'Hesap pasif'}</small></>:<>Bireysel<small>{p.owner?.isActive?'Hesap aktif':'Hesap pasif'}</small></>}</td><td>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</td><td><Link href={`/admin/ilanlar/${p.id}`} className="text-sm font-bold text-primary" data-testid={`link-admin-prop-${p.id}`}>Detay</Link></td></tr>)}</tbody>
        </table>
      </div>
      <Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/>
    </>:<EmptyState title="İlan bulunamadı" text="Seçilen filtrelerle eşleşen ilan bulunmuyor."/>}
  </AdminLayout>;
}
function AdminPropertyDetailPage() {
  const isMock=DATA_MODE==='mock';
  const [match,params]=useRoute('/admin/ilanlar/:id'); const id=params?.id||'';
  const {toast}=useToast(); const invalidate=useInvalidateMarketplace();
  const q=useAdminProperty(id,!isMock); const qc=useQueryClient();
  const [reason,setReason]=useState(''),[message,setMessage]=useState(''),[errorMsg,setErrorMsg]=useState('');

  const deactivate=useMutation({
    mutationFn:()=>adminPropertiesApi.deactivateProperty(id,reason.trim()),
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:keys.adminProperty(id)});
      void qc.invalidateQueries({queryKey:['admin-properties']});
      void qc.invalidateQueries({queryKey:['admin-audit-logs']});
      invalidate(id);
      setErrorMsg('');
      setMessage('İlan pasife alındı.');
      toast({title:'İlan pasife alındı.'});
    },
    onError:(err)=>{setMessage('');setErrorMsg(showError(err));},
  });

  const remove=useMutation({
    mutationFn:()=>adminPropertiesApi.deleteProperty(id,reason.trim()),
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:keys.adminProperty(id)});
      void qc.invalidateQueries({queryKey:['admin-properties']});
      void qc.invalidateQueries({queryKey:['admin-audit-logs']});
      invalidate(id);
      setErrorMsg('');
      setMessage('İlan silindi (soft delete).');
      toast({title:'İlan silindi.'});
    },
    onError:(err)=>{setMessage('');setErrorMsg(showError(err));},
  });

  const removeImage=useMutation({
    mutationFn:(imageId:string)=>adminPropertiesApi.deletePropertyImage(id,imageId),
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:keys.adminProperty(id)});
      void qc.invalidateQueries({queryKey:['admin-audit-logs']});
      invalidate(id);
      setErrorMsg('');
      setMessage('İlan fotoğrafı silindi.');
      toast({title:'İlan fotoğrafı silindi.'});
    },
    onError:(err)=>{setMessage('');setErrorMsg(showError(err));},
  });

  if(!match)return null;
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="İlan moderasyon detayını görüntülemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;

  const trimmedReason=reason.trim();
  const validReason=trimmedReason.length>=3&&trimmedReason.length<=500;

  return <AdminLayout>
    <Link href="/admin/ilanlar" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> İlanlar</Link>
    {q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data&&<div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <article className="surface p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">İlan ayrıntısı</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold">{q.data.title}</h2>
        <p className="mt-2 text-2xl font-extrabold text-primary">{money(q.data.price)}</p>
        <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Info label="Durum" value={`${labels[q.data.status]}${q.data.deletedAt?' · Silinmiş':''}`}/>
          <Info label="İlan türü" value={labels[q.data.listingType]}/>
          <Info label="Emlak türü" value={labels[q.data.propertyType]}/>
          <Info label="Oda / Alan" value={`${q.data.rooms}+${q.data.livingRooms} · Brüt ${area(q.data.grossAreaM2)} m²${q.data.netAreaM2?` · Net ${area(q.data.netAreaM2)} m²`:''}`}/>
          <Info label="Konum" value={`${q.data.neighborhood}, ${q.data.district}, ${q.data.city}`}/>
          <Info label="Koordinatlar" value={q.data.latitude && q.data.longitude ? `${q.data.latitude}, ${q.data.longitude}` : '—'}/>
          {q.data.agent?<>
          <Info label="Emlakçı" value={`${q.data.agent.companyName} (${q.data.agent.phone})`}/>
          <Info label="Emlakçı e-postası" value={`${q.data.agent.email} · Hesap: ${q.data.agent.user.email}`}/>
          <Info label="Hesap durumu" value={q.data.agent.user.isActive?'Aktif':'Pasif'}/>
          <Info label="Profil durumu" value={q.data.agent.isActive?'Aktif':'Pasif'}/>
          </>:<>
          <Info label="Satıcı" value={q.data.sellerType==='INDIVIDUAL'?'Bireysel':'—'}/>
          <Info label="Hesap" value={q.data.owner?.email??'—'}/>
          <Info label="Hesap durumu" value={q.data.owner?.isActive?'Aktif':'Pasif'}/>
          </>}
          <Info label="Adres" value={q.data.address}/>
          {q.data.deletedAt&&<Info label="Silinme tarihi" value={new Date(q.data.deletedAt).toLocaleString('tr-TR')}/>}
        </div>
        <p className="mt-5 whitespace-pre-line leading-6 text-muted-foreground">{q.data.description}</p>
        <div className="mt-6 border-t border-border pt-5" data-testid="section-admin-property-images">
          <h3 className="font-bold">İlan fotoğrafları ({q.data.images?.length||0})</h3>
          {q.data.images?.length?<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {q.data.images.map(image=><div key={image.id} className="overflow-hidden rounded-xl border border-border" data-testid={`card-admin-image-${image.id}`}>
              <img src={fileUrl(image.url)||''} alt="İlan fotoğrafı" className="aspect-square w-full object-cover"/>
              <div className="flex items-center justify-between p-2 text-xs">
                <span className="font-semibold text-muted-foreground">{image.isCover?'Kapak':`Sıra #${image.sortOrder+1}`}</span>
                <button type="button" disabled={removeImage.isPending} data-testid={`button-admin-delete-image-${image.id}`} onClick={()=>{if(window.confirm('Bu ilan fotoğrafını silmek istediğinize emin misiniz?')){setMessage('');setErrorMsg('');removeImage.mutate(image.id);}}} className="font-semibold text-destructive disabled:opacity-50">Sil</button>
              </div>
            </div>)}
          </div>:<p className="mt-2 text-xs text-muted-foreground">Bu ilana ait canlı fotoğraf bulunmuyor.</p>}
        </div>
      </article>
      <aside className="surface h-fit p-5">
        <h3 className="font-display text-xl font-bold">Moderasyon</h3>
        <label className="mt-4 grid gap-2 text-sm font-semibold">İşlem nedeni (3–500 karakter)<textarea className={`${inputClass} h-28 py-3`} data-testid="textarea-moderation-reason" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Gerekli moderasyon açıklaması"/></label>
        <button type="button" data-testid="button-admin-deactivate-property" disabled={!validReason||deactivate.isPending||remove.isPending||q.data.status!=='ACTIVE'||q.data.deletedAt!==null} onClick={()=>{if(window.confirm('İlanı pasife almak istediğinize emin misiniz?')){setMessage('');setErrorMsg('');deactivate.mutate();}}} className="mt-4 h-11 w-full rounded-xl bg-primary font-bold text-white disabled:opacity-40">{deactivate.isPending?'İşleniyor…':'İlanı pasife al'}</button>
        <button type="button" data-testid="button-admin-delete-property" disabled={!validReason||remove.isPending||deactivate.isPending||q.data.deletedAt!==null} onClick={()=>{if(window.confirm('İlanı soft delete yapmak istediğinize emin misiniz?')){setMessage('');setErrorMsg('');remove.mutate();}}} className="mt-3 h-11 w-full rounded-xl border border-destructive/40 font-bold text-destructive disabled:opacity-40">{remove.isPending?'Siliniyor…':'İlanı sil'}</button>
        {message&&<p role="status" className="mt-3 text-sm text-primary" data-testid="text-admin-prop-message">{message}</p>}
        {errorMsg&&<p role="alert" className="mt-3 text-sm text-destructive" data-testid="text-admin-prop-error">{errorMsg}</p>}
      </aside>
    </div>}
  </AdminLayout>;
}
function AdminAuditPage() {
  const isMock=DATA_MODE==='mock';
  const search=useSearch();
  const [entityType,setEntityType]=useState(''),[entityId,setEntityId]=useState(''),[page,setPage]=useState(1);
  useEffect(()=>{
    const params=new URLSearchParams(search);
    const nextType=params.get('entityType');
    const nextId=params.get('entityId');
    if(nextType)setEntityType(nextType);
    if(nextId)setEntityId(nextId);
  },[search]);
  const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId.trim());
  const q=useAdminAudit({
    page,
    limit:20,
    ...(entityType?{entityType}:{}),
    ...(validUuid?{entityId:entityId.trim()}:{}),
  },!isMock);
  if(isMock)return <AdminLayout><EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Audit kayıtlarını görüntülemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/></AdminLayout>;
  return <AdminLayout>
    <SectionTitle eyebrow="İzlenebilirlik" title="İşlem kayıtları" description="Yönetim eylemleri salt okunur biçimde listelenir."/>
    <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2">
      <select className={inputClass} aria-label="Varlık türü filtresi" data-testid="select-admin-audit-entityType" value={entityType} onChange={e=>{setEntityType(e.target.value);setPage(1);}}>
        <option value="">Tüm varlık türleri</option>
        {['USER','AGENT_APPLICATION','AGENT_APPLICATION_DOCUMENT','AGENT_PROFILE','PROPERTY','PROPERTY_IMAGE'].map(t=><option key={t} value={t}>{t}</option>)}
      </select>
      <input className={inputClass} placeholder="Varlık UUID filtresi (tam UUID)" data-testid="input-admin-audit-entityId" value={entityId} onChange={e=>{setEntityId(e.target.value);setPage(1);}}/>
    </div>
    {entityId.trim()&&!validUuid&&<p className="mb-3 text-xs text-muted-foreground">Varlık kimliği filtresi yalnızca geçerli bir UUID girildiğinde uygulanır.</p>}
    {q.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data?.items.length?<>
      <div className="surface overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Eylem</th><th>Varlık</th><th>Varlık kimliği</th><th>İşlemi yapan</th><th>Tarih</th></tr></thead>
          <tbody>{q.data.items.map(log=><tr key={log.id} data-testid={`row-admin-audit-${log.id}`}><td><b>{log.action}</b></td><td>{log.entityType}</td><td><code className="text-xs">{log.entityId}</code></td><td><code className="text-xs">{log.actorUserId}</code></td><td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td></tr>)}</tbody>
        </table>
      </div>
      {q.data.items.map(log=>log.metadata&&<details key={`meta-${log.id}`} className="surface mt-2 p-4"><summary className="cursor-pointer text-sm font-semibold">Ek bilgiler · {log.action}</summary><pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(log.metadata,null,2)}</pre></details>)}
      <Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/>
    </>:<EmptyState title="İşlem kaydı yok" text="Kayıtlar oluştuğunda burada görünür."/>}
  </AdminLayout>;
}

function HowToListPage() {
  type AudienceKey = 'owner' | 'advisor' | 'office' | 'developer';
  const audiences = [
    {
      key: 'owner' as const, title: 'Bireysel ev sahibi', icon: Home,
      description: 'Kendi taşınmazını satmak veya kiraya vermek isteyen kullanıcılar.',
      status: 'İlan verme mevcut',
      intro: 'Kendi taşınmazınızı satılık veya kiralık olarak yayınlayabilirsiniz. Kimlik ve mülkiyet belgesi doğrulaması henüz kullanıma açık değildir.',
      infoTitle: 'İlan formunda istenen bilgiler',
      infoItems: ['Satılık veya kiralık tercihi ve emlak tipi', 'Başlık, açıklama ve fiyat', 'Alan, oda ve temel özellikler', 'Şehir, ilçe, mahalle, açık adres ve koordinat', 'JPEG, PNG veya WebP fotoğraflar'],
      availability: 'Bireysel ilan oluşturma ve fotoğraf yükleme, giriş yapmış kullanıcı hesabıyla kullanılabilir. Telefon ve e-posta ilan detayında yayımlanmaz. Kimlik veya mülkiyet belgesi yükleme adımı yoktur.',
      nextTitle: 'Sonraki adım',
      nextDescription: 'Giriş yaptıktan sonra ilan formunu doldurup fotoğraflarınızı ekleyerek ilanı yayınlayabilirsiniz.',
      actionHref: '/ilan-ver', actionLabel: 'İlan Ver',
      journey: [
        { title: 'Hesap oluştur veya giriş yap', description: 'İlan formu yalnızca oturum açmış kullanıcı hesabına açıktır.', status: 'Mevcut' },
        { title: 'Taşınmaz bilgilerini gir', description: 'Tür, fiyat, özellikler ve konum ilan formunda toplanır.', status: 'Mevcut' },
        { title: 'Fotoğrafları ekle', description: 'JPEG, PNG veya WebP fotoğraflar ilanla birlikte yüklenir. Kimlik belgesi istenmez.', status: 'Mevcut' },
        { title: 'İlanı yayınla', description: 'İlan yayında başlar ve herkese açık ilan sayfasında görünür.', status: 'Mevcut' },
      ],
    },
    {
      key: 'advisor' as const, title: 'Emlak danışmanı', icon: UserRound,
      description: 'Profesyonel olarak gayrimenkul ilanları yöneten kişiler.',
      status: 'Başvuru akışı mevcut',
      intro: 'Başvuru bilgilerini ve belgeleri gönderin; yönetici onayından sonra emlakçı panelinde ilan ve profil işlemleri açılır.',
      infoTitle: 'Mevcut akışta istenen bilgiler',
      infoItems: ['Başvuruda: firma adı, yetkili adı/soyadı, telefon, e-posta, vergi numarası, şehir/ilçe ve adres', 'Başvuru ekranında vergi levhası ve yetki belgesi yükleme alanları', 'Onay sonrası emlakçı profili: firma adı, telefon, e-posta, adres ve açıklama', 'Ayrı bir kişisel mesleki sicil numarası alanı görünmüyor; belge gereklilikleri süreçte doğrulanmalı'],
      availability: 'Emlakçı başvurusu ve belge yükleme akışı gerçek API’ye bağlıdır.',
      nextTitle: 'Sonraki adım',
      nextDescription: 'Emlakçı başvurusunu ve gerekli belgeleri başvuru ekranından gönderebilirsiniz. Oturum yoksa giriş ekranına yönlendirilirsiniz.',
      actionHref: '/emlakci-basvuru', actionLabel: 'Emlakçı başvurusuna geç',
      journey: [
        { title: 'Hesap oluştur veya giriş yap', description: 'Hesap kaydı ve oturum açma mevcut API işlemleridir.', status: 'Mevcut' },
        { title: 'Emlakçı başvurusunu gönder', description: 'Firma/yetkili iletişim bilgileri ve vergi numarası girilir; vergi levhası ve yetki belgesi yüklenebilir.', status: 'Mevcut' },
        { title: 'Yönetici incelemesini bekle', description: 'Başvuru durumu ve onay admin akışında yönetilir; süre garantisi yoktur.', status: 'Mevcut' },
        { title: 'İlan ve profili yönet', description: 'AGENT rolü verilen hesap ilan oluşturabilir, düzenleyebilir ve profilini güncelleyebilir.', status: 'Mevcut' },
      ],
    },
    {
      key: 'office' as const, title: 'Emlak ofisi', icon: Building2,
      description: 'Ofis bilgilerini paylaşmak ve profesyonel ilan yönetimine başlamak isteyen işletmeler.',
      status: 'Başvuru var · ekip yönetimi yok',
      intro: 'Mevcut emlakçı başvurusu şirket ve yetkili bilgilerini alır. Ekip yönetimi ve toplu portföy yönetimi henüz kullanıma açık değildir.',
      infoTitle: 'Mevcut başvuruda istenen ofis bilgileri',
      infoItems: ['Firma adı, yetkili kişi adı/soyadı ve iletişim bilgileri', 'Vergi numarası, şehir/ilçe ve açık adres', 'Vergi levhası ve yetki belgesi dosyaları', 'Onay sonrası tek AGENT hesabının profil alanları; ekip üyeleri veya toplu ilan alanı yok'],
      availability: 'Şirket bilgileri aynı emlakçı başvuru API’sine gönderilebilir. Çoklu kullanıcı, ekip rolleri ve toplu ilan yönetimi mevcut değil.',
      nextTitle: 'Sonraki adım',
      nextDescription: 'Şirket bilgileri mevcut emlakçı başvuru formunda paylaşılabilir. Ofis ekip yönetimi ve toplu portföy yönetimi henüz kullanıma açık değil.',
      actionHref: '/emlakci-basvuru', actionLabel: 'Ofis başvurusunu aç',
      journey: [
        { title: 'Hesap oluştur veya giriş yap', description: 'Başvuru için bir kullanıcı hesabı gerekir.', status: 'Mevcut' },
        { title: 'Şirket ve yetkili bilgilerini gir', description: 'Mevcut başvuru formu firma, yetkili, vergi ve adres bilgilerini alır.', status: 'Mevcut' },
        { title: 'Belgeleri ve başvuruyu incelemeye gönder', description: 'Vergi levhası/yetki belgesi yükleme mevcut API akışındadır.', status: 'Mevcut' },
        { title: 'Ekibi ve portföyü birlikte yönet', description: 'Ofis kullanıcıları, ekip yetkileri ve toplu ilan araçları henüz kullanıma açık değil.', status: 'Mevcut değil' },
      ],
    },
    {
      key: 'developer' as const, title: 'Müteahhit veya proje geliştiricisi', icon: Building2,
      description: 'Yeni proje ve bağımsız bölüm portföylerini tanıtmak isteyen geliştiriciler.',
      status: 'Henüz kullanıma açık değil',
      intro: 'Proje, blok ve bağımsız bölüm bilgilerini yönetmek için bu kategoride ayrı bir başvuru veya ilan akışı bulunmuyor.',
      infoTitle: 'İleride proje akışı tasarlanırken ele alınabilecekler',
      infoItems: ['Proje adı, türü, konumu ve genel açıklaması', 'Bloklar ve bağımsız bölümlerin tip, alan ve durum bilgileri', 'Proje görselleri ve bölüm planları', 'Yetkili kişi/şirket bilgileri ve süreçte istenebilecek doğrulamalar'],
      availability: 'Uygulamada müteahhit proje yönetimi ve bağımsız bölüm yönetimi endpoint’i bulunmuyor (Henüz kullanıma açık değil).',
      nextTitle: 'Durum · Henüz kullanıma açık değil',
      nextDescription: 'Müteahhit proje yönetimi ve bağımsız bölüm yönetimi henüz kullanıma açık değil. Mevcut ilanları inceleyebilirsiniz.',
      actionHref: '/ilanlar', actionLabel: 'Mevcut ilanları incele',
      journey: [
        { title: 'Geliştirici hesabı aç', description: 'Ayrı bir geliştirici hesap türü veya kayıt akışı henüz kullanıma açık değil.', status: 'Mevcut değil' },
        { title: 'Proje ve bağımsız bölümleri tanımla', description: 'Proje, blok ve bağımsız bölüm alanlarını yöneten bir form henüz kullanıma açık değil.', status: 'Mevcut değil' },
        { title: 'Yetkileri ve proje belgelerini doğrula', description: 'Geliştiriciye özel belge yükleme ve doğrulama akışı henüz kullanıma açık değil.', status: 'Mevcut değil' },
        { title: 'Proje portföyünü yayınla', description: 'Proje yayınlama rotası/API’si henüz kullanıma açık değil; yalnızca mevcut ilanlar gezilebilir.', status: 'Mevcut değil' },
      ],
    },
  ];
  const { user } = useAuth();
  const [location, go] = useLocation();
  const search = useSearch();
  const queryAudience = new URLSearchParams(search).get('audience');
  const isAudienceKey = (value: string | null): value is AudienceKey => ['owner', 'advisor', 'office', 'developer'].includes(value || '');
  const [selectedAudience, setSelectedAudience] = useState<AudienceKey | null>(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('audience');
      if (isAudienceKey(fromUrl)) return fromUrl;
      const saved = window.localStorage.getItem('yuva-listing-audience');
      return isAudienceKey(saved) ? saved : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (selectedAudience) window.localStorage.setItem('yuva-listing-audience', selectedAudience);
      else window.localStorage.removeItem('yuva-listing-audience');
    } catch { /* Seçim bu oturumda kullanılmaya devam eder. */ }
  }, [selectedAudience]);
  useEffect(() => {
    if (isAudienceKey(queryAudience) && queryAudience !== selectedAudience) setSelectedAudience(queryAudience);
  }, [queryAudience, selectedAudience]);
  const selectAudience = (key: AudienceKey) => {
    setSelectedAudience(key);
    const params = new URLSearchParams(search);
    params.set('audience', key);
    go(`${location}?${params.toString()}`);
  };
  const selected = audiences.find(audience => audience.key === selectedAudience);
  const selectedAction = selected?.key === 'advisor' || selected?.key === 'office'
    ? user?.role === 'AGENT'
      ? { href: '/panel/ilanlar/yeni', label: 'Yeni ilan formunu aç', title: 'Onaylı emlakçı hesabıyla devam edin', description: 'Bu bağlantı mevcut tekil ilan oluşturma formunu açar.' }
      : { href: '/emlakci-basvuru', label: selected.key === 'office' ? 'Ofis başvurusunu aç' : 'Emlakçı başvurusuna geç', title: 'Mevcut profesyonel başvurusuna geçin', description: 'Hesabınız yoksa bu rota sizi giriş sayfasına yönlendirir. Başvuru gerçek API’ye gönderilir.' }
    : selected ? { href: selected.actionHref, label: selected.actionLabel, title: selected.nextTitle, description: selected.nextDescription } : null;
  const faqs = [
    ['Kimler YUVA’da ilan verebilir?', 'Bireysel kullanıcılar giriş yaptıktan sonra İlan Ver ile kendi ilanlarını yayınlayabilir. Emlak danışmanları onaylı AGENT hesabıyla panelden ilan yönetir. Ofis ekip yönetimi ve müteahhit proje yönetimi henüz yoktur.'],
    ['İlan vermek için hangi bilgiler gerekir?', 'İlan formunda başlık, satılık/kiralık türü, emlak tipi, fiyat, brüt alan, oda ve salon sayısı, açıklama, şehir, ilçe, mahalle, açık adres ve harita koordinatları istenir. Bazı ek özellikler isteğe bağlıdır.'],
    ['Fotoğraf eklemek zorunlu mu?', 'Arayüzde ilanı kaydetmek için zorunlu bir minimum fotoğraf adedi belirtilmiyor. İlan ilk kez kaydedildikten sonra JPEG, PNG veya WebP biçiminde, dosya başına en fazla 10 MB ve toplamda en çok 20 fotoğraf yüklenebilir. Sunucu tarafındaki ek kurallar API tarafından belirlenebilir.'],
    ['İlanım ne zaman yayınlanır?', 'Emlakçı başvurusu yönetici incelemesinden geçer; uygulama belirli bir inceleme veya yayın süresi vaat etmiyor. İlanın durumu ve yayınlanması gerçek API yanıtına bağlıdır.'],
    ['İlanımı daha sonra düzenleyebilir veya kaldırabilir miyim?', 'Evet. Onaylı emlakçı hesabının ilan panelinde ilanı düzenleme, durumunu güncelleme ve kaldırma işlemleri bulunur. İşlemler API’ye gönderilir; bu sayfa onlar için sahte başarı üretmez.'],
    ['Bireysel kullanıcı ile emlak danışmanı arasındaki fark nedir?', 'Bireysel kullanıcı kendi ilanını İlan Ver ekranından yayınlar; iletişim bilgisi ilanda gösterilmez. Emlak danışmanı başvuru ve onay sonrası panelden ilan yönetir ve firma iletişim bilgileri ilanda görünür.'],
  ];

  return <PublicLayout>
    <section className="bg-[#f1efe7]">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-12 md:py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:px-10 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#cbd8ce] bg-white/65 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#38645a]"><ShieldCheck size={14}/> YUVA’da ilan verme rehberi</p>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-extrabold leading-[1.08] tracking-[-.04em] text-[#223d38] sm:text-5xl lg:text-[3.5rem]">Gayrimenkulünüzü YUVA&apos;da yayınlayın.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5d6b64] md:text-lg">İster kendi evinizi satmak veya kiraya vermek, ister müşterilerinizin gayrimenkullerini yönetmek isteyin; size uygun ilan verme yolunu keşfedin.</p>
          <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#d8d9ce] bg-white/55 p-4 text-sm leading-6 text-[#4f6259]"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-primary"/>Bireysel kullanıcılar İlan Ver ile ilan yayınlayabilir. Emlakçılar onaylı hesaplarıyla panelden ilan yönetir. Ofis ekip yönetimi henüz mevcut değildir.</p>
          <a href="#kullanici-turu-secimi" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Size uygun yolu bulun <ArrowRight size={16}/></a>
        </div>
        <div className="relative min-h-[300px] overflow-hidden rounded-[1.6rem] bg-[#24463f] shadow-sm sm:min-h-[390px]">
          <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=82" alt="Bahçeye açılan, aydınlık ve modern bir ev" className="absolute inset-0 h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }}/>
          <div className="absolute inset-0 bg-gradient-to-t from-[#152c27]/80 via-[#152c27]/10 to-transparent" aria-hidden="true"/>
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/20 bg-[#19352f]/75 p-5 text-white backdrop-blur-sm sm:inset-x-7 sm:bottom-7 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d5e1d6]">Başlamadan önce</p>
            <p className="mt-2 max-w-lg font-display text-xl font-bold leading-snug sm:text-2xl">Doğru akış, hesabınızın türüne ve onay durumuna bağlı.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="kullanici-turu-secimi" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-14 md:py-16 lg:px-10 lg:py-20" aria-labelledby="audience-heading">
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Size uygun ilan verme yolu</p><h2 id="audience-heading" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#223d38] sm:text-4xl">Önce kullanıcı türünüzü seçin</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Seçiminiz bağlantı adresinde korunur. İstediğiniz zaman başka bir kategori seçerek akışı değiştirebilirsiniz.</p></div>
      <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Kullanıcı türü seçimi">
        {audiences.map(({key,title,icon:Icon,description,status})=><button key={key} type="button" aria-pressed={selectedAudience===key} onClick={()=>selectAudience(key)} className={`flex h-full min-h-52 flex-col rounded-2xl border bg-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-6 ${selectedAudience===key?'border-primary ring-2 ring-primary/20':'border-border hover:border-primary/50'}`}>
          <span className="flex w-full items-start justify-between gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8eee7] text-primary"><Icon size={23}/></span><span className="rounded-full bg-[#f0eee6] px-3 py-1.5 text-[11px] font-semibold leading-4 text-[#53645a]">{status}</span></span>
          <span className="mt-5 font-display text-lg font-bold leading-snug text-[#223d38]">{title}</span><span className="mt-2 text-sm leading-6 text-muted-foreground">{description}</span>
          <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-primary">{selectedAudience===key?'Seçili · akışı görüntüle':'Bu akışı seç'} <ArrowRight size={14}/></span>
        </button>)}
      </div>

      {selected && selectedAction ? <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_.82fr]" aria-live="polite" aria-labelledby="selected-audience-title">
        <article className="rounded-2xl border border-[#d8d9ce] bg-[#f5f3ec] p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Seçtiğiniz akış</p><h3 id="selected-audience-title" className="mt-2 font-display text-2xl font-extrabold text-[#223d38]">{selected.title}</h3><p className="mt-3 text-sm leading-6 text-[#59675f]">{selected.intro}</p>
          <h4 className="mt-6 font-semibold text-[#2b443c]">{selected.infoTitle}</h4><ul className="mt-3 grid gap-2.5 text-sm leading-6 text-[#4e6057]">{selected.infoItems.map(item=><li key={item} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b8795b]"/>{item}</li>)}</ul>
          <p className="mt-5 rounded-xl border border-[#d8d9ce] bg-white/65 p-4 text-sm leading-6 text-[#4f6259]"><BadgeCheck size={17} className="mr-2 inline text-primary"/>{selected.availability}</p>
        </article>
        <aside className="flex flex-col rounded-2xl bg-[#234d45] p-5 text-white sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#c8dbcf]">Sonraki adım</p><h3 className="mt-2 font-display text-xl font-bold">{selectedAction.title}</h3><p className="mt-3 text-sm leading-6 text-white/75">{selectedAction.description}</p>
          <Link href={selectedAction.href} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#f0cf9c] px-5 py-3 text-sm font-bold text-[#253b35] transition-colors hover:bg-[#f6ddb4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#234d45]">{selectedAction.label}<ArrowRight size={16}/></Link>
          <a href="#kullanici-turu-secimi" className="mt-auto inline-flex min-h-11 items-center self-start pt-5 text-sm font-semibold text-white/75 underline decoration-white/40 underline-offset-4 hover:text-white">Seçimi değiştir</a>
        </aside>
      </div> : <p className="mt-5 rounded-xl bg-[#f4f3ed] p-4 text-sm leading-6 text-[#59675f]">Henüz seçim yapmadınız. Önce size en yakın kullanıcı türünü seçin; mevcut adımlar ve eksik özellikler burada gösterilir.</p>}
    </section>

    {selected && <section className="border-y border-border bg-[#f4f3ed]" aria-labelledby="audience-journey-title">
      <div className="mx-auto max-w-[1280px] px-5 py-14 md:py-16 lg:px-10 lg:py-20">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Adım adım · {selected.title}</p><h2 id="audience-journey-title" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#223d38] sm:text-4xl">Bu kategori için süreç</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Durum etiketleri, bugün çalışan uygulama adımlarını henüz sunulmayanlardan ayırır.</p></div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{selected.journey.map(({title,description,status},index)=><li key={title} className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-2"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-lg font-bold text-white" aria-label={`Adım ${index+1}`}>{index+1}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status==='Mevcut'?'bg-[#e8eee7] text-[#31584d]':status==='Hazırlık'?'bg-[#f2ead9] text-[#795d31]':'bg-[#f6e8e5] text-[#8a5144]'}`}>{status}</span></div><h3 className="mt-5 font-display text-lg font-bold text-[#223d38]">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></li>)}</ol>
      </div>
    </section>}

    <section className="mx-auto max-w-4xl px-5 py-14 md:py-16 lg:py-20">
      <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Merak edilenler</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#223d38] sm:text-4xl">Sık sorulan sorular</h2></div>
      <div className="mt-8 grid gap-3">{faqs.map(([question,answer])=><details key={question} className="group rounded-2xl border border-border bg-card px-5 py-4 open:border-[#c5d4c8] sm:px-6"><summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#2b443c] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">{question}<ChevronDown size={18} className="shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="max-w-3xl pb-1 pt-3 text-sm leading-6 text-muted-foreground">{answer}</p></details>)}</div>
      <p className="mt-6 rounded-xl bg-[#f4f3ed] p-4 text-xs leading-5 text-[#59675f]">Başvuru ekranı şu anda vergi levhası ve yetki belgesi yükleme alanları sunuyor. Belgelerin güncel gereklilikleri ve geçerliliği ilgili süreçte ayrıca doğrulanmalıdır; burada hukuki uygunluk veya yayın garantisi verilmez.</p>
    </section>
  </PublicLayout>;
}

function AccountFavoritesPage() { return <AccountLayout><FavoritesContent/></AccountLayout>; }
function AccountProfilePage() { return <AccountLayout><ProfileContent/></AccountLayout>; }
function LegacyAccountRedirect({ kind }: { kind: 'favorites' | 'profile' }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, go] = useLocation();
  const target = kind === 'favorites' ? '/hesabim/favoriler' : '/hesabim/bilgiler';
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      go(`/giris?returnTo=${encodeURIComponent(target)}`, { replace: true });
      return;
    }
    if (user.role === 'USER') go(target, { replace: true });
  }, [isLoading, isAuthenticated, user, go, target]);
  if (isLoading || !isAuthenticated || !user || user.role === 'USER') return null;
  if (kind === 'favorites' && user.role === 'AGENT') return <PanelLayout><FavoritesContent/></PanelLayout>;
  return kind === 'favorites'
    ? <PublicLayout><div className="mx-auto max-w-[1440px] px-5 py-12 lg:px-10"><FavoritesContent/></div></PublicLayout>
    : <PublicLayout><div className="mx-auto max-w-4xl px-5 py-12"><ProfileContent/></div></PublicLayout>;
}
function NotFoundPage() { return <PublicLayout><div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center"><span className="font-display text-7xl font-extrabold text-primary">404</span><h1 className="mt-4 font-display text-3xl font-bold">Bu sayfayı bulamadık</h1><p className="mt-2 text-muted-foreground">Adres değişmiş olabilir. İlanlara dönüp aramanıza devam edebilirsiniz.</p><Link href="/ilanlar" className="mt-6 rounded-xl bg-primary px-5 py-3 font-bold text-white">İlanları keşfet</Link></div></PublicLayout>; }
function Routed() { const [location]=useLocation(); const search=useSearch(); return <ErrorBoundary resetKey={`${location}${search}`}><Switch>
  <Route path="/" component={HomePage}/><Route path="/ilanlar">{()=> <ListingPage key={`${location}${search}`}/>}</Route><Route path="/ilan-ver">{()=> <RequireAuth><UserListingPage/></RequireAuth>}</Route><Route path="/ilan/:id" component={PropertyDetailPage}/><Route path="/emlakci/:slug" component={AgentPage}/><Route path="/nasil-ilan-verilir" component={HowToListPage}/>
  <Route path="/giris">{()=> <AuthPage key="login" mode="login"/>}</Route><Route path="/kayit">{()=> <AuthPage key="register" mode="register"/>}</Route><Route path="/profil">{()=> <LegacyAccountRedirect kind="profile"/>}</Route><Route path="/favoriler">{()=> <LegacyAccountRedirect kind="favorites"/>}</Route><Route path="/hesabim/favoriler">{()=> <RequireAuth><UserAccountGate><AccountFavoritesPage/></UserAccountGate></RequireAuth>}</Route><Route path="/hesabim/bilgiler">{()=> <RequireAuth><UserAccountGate><AccountProfilePage/></UserAccountGate></RequireAuth>}</Route><Route path="/hesabim/ilanlar/:id/duzenle">{()=> <RequireAuth><UserAccountGate><PropertyEditor mode="INDIVIDUAL" edit/></UserAccountGate></RequireAuth>}</Route><Route path="/hesabim/ilanlar">{()=> <RequireAuth><UserAccountGate><MyListingsPage/></UserAccountGate></RequireAuth>}</Route><Route path="/hesabim">{()=> <RequireAuth><UserAccountGate><AccountDashboardPage/></UserAccountGate></RequireAuth>}</Route><Route path="/emlakci-basvuru">{()=> <RequireRole roles={['USER']}><ApplicationPage/></RequireRole>}</Route>
  <Route path="/panel">{()=> <RequireRole roles={['AGENT']}><AgentHome/></RequireRole>}</Route><Route path="/panel/ilanlar">{()=> <RequireRole roles={['AGENT']}><AgentPropertiesPage/></RequireRole>}</Route><Route path="/panel/ilanlar/yeni">{()=> <RequireRole roles={['AGENT']}><PropertyEditor/></RequireRole>}</Route><Route path="/panel/ilanlar/:id/duzenle">{()=> <RequireRole roles={['AGENT']}><PropertyEditor edit/></RequireRole>}</Route><Route path="/panel/emlakci-profili">{()=> <RequireRole roles={['AGENT']}><AgentProfilePage/></RequireRole>}</Route>
  <Route path="/admin">{()=> <RequireRole roles={['ADMIN']}><AdminHome/></RequireRole>}</Route><Route path="/admin/kullanicilar">{()=> <RequireRole roles={['ADMIN']}><AdminUsersPage/></RequireRole>}</Route><Route path="/admin/kullanicilar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminUserDetailPage/></RequireRole>}</Route><Route path="/admin/basvurular">{()=> <RequireRole roles={['ADMIN']}><AdminApplicationsPage/></RequireRole>}</Route><Route path="/admin/basvurular/:id">{()=> <RequireRole roles={['ADMIN']}><AdminApplicationDetailPage/></RequireRole>}</Route><Route path="/admin/emlakcilar">{()=> <RequireRole roles={['ADMIN']}><AdminAgentsPage/></RequireRole>}</Route><Route path="/admin/emlakcilar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminAgentDetailPage/></RequireRole>}</Route><Route path="/admin/ilanlar">{()=> <RequireRole roles={['ADMIN']}><AdminPropertiesPage/></RequireRole>}</Route><Route path="/admin/ilanlar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminPropertyDetailPage/></RequireRole>}</Route><Route path="/admin/audit-logs">{()=> <RequireRole roles={['ADMIN']}><AdminAuditPage/></RequireRole>}</Route>
  <Route component={NotFoundPage}/>
</Switch></ErrorBoundary>; }
const unsavedListeners = new Set<(dirty: boolean) => void>();
const unsavedPendingHandlers = new Set<(href: string) => void>();
let unsavedDirty = false;
let unsavedPath = '';
let unsavedBypass = false;
let unsavedIntercepting = false;
function currentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
function onUnsavedPop() {
  if (!unsavedDirty || unsavedBypass) return;
  const next = currentHref();
  if (!unsavedPath || next === unsavedPath) return;
  unsavedIntercepting = true;
  unsavedBypass = true;
  history.pushState(window.history.state, '', unsavedPath);
  unsavedPendingHandlers.forEach(handler => handler(next));
  window.setTimeout(() => {
    unsavedBypass = false;
    unsavedIntercepting = false;
  }, 0);
}
const unsavedPopGuard = Symbol.for('yuva-unsaved-pop');
if (typeof window !== 'undefined' && !(window as unknown as Record<symbol, boolean>)[unsavedPopGuard]) {
  (window as unknown as Record<symbol, boolean>)[unsavedPopGuard] = true;
  window.addEventListener('popstate', onUnsavedPop);
}
function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    unsavedDirty = dirty;
    if (dirty) unsavedPath = currentHref();
    unsavedListeners.forEach(listener => listener(dirty));
    return () => {
      if (unsavedIntercepting) return;
      unsavedDirty = false;
      unsavedListeners.forEach(listener => listener(false));
    };
  }, [dirty]);
}
function UnsavedChanges() {
  const [location, setLocation] = useLocation();
  const dirtyRef = useRef(false);
  const bypass = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const listener = (dirty: boolean) => {
      dirtyRef.current = dirty;
      if (!dirty) {
        if (unsavedIntercepting) return;
        unsavedPath = currentHref();
        setPending(null);
      }
    };
    unsavedListeners.add(listener);
    unsavedPendingHandlers.add(setPending);
    return () => {
      unsavedListeners.delete(listener);
      unsavedPendingHandlers.delete(setPending);
    };
  }, []);
  useEffect(() => {
    if (!dirtyRef.current && !unsavedIntercepting) unsavedPath = currentHref();
  }, [location]);
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypass.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(next);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  useEffect(() => {
    if (!pending) return;
    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPending(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending]);
  const leave = () => {
    const href = pending;
    bypass.current = true;
    unsavedBypass = true;
    unsavedDirty = false;
    dirtyRef.current = false;
    unsavedListeners.forEach(listener => listener(false));
    setPending(null);
    if (href) setLocation(href);
    window.setTimeout(() => {
      bypass.current = false;
      unsavedBypass = false;
    }, 0);
  };
  if (!pending) return null;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#203b34]/40 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="unsaved-title" data-testid="dialog-unsaved" className="surface w-full max-w-md p-6">
      <h2 id="unsaved-title" className="font-display text-xl font-bold">Kaydedilmemiş değişiklikleriniz var.</h2>
      <p className="mt-2 text-sm text-muted-foreground">Bu sayfadan ayrılırsanız yaptığınız değişiklikler kaybolacaktır.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={stayRef} type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-unsaved-stay" onClick={() => setPending(null)} onKeyDown={event => { if (event.key === 'Escape') setPending(null); }}>Sayfada Kal</button>
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="button-unsaved-leave" onClick={leave}>Sayfadan Ayrıl</button>
      </div>
    </div>
  </div>;
}
function App() { return <QueryClientProvider client={queryClient}>{import.meta.env.DEV&&DATA_MODE==='mock'&&<div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">Demo veri modu açık · Giriş, favori kaydı, başvuru, ilan yönetimi ve admin işlemleri gerçek API gerektirir.</div>}<AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><UnsavedChanges/><Routed/></WouterRouter><Toaster/></TooltipProvider></AuthProvider></QueryClientProvider>; }
export default App;
