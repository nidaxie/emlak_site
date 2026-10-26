# YUVA backend entegrasyon devir notu

Bu not, frontend'i devralacak backend geliştiricisi için mevcut akışı, beklenen API sözleşmesini ve entegrasyon sırasını özetler. Frontend servisleri ve tipleri mevcut sözleşme olarak korunmuştur; endpoint veya alan değişiklikleri frontend ile birlikte kararlaştırılmalıdır.

## Projeyi yerelde çalıştırma

Monorepo kökünde:

```bash
pnpm install
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/real-estate-marketplace dev
```

Frontend `http://localhost:3000` üzerinde, API istemcisi varsayılan olarak `http://localhost:3001/api/v1` adresinde çalışır. API adresi `VITE_API_BASE_URL` ile değiştirilebilir. Örnek frontend değişkenleri `artifacts/real-estate-marketplace/.env.example` içindedir. Gerçek API okuma akışını denemek için `VITE_DATA_MODE=api` kullanın.

## Mevcut sınır

- Frontend React + TypeScript + Vite'tır; yönlendirme Wouter, veri istekleri React Query ve mevcut API istemcisi üzerinden yapılır.
- `src/services/api.ts` ve `src/types/api.ts` endpoint'leri ve JSON tiplerini tanımlar.
- Şu an Express API sunucusunda yalnızca `GET /api/healthz` vardır. İş endpoint'leri `/api/v1` altında henüz uygulanmış değildir.
- API istemcisi varsayılan `/api/v1` bekler. Var olan health yolu ve API prefix'i uyumlu hâle getirilmeli.
- Drizzle şema alanı şu an boş; API sunucusu mevcut durumda DB paketini kullanmıyor. Kaynak koddaki mevcut altyapı Express/Drizzle; NestJS/Prisma/PostGIS uygulanmış değil.

## Mock ve gerçek API ayrımı

`src/lib/data-mode.ts` tek modu seçer: `VITE_DATA_MODE=mock` veya `api`. Geliştirme varsayılanı `mock`, production varsayılanı `api`'dir. `src/services/public-marketplace-data.ts` yalnızca herkese açık okuma isteklerini mock veriye yönlendirir:

- İlan listeleme/detay ve filtreleme
- Herkese açık emlakçı profili ve ilanları
- Şehir, ilçe ve mahalle seçenekleri

Örnek katalog `src/mocks/marketplace-data.ts` içinde 24 ilan, 4 emlakçı ve örnek lokasyonlar içerir. Mock verisi salt okunurdur. Auth, favoriler, kullanıcı/emlakçı profili mutasyonları, başvuru ve belge yükleme, ilan yazma ve admin işlemleri gerçek API servisini çağırır; frontend bunlar için sahte başarı üretmez. İlan yönetimi formundaki lokasyonlar da backend'den gelmelidir.

## Öncelikli entegrasyon sırası

1. **Çalışma zamanı ve güvenlik:** `/api/v1` prefix'i, ortam değişkenleri, health kontrolü, frontend origin'i için CORS ve refresh cookie isteklerinde `credentials: include` / doğru `Origin` davranışı.
2. **Auth ve profil:** kayıt, giriş, refresh, çıkış, `GET/PATCH /users/me`. Login/refresh yanıtı `accessToken` ve `user` içerir; refresh token HttpOnly cookie olmalıdır. API istemcisi korumalı 401 yanıtında refresh dener.
3. **Lokasyon ve herkese açık keşif:** şehir/ilçe/mahalle; filtreli-sıralı-sayfalı ilan listesi; ilan detayı ve resimleri; herkese açık emlakçı profili ve emlakçı ilanları.
4. **Favoriler:** liste, ekle, sil; kimlik doğrulamalı kullanıcıya bağlı olmalı.
5. **Emlakçı başvuruları:** başvuru CRUD akışı, vergi/yetki belgeleri, admin incelemesi/onayı/reddi. Onay, kullanıcı rolü ve emlakçı profilini tutarlı şekilde güncellemeli.
6. **Emlakçı çalışma alanı:** profil/logo, kendi ilanları, create/update/status/delete, fotoğraf yükleme ve sıralama/kapak işlemleri.
7. **Admin ve iz kayıtları:** kullanıcı, emlakçı ve ilan yönetimi; başvuru ve belge incelemesi; denetim kayıtları.
8. Her grup hazır olduğunda `VITE_DATA_MODE=api` ile frontend akışını uçtan uca doğrulayın. Mock modunu kaldırmayın; yerel görsel test için kalabilir.

## Endpoint kapsamı

Frontend'in kullandığı bütün method/path, auth rolü ve request/response tipleri `src/services/api.ts` içindedir. Kaynak referanslar:

- `attached_assets/api-endpoints_1792747090493.md`: endpoint kataloğu ve auth beklentileri.
- `docs/BACKEND_TODO.md`: henüz uygulanmayan uçların kontrol listesi.
- `artifacts/real-estate-marketplace/src/types/api.ts`: frontend'in beklediği DTO, enum ve sayfalama tipleri.
- `lib/api-spec/openapi.yaml`: workspace OpenAPI kaynağı varsa şemaları karşılaştırmak için.

Endpoint grupları: `/auth/*`, `/users/me`, `/locations/*`, `/properties*`, `/agents*`, `/favorites*`, `/agent-applications*`, `/files/:id`, `/admin/users*`, `/admin/agent-applications*`, `/admin/agents*`, `/admin/properties*`, `/admin/audit-logs`.

### İstek/yanıt ayrıntıları

- Tarihler ISO string, fiyat/alan/koordinat değerleri sözleşmede string decimal'dır.
- Public liste yanıtı `{ items, page, limit, total }` biçimindedir. Filtreler: `listingType`, `propertyType`, `city`, `district`, `neighborhood`, `minPrice`, `maxPrice`, `rooms`, `livingRooms`, `minArea`, `maxArea`, `sort`; sıralama enum'u `newest | price_asc | price_desc`.
- İlan oluşturma konum ID'leri (`cityId`, `districtId`, `neighborhoodId`) ve açık adres/koordinat ister. İlan türü `SALE | RENT`; emlak türü `APARTMENT | HOUSE | VILLA | LAND | WORKPLACE`.
- Dosya isteklerinde JSON değil `multipart/form-data` kullanılır. İlan fotoğrafı alanı `file`; başvuru belgesi alanları `file` ve `documentType`; image sıralama gövdesi `{ imageIds: string[] }`.
- Özel belgeler yetki kontrolüyle indirilmelidir; herkese açık fotoğraf/logo URL'leri `/files/:id` ile servis edilebilir.
- Hatalar `ApiError` tipine (`statusCode`, `message`, `error`, `timestamp`, `path`) uymalı; uygun HTTP status kodu dönmelidir.

## Veri ve ürün kararları

- Public ilan sorguları yalnızca yayına açık kayıtları göstermeli; pasif emlakçı/hesap, silinmiş veya yayından kaldırılmış ilanlar filtrelenmeli.
- Sayfalama ve filtreleme sunucuda uygulanmalı. Oda filtresi sözleşmede tam eşleşme olarak tanımlıdır.
- Para birimi `TRY`; frontend ondalık fiyat ve alan değerlerini string olarak taşır.
- Kimlik, mülkiyet ve mesleki yetki doğrulamaları mevzuat ve ürün kararıyla netleştirilmeli; frontend bunları hukuki uygunluk olarak garanti etmez.
- Bireysel ev sahibi ilan akışı, ofis ekip/toplu ilan yönetimi ve müteahhit proje/bağımsız bölüm akışı mevcut sözleşmede yoktur. Bunlar yeni veri modeli ve API kararı gerektirir.

## Bilinen backend işleri

Tablo ve migration'lar, DB bağlantısı, seed yaklaşımı, dosya depolama/limit/erişim politikaları, refresh-token oturum güvenliği, rol bazlı erişim, CORS ve API prefix/health uyumu backend tarafında tamamlanmalıdır. Endpoint bazındaki tam kontrol listesi `docs/BACKEND_TODO.md` dosyasındadır.
