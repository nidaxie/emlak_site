import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, useRoute, useSearch, Router as WouterRouter } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, type RegisterOptions } from 'react-hook-form';
import { AuthProvider, useAuth } from '@/hooks/auth-context';
import { keys, useAgent, useAgentProperties, useApplication, useApplicationDocs, useApiCities, useApiDistricts, useApiNeighborhoods, useCities, useDistricts, useFavorites, useInvalidateMarketplace, useMineProperties, useNeighborhoods, useProperties, useProperty, useToggleFavorite, useAdminUsers, useAdminAgents, useAdminApps, useAdminProperties, useAdminAudit, useMe } from '@/hooks/use-api';
import { adminApi, agentsApi, applicationsApi, propertiesApi, usersApi } from '@/services/api';
import { ApiRequestError, fileUrl } from '@/lib/api-client';
import { EmptyState, ErrorState, labels, money, area, Pagination, PropertyCardView, SectionTitle, SkeletonGrid, inputClass } from '@/components/market-ui';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Heart, Home, MapPin, Menu, Phone, Search, ShieldCheck, SlidersHorizontal, UserRound, X } from 'lucide-react';
import type { AgentDocumentType, CreateAgentApplicationRequest, CreatePropertyRequest, PropertyCard, PropertyStatus, PublicPropertyListQuery, RegisterRequest, UpdatePropertyRequest } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { DATA_MODE } from '@/lib/data-mode';
import { YuvaLogo } from '@/components/yuva-logo';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (failureCount, error) => !(error instanceof TypeError) && failureCount < 1, staleTime: 25000, refetchOnWindowFocus: false } } });
const showError = (e: unknown) => e instanceof TypeError ? 'API sunucusuna bağlanılamadı. Sunucu adresini, durumunu ve CORS ayarlarını kontrol edin.' : e instanceof ApiRequestError ? e.message : 'Bir sorun oluştu. Lütfen tekrar deneyin.';
function Header() {
  const { user, isAuthenticated, isLoading, logout } = useAuth(); const [open, setOpen] = useState(false);
  const platformHref = user?.role === 'ADMIN' ? '/admin' : user?.role === 'AGENT' ? '/panel' : '/emlakci-basvuru';
  const platformLabel = user?.role === 'ADMIN' ? 'Yönetim' : user?.role === 'AGENT' ? 'Panelim' : 'Emlakçı Ol';
  const navItems: [string, string][] = [['/', 'Ana Sayfa'], ['/ilanlar', 'İlanlar'], ['/favoriler', 'Favoriler'], ['/nasil-ilan-verilir', 'Nasıl İlan Verilir?'], [platformHref, platformLabel]];
  const logoutNow = async () => { await logout(); setOpen(false); };
  return <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur"><div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
    <YuvaLogo/><nav className="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Ana menü">{navItems.map(([href, label]) => <Link key={href + label} href={href} className="nav-link">{label}</Link>)}</nav>
    <div className="hidden items-center gap-3 lg:flex">{isLoading ? <div className="skeleton h-10 w-36 rounded-full" aria-hidden="true"/> : isAuthenticated && user ? <div className="relative"><button className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold" onClick={() => setOpen(!open)} data-testid="button-account-menu"><CircleUserRound size={17}/>{user.firstName || user.email || 'Hesabım'}<ChevronDown size={14}/></button>{open && <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-border bg-card p-2 shadow-xl">
      <div className="mb-1 border-b border-border px-3 py-2"><p className="truncate text-xs font-semibold text-foreground">{user.email}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{labels[user.role]}</p></div>
      {user.role === 'USER' && <><MenuLink href="/profil">Profilim</MenuLink><MenuLink href="/favoriler">Favorilerim</MenuLink><MenuLink href="/emlakci-basvuru">Emlakçı Başvurum</MenuLink></>}
      {user.role === 'AGENT' && <><MenuLink href="/panel">Genel Bakış</MenuLink><MenuLink href="/panel/ilanlar">İlan Yönetimi</MenuLink><MenuLink href="/panel/emlakci-profili">Emlakçı Profilim</MenuLink><MenuLink href="/favoriler">Favorilerim</MenuLink></>}
      {user.role === 'ADMIN' && <><MenuLink href="/admin">Yönetim</MenuLink><MenuLink href="/admin/kullanicilar">Kullanıcılar</MenuLink><MenuLink href="/admin/basvurular">Başvurular</MenuLink></>}
      <button onClick={logoutNow} className="w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-muted" data-testid="button-logout">Çıkış yap</button></div>}</div> : <><Link href="/giris" className="rounded-xl px-4 py-2.5 text-sm font-semibold">Giriş yap</Link><Link href="/kayit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Ücretsiz kayıt</Link></>}</div>
    <button className="grid h-10 w-10 place-items-center rounded-xl border border-border lg:hidden" onClick={() => setOpen(!open)} aria-label="Menüyü aç" data-testid="button-mobile-menu">{open ? <X/> : <Menu/>}</button></div>
    {open && <div className="border-t border-border bg-background px-5 py-4 lg:hidden"><nav className="grid gap-1">{navItems.map(([href, label]) => <Link key={href + label} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">{label}</Link>)}{isLoading ? null : isAuthenticated && user ? <><Link href="/profil" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">Profilim</Link><button onClick={logoutNow} className="px-3 py-3 text-left text-sm text-destructive">Çıkış yap</button></> : <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3"><Link href="/giris" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-center text-sm font-semibold">Giriş yap</Link><Link href="/kayit" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground">Ücretsiz kayıt</Link></div>}</nav></div>}
  </header>;
}
function MenuLink({ href, children }: { href: string; children: ReactNode }) { return <Link href={href} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">{children}</Link>; }
function Footer() { return <footer className="mt-20 bg-[#213c38] text-white"><div className="mx-auto max-w-[1280px] px-5 py-10 lg:px-10"><div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><YuvaLogo tone="cream"/><p className="mt-2 max-w-sm text-sm leading-6 text-white/65">Yeni bir eve giden yolu biraz daha anlaşılır kılmak için buradayız.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/80" aria-label="Alt menü"><Link href="/ilanlar" className="hover:text-white">İlanlar</Link><Link href="/favoriler" className="hover:text-white">Favoriler</Link><Link href="/nasil-ilan-verilir" className="hover:text-white">Nasıl İlan Verilir?</Link><Link href="/emlakci-basvuru" className="hover:text-white">Emlakçı Ol</Link><Link href="/giris" className="hover:text-white">Giriş yap</Link></nav></div><div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-white/45 sm:text-left">© Yuva · Türkiye</div></div></footer>; }
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
function HomeCityCard({ city, property }: { city: { id: string; name: string }; property?: PropertyCard }) {
  const image = fileUrl(property?.coverImageUrl);
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
    <section className="home-cities border-y border-[#e4e0d5] bg-[#f1eee5]"><div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-10 lg:py-16"><SectionTitle eyebrow="Lokasyona göre keşfet" title="Şehirlere Göre Keşfet" description="Şehir seçin, o bölgedeki gayrimenkul ilanlarını inceleyin."/><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 xl:grid-cols-6">{cities.isLoading?[1,2,3,4,5,6].map(i=><span className="skeleton h-36 rounded-xl" key={i}/>):cities.error?<ErrorState retry={()=>cities.refetch()} message={showError(cities.error)}/>:cities.data?.map(city=><HomeCityCard key={city.id} city={city} property={listings.find(item=>item.city===city.name)}/>)}</div></div></section>
    <section className="mx-auto max-w-[1440px] px-5 py-14 md:py-16 lg:px-10 lg:py-20"><div className="home-agent-cta relative overflow-hidden rounded-2xl bg-[#173d32] px-6 py-9 text-white md:px-12 md:py-12"><div className="cta-circle"/><div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="max-w-2xl"><p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#c8dbcf]">Emlakçılar ve ev sahipleri için</p><h2 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">Gayrimenkulünüzü doğru kişilerle buluşturun.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/75 md:text-base">Emlakçı başvurusu ve ilan verme adımlarını mevcut akışlardan inceleyin. Bireysel ilan oluşturma henüz kullanıma açık değildir.</p></div><div className="relative flex flex-col gap-3 sm:flex-row"><Link href="/nasil-ilan-verilir" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-5 font-semibold text-white transition-colors hover:bg-white/10">İlan verme yolları <ArrowRight size={17}/></Link><Link href="/nasil-ilan-verilir?audience=advisor" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f0cf9c] px-5 font-bold text-[#253b35] transition-colors hover:bg-[#f6ddb4]">Emlakçı süreci <ArrowRight size={17}/></Link></div></div></div></section>
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
function FilterSelect({label,value,onChange,options,empty='Seçin',disabled=false}:{label:string;value:string;onChange:(v:string)=>void;options:string[][];empty?:string;disabled?:boolean}) { return <label className="mb-4 block text-xs font-semibold text-muted-foreground">{label}<select className={inputClass + ' mt-1.5'} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>; }
function FilterRange({label,min,max,onMin,onMax}:{label:string;min:string;max:string;onMin:(v:string)=>void;onMax:(v:string)=>void}) { return <fieldset className="mb-4"><legend className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</legend><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="any" className={inputClass} placeholder="Minimum" aria-label={label + ' minimum'} inputMode="decimal" value={min} onChange={e=>onMin(e.target.value)}/><input type="number" min="0" step="any" className={inputClass} placeholder="Maksimum" aria-label={label + ' maksimum'} inputMode="decimal" value={max} onChange={e=>onMax(e.target.value)}/></div></fieldset>; }

function PropertyDetailPage() {
  const [match,params]=useRoute('/ilan/:id'); const id=params?.id||''; const q=useProperty(id); const [imageIndex,setImageIndex]=useState(0); const [lightbox,setLightbox]=useState(false); const [imageError,setImageError]=useState<string|null>(null); const {isAuthenticated}=useAuth(); const [location,go]=useLocation(); const search=useSearch(); const fav=useToggleFavorite();
  const currentTarget = `${location}${search ? `?${search}` : ''}`;
  useEffect(()=>setImageError(null),[q.data?.images[imageIndex]?.url,q.data?.coverImageUrl]);
  if(!match)return null;
  if(q.isLoading)return <PublicLayout><div className="mx-auto max-w-6xl p-8"><div className="skeleton h-[420px] rounded-3xl"/><div className="skeleton mt-8 h-32"/></div></PublicLayout>;
  if(q.error){const notFound=(q.error instanceof ApiRequestError&&q.error.status===404)||(DATA_MODE==='mock'&&q.error instanceof Error&&q.error.message==='Demo ilanı bulunamadı.');return <PublicLayout><div className="mx-auto max-w-5xl px-5 py-16">{notFound?<EmptyState title="İlan bulunamadı" text="Bu ilan mevcut değil veya yayından kaldırılmış olabilir." href="/ilanlar" action="İlanlara dön"/>:<ErrorState message={showError(q.error)}/>}</div></PublicLayout>;}
  const p=q.data; if(!p)return null; const images=p.images.slice().sort((a,b)=>a.sortOrder-b.sortOrder); const src=fileUrl(images[imageIndex]?.url || p.coverImageUrl); const imageAvailable=!!src&&imageError!==src;
  const facts=[['Oda',`${p.rooms}+${p.livingRooms}`],['Brüt alan',`${area(p.grossAreaM2)} m²`],['Net alan',p.netAreaM2?`${area(p.netAreaM2)} m²`:'—'],['Bina yaşı',p.buildingAge??'—'],['Bulunduğu kat',p.floor??'—'],['Toplam kat',p.totalFloors??'—'],['Isıtma',p.heatingType?labels[p.heatingType]:'—'],['Eşyalı',p.isFurnished?'Evet':'Hayır'],['Balkon',p.hasBalcony?'Var':'Yok'],['Asansör',p.hasElevator?'Var':'Yok'],['Otopark',p.hasParking?'Var':'Yok'],['Site içinde',p.inSite?'Evet':'Hayır']];
  return <PublicLayout><div className="mx-auto max-w-[1280px] px-5 py-8"><Link href="/ilanlar" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16}/> İlanlara dön</Link><div className="grid gap-8 lg:grid-cols-[1.45fr_.8fr]"><section><div className="detail-image relative overflow-hidden rounded-[1.5rem] bg-muted">{imageAvailable?<img src={src!} alt={p.title} role="button" tabIndex={0} onClick={()=>setLightbox(true)} onError={()=>setImageError(src)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setLightbox(true);}}} className="h-full w-full cursor-zoom-in object-cover"/>:<div className="property-image-fallback grid h-full min-h-[340px] place-items-center" role="img" aria-label="İlan görseli kullanılamıyor"><Home size={58} className="text-emerald-900/30"/></div>}{images.length>1&&<div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between"><button className="gallery-arrow" onClick={()=>setImageIndex((imageIndex-1+images.length)%images.length)} aria-label="Önceki fotoğraf"><ChevronLeft/></button><button className="gallery-arrow" onClick={()=>setImageIndex((imageIndex+1)%images.length)} aria-label="Sonraki fotoğraf"><ChevronRight/></button></div>}<span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{images.length?`${imageIndex+1} / ${images.length}`:'Fotoğraf bulunmuyor'}</span></div>{images.length>1&&<div className="mt-3 flex gap-2 overflow-x-auto">{images.map((im,i)=><button key={im.id} className={`h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 ${i===imageIndex?'border-primary':'border-transparent'}`} onClick={()=>setImageIndex(i)}><img src={fileUrl(im.url)||''} alt={`${p.title} ${i+1}`} onError={e=>{e.currentTarget.style.opacity='0';}} className="h-full w-full object-cover"/></button>)}</div>}
      {lightbox&&imageAvailable&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#14211e]/95 p-4" role="dialog" aria-modal="true" aria-label="İlan fotoğrafı görüntüleyici" onClick={()=>setLightbox(false)}><button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white" aria-label="Görüntüleyiciyi kapat" onClick={()=>setLightbox(false)}><X/></button>{images.length>1&&<button className="gallery-arrow absolute left-4 top-1/2 -translate-y-1/2" onClick={e=>{e.stopPropagation();setImageIndex((imageIndex-1+images.length)%images.length);}} aria-label="Önceki fotoğraf"><ChevronLeft/></button>}<img src={src!} alt={p.title} className="max-h-[88dvh] max-w-[92vw] rounded-lg object-contain" onError={()=>setImageError(src)} onClick={e=>e.stopPropagation()}/>{images.length>1&&<button className="gallery-arrow absolute right-4 top-1/2 -translate-y-1/2" onClick={e=>{e.stopPropagation();setImageIndex((imageIndex+1)%images.length);}} aria-label="Sonraki fotoğraf"><ChevronRight/></button>}</div>}
      <div className="mt-10"><SectionTitle eyebrow="İlan detayları" title="Öne çıkan özellikler"/><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{facts.map(([key,val])=><div key={key} className="rounded-xl bg-card p-4"><p className="text-xs text-muted-foreground">{key}</p><p className="mt-1 font-semibold">{val}</p></div>)}</div></div><div className="mt-10"><SectionTitle title="Açıklama"/><p className="whitespace-pre-line leading-7 text-muted-foreground">{p.description}</p></div><div className="mt-10"><SectionTitle title="Konum"/><div className="surface p-5"><p className="flex items-center gap-2 font-semibold"><span className="text-primary"><Home size={17}/></span>{p.neighborhood}, {p.district}, {p.city}</p><p className="mt-2 text-sm text-muted-foreground">{p.address}</p><p className="mt-3 text-xs text-muted-foreground">Konum koordinatları: {p.latitude}, {p.longitude}</p></div></div></section>
      <aside><div className="surface sticky top-28 p-6"><div className="flex items-center justify-between"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">{labels[p.listingType]} · {labels[p.propertyType]}</span><button type="button" disabled={fav.isPending} onClick={()=>isAuthenticated?fav.mutate({id:p.id,favorite:p.isFavorite}):go(`/giris?returnTo=${encodeURIComponent(currentTarget)}`)} aria-label={p.isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={p.isFavorite} data-testid={`button-detail-favorite-${p.id}`} className={`grid h-10 w-10 place-items-center rounded-full bg-muted ${p.isFavorite?'text-rose-600':''}`}><Heart fill={p.isFavorite?'currentColor':'none'}/></button></div><p className="mt-5 font-display text-4xl font-extrabold text-primary">{money(p.price)}</p><h1 className="mt-3 font-display text-2xl font-bold leading-snug">{p.title}</h1><p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">{p.neighborhood}, {p.district}, {p.city}</p><div className="my-5 grid grid-cols-3 border-y border-border py-4 text-center"><span><b className="block">{p.rooms}+{p.livingRooms}</b><small className="text-xs text-muted-foreground">Oda</small></span><span><b className="block">{area(p.grossAreaM2)} m²</b><small className="text-xs text-muted-foreground">Brüt</small></span><span><b className="block">{p.buildingAge??'—'}</b><small className="text-xs text-muted-foreground">Bina yaşı</small></span></div><div className="flex items-center gap-3 rounded-xl bg-muted/70 p-4"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-primary">{p.agent.logoUrl&&fileUrl(p.agent.logoUrl)?<img src={fileUrl(p.agent.logoUrl)!} alt="" className="h-full w-full object-cover"/>:<Building2 size={22}/>}</div><div className="min-w-0 flex-1"><Link href={`/emlakci/${p.agent.slug}`} className="block truncate font-bold hover:text-primary">{p.agent.companyName}</Link><Link href={`/emlakci/${p.agent.slug}`} className="text-xs text-primary">Emlakçı profili</Link></div></div><a href={`tel:${p.agent.phone}`} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"><Phone size={17}/> {p.agent.phone}</a><p className="mt-3 text-center text-[11px] text-muted-foreground">İlan hakkında bilgi almak için emlakçıyla iletişime geçin.</p></div></aside></div></div></PublicLayout>;
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
  if(success)return <PublicLayout><div className="mx-auto max-w-xl px-5 py-20"><div className="surface p-10 text-center"><BadgeCheck className="mx-auto text-primary" size={40}/><h1 className="mt-4 font-display text-3xl font-bold">Hesabınız hazır</h1><p className="mt-2 text-muted-foreground">Kaydınız tamamlandı. Devam etmek için giriş yapın.</p><Link href={loginHref} className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-white">Giriş sayfasına git</Link></div></div></PublicLayout>;
  const field=(name:keyof RegisterRequest,label:string,type='text',required=false)=><FormField key={name} control={form.control} name={name} rules={{required:required?`${label} zorunludur.`:false,...(name==='password'&&!isLogin?{minLength:{value:8,message:'Şifre en az 8 karakter olmalıdır.'},maxLength:{value:128,message:'Şifre en fazla 128 karakter olabilir.'}}:name==='password'&&isLogin?{maxLength:{value:128,message:'Şifre en fazla 128 karakter olabilir.'}}:{}),...(name==='firstName'||name==='lastName'?{maxLength:{value:80,message:`${label} en fazla 80 karakter olabilir.`}}:{}),...(name==='phone'?{maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}}:{})}} render={({field:input})=><FormItem><FormLabel>{label}{required?' *':''}</FormLabel><FormControl><input {...input} type={type} className={inputClass} autoComplete={name==='password'?(isLogin?'current-password':'new-password'):name==='email'?'email':'off'} data-testid={`input-${name}`}/></FormControl><FormMessage/></FormItem>}/>;
  return <PublicLayout><div className="auth-stage px-5 py-12 md:py-20"><div className="mx-auto grid max-w-[1020px] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-xl shadow-[#384d42]/8 md:grid-cols-[.85fr_1fr]"><div className="auth-aside relative hidden p-10 text-white md:flex md:flex-col md:justify-between"><YuvaLogo tone="cream"/><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#cbdacf]">Yuva’ya hoş geldiniz</p><h2 className="mt-4 font-display text-4xl font-extrabold leading-tight">Yeni bir yer,<br/>yeni bir hikâye.</h2><p className="mt-4 max-w-xs text-sm leading-6 text-white/70">Yaşamınıza uygun evi bulmak için ilanları güvenle keşfedin.</p></div><small className="text-white/50">Türkiye’de yaşam alanları için.</small></div><div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{isLogin?'Hesabınıza dönün':'Aramıza katılın'}</p><h1 className="mt-2 font-display text-3xl font-extrabold">{isLogin?'Giriş yap':'Hesap oluştur'}</h1><p className="mt-2 text-sm text-muted-foreground">{isLogin?'İlanları kaydetmek ve hesabınızı yönetmek için giriş yapın.':'Ücretsiz hesabınızla size uygun yaşam alanını bulun.'}</p>
    {error&&<div role="alert" className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    <Form {...form}><form onSubmit={onSubmit} className="mt-6 grid gap-4">{!isLogin&&<div className="grid gap-4 sm:grid-cols-2">{field('firstName','Ad')}{field('lastName','Soyad')}</div>}{field('email','E-posta','email',true)}{!isLogin&&field('phone','Telefon','tel')}{field('password','Şifre','password',true)}<button disabled={form.formState.isSubmitting} className="mt-2 h-12 rounded-xl bg-primary font-bold text-white disabled:opacity-60">{form.formState.isSubmitting?'İşleniyor…':isLogin?'Giriş yap':'Ücretsiz kayıt ol'}</button></form></Form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{isLogin?'Henüz hesabınız yok mu?':'Zaten hesabınız var mı?'} <Link href={isLogin?registerHref:loginHref} className="font-bold text-primary">{isLogin?'Kayıt olun':'Giriş yapın'}</Link></p>
  </div></div></div></PublicLayout>;
}

function FavoritesPage() {
  const [page,setPage]=useState(1); const q=useFavorites(page); const fav=useToggleFavorite();
  return <Guard><PublicLayout><div className="mx-auto max-w-[1440px] px-5 py-12 lg:px-10"><SectionTitle eyebrow="Sizin seçtikleriniz" title="Favorilerim" description="Beğendiğiniz ilanlara daha sonra buradan ulaşın."/>
    {DATA_MODE==='mock'?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Favorilerinizi görüntülemek ve yönetmek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>:q.isLoading?<SkeletonGrid/>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data?.items.length?<><div className="home-property-grid grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">{q.data.items.map(p=><PropertyCardView key={p.id} property={p} onFavorite={(id,is)=>fav.mutate({id,favorite:is})} favoriteBusy={fav.isPending}/>)}</div><Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/></>:<EmptyState title="Henüz favori ilanınız yok" text="İlan kartlarındaki kalp simgesine dokunarak beğendiklerinizi burada saklayabilirsiniz." href="/ilanlar" action="İlanları keşfet"/>}</div></PublicLayout></Guard>;
}
function ProfilePage() {
  const me=useMe(),qc=useQueryClient(); const {syncUser}=useAuth(); const {toast}=useToast(); const [message,setMessage]=useState(''); const form=useForm<{firstName:string;lastName:string;phone:string}>({defaultValues:{firstName:'',lastName:'',phone:''}});
  useEffect(()=>{if(me.data)form.reset({firstName:me.data.firstName||'',lastName:me.data.lastName||'',phone:me.data.phone||''});},[me.data,form]);
  const save=useMutation({mutationFn:usersApi.updateMe,onSuccess:data=>{qc.setQueryData(['me'],data);syncUser(data);setMessage('Profil bilgileriniz güncellendi.');toast({title:'Profil bilgileriniz güncellendi.'});}});
  return <Guard><PublicLayout><div className="mx-auto max-w-4xl px-5 py-12"><SectionTitle eyebrow="Hesap ayarları" title="Profilim" description="Hesap ve iletişim bilgilerinizi yönetin."/>
    {DATA_MODE==='mock'?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Profil bilgilerinizi görüntülemek ve düzenlemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>:me.isLoading?<div className="surface p-8"><div className="skeleton h-40"/></div>:me.error?<ErrorState retry={()=>me.refetch()} message={showError(me.error)}/>:<div className="surface p-7"><div className="mb-6 grid gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">E-posta · düzenlenemez<input className={inputClass+' cursor-not-allowed opacity-70'} value={me.data?.email||''} readOnly disabled aria-readonly="true" data-testid="input-profile-email"/></label><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Hesap türü · düzenlenemez<input className={inputClass+' cursor-not-allowed opacity-70'} value={labels[me.data?.role||'USER']||me.data?.role||''} readOnly disabled aria-readonly="true" data-testid="input-profile-role"/></label></div><form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(v=>{setMessage('');save.mutate({firstName:v.firstName.trim(),lastName:v.lastName.trim(),phone:v.phone.trim()});})}><label className="grid gap-1.5 text-sm font-semibold">Ad<input className={inputClass} data-testid="input-profile-firstName" {...form.register('firstName',{maxLength:{value:80,message:'Ad en fazla 80 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.firstName?.message}</span></label><label className="grid gap-1.5 text-sm font-semibold">Soyad<input className={inputClass} data-testid="input-profile-lastName" {...form.register('lastName',{maxLength:{value:80,message:'Soyad en fazla 80 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.lastName?.message}</span></label><label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Telefon<input className={inputClass} type="tel" data-testid="input-profile-phone" {...form.register('phone',{maxLength:{value:32,message:'Telefon en fazla 32 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.phone?.message}</span></label>{message&&<p role="status" className="text-sm text-primary sm:col-span-2">{message}</p>}{save.error&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{showError(save.error)}</p>}<button className="h-11 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={save.isPending} data-testid="button-profile-save">{save.isPending?'Kaydediliyor…':'Değişiklikleri kaydet'}</button></form></div>}</div></PublicLayout></Guard>;
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
      const isPending=app.data?.status==='PENDING';
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
        ...(isPending?{description:trimmedDesc}:trimmedDesc?{description:trimmedDesc}:{}),
      };
      return isPending?applicationsApi.updateMyApplication(payload):applicationsApi.createApplication(payload);
    },
    onSuccess:(saved)=>{
      const wasPending=app.data?.status==='PENDING';
      qc.setQueryData(keys.application,saved);
      void qc.invalidateQueries({queryKey:keys.application});
      void qc.invalidateQueries({queryKey:keys.applicationDocs});
      const msg=wasPending?'Başvuru bilgileriniz güncellendi.':'Başvurunuz alındı ve incelemeye gönderildi.';
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
  const isApproved=currentApp?.status==='APPROVED';

  return <Guard roles={['USER']}><PublicLayout><div className="mx-auto max-w-4xl px-5 py-12"><SectionTitle eyebrow="Profesyonel hesabı" title="Emlakçı başvurusu" description="Başvurunuzu ve gerekli belgeleri tek yerden yönetin."/>
    {isMock?<EmptyState title="Bu özellik gerçek API bağlantısı gerektirir" text="Emlakçı başvurusu oluşturmak ve belge yüklemek için gerçek API modunda giriş yapın." href="/ilanlar" action="İlanları keşfet"/>:app.isLoading?<div className="surface p-8"><div className="skeleton h-40"/></div>:hasRealError?<ErrorState retry={()=>app.refetch()} message={showError(app.error)}/>:<div className="grid gap-6">
      {currentApp&&<div className="surface flex flex-wrap items-center justify-between gap-3 p-5" data-testid="card-application-status">
        <div>
          <p className="text-xs text-muted-foreground">Başvuru durumu</p>
          <p className="mt-1 font-bold" data-testid="text-application-status">{labels[currentApp.status]||currentApp.status}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">{new Date(currentApp.updatedAt).toLocaleDateString('tr-TR')}</span>
        {currentApp.status==='PENDING'&&<p className="w-full text-xs text-muted-foreground">Başvurunuz inceleme aşamasındadır. Onay sürecinin tamamlanması için Vergi Levhası ve Yetki Belgesi dosyalarının ikisi de yüklenmiş olmalıdır.</p>}
        {currentApp.status==='APPROVED'&&<div className="w-full rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Başvurunuz onaylandı. Emlak danışmanı hesabınız aktif edildi.</div>}
        {currentApp.status==='REJECTED'&&<div className="w-full rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p className="font-semibold">Başvurunuz reddedildi{currentApp.rejectionReason?`: ${currentApp.rejectionReason}`:''}</p><p className="mt-1 text-xs">Bilgilerinizi düzenleyerek aşağıdaki formdan yeni bir başvuru gönderebilirsiniz. Yeni başvuru oluşturulduktan sonra belgelerinizi tekrar yüklemeniz gerekir.</p></div>}
      </div>}

      <div className="surface p-6">
        <h2 className="mb-5 font-display text-xl font-bold">{currentApp?.status==='PENDING'?'Başvuru bilgilerini güncelle':currentApp?.status==='REJECTED'?'Yeni başvuru oluştur':'Firma bilgileri'}</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(v=>mutation.mutate(v))}>
          {fieldConfigs.map(({key,label,type='text',rules})=><label className="grid gap-1.5 text-sm font-semibold" key={key}>{label} *<input className={inputClass} type={type} disabled={isApproved||mutation.isPending} data-testid={`input-app-${key}`} {...form.register(key,rules)}/><span className="text-xs text-destructive">{form.formState.errors[key]?.message}</span></label>)}
          <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Açıklama<textarea className={`${inputClass} h-24 py-3`} disabled={isApproved||mutation.isPending} data-testid="input-app-description" {...form.register('description',{maxLength:{value:2000,message:'Açıklama en fazla 2000 karakter olabilir.'}})}/><span className="text-xs text-destructive">{form.formState.errors.description?.message}</span></label>
          <button disabled={mutation.isPending||isApproved} data-testid="button-submit-application" className="h-11 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60 sm:col-span-2">{mutation.isPending?'Gönderiliyor…':currentApp?.status==='PENDING'?'Başvuruyu güncelle':currentApp?.status==='REJECTED'?'Yeni başvuru oluştur':'Başvuruyu gönder'}</button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">İncelemedeki başvurunuzu güncelleyebilir veya reddedilmiş bir başvuru için yenisini gönderebilirsiniz.</p>
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
              {currentApp.status==='PENDING'?<label className={`mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border px-3 py-3 text-sm font-semibold hover:border-primary ${isUploading?'pointer-events-none opacity-60':''}`}>{isUploading?'Yükleniyor…':doc?'Belgeyi değiştir':'Belge yükle'}<input className="sr-only" type="file" disabled={isUploading} data-testid={`input-file-${type}`} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,type);e.currentTarget.value='';}}/></label>:<p className="mt-3 text-xs text-muted-foreground">Belgeler yalnızca incelemedeki başvuru için yüklenebilir veya değiştirilebilir.</p>}
            </div>;
          })}
        </div>
        {docs.error&&<p className="mt-3 text-sm text-destructive">{showError(docs.error)}</p>}
      </div>}

      {feedback&&<p role="status" className="text-sm text-primary" data-testid="text-application-feedback">{feedback}</p>}
      {errorMsg&&<p role="alert" className="text-sm text-destructive" data-testid="text-application-error">{errorMsg}</p>}
    </div>}</div></PublicLayout></Guard>;
}

function PanelLayout({ children }: { children: ReactNode }) {
  return <Guard roles={['AGENT']}>
    <div className="min-h-[75vh] bg-[#f4f3ed]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <YuvaLogo />
            <div className="sm:border-l sm:border-[#d8dbd1] sm:pl-5">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Emlakçı çalışma alanı</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold">İşinizi yönetin</h1>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={16}/> Ana sayfaya dön</Link>
        </div>
        <div className="grid gap-7 lg:grid-cols-[230px_1fr]">
          <aside className="surface h-fit p-3">
            <nav className="grid gap-1">{[['/panel','Genel Bakış'],['/panel/ilanlar','İlanlarım'],['/panel/ilanlar/yeni','Yeni ilan'],['/panel/emlakci-profili','Emlakçı profilim'],['/favoriler','Favoriler']].map(([href,label])=><Link key={href} href={href} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-secondary hover:text-primary">{label}</Link>)}</nav>
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  </Guard>;
}
function AgentHome() {
  const q=useMineProperties({page:1,limit:100});
  return <PanelLayout><div className="surface p-7"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Genel bakış</p><h2 className="mt-2 font-display text-3xl font-extrabold">Portföyünüze hoş geldiniz</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">İlanlarınızı güncel tutun; yeni bir ilan ekleyerek arayanlarla buluşun.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/panel/ilanlar/yeni" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">Yeni ilan oluştur</Link><Link href="/panel/ilanlar" className="rounded-xl border border-border px-5 py-3 text-sm font-bold">İlanlarımı görüntüle</Link></div></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="surface p-5"><small className="text-xs text-muted-foreground">Gösterilen kayıtlar</small><p className="mt-1 text-3xl font-extrabold">{q.data?.items.length??'—'}</p><small className="text-xs text-muted-foreground">Yüklenen ilk sayfa verisi</small></div><div className="surface p-5"><small className="text-xs text-muted-foreground">Yayındaki ilanlar</small><p className="mt-1 text-3xl font-extrabold">{q.data?.items.filter(p=>p.status==='ACTIVE').length??'—'}</p><small className="text-xs text-muted-foreground">Bu liste yanıtındaki aktif kayıt</small></div><Link href="/panel/emlakci-profili" className="surface p-5 hover:border-primary"><small className="text-xs text-muted-foreground">Emlakçı profili</small><p className="mt-2 font-bold">Bilgilerinizi güncelleyin <ArrowRight className="inline" size={15}/></p></Link></div>{q.error&&<p className="mt-4 text-sm text-muted-foreground">İlan özeti yüklenemedi.</p>}</PanelLayout>;
}
const transitions:Record<PropertyStatus,PropertyStatus[]>={ACTIVE:['INACTIVE','SOLD','RENTED'],INACTIVE:['ACTIVE'],SOLD:['ACTIVE'],RENTED:['ACTIVE']};
function AgentPropertiesPage() {
  const [page,setPage]=useState(1); const q=useMineProperties({page,limit:20}); const qc=useQueryClient(); const [notice,setNotice]=useState('');
  const action=useMutation({mutationFn:({id,status}:{id:string;status:PropertyStatus})=>propertiesApi.status(id,{status}),onSuccess:()=>{qc.invalidateQueries({queryKey:['my-properties']});setNotice('İlan durumu güncellendi.');}});
  const remove=useMutation({mutationFn:propertiesApi.remove,onSuccess:()=>qc.invalidateQueries({queryKey:['my-properties']})});
  return <PanelLayout><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-extrabold">İlanlarım</h2><p className="mt-1 text-sm text-muted-foreground">İlanlarınızı, fiyatlarınızı ve yayın durumlarını yönetin.</p></div><Link href="/panel/ilanlar/yeni" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">+ Yeni ilan</Link></div>{notice&&<p className="mt-3 text-sm text-primary">{notice}</p>}
    <div className="mt-5 grid gap-3">{q.isLoading?[1,2,3].map(i=><div className="surface p-5" key={i}><div className="skeleton h-14"/></div>):q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data?.items.length?q.data.items.map(p=><article key={p.id} className="surface grid gap-4 p-5 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{p.title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{labels[p.status]}</span></div><p className="mt-2 text-lg font-extrabold text-primary">{money(p.price)} <span className="text-xs font-normal text-muted-foreground">· {labels[p.listingType]} · {labels[p.propertyType]}</span></p><p className="mt-1 text-xs text-muted-foreground">{p.city} · {new Date(p.createdAt).toLocaleDateString('tr-TR')}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={`/panel/ilanlar/${p.id}/duzenle`} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Düzenle</Link><select aria-label="İlan durumunu değiştir" className="h-10 rounded-lg border border-border bg-background px-2 text-sm" value="" onChange={e=>{if(e.target.value)action.mutate({id:p.id,status:e.target.value as PropertyStatus});e.currentTarget.value='';}}><option value="">Durum değiştir</option>{transitions[p.status].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select><button className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive" onClick={()=>{if(window.confirm('İlanı silmek istediğinize emin misiniz?'))remove.mutate(p.id);}}>Sil</button></div></article>):<EmptyState title="Henüz ilan eklemediniz" text="İlk ilanınızı oluşturarak portföyünüzü paylaşmaya başlayın." href="/panel/ilanlar/yeni" action="İlan oluştur"/>}</div>{q.data&&<Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/>}</PanelLayout>;
}
function PropertyEditor({edit=false}:{edit?:boolean}) {
  const [,params]=useRoute('/panel/ilanlar/:id/duzenle'); const id=edit?params?.id||'':''; const [,go]=useLocation(); const qc=useQueryClient(); const invalidate=useInvalidateMarketplace(); const cities=useApiCities(); const [cityId,setCityId]=useState(''),[districtId,setDistrictId]=useState(''),[uploads,setUploads]=useState<{id:string;url:string;isCover:boolean}[]>([]); const [message,setMessage]=useState('');
  const districts=useApiDistricts(cityId), neighborhoods=useApiNeighborhoods(districtId);
  const record=useQuery({queryKey:['my-property',id],queryFn:()=>propertiesApi.mineDetail(id),enabled:edit&&!!id});
  const form=useForm<CreatePropertyRequest>({defaultValues:{title:'',description:'',listingType:'SALE',propertyType:'APARTMENT',price:'',grossAreaM2:'',rooms:0,livingRooms:0,cityId:'',districtId:'',neighborhoodId:'',address:'',latitude:'',longitude:'',isFurnished:false,hasBalcony:false,hasElevator:false,hasParking:false,inSite:false}});
  useEffect(()=>{if(record.data){const r=record.data;setCityId(r.cityId);setDistrictId(r.districtId);form.reset({title:r.title,description:r.description,listingType:r.listingType,propertyType:r.propertyType,price:r.price,grossAreaM2:r.grossAreaM2,...(r.netAreaM2?{netAreaM2:r.netAreaM2}:{}),rooms:r.rooms,livingRooms:r.livingRooms,...(r.buildingAge!==null?{buildingAge:r.buildingAge}:{}),...(r.floor!==null?{floor:r.floor}:{}),...(r.totalFloors!==null?{totalFloors:r.totalFloors}:{}),...(r.heatingType?{heatingType:r.heatingType}:{}),cityId:r.cityId,districtId:r.districtId,neighborhoodId:r.neighborhoodId,address:r.address,latitude:r.latitude,longitude:r.longitude,isFurnished:r.isFurnished,hasBalcony:r.hasBalcony,hasElevator:r.hasElevator,hasParking:r.hasParking,inSite:r.inSite});}},[record.data,form]);
  const mutation=useMutation({mutationFn:(v:CreatePropertyRequest)=>{const data:CreatePropertyRequest={...v};if(!data.netAreaM2?.trim())delete data.netAreaM2;(['buildingAge','floor','totalFloors'] as const).forEach(key=>{if(!Number.isFinite(data[key]))delete data[key];});if(!data.heatingType)delete data.heatingType;return edit?propertiesApi.update(id,data as UpdatePropertyRequest):propertiesApi.create(data);},onSuccess:async result=>{invalidate();await qc.invalidateQueries({queryKey:['my-property',id]});if(!edit){go(`/panel/ilanlar/${result.id}/duzenle`);}setMessage('İlan bilgileri kaydedildi.');}});
  const upload=async(file:File)=>{if(file.size>10*1024*1024){setMessage('Fotoğraf 10 MB sınırını aşamaz.');return;}try{const result=await propertiesApi.uploadImage(id,file);setUploads(prev=>[...prev,{id:result.id,url:result.url,isCover:result.isCover}]);setMessage('Fotoğraf yüklendi.');}catch(e){setMessage(showError(e));}};
  const addFiles=async(files:FileList|null)=>{if(!files)return;for(const file of Array.from(files)){if(uploads.length>=20){setMessage('Bir ilanda en fazla 20 canlı fotoğraf olabilir.');break;}await upload(file);}};
  const chooseCover=async(imageId:string)=>{try{await propertiesApi.coverImage(id,imageId);setUploads(xs=>xs.map(x=>({...x,isCover:x.id===imageId})));}catch(e){setMessage(showError(e));}};
  const deleteImage=async(imageId:string)=>{try{await propertiesApi.deleteImage(id,imageId);setUploads(xs=>xs.filter(x=>x.id!==imageId));}catch(e){setMessage(showError(e));}};
  const reorder=async(from:number,to:number)=>{const next=[...uploads];const [item]=next.splice(from,1);next.splice(to,0,item);setUploads(next);try{await propertiesApi.orderImages(id,next.map(x=>x.id));}catch(e){setMessage(showError(e));}};
  const field=(name:keyof CreatePropertyRequest,label:string,type='text',required=true,placeholder?:string)=><label key={name} className="grid gap-1.5 text-sm font-semibold">{label}{required?' *':''}<input className={inputClass} type={type} placeholder={placeholder} {...form.register(name,{required:required?`${label} zorunludur.`:false, ...(type==='number'?{valueAsNumber:true}:{}),...(name==='title'?{minLength:{value:5,message:'En az 5 karakter girin.'},maxLength:{value:160,message:'En fazla 160 karakter olabilir.'}}:{}),...(name==='description'?{minLength:{value:20,message:'En az 20 karakter girin.'},maxLength:{value:5000,message:'En fazla 5000 karakter olabilir.'}}:{})})}/><span className="text-xs text-destructive">{form.formState.errors[name]?.message as string}</span></label>;
  if(edit&&record.isLoading)return <PanelLayout><div className="surface p-8"><div className="skeleton h-80"/></div></PanelLayout>;
  return <PanelLayout><div className="mb-5"><Link href="/panel/ilanlar" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> İlanlara dön</Link><h2 className="font-display text-2xl font-extrabold">{edit?'İlanı düzenle':'Yeni ilan oluştur'}</h2><p className="mt-1 text-sm text-muted-foreground">İlanınızı doğru ve eksiksiz bilgilerle yayınlayın.</p></div>{record.error&&<ErrorState message={showError(record.error)}/>}<form className="grid gap-5" onSubmit={form.handleSubmit(v=>{setMessage('');mutation.mutate(v);})}>
    <div className="surface p-6"><h3 className="mb-5 font-display text-xl font-bold">İlan bilgileri</h3><div className="grid gap-4 sm:grid-cols-2">{field('title','İlan başlığı','text',true,'5–160 karakter')}{field('price','Fiyat (₺)','text',true,'Örn. 4250000.50')}<FilterSelect label="İlan türü" value={form.watch('listingType')} onChange={v=>form.setValue('listingType',v as CreatePropertyRequest['listingType'])} options={[['SALE','Satılık'],['RENT','Kiralık']]}/><FilterSelect label="Emlak tipi" value={form.watch('propertyType')} onChange={v=>form.setValue('propertyType',v as CreatePropertyRequest['propertyType'])} options={['APARTMENT','HOUSE','VILLA','LAND','WORKPLACE'].map(k=>[k,labels[k]])}/>{field('grossAreaM2','Brüt alan (m²)','text',true)}{field('netAreaM2','Net alan (m²)','text',false)}{field('rooms','Oda sayısı','number')}{field('livingRooms','Salon sayısı','number')}{field('buildingAge','Bina yaşı','number',false)}{field('floor','Bulunduğu kat','number',false)}{field('totalFloors','Toplam kat','number',false)}<FilterSelect label="Isıtma" value={form.watch('heatingType')||''} onChange={v=>form.setValue('heatingType',v? v as NonNullable<CreatePropertyRequest['heatingType']>:undefined)} options={['COMBI','CENTRAL','FLOOR_HEATING','STOVE','NONE','OTHER'].map(k=>[k,labels[k]])} empty="Belirtilmedi"/><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Açıklama<textarea className={`${inputClass} h-32 py-3`} {...form.register('description',{required:true,minLength:20,maxLength:5000})}/><span className="text-xs text-destructive">{form.formState.errors.description?.message as string}</span></label></div></div>
    <div className="surface p-6"><h3 className="mb-5 font-display text-xl font-bold">Konum</h3><div className="grid gap-4 sm:grid-cols-3"><FilterSelect label="Şehir" value={cityId} onChange={v=>{setCityId(v);setDistrictId('');form.setValue('cityId',v);form.setValue('districtId','');form.setValue('neighborhoodId','');}} options={(cities.data||[]).map(c=>[c.id,c.name])}/><FilterSelect label="İlçe" value={districtId} onChange={v=>{setDistrictId(v);form.setValue('districtId',v);form.setValue('neighborhoodId','');}} options={(districts.data||[]).map(c=>[c.id,c.name])} disabled={!cityId}/><FilterSelect label="Mahalle" value={form.watch('neighborhoodId')} onChange={v=>form.setValue('neighborhoodId',v)} options={(neighborhoods.data||[]).map(c=>[c.id,c.name])} disabled={!districtId}/>{field('address','Açık adres','text',true)}{field('latitude','Enlem','text',true,'37.870000')}{field('longitude','Boylam','text',true,'32.490000')}</div><p className="mt-3 text-xs text-muted-foreground">Şehir, ilçe ve mahalle seçimleri gerçek konum kayıtlarından alınır.</p></div>
    <div className="surface p-6"><h3 className="mb-4 font-display text-xl font-bold">Ek özellikler</h3><div className="grid gap-3 sm:grid-cols-2">{[['isFurnished','Eşyalı'],['hasBalcony','Balkon'],['hasElevator','Asansör'],['hasParking','Otopark'],['inSite','Site içinde']].map(([k,l])=><label key={k} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-primary" {...form.register(k as keyof CreatePropertyRequest)}/>{l}</label>)}</div></div>
    <div className="surface p-6"><h3 className="font-display text-xl font-bold">Fotoğraflar</h3><p className="mt-1 text-sm text-muted-foreground">JPEG, PNG veya WebP · en fazla 10 MB / fotoğraf · en çok 20 fotoğraf</p>{edit?<><label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-sm font-semibold hover:border-primary">Fotoğraf seçin<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>void addFiles(e.target.files)}/></label><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{uploads.map((image,i)=><div key={image.id} className="relative overflow-hidden rounded-xl border border-border"><img src={fileUrl(image.url)||''} alt="Yüklenen ilan fotoğrafı" className="aspect-square w-full object-cover"/><div className="flex items-center justify-between p-2"><button type="button" onClick={()=>void chooseCover(image.id)} className="text-xs font-semibold text-primary">{image.isCover?'Kapak':'Kapak yap'}</button><button type="button" onClick={()=>void deleteImage(image.id)} className="text-xs text-destructive">Sil</button></div>{i>0&&<button type="button" className="absolute left-2 top-2 rounded-full bg-white p-1" onClick={()=>void reorder(i,i-1)} aria-label="Sola taşı"><ChevronLeft size={15}/></button>}{i<uploads.length-1&&<button type="button" className="absolute right-2 top-2 rounded-full bg-white p-1" onClick={()=>void reorder(i,i+1)} aria-label="Sağa taşı"><ChevronRight size={15}/></button>}</div>)}</div>{!uploads.length&&<p className="mt-3 text-xs text-muted-foreground">Bu oturumda yüklediğiniz fotoğraflar burada listelenir. Mevcut fotoğraf bilgileri bu kayıt yanıtında sunulmuyor.</p>}</>:<p className="mt-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground">İlanı ilk kez kaydettikten sonra fotoğraflarınızı ekleyebilirsiniz.</p>}</div>
    {message&&<p role="status" className="text-sm text-primary">{message}</p>}{mutation.error&&<p role="alert" className="text-sm text-destructive">{showError(mutation.error)}</p>}<div className="flex flex-wrap justify-end gap-3"><Link href="/panel/ilanlar" className="rounded-xl border border-border px-5 py-3 font-semibold">Vazgeç</Link><button className="rounded-xl bg-primary px-6 py-3 font-bold text-white" disabled={mutation.isPending}>{mutation.isPending?'Kaydediliyor…':edit?'İlanı kaydet':'İlanı oluştur'}</button></div></form></PanelLayout>;
}
function AgentProfilePage() {
  const qc=useQueryClient(); const q=useQuery({queryKey:['agent-me'],queryFn:agentsApi.mine}); const form=useForm({defaultValues:{companyName:'',phone:'',email:'',address:'',description:''}}); const [notice,setNotice]=useState('');
  useEffect(()=>{if(q.data)form.reset({companyName:q.data.companyName,phone:q.data.phone,email:q.data.email,address:q.data.address,description:q.data.description||''});},[q.data,form]);
  const update=useMutation({mutationFn:agentsApi.update,onSuccess:()=>{qc.invalidateQueries({queryKey:['agent-me']});if(q.data?.slug)qc.invalidateQueries({queryKey:['agent',q.data.slug]});setNotice('Emlakçı profili güncellendi.');}});
  const logo=useMutation({mutationFn:agentsApi.logo,onSuccess:()=>{qc.invalidateQueries({queryKey:['agent-me']});if(q.data?.slug)qc.invalidateQueries({queryKey:['agent',q.data.slug]});setNotice('Logo güncellendi.');}});
  return <PanelLayout><SectionTitle eyebrow="Profil yönetimi" title="Emlakçı profilim" description="Public profilde görünen şirket ve iletişim bilgileri."/>{q.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data&&<div className="grid gap-5"><div className="surface flex flex-wrap items-center gap-5 p-5"><div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-muted text-primary">{q.data.logoUrl&&fileUrl(q.data.logoUrl)?<img src={fileUrl(q.data.logoUrl)!} alt="Şirket logosu" className="h-full w-full object-cover"/>:<Building2 size={30}/>}</div><div className="flex-1"><p className="font-bold">Şirket logosu</p><p className="mt-1 text-xs text-muted-foreground">JPEG, PNG veya WebP · en fazla 5 MB</p></div><label className="cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Logo yükle<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>5*1024*1024)setNotice('Logo 5 MB sınırını aşamaz.');else logo.mutate(f);}e.currentTarget.value='';}}/></label></div><form className="surface grid gap-4 p-6 sm:grid-cols-2" onSubmit={form.handleSubmit(v=>update.mutate(v))}>{([['companyName','Firma adı'],['phone','Telefon'],['email','E-posta'],['address','Açık adres']] as const).map(([key,label])=><label key={key} className="grid gap-1.5 text-sm font-semibold">{label}<input className={inputClass} {...form.register(key,{required:true})}/></label>)}<label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Açıklama<textarea className={`${inputClass} h-24 py-3`} {...form.register('description')}/></label><div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground sm:col-span-2"><b>Değiştirilemeyen bilgiler:</b> Profil adresi: /emlakci/{q.data.slug} · {q.data.city}, {q.data.district} · Vergi numarası: {q.data.taxNumber} · Profil durumu: {q.data.isActive?'Aktif':'Pasif'}</div>{notice&&<p className="text-sm text-primary sm:col-span-2">{notice}</p>}<button className="h-11 rounded-xl bg-primary font-bold text-white sm:col-span-2" disabled={update.isPending}>Profili kaydet</button></form></div>}</PanelLayout>;
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
function AdminHome() { return <AdminLayout><div className="surface p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">Yönetim alanı</p><h2 className="mt-2 font-display text-3xl font-extrabold">Merhaba</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kullanıcıları, emlakçı başvurularını ve ilan moderasyonunu buradan yönetin. Bu ekranda sunulmayan ölçümler için tahmini metrik gösterilmez.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['/admin/kullanicilar','Kullanıcıları incele','Hesap rolü ve aktiflik durumlarını görüntüleyin.'],['/admin/basvurular','Başvuruları incele','Yeni emlakçı başvurularını değerlendirin.'],['/admin/emlakcilar','Emlakçı kayıtları','Hesap ve profil durumlarını ayrı ayrı yönetin.'],['/admin/ilanlar','İlan moderasyonu','İlanları gözden geçirin ve gerektiğinde müdahale edin.'],['/admin/audit-logs','Audit kayıtları','Yönetim değişikliklerini salt okunur görüntüleyin.']].map(([href,label,text])=><Link key={href} href={href} className="surface p-5 transition hover:-translate-y-0.5 hover:border-primary"><h3 className="font-bold">{label} <ArrowRight className="inline" size={15}/></h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></Link>)}</div></AdminLayout>; }
function AdminUsersPage() {
  const [email,setEmail]=useState(''),[role,setRole]=useState(''),[active,setActive]=useState(''),[page,setPage]=useState(1);
  const data=useAdminUsers({page,limit:20,...(email?{email}:{}),...(role?{role:role as 'USER'|'AGENT'|'ADMIN'}:{}),...(active?{isActive:active as 'true'|'false'}:{})});
  return <AdminLayout><SectionTitle eyebrow="Hesaplar" title="Kullanıcılar" description="E-posta, rol ve hesap durumuna göre arayın."/><div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-3"><input className={inputClass} placeholder="E-posta içinde ara" value={email} onChange={e=>{setEmail(e.target.value);setPage(1);}}/><select className={inputClass} value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="">Tüm roller</option>{['USER','AGENT','ADMIN'].map(r=><option key={r} value={r}>{labels[r]}</option>)}</select><select className={inputClass} value={active} onChange={e=>{setActive(e.target.value);setPage(1);}}><option value="">Tüm durumlar</option><option value="true">Aktif</option><option value="false">Pasif</option></select></div>{data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<><div className="surface overflow-x-auto"><table className="data-table"><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Durum</th><th>Kayıt</th><th></th></tr></thead><tbody>{data.data.items.map(u=><tr key={u.id}><td><b>{[u.firstName,u.lastName].filter(Boolean).join(' ')||'Ad belirtilmemiş'}</b><small>{u.email}</small></td><td>{labels[u.role]}</td><td><StatusPill active={u.isActive}/></td><td>{new Date(u.createdAt).toLocaleDateString('tr-TR')}</td><td><Link className="text-sm font-bold text-primary" href={`/admin/kullanicilar/${u.id}`}>Detay</Link></td></tr>)}</tbody></table></div><Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/></>:<EmptyState title="Kullanıcı bulunamadı" text="Bu filtrelerle eşleşen hesap yok."/>}</AdminLayout>;
}
function StatusPill({active}:{active:boolean}) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{active?'Aktif':'Pasif'}</span>; }
function AdminUserDetailPage() {
  const [match,params]=useRoute('/admin/kullanicilar/:id'); const id=params?.id||''; const q=useQuery({queryKey:['admin-user',id],queryFn:()=>adminApi.user(id),enabled:!!id}); const qc=useQueryClient(); const [message,setMessage]=useState('');
  const status=useMutation({mutationFn:(active:boolean)=>adminApi.userStatus(id,active),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-user',id]});qc.invalidateQueries({queryKey:['admin-users']});setMessage('Hesap durumu güncellendi.');}});
  if(!match)return null;
  return <AdminLayout><Link href="/admin/kullanicilar" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> Kullanıcı listesi</Link>{q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState message={showError(q.error)}/>:q.data&&<div className="surface p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl font-extrabold">{[q.data.firstName,q.data.lastName].filter(Boolean).join(' ')||'Ad belirtilmemiş'}</h2><p className="mt-1 text-muted-foreground">{q.data.email}</p></div><button disabled={status.isPending} onClick={()=>status.mutate(!q.data?.isActive)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">{q.data.isActive?'Hesabı pasife al':'Hesabı aktifleştir'}</button></div><div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"><Info label="Rol" value={labels[q.data.role]}/><Info label="Hesap durumu" value={q.data.isActive?'Aktif':'Pasif'}/><Info label="Telefon" value={q.data.phone||'—'}/><Info label="Oluşturulma" value={new Date(q.data.createdAt).toLocaleString('tr-TR')}/><Info label="Güncellenme" value={new Date(q.data.updatedAt).toLocaleString('tr-TR')}/></div>{q.data.agentProfile&&<div className="mt-6 rounded-xl bg-muted p-4"><h3 className="font-bold">Emlakçı profili</h3><p className="mt-1">{q.data.agentProfile.companyName} · {q.data.agentProfile.city}, {q.data.agentProfile.district}</p><p className="mt-1 text-sm text-muted-foreground">Profil durumu: {q.data.agentProfile.isActive?'Aktif':'Pasif'} · /emlakci/{q.data.agentProfile.slug}</p></div>}{message&&<p className="mt-4 text-sm text-primary">{message}</p>}{status.error&&<p className="mt-3 text-sm text-destructive">{showError(status.error)}</p>}</div>}</AdminLayout>;
}
function Info({label,value}:{label:string;value:string}) { return <div><small className="text-xs text-muted-foreground">{label}</small><p className="mt-1 font-semibold">{value}</p></div>; }

function AdminApplicationsPage() {
  const [status,setStatus]=useState(''),[page,setPage]=useState(1); const data=useAdminApps({page,limit:20,...(status?{status:status as 'PENDING'|'APPROVED'|'REJECTED'}:{})});
  return <AdminLayout><SectionTitle eyebrow="Emlakçı hesabı" title="Başvurular" description="Başvuruları durumuna göre inceleyin."/><div className="mb-4 flex gap-3"><select className={inputClass+' max-w-xs'} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Tüm başvurular</option>{['PENDING','APPROVED','REJECTED'].map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></div>{data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<><div className="surface overflow-x-auto"><table className="data-table"><thead><tr><th>Firma</th><th>Başvuran</th><th>Konum</th><th>Durum</th><th>Tarih</th><th></th></tr></thead><tbody>{data.data.items.map(a=><tr key={a.id}><td><b>{a.companyName}</b></td><td>{a.user.email}</td><td>{a.city}, {a.district}</td><td><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{labels[a.status]}</span></td><td>{new Date(a.createdAt).toLocaleDateString('tr-TR')}</td><td><Link href={`/admin/basvurular/${a.id}`} className="text-sm font-bold text-primary">İncele</Link></td></tr>)}</tbody></table></div><Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/></>:<EmptyState title="Başvuru bulunamadı" text="Bu durumda incelenecek başvuru yok."/>}</AdminLayout>;
}
function AdminApplicationDetailPage() {
  const [match,params]=useRoute('/admin/basvurular/:id'); const id=params?.id||''; const q=useQuery({queryKey:['admin-application',id],queryFn:()=>adminApi.application(id),enabled:!!id}); const docs=useQuery({queryKey:['admin-application-docs',id],queryFn:()=>adminApi.applicationDocuments(id),enabled:!!id}); const qc=useQueryClient(); const [reason,setReason]=useState(''),[message,setMessage]=useState('');
  const approve=useMutation({mutationFn:()=>adminApi.approveApplication(id),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-application',id]});qc.invalidateQueries({queryKey:['admin-apps']});qc.invalidateQueries({queryKey:['admin-agents']});setMessage('Başvuru onaylandı.');}});
  const reject=useMutation({mutationFn:()=>adminApi.rejectApplication(id,reason),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-application',id]});qc.invalidateQueries({queryKey:['admin-apps']});setMessage('Başvuru reddedildi.');}});
  const dl=async(docId:string)=>{try{const blob=await adminApi.applicationDocument(id,docId);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='basvuru-belgesi';a.click();URL.revokeObjectURL(url);}catch(e){setMessage(showError(e));}};
  if(!match)return null;
  return <AdminLayout><Link href="/admin/basvurular" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> Başvurular</Link>{q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState message={showError(q.error)}/>:q.data&&<div className="grid gap-5 lg:grid-cols-[1fr_330px]"><div className="surface p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Başvuru ayrıntısı</p><h2 className="mt-1 font-display text-2xl font-extrabold">{q.data.companyName}</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{labels[q.data.status]}</span></div><div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2"><Info label="Yetkili" value={`${q.data.authorizedFirstName} ${q.data.authorizedLastName}`}/><Info label="Başvuran e-posta" value={q.data.user.email}/><Info label="Telefon" value={q.data.phone}/><Info label="Firma e-postası" value={q.data.email}/><Info label="Vergi numarası" value={q.data.taxNumber}/><Info label="Konum" value={`${q.data.city}, ${q.data.district}`}/><Info label="Adres" value={q.data.address}/><Info label="Başvuru tarihi" value={new Date(q.data.createdAt).toLocaleString('tr-TR')}/></div>{q.data.description&&<p className="mt-5 rounded-xl bg-muted p-4 text-sm leading-6">{q.data.description}</p>}<div className="mt-6"><h3 className="font-bold">Belgeler</h3>{docs.isLoading?<div className="skeleton mt-3 h-16"/>:docs.error?<p className="mt-2 text-sm text-destructive">{showError(docs.error)}</p>:docs.data?.length?<div className="mt-3 grid gap-2 sm:grid-cols-2">{docs.data.map(doc=><button key={doc.id} onClick={()=>void dl(doc.id)} className="rounded-xl border border-border p-4 text-left hover:border-primary"><b className="block text-sm">{doc.documentType==='TAX_CERTIFICATE'?'Vergi levhası':'Yetki belgesi'}</b><small className="mt-1 block text-muted-foreground">{doc.originalName} · {(doc.sizeBytes/1024).toFixed(1)} KB</small><small className="mt-2 block text-primary">Güvenli belgeyi indir</small></button>)}</div>:<p className="mt-2 text-sm text-muted-foreground">Başvuruya belge eklenmemiş.</p>}</div></div><aside className="surface h-fit p-5"><h3 className="font-display text-xl font-bold">İnceleme</h3><p className="mt-2 text-sm text-muted-foreground">Onay için vergi ve yetki belgelerinin ikisi de gerekli.</p><button onClick={()=>approve.mutate()} disabled={approve.isPending||q.data.status!=='PENDING'} className="mt-5 h-11 w-full rounded-xl bg-primary font-bold text-white disabled:opacity-50">{approve.isPending?'Onaylanıyor…':'Başvuruyu onayla'}</button><label className="mt-5 grid gap-2 text-sm font-semibold">Red nedeni<textarea className={`${inputClass} h-28 py-3`} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Başvurana iletilecek açıklama"/></label><button disabled={!reason.trim()||reject.isPending||q.data.status!=='PENDING'} onClick={()=>reject.mutate()} className="mt-3 h-11 w-full rounded-xl border border-destructive/40 font-bold text-destructive disabled:opacity-40">Başvuruyu reddet</button>{message&&<p className="mt-3 text-sm text-primary">{message}</p>}{(approve.error||reject.error)&&<p className="mt-3 text-sm text-destructive">{showError(approve.error||reject.error)}</p>}</aside></div>}</AdminLayout>;
}

function AdminAgentsPage() {
  const [active,setActive]=useState(''),[page,setPage]=useState(1); const data=useAdminAgents({page,limit:20,...(active?{isActive:active as 'true'|'false'}:{})});
  return <AdminLayout><SectionTitle eyebrow="Emlakçı yönetimi" title="Emlakçılar" description="Emlakçı profili ve bağlı kullanıcı hesabı farklı durumlara sahiptir."/><select className={`${inputClass} mb-4 max-w-xs`} value={active} onChange={e=>{setActive(e.target.value);setPage(1);}}><option value="">Tüm profil durumları</option><option value="true">Profil aktif</option><option value="false">Profil pasif</option></select>{data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<><div className="surface overflow-x-auto"><table className="data-table"><thead><tr><th>Firma</th><th>Konum</th><th>Hesap durumu</th><th>Profil durumu</th><th></th></tr></thead><tbody>{data.data.items.map(a=><tr key={a.id}><td><b>{a.companyName}</b><small>{a.user.email}</small></td><td>{a.city}, {a.district}</td><td><StatusPill active={a.user.isActive}/></td><td><StatusPill active={a.isActive}/></td><td><Link href={`/admin/emlakcilar/${a.id}`} className="text-sm font-bold text-primary">Detay</Link></td></tr>)}</tbody></table></div><Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/></>:<EmptyState title="Emlakçı kaydı bulunamadı" text="Sonuçlar filtreyle eşleşmiyor."/>}</AdminLayout>;
}
function AdminAgentDetailPage() {
  const [match,params]=useRoute('/admin/emlakcilar/:id'); const id=params?.id||''; const q=useQuery({queryKey:['admin-agent',id],queryFn:()=>adminApi.agent(id),enabled:!!id}); const qc=useQueryClient(); const [message,setMessage]=useState('');
  const mutation=useMutation({mutationFn:(active:boolean)=>adminApi.agentStatus(id,active),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-agent',id]});qc.invalidateQueries({queryKey:['admin-agents']});setMessage('Emlakçı profil durumu güncellendi.');}});
  if(!match)return null;
  return <AdminLayout><Link href="/admin/emlakcilar" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> Emlakçılar</Link>{q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState message={showError(q.error)}/>:q.data&&<div className="surface p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Emlakçı profili</p><h2 className="mt-1 font-display text-2xl font-extrabold">{q.data.companyName}</h2><p className="mt-1 text-sm text-muted-foreground">{q.data.city}, {q.data.district} · /emlakci/{q.data.slug}</p></div><button onClick={()=>mutation.mutate(!q.data?.isActive)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">{q.data.isActive?'Profili pasife al':'Profili aktifleştir'}</button></div><div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"><Info label="Hesap durumu" value={q.data.user.isActive?'Aktif':'Pasif'}/><Info label="Emlakçı profil durumu" value={q.data.isActive?'Aktif':'Pasif'}/><Info label="Kullanıcı" value={q.data.user.email}/><Info label="Telefon" value={q.data.phone}/><Info label="E-posta" value={q.data.email}/><Info label="Adres" value={q.data.address}/><Info label="Vergi numarası" value={q.data.taxNumber}/></div>{q.data.description&&<p className="mt-5 rounded-xl bg-muted p-4 text-sm">{q.data.description}</p>}{message&&<p className="mt-4 text-sm text-primary">{message}</p>}{mutation.error&&<p className="mt-3 text-sm text-destructive">{showError(mutation.error)}</p>}</div>}</AdminLayout>;
}
function AdminPropertiesPage() {
  const [status,setStatus]=useState(''),[deleted,setDeleted]=useState('false'),[page,setPage]=useState(1); const data=useAdminProperties({page,limit:20,...(status?{status:status as PropertyStatus}:{}),deleted:deleted as 'true'|'false'});
  return <AdminLayout><SectionTitle eyebrow="İçerik denetimi" title="İlanlar" description="İlan durumlarını ve emlakçı kayıtlarını gözden geçirin."/><div className="mb-4 flex flex-wrap gap-3"><select className={`${inputClass} max-w-xs`} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Tüm durumlar</option>{['ACTIVE','INACTIVE','SOLD','RENTED'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select><select className={`${inputClass} max-w-xs`} value={deleted} onChange={e=>{setDeleted(e.target.value);setPage(1);}}><option value="false">Silinmemiş ilanlar</option><option value="true">Silinmiş ilanlar</option></select></div>{data.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:data.error?<ErrorState retry={()=>data.refetch()} message={showError(data.error)}/>:data.data?.items.length?<><div className="surface overflow-x-auto"><table className="data-table"><thead><tr><th>İlan</th><th>Konum</th><th>Durum</th><th>Emlakçı</th><th>Tarih</th><th></th></tr></thead><tbody>{data.data.items.map(p=><tr key={p.id}><td><b>{p.title}</b><small>{money(p.price)} · {labels[p.listingType]}</small></td><td>{p.city}, {p.district}</td><td>{labels[p.status]}</td><td>{p.agent.companyName}<small>{p.agent.isActive?'Profil aktif':'Profil pasif'}</small></td><td>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</td><td><Link href={`/admin/ilanlar/${p.id}`} className="text-sm font-bold text-primary">Detay</Link></td></tr>)}</tbody></table></div><Pagination page={data.data.page} limit={data.data.limit} total={data.data.total} onChange={setPage}/></>:<EmptyState title="İlan bulunamadı" text="Seçilen filtrelerle eşleşen ilan bulunmuyor."/>}</AdminLayout>;
}
function AdminPropertyDetailPage() {
  const [match,params]=useRoute('/admin/ilanlar/:id'); const id=params?.id||''; const q=useQuery({queryKey:['admin-property',id],queryFn:()=>propertiesApi.adminDetail(id),enabled:!!id}); const qc=useQueryClient(); const [reason,setReason]=useState(''),[message,setMessage]=useState('');
  const deactivate=useMutation({mutationFn:()=>propertiesApi.moderate(id,reason),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-property',id]});qc.invalidateQueries({queryKey:['admin-properties']});setMessage('İlan pasife alındı.');}});
  const remove=useMutation({mutationFn:()=>propertiesApi.adminDelete(id,reason),onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-property',id]});qc.invalidateQueries({queryKey:['admin-properties']});setMessage('İlan silindi.');}});
  if(!match)return null;
  return <AdminLayout><Link href="/admin/ilanlar" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/> İlanlar</Link>{q.isLoading?<div className="surface p-8"><div className="skeleton h-48"/></div>:q.error?<ErrorState message={showError(q.error)}/>:q.data&&<div className="grid gap-5 lg:grid-cols-[1fr_330px]"><article className="surface p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">İlan ayrıntısı</p><h2 className="mt-2 font-display text-2xl font-extrabold">{q.data.title}</h2><p className="mt-2 text-2xl font-extrabold text-primary">{money(q.data.price)}</p><div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"><Info label="Durum" value={labels[q.data.status]}/><Info label="İlan türü" value={labels[q.data.listingType]}/><Info label="Emlak türü" value={labels[q.data.propertyType]}/><Info label="Konum" value={`${q.data.neighborhood}, ${q.data.district}, ${q.data.city}`}/><Info label="Emlakçı" value={q.data.agent.companyName}/><Info label="Hesap durumu" value={q.data.agent.user.isActive?'Aktif':'Pasif'}/><Info label="Profil durumu" value={q.data.agent.isActive?'Aktif':'Pasif'}/><Info label="Adres" value={q.data.address}/></div><p className="mt-5 whitespace-pre-line leading-6 text-muted-foreground">{q.data.description}</p><div className="mt-5 rounded-xl bg-muted p-4 text-xs text-muted-foreground">İlan görsellerinin kimlikleri bu detay yanıtında yer almadığı için yönetici görsel silme işlemi bu ekranda sunulmamaktadır.</div></article><aside className="surface h-fit p-5"><h3 className="font-display text-xl font-bold">Moderasyon</h3><label className="mt-4 grid gap-2 text-sm font-semibold">İşlem nedeni<textarea className={`${inputClass} h-28 py-3`} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Gerekli moderasyon açıklaması"/></label><button disabled={!reason.trim()||deactivate.isPending||q.data.status!=='ACTIVE'} onClick={()=>deactivate.mutate()} className="mt-4 h-11 w-full rounded-xl bg-primary font-bold text-white disabled:opacity-40">İlanı pasife al</button><button disabled={!reason.trim()||remove.isPending||q.data.deletedAt!==null} onClick={()=>{if(window.confirm('İlanı soft delete yapmak istediğinize emin misiniz?'))remove.mutate();}} className="mt-3 h-11 w-full rounded-xl border border-destructive/40 font-bold text-destructive disabled:opacity-40">İlanı sil</button>{message&&<p className="mt-3 text-sm text-primary">{message}</p>}{(deactivate.error||remove.error)&&<p className="mt-3 text-sm text-destructive">{showError(deactivate.error||remove.error)}</p>}</aside></div>}</AdminLayout>;
}
function AdminAuditPage() {
  const [page,setPage]=useState(1); const q=useAdminAudit({page,limit:20});
  return <AdminLayout><SectionTitle eyebrow="İzlenebilirlik" title="İşlem kayıtları" description="Yönetim eylemleri salt okunur biçimde listelenir."/>{q.isLoading?<div className="surface p-6"><div className="skeleton h-48"/></div>:q.error?<ErrorState retry={()=>q.refetch()} message={showError(q.error)}/>:q.data?.items.length?<><div className="surface overflow-x-auto"><table className="data-table"><thead><tr><th>Eylem</th><th>Varlık</th><th>Varlık kimliği</th><th>İşlemi yapan</th><th>Tarih</th></tr></thead><tbody>{q.data.items.map(log=><tr key={log.id}><td><b>{log.action}</b></td><td>{log.entityType}</td><td><code className="text-xs">{log.entityId}</code></td><td><code className="text-xs">{log.actorUserId}</code></td><td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td></tr>)}</tbody></table></div>{q.data.items.map(log=>log.metadata&&<details key={`meta-${log.id}`} className="surface mt-2 p-4"><summary className="cursor-pointer text-sm font-semibold">Ek bilgiler · {log.action}</summary><pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(log.metadata,null,2)}</pre></details>)}<Pagination page={q.data.page} limit={q.data.limit} total={q.data.total} onChange={setPage}/></>:<EmptyState title="İşlem kaydı yok" text="Kayıtlar oluştuğunda burada görünür."/>}</AdminLayout>;
}

function HowToListPage() {
  type AudienceKey = 'owner' | 'advisor' | 'office' | 'developer';
  const audiences = [
    {
      key: 'owner' as const, title: 'Bireysel ev sahibi', icon: Home,
      description: 'Kendi taşınmazını satmak veya kiraya vermek isteyen kullanıcılar.',
      status: 'Henüz kullanıma açık değil',
      intro: 'Taşınmaz bilgileri, fotoğraflar ve doğrulama adımları için planlama rehberi. Bireysel ilan yayınlama henüz kullanıma açık değildir.',
      infoTitle: 'Hazırlık için düşünülebilecek bilgiler',
      infoItems: ['Taşınmazın türü, satılık/kiralık tercihi ve açık konumu', 'Oda, alan ve temel özellikler; açıklama metni', 'Kendi taşınmazınız için kullanmaya yetkili olduğunuz fotoğraflar', 'Mülkiyet ve kimlik doğrulamasında istenebilecek belgeler; uygulamada henüz bir yükleme adımı yok'],
      availability: 'Mevcut backend sözleşmesinde bireysel kullanıcının ilan yayınlaması, fotoğraf yükleme veya kimlik/mülkiyet doğrulama akışı bulunmuyor.',
      nextTitle: 'Durum · Yakında',
      nextDescription: 'Bireysel ilan yayınlama özelliği henüz kullanıma açık değil. Şu anda yalnızca mevcut ilanları inceleyebilirsiniz.',
      actionHref: '/ilanlar', actionLabel: 'Mevcut ilanları incele',
      journey: [
        { title: 'Hesap oluştur', description: 'Kullanıcı hesabı tek başına bireysel ilan yayınlama yetkisi vermez.', status: 'Hazırlık' },
        { title: 'Taşınmaz bilgilerini hazırla', description: 'Bu sayfadaki maddeler hazırlık önerisidir; ev sahibi ilan formu bulunmuyor.', status: 'Hazırlık' },
        { title: 'Fotoğraf ve belgeleri doğrula', description: 'Bireysel kullanıcı için yükleme veya doğrulama adımı henüz kullanıma açık değil.', status: 'Mevcut değil' },
        { title: 'İlanı yayın sürecine gönder', description: 'Bireysel ilan gönderim rotası ve API’si henüz kullanıma açık değil.', status: 'Mevcut değil' },
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
        { title: 'İlan ve profili yönet', description: 'AGENT rolü verilen hesap ilan oluşturabilir, düzenleyebilir ve profilini güncelleyebilir.', status: 'Hazırlık' },
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
  const selectedAction = selected ? { href: selected.actionHref, label: selected.actionLabel, title: selected.nextTitle, description: selected.nextDescription } : null;
  const faqs = [
    ['Kimler YUVA’da ilan verebilir?', 'Mevcut uygulamada ilan oluşturma, emlakçı başvurusu onaylanmış ve AGENT rolü verilmiş hesaplarla sınırlıdır. Bireysel ev sahipleri için doğrudan ilan verme akışı henüz bulunmuyor. Emlak ofisleri şirket bilgileriyle profesyonel başvuru yapabilir; ekip ve toplu ilan yönetimi mevcut değil.'],
    ['İlan vermek için hangi bilgiler gerekir?', 'İlan formunda başlık, satılık/kiralık türü, emlak tipi, fiyat, brüt alan, oda ve salon sayısı, açıklama, şehir, ilçe, mahalle, açık adres ve harita koordinatları istenir. Bazı ek özellikler isteğe bağlıdır.'],
    ['Fotoğraf eklemek zorunlu mu?', 'Arayüzde ilanı kaydetmek için zorunlu bir minimum fotoğraf adedi belirtilmiyor. İlan ilk kez kaydedildikten sonra JPEG, PNG veya WebP biçiminde, dosya başına en fazla 10 MB ve toplamda en çok 20 fotoğraf yüklenebilir. Sunucu tarafındaki ek kurallar API tarafından belirlenebilir.'],
    ['İlanım ne zaman yayınlanır?', 'Emlakçı başvurusu yönetici incelemesinden geçer; uygulama belirli bir inceleme veya yayın süresi vaat etmiyor. İlanın durumu ve yayınlanması gerçek API yanıtına bağlıdır.'],
    ['İlanımı daha sonra düzenleyebilir veya kaldırabilir miyim?', 'Evet. Onaylı emlakçı hesabının ilan panelinde ilanı düzenleme, durumunu güncelleme ve kaldırma işlemleri bulunur. İşlemler API’ye gönderilir; bu sayfa onlar için sahte başarı üretmez.'],
    ['Bireysel kullanıcı ile emlak danışmanı arasındaki fark nedir?', 'Bireysel kullanıcı hesabı kayıt ve platform özelliklerine erişim sağlar; mevcut uygulamada bu hesapla ilan oluşturulamaz. Emlak danışmanı ise ayrı bir başvuru ve yönetici onayı sonrasında ilan yönetim paneline erişir.'],
  ];

  return <PublicLayout>
    <section className="bg-[#f1efe7]">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-12 md:py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:px-10 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#cbd8ce] bg-white/65 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#38645a]"><ShieldCheck size={14}/> YUVA’da ilan verme rehberi</p>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-extrabold leading-[1.08] tracking-[-.04em] text-[#223d38] sm:text-5xl lg:text-[3.5rem]">Gayrimenkulünüzü YUVA&apos;da yayınlayın.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5d6b64] md:text-lg">İster kendi evinizi satmak veya kiraya vermek, ister müşterilerinizin gayrimenkullerini yönetmek isteyin; size uygun ilan verme yolunu keşfedin.</p>
          <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#d8d9ce] bg-white/55 p-4 text-sm leading-6 text-[#4f6259]"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-primary"/>Şu anda ilan oluşturma, başvurusu onaylanan emlakçı hesaplarında kullanılabilir. Bireysel ilan ve ofis ekip yönetimi akışları henüz mevcut değildir.</p>
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

function NotFoundPage() { return <PublicLayout><div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center"><span className="font-display text-7xl font-extrabold text-primary">404</span><h1 className="mt-4 font-display text-3xl font-bold">Bu sayfayı bulamadık</h1><p className="mt-2 text-muted-foreground">Adres değişmiş olabilir. İlanlara dönüp aramanıza devam edebilirsiniz.</p><Link href="/ilanlar" className="mt-6 rounded-xl bg-primary px-5 py-3 font-bold text-white">İlanları keşfet</Link></div></PublicLayout>; }
function Routed() { const [location]=useLocation(); const search=useSearch(); return <ErrorBoundary resetKey={`${location}${search}`}><Switch>
  <Route path="/" component={HomePage}/><Route path="/ilanlar">{()=> <ListingPage key={`${location}${search}`}/>}</Route><Route path="/ilan/:id" component={PropertyDetailPage}/><Route path="/emlakci/:slug" component={AgentPage}/><Route path="/nasil-ilan-verilir" component={HowToListPage}/>
  <Route path="/giris">{()=> <AuthPage mode="login"/>}</Route><Route path="/kayit">{()=> <AuthPage mode="register"/>}</Route><Route path="/profil">{()=> <RequireAuth><ProfilePage/></RequireAuth>}</Route><Route path="/favoriler">{()=> <RequireAuth><FavoritesPage/></RequireAuth>}</Route><Route path="/emlakci-basvuru">{()=> <RequireRole roles={['USER']}><ApplicationPage/></RequireRole>}</Route>
  <Route path="/panel">{()=> <RequireRole roles={['AGENT']}><AgentHome/></RequireRole>}</Route><Route path="/panel/ilanlar">{()=> <RequireRole roles={['AGENT']}><AgentPropertiesPage/></RequireRole>}</Route><Route path="/panel/ilanlar/yeni">{()=> <RequireRole roles={['AGENT']}><PropertyEditor/></RequireRole>}</Route><Route path="/panel/ilanlar/:id/duzenle">{()=> <RequireRole roles={['AGENT']}><PropertyEditor edit/></RequireRole>}</Route><Route path="/panel/emlakci-profili">{()=> <RequireRole roles={['AGENT']}><AgentProfilePage/></RequireRole>}</Route>
  <Route path="/admin">{()=> <RequireRole roles={['ADMIN']}><AdminHome/></RequireRole>}</Route><Route path="/admin/kullanicilar">{()=> <RequireRole roles={['ADMIN']}><AdminUsersPage/></RequireRole>}</Route><Route path="/admin/kullanicilar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminUserDetailPage/></RequireRole>}</Route><Route path="/admin/basvurular">{()=> <RequireRole roles={['ADMIN']}><AdminApplicationsPage/></RequireRole>}</Route><Route path="/admin/basvurular/:id">{()=> <RequireRole roles={['ADMIN']}><AdminApplicationDetailPage/></RequireRole>}</Route><Route path="/admin/emlakcilar">{()=> <RequireRole roles={['ADMIN']}><AdminAgentsPage/></RequireRole>}</Route><Route path="/admin/emlakcilar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminAgentDetailPage/></RequireRole>}</Route><Route path="/admin/ilanlar">{()=> <RequireRole roles={['ADMIN']}><AdminPropertiesPage/></RequireRole>}</Route><Route path="/admin/ilanlar/:id">{()=> <RequireRole roles={['ADMIN']}><AdminPropertyDetailPage/></RequireRole>}</Route><Route path="/admin/audit-logs">{()=> <RequireRole roles={['ADMIN']}><AdminAuditPage/></RequireRole>}</Route>
  <Route component={NotFoundPage}/>
</Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}>{import.meta.env.DEV&&DATA_MODE==='mock'&&<div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">Demo veri modu açık · Giriş, favori kaydı, başvuru, ilan yönetimi ve admin işlemleri gerçek API gerektirir.</div>}<AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Routed/></WouterRouter><Toaster/></TooltipProvider></AuthProvider></QueryClientProvider>; }
export default App;
