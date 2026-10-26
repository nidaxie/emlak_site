# Production Readiness Guide (YUVA Platform)

Bu belge `apps/api` (NestJS 11 + Prisma 7 + PostgreSQL/PostGIS) ve `apps/web` (React + Vite + TypeScript SPA) uygulamalarının production ortamına çıkış mimarisini, ortam değişkenlerini, güvenlik önkoşullarını ve dağıtım sırasını tanımlar.

---

## 1. Architecture

```text
Internet (HTTPS / TLS 1.2+)
        │
Reverse Proxy / Load Balancer (Nginx / Caddy / Cloud LB)
  ├── https://<domain>/          → apps/web (Node static SPA server, :3000)
  └── https://<api-domain>/api/v1 → apps/api (NestJS API server, :3001)
                                          │
                                          ├── PostgreSQL 16 + PostGIS 3.5 (:5432)
                                          └── Persistent Storage Volume (/app/storage)
```

- **Frontend (`apps/web`):** Vite ile derlenen statik SPA paketini (`dist/`), `apps/web/server.mjs` üzerinden security header'lar (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`), immutable asset caching ve SPA history fallback (`index.html`) ile sunar.
- **Backend (`apps/api`):** NestJS `/api/v1` REST API. Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), `AllExceptionsFilter` (500 hatalarında iç detay gizleme), `LoggingInterceptor` (query/header/cookie sızdırmayan HTTP logları) ve `JwtAuthGuard` + `RolesGuard` içerir.
- **Database:** PostgreSQL 16 + PostGIS (`geography(Point, 4326)` spatial index, `audit_logs_immutable` append-only trigger, partial unique indexler).

---

## 2. Required Environment Variables

### Backend (`apps/api`)

- `NODE_ENV`: `production` (zorunlu)
- `PORT`: `3001` (varsayılan `3001`)
- `DATABASE_URL`: `postgresql://<user>:<password>@<host>:5432/<db>?schema=public&sslmode=require` (zorunlu, secret)
- `CORS_ORIGIN`: Virgülle ayrılmış izinli frontend origin listesi, örn. `https://yuva.example.com` (zorunlu; `*` kullanılamaz)
- `JWT_SECRET`: En az 32 karakter yüksek entropili rastgele secret (zorunlu, secret; `JWT_REFRESH_SECRET` ile aynı olamaz)
- `JWT_ACCESS_EXPIRES_IN`: Access token süresi, örn. `15m` (`JWT_REFRESH_EXPIRES_IN` süresinden kısa olmalıdır)
- `JWT_REFRESH_SECRET`: En az 32 karakter farklı rastgele secret (zorunlu, secret)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token süresi, örn. `7d`
- `COOKIE_SAMESITE`: `lax` | `strict` | `none` (Frontend ve API aynı üst alan adındaysa `lax`; tamamen farklı alan adlarındaysa `none`)
- `COOKIE_SECURE`: Production'da `true` (HTTPS zorunludur; `COOKIE_SAMESITE=none` ise `COOKIE_SECURE=true` olmadan uygulama başlamaz)
- `AUTH_RATE_LIMIT`: Pencere başına izin verilen `/auth` istek sayısı (varsayılan `10`)
- `AUTH_RATE_TTL_MS`: Rate-limit pencere süresi ms (varsayılan `60000`)
- `STORAGE_DRIVER`: `local`
- `STORAGE_LOCAL_ROOT`: Kalıcı disk/volume bağlama yolu, örn. `/app/storage`

### Frontend (`apps/web` — Build-time)

- `VITE_DATA_MODE`: `api` (Production'da kesinlikle `api` olmalıdır)
- `VITE_API_BASE_URL`: Tarayıcının erişebileceği tam API adresi, örn. `https://api.yuva.example.com/api/v1` veya aynı origin arkasında `/api/v1`

---

## 3. Build, Migration & Startup

### Clean Build

```bash
npm ci
npm run db:generate
npm run build:api
VITE_DATA_MODE=api VITE_API_BASE_URL=<production-api-url> npm run build:web
```

### Database Migration (Production)

Production veritabanında yalnızca `prisma migrate deploy` kullanılır (`migrate dev` veya `db push` kullanılmaz):

```bash
npm run db:deploy
```

Lokasyon ana verisi (import):

```bash
DATABASE_URL=<production-db-url> node apps/api/prisma/import-locations.mjs <locations.json>
```

### Startup Commands

- **API:** `node apps/api/dist/main.js`
- **Web:** `node apps/web/server.mjs`

---

## 4. Health Check

- **API Health Endpoint:** `GET /api/v1/health`
  - Hem PostgreSQL bağlantısını (`SELECT 1`) hem de PostGIS eklentisini (`pg_extension`) doğrular.
  - Sağlıklı yanıt: `200 OK` → `{"status":"ok","checks":{"database":"up","postgis":"up"}}`
  - Veritabanı veya PostGIS erişilemezse: `503 Service Unavailable`
- **Web Healthcheck:** `GET /` → `200 OK` (`text/html`)

---

## 5. Storage & Persistence

- `STORAGE_DRIVER=local` dosya sistemini kullanır (`STORAGE_LOCAL_ROOT` veya `/app/storage`).
- Docker / Kubernetes ortamında `/app/storage` dizinine **kalıcı bir volume (`storage_data`) bağlanması zorunludur**. Volume bağlanmazsa container yeniden başlatıldığında yüklenen logolar, ilan fotoğrafları ve başvuru belgeleri kaybolur.
- Dosya görünürlüğü:
  - `AGENT_LOGO` ve `PROPERTY_IMAGE` → `PUBLIC` (`GET /api/v1/files/:id` ile yalnızca ilgili profil/ilan aktif ve yayındayken sunulur).
  - `AGENT_TAX_DOCUMENT` ve `AGENT_AUTHORIZATION_DOCUMENT` → `PRIVATE` (`GET /api/v1/files/:id` her zaman `404` döner; yalnızca başvuru sahibi veya `ADMIN` indirebilir).
- Çoklu API instance (horizontal scaling) planlanıyorsa paylaşımlı dosya sistemi (NFS/EFS) veya `ObjectStorage` arayüzüne S3 uyumlu sürücü eklenmelidir.

---

## 6. Security Prerequisites

1. **HTTPS Zorunluluğu:** Production'da `COOKIE_SECURE=true` olduğu için TLS sonlandırması (HTTPS) zorunludur.
2. **CORS & Origin:** `POST /auth/login`, `POST /auth/refresh` ve `POST /auth/logout` uçları `Origin` başlığını `CORS_ORIGIN` listesiyle karşılaştırır; eşleşmeyen istekler `401` alır.
3. **Admin Bootstrap:** Public `/auth/register` yalnızca `USER` rolü oluşturur. İlk `ADMIN` hesabı normal kayıt sonrası veritabanında `UPDATE users SET role = 'ADMIN' WHERE email = '...'` komutuyla veya `PasswordService` (`argon2id`) ile üretilen hash ile güvenli şekilde atanır.
4. **Reverse Proxy Body Limit:** İlan fotoğrafı ve başvuru belgeleri `10 MB` sınırına sahiptir; Nginx/proxy üzerinde `client_max_body_size 12m;` (veya üzeri) tanımlanmalıdır.

---

## 7. Deployment Order & Rollback

### Deployment Sırası

1. Veritabanı ve `/app/storage` dosya dizininin tam yedeğini (backup) al.
2. Yeni API container imajını ve Web container imajını build et.
3. `npm run db:deploy` (`prisma migrate deploy`) komutunu çalıştır.
4. Yeni API servisini başlat ve `GET /api/v1/health` → `200` yanıtını doğrula.
5. Yeni Web servisini başlat.
6. Post-deploy smoke testlerini çalıştır.

### Rollback Gereksinimleri

- Prisma migration'ları ileri yönlüdür (otomatik down migration yoktur).
- Yıkıcı olmayan (additive) şema değişikliklerinde önceki API/Web imajına doğrudan geri dönülebilir.
- Yıkıcı şema değişikliklerinde deploy öncesi alınan PostgreSQL snapshot/dump yedeğinden geri dönüş yapılır.

---

## 8. Known Limitations (Mevcut Kapsam Sınırları)

- **SSR / Dinamik SEO:** `apps/web` bir Vite SPA uygulamasıdır; dinamik ilan/emlakçı sayfalarında sunucu taraflı HTML meta üretimi (SSR) bulunmaz.
- **Process-Local Rate Limit:** `@nestjs/throttler` bellek içi (in-memory) çalışır; çoklu API pod'unda limit pod başına uygulanır.
- **Ürün Kapsamı Dışı Özellikler:** Bireysel ev sahibi ilan yayınlama, ofis ekip yönetimi, toplu portföy aktarımı ve müteahhit proje/bağımsız bölüm yönetimi mevcut backend sözleşmesinde yer almaz (UI'da `"Henüz kullanıma açık değil"` olarak belirtilmiştir).
