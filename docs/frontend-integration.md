# Frontend entegrasyon rehberi

Bu belge mevcut NestJS API'nin sözleşmesidir. Ekran tasarımını tanımlamaz. Başka bir frontend, `docs/api-endpoints.md` ve `docs/frontend-types.ts` ile birlikte yalnızca bu paketi okuyarak API'ye bağlanabilir.

Path örnekleri `/properties` biçimindedir. Tam adres `NEXT_PUBLIC_API_URL` + path'tir.

## 3.1 Proje ve Backend Özeti

Monorepo iki uygulamadan oluşur.

- `apps/web`: Next.js arayüzü. Bu sözleşmeyi kullanan hazır bir ürün arayüzü değildir.
- `apps/api`: NestJS 11 API. PostgreSQL ve PostGIS kullanır. Prisma 7.10 ORM'dir.

API sürümü URI ile verilir. Global prefix `api`, sürüm `1`.

```text
API Base URL (development örneği):
http://localhost:3001/api/v1
```

Frontend bu adresi hard-code etmez. `NEXT_PUBLIC_API_URL` ortamdan okunur.

Kimlik doğrulama iki parçalıdır. Access token JSON yanıtındadır ve `Authorization: Bearer` ile gönderilir. Refresh token HttpOnly cookie'dedir. JavaScript onu okuyamaz.

## 3.2 Environment Variables

Frontend kodunun okuduğu değişken:

```text
NEXT_PUBLIC_API_URL
```

Development örneği:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Değer yoksa mevcut web istemcisi hata verir. Sondaki `/` varsa atılır. Production değeri bu belgede sabitlenmez.

API'nin kendi `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE` ve storage değişkenleri frontend'e verilmez.

## 3.3 Authentication Akışı

```text
POST /auth/register
↓
POST /auth/login
↓
accessToken JSON içinde
↓
Authorization: Bearer <accessToken>
↓
401 olursa POST /auth/refresh
↓
yeni accessToken
↓
POST /auth/logout
```

Kurallar:

- Refresh token `refresh_token` adlı HttpOnly cookie'dedir. Path'i `/api/v1/auth` olduğu için yalnız login, refresh ve logout isteklerine gider.
- Frontend `document.cookie` ile bu değeri okumaya çalışmaz.
- Login, refresh ve logout `credentials: 'include'` ister.
- Bu üç istekte `Origin`, API'nin `CORS_ORIGIN` listesindeki bir değer olmalıdır. Aksi halde 401 döner.
- Register origin kontrolü yapmaz ve cookie yazmaz. Yalnız `AuthUser` döner.
- Access token cookie değildir. Bellekte tutulur ve korumalı isteklere Bearer olarak eklenir.
- Access token süresi `JWT_ACCESS_EXPIRES_IN` ile ayarlanır. `.env.example` development değeri `15m` dir. Production süresi buradan tahmin edilmez.
- Refresh, veritabanındaki güncel rolü yeni access token'a yazar. Onaydan sonra eski token hâlâ `USER` taşıyabilir. Agent endpoint'inden önce refresh veya yeniden login gerekir.
- Logout refresh oturumunu kapatır ve cookie'yi siler. Frontend elindeki access token'ı da bellekten atmalıdır. Eski access token süre dolana kadar imza olarak geçerli görünebilir, fakat pasifleştirme ve logout sonrası guard kullanıcıyı tekrar okur. Logout tek başına o access token'ın imzasını anında geçersiz kılmaz. Yeni korumalı çağrı yapmadan önce token bellekten silinir.
- Pasif kullanıcı login, refresh ve Bearer isteğinde 401 alır.

Süre dolunca önerilen akış bölüm 14'tedir.

## 3.4 Auth Örnekleri

### POST /auth/register

```json
{
  "email": "ada@example.com",
  "password": "password123",
  "firstName": "Ada",
  "lastName": "Yilmaz",
  "phone": "+905551110000"
}
```

`password` 8–128 karakterdir. `firstName`, `lastName` ve `phone` opsiyoneldir. Boş ad veya telefon `null` saklanır.

201:

```json
{
  "id": "6c5b9c2e-1e4a-4c1d-9c1a-0d0c2a6e9b11",
  "email": "ada@example.com",
  "firstName": "Ada",
  "lastName": "Yilmaz",
  "phone": "+905551110000",
  "role": "USER",
  "isActive": true,
  "createdAt": "2026-10-23T08:00:00.000Z"
}
```

### POST /auth/login

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

200:

```json
{
  "user": {
    "id": "6c5b9c2e-1e4a-4c1d-9c1a-0d0c2a6e9b11",
    "email": "ada@example.com",
    "firstName": "Ada",
    "lastName": "Yilmaz",
    "phone": "+905551110000",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-10-23T08:00:00.000Z"
  },
  "accessToken": "<jwt>"
}
```

Aynı yanıt `Set-Cookie: refresh_token=...; HttpOnly` üretir. Refresh token gövdede yoktur.

### POST /auth/refresh

Gövde yoktur. Cookie ve `Origin` yeterlidir.

200 gövdesi login ile aynıdır: `user` ve yeni `accessToken`. Cookie yeni refresh token ile değişir.

### POST /auth/logout

Gövde yoktur. 200:

```json
{ "ok": true }
```

Cookie temizlenir.

### GET /users/me ve PATCH /users/me

`GET` gövde almaz ve `AuthUser` döner.

`PATCH` gövdesi:

```json
{
  "firstName": "Ada",
  "lastName": "Yilmaz",
  "phone": "+905551110000"
}
```

Üç alan da opsiyoneldir. Yanıt yine `AuthUser` şeklindedir. `password` alanı yoktur ve gönderilmez.

## 3.5 Roller

Rol, token içindeki eski kopyadan değil, her istekte veritabanından okunur.

### USER

Kayıt sonrası varsayılan roldür. Public site, kendi profili, favoriler ve emlakçı başvurusu bu role açıktır. İlan oluşturamaz. Başvuru `POST` ve belge yükleme yalnız `USER` ister. Onaydan sonra rol `AGENT` olur.

### AGENT

Kendi emlakçı profilini, logosunu ve ilanlarını yönetir. Fotoğraf yükler. Favori de kullanabilir. Başvuru oluşturma endpoint'i 403 döner. Public profil pasif olsa da kendi profilini ve logosunu yönetebilir. Yeni ilan, profil `isActive` değilse 403 `Agent profile is inactive` döner.

### ADMIN

Kullanıcı, başvuru, emlakçı, ilan moderasyonu ve audit okuma. İlan oluşturamaz. Favori kullanabilir. Admin ekranı bu depoda yoktur. Sözleşme endpoint'leri tanımlar.

Yanlış rol 403 `Forbidden` döner. Başka bir kullanıcının kaynağı 404 döner.

## 3.6 API Error Contract

```json
{
  "statusCode": 400,
  "message": "Invalid location",
  "error": "Bad Request",
  "timestamp": "2026-10-23T08:00:00.000Z",
  "path": "/api/v1/properties"
}
```

`message` tek hatada string, validation birden fazla alana takılırsa string dizisidir. Tanınmayan alan da 400 üretir.

| Kod | Frontend beklentisi                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 400 | Gövde, query, UUID, lokasyon veya aralık geçersiz                                                                                      |
| 401 | Token yok, token geçersiz, kullanıcı pasif veya login/refresh/logout origin'i uyuşmuyor                                                |
| 403 | Hesap geçerli, rol yetersiz                                                                                                            |
| 404 | Kayıt yok veya çağıranın göremeyeceği kayıt                                                                                            |
| 409 | Durum çakışması: mükerrer e-posta, bekleyen başvuru, geçersiz ilan durumu, eksik belge, fotoğraf limiti, adminin kendini pasife alması |
| 413 | Dosya `File is too large`                                                                                                              |
| 415 | İçerik izinli MIME değil                                                                                                               |
| 429 | `/auth` rate limit. Varsayılan development limiti 60 saniyede 10 istektir                                                              |
| 500 | Beklenmeyen sunucu hatası. Gövde `Internal server error` olur                                                                          |
| 503 | `GET /health` veritabanı veya PostGIS ayakta değil                                                                                     |

## 3.7 Pagination

Sayfalı yanıtlar düzdür. İç içe `pagination` nesnesi ve `totalPages` yoktur.

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

`page` varsayılanı 1, `limit` varsayılanı 20, üst sınır 100'dür. Frontend `Math.ceil(total / limit)` hesaplar.

Sayfalı endpoint'ler:

- `GET /properties`
- `GET /agents/:slug/properties`
- `GET /favorites`
- `GET /properties/me`
- `GET /admin/users`
- `GET /admin/agents`
- `GET /admin/agent-applications`
- `GET /admin/properties`
- `GET /admin/audit-logs`

Lokasyon ve belge listeleri dizidir, sayfa sarmalayıcısı yoktur.

## 3.8 Decimal Alanlar

Para, alan ve koordinat JSON'da string döner. Frontend bunları `number` kabul etmez.

```json
{
  "price": "4250000.50",
  "grossAreaM2": "145.00",
  "netAreaM2": "125.00",
  "latitude": "37.870000",
  "longitude": "32.490000"
}
```

Para ve alan iki ondalık basamaktır. Koordinat altı ondalık basamaktır. `netAreaM2` yoksa `null` olur.

Yazarken kanonik biçim bu string'lerdir. Sunucu, izinli basamak sayısını aşmayan bir JSON sayısını da aynı biçime çevirir. `4250000.5` yazılırsa saklanan değer `"4250000.50"` olur. Fazla basamak 400 döner. Fiyat ve alan sıfırdan büyük olmalıdır. Enlem -90 ile 90, boylam -180 ile 180 arasındadır.

`currency` istemciden gönderilmez. Sunucu `TRY` yazar.

## 3.9 Enum Referansı

```text
Role
USER | AGENT | ADMIN

ApplicationStatus
PENDING | APPROVED | REJECTED

ListingType
SALE | RENT

PropertyType
APARTMENT | HOUSE | VILLA | LAND | WORKPLACE

PropertyStatus
ACTIVE | INACTIVE | SOLD | RENTED

HeatingType
COMBI | CENTRAL | FLOOR_HEATING | STOVE | NONE | OTHER

Currency
TRY

FileVisibility
PUBLIC | PRIVATE

FileCategory
AGENT_LOGO | AGENT_TAX_DOCUMENT | AGENT_AUTHORIZATION_DOCUMENT | PROPERTY_IMAGE

AgentDocumentType
TAX_CERTIFICATE | AUTHORIZATION_CERTIFICATE

PropertySort
newest | price_asc | price_desc

AuditAction
AGENT_APPLICATION_APPROVED
AGENT_APPLICATION_REJECTED
USER_ACTIVATED
USER_DEACTIVATED
AGENT_PROFILE_ACTIVATED
AGENT_PROFILE_DEACTIVATED
PROPERTY_DEACTIVATED_BY_ADMIN
PROPERTY_DELETED_BY_ADMIN
AGENT_DOCUMENT_UPLOADED
AGENT_DOCUMENT_REPLACED
PROPERTY_IMAGE_DELETED_BY_ADMIN
```

`FileVisibility` ve `FileCategory` normal JSON yanıtında dönmez. Yükleme kurallarını adlandırmak için vardır.

İlan durum geçişleri:

```text
ACTIVE  → INACTIVE | SOLD | RENTED
INACTIVE → ACTIVE
SOLD    → ACTIVE
RENTED  → ACTIVE
```

Aynı duruma tekrar geçmek de 409 `Invalid status transition` döner.

# 4. Public web

## 4.1 Ana Sayfa

Kullanılabilecek mevcut endpoint'ler:

```text
GET /properties
GET /locations/cities
```

Özel bir öne çıkan ilan, popüler bölge veya öne çıkan emlakçı endpoint'i yoktur. Public emlakçı listesi de yoktur. Emlakçıya yalnız slug biliniyorsa `GET /agents/:slug` ile gidilir.

> Bu özellik için mevcut backend'de özel endpoint bulunmamaktadır.

## 4.2 İlan kartı

`PropertyCard`, public liste, emlakçı ilan listesi ve favori listesinde aynıdır. Liste öğesinde `images` yoktur. `agent` yalnız `slug` ve `companyName` taşır.

```json
{
  "id": "6c5b9c2e-1e4a-4c1d-9c1a-0d0c2a6e9b11",
  "title": "Selcukluda 3+1 Satilik Daire",
  "description": "Genis ve aydinlik bir daire. Okula yakin.",
  "listingType": "SALE",
  "propertyType": "APARTMENT",
  "status": "ACTIVE",
  "price": "4250000.50",
  "currency": "TRY",
  "grossAreaM2": "145.00",
  "netAreaM2": "125.00",
  "rooms": 3,
  "livingRooms": 1,
  "buildingAge": 5,
  "floor": 4,
  "totalFloors": 8,
  "heatingType": "COMBI",
  "cityId": "11111111-1111-4111-8111-111111111111",
  "districtId": "22222222-2222-4222-8222-222222222222",
  "neighborhoodId": "33333333-3333-4333-8333-333333333333",
  "city": "Konya",
  "district": "Selçuklu",
  "neighborhood": "Yazır",
  "address": "Yazir Mahallesi 1",
  "latitude": "37.870000",
  "longitude": "32.490000",
  "isFurnished": false,
  "hasBalcony": true,
  "hasElevator": true,
  "hasParking": true,
  "inSite": true,
  "createdAt": "2026-10-23T08:00:00.000Z",
  "coverImageUrl": "/api/v1/files/44444444-4444-4444-8444-444444444444",
  "isFavorite": false,
  "agent": {
    "slug": "ornek-emlak",
    "companyName": "Örnek Emlak"
  }
}
```

`buildingAge`, `floor`, `totalFloors`, `heatingType` ve `netAreaM2` boşsa `null` olur. Fotoğraf yoksa `coverImageUrl` `null` olur. `neighborhood` bu API'de zorunlu bir addır, `null` değildir.

`coverImageUrl` ve `logoUrl` kökten başlayan path'tir: `/api/v1/files/<uuid>`. Bunları `NEXT_PUBLIC_API_URL` sonuna ekleme. API origin'ine ekle. Development'ta origin `http://localhost:3001` dir.

## 4.3 Public ilan listesi

`GET /properties`

Token yoksa çağrı açıktır. Token varsa ve geçerliyse `isFavorite` dolar. Token geçersizse veya kullanıcı pasifse 401 döner.

| Parametre      | Tip                                 | Zorunlu | Açıklama                                               |
| -------------- | ----------------------------------- | ------- | ------------------------------------------------------ |
| `listingType`  | `SALE` veya `RENT`                  | Hayır   | Eşitlik                                                |
| `propertyType` | `PropertyType`                      | Hayır   | Eşitlik                                                |
| `city`         | string, 1–80                        | Hayır   | Şehir adının tam ve büyük/küçük harf duyarlı eşleşmesi |
| `district`     | string, 1–80                        | Hayır   | İlçe adı, aynı eşleşme                                 |
| `neighborhood` | string, 1–80                        | Hayır   | Mahalle adı, aynı eşleşme                              |
| `minPrice`     | ondalık metin                       | Hayır   | `price >=`                                             |
| `maxPrice`     | ondalık metin                       | Hayır   | `price <=`                                             |
| `rooms`        | 0–50 tam sayı                       | Hayır   | Eşitlik                                                |
| `livingRooms`  | 0–20 tam sayı                       | Hayır   | Eşitlik                                                |
| `minArea`      | ondalık metin                       | Hayır   | `grossAreaM2 >=`                                       |
| `maxArea`      | ondalık metin                       | Hayır   | `grossAreaM2 <=`                                       |
| `sort`         | `newest`, `price_asc`, `price_desc` | Hayır   | Varsayılan `newest`                                    |
| `page`         | 1 ve üzeri                          | Hayır   | Varsayılan 1                                           |
| `limit`        | 1–100                               | Hayır   | Varsayılan 20                                          |

Şehir filtresi ID değil addır. `agentSlug` diye bir parametre yoktur. Gönderilirse 400 döner. Aralık tersyse 400 `Invalid price range` veya `Invalid area range` döner.

Görünen ilanlar `ACTIVE`, silinmemiş, profili aktif ve sahibi aktif olanlardır.

## 4.4 Sorting

Allowlist:

```text
newest
price_asc
price_desc
```

`newest` önce `createdAt` azalan, sonra `id` azalan sıradır. Fiyat sıraları eşit fiyatta `id` ile bağlanır. Kolon adı veya başka bir değer 400 döner.

## 4.5 İlan detay

`GET /properties/:id`

Liste kartının bütün alanlarını döner. Ek olarak `images` ve daha geniş `agent` vardır. `images` `sortOrder` sırasındadır. Silinmiş fotoğraf gelmez.

```json
{
  "images": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "url": "/api/v1/files/44444444-4444-4444-8444-444444444444",
      "sortOrder": 0,
      "isCover": true
    }
  ],
  "agent": {
    "slug": "ornek-emlak",
    "companyName": "Örnek Emlak",
    "phone": "+905551110000",
    "logoUrl": null
  },
  "isFavorite": true
}
```

Detayda vergi numarası, hesap e-postası ve `agentProfileId` yoktur. Public olmayan ilan 404 `Property not found` döner.

## 4.6 Emlakçı public profil

`GET /agents/:slug`

```json
{
  "slug": "ornek-emlak",
  "companyName": "Örnek Emlak",
  "phone": "+905551110000",
  "email": "ofis@ornek.test",
  "city": "Konya",
  "district": "Selçuklu",
  "description": null,
  "logoUrl": null
}
```

Vergi numarası, açık adres, belge ve `isActive` bu yanıtta yoktur. İlanlar gömülü değildir. Slug yoksa veya profil pasifse 404 `Agent profile not found` döner. Bu endpoint sahip hesabının aktifliğini kontrol etmez. Profil aktif ve sahip pasifse profil hâlâ 200 dönebilir. İlan listesi o ilanları dışarıda bırakır.

`city` ve `district` burada serbest metindir. Lokasyon tablosunun ID'si değildir.

## 4.7 Emlakçı ilanları

`GET /agents/:slug/properties`

Filtre, sıralama, sayfalama ve kart `GET /properties` ile aynıdır. Aynı `PropertyCard` kullanılır. Slug, emlakçıyı seçer. Sonuç yalnız o profilin public ilanlarıdır. Pasif, satılmış, kiralanmış ve silinmiş ilan gelmez. Bilinmeyen veya pasif slug 404 döner.

## 4.8 Favoriler

```text
GET    /favorites
POST   /favorites/:propertyId
DELETE /favorites/:propertyId
```

Üçü de Bearer ister. `USER`, `AGENT` ve `ADMIN` kullanabilir. Anonim istek 401 döner.

Ekleme idempotenttir. İlk kayıt ve tekrar 200 döner. İkinci yanıt ilk `createdAt` değerini korur. 409 üretilmez.

```json
{
  "propertyId": "6c5b9c2e-1e4a-4c1d-9c1a-0d0c2a6e9b11",
  "createdAt": "2026-10-23T08:00:00.000Z"
}
```

Silme de idempotenttir. Kayıt yoksa da 200 ve `{ "propertyId": "..." }` döner. Başka kullanıcının satırı silinmez.

Public olmayan ilan favoriye eklenemez ve 404 döner. Listede de görünmez. `total` yalnız hâlâ public olan favorileri sayar. Satır veritabanında kalır. İlan yeniden public olursa listeye döner. Sıra favorinin `createdAt` değerine göredir.

Public kart ve detayda `isFavorite` her zaman vardır. Anonim çağrıda `false` olur.

# 5. Location

```text
GET /locations/cities
GET /locations/cities/:cityId/districts
GET /locations/districts/:districtId/neighborhoods
```

Üçü de public dizidir.

```json
{ "id": "...", "name": "Konya", "code": null }
```

```json
{ "id": "...", "cityId": "...", "name": "Selçuklu" }
```

```json
{ "id": "...", "districtId": "...", "name": "Yazır" }
```

Bilinmeyen şehir 404 `City not found`, bilinmeyen ilçe 404 `District not found` döner.

İlan oluşturma ve güncelleme ID gönderir. Mahalle zorunludur ve `null` değildir.

```json
{
  "cityId": "...",
  "districtId": "...",
  "neighborhoodId": "...",
  "latitude": "37.870000",
  "longitude": "32.490000"
}
```

Mahalle seçilen ilçeye, ilçe seçilen şehre ait değilse 400 `Invalid location` döner. Güncellemede bu üç ID'den biri gönderildiyse üçü birlikte gönderilir. Aksi halde 400 `Location fields must be updated together` döner.

İlan yanıtında hem ID hem ad vardır. Adlar string'dir. Enlem ve boylam yazma modelidir. Sunucu bunlardan spatial noktayı üretir. Frontend nokta göndermez.

Arama filtresi ID değil `city`, `district` ve `neighborhood` adlarını kullanır.

# 6. Agent application

| Endpoint                                           | Rol         | Kural                                                            |
| -------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `POST /agent-applications`                         | `USER`      | 201, `AgentApplication`                                          |
| `GET /agent-applications/me`                       | Aktif hesap | Son başvuruyu döner. Yoksa 404                                   |
| `PATCH /agent-applications/me`                     | Aktif hesap | Yalnız `PENDING`. Değilse 409 `Application is no longer pending` |
| `POST /agent-applications/me/documents`            | `USER`      | `PENDING` iken ekler veya aynı tipi değiştirir                   |
| `GET /agent-applications/me/documents`             | Aktif hesap | Son başvurunun belge dizisi                                      |
| `GET /agent-applications/me/documents/:documentId` | Sahip       | Dosya akışı. Başkasının belgesi 404                              |

Oluşturma gövdesi:

```json
{
  "companyName": "Örnek Emlak",
  "authorizedFirstName": "Ada",
  "authorizedLastName": "Yilmaz",
  "phone": "+905551110000",
  "email": "ofis@ornek.test",
  "taxNumber": "1234567890",
  "city": "Konya",
  "district": "Selçuklu",
  "address": "Ofis adresi 1",
  "description": "Kısa tanıtım"
}
```

`taxNumber` 10 veya 11 rakamdır. `description` opsiyoneldir. Bu şehir ve ilçe serbest metindir, lokasyon ID'si değildir.

Bir kullanıcının aynı anda tek `PENDING` başvurusu olabilir. İkincisi 409 döner. Onay ve red eski belgeleri o başvuruda bırakır. Yeni başvuru dosyaları kopyalamaz.

Onay için `TAX_CERTIFICATE` ve `AUTHORIZATION_CERTIFICATE` birlikte olmalıdır. Eksikte admin onayı 409 `Required documents are missing` döner.

Kendi başvuru yanıtında `userId` ve `reviewedById` yoktur. `description` ve `rejectionReason` `null` olabilir. `reviewedAt` incelemeden önce `null` olur.

Belge listesi:

```json
[
  {
    "id": "...",
    "documentType": "TAX_CERTIFICATE",
    "originalName": "vergi.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1200,
    "createdAt": "2026-10-23T08:00:00.000Z"
  }
]
```

Yükleme yanıtında `createdAt` yoktur: `id`, `documentType`, `originalName`, `mimeType`, `sizeBytes`.

İndirme JSON değildir. `Content-Disposition` attachment'tır. `Cache-Control: private, no-store`.

# 7. Agent profile

```text
GET   /agents/me
PATCH /agents/me
POST  /agents/me/logo
```

Üçü de `AGENT` ister.

`GET` ve `PATCH` yanıtı `AgentProfile` tipidir. Public profile alanlarına ek olarak `id`, `taxNumber`, `address`, `isActive`, `createdAt` ve `updatedAt` vardır.

`PATCH` ile değişebilen alanlar yalnız şunlardır:

```text
companyName
phone
email
address
description
```

Slug, vergi numarası, şehir, ilçe ve `isActive` bu endpoint ile değişmez. Boş gövde 400 `No fields to update` döner.

Logo `multipart` alan adı `file` dir. Yanıt `{ "logoUrl": "/api/v1/files/..." }` olur. Profil pasif olsa da logo yüklenebilir.

# 8. Property management

Gerçek route'lar:

```text
POST   /properties
GET    /properties/me
GET    /properties/me/:id
PATCH  /properties/:id
PATCH  /properties/:id/status
DELETE /properties/:id
```

Hepsi `AGENT` ve Bearer ister. Başka emlakçının ilanı 404 `Property not found` döner.

`GET /properties/me` query'si `status`, `page` ve `limit` dir. `sort` yoktur. Silinmiş ilanlar gelmez. Yanıt `PropertyRecord` sayfasıdır. Bu kayıtta `coverImageUrl` ve `isFavorite` yoktur. `agentProfileId`, `updatedAt` ve `deletedAt` vardır.

`GET /properties/me/:id` yanıtı `OwnerPropertyDetail` (`PropertyRecord` + `sortOrder` sırasındaki canlı `images: PropertyImage[]`) döner. Silinmiş fotoğraflar dahil edilmez.

`DELETE` soft delete yapar ve `{ "id", "deletedAt" }` döner.

## 8.1 Property create

`currency` ve `agentProfileId` gönderilmez. Gönderilirse 400 döner.

```json
{
  "title": "Selcukluda 3+1 Satilik Daire",
  "description": "Genis ve aydinlik bir daire. Okula yakin.",
  "listingType": "SALE",
  "propertyType": "APARTMENT",
  "price": "4250000.50",
  "grossAreaM2": "145.00",
  "netAreaM2": "125.00",
  "rooms": 3,
  "livingRooms": 1,
  "buildingAge": 5,
  "floor": 4,
  "totalFloors": 8,
  "heatingType": "COMBI",
  "cityId": "...",
  "districtId": "...",
  "neighborhoodId": "...",
  "address": "Yazir Mahallesi 1",
  "latitude": "37.870000",
  "longitude": "32.490000",
  "isFurnished": false,
  "hasBalcony": true,
  "hasElevator": true,
  "hasParking": true,
  "inSite": true
}
```

Zorunlu alanlar: `title` (5–160), `description` (20–5000), `listingType`, `propertyType`, `price`, `grossAreaM2`, `rooms` (0–50), `livingRooms` (0–20), üç lokasyon ID'si, `address` (5–300), `latitude`, `longitude`.

Opsiyonel: `netAreaM2`, `buildingAge` (0–300), `floor` (-5–200), `totalFloors` (1–200), `heatingType`, beş boolean özellik. Boolean'lar gönderilmezse `false` olur. Net alan brüt alandan büyük olamaz. `floor`, `totalFloors` değerinden büyük olamaz.

Güncelleme aynı alanların bir alt kümesidir. Hiç alan yoksa 400 `No fields to update` döner. Lokasyon üçlüsü birlikte gider.

## 8.2 Property status

`PATCH /properties/:id/status`

```json
{ "status": "INACTIVE" }
```

Geçerli geçişler bölüm 3.9'daki listedir. Geçersiz geçiş 409 `Invalid status transition` döner. Yanıt güncel `PropertyRecord` olur.

# 9. Property images

```text
POST   /properties/:id/images
PATCH  /properties/:id/images/order
PATCH  /properties/:id/images/:imageId/cover
DELETE /properties/:id/images/:imageId
```

Dördü de sahip `AGENT` içindir. Multipart alan adı `file` dir.

İzinli MIME: `image/jpeg`, `image/png`, `image/webp`. Üst sınır 10 MB. İlan başına en fazla 20 canlı fotoğraf vardır. Aşım 409 `Property image limit reached` döner. İçerik magic byte ile okunur. SVG 415 döner.

İlk fotoğraf kapaktır. Sonrakiler kapak değildir.

Yükleme yanıtı:

```json
{
  "id": "...",
  "url": "/api/v1/files/...",
  "sortOrder": 0,
  "isCover": true,
  "createdAt": "2026-10-23T08:00:00.000Z"
}
```

Sıra gövdesi, ilandaki canlı fotoğrafların tamamını bir kez içermelidir.

```json
{ "imageIds": ["...", "..."] }
```

Eksik, fazla veya yabancı ID 400 `Image order must include every image once` döner. Yanıt aynı `imageIds` dizisidir.

Kapak yanıtı `{ "id", "isCover": true }` olur. Bir ilanda tek canlı kapak vardır.

Silme `{ "id" }` döner. Metadata soft delete edilir ve sıradaki fotoğraf kapak yapılır. Public listede silinmiş fotoğraf görünmez.

# 10. File upload

| Kullanım       | Endpoint                                | Field                                              | MIME            | Max size | Visibility |
| -------------- | --------------------------------------- | -------------------------------------------------- | --------------- | -------- | ---------- |
| Emlakçı logosu | `POST /agents/me/logo`                  | `file`                                             | jpeg, png, webp | 5 MB     | Public     |
| Vergi levhası  | `POST /agent-applications/me/documents` | `file` ve `documentType=TAX_CERTIFICATE`           | pdf, jpeg, png  | 10 MB    | Private    |
| Yetki belgesi  | `POST /agent-applications/me/documents` | `file` ve `documentType=AUTHORIZATION_CERTIFICATE` | pdf, jpeg, png  | 10 MB    | Private    |
| İlan fotoğrafı | `POST /properties/:id/images`           | `file`                                             | jpeg, png, webp | 10 MB    | Public     |

İstemci `Content-Type` sınırını elle kurmaz. `FormData` kurar. Boş dosya 400 `File is required` döner. Depolanan ad, kullanıcının dosya adı değildir.

# 11. Public ve private dosyalar

Public:

```text
agent logo
property images
```

`GET /files/:id` JSON değildir. `Content-Type` dosyanın MIME tipidir. `Content-Disposition` inline'dır. `Cache-Control: public, max-age=86400`. Private belge, silinmiş dosya, pasif profilin logosu ve public olmayan ilanın fotoğrafı 404 döner.

Private:

```text
tax certificate
authorization certificate
```

Sahip: `GET /agent-applications/me/documents/:documentId`

Admin: `GET /admin/agent-applications/:id/documents/:documentId`

İkisi de attachment akışıdır. `Cache-Control: private, no-store`. Public `/files/:id` bu belgeleri açmaz.

# 12. Admin backend contract

Hepsi Bearer ve `ADMIN` ister. `USER` ve `ADMIN` dışındaki roller 403 alır.

### Users

```text
GET   /admin/users
GET   /admin/users/:id
PATCH /admin/users/:id/status
```

Liste query'si `role`, `isActive` (`"true"` veya `"false"` string), `email` (içerir, harf duyarsız), `page`, `limit`.

Liste öğesi `AdminUser` tipidir. Detay `updatedAt` ve `agentProfile | null` ekler. Profil özeti `id`, `slug`, `companyName`, `isActive`, `city`, `district` taşır.

Durum gövdesi `{ "isActive": false }` olur. Yanıt `{ "id", "isActive" }` olur. Admin kendi hesabını pasife alamaz: 409 `Admin cannot deactivate their own account`.

`passwordHash` ve oturum dönmez.

### Agent applications

```text
GET  /admin/agent-applications
GET  /admin/agent-applications/:id
GET  /admin/agent-applications/:id/documents
GET  /admin/agent-applications/:id/documents/:documentId
POST /admin/agent-applications/:id/approve
POST /admin/agent-applications/:id/reject
```

Liste query'si `status`, `page`, `limit`. Liste öğesi başvuru özeti ve `user: { id, email, role, isActive }` taşır.

Detay, sahip başvurusunun alanlarına `userId`, `reviewedById` ve `user` ekler.

Onay gövdesizdir ve 200 döner:

```json
{
  "application": {
    "id": "...",
    "status": "APPROVED",
    "userId": "...",
    "reviewedById": "...",
    "reviewedAt": "2026-10-23T08:00:00.000Z",
    "companyName": "Örnek Emlak"
  },
  "profile": {
    "id": "...",
    "userId": "...",
    "slug": "ornek-emlak",
    "companyName": "Örnek Emlak",
    "isActive": true
  },
  "user": { "id": "...", "role": "AGENT" }
}
```

Red gövdesi `{ "reason": "..." }` olur. `reason` trim edilir, 3–500 karakterdir. Yanıt `id`, `status`, `userId`, `companyName`, `rejectionReason`, `reviewedById`, `reviewedAt` taşır.

### Agents

```text
GET   /admin/agents
GET   /admin/agents/:id
PATCH /admin/agents/:id/status
```

Liste query'si `isActive` (`"true"` / `"false"`), `companyName`, `city`, `district`, `page`, `limit`. Metin filtreleri içerir ve harf duyarsızdır. Bu şehir ve ilçe profil metnidir.

Liste öğesi `id`, `slug`, `companyName`, `city`, `district`, `isActive`, `createdAt` ve `user: { id, email, role, isActive }` taşır.

Detay `AgentProfile` artı `userId` ve `user` (`AdminUser`) olur.

Durum `{ "isActive": false }` ile `AgentProfile.isActive` değiştirir. `User.isActive` ayrıdır. Hesap aktif ve profil pasifse kullanıcı giriş yapar, public profil ve public ilanlar görünmez. Yanıt `{ "id", "isActive" }` olur.

### Properties

```text
GET    /admin/properties
GET    /admin/properties/:id
PATCH  /admin/properties/:id/deactivate
DELETE /admin/properties/:id/images/:imageId
DELETE /admin/properties/:id
```

Liste query'si `status`, `listingType`, `city` (adın tam eşleşmesi), `deleted` (`"true"` / `"false"`, varsayılan silinmemişler), `page`, `limit`.

Liste öğesi `PropertyRecord` artı kısa `agent` taşır: `id`, `slug`, `companyName`, `isActive`, `user: { id, role, isActive }`.

Detay `agent` daha geniştir (`phone`, `email`, `city`, `district`, `user.email` eklenir) ve silinmemiş canlı fotoğrafları `sortOrder` sırasında `images: PropertyImage[]` olarak taşır.

Pasife alma ve silme `{ "reason" }` ister. Pasife alma `PropertyRecord` döner. Silme `{ "id", "deletedAt" }` döner. Fotoğraf silme `{ "id" }` döner.

### Documents

Admin belge liste ve indirme route'ları başvuru grubundadır. Ayrı bir `/admin/files` route'u yoktur.

### Audit

```text
GET /admin/audit-logs
```

Query: `entityType`, `entityId`, `page`, `limit`. Yanıt `AuditLog` sayfasıdır. Kayıtlar güncellenemez ve silinemez. Bu fazda yazma endpoint'i yoktur.

# 13. API client önerisi

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '');

await fetch(`${API_URL}/properties`, {
  credentials: 'include',
});

await fetch(`${API_URL}/users/me`, {
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

JSON gövdeli istek `Content-Type: application/json` kullanır. `FormData` isteği bu başlığı elle koymaz.

# 14. Token refresh önerisi

```text
korumalı istek → 401
↓
bu istek zaten /auth/refresh değilse bir kez POST /auth/refresh
↓
yeni accessToken
↓
orijinal isteği bir kez tekrarla
```

Refresh de 401 dönerse döngüye girilmez. Access token bellekten silinir ve kullanıcı logged-out kabul edilir. Aynı anda birden fazla 401, tek bir refresh çağrısını beklemelidir.

# 15. Route mapping önerisi

Bu path'ler backend route'u değildir.

```text
Frontend                          Backend

/                                 GET /properties
/ilan/:id                         GET /properties/:id
/emlakci/:slug                    GET /agents/:slug
                                  GET /agents/:slug/properties
/favoriler                        GET /favorites
/giris                            POST /auth/login
/kayit                            POST /auth/register
/emlakci-basvuru                  /agent-applications...
/panel/ilanlar                    /properties/me ve ilan yönetim API'leri
/admin/...                        /admin/...
```

# 16. SEO notları

SEO üreten bir backend endpoint'i yoktur.

İlan detayından metadata için kullanılabilecek alanlar:

```text
title
description
price
city
district
coverImageUrl
```

Emlakçı profilinden:

```text
companyName
description
logoUrl
city
district
```

Bunlar Next.js `generateMetadata` içinde kullanılabilir. Canonical URL frontend'in sorumluluğundadır. Backend slug'ı yalnız emlakçı profilinde vardır. İlanın public slug'ı yoktur. İlan URL'si ilan `id` değeriyle kurulur.
