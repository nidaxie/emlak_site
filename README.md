# Emlak Platformu

Gayrimenkul ilan platformunun web ve API temeli. Bu depo tek bir monorepo içinde Next.js arayüzünü, NestJS API'yi ve PostgreSQL/PostGIS veritabanını barındırır.

Kimlik doğrulama, kullanıcı profili, emlakçı başvuru/onay akışı ve ilan yönetimi bu depoda çalışır. Harita, deprem analizi ve mobil uygulama sonraki aşamalardadır.

## Gereksinimler

- Node.js 22.18 veya daha yeni (Node.js 24 önerilir)
- npm 11.6 veya daha yeni
- Docker
- Docker Compose

Paket yöneticisi npm workspaces'tir. Ayrı bir monorepo aracı kurulmaz.

## Teknoloji

- Next.js 16, TypeScript, App Router, Tailwind CSS
- NestJS 11, TypeScript
- Prisma ORM 7.10, PostgreSQL, PostGIS
- Docker ve Docker Compose
- npm workspaces

## Proje yapısı

```text
apps/web   Next.js arayüzü
apps/api   NestJS API, Prisma ve migration dosyaları
```

Frontend entegrasyon sözleşmesi:

- `docs/frontend-integration.md`
- `docs/api-endpoints.md`
- `docs/frontend-types.ts`

Production imajları `apps/api/Dockerfile` ve `apps/web/Dockerfile` içindedir; depo kökünden build edilir.

## Local Docker

Docker Desktop proje grubu `emlak-site`dir. Üç servis birlikte başlar: `postgres`, `api`, `web`.

```bash
cp .env.example .env
docker compose up -d --build
```

Tarayıcı adresi yalnızca `http://localhost:3000`dir. `/`, `/ilanlar`, `/giris` ve diğer Wouter yolları SPA olarak sunulur. `/api/v1/*` istekleri web container içinden `http://api:3001` adresine proxy edilir. API host portu yayınlanmaz.

```bash
docker compose stop
docker compose start
docker compose down
```

`stop` üç servisi durdurur ve `unless-stopped` politikası bunları kendiliğinden geri açmaz. `start` aynı grubu yeniden başlatır. `down` container'ları kaldırır; `postgres_data` ve `storage_data` volume'ları durur. Veritabanı ve yüklenen dosyalar `docker compose down -v` çalıştırılmadıkça silinmez.

API container açılışta `prisma migrate deploy` çalıştırır. `DATABASE_URL` container içinde `@postgres:5432` olur. Host üzerindeki `DATABASE_URL` ve `POSTGRES_PORT` yalnızca makineden veritabanına bağlanmak içindir. JWT secret'ları `.env` dosyasından gelir; imaja yazılmaz.

## Host üzerinde geliştirme

API ve web'i makinede çalıştırmak için PostgreSQL yine Compose içindeki `postgres` servisidir:

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run dev:api
npm run dev:web
```

Bu modda API `http://localhost:3001/api/v1`, web uygulaması `http://localhost:3000` adresindedir. Sağlık kontrolü `GET /api/v1/health` yolundadır. Tam stack ayaktayken web container 3000 portunu kullandığı için host `dev:web` aynı anda başlatılamaz.

`.env` commit edilmez. Yeni bir ortamda `.env.example` kopyalanır ve değerler orada değiştirilir.

Backend `DATABASE_URL` ve JWT secret'ları olmadan ayağa kalkmaz. `PORT`, `CORS_ORIGIN`, token ömürleri, cookie ve rate limit için örnek dosyada varsayılan vardır. Host üzerinde çalışan web uygulaması `VITE_API_BASE_URL` kullanır. Bu adres kodun içine yazılmaz. Compose web imajı `/api/v1` ile build edilir.

Makinede başka bir PostgreSQL 5432 portunu kullanıyorsa `.env` içinde `POSTGRES_PORT` ve `DATABASE_URL` portunu birlikte değiştir. Örnek değer `5432` olarak kalır.

## Database migration

Şema değişiklikleri yalnızca Prisma Migrate ile yapılır. Migration dosyaları `apps/api/prisma/migrations` altındadır ve depoya girer.

Geliştirme sırasında, şema değiştikten sonra:

```bash
npm run db:migrate
```

Bu komut `prisma migrate dev` çalıştırır. Yeni bir migration oluşturur ve yerel veritabanına uygular.

Production ve temiz bir veritabanına mevcut migration'ları uygulamak için:

```bash
npm run db:deploy
```

Bu komut `prisma migrate deploy` çalıştırır. Production ortamında `migrate dev` kullanılmaz. `prisma db push` şema yönetim yöntemi değildir.

İlk migration `users` tablosunu, `Role` enum'unu ve PostGIS eklentisini oluşturur. Profil alanları `add_user_profile_fields` migration'ındadır. Refresh oturumları `create_auth_sessions` migration'ındadır. Emlakçı başvurusu ve onaylı profil `create_agent_applications_and_profiles` migration'ındadır. Bu migration `ApplicationStatus` enum'unu, `agent_applications` ve `agent_profiles` tablolarını kurar. Aynı kullanıcının birden fazla `PENDING` başvurusu olmaması için `agent_applications_one_pending_per_user` partial unique index'i vardır. Prisma şeması bu predicate'i ifade edemez; index migration SQL'indedir ve sonraki diff'lerde düşürülmemelidir. `AgentProfile.userId` ve `AgentProfile.slug` unique'tir. İlanlar `create_properties` migration'ındadır. Dosya, lokasyon, spatial point ve audit kayıtları `add_storage_locations_and_audit` migration'ındadır. Docker imajı PostGIS binary'lerini sağlar; eklentiyi ayrıca bir init script açmaz.

Başlangıç verisi migration'a yazılmaz. `ADMIN` kullanıcısı public register ile oluşmaz ve repoda hazır bir admin seed yoktur. Operasyon ihtiyacında parola hash'i uygulama dışından, `PasswordService` ile aynı argon2id formatında üretilip veritabanına yazılır.

## API sözleşmesi

Tüm HTTP API `/api/v1` altındadır. İstek ve cevap gövdeleri JSON'dur.

OpenAPI/Swagger eklenmedi. Sözleşme bu dosyadadır. Tüm hatalar aynı gövdeyi kullanır.

Sağlık kontrolü:

```http
GET /api/v1/health
```

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "postgis": "up"
  }
}
```

Veritabanı veya PostGIS kapalıysa cevap `503` olur ve genel hata gövdesini kullanır.

Hata gövdesi:

```json
{
  "statusCode": 404,
  "message": "Cannot GET /api/v1/missing",
  "error": "Not Found",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/missing"
}
```

Doğrulama hatalarında `statusCode` `400`, `error` `Bad Request` olur. `message` alanları liste olarak döner. Kayıtlı e-posta `409` döner. Kimliği doğrulanmamış istek, geçersiz token ve pasif hesap `401` döner. Girişte yanlış e-posta, yanlış parola ve pasif hesap aynı mesajı kullanır: `Invalid email or password`. Rol uymuyorsa cevap `403` ve `Forbidden` olur. `500` cevaplarında istemciye stack trace veya iç hata metni yazılmaz.

`POST /api/v1/auth/login`, `POST /api/v1/auth/register` ve `POST /api/v1/auth/refresh` aynı IP için `AUTH_RATE_LIMIT` / `AUTH_RATE_TTL_MS` ile sınırlanır. Varsayılan dakikada 10 istektir. Limit aşılırsa cevap `429` olur ve aynı hata gövdesini kullanır. Depolama bellektedir; Redis yoktur.

## Kimlik doğrulama

Kayıt otomatik giriş yapmaz. İstemci kullanıcıyı oluşturur, ardından login çağırır.

```http
POST /api/v1/auth/register
```

```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "phone": "+905550000000"
}
```

`firstName`, `lastName` ve `phone` isteğe bağlıdır. E-posta trim edilip küçük harfe çevrilir. Parola en az 8, en fazla 128 karakterdir. Rol her zaman `USER` olur. İstekte `role` gönderilirse `400` döner. Cevap `201` ve public kullanıcıdır. `password` ve `passwordHash` dönmez. Cookie yazılmaz.

```http
POST /api/v1/auth/login
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Başarılı cevap `200`:

```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "firstName": null,
    "lastName": null,
    "phone": null,
    "role": "USER",
    "isActive": true,
    "createdAt": "..."
  },
  "accessToken": "..."
}
```

Refresh token gövdede dönmez. `refresh_token` çerezi `HttpOnly`, `Path=/api/v1/auth` olarak yazılır. `COOKIE_SAMESITE` varsayılanı `lax`, `COOKIE_SECURE` production dışında `false` olur. `SameSite=None` ancak `COOKIE_SECURE=true` ile geçerlidir.

Login, refresh ve logout isteklerinde `Origin` başlığı `CORS_ORIGIN` listesinde olmalıdır. Tarayıcı bunu kendisi gönderir. Bu kontrol, Lax çerezle birlikte form CSRF isteğini düşürür. Ayrı bir CSRF kütüphanesi yoktur.

```http
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

İkisi de gövde almaz. Çerez ve `Origin` gerekir. Refresh başarılıysa login ile aynı `{ user, accessToken }` gövdesini döner ve çerezi yeniler. Eski refresh token bir kez kullanıldıktan sonra geçersizdir. Logout ilgili oturumu `revokedAt` ile kapatır ve çerezi siler. Tüm cihazlardan çıkış yoktur.

Access token JWT'dir. Payload yalnız `sub` ve `role` taşır. Süre `JWT_ACCESS_EXPIRES_IN` (varsayılan `15m`). İmza `JWT_SECRET` ile atılır. Secret kaynak kodda yoktur.

Refresh token ayrı `JWT_REFRESH_SECRET` ile imzalanır. Süre `JWT_REFRESH_EXPIRES_IN` (varsayılan `7d`) ve access token'dan uzun olmalıdır. Payload `sub` ve oturum id'sidir. Veritabanında token'ın kendisi değil SHA-256 hash'i `auth_sessions.refreshTokenHash` alanında durur. Parola hash'i argon2id'dir; refresh token yüksek entropili olduğu için arama yapılabilen SHA-256 kullanılır.

Web servisleri `apps/web/src/services/auth.ts` ve `users.ts` içindedir. Access token çağıran tarafta tutulur ve `localStorage`'a yazılmaz. İstekler `credentials: 'include'` kullanır, böylece tarayıcı refresh çerezini saklar. JavaScript çerezi okuyamaz.

## Kullanıcı profili

```http
GET /api/v1/users/me
PATCH /api/v1/users/me
```

İkisi de `Authorization: Bearer <access-token>` ister. `GET` public kullanıcıyı döner. `PATCH` yalnız `firstName`, `lastName` ve `phone` kabul eder. `role`, `isActive`, `email`, `id` ve `passwordHash` bu aşamada değiştirilemez; istekte bulunursa `400` döner.

`JwtAuthGuard` her korumalı istekte kullanıcıyı veritabanından okur. Token geçerli olsa bile kullanıcı yoksa veya `isActive` false ise cevap `401` olur. Guard, rolü token'daki eski değere değil güncel kayda yazar. `RolesGuard` bundan sonra çalışır. Endpoint'te `@Roles(...)` yoksa kimlik doğrulama yeterlidir.

## Emlakçı başvurusu

Emlakçı rolü register ile alınamaz. Geçiş yalnız admin onayının transaction'ı içindedir. Generic bir rol endpoint'i yoktur.

```text
USER
  ↓
AgentApplication (PENDING)
  ↓
ADMIN incelemesi
  ├── APPROVED → user.role = AGENT ve AgentProfile oluşur
  └── REJECTED → kullanıcı USER kalır, AgentProfile oluşmaz
```

`AgentApplication` başvurunun o andaki firma bilgisini saklar. Başvuru e-postası hesap e-postasından ayrıdır; firma iletişim adresinin snapshot'ıdır. Onaydan sonra profil e-postası değişebilir, başvuru kaydı değişmez.

`AgentProfile` yalnız onayda oluşur. Reddedilen başvurunun profili yoktur. `userId` tektir.

Durumlar yalnız `PENDING`, `APPROVED` ve `REJECTED` değerleridir. Bir kullanıcının aynı anda en fazla bir `PENDING` başvurusu olabilir. `AGENT` ve `ADMIN` başvuru açamaz. Reddedilen kullanıcı yeni başvuru açabilir. Eski `REJECTED` kayıt `PENDING` yapılmaz.

```http
POST /api/v1/agent-applications
GET /api/v1/agent-applications/me
PATCH /api/v1/agent-applications/me
```

`POST` yalnız `USER` içindir. Başvurusu olmayan `GET` cevabı `404` ve `Agent application not found` olur. Birden fazla kayıt varsa en yeni başvuru döner. `PATCH` yalnız kendi `PENDING` kaydını değiştirir. `APPROVED` ve `REJECTED` kayıtlar `409` ve `Application is no longer pending` döner. İkinci bekleyen başvuru `409` ve `Pending application already exists` döner.

```http
GET /api/v1/admin/agent-applications?status=PENDING&page=1&limit=20
GET /api/v1/admin/agent-applications/:id
POST /api/v1/admin/agent-applications/:id/approve
POST /api/v1/admin/agent-applications/:id/reject
```

Bu dört yol yalnız `ADMIN` içindir. `USER` ve `AGENT` `403` alır. Liste `page` ve `limit` kullanır. `limit` en fazla 100'dür. `status` verilirse yalnız o durum gelir. Detay, başvuruyu ve kullanıcının public alanlarını döner. `passwordHash` ve oturum dönmez.

Onay ve ret yalnız `PENDING` kayıtta çalışır. Aksi halde cevap `409` ve `Application is no longer pending` olur. Onay transaction'ı başvuru satırını ve kullanıcı satırını kilitler, kullanıcı aktif ve hâlâ `USER` mı diye tekrar bakar, tek `AgentProfile` oluşturur, rolü `AGENT` yapar ve başvuruyu `APPROVED` yazar. Aynı slug iki onayda çakışırsa transaction geri alınır ve yeni sonek ile yeniden denenir. Pasif hesap onaylanmaz. Yarım onay kalmaz. İkinci onay ikinci profil üretmez.

Ret `reason` ister. Sebep, `reviewedById` ve `reviewedAt` yazılır. Kullanıcı `USER` kalır. Profil oluşmaz.

Onay, vergi levhası ve yetki belgesinin ikisi de yüklü değilse `409` ve `Required documents are missing` döner. İkisi de her başvuru için zorunludur. Belgeler başvuruya aittir; yeni başvuru eski dosyaları taşımaz. `APPROVED` ve `REJECTED` kayıtların belgeleri snapshot olarak kalır.

Onay ve ret logu yalnız `applicationId`, `userId` ve `adminId` içerir. Vergi numarası ve ret metni loglanmaz.

## Emlakçı profili

Slug onay anındaki firma adından üretilir. `X Emlak` değeri `x-emlak` olur. Çakışmada `x-emlak-2` gibi artan sonek kullanılır. `me` ayrılmıştır. Firma adı sonradan değişince slug değişmez; public URL sabit kalır.

```http
GET /api/v1/agents/:slug
GET /api/v1/agents/me
PATCH /api/v1/agents/me
```

Public cevap `slug`, `companyName`, `phone`, `email`, `city`, `district`, `description` ve `logoUrl` döner. Vergi numarası, adres, kullanıcı id'si ve auth alanları dönmez. `AgentProfile.isActive` false ise public cevap `404` olur. Bu alan hesabın `User.isActive` değerinden ayrıdır: biri platformda görünürlük, diğeri sisteme giriş hakkıdır.

`GET` ve `PATCH /agents/me` yalnız `AGENT` içindir. `USER` `403` alır. Güncellenebilen alanlar `companyName`, `phone`, `email`, `address` ve `description` değerleridir. `slug`, `userId`, `isActive`, `role` ve `id` istekte varsa `400` döner.

```http
GET /api/v1/admin/agents?page=1&limit=20
GET /api/v1/admin/agents/:id
PATCH /api/v1/admin/agents/:id/status
```

Admin emlakçı listesi `isActive`, `companyName`, `city` ve `district` filtrelerini kabul eder. `PATCH` gövdesi `{ "isActive": false }` şeklindedir ve yalnız profil görünürlüğünü değiştirir. Kullanıcı hesabı ayrı endpoint'ten kapanır. Profil pasifken kullanıcı, hesabı aktifse giriş yapabilir; public profil ve ilanlar görünmez.

Web tarafında sayfa yoktur. Typed istemciler `apps/web/src/services/agent-applications.ts` ve `agents.ts` içindedir.

## İlanlar

İlan modeli `Property`dir. Her ilan bir `AgentProfile`a aittir. `agentProfileId` istekten alınmaz; backend oturumdaki AGENT profilini kullanır. `USER` ve `ADMIN` ilan açamaz. Admin onayı yoktur. Yeni ilan `ACTIVE` olur.

Oda sayısı `rooms` ve `livingRooms` olarak tutulur. `3` ve `1` değeri arayüzde `3+1` olarak gösterilir. Böylece oda filtresi sayısal kalır.

Fiyat `DECIMAL(14,2)` ve cevapta iki haneli stringdir: `"4250000.50"`. Alan ve koordinatlar da string döner. Para birimi şimdilik yalnız `TRY`dir. Kayan nokta kullanılmaz.

Konum `cityId`, `districtId` ve `neighborhoodId` yabancı anahtarlarıdır. Cevapta isimler de döner. Serbest metin adres ile `latitude` / `longitude` durur. Koordinatlar `DECIMAL(9,6)`dir ve tek yazma kaynağıdır. Veritabanı trigger'ı bunları `geography(Point, 4326)` `location` kolonuna kopyalar. Kolonda GIST index vardır. Yarıçap ve harita sorgusu bu fazda yoktur. İlan slug'ı yoktur.

İlan fotoğrafı en fazla 20 tanedir. İlk fotoğraf kapak olur. Aynı anda iki kapak oluşmasın diye ilan satırı kilitlenir ve canlı kapak için partial unique index vardır. Silinen fotoğrafın dosyası diskten de silinir. İlan soft delete olunca fotoğraf dosyaları durur; public cevap onları göstermez.

Durumlar: `ACTIVE`, `INACTIVE`, `SOLD`, `RENTED`. Geçişler:

```text
ACTIVE → INACTIVE | SOLD | RENTED
INACTIVE → ACTIVE
SOLD → ACTIVE
RENTED → ACTIVE
```

Uymayan geçiş `409` ve `Invalid status transition` döner. `SOLD` ve `RENTED` public listede görünmez. Yeniden yayın için `ACTIVE` yapılır.

Silme soft delete'tir. `deletedAt` dolu ilan public listede ve emlakçının kendi listesinde görünmez. Hem emlakçı kendi ilanını hem admin herhangi bir ilanı silebilir. `AgentProfile` ve `User` silinmez. Fiziksel satır silinmez.

Public liste yalnız `ACTIVE`, silinmemiş, profili aktif ve hesabı aktif ilanları döner. Başka emlakçının yönetim isteği `404` döner; kayıt varlığı sızmaz.

```http
POST /api/v1/properties
GET /api/v1/properties/me?status=ACTIVE&page=1&limit=20
GET /api/v1/properties/me/:id
PATCH /api/v1/properties/:id
PATCH /api/v1/properties/:id/status
DELETE /api/v1/properties/:id
POST /api/v1/properties/:id/images
PATCH /api/v1/properties/:id/images/order
PATCH /api/v1/properties/:id/images/:imageId/cover
DELETE /api/v1/properties/:id/images/:imageId
GET /api/v1/properties
GET /api/v1/properties/:id
```

Public filtreler: `listingType`, `propertyType`, `city`, `district`, `neighborhood`, `minPrice`, `maxPrice`, `rooms`, `livingRooms`, `minArea`, `maxArea`, `page`, `limit`, `sort`. Sıralama yalnız `newest`, `price_asc` ve `price_desc` değerleridir. Ham kolon adı alınmaz.

Public liste `coverImageUrl` döner. Detay `images` dizisini `sortOrder` sırasında döner ve emlakçı özetini ekler: `slug`, `companyName`, `phone`, `logoUrl`. Parola ve oturum dönmez. Silinmiş veya private dosya görünmez.

```http
GET /api/v1/admin/properties?status=ACTIVE&deleted=true&page=1&limit=20
GET /api/v1/admin/properties/:id
PATCH /api/v1/admin/properties/:id/deactivate
DELETE /api/v1/admin/properties/:id
```

Admin tüm durumları görür. `deleted=true` yalnız soft delete kayıtları getirir. Pasife alma ve silme `reason` ister; en az 3 karakterdir. Sebep ilan satırında durmaz, audit kaydına yazılır. Pasife alma yalnız `ACTIVE → INACTIVE` yapar. `USER` ve `AGENT` bu yollarda `403` alır. Admin fotoğraf silme `DELETE /api/v1/admin/properties/:id/images/:imageId` yolundadır.

Pasif profilin veya pasif hesabın ilanı public listede görünmez. Pasif profil yeni ilan açamaz.

Typed istemciler `apps/web/src/services/properties.ts`, `admin-properties.ts` ve `property-images.ts` içindedir. İlan sayfası yoktur.

## Dosyalar

Dosya yazma `StorageService` üzerinden gider. Domain kodu `fs.writeFile` çağırmaz. Şu anki sürücü local filesystem'dir. Kök `STORAGE_LOCAL_ROOT` veya çalışma dizinindeki `storage/` klasörüdür. Production geçişi aynı arayüze bir S3-compatible sürücü bağlayarak yapılır. Bu fazda bucket, MinIO veya AWS hesabı yoktur.

Public dosyalar logo ve ilan fotoğrafıdır. `GET /api/v1/files/:id` yalnız görünür public kaydı stream eder. Private belge bu yoldan `404` döner. Disk yolu ve storage key cevapta yoktur.

```http
POST /api/v1/agents/me/logo
POST /api/v1/agent-applications/me/documents
GET /api/v1/agent-applications/me/documents
GET /api/v1/agent-applications/me/documents/:documentId
GET /api/v1/admin/agent-applications/:id/documents
GET /api/v1/admin/agent-applications/:id/documents/:documentId
```

Logo `jpeg`, `png` veya `webp` olabilir ve 5 MB'ı geçemez. Belge `pdf`, `jpeg` veya `png` olabilir ve 10 MB'ı geçemez. İlan fotoğrafı logo ile aynı görsel tiplerini kullanır ve 10 MB'ı geçemez. SVG ve çalıştırılabilir içerik reddedilir. Karar dosya imzasından verilir; uzantı yetmez. Saklanan ad UUID'dir. `PENDING` başvuruda belge değiştirilebilir. Onaylı veya reddedilmiş başvuruya yeni belge eklenmez. Başvuru sahibi kendi belgelerini, admin herhangi bir başvurunun belgelerini indirebilir. Başka kullanıcı `404` alır.

Dosya önce diske yazılır, sonra metadata transaction'ı çalışır. Transaction düşerse yeni dosya silinir. Eski logo veya belge değişiminde eski binary silinmesi best-effort'tur ve hata loglanır. Virüs taraması sonraki sertleştirme işidir.

## Lokasyon

`City`, `District` ve `Neighborhood` ilanın konum ana verisidir. Türkiye'nin tam mahalle seti repoda yoktur. Kaynak İçişleri Bakanlığı adres kodu veya TÜİK idari birim listesi olmalıdır. Import biçimi `apps/api/prisma/data/locations.fixture.json` dosyasındaki JSON'dur. Komut:

```bash
node apps/api/prisma/import-locations.mjs apps/api/prisma/data/locations.fixture.json
```

`DATABASE_URL` ortamda olmalıdır. Fixture örnek kayıttır, tam ülke verisi değildir.

```http
GET /api/v1/locations/cities
GET /api/v1/locations/cities/:cityId/districts
GET /api/v1/locations/districts/:districtId/neighborhoods
```

İlan oluşturma ve güncelleme ilçe ve mahallenin seçilen şehre ait olmasını ister. Uymayan hiyerarşi `400` ve `Invalid location` döner. Üç lokasyon alanı birlikte güncellenir.

## Yönetim ve audit

```http
GET /api/v1/admin/users?role=AGENT&isActive=true&email=a@b.com&page=1&limit=20
GET /api/v1/admin/users/:id
PATCH /api/v1/admin/users/:id/status
GET /api/v1/admin/audit-logs?entityType=PROPERTY&page=1&limit=20
```

Kullanıcı cevabında `passwordHash` ve oturum yoktur. Admin kendi hesabını bu endpoint ile pasife alamaz. Pasif hesap login, refresh ve korumalı istekte `401` alır. Audit satırları append-only'dir; veritabanı trigger'ı update ve delete'i reddeder. Okuma endpoint'i yalnız admin içindir. Kaydedilen aksiyonlar onay, ret, kullanıcı ve profil aktifliği, admin ilan pasife alma/silme, belge yükleme/değiştirme ve admin fotoğraf silmedir. Metadata parola, token veya dosya yolu taşımaz.

## Roller

`USER`, `AGENT` ve `ADMIN` Prisma `Role` enum'undadır.

- Public register yalnız `USER` üretir.
- İstemci `AGENT` veya `ADMIN` seçemez.
- Kullanıcı kendi rolünü değiştiremez. `USER` → `AGENT` geçişi yalnız başvuru onayında olur.
- `ADMIN` kayıt endpoint'iyle üretilemez.

`@Roles(...)` ve `RolesGuard` korumalı controller'larda `JwtAuthGuard`'dan sonra çalışır. Guard global değildir. Health açık kalır. Rol denemeleri production'a demo endpoint eklemeden e2e içindeki test controller'ında yapılır.

## Ortam değişkenleri

```text
JWT_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
COOKIE_SAMESITE
COOKIE_SECURE
AUTH_RATE_LIMIT
AUTH_RATE_TTL_MS
STORAGE_DRIVER
STORAGE_LOCAL_ROOT
```

`STORAGE_DRIVER` şimdilik yalnız `local` kabul eder.

İki JWT secret en az 32 karakter olmalı ve birbirinden farklı olmalıdır. Süreler `15m` veya `7d` biçimindedir.

## Komutlar

```bash
npm run lint
npm run format
npm run format:check
npm test
npm run test:e2e
npm run build
npm run build:api
npm run build:web
```

`npm test` veritabanına bağlanmadan health, hata sözleşmesi, logging, parola hash, JWT guard, rol guard, slug, ilan kuralı ve dosya imza testlerini çalıştırır. `npm run test:e2e` çalışan PostgreSQL'e bağlanır. Auth, emlakçı başvurusu, ilan, dosya, lokasyon ve audit senaryolarını da bu komut çalıştırır. Production veritabanına karşı çalıştırılmamalıdır.

Her istek sunucu loguna `method`, `path`, `statusCode` ve süre olarak düşer. Query string loglanmaz. `Authorization` header'ı, çerez, token, parola ve secret loglanmaz. `500` hatalarında mesaj ve stack yalnızca sunucu logundadır.

## Docker imajları

Yerel çalıştırma `docker compose up -d --build` ile yapılır. Ayrı `docker run` gerekmez.

```bash
docker build -f apps/api/Dockerfile -t emlak-api:local .
docker build -f apps/web/Dockerfile -t emlak-web:local --build-arg VITE_DATA_MODE=api --build-arg VITE_API_BASE_URL=/api/v1 .
```

npm registry fallback'i Docker dosyalarında durur. Local storage volume'u `storage_data`dir ve API container'ında `/app/storage` yoluna bağlanır. Compose proje adı `emlak-site` olduğu için volume adları `emlak-site_postgres_data` ve `emlak-site_storage_data` olur.

API imajının build argümanı yalnızca Prisma Client üretimi içindir ve runtime katmanına yazılmaz. Çalışan API container'ına `DATABASE_URL` ve JWT secret'ları dışarıdan verilir. Web imajında `VITE_API_BASE_URL` build sırasında istemci paketine gömülür. Compose bu değeri `/api/v1` yapar. `API_PROXY_TARGET` yalnız web container runtime'ındadır.

## Kapsam

Altyapı, kimlik doğrulama, emlakçı başvurusu, ilan yönetimi, dosya storage, ilan fotoğrafı, lokasyon ana verisi ve audit hazırdır.

Favori, harita arayüzü, AFAD, MTA, deprem analizi, AI, mobil uygulama, gerçek S3 kurulumu, virüs tarayıcı ve arayüz bu aşamada yoktur.

## Prisma sürümü

API, Prisma ORM 7 kullanır. Sürüm bilinçli olarak 7'de tutulur: şema `apps/api/prisma/schema.prisma` dosyasındadır ve migration komutları `prisma migrate dev` ile `prisma migrate deploy` komutlarıdır. Prisma 8 farklı bir contract iş akışı kullanır ve bu komutları sağlamaz.
