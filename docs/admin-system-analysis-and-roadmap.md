# FAZ 3.1 — Admin paneli mevcut durum ve teknik yol haritası

Tarih: 2026-11-25. Bu belge salt okunur analizdir. Uygulama kodu, endpoint, şema ve migration değiştirilmedi.

Kapsam kaynağı çalışan ağaçtır: `dev/entegrasyon`, HEAD `bf8a5b4aa5e51c9c7fe25b2b78137848cd52f053`. Commit edilmemiş emlakçı sistemi değişiklikleri yerinde bırakıldı.

## 1. Proje başlangıç durumu

### Git

- Branch: `dev/entegrasyon`. `origin/dev/entegrasyon` ile aynı commit.
- HEAD: `bf8a5b4` — `user arayüz son güncellemeler.`
- Staged değişiklik yok.
- Unstaged: Prisma şema, başvuru/emlakçı/ilan servisleri, public dosya URL yardımcıları, ilgili e2e testleri, `apps/web/src/App.tsx`, API client, frontend tipleri ve `docs/api-endpoints.md`, `docs/frontend-integration.md`, `docs/frontend-types.ts`.
- Untracked: `20261124160000_add_application_draft_and_submitted_at`, `20261124173000_one_open_agent_application`, `20261124180000_agent_application_default_draft`, `application-lifecycle.ts`, `application-status.spec.ts`, `active-agent.ts`, `docs/agent-system-final.md`.

Bu dosyalar geri alınmadı.

### Mimari

- Frontend: `apps/web`. React, Vite, TypeScript, Wouter, TanStack Query. Admin ekranları ayrı dosyalarda değil; `apps/web/src/App.tsx` içinde. Servisler `apps/web/src/services/admin-*.ts`. Tipler `apps/web/src/types/api.ts`. Query anahtarları `apps/web/src/hooks/use-api.ts`.
- Backend: `apps/api`. NestJS, Prisma, PostgreSQL/PostGIS. Global prefix `api`, URI version `1`. Gerçek yol `/api/v1/...` (`apps/api/src/app.setup.ts`).
- ValidationPipe: `whitelist`, `forbidNonWhitelisted`, `transform`.
- Hata gövdesi: `statusCode`, `message`, `error`, `timestamp`, `path`.

### FAZ 2.7.6

Bu analiz yazılırken kapanış kaydı görülmemişti ve metin `NOT COMPLETE` diyordu. Sonraki kapanış [Emlakçı panel kapanışı](52608ee2-76c4-4f38-a60f-34db7c79b439) içinde `FAZ 2.7.6 = COMPLETE`, `FAZ 2.7 = COMPLETE`, `FAZ 2 = COMPLETE`, `FAZ 3 = READY` kararını verdi. Güncel durum budur.

`docs/agent-system-final.md` bu kararı taşır. Native `beforeunload` ve gerçek klavye Tab o kapanışta koşulmadı ve PASS değildir. Bu iki madde otomasyon sınırı olarak durur.

## 2. Mevcut admin route envanteri

Bütün admin sayfaları `apps/web/src/App.tsx` içindedir. Route tanımı dosyanın sonundaki `<Route>` bloğundadır. Her biri `RequireRole roles={['ADMIN']}` ile sarılır. `AdminLayout` ayrıca `Guard roles={['ADMIN']}` kullanır.

Mock modda (`DATA_MODE === 'mock'`) admin sayfaları sahte kayıt üretmez; “Bu özellik gerçek API bağlantısı gerektirir” boş durumu gösterir.

| Route | Component | Amaç | API | Guard | Loading / empty / error | Responsive | İşlev |
|---|---|---|---|---|---|---|---|
| `/admin` | `AdminHome` | Özet sayaç ve kısayol | `GET /admin/users?limit=1`, `GET /admin/agent-applications?status=PENDING&limit=1`, `GET /admin/agents?limit=1`, `GET /admin/properties?deleted=false&limit=1` | ADMIN | Sayaç yoksa `—`. Ayrı empty/error satırı yok; query hatası `—` olarak kalır | Sayaç grid’i `sm`/`xl` kırılır. Aktif menü yok | Dört gerçek `total` |
| `/admin/kullanicilar` | `AdminUsersPage` | Kullanıcı listesi | `GET /admin/users` | ADMIN | skeleton, `ErrorState`, “Kullanıcı bulunamadı” | `overflow-x-auto` + `white-space: nowrap` | E-posta, rol, aktiflik, sayfalama |
| `/admin/kullanicilar/:id` | `AdminUserDetailPage` | Hesap detayı ve aktif/pasif | `GET /admin/users/:id`, `PATCH /admin/users/:id/status` | ADMIN | skeleton, `ErrorState` | Başlık ve buton `flex-wrap` | Kendi hesabını pasife alma butonu kapalı |
| `/admin/basvurular` | `AdminApplicationsPage` | Başvuru kuyruğu | `GET /admin/agent-applications` | ADMIN | skeleton, `ErrorState`, “Başvuru bulunamadı” | Tablo yatay kayar | Varsayılan filtre `PENDING` |
| `/admin/basvurular/:id` | `AdminApplicationDetailPage` | İnceleme, belge, onay/ret | `GET/POST .../admin/agent-applications/:id`, documents, approve, reject | ADMIN | skeleton, `ErrorState`, belge hatası metni | `lg` iki kolon | Yalnız `PENDING` iken aksiyon |
| `/admin/emlakcilar` | `AdminAgentsPage` | Profil listesi | `GET /admin/agents` | ADMIN | skeleton, `ErrorState`, boş metin | Filtre grid + kayan tablo | Firma, şehir, ilçe, profil aktifliği |
| `/admin/emlakcilar/:id` | `AdminAgentDetailPage` | Profil detayı ve askı | `GET /admin/agents/:id`, `PATCH /admin/agents/:id/status` | ADMIN | skeleton, `ErrorState` | Logo ve metin yan yana, `flex-wrap` | Gerekçe alanı yok |
| `/admin/ilanlar` | `AdminPropertiesPage` | İlan listesi | `GET /admin/properties` | ADMIN | skeleton, `ErrorState`, boş metin | Kayan tablo | Durum, ilan türü, şehir tam eşleşme, silinmiş/silinmemiş |
| `/admin/ilanlar/:id` | `AdminPropertyDetailPage` | İlan detayı, pasife alma, soft delete, fotoğraf silme | `GET /admin/properties/:id`, `PATCH .../deactivate`, `DELETE .../:id`, `DELETE .../images/:imageId` | ADMIN | skeleton, `ErrorState`, fotoğraf yok metni | `lg` iki kolon, galeri `grid-cols-2/4` | Gerekçe 3–500 karakter |
| `/admin/audit-logs` | `AdminAuditPage` | Salt okunur işlem kayıtları | `GET /admin/audit-logs` | ADMIN | skeleton, `ErrorState`, “İşlem kaydı yok” | Kayan tablo, metadata `<pre>` | Varlık türü ve tam UUID filtresi |

İstenen ekranların hepsi bu ağaçta vardır. Ayrı bir “işlem kayıtları” route’u `/admin/islem-kayitlari` değildir; mevcut adres `/admin/audit-logs`.

Admin menüsü `AdminLayout` içindedir ve her zaman içerik ızgarasının üstünde veya yanında durur. Aktif route sınıfı yoktur. 1024 px altı için drawer yoktur. Emlakçı panelindeki `PanelLayout` drawer’ı admin’de kullanılmaz.

## 3. Mevcut admin API envanteri

Yetki sınıf düzeyindedir: `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)`. Başka modüllerde ADMIN rolüne açık ek bir controller yoktur. `USER` ve `AGENT` controller’ları kendi rollerine kilitlidir. Public `GET /properties`, `GET /agents/:slug`, `GET /files/:id`, `GET /locations/*` guardsızdır.

Sayfalama sözleşmesi her listede `{ items, page, limit, total }`. `limit` en fazla 100. Sıralama istemciden gelmez; `createdAt desc, id desc`.

| Method | Endpoint | Controller | Service | DTO | Auth | Pagination | Filtreler | Audit | Test | Durum |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/users` | `AdminUsersController.list` | `AdminUsersService.list` | `ListUsersQueryDto` | ADMIN | var | `role`, `isActive`, `email` contains | yok | e2e kısmen (`auth.e2e-spec.ts` rol probu; kullanıcı listesi senaryosu ayrı dosyada yok) | Çalışıyor |
| GET | `/api/v1/admin/users/:id` | `detail` | `get` | UUID | ADMIN | — | — | yok | e2e’de ayrıntılı senaryo yok | Çalışıyor |
| PATCH | `/api/v1/admin/users/:id/status` | `setStatus` | `setStatus` | `UpdateUserStatusDto` `{ isActive }` | ADMIN | — | — | `USER_ACTIVATED` / `USER_DEACTIVATED` | `user-properties.e2e-spec.ts` pasif kullanıcının ilanını gizler | Çalışıyor, son admin sayacı yok |
| GET | `/api/v1/admin/agent-applications` | `AdminAgentApplicationsController.list` | `AgentApplicationsService.listForAdmin` | `ListAgentApplicationsQueryDto` | ADMIN | var | yalnız `status` | yok | `agent-applications.e2e-spec.ts` | Çalışıyor |
| GET | `/api/v1/admin/agent-applications/:id` | `detail` | `getForAdmin` | UUID | ADMIN | — | — | yok | aynı e2e | Çalışıyor |
| GET | `/api/v1/admin/agent-applications/:id/documents` | `documentsFor` | `AgentDocumentsService.listForAdmin` | UUID | ADMIN | yok, kısa liste | — | yok | aynı e2e | Çalışıyor |
| GET | `/api/v1/admin/agent-applications/:id/documents/:documentId` | `openDocument` | `openForAdmin` | iki UUID | ADMIN | — | — | yok | çapraz id ve silinmiş dosya e2e | Çalışıyor |
| POST | `/api/v1/admin/agent-applications/:id/approve` | `approve` | `approve` | body yok | ADMIN | — | — | `AGENT_APPLICATION_APPROVED` | onay, eşzamanlılık, belge, profil e2e | Çalışıyor, yeniden yazılmamalı |
| POST | `/api/v1/admin/agent-applications/:id/reject` | `reject` | `reject` | `RejectAgentApplicationDto` | ADMIN | — | — | `AGENT_APPLICATION_REJECTED` + `metadata.reason` | e2e | Çalışıyor |
| GET | `/api/v1/admin/agents` | `AdminAgentsController.list` | `AgentsService.listForAdmin` | `ListAgentsQueryDto` | ADMIN | var | `isActive`, `companyName`, `city`, `district` contains | yok | dolaylı | Çalışıyor |
| GET | `/api/v1/admin/agents/:id` | `detail` | `getForAdmin` | UUID | ADMIN | — | — | yok | dolaylı | Çalışıyor |
| PATCH | `/api/v1/admin/agents/:id/status` | `setStatus` | `setActive` | `UpdateAgentStatusDto` | ADMIN | — | — | `AGENT_PROFILE_ACTIVATED` / `DEACTIVATED`, metadata yok | `properties.e2e-spec.ts` askı | Çalışıyor, gerekçe yok |
| GET | `/api/v1/admin/properties` | `AdminPropertiesController.list` | `PropertiesService.listForAdmin` | `ListAdminPropertiesQueryDto` | ADMIN | var | `status`, `listingType`, `city` tam ad, `deleted` | yok | properties ve user-properties e2e | Çalışıyor |
| GET | `/api/v1/admin/properties/:id` | `detail` | `getForAdmin` | UUID | ADMIN | — | silinmiş kayıt da döner | yok | e2e | Çalışıyor |
| PATCH | `/api/v1/admin/properties/:id/deactivate` | `deactivate` | `deactivate` | `ModerationReasonDto` | ADMIN | — | yalnız `ACTIVE` ve silinmemiş | `PROPERTY_DEACTIVATED_BY_ADMIN` + reason | e2e | Çalışıyor; sahip kararı geri alabilir |
| DELETE | `/api/v1/admin/properties/:id` | `remove` | `removeForAdmin` | `ModerationReasonDto` | ADMIN | — | silinmemiş | `PROPERTY_DELETED_BY_ADMIN` + reason | e2e | Soft delete çalışıyor |
| DELETE | `/api/v1/admin/properties/:id/images/:imageId` | `removeImage` | `PropertyImagesService.removeForAdmin` | iki UUID | ADMIN | — | — | `PROPERTY_IMAGE_DELETED_BY_ADMIN` | readiness e2e içinde admin görsel | Çalışıyor, fiziksel dosyayı siler |
| GET | `/api/v1/admin/audit-logs` | `AdminAuditLogsController.list` | `AuditService.list` | `ListAuditLogsQueryDto` | ADMIN | var | `entityType`, `entityId` | kendisi yazılmaz | readiness e2e “audit history” | Çalışıyor |

Frontend’in kullandığı admin çağrıları yukarıdaki listenin tamamıdır (`apps/web/src/services/admin-users.ts`, `admin-agents.ts`, `admin-agent-applications.ts`, `admin-properties.ts`, `admin-audit.ts`). Kullanılmayan ayrı bir admin endpoint yoktur.

Olmayan ve bu fazda yazılmayanlar: kullanıcı arama-ad, kullanıcı ilan sayısı, emlakçı ilan sayısı, admin logo/ilan dosyası, moderasyon kısıtı, audit actor/action filtresi, dashboard summary.

## 4. Admin authentication ve authorization

`Role` enum: `USER`, `AGENT`, `ADMIN` (`apps/api/prisma/schema.prisma`).

`JwtAuthGuard` (`apps/api/src/modules/auth/jwt-auth.guard.ts`) Bearer token’ı doğrular, sonra kullanıcıyı veritabanından `id, role, isActive` ile okur. `request.user.role` token claim’i değil, güncel satırdır. `isActive === false` veya kullanıcı yoksa `401 Unauthorized`.

`RolesGuard` güncel rol required listede yoksa `403 Forbidden`.

Refresh (`AuthService.readActiveSession`) süresi dolmuş, revoke, hash uyuşmazlığı ve `user.isActive === false` durumlarında `401` döner. Yeni access token’daki rol refresh anındaki veritabanı rolüdür. Deaktive hesap refresh ile token alamaz.

Pasife alma `AuthSession` satırlarını silmez. Satırlar durur; hem access hem refresh `isActive` yüzünden kullanılamaz.

Frontend `Guard` (`App.tsx`):

- Yüklenirken skeleton.
- Oturum yoksa `/giris?returnTo=` adresine gider.
- Rol uymuyorsa public layout içinde “Bu sayfaya erişim yetkiniz bulunmuyor”. URL admin path’te kalır.
- Hard refresh `AuthProvider` içinde `refreshSession()` çağırır. Cookie geçerliyse kullanıcı ve rol belleğe yazılır.

2026-11-25 tarayıcı kontrolü: mevcut oturum admin değildi (menüde İlan Ver, İlanlarım, Favorilerim, Hesabım). `http://localhost:3000/admin` bu hesapla yetki boş ekranını gösterdi, adreste kaldı. Anonim yönlendirme bu oturumda ölçülmedi. Admin layout piksel matrisi ölçülmedi; oturum ADMIN olmadığı için panele girilmedi ve hesap değiştirilmedi.

| Rol | Admin frontend | Admin API |
|---|---|---|
| Anonymous | Kod: `/giris?returnTo=`. Bu oturumda ölçülmedi | 401. Guard ve `agent-applications.e2e-spec.ts` |
| USER | Bu oturumda doğrulandı: yetki boş ekranı, URL kalır | 403 |
| AGENT | Aynı boş ekran. Bu oturumda ayrıca ölçülmedi | 403 |
| Suspended AGENT (`User.isActive` true, `AgentProfile.isActive` false) | Rol hâlâ AGENT. Aynı boş ekran | 403. Askı, admin API’yi açmaz |
| Aktif ADMIN | Layout ve sayfalar | 200 / iş kuralı 409 |
| Inactive ADMIN | Refresh 401, oturum düşer, girişe gider | 401. Rol guard’a ulaşmaz |

Frontend guard backend yetkisinin yerine geçmez. API her istekte rolü ve aktifliği yeniden okur.

## 5. Veritabanı ve domain modeli

### User (`users`)

- PK `id` uuid. Unique `email`.
- `passwordHash`, `firstName`, `lastName`, `phone`, `role`, `isActive` default true, `createdAt`, `updatedAt`.
- İlişkiler: `AuthSession`, `AgentApplication` (başvuran ve inceleyen), `AgentProfile?`, `Favorite`, `ownedProperties`.
- Soft delete yok. Silme endpoint’i yok.

### AuthSession (`auth_sessions`)

- PK `id`. Unique `refreshTokenHash`. `userId` FK cascade. `expiresAt`, `revokedAt`, `createdAt`, `updatedAt`. Index `userId`.

### AgentApplication (`agent_applications`)

- PK `id`. FK `userId` cascade, `reviewedById` set null.
- Alanlar: firma, yetkili ad/soyad, `phone`, `email`, `taxNumber`, `city`, `district`, `address`, `description?`.
- `status` default `DRAFT`. `submittedAt?`, `rejectionReason?`, `reviewedAt?`, `createdAt`, `updatedAt`.
- Index: `(userId, createdAt)`, `(status, createdAt)`, `reviewedById`.
- Partial unique index SQL’de: kullanıcı başına en fazla bir açık `DRAFT` veya `PENDING`. Prisma şeması bu predicate’i ifade edemez. Migration `20261124173000_one_open_agent_application`.
- `AgentProfile` ile FK yoktur. Bağ, onayda kopyalanan `userId` üzerindedir.

### AgentProfile (`agent_profiles`)

- PK `id`. Unique `userId`, unique `slug`, unique `logoFileId`.
- `companyName`, `phone`, `email`, `taxNumber`, `city`, `district`, `address`, `description?`, `isActive` default true, `createdAt`, `updatedAt`.
- Index `(isActive, createdAt)`.
- `isActive` askıdır. Satır silinmez. User rolü bu alanla değişmez.

### Property (`properties`)

- PK `id`. `sellerType` `INDIVIDUAL` | `AGENT`.
- Check `properties_seller_ownership_check` (`20261104130000_property_seller_ownership`): bireyselde `ownerUserId` dolu ve `agentProfileId` boş; emlakçıda tersi.
- `ownerUserId` FK restrict. `agentProfileId` FK cascade.
- `status` default `ACTIVE`: `ACTIVE`, `INACTIVE`, `SOLD`, `RENTED`.
- `deletedAt` soft delete. Ayrı moderasyon kolonu yok.
- Lokasyon FK: `cityId`, `districtId`, `neighborhoodId`. `latitude`/`longitude` opsiyonel. `location` geography trigger ile dolar. GIST index.
- Diğer indexler: agent+createdAt, owner+deletedAt, seller+status+deletedAt, status+deletedAt+createdAt, status+price, status+city+district, status+listing+type, status+rooms.

### PropertyImage / StoredFile

- `PropertyImage`: unique `fileId`, `sortOrder`, `isCover`, `deletedAt`. Canlı kapak partial unique index SQL’dedir.
- `StoredFile`: unique `storageKey`, `visibility` PUBLIC/PRIVATE, `category`, `deletedAt`. Kategoriler: `AGENT_LOGO`, `AGENT_TAX_DOCUMENT`, `AGENT_AUTHORIZATION_DOCUMENT`, `PROPERTY_IMAGE`.
- Belge türleri: `TAX_CERTIFICATE`, `AUTHORIZATION_CERTIFICATE`. `(applicationId, documentType)` unique.

### Favorite, City, District, Neighborhood

- `Favorite`: unique `(userId, propertyId)`.
- `City.name` unique. `District` unique `(cityId, name)`. `Neighborhood` unique `(districtId, name)`.
- Lokasyon servisi ilan sayacı döndürmez.

### AuditLog (`audit_logs`)

- `id`, `actorUserId` (FK yok), `action`, `entityType`, `entityId`, `metadata` Json?, `createdAt`.
- Index: entity, actor, createdAt.
- Trigger `audit_logs_immutable` UPDATE ve DELETE’i reddeder (`20261021200000_add_storage_locations_and_audit`).
- IP ve request id yok.

Şema kullanıcı listesi, başvuru kararı, emlakçı askısı ve mevcut ilan soft delete için yeterlidir. Yeni kolon ancak kalıcı moderasyon kısıtı seçilirse gerekir. Bu fazda migration yok.

## 6. Kullanıcı yönetimi

### Hazır backend

`AdminUsersService` listesi `id`, `email`, `firstName`, `lastName`, `phone`, `role`, `isActive`, `createdAt` döner. `passwordHash` ve refresh alanları select’te yoktur.

Detay bunlara `updatedAt` ve varsa `agentProfile` (`id`, `slug`, `companyName`, `isActive`, `city`, `district`) ekler.

Arama backend’dedir: `email` case-insensitive `contains`. Filtre: `role`, `isActive=true|false`. Sayfa ve limit var. Sıra sabittir. Ad/soyad, kayıt tarihi aralığı ve serbest sıra yoktur. İlan sayısı ve başvuru listesi yoktur.

`setStatus` kendi hesabını pasife almayı `409` ile keser. Aynı durumdaysa no-op döner ve audit yazmaz. Değişiklikte transaction içinde audit yazar. Rol değiştirmez, satır silmez, ilan `status` veya `deletedAt` alanlarına dokunmaz, `AgentProfile.isActive` değiştirmez.

Pasif kullanıcı:

- Mevcut access token bir sonraki istekte 401 alır.
- Refresh 401 alır. Yeni access üretilemez.
- Session satırı explicit revoke edilmez; kullanılamaz.
- Bireysel ilanlar `publicPropertyWhere` içinde `ownerUser.isActive` şartı yüzünden public listeden, detaydan, favorilerden ve public dosyadan düşer. `status` aynı kalır.
- Rol `AGENT` ise public ilan ve public logo da `user.isActive` şartına takılır. Profil satırı ve profil `isActive` değeri durur. Başvuru durumu değişmez.
- Yeniden aktif edilince eski satırlar durur. Public görünürlük, status hâlâ `ACTIVE`, `deletedAt` boş ve emlakçı profili de aktifse geri gelir.

### Hazır frontend

Liste ve detay gerçek API kullanır. E-posta araması her tuşta backend sorgusudur, ilk sayfanın client filtresi değildir. Detayda hesap, rol, telefon, tarihler ve bağlı profil linki vardır. Onay `window.confirm`. Başarıda `admin-users`, `admin-agents`, `admin-audit-logs`, `properties`, `agent-properties` invalidate edilir.

Detayda bireysel ilanlar, başvuru geçmişi ve audit listesi yoktur.

### Güvenlik

- Kendi hesabını pasife alma engeli var. UI butonu da kilitler. API asıl kontroldür.
- Son aktif admin sayacı yok. Tek admin kendini kapatamaz. İki admin birbirini eşzamanlı kapatabilir; `FOR UPDATE` ve “kalan aktif admin” şartı yoktur. İkisi de pasif kalabilir.
- Rol atama endpoint’i yok. `USER → AGENT` yalnız başvuru onayındadır. Bu dönemde rol atama veya kalıcı silme eklenmemelidir.
- Eşzamanlı iki `setStatus` satır kilidi kullanmaz. Aynı hedefe iki farklı değer yarışırsa son yazma kalır. Audit iki kez yazılabilir.
- Durum değişikliği audit’i transaction içindedir. Audit yazılmazsa durum da commit olmaz.

### Test

Kullanıcı pasifliğinin public ilanı gizlediği senaryo `user-properties.e2e-spec.ts` içindedir. Son admin, eşzamanlı admin kapatma ve liste arama için ayrı test yoktur. Bu analizde e2e çalıştırılmadı.

### 3.2 sırası

Mevcut liste, detay ve status endpoint’i yeniden yazılmamalı. Eksik olanlar: ad araması, ilan/başvuru özeti, detay bölümleri, son admin kuralı (karar sonrası), gerekirse session revoke’u açıkça yazmak. Mevcut `isActive` kontrolü erişimi zaten keser.

## 7. Emlakçı başvuru yönetimi

Lifecycle kodu `application-lifecycle.ts`:

- `DRAFT → PENDING`
- `PENDING → APPROVED | REJECTED`
- `REJECTED → DRAFT` (revise, aynı satır)
- `APPROVED` çıkışsız

Ayrı bir `REVISE` veya `RESUBMIT` enum değeri yoktur. Revize, `REJECTED` satırını yeniden `DRAFT` yapar, `submittedAt` ve ret alanlarını temizler. Ayrı başvuru geçmişi tablosu yoktur.

Şema alanları `createdAt`, `updatedAt`, `submittedAt`, `reviewedAt`, `reviewedById`, `rejectionReason` gerçektir.

### Liste

Frontend varsayılanı `PENDING`. “Tüm başvurular” boş status gönderir; backend o zaman filtre uygulamaz ve `DRAFT` dahil her durumu döner. `DRAFT` seçeneği de vardır. Taslaklar varsayılan kuyrukta değildir. Destek için “tümü” yeterlidir; taslakları tamamen gizlemek zorunlu değildir.

Sayfalama var. Firma, e-posta veya yetkili araması yok. Belge sayısı yok. Başvuran e-postası, rolü, hesap aktifliği, şehir, durum ve `createdAt` vardır. `submittedAt` listede yoktur, detayda vardır.

### Detay

Firma, yetkili, telefon, firma e-postası, vergi no, şehir/ilçe, adres, açıklama, belgeler, durum, `createdAt`, varsa `submittedAt` ve `reviewedAt`, ret gerekçesi, onay ve ret aksiyonları vardır.

`reviewedById` response’tadır (`getForAdmin`). İnceleyen kullanıcının adı veya e-postası join edilmez ve ekranda gösterilmez. Bu bir gösterim eksikidir; onay transaction’ı eksik değildir.

Onay/ret yalnız `PENDING` iken açıktır. Diğer durumda metin bunu söyler.

### Belgeler

Türler yalnız `TAX_CERTIFICATE` ve `AUTHORIZATION_CERTIFICATE`.

- Admin okuması `openForAdmin`: `documentId` ve `applicationId` birlikte aranır. Çapraz kombinasyon 404.
- `file.deletedAt` doluysa 404.
- Liste silinmemiş dosyaları döner.
- Public `GET /api/v1/files/:id` yalnız `PUBLIC` ve logo veya ilan görseli kategorisini açar. Belge kategorisi 404.
- Admin stream `Cache-Control: private, no-store` ve `nosniff` kullanır. İndirme `contentDisposition('attachment')`.
- Sahip `GET /agent-applications/me/documents/:documentId` ile yalnız kendi belgesini açar.

### Onay ve ret — yeniden yazılmayacaklar

`approveOnce` / `reject` içinde:

- `FOR UPDATE` ile başvuru ve kullanıcı kilidi.
- Geçiş yalnız `PENDING`.
- Pasif kullanıcı ve `USER` olmayan rol `409`.
- İnceleyen satırı tekrar okunur: aktif `ADMIN` değilse `403`.
- Mevcut `AgentProfile` `409`.
- `assertRequiredDocuments` / `hasRequiredAgentDocuments`.
- `updateMany` `status = PENDING` şartı. `count !== 1` ise `409`.
- Profil `isActive: true` default ile oluşur, `User.role = AGENT`, başvuru `APPROVED`.
- Audit aynı transaction’da.
- Slug çakışmasında sınırlı retry. Unique ihlali ikinci profili `409` yapar.
- Ret gerekçesi DTO ile 3–500 karakter, trim.

E2e: `agent-applications.e2e-spec.ts` liste yetkisi, onay, ret, eşzamanlı karar, taslak/ret reddi, belge çapraz erişimi, tek profil.

### 3.3 kararı

Backend karar mekanizması hazırdır. Yeni approve/reject yazılmamalı. Kalan iş frontend ve ince liste alanlarıdır: arama, belge sayısı, inceleyen kimliği, listede `submittedAt`. Güvenlik açığı belge ve karar yolunda bu analizde görülmedi.

## 8. Emlakçı yönetimi

### Liste

Backend döner: `id`, `slug`, `companyName`, `city`, `district`, `isActive`, `createdAt`, `user.id/email/role/isActive`.

Arama backend: firma, şehir, ilçe `contains`, profil `isActive`. Sayfalama var. Sıra sabit.

Listede olmayanlar: logo, telefon, firma e-postası, vergi no, yetkili ad, ilan sayısı. Kullanıcı e-postası vardır.

### Detay

`selfAgentSelect` + `adminUserSelect` + `withLogo`. Firma, iletişim, adres, vergi no, açıklama, slug, tarihler, bağlı kullanıcı ve `logoUrl` vardır.

`logoUrl` `publicFileUrl` üretir: `/api/v1/files/:id`. Public dosya servisi logoyu yalnız profil ve kullanıcı aktifken verir. Askıdaki veya pasif hesaplı emlakçının logosu admin `<img>` etiketinde 404 olur. Bu, public kuralın gevşetilmesi değildir; admin’in public URL kullanmasıdır.

Onaylanan başvuru ile profil arasında FK yoktur. Onay, başvuru anlık görüntüsünü yeni `AgentProfile` satırına kopyalar ve aynı `userId` yazar. Başvuru `APPROVED` kalır. Detay ekranı başvuruya veya belgelere link vermez. İlan listesi, ilan dağılımı ve audit geçmişi bu ekranda yoktur. Public path metin olarak `/emlakci/{slug}` yazılır; askıdayken public profil 404 döner.

### Askı

`AgentsService.setActive` yalnız `AgentProfile.isActive` değiştirir.

Korunan kurallar:

- Profil satırı silinmez.
- `User.role` değişmez.
- Başvuru `APPROVED` kalır.
- İlan `status` ve `deletedAt` değişmez.
- Public profil, public ilan ve public logo `isActive` şartına takılır.
- Aktif emlakçı yazma kapısı `lockActiveAgent` (`apps/api/src/modules/agents/active-agent.ts`) pasif profilde yazmayı keser. Okuma ve sahip logosu `GET /api/v1/agents/me/files/:fileId` ile durur. Ayrıntı `docs/agent-system-final.md` içindedir; 2.7.6 kapanışı ayrıca doğrulanmamıştır.
- Yeniden açılış aynı satırı kullanır.

Gerekçe alanı yoktur. Audit’te önceki/yeni değer ve reason metadata’sı yoktur. Aktör `actorUserId`, hedef `AGENT_PROFILE` + profil id, eylem enum’u vardır. Satır kilidi yoktur.

### Admin logo önerisi

Public `GET /files/:id` gevşetilmemelidir.

Üç erişim ayrı kalmalıdır:

- Public: aktif profil ve aktif kullanıcı.
- Sahip: `GET /api/v1/agents/me/files/:fileId`.
- Admin: henüz yok. Öneri, başvuru belgesindeki gibi `GET /api/v1/admin/agents/:id/files/:fileId`. Sorgu logo dosyasının o profilin güncel `logoFileId` değeri olduğunu ve dosyanın silinmediğini doğrulamalı. `Cache-Control: private, no-store`. Admin detay bu path’i authenticated blob ile basmalı, public URL’yi değil.

### 3.4 sırası

Mevcut status endpoint’i korunmalı. Eksikler: gerekçe (karar), admin logo okuma, detayda ilan sayısı ve onaylı başvuruya `userId` ile gidiş, liste alanları. Yeni profil oluşturma veya silme yok.

## 9. İlan yönetimi

Ortak model `Property`. Bireysel: `sellerType=INDIVIDUAL`, `ownerUserId` dolu, `agentProfileId` boş. Emlakçı: tersi. Check constraint yukarıdadır.

Public şart `publicPropertyWhere` (`properties.service.ts`):

- `status = ACTIVE`
- `deletedAt = null`
- Emlakçı ise profil ve kullanıcı aktif
- Bireysel ise sahip aktif

Aynı şart public dosya servisinde tekrarlanır.

### Liste

`listForAdmin` vardır. Döner: başlık, fiyat (string, iki hane), ilan türü, emlak türü, şehir/ilçe/mahalle, `sellerType`, durum, `deletedAt`, tarihler, emlakçı özeti veya sahip özeti.

Kapak görseli listede yoktur. Sahip e-postası listede yoktur; detayda vardır. “Public görünür mü” diye ayrı bir boolean yoktur. Ekran, durum ve hesap/profil aktifliğini ayrı yazar.

Filtreler: `status`, `listingType`, `city` tam `city.name`, `deleted=true|false`. `deleted` gönderilmezse veya `false` ise yalnız silinmemişler gelir. Başlık, sahip, `sellerType`, `propertyType`, ilçe ve tarih aralığı yoktur. Arama backend’dedir; eksik olanlar da backend’e eklenmelidir, ilk sayfa client filtresi olmamalıdır.

### Detay

`getForAdmin` `findUnique` kullanır. `ACTIVE`, `INACTIVE`, `SOLD`, `RENTED`, askıdaki emlakçı ilanı, pasif kullanıcı ilanı ve soft-delete ilan id ile açılır. Normal liste soft-delete’i gizler; “Silinmiş ilanlar” filtresi yalnız onları gösterir. Öneri: varsayılan kuyruk silinmemiş kalsın. Silinenler ayrı filtre ve detayda kalsın. Geri alma endpoint’i yoktur.

Detayda konum, özellikler, açıklama, sahip veya emlakçı, galeri vardır. Galeri URL’si `publicFileUrl`. Public şartı sağlamayan görsel admin ekranında kırık yüklenir. Yönetim geçmişi detayda yoktur; audit ayrı sayfadadır.

### Görsel erişimi

- Public: `PublicFilesService.open`.
- Emlakçı sahip: `GET /api/v1/properties/me/files/:fileId` (`agentOwnedFileUrl`).
- Bireysel sahip: `GET /api/v1/user-properties/me/files/:fileId` (`userOwnedFileUrl`).
- Admin dosya okuma endpoint’i yoktur. Admin fotoğraf silme vardır ve dosyayı fiziksel atar.

Öneri, public kurala dokunmadan `GET /api/v1/admin/properties/:id/files/:fileId`. Dosya o ilanın silinmemiş `PropertyImage.fileId` değeri olmalıdır. Soft-delete ilanın görselini admin’in görüp göremeyeceği karara bağlıdır. Varsayılan öneri: yönetim detayı görsün, public görmesin.

## 10. Moderasyon önerisi

Mevcut durumlar `property-rules.ts`:

- `ACTIVE → INACTIVE | SOLD | RENTED`
- `INACTIVE → ACTIVE`
- `SOLD → ACTIVE`
- `RENTED → ACTIVE`
- Bireysel sahip yalnız `ACTIVE ↔ INACTIVE`

Admin `deactivate` `status = INACTIVE` yazar ve `canTransition` ister. Bu yalnız `ACTIVE` iken geçer. `SOLD` ve `RENTED` bu yoldan `INACTIVE` olamaz. UI butonu da `status !== 'ACTIVE'` iken kapalıdır.

Sahip, `INACTIVE` ilanı tekrar `ACTIVE` yapabilir. Satır kilidi yarışı önler, yönetim kararını kilitlemez. Admin pasife aldıktan sonra sahip kendi panelinden yayına alır. Bu, mevcut sistemin engellemediği boşluktur.

Admin soft delete `deletedAt` yazar. Sahibin restore yolu yoktur. Bu, moderasyon kısıtı değil silmedir. İlan status’u ayrıca değişmez.

Ayrı moderasyon kolonu veya modeli bugün yoktur.

### Seçenek A — status üzerinden

Uygulaması kısadır çünkü endpoint vardır. Sahip `INACTIVE → ACTIVE` ile kararı aşar. `SOLD`/`RENTED` bu aksiyonun dışındadır. Sahip yaşam döngüsü ile yönetim kararı aynı kolonda karışır. Önerilmez.

### Seçenek B — ilan üzerinde ayrı kısıt

Öneri budur. Sahip `status` alanı durur. Örnek ihtiyaç, henüz şema değildir:

- kısıt bayrağı veya `moderationState`
- gerekçe
- işlemi yapan admin id
- işlem zamanı
- kaldırılma bilgisi

Public şart bu bayrağı da ister. Kısıt kalkınca eski `status` aynen kalır. Pasif ilan kendiliğinden `ACTIVE` olmaz. Askıdaki emlakçı ilanı kısıt kalksa da public olmaz. Admin `SOLD`/`RENTED` yazmaz. Başlık, fiyat ve açıklama bu dönemde değişmez. Ön onay sistemi yoktur.

Mevcut `deactivate` ve soft delete, bu model gelene kadar yerinde kalır. Yeni model onları sessizce status değişimine çevirmemelidir. Geçiş kararı bölüm 18’dedir.

### Seçenek C — ayrı moderasyon tablosu

Geçmiş satırları ve birden fazla gerekçeyi tutar. Bu ölçekte güncel kısıt için fazladır. Geçmiş zaten `AuditLog` append-only modelindedir. Güncel bayrak Property üzerinde, geçmiş audit’te kalabilir. Ayrı tablo ancak “kısıt geçmişini ilan detayında audit’ten bağımsız sorgula” kararı çıkarsa düşünülmelidir.

### Public sorgular

Hepsi `publicPropertyWhere` veya onun dosya kopyasını kullanır:

- Ana sayfa: `useProperties({ page: 1, limit: 9, sort: 'newest' })`.
- Public liste ve detay: `GET /properties`, `GET /properties/:id`.
- Emlakçı public ilanları: `GET /agents/:slug/properties` (profil `isActive` değilse 404).
- Favoriler: `property: publicPropertyWhere`.
- Public dosya: `PublicFilesService`.
- Şehir kartları lokasyon listesinden üç şehir seçer. İlan sayacı endpoint’i yoktur.

Moderasyon bayrağı eklenirse bu beş sorgu ve dosya servisi aynı şartı kullanmalıdır. Sahip paneli (`/properties/me`, `/user-properties/me`) public şartı kullanmaz; kısıtlı ilan panelde görünür kalabilir. Bunu bozmamak gerekir.

## 11. Audit

Model alanları: `id`, `actorUserId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`. IP ve request id yoktur.

| Event | Nerede | Aktör | Hedef | Metadata | Transaction | Test |
|---|---|---|---|---|---|---|
| `AGENT_APPLICATION_APPROVED` | `approveOnce` | admin id | `AGENT_APPLICATION` | yok | evet | e2e |
| `AGENT_APPLICATION_REJECTED` | `reject` | admin id | `AGENT_APPLICATION` | `{ reason }` | evet | e2e |
| `USER_ACTIVATED` / `USER_DEACTIVATED` | `AdminUsersService.setStatus` | admin id | `USER` | yok | evet | dolaylı |
| `AGENT_PROFILE_ACTIVATED` / `DEACTIVATED` | `setActive` | admin id | `AGENT_PROFILE` | yok | evet | e2e askı |
| `PROPERTY_DEACTIVATED_BY_ADMIN` | `deactivate` | admin id | `PROPERTY` | `{ reason }` | evet | e2e |
| `PROPERTY_DELETED_BY_ADMIN` | `removeForAdmin` | admin id | `PROPERTY` | `{ reason }` | evet | e2e |
| `PROPERTY_IMAGE_DELETED_BY_ADMIN` | `removeForAdmin` image | admin id | `PROPERTY_IMAGE` | `{ propertyId }` | evet | readiness |
| `AGENT_DOCUMENT_UPLOADED` / `REPLACED` | sahip belge yazımı | kullanıcı id | `AGENT_APPLICATION_DOCUMENT` | `{ documentType }` | evet | e2e belge |

Emlakçı ilan mutation’ları audit yazmaz. Bu `docs/agent-system-final.md` sınırıdır.

`AuditService.safeMetadata` anahtarında `password`, `token`, `secret`, `storagekey`, `path` geçenleri atar. Mevcut metadata gerekçe, belge türü veya property id’dir. Hash, refresh token ve dosya içeriği yazılmaz.

Liste yalnız ADMIN `GET /admin/audit-logs`. Update/delete endpoint’i yok. Veritabanı trigger’ı da reddeder. Audit, iş transaction’ının içindedir; yazım hatası ana işlemi de geri alır.

Eksik, henüz olmayan event önerileri:

- Kalıcı ilan kısıtı konması ve kaldırılması. Mevcut `PROPERTY_DEACTIVATED_BY_ADMIN` status değişimidir; yeni kısıt ile karıştırılmamalıdır.
- Kullanıcı aktif/pasif event’leri zaten vardır.

Ekran tarih sırası ve sayfalama kullanır. Filtre: entity type ve tam UUID. Aktör, action ve hedef linki yoktur. Metadata ham JSON’dur. İnceleyen ad yerine UUID gösterilir.

## 12. Dashboard

`AdminHome` dört liste sorgusunun `total` alanını kullanır. `limit=1` yalnız bir satır çeker; sayaç `count` sonucudur, ilk sayfanın uzunluğu değildir. Ayrı summary endpoint yoktur. GroupBy yoktur. N+1 yoktur. Dört ek sayaç için dört ek liste veya tek salt okunur summary daha doğrudur. Mevcut dört sayaç yanıltıcı toplama yapmaz; etiketleri de dar tutulmuştur.

| Sayaç | Tanım | Kaynak | Mevcut destek | Gerekli değişiklik |
|---|---|---|---|---|
| Toplam kullanıcı | Bütün `users` satırları, rol ayrımı yok | `user.count` via list total | Var. Etiket doğru | Yok |
| USER rolü | `role = USER` | aynı where | Filtre var, dashboard’da yok | İkinci sayaç veya summary |
| Aktif kullanıcı | `isActive true` | aynı | Filtre var, dashboard’da yok | summary |
| Pasif kullanıcı | `isActive false` | aynı | Filtre var, dashboard’da yok | summary |
| Toplam emlakçı profili | Bütün `agent_profiles` | agents list total | Var. Etiket “onaylı profil” | Askı ayrımı yok |
| Aktif emlakçı | `AgentProfile.isActive` | filtre var | Dashboard’da yok | summary |
| Askıdaki emlakçı | `isActive false` | filtre var | Dashboard’da yok | summary |
| PENDING başvuru | `status PENDING` | Var ve dashboard’da kullanılıyor | Doğru | Yok |
| APPROVED / REJECTED | status sayımı | filtre var | Dashboard’da yok | summary |
| DRAFT | status sayımı | filtre var | Dashboard’da yok | İstenirse ayrı; kuyruk değil |
| Silinmemiş ilan | `deletedAt null`, her status | Var | Etiket doğru. Alt yazı “moderasyon kapsamı” status’tan geniştir | Alt yazı daraltılmalı |
| Bireysel / emlakçı ilan | `sellerType` | kolon var, admin filtre yok | Yok | summary `groupBy sellerType` |
| ACTIVE / INACTIVE / SOLD / RENTED | `status` ve silinmemiş | status filtresi var | Dashboard’da yok | summary |
| Gerçek public ilan | `publicPropertyWhere` | public liste total’i bu şartla sayar | Admin dashboard’da yok | Ayrı tanım. ACTIVE ile karıştırılmamalı |
| Moderasyon kısıtlı | yok | şema yok | Yok | B seçeneğinden sonra |

Görüntülenme, gelir ve etkileşim grafiği önerilmez. Veri yoktur.

Dashboard, kullanıcı ve ilan sayaçları için 3.2 ve 3.5 tanımlarına bağlıdır. Başvuru ve emlakçı ham sayaçları bugün liste total’inden okunabilir. Public ilan sayacı moderasyon kararına bağlıdır.

## 13. UI/UX

`AdminLayout` kendi kabuğudur. Header, logo, “Yuva operasyonları”, ana sayfa linki ve altı linkli `<aside>` vardır. Aktif route boyanmaz. `lg` altında menü içeriğin üstüne yığılır. Drawer, odak tuzağı ve Escape yoktur. Bunlar `PanelLayout` içindedir ve AGENT guard’ına bağlıdır. Admin’i o componente bağlamak yanlış ortaklaştırmadır.

Ortak ve güvenli parçalar, rol bilmeyenler:

- `EmptyState`, `ErrorState`, `Pagination`, `SectionTitle` (`market-ui.tsx`)
- `StatusPill` ve `Info` bugün `App.tsx` içinde yereldir; admin’de kalabilir
- Tablo sınıfı `.data-table` (`index.css`): `white-space: nowrap`, yatay sarmalayıcı `overflow-x-auto`

Admin’e özel kalması gerekenler: menü, rol guard, moderasyon formu, belge indirme, authenticated admin görsel yükleme.

Büyük `App.tsx` bölünmesi bu yol haritasının şartı değildir. 3.8’de kabuk drawer’ı kopyalanabilir; `PanelLayout` import edilerek admin AGENT’a bağlanmamalıdır.

Onaylar `window.confirm`. Ayrı dialog bileşeni yoktur.

Piksel matris (320, 390, 768, 1024, 1440, 1920) bu fazda ölçülmedi. Koddan görülen riskler:

- Tablolar dar ekranda yatay kayar. Aksiyon sütunu kaybolabilir.
- E-posta ve firma `nowrap` olduğu için satır uzar, kırılmaz.
- Filtreler `sm`/`lg` grid ile alta iner; kullanılabilir, ölçülmedi.
- Belge kartları `sm:grid-cols-2`.
- Moderasyon `<textarea>` tam genişlik. Modal yoktur; sağ kolon `lg` sonrası yan paneldir.
- Admin menüsü mobilde her zaman yer kaplar.

## 14. API contract

Frontend tipleri mevcut response ile uyumludur:

- Sayfalama `items/page/limit/total`. `totalPages` yoktur.
- Para ve alan string’dir (`formatMoney`, `formatArea`).
- `logoUrl` ve ilan görseli root-relative `/api/v1/files/:id`.
- Admin kullanıcı select’i hash sızdırmaz.
- `AdminAgentApplication.reviewedById` tipte vardır, ekranda yoktur.
- Audit action union’ı şema enum’u ile aynı on değerdir.
- Hata tipi `ApiError` backend filtresi ile aynıdır.
- Query anahtarları `use-api.ts` `keys` içindedir. Mutation sonrası ilgili admin anahtarları ve public `properties` / `agent-properties` / `property` invalidate edilir.

Davranış etkileri, yeni contract değil mevcut sonuç:

- Kullanıcı pasif: access ve refresh 401. Public ilan ve dosya kaybolur. Açık sekmedeki access token süresi dolmadan da guard 401 verir ve client unauthorized handler oturumu temizler.
- Emlakçı askısı: public profil ve ilan 404/gizli. Panel okuması role bağlıdır. Bu analiz 2.7.6 panel kapanışını yeniden doğrulamadı.
- İlan `INACTIVE`: public kaybolur. Sahip tekrar `ACTIVE` yapabilir.
- İlan soft delete: public ve sahip yazma 404. Admin detay id ile durur.
- Onay: rol `AGENT` olur. Eski access token bir sonraki istekte güncel rolü görür. Açık menü, refresh veya hard refresh olmadan güncellenmeyebilir. Bu yetki açığı değildir.
- Ret: `rejectionReason` sahip başvuru response’unda vardır.

Uyuşmazlık olarak yazılacak sahte alan bulunmadı. Eksik olanlar response’ta hiç yoktur: ilan sayısı, kapak, admin dosya path’i, moderasyon bayrağı, inceleyen ad.

## 15. Güvenlik ve performans

### KRİTİK

1. Admin ilan pasife alma, sahip status yaşam döngüsünü kullanır. Sahip `INACTIVE → ACTIVE` ile yayına dönebilir. Kanıt: `PropertiesService.deactivate` ve `canTransition`. Çözüm: seçenek B. Bu fazda yazılmadı.

### YÜKSEK

2. Son aktif admin sayacı yok. İki admin birbirini aynı anda pasife alabilir. Kanıt: `setStatus` yalnız `actorId === userId` bakar, `FOR UPDATE` yok. Çözüm: transaction içinde aktif ADMIN sayısı ve kendinden başka en az bir aktif admin.
3. Admin, public olmayan ilan görselini ve askıdaki logoyu public URL ile ister. İnceleme görseli kırılır. Public endpoint doğru olarak 404 verir. Çözüm: admin’e özel private okuma. Public gevşetilmez.
4. Kullanıcı ve emlakçı status güncellemesinde satır kilidi yok. Son yazma kazanır. Başvuru onayındaki `updateMany` şartı burada yoktur.

### ORTA

5. Admin ilan listesinde başlık, sahip, seller type, property type, ilçe ve tarih filtresi yok. Şehir tam eşleşmedir.
6. Başvuru listesinde arama ve belge sayısı yok.
7. Kullanıcı listesinde ad araması ve ilan sayısı yok.
8. Dashboard her status ve rol kırılımı için ayrı count tutmuyor. Yanlış toplama yok; eksik kırılım var.
9. Admin fotoğraf silme fiziksel dosyayı atar (`storage.discard`). Geri alınamaz. Moderasyon kısıtından ayrı bir silme işlemidir.
10. Pasife alma session satırını revoke etmez. Erişim `isActive` ile kesilir. Explicit revoke daha görünür olur; bugünkü 401 davranışı için şart değildir.

### DÜŞÜK

11. Admin menüde aktif route ve mobil drawer yok.
12. Tablolar `nowrap`.
13. Onay penceresi `window.confirm`.
14. Audit ekranı UUID gösterir, hedef sayfaya link vermez.
15. İnceleyen admin detayda yalnız id olarak API’de durur, UI’da yoktur.
16. Emlakçı ilan CRUD audit yazmaz. Admin aksiyonları yazar.

Index eksikliği: mevcut liste filtreleri (`status`, `email` contains, `companyName` contains) için ayrı bir admin index şartı bu veri ölçeğinde kanıtlanmadı. `email` unique index eşitlikte işe yarar; `contains` için yetmeyebilir. Ölçülmeden yeni index açılmamalıdır.

Kontrolsüz büyük liste yoktur. `limit` max 100.

## 16. Test kapsamı

Birim testler bu analizde çalıştı: `npm test` in `apps/api`. 11 suite, 37 test geçti. Kapsam guard, rol, dosya politikası, ilan geçiş kuralları, başvuru geçiş kuralları, slug, health, http contract, local admin bootstrap. Veritabanına yazmazlar. Health spec içindeki `ECONNREFUSED` logu, kasıtlı kopuk veritabanı senaryosunun çıktısıdır; suite geçti.

E2E çalıştırılmadı: `NOT RUN`. `apps/api/test/*.e2e-spec.ts` `AppModule` ile paylaşılan veritabanına yazar. Bu faz gerçek kullanıcı verisinde destructive test yapmaz. Aşağıdaki “test var” ifadeleri dosyadaki senaryo adlarıdır, bu oturumun sonucu değildir.

| Alan | Durum | Dosya ve senaryo |
|---|---|---|
| ADMIN authorization | Test mevcut | `auth.e2e-spec.ts` “authorizes USER, AGENT and ADMIN”; `jwt-auth.guard.spec.ts`; `roles.guard.spec.ts` |
| Başvuru listeleme | Test mevcut | `agent-applications.e2e-spec.ts` “lists and shows applications only to admins” |
| Başvuru detay | Test mevcut | aynı dosya |
| Belge güvenliği | Test mevcut | “serves application documents only to the owning admin request”; `readiness.e2e-spec.ts` “stores a public logo and keeps private documents private” |
| Onay | Test mevcut | “approves a pending application once…” |
| Ret | Test mevcut | “rejects a pending application…” |
| Concurrent approve/reject | Test mevcut | “serializes two approvals”; “lets one of two simultaneous decisions win” |
| AgentProfile oluşturma | Test mevcut | onay senaryosu ve “only one profile per user” |
| Suspend/reactivate | Test mevcut | `properties.e2e-spec.ts` “blocks suspended professional writes and resumes the same profile”; “serves the current logo only to its owner…” |
| Audit | Kısmen | `readiness.e2e-spec.ts` “manages property images, locations, admin access, and audit history” |
| Kullanıcı yönetimi | Kısmen | `user-properties.e2e-spec.ts` “publishes an active individual listing and hides it when the user is inactive”. Liste araması, son admin, kendi hesabı için ayrı senaryo yok |
| İlan yönetimi | Kısmen | “lets an admin review, deactivate, and soft-delete any listing”; “lets an admin moderate an individual listing” |
| Public/private dosya | Test mevcut | properties ve user-properties “lets the owner read … public file route hides”; agent logo senaryosu |
| Public görünürlük | Test mevcut | “hides inactive, sold, rented, deleted, and inactive owner listings”; favorites e2e |
| Kalıcı moderasyon kısıtı | Test yok | Özellik yok |
| Admin logo/ilan dosyası | Test yok | Endpoint yok |
| Dashboard sayaçları | Test yok | Ayrı spec yok |

Sonraki moderasyon testleri, özellik yazılırken eklenecek, bu fazda yazılmadı:

- USER ve AGENT kısıtı `ACTIVE` yaparak aşamaz.
- `status ACTIVE` olsa da kısıt public’i kapatır.
- Kısıt sırasında sahip paneli kaydı gösterir.
- Kısıt kalkınca sahip status’u değişmez.
- Pasif ilan kısıt kalkınca kendiliğinden `ACTIVE` olmaz.
- Askıdaki emlakçı ilanı kısıt kalkınca public olmaz.
- Eşzamanlı admin ve sahip yazımı tek sonuç bırakır.
- Aksiyon audit’e yazılır.

## 17. Docker ve migration

Salt okunur kontrol, 2026-11-25:

- `emlak-site-api-1` healthy, yaklaşık 52 dk.
- `emlak-site-web-1` healthy, yaklaşık 24 dk. `http://localhost:3000/` → 200.
- `emlak-site-postgres-1` healthy, 6 saat. Port host `5433`.
- `GET http://localhost:3000/api/v1/health` → `status ok`, `database up`, `postgis up`.
- Volume’lar duruyor: `emlak-site_postgres_data`, `emlak-site_storage_data`. Silinmedi.
- `_prisma_migrations` 12 satır, hepsi `finished`. Diskteki üç untracked migration da uygulanmış: `20261124160000`, `20261124173000`, `20261124180000`. Bekleyen migration satırı yok.
- Container içi `npx prisma migrate status` şema yolunu bulamadı. Bu bir pending migration değildir. Kaynak, veritabanı satırlarıdır.

Yeni container, volume silme, migrate deploy ve e2e bu fazda yapılmadı.

## 18. Özellik tamamlanma matrisi

| Özellik | Backend | Frontend | Güvenlik | Test | Genel durum |
|---|---|---|---|---|---|
| Admin oturum ve rol | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Kullanıcı listesi | PARTIAL | PARTIAL | COMPLETE | PARTIAL | PARTIAL |
| Kullanıcı detay | PARTIAL | PARTIAL | COMPLETE | NOT VERIFIED | PARTIAL |
| Kullanıcı aktif/pasif | COMPLETE | COMPLETE | PARTIAL | PARTIAL | PARTIAL |
| Başvuru kuyruğu | COMPLETE | PARTIAL | COMPLETE | COMPLETE | PARTIAL |
| Başvuru detay ve belge | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Başvuru onay/ret | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Emlakçı listesi | PARTIAL | PARTIAL | COMPLETE | PARTIAL | PARTIAL |
| Emlakçı detay | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Emlakçı askı/aç | COMPLETE | COMPLETE | PARTIAL | COMPLETE | PARTIAL |
| Admin logo okuma | MISSING | MISSING | PARTIAL | MISSING | MISSING |
| İlan listesi | PARTIAL | PARTIAL | COMPLETE | PARTIAL | PARTIAL |
| İlan detay | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Kalıcı moderasyon | MISSING | MISSING | MISSING | MISSING | MISSING |
| Admin ilan görseli | MISSING | MISSING | PARTIAL | MISSING | MISSING |
| Audit yazımı | COMPLETE | — | COMPLETE | PARTIAL | PARTIAL |
| Audit ekranı | PARTIAL | PARTIAL | COMPLETE | PARTIAL | PARTIAL |
| Dashboard | PARTIAL | PARTIAL | COMPLETE | NOT VERIFIED | PARTIAL |
| Admin kabuk / responsive | — | PARTIAL | — | NOT VERIFIED | PARTIAL |

`COMPLETE` bu tabloda “ilgili mevcut işlev kodda ve hedeflenen test dosyasında var” demektir. E2E bu oturumda koşulmadığı için taze geçiş sonucu değildir. `NOT VERIFIED` bu oturumda çalıştırılmayan veya ölçülmeyen parçadır.

## 19. Karar gerektiren konular

Bunlar uygulanmış karar değildir.

1. Pasif kullanıcının ilanları. Mevcut: public gizlenir, status durur. Öneri: bu kural kalsın. Alternatif: pasif hesapta ilan public kalsın. Dezavantajı, kapatılan hesabın ilanı yayında kalır. Etkiler: `publicPropertyWhere`, dosya servisi, favoriler. Karar değişmeyecekse 3.2 mevcut davranışı bozmadan ilerleyebilir.
2. Pasif AGENT kullanıcısı ve profil. Mevcut: rol ve profil `isActive` durur; public, kullanıcı aktifliği yüzünden kapanır; kullanıcı giriş yapamaz. Öneri: hesap pasifliği ile profil askısını ayrı tutmaya devam. Profili otomatik askıya almak ikinci bir işlem olur ve geri açılışta sürpriz yaratır. Karar, 3.2 status endpoint’ini değiştirmeden verilebilir.
3. Son admin. Mevcut: yalnız kendini kapatamaz. Öneri: transaction içinde kendinden başka en az bir aktif ADMIN kalsın. Alternatif: yalnız self-check. Dezavantajı sıfır admin yarışıdır. Bu kural yazılmadan 3.2’nin status değişikliği “bitti” sayılmamalı. Liste ekranı bu kararı beklemeden zenginleştirilebilir.
4. Emlakçı askı gerekçesi. Mevcut: alan yok. Öneri: zorunlu 3–500 karakter, audit metadata. Alternatif: gerekçesiz bırakmak. 3.4 status çağrısını gerekçeli yapmak bu karara bağlıdır. Gerekçesiz mevcut endpoint çalışır.
5. Moderasyon modeli. Mevcut: status ve soft delete. Öneri: seçenek B. A ve C alternatif. 3.5 şema işi bu karar olmadan başlamamalı.
6. Kısıtın sahip panelinde gösterimi. Mevcut özellik yok. Öneri: ilan durur, yazma politikası ayrıca seçilir; en azından neden metni gösterilir. Sahibin kısıtlı ilanı düzenleyip düzenleyemeyeceği karar gerektirir. Public gizleme kararı bunu beklemez. Panel metni 3.5 UI’ını bekler.
7. Soft-delete ilanlar. Mevcut: varsayılan listede yok, filtre ve detay var. Öneri: böyle kalsın. Admin’in silineni görmemesi operasyonu körleştirir. Karar 3.5 liste varsayılanını değiştirmeden korunabilir.
8. Audit’te gösterilecekler. Mevcut: eylem, tür, iki UUID, tarih, ham metadata. Öneri: reason, eylem etiketi, hedef linki. IP eklenmemeli; kolon yok ve bu dönemde gerekçesi yok. 3.6 bu kararla sınırlı kalabilir.
9. “Yayındaki ilan”. Mevcut dashboard bunu söylemez; “silinmemiş” der. Öneri: public sayaç ayrı kalsın ve `publicPropertyWhere` ile tanımlansın. ACTIVE sayısı ayrı kalsın. Bu ayrım yazılmadan tek “yayında” kartı konmamalıdır.
10. Admin dosya erişimi. Mevcut: public URL. Öneri: admin private path, public gevşetilmez. 3.4 logo ve 3.5 galeri bu karara bağlıdır. Karar verilmeden o iki okuma endpoint’i yazılmamalıdır.

## 20. Güncellenmiş FAZ 3 yol haritası

Sıra korunur. Büyük ölçüde biten başvuru kararı yeniden geliştirilmez.

### 3.2 Kullanıcı yönetimi

- Amaç: mevcut liste ve status üzerine arama, sayaç ve detay bağlamı. Rol atama ve silme yok.
- Hazır: list, detail, email/role/isActive, status, audit, self-check, public gizleme.
- Eksik backend: ad araması, ilan sayısı, başvuru özeti, son admin kuralı karar sonrası.
- Eksik frontend: detayda ilan, başvuru, audit linki.
- Şema: gerekmez.
- Güvenlik: son admin kararı. Mevcut self-check korunur.
- Test: kendi hesabı 409, pasifken 401 refresh, public ilan gizlenir, yeniden açılışta status korunur, son admin.
- Bağımlılık: karar 1–3.
- Kabul: mevcut status endpoint’in davranışı bozulmaz; hash sızmaz; sayfalama backend’dedir.

### 3.3 Başvurular

- Amaç: kuyruk okunabilirliği. Approve/reject yeniden yazılmaz.
- Hazır: lifecycle, kilit, belge, audit, UI aksiyonları, varsayılan PENDING.
- Eksik backend: isteğe bağlı firma/e-posta araması, belge sayısı, inceleyen özeti.
- Eksik frontend: inceleyen adı, listede belge sayısı ve `submittedAt`.
- Şema: gerekmez.
- Test: mevcut e2e regresyonu. Yeni arama varsa bir e2e.
- Bağımlılık: yok. 3.2’deki kullanıcı linki faydalıdır, blok değildir.
- Kabul: DRAFT varsayılan kuyrukta değildir. PENDING olmayan satıra onay/ret gitmez.

### 3.4 Emlakçılar

- Amaç: mevcut askıyı gerekçe ve admin logo ile tamamlamak. Profil silinmez.
- Hazır: liste filtreleri, detay alanlarının çoğu, status, public gizleme, audit eylemi.
- Eksik: gerekçe kararı, admin dosya okuma, ilan sayısı, başvuruya gidiş.
- Şema: gerekmez. Gerekçe audit metadata’da durabilir.
- Bağımlılık: karar 4 ve 10. 3.3 belge modeli örnek alınır, kopyalanarak ikinci storage açılmaz.
- Kabul: rol, başvuru ve ilan status’u değişmez. Public logo kuralı aynı kalır.

### 3.5 İlan ve moderasyon

- Amaç: sahip status’undan ayrı kısıt. Mevcut deactivate/soft delete, karar yazılana kadar yerinde kalır.
- Eksik: moderasyon alanları, public şart, admin dosya okuma, liste filtreleri, panelde neden metni.
- Şema: seçenek B seçilirse Property kolonları ve bir migration. Seçenek A seçilirse şema yok ve sahip bypass’ı kabul edilmiş olur.
- Etkilenen sorgular: bölüm 10.
- Bağımlılık: karar 5, 6, 7, 10. 3.4’teki dosya deseni.
- Kabul: kısıt kalkınca status değişmez; askı ve pasif hesap public’i ayrı ayrı tutar; admin SOLD/RENTED yazmaz.

### 3.6 Audit

- Amaç: mevcut kayıtları okunur kılmak ve 3.5 event’ini eklemek.
- Hazır: model, immutability, liste, temel UI.
- Eksik: actor ve action filtresi, hedef linki, yeni event’ler yalnız 3.5 ile.
- Şema: gerekmez. IP eklenmez.
- Bağımlılık: 3.5 event adları. Ekran iyileştirmesi 3.5’i beklemez.
- Kabul: DELETE/PATCH audit endpoint’i yok. Metadata’da dosya içeriği yok.

### 3.7 Dashboard

- Amaç: doğru sayaçlar. Yeni grafik yok.
- Hazır: dört dürüst total.
- Eksik: rol, aktiflik, status, seller type, public görünür sayaç. Tercihen tek salt okunur summary.
- Bağımlılık: public sayaç tanımı karar 9. Moderasyon sayacı 3.5.
- Kabul: ACTIVE sayısı ile public sayı aynı kartta birleşmez.

### 3.8 UI

- Amaç: admin kabuğuna drawer, aktif link, tablo taşması. Emlakçı paneline bağlanmadan.
- Hazır: layout, tablolar, boş/hata/yükleme, pagination.
- Bağımlılık: 3.2–3.6 ekranları oturduktan sonra cilalama daha az tekrar eder. Küçük kabuk işi paralel başlayabilir.
- Kabul: 320–1920 ölçülür. `PanelLayout` admin’e import edilmez.

### 3.9 Final güvenlik ve regresyon

- Amaç: 3.2–3.8 sonrası yetki, public görünürlük, dosya, eşzamanlılık ve mevcut e2e.
- Bağımlılık: önceki fazlar.
- Kabul: e2e bu kez gerçekten koşulur ve sonuç dosya adıyla yazılır. Koşulmayan hücre NOT RUN kalır.

## 21. İlk geliştirme adımı

FAZ 3.2’nin liste ve detay zenginleştirmesi, mevcut status davranışını değiştirmeden başlayabilir.

Status kuralını değiştirmek (son admin, pasif kullanıcının ilan görünürlüğü, profilin otomatik askıya alınması) karar 1–3 yazılmadan başlamamalıdır. Bu analiz mevcut davranışı korumayı önerir ve son admin sayacını eklemeyi önerir. İkisi de ürün kararı olarak açık bırakıldı.

## 22. Değişen dosyalar

Yalnız bu belge eklendi: `docs/admin-system-analysis-and-roadmap.md`.

Uygulama kodu, şema, migration, test ve Docker tanımı değişmedi. Commit ve push yapılmadı.

## 23. Final karar

FAZ 3.1 = COMPLETE

FAZ 2.7.6 = COMPLETE. Bu satır, analizden sonraki kapanış kararıyla güncellendi. Native `beforeunload` ve gerçek klavye Tab PASS değildir.

FAZ 3.2 = DECISION REQUIRED

Gerekçe: kullanıcı pasifliğinin public sonucu ve son admin kuralı yazılmadan status işi kapanış kabul edilemez. Liste/detay eksikleri bu iki kararı beklemeden tarif edilebilir; uygulanacak status farkı beklemelidir.

## FAZ 3.2.1 sözleşme eki

Bu ek, yukarıdaki FAZ 3.1 anlık görüntüsünü değiştirmez. FAZ 3.2.1 ürün kararı olarak mevcut public görünürlüğü korur, son aktif admin korumasını ekler ve pasife almada açık refresh oturumlarını iptal eder. Admin ekranları bu fazda yeniden çizilmedi.

### Endpointler

| Method | Path | Query veya gövde | Başarı | Yetki hataları |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/admin/users` | `email`, `role`, `isActive`, `createdFrom`, `createdTo`, `page`, `limit` | 200 `items`, `page`, `limit`, `total` | anonim 401, USER/AGENT 403, pasif admin 401 |
| GET | `/api/v1/admin/users/:id` | UUID | 200 detay | olmayan kullanıcı 404 |
| PATCH | `/api/v1/admin/users/:id/status` | `{ "isActive": boolean }` | 200 `{ "id", "isActive" }` | kendi hesabı 409, son admin 409, beklerken yetkisi düşen aktör 403 |
| GET | `/api/v1/admin/properties` | ek: `ownerUserId`, `agentUserId` | mevcut sayfalı ilan listesi | ADMIN |
| GET | `/api/v1/admin/agent-applications` | ek: `userId` | mevcut sayfalı başvuru listesi | ADMIN |
| GET | `/api/v1/admin/audit-logs` | mevcut `entityType=USER`, `entityId` | mevcut audit sayfası | ADMIN |

### Liste öğesi

`AdminUser` alanları durur. Ek alanlar: `individualListingCount`, `agentListingCount`, `agentProfile | null`. Profil özeti yalnız `id`, `companyName`, `isActive` taşır. Sayaçlar silinmemiş kayıtlı ilanlardır. Public sayı değildir. Profil yoksa `agentListingCount` 0 ve `agentProfile` null olur.

### Detay

Hesap: `id`, `email`, `firstName`, `lastName`, `phone`, `role`, `isActive`, `createdAt`, `updatedAt`.

`individualListings`: `{ total, active, inactive, sold, rented, publiclyVisible }`.

`agentListings`: aynı nesne veya profil yoksa `null`.

`applications`: `{ items, total }`. Öğe `id`, `companyName`, `status`, `createdAt`, `submittedAt`, `reviewedAt`, `rejectionReason`. `submittedAt`, `reviewedAt` ve `rejectionReason` null olabilir. Önizleme en fazla 20 kayıttır.

`managementEvents`: `{ items, page, limit, total }`. Önizleme sayfa 1 ve limit 10'dur. Metadata `previousIsActive` ve `nextIsActive` taşır.

İlişki kimlikleri: kullanıcı `id`, profil `id` ve `slug`, başvuru `id`, audit `entityId`.

### Tarih ve arama

`email` yeni bir parametre değildir. Ad, soyad, `ad soyad` ve e-posta üzerinde arar. Bu veritabanında `İpek` ile `ipek` eşleşir. Tarih sınırı UTC günüdür. Saatli an `Z` veya ofset ister.

### Durum

Pasife alma kullanıcıyı, rolü, ilan status değerini, profili ve başvuruyu silmez veya dönüştürmez. `AgentProfile.isActive` değişmez. Gerçek pasife alma aynı transaction içinde `User.tokenVersion` değerini bir artırır ve açık `AuthSession.revokedAt` alanını doldurur. Access token `ver` claim'i bu sürümü taşır. Claim yoksa 0 kabul edilir. Yeniden aktif etme sürümü geri almaz; eski access ve refresh tokenlar 401 kalır. No-op durum değişikliği sürümü artırmaz. Profil askısı ve başvuru onayı sürümü değiştirmez.

Son aktif admin: `pg_advisory_xact_lock(321001, 1)` bütün status işlemlerini aynı transaction kilidinde sıraya koyar. Kilitten sonra aktörün hâlâ aktif ADMIN olduğu okunur.

### Public

Pasif kullanıcının bireysel ilanı, emlakçı profili, emlakçı ilanı, public görseli ve public logosu görünmez. Kullanıcı yeniden aktif olur ve profil askıda kalırsa emlakçı profili ve ilanları public olmaz. `INACTIVE`, `SOLD` ve `RENTED` kendiliğinden `ACTIVE` olmaz.

### Kullanıcı ekranı aggregate sözleşmesi

`GET /api/v1/admin/users/summary` yalnız kullanıcı nüfusu ve kullanıcı kayıt zaman serisi döner. İlan, başvuru ve public ilan platform özeti burada yoktur; o kapsam FAZ 3.7'dir.

Query yok. Aşağıdaki gövde sözleşme şeklidir; içindeki sayılar ölçülmüş üretim verisi değildir:

```json
{
  "total": 120,
  "active": 110,
  "inactive": 10,
  "roles": {
    "USER": { "total": 90, "active": 84, "inactive": 6 },
    "AGENT": { "total": 27, "active": 24, "inactive": 3 },
    "ADMIN": { "total": 3, "active": 2, "inactive": 1 }
  },
  "registrations": null
}
```

`createdFrom=2018-02-02&createdTo=2018-02-04&bucket=day` nüfus alanlarını değiştirmez ve `registrations` ekler:

```json
{
  "from": "2018-02-02T00:00:00.000Z",
  "to": "2018-02-04T23:59:59.999Z",
  "bucket": "day",
  "total": 1,
  "points": [
    { "bucketStart": "2018-02-02T00:00:00.000Z", "count": 1 },
    { "bucketStart": "2018-02-03T00:00:00.000Z", "count": 0 },
    { "bucketStart": "2018-02-04T00:00:00.000Z", "count": 0 }
  ]
}
```

Grafik kaynağı `points`. `count: 0` kayıt olmadığını söyler. Aralık verilmeden seri üretilmez. Sayfa uzunluğu sayaç değildir.

Kullanıcıya özel grafik alanları liste ve detayda durur: `individualListingCount`, `agentListingCount`, `individualListings`, `agentListings`, `applications`, `managementEvents`.

## Sonraki admin fazlarının görsel gereksinimleri

Bu liste FAZ 3.2.2 kullanıcı ekranında uygulanan görsel dilin sonraki fazlara devridir. Bu fazda ilgili ekranlar geliştirilmedi.

FAZ 3.3 — Emlakçı Başvuruları: renkli durum sayaçları, başvuru durum dağılımı, belge tamamlama göstergeleri, başvuru yaşam döngüsü şeması. Veri kaynağı FAZ 3.3.1, ekran FAZ 3.3.2'dir.

FAZ 3.4'te yeniden kullanılabilecek parçalar: `MetricCard`, `DonutChart`, `RegistrationChart`, `ChartFrame`, `InitialsAvatar`, `adminPalette`, `applicationStatusColor`, `presetRange` ve `customRange`. Başvuru satırı firma logosu taşımaz. Admin private logo FAZ 3.4'tedir.

FAZ 3.3.1 backend sözleşmesi: `GET /admin/agent-applications/summary` durum sayaçlarını (`statuses.DRAFT|PENDING|APPROVED|REJECTED`) ve `created` oluşturulma serisini verir. Aralık verilmezse `created` null'dur ve sayaçlar bütün kayıtların güncel durumudur. Satırdaki `documentCompletion` zorunlu iki belge türünü sayar. Süreç şeması `createdAt`, `submittedAt`, `reviewedAt`, `status` ve `rejectionReason` ile kurulur; yeni status yoktur. `agentProfile` yalnız onaylı başvurunun gerçek profilidir.

FAZ 3.4 — Emlakçılar: firma logoları, portföy sayaçları, aktif/askı dağılımı, ilan durum grafikleri. Admin private logo bu fazdadır.

FAZ 3.5 — İlan Yönetimi: emlakçı panelindeki İlanlarım düzenine yakın görsel liste. Desktop'ta solda yaklaşık 140×100 px gerçek ilan kapağı. Mobilde görsel üstte. Görseli olmayan ilan için placeholder. Public olmayan ilanlar için güvenli admin private görsel erişimi. İlan ve moderasyon durumları ayrı gösterilir.

FAZ 3.6 — İşlem Kayıtları: Türkçe işlem açıklamaları, renkli işlem ikonları, zaman çizelgesi, aktör ve hedef bilgileri.

FAZ 3.7 — Genel Admin Dashboard: kullanıcı dağılımı, kullanıcı kayıt eğilimleri, ilan durum dağılımı, satıcı tipi, satılık/kiralık, emlak türü, aylık ilan oluşturma, şehir yoğunluğu, başvuru durumları ve son yönetim işlemleri.


