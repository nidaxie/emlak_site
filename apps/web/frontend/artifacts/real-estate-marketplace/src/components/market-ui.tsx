import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Heart, Home, MapPin, BedDouble, Ruler, Search, SlidersHorizontal, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { fileUrl } from '@/lib/api-client';
import type { PropertyCard } from '@/types/api';
import { useAuth } from '@/hooks/auth-context';
import { useToggleFavorite } from '@/hooks/use-api';

export const money = (value: string) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
export const area = (value: string | null | undefined) => value == null ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value));
export const labels: Record<string, string> = { SALE: 'Satılık', RENT: 'Kiralık', APARTMENT: 'Daire', HOUSE: 'Ev', VILLA: 'Villa', LAND: 'Arsa', WORKPLACE: 'İşyeri', ACTIVE: 'Yayında', INACTIVE: 'Pasif', SOLD: 'Satıldı', RENTED: 'Kiralandı', PENDING: 'İncelemede', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', COMBI: 'Kombi', CENTRAL: 'Merkezi', FLOOR_HEATING: 'Yerden ısıtma', STOVE: 'Soba', NONE: 'Yok', OTHER: 'Diğer', USER: 'Kullanıcı', AGENT: 'Emlakçı', ADMIN: 'Yönetici' };
export function PropertyCardView({ property, onFavorite, favoriteBusy }: { property: PropertyCard; onFavorite?: (id: string, favorite: boolean) => void; favoriteBusy?: boolean }) {
  const image = fileUrl(property.coverImageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [image]);
  const { user } = useAuth();
  const [, go] = useLocation();
  const favoriteMutation = useToggleFavorite();
  const toggleFavorite = onFavorite || ((id: string, favorite: boolean) => user ? favoriteMutation.mutate({ id, favorite }) : go('/giris'));
  return <article className="property-card surface relative overflow-hidden group" data-testid={`card-property-${property.id}`}>
    <Link href={`/ilan/${property.id}`} className="block" data-testid={`link-property-${property.id}`}>
      <div className="relative aspect-[1.42] overflow-hidden bg-muted">
        {image && !imageFailed ? <img src={image} alt={property.title} onError={() => setImageFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" /> : <div className="property-image-fallback h-full w-full flex items-center justify-center text-emerald-900/35" role="img" aria-label="İlan görseli kullanılamıyor"><Home size={42} strokeWidth={1.2}/></div>}
        <span className="absolute left-4 top-4 rounded-full bg-[#f8f6ef]/95 px-3 py-1.5 text-xs font-semibold text-[#245c52]">{labels[property.listingType]}</span>
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3"><p className="text-[22px] font-extrabold tracking-tight text-[#245c52]">{money(property.price)}</p><span className="mt-1 text-xs text-muted-foreground">{labels[property.propertyType]}</span></div>
        <span className="block font-semibold leading-snug text-foreground hover:text-primary">{property.title}</span>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin size={14}/>{property.neighborhood}, {property.district}, {property.city}</p>
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><BedDouble size={14}/>{property.rooms}+{property.livingRooms}</span><span className="flex items-center gap-1"><Ruler size={14}/>{area(property.grossAreaM2)} m²</span><span className="ml-auto truncate">{property.agent.companyName}</span></div>
      </div>
    </Link>
    <button aria-label={property.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'} data-testid={`button-favorite-${property.id}`} disabled={favoriteBusy || favoriteMutation.isPending} onClick={() => toggleFavorite(property.id, property.isFavorite)} className={`absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/95 transition hover:scale-105 ${property.isFavorite ? 'text-rose-600' : 'text-slate-600'}`}><Heart size={18} fill={property.isFavorite ? 'currentColor' : 'none'}/></button>
  </article>;
}
export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) { return <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h2>{description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}</div>; }
export function EmptyState({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) { return <div className="surface mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Building2/></div><h3 className="font-display text-2xl font-bold">{title}</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">{text}</p>{href && <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{action}<ArrowRight size={16}/></Link>}</div>; }
export function ErrorState({ retry, message = 'İçerik şu anda yüklenemedi.' }: { retry?: () => void; message?: string }) { return <div className="surface flex flex-col items-center p-10 text-center"><p className="font-semibold">Bir sorun oluştu</p><p className="mt-2 text-sm text-muted-foreground">{message}</p>{retry && <button onClick={retry} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white">Yeniden dene</button>}</div>; }
export function SkeletonGrid() { return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(n=><div key={n} className="surface overflow-hidden"><div className="skeleton aspect-[1.42]"/><div className="space-y-3 p-5"><div className="skeleton h-5 w-1/2"/><div className="skeleton h-4 w-4/5"/><div className="skeleton h-3 w-2/3"/></div></div>)}</div>; }
export function Pagination({ page, limit, total, onChange }: { page: number; limit: number; total: number; onChange: (p: number) => void }) { const pages = Math.ceil(total / limit); return pages > 1 ? <nav aria-label="Sayfalar" className="mt-9 flex items-center justify-center gap-2"><button className="page-btn" disabled={page <= 1} onClick={() => onChange(page-1)} aria-label="Önceki sayfa"><ChevronLeft size={17}/></button><span className="px-3 text-sm text-muted-foreground">{page} / {pages}</span><button className="page-btn" disabled={page >= pages} onClick={() => onChange(page+1)} aria-label="Sonraki sayfa"><ChevronRight size={17}/></button></nav> : null; }
export const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
export function SearchButton({ children = 'İlanları keşfet' }: { children?: string }) { return <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-[#194d44]"><Search size={17}/>{children}<SlidersHorizontal size={15}/></button>; }
