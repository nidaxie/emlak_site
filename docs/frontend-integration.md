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
- Logout refresh oturumunu kapatır ve cookie'yi siler. Frontend elindeki access token'ı da bellekten atmalıdır. Logout `tokenVersion` artırmaz; eski access token süre dolana kadar imza olarak geçerli kalabilir. Pasife alma `User.tokenVersion` değerini bir artırır. Access token bu değeri `ver` claim'i ile taşır. Claim yoksa guard onu 0 kabul eder. Yeniden aktif etme sürümü geri almaz, bu yüzden pasife almadan önceki access ve refresh tokenlar 401 kalır.
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

Kendi emlakçı profilini, logosunu ve ilanlarını yönetir. Fotoğraf yükler. Favori de kullanabilir. Başvuru oluşturma endpoint'i 403 döner. Profesyonel yazma işlemleri `AGENT` rolü, mevcut profil ve `AgentProfile.isActive = true` ister. Profil yoksa 403 `Agent profile not found` döner. Profil askıdaysa profil güncelleme, logo, ilan oluşturma, güncelleme, durum, silme ve fotoğraf mutation'ları 403 `Agent profile is inactive` döner. `GET /agents/me` ve kendi ilan listesi bu durumda açık kalır. Başka emlakçının ilanı 404 `Property not found` döner.

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
DRAFT | PENDING | APPROVED | REJECTED

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

`PropertyCard`, public liste, emlakçı ilan listesi ve favori listesinde aynıdır. Liste öğesinde `images` ve `sellerDisplayName` yoktur. `sellerType` `AGENT` veya `INDIVIDUAL` olur. `sellerName`, kartta gösterilecek güvenli addır: emlakçı ilanında firma adı, bireysel ilanda `Bireysel`. AGENT kartında `agent` yalnız `slug` ve `companyName` taşır. INDIVIDUAL kartında `agent` `null` olur. Kişisel ad, e-posta ve telefon liste kartına yazılmaz.

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
  "sellerType": "AGENT",
  "sellerName": "Örnek Emlak",
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

Görünen ilanlar `ACTIVE` ve silinmemiş olmalıdır. AGENT ilanında profil ve hesap aktiftir. INDIVIDUAL ilanında sahip hesabı (`User.isActive`) aktiftir. Pasif hesap bireysel ilanı public listeden ve detaydan gizler.

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

Liste kartının bütün alanlarını döner. Ek olarak `images`, `sellerDisplayName` ve daha geniş `agent` vardır. `images` `sortOrder` sırasındadır. Silinmiş fotoğraf gelmez. AGENT detayında `sellerDisplayName` firma adıdır ve `agent` `slug`, `companyName`, `phone`, `logoUrl` taşır. INDIVIDUAL detayında `sellerType` `INDIVIDUAL`, `sellerDisplayName` `Bireysel İlan Sahibi` ve `agent` `null` olur. Bireysel ilanda e-posta, telefon ve profil verisi yoktur.

`INDIVIDUAL_CONTACT_PUBLICATION = NOT_IMPLEMENTED`

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
  "sellerDisplayName": "Örnek Emlak",
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

Vergi numarası, açık adres, belge ve `isActive` bu yanıtta yoktur. İlanlar gömülü değildir. Slug yoksa, profil pasifse veya bağlı kullanıcı hesabı pasifse 404 `Agent profile not found` döner (`AgentProfile.isActive = true` ve `User.isActive = true` birlikte gereklidir).

`city` ve `district` burada serbest metindir. Lokasyon tablosunun ID'si değildir.

## 4.7 Emlakçı ilanları

`GET /agents/:slug/properties`

Filtre, sıralama, sayfalama ve kart `GET /properties` ile aynıdır. Aynı `PropertyCard` kullanılır. Slug, emlakçıyı seçer. Sonuç yalnız o profilin public ilanlarıdır. Pasif, satılmış, kiralanmış ve silinmiş ilan gelmez. Bilinmeyen, askıdaki veya sahip hesabı pasif olan emlakçı slug'ı 404 döner.

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
| `POST /agent-applications`                         | `USER`      | 201, `DRAFT`, `submittedAt: null`                                |
| `GET /agent-applications/me`                       | Aktif hesap | Güncel başvuruyu döner. Yoksa 404                                |
| `PATCH /agent-applications/me`                     | Aktif hesap | Yalnız `DRAFT`. Değilse 409 `Application is not a draft`         |
| `POST /agent-applications/me/submit`               | `USER`      | Yalnız `DRAFT`. 200 ile `PENDING` ve `submittedAt`               |
| `POST /agent-applications/me/revise`               | `USER`      | Yalnız `REJECTED`. 200 ile aynı kayıt `DRAFT`                    |
| `POST /agent-applications/me/documents`            | `USER`      | `DRAFT` iken ekler veya aynı tipi değiştirir                     |
| `GET /agent-applications/me/documents`             | Aktif hesap | Güncel başvurunun belge dizisi                                   |
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

`POST /agent-applications` başvuruyu `DRAFT` açar. `submittedAt` bu aşamada `null` olur. İncelemeye gönderme `POST /agent-applications/me/submit` ile yapılır. Submit, kayıt `DRAFT` iken ve silinmemiş `TAX_CERTIFICATE` ile `AUTHORIZATION_CERTIFICATE` birlikte varken `PENDING` yazar ve `submittedAt` doldurur. Eski `rejectionReason`, `reviewedById` ve `reviewedAt` bu geçişte temizlenir. Belge eksiği 409 `Required documents are missing` döner ve kayıt `DRAFT` kalır.

Güncelleme ve belge yükleme yalnız `DRAFT` kayda uygulanır. `PENDING` kayıt 409 `Application is not a draft` döner. Belge silme endpointi yoktur; aynı `documentType` yeniden yüklenince belge değişir.

`GET /agent-applications/me` güncel kaydı seçer. Sıra, `createdAt` azalan, eşitse `id` azalandır. Önce `PENDING`, yoksa `DRAFT`, ikisi de yoksa en yeni kayıt döner. Kayıt yoksa 404.

Aynı kullanıcıda açık bir `DRAFT` veya `PENDING` varken yeni başvuru 409 döner. `REJECTED` kayıt varken `POST /agent-applications` yeni satır açmaz; 409 `Rejected application can be revised` döner. `POST /agent-applications/me/revise` aynı satırı `DRAFT` yapar, `submittedAt` ve inceleme alanlarını temizler, belgeleri bırakır.

Onay için de `TAX_CERTIFICATE` ve `AUTHORIZATION_CERTIFICATE` birlikte olmalıdır. Eksikte admin onayı 409 `Required documents are missing` döner.

Kendi başvuru yanıtında `userId` ve `reviewedById` yoktur. `description`, `rejectionReason` ve `submittedAt` `null` olabilir. `reviewedAt` incelemeden önce `null` olur.

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

Slug, vergi numarası, şehir, ilçe ve `isActive` bu endpoint ile değişmez. Boş gövde 400 `No fields to update` döner. Profil askıdaysa `PATCH` 403 `Agent profile is inactive` döner. Profil yoksa 403 `Agent profile not found` döner. `GET /agents/me` askıdaki profili 200 ile döndürür ve `isActive: false` görünür. Bu sahip yanıtındaki `logoUrl`, logo varsa `/api/v1/agents/me/files/<uuid>` olur. Public profil ve logo yükleme yanıtı `/api/v1/files/<uuid>` olarak kalır.

Logo `multipart` alan adı `file` dir. Yükleme yanıtı `{ "logoUrl": "/api/v1/files/..." }` olur. Profil askıdaysa logo yükleme 403 `Agent profile is inactive` döner.

`GET /agents/me/files/:fileId` yalnız oturumdaki emlakçının mevcut logosunu okur. Askıdaki profil de bu salt okuma yolunu kullanır. Başka hesap, eski logo ve silinmiş dosya 404 `File not found` döner. `USER` 403, oturumsuz istek 401 alır. Yanıt `Cache-Control: private, no-store` taşır. Public `/files/:id` kuralı değişmez: askıdaki logo orada 404 kalır.

# 8. Property management

Gerçek route'lar:

```text
POST   /properties
GET    /properties/me
GET    /properties/me/files/:fileId
GET    /properties/me/:id
PATCH  /properties/:id
PATCH  /properties/:id/status
DELETE /properties/:id
```

Hepsi `AGENT` ve Bearer ister. Yazma işlemleri ayrıca aktif `AgentProfile` ister. Askıdaki profilde `GET /properties/me` ve `GET /properties/me/:id` çalışır; oluşturma, güncelleme, durum, silme ve fotoğraf mutation'ları 403 `Agent profile is inactive` döner. Başka emlakçının ilanı 404 `Property not found` döner. İlan `sellerType = AGENT`, `ownerUserId = null` ve oturumdaki profil kimliğiyle yazılır. Gövdede gelen `agentProfileId` kullanılmaz.

`GET /properties/me` query'si `status`, `page` ve `limit` dir. `sort` yoktur. Silinmiş ilanlar gelmez. Yanıt `AgentPropertyListItem` sayfasıdır: `PropertyRecord` alanları artı `coverImageUrl`. `isFavorite` yoktur. `coverImageUrl` canlı kapak görselinin sahip dosya path'idir: `/api/v1/properties/me/files/<uuid>`. Kapak, silinmemiş `isCover = true` görseldir; kapak yoksa en düşük `sortOrder` değerine sahip canlı görsel kullanılır. Canlı görsel yoksa değer `null` olur. Galeri dönmez. `sellerType` `AGENT` olur. `agentProfileId`, `updatedAt` ve `deletedAt` vardır. Bu endpoint yalnız AGENT ilanlarını döner. Bireysel ilan ID'si verildiğinde 404 `Property not found` döner.

`GET /properties/me/files/:fileId` JSON değildir. `Content-Type` dosyanın MIME tipidir. `Content-Disposition` inline'dır. `Cache-Control: private, no-store`. Yalnız oturumdaki emlakçının kendi ilanındaki silinmemiş görseli döner. İlan `INACTIVE`, `SOLD` veya `RENTED` olsa da ve profil askıda olsa da sahip okuyabilir. Başka emlakçının dosyası, silinmiş görsel ve silinmiş ilan 404 `File not found` döner. `USER` 403 alır. Oturum yoksa 401 döner. Public `GET /files/:id` bu kuralla genişlemez.

`GET /properties/me/:id` yanıtı `OwnerPropertyDetail` (`PropertyRecord` + `sortOrder` sırasındaki canlı `images: PropertyImage[]`) döner. Silinmiş fotoğraflar dahil edilmez. `images[].url` public `/api/v1/files/<uuid>` path'i olarak kalır. Düzenleme formu bu kimliği `GET /properties/me/files/:fileId` ile, Bearer blob olarak gösterir. Public dosya sözleşmesi değişmez.

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

Zorunlu alanlar: `title` (5–160), `description` (20–5000), `listingType`, `propertyType`, `price`, `grossAreaM2`, `rooms` (0–50), `livingRooms` (0–20), üç lokasyon ID'si, `address` (5–300). `latitude` ve `longitude` opsiyoneldir; gönderilmezse kolonlar boş kalır ve silinmez. `propertyType` `LAND` olduğunda istemci `rooms` ve `livingRooms` göndermek zorundadır; API bu iki alanı `0` yazar, `floor`, `totalFloors` ve `heatingType` boş kalır, `hasElevator` `false` olur. Aynı kural güncellemede de geçerlidir. Bireysel ve emlakçı formları arsa seçilince bu alanları gizler.

Opsiyonel: `netAreaM2`, `buildingAge` (0–300), `floor` (-5–200), `totalFloors` (1–200), `heatingType`, beş boolean özellik. Boolean'lar gönderilmezse `false` olur. Net alan brüt alandan büyük olamaz. `floor`, `totalFloors` değerinden büyük olamaz.

Güncelleme aynı alanların bir alt kümesidir. Hiç alan yoksa 400 `No fields to update` döner. Lokasyon üçlüsü birlikte gider.

## 8.2 Property status

`PATCH /properties/:id/status`

```json
{ "status": "INACTIVE" }
```

Geçerli geçişler bölüm 3.9'daki listedir. Geçersiz geçiş 409 `Invalid status transition` döner. Yanıt güncel `PropertyRecord` olur.

## 8.3 Bireysel ilan yönetimi

Bu endpointler yalnız `USER` rolüne açıktır. Oturum yoksa 401 döner. `AGENT` ve `ADMIN` 403 `Forbidden` döner. Başka kullanıcının ilanı, silinmiş ilan ve AGENT ilanı 404 `Property not found` döner. 403 ile sahiplik sızdırılmaz.

```text
POST   /user-properties
GET    /user-properties/me
GET    /user-properties/me/files/:fileId
GET    /user-properties/me/:id
PATCH  /user-properties/:id
PATCH  /user-properties/:id/status
DELETE /user-properties/:id
```

`POST` gövdesi `CreatePropertyRequest` ile aynıdır. `sellerType`, `ownerUserId`, `agentProfileId`, `status`, `currency`, `createdAt`, `updatedAt` ve `deletedAt` gönderilirse 400 döner. Sunucu ilanı `sellerType = INDIVIDUAL`, `ownerUserId = current user`, `agentProfileId = null`, `status = ACTIVE`, `currency = TRY` olarak yazar. Yanıt `UserPropertyRecord` olur. `ownerUserId` yanıtta yoktur.

`GET /user-properties/me` aynı `page` / `limit` sözleşmesini kullanır: `{ items, page, limit, total }`. Yalnız current user'ın silinmemiş INDIVIDUAL ilanları gelir. Her öğede `coverImageUrl` vardır. Canlı kapak yoksa değer `null` olur. Dolu değer `/api/v1/user-properties/me/files/<uuid>` path'idir.

`GET /user-properties/me/files/:fileId` sahip dosya akışıdır. `Cache-Control: private, no-store`. Pasif bireysel ilanın görseli sahibi için okunur. Başka kullanıcının dosyası 404 `File not found` döner. `AGENT` 403 alır. Oturum yoksa 401 döner. Public `GET /files/:id` pasif ilanı açmaz. Bireysel düzenleme formu `images[].url` içindeki dosya kimliğini bu sahip path'ine çevirir; public path sözleşmesi aynı kalır.

`GET /user-properties/me/:id` `UserPropertyDetail` döner. `cityId`, `districtId`, `neighborhoodId` ve canlı `images` (`id`, `url`, `sortOrder`, `isCover`, `sortOrder` artan) vardır. Silinmiş fotoğraf gelmez.

`PATCH /user-properties/:id` `UpdatePropertyRequest` kullanır. Sahiplik, durum, para birimi ve `deletedAt` bu gövdeden değişmez. Durum ayrı endpointtir.

`PATCH /user-properties/:id/status` yalnız `ACTIVE` ve `INACTIVE` kabul eder. Başka durum 400 döner. İzinli geçişler `ACTIVE ↔ INACTIVE` dir. Aynı duruma geçiş 409 `Invalid status transition` döner. `SOLD` ve `RENTED` bu fazda USER lifecycle'ında yoktur.

`DELETE` soft delete yapar ve `{ "id", "deletedAt" }` döner. Sonrasında owner detail ve public detail 404 olur.

Fotoğraflar:

```text
POST   /user-properties/:id/images
PATCH  /user-properties/:id/images/order
PATCH  /user-properties/:id/images/:imageId/cover
DELETE /user-properties/:id/images/:imageId
```

Kurallar agent fotoğraf endpointleriyle aynıdır: JPEG, PNG, WebP, 10 MB, magic byte, en fazla 20, ilk fotoğraf kapak, kapak invariantı, soft delete ve disk temizliği. Dosya yolu `/api/v1/files/:id` olarak kalır. Başka kullanıcının fotoğrafı 404 döner.

Lokasyon alanları UUID'dir. Şehir, ilçe ve mahalle hiyerarşisi agent create/update ile aynı kontrolden geçer. Decimal alanlar string kalır.

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
| Emlakçı logosu | `POST /agents/me/logo`                  | `file`                                             | jpeg, png, webp | 5 MB     | Public dosya; sahip okuması `/agents/me/files/:fileId` |
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
owner property image
owner agent logo
```

Sahip logo: `GET /agents/me/files/:fileId`. Yalnız oturumdaki profilin mevcut logosu. Askı okumayı kapatmaz. Başka hesap 404.

Admin logo: `GET /admin/agents/:id/files/:fileId`. Yalnız aktif `ADMIN` ve profilin güncel `logoFileId` değeri. Askı veya pasif kullanıcı erişimi kapatmaz; `Cache-Control: private, no-store`, başka profil/belge/ilan görseli/eski veya silinmiş dosya 404 döner. Public `/files/:id` askıda ve pasif kullanıcıda 404 kalır.

Sahip ilan görseli: `GET /properties/me/files/:fileId` ve `GET /user-properties/me/files/:fileId`.

Sahip: `GET /agent-applications/me/documents/:documentId`

Admin: `GET /admin/agent-applications/:id/documents/:documentId`

İkisi de attachment akışıdır. `Cache-Control: private, no-store`. Public `/files/:id` bu belgeleri açmaz.

# 12. Admin backend contract

Hepsi Bearer ve `ADMIN` ister. `USER` ve `ADMIN` dışındaki roller 403 alır.

### Users

```text
GET   /admin/users
GET   /admin/users/summary
GET   /admin/users/:id
PATCH /admin/users/:id/status
```

Liste query'si `role`, `isActive` (`"true"` veya `"false"` string), `email`, `createdFrom`, `createdTo`, `page`, `limit`. `email` parametresi geriye uyumludur ve artık e-posta, ad, soyad ve iki parçalı ad-soyad aramasıdır. `contains` + `mode: insensitive` kullanılır. Boşluklar kırpılır. İki ve daha fazla kelimede ilk kelime ad, kalanı soyad olarak ve tersi de aranır. Bu PostgreSQL ortamında `İpek` araması `ipek` ile eşleşir. Noktasız `ı` için ayrı bir katlama iddiası yoktur.

`createdFrom` ve `createdTo` dahil sınırlardır. `YYYY-MM-DD` UTC günüdür: başlangıç `00:00:00.000Z`, bitiş `23:59:59.999Z`. Saatli değer `Z` veya `±HH:MM` taşımalıdır ve tam an olarak dahil edilir. Türkiye yerel günü için ofsetli an gönderilir, yalnız tarih gönderilmez. Geçersiz tarih ve `createdFrom > createdTo` 400 döner. Sıralama `createdAt DESC, id DESC`. `limit` en fazla 100. `total` aynı filtreden hesaplanır.

Liste öğesi `AdminUserListItem` tipidir. `individualListingCount` silinmemiş bireysel ilanları, `agentListingCount` profildeki silinmemiş emlakçı ilanlarını sayar. Profil yoksa ikincisi 0 ve `agentProfile` null olur. Pasif hesap sayacı değiştirmez. Public sayı bu alanlarda yoktur.

Detay hesap alanlarına `updatedAt` ekler. `agentProfile` `id`, `slug`, `companyName`, `isActive`, `city`, `district` taşır ve `User.isActive` ile ayrıdır. `individualListings` her zaman vardır. `agentListings` profil yoksa null olur. Sayaçlar `total`, `active`, `inactive`, `sold`, `rented`, `publiclyVisible` şeklindedir. `publiclyVisible` mevcut public ilan kuralıdır; `active` kayıtlı `ACTIVE` sayısıdır. `applications` son 20 kaydı ve `total` döner. Belge içeriği yoktur. Tam başvuru listesi `GET /admin/agent-applications?userId=` ile alınır. Bireysel ilanlar `GET /admin/properties?ownerUserId=`, emlakçı ilanları `GET /admin/properties?agentUserId=` ile alınır. İkisi birlikte verilirse koşullar AND olur. `managementEvents` hedefi `USER` ve bu kullanıcı olan son 10 audit kaydıdır. Tam sayfa `GET /admin/audit-logs?entityType=USER&entityId=` olur.

Durum gövdesi `{ "isActive": false }` olur. Yanıt `{ "id", "isActive" }` olur. Aynı durum yeniden gönderilirse audit yazılmaz, oturumlar değişmez ve `tokenVersion` artmaz. Gerçek pasife alma, aynı transaction içinde `tokenVersion` değerini bir artırır ve açık refresh oturumlarını `revokedAt` ile kapatır. Yeniden açılış eski refresh oturumunu ve eski access token'ı geri getirmez. Yeni login güncel sürümü taşıyan access token ve yeni refresh oturumu üretir. Admin kendi hesabını pasife alamaz: 409 `Admin cannot deactivate their own account`. Son aktif admin koruması transaction advisory lock içindedir. İkinci taraf beklerken pasife alınmışsa 403 `Forbidden` döner. Aktif admin kalmayacaksa 409 `At least one active admin must remain` döner. Rol, ilan status, `AgentProfile.isActive` ve başvuru durumu değişmez. Profil askıya alma ve başvuru onayı `tokenVersion` değiştirmez.

`passwordHash`, token ve session hash dönmez.

`GET /admin/users/summary` kullanıcı ekranının nüfus kartları ve kayıt grafiği içindir. Platform dashboard özeti değildir. Query yoksa `registrations` null döner; bu boş veri 200'dür, hata değildir.

Nüfus alanları tarih aralığından etkilenmez: `total`, `active`, `inactive` ve `roles.USER`, `roles.AGENT`, `roles.ADMIN`. Her rol `{ total, active, inactive }` taşır. Kayıt yoksa değer 0'dır. Bu sayılar `groupBy` sonucudur; `items.length` kullanılmaz.

Kayıt serisi için `createdFrom`, `createdTo` ve `bucket` (`day` veya `month`) birlikte zorunludur. Biri eksikse veya aralık tersse 400 döner. `day` en fazla 366 kova, `month` en fazla 36 kova kabul eder; aşım 400'dür. `registrations.total` aralıktaki kayıt sayısıdır. `points[].bucketStart` UTC kova başlangıcıdır. `points[].count` o kovada ve istenen an aralığında açılan hesaplardır. Aralıktaki boş gün veya ay `count: 0` ile döner; bu uydurma değer değil, gerçek boş kovadır. İlk ve son ay kovası, ayın tümü istenmemişse yalnız aralığın içini sayar.

Tek bir aralığın kayıt sayısı grafik olmadan da `GET /admin/users?createdFrom=&createdTo=&limit=1` yanıtındaki `total` alanıdır. Yine `items.length` değildir.

Kullanıcı kartındaki ilan dağılımı detaydaki `individualListings` ve `agentListings` alanlarıdır. Başvuru grafiği `applications`, işlem geçmişi `managementEvents` alanıdır. İlan, başvuru ve emlakçı platform özeti FAZ 3.7 kapsamındadır.

Kullanıcı ekranı `/admin/kullanicilar` ve `/admin/kullanicilar/:id` bu sözleşmeyi kullanır. Nüfus kartları ve rol grafikleri parametresiz summary çağrısıdır. Kayıt grafiği ayrı bir summary çağrısıdır; varsayılan son 30 UTC günü ve `bucket=day` olur. Son 7, 30 ve 90 gün `day`, son 12 ay `month` gönderir. Tarih alanındaki `YYYY-MM-DD` değeri UTC gün olarak gönderilir ve grafik etiketleri `timeZone: 'UTC'` ile basılır. Türkiye yerel günü gibi etiketlenmez. Liste filtreleri grafik aralığından bağımsızdır ve `email` parametresiyle ad, soyad veya e-posta arar. Liste `total` filtrelenmiş sonuçtur, nüfus kartı değildir.

Pasife alma ve yeniden aktif etme detay ekranındaki dialog ile yapılır. Başarıda `admin-users`, `admin-user`, `admin-user-summary`, emlakçı, ilan ve audit sorguları yenilenir. Tüm cache silinmez. Çıkış mevcut `queryClient.clear()` davranışını korur. `ACTIVE` ilan durumu ile `publiclyVisible` ayrı gösterilir. `publiclyVisible` donut dilimi değildir.

Ortak kullanıcı görselleri `apps/web/src/components/admin` altındadır: metrik kart, donut, yatay bar, kayıt sütun grafiği, baş harf avatarı. Recharts zaten bağımlılıktı; ikinci grafik kütüphanesi eklenmedi.

### Agent applications

```text
GET  /admin/agent-applications
GET  /admin/agent-applications/summary
GET  /admin/agent-applications/:id
GET  /admin/agent-applications/:id/documents
GET  /admin/agent-applications/:id/documents/:documentId
POST /admin/agent-applications/:id/approve
POST /admin/agent-applications/:id/reject
```

`summary` route'u `/:id` önündedir. Onay ve ret gövdesi değişmedi. Lifecycle değişmedi: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`. Yeni ara durum yoktur.

Liste query'si `search`, `status`, `city`, `district`, `userId`, `createdFrom`, `createdTo`, `page`, `limit`. `status` yoksa backend durum filtresi uygulamaz; `DRAFT` dahil bütün kayıtlar döner. İnceleme kuyruğu ekranı ayrıca `status=PENDING` ister. `search` trim edilir ve firma adı, başvuran ad/soyad (iki yön), hesap e-postası, başvuru iletişim e-postası ve vergi numarasında büyük/küçük harf duyarsız arar. Hesap e-postası `user.email`, iletişim e-postası başvuru `email` alanıdır. `city` ve `district` serbest metindir; ilişki id'si yoktur ve eşitlik duyarsızdır. `createdFrom` / `createdTo` başvurunun `createdAt` alanıdır, `submittedAt` değildir. `YYYY-MM-DD` UTC günüdür, sınırlar dahildir. Ters veya geçersiz tarih 400'dür. Filtreler AND birleşir. `total` aynı koşullardan gelir. Limit en fazla 100'dür.

Sıralama, `status=PENDING` iken `submittedAt` azalan, sonra `id` azalandır. Böylece revise edilip yeniden gönderilen başvuru kuyrukta yeni gönderim zamanına göre durur. Diğer listeler `createdAt` azalan, `id` azalandır. `submittedAt` null olan bekleyen satır sonda kalır.

Liste öğesi firma, başvuru telefonu ve iletişim e-postası, şehir, ilçe, `createdAt`, `submittedAt`, `reviewedAt`, başvuran `user` özeti (`id`, `firstName`, `lastName`, `email`, `role`, `isActive`), `reviewedBy` (`id`, `firstName`, `lastName` veya null) ve `documentCompletion` taşır. Vergi numarası, adres ve açıklama listeye konmaz. Şifre ve oturum alanları yoktur.

`documentCompletion` zorunlu türleri sayar: `TAX_CERTIFICATE` ve `AUTHORIZATION_CERTIFICATE`. `requiredCount` 2'dir. `completedCount` silinmemiş dosyası olan benzersiz zorunlu tür sayısıdır; aynı türün ikinci yüklemesi sayıyı artırmaz. `missingTypes` eksik türlerdir. `isComplete`, mevcut submit ve onay belge koşuluyla aynıdır. Belge doğrulama durumu tutulmadığı için `verified` alanı yoktur.

Detay, mevcut başvuru alanlarına `userId`, `reviewedById`, `user`, `documentCompletion`, `reviewedBy` ve `agentProfile` ekler. `agentProfile` yalnız `APPROVED` başvuruda ve kullanıcının gerçek profili varsa `{ id, slug, companyName, isActive }` döner. Diğer durumlarda null'dur. Eski başvuruya mevcut profil otomatik bağlanmaz. Revise, `submittedAt`, `reviewedAt`, `reviewedById` ve ret gerekçesini temizler; detaydaki `reviewedBy` o zaman null olur.

```json
GET /admin/agent-applications/summary
```

Parametresiz çağrı bütün başvuruların güncel durum dağılımını verir. Zaman serisi istenmezse `created` null'dur; bu hata değildir.

```json
{
  "total": 0,
  "statuses": { "DRAFT": 0, "PENDING": 0, "APPROVED": 0, "REJECTED": 0 },
  "oldestPending": null,
  "created": null
}
```

`total`, dört durumun toplamıdır. Sayaçlar kayıtlı satırların güncel durumudur. Aynı satırın yeniden gönderilmesi toplamı artırmaz. Onay sayısı aktif emlakçı sayısı değildir. `oldestPending`, `submittedAt` değeri olan en eski `PENDING` başvurudur: `id`, `submittedAt`, `waitingMs`. Geçmiş ortalama inceleme süresi veya SLA üretilmez. Revise sonrası yeni `submittedAt` bekleme süresinin başlangıcıdır.

`createdFrom`, `createdTo` ve `bucket` (`day` veya `month`) birlikte zorunludur. Biri eksikse, aralık tersse veya geçersizse 400 döner. `day` en fazla 366, `month` en fazla 36 kova. Aşım 400'dür. Seri `createdAt` üzerinden yeni oluşturulan başvuru satırlarıdır; incelemeye gönderme denemesi değildir. `created.points[].bucketStart` UTC kova başlangıcıdır. Boş gün ve ay gerçek `count: 0` döner. Aralık, `statuses` sayaçlarını filtrelemez.

Görsel süreç için mevcut alanlar yeterlidir: `createdAt`, `submittedAt`, `reviewedAt`, `status`, `rejectionReason`. İncelemeye başlanma tarihi yoktur ve üretilmez. Onay/ret audit kaydı `AGENT_APPLICATION` ve başvuru id'sidir. Belge audit'i `AGENT_APPLICATION_DOCUMENT` ve belge id'sidir; başvuru detayına audit listesi eklenmez.

Admin ekranları `/admin/basvurular` ve `/admin/basvurular/:id` üzerindedir. Açılışta status yoksa ve `userId` yoksa liste `PENDING` ister. `userId` varken status yoksa veya `status=ALL` ise durum filtresi gönderilmez. Kullanıcı detayındaki Tüm başvurular bağlantısı `?userId=&status=ALL` taşır. Arama `search` parametresine 400 ms sonra yazılır. Şehir ve ilçe serbest metindir. Liste tarihi `createdFrom` / `createdTo` ile `createdAt` günüdür. Sayaçlar ve durum dağılımı parametresiz summary'den gelir. "Yeni Oluşturulan Başvurular" grafiği `created` serisidir; varsayılan son 30 UTC günüdür ve liste filtresinden bağımsızdır. Belge görüntüleme ve indirme authenticated blob ister; public `/files/:id` ve token query kullanılmaz. Onay ve ret yalnız PENDING detayında dialog ile açılır. 409 sonrası başarı mesajı gösterilmez ve detay yeniden alınır. Karar sonrası başvuru listesi, summary, kullanıcı listesi ve summary, kullanıcı detayı, emlakçı listesi ve audit sorguları geçersiz kılınır. Başvuru oluşturulma serisi karar yüzünden yeni nokta üretmez.

Belge indirme `private, no-store` olarak durur. Başvuru belgesi public dosya yoluna açılmaz.

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

Onay ve ret, transaction içinde başvuru satırını kilitler. Yazma yalnız `status = PENDING` satıra uygulanır. İkinci karar 409 `Application is no longer pending` döner ve ilk karar kalır.

Red gövdesi `{ "reason": "..." }` olur. `reason` trim edilir, 3–500 karakterdir. Boş ve yalnız boşluk değerler kabul edilmez. Yanıt `id`, `status`, `userId`, `companyName`, `rejectionReason`, `reviewedById`, `reviewedAt` taşır. Audit kaydı `AGENT_APPLICATION_REJECTED` ve metadata `{ "reason": "..." }` olur. Onay audit kaydı `AGENT_APPLICATION_APPROVED` olur; metadata boştur.

### Agents

```text
GET   /admin/agents
GET   /admin/agents/summary
GET   /admin/agents/:id
GET   /admin/agents/:id/files/:fileId
PATCH /admin/agents/:id/status
```

`summary`, `/:id` rotasından önce kayıtlıdır. Yalnız aktif `ADMIN` kullanır. Pasif admin 401 döner. `USER`, `AGENT` ve askıdaki `AGENT` 403 döner.

Liste query'si `search`, `isActive`, `userIsActive`, `companyName`, `city`, `district`, `userId`, `createdFrom`, `createdTo`, `page`, `limit`. `isActive` profil durumudur. `userIsActive` hesap durumudur. İkisi ayrı parametredir ve birlikte AND olur. `search` trim edilir, ardışık boşluklar tek boşluğa indirilir, boşsa yok sayılır. Firma adı, firma e-postası, vergi numarası, firma telefonu, hesap e-postası, hesap telefonu, ad, soyad ve çok kelimeli terimlerde sınırlandırılmış bölme noktalarıyla (`splitLimit = 5`, en fazla 4 bölme) iki yönlü ad soyad aranır. Başvurudaki yetkili adları aranmaz. Metin eşleşmesi Prisma `insensitive` üzerinden PostgreSQL `ILIKE` kullanır. Bu veritabanında `i` ile `İ` eşleşir. Ayrı bir Türkçe dönüştürme tablosu yoktur. `companyName`, `city` ve `district` profil metninde içerir aramasıdır; lokasyon FK'si değildir. `createdFrom` ve `createdTo` `AgentProfile.createdAt` üzerindedir, UTC günü dahilidir ve kullanıcının kayıt tarihi değildir. Saatli değer `Z` veya offset taşır. Geçersiz tarih, ters aralık, `limit > 100` ve geçersiz `userId` 400 döner. Sıra `createdAt DESC`, `id DESC` olarak durur. Sayfalama `{ items, page, limit, total }` şeklindedir. `total` aynı filtreyle hesaplanır.

Liste öğesi `id`, `slug`, `companyName`, `phone`, `email`, `city`, `district`, `isActive`, `createdAt`, `user` (`id`, `firstName`, `lastName`, `email`, `role`, `isActive`), `logo` ve `listingSummary` taşır. `phone` ve `email` firma iletişimidir. Vergi numarası, `passwordHash` ve `tokenVersion` listede yoktur. `logo` yoksa `null`, varsa `{ fileId, url }` olur. `url` `/api/v1/admin/agents/:id/files/:fileId` yoludur. `listingSummary` `total`, `active`, `inactive`, `sold`, `rented`, `publiclyVisible` alanlarıdır. `total`, dört durumun toplamıdır. `publiclyVisible` durum değildir; mevcut `publicPropertyWhere` ile yalnız o profilin profesyonel ilanlarını sayar. Soft-delete ve bireysel ilanlar portföye girmez. Sayfadaki profiller iki toplu `groupBy` ile sayılır; her profil için ayrı count açılmaz. `pg` havuzu üzerinden ölçülen SQL sorgu sayısı `listForAdmin` için sayfa boyutundan bağımsız sabit 5 sorgudur (`limit=1` ve `limit=20` için 5: profil sayfası, total count, bağlı kullanıcı batch seçimi ve 2 property `groupBy`), `getForAdmin` 9 sorgu, `summary` zaman serisiz 4 ve zaman serili 5 SQL sorgusu yürütür.

Detay, `AgentProfile` alanlarına `userId`, `user` (`AdminUser`), `logoUrl`, `logo`, `listingSummary`, `approvedApplications`, `propertiesPath` ve `managementEvents` ekler. `logoUrl` public dosya yoludur ve askıda veya pasif hesapta 404 verir. Admin görseli `logo.url` ile authenticated blob olarak alınır. Logo yoksa `logo` `null` olur. Detay `listingSummary` altı sayaca ek olarak `listingTypes` (`SALE`, `RENT`) ve `propertyTypes` (`APARTMENT`, `HOUSE`, `VILLA`, `LAND`, `WORKPLACE`) taşır. İkisi de yalnız bu profilin silinmemiş profesyonel ilanlarıdır. `propertiesPath` mevcut `GET /admin/properties?agentUserId=` filtresidir. İlan geçmişi detaya gömülmez.

`AgentApplication` ile `AgentProfile` arasında FK yoktur. `approvedApplications` tek başvuru seçmez. `{ userId, status: "APPROVED", total, listPath }` döner. `listPath`, o kullanıcının onaylı başvurularının filtrelenmiş listesidir. Birden fazla onaylı başvuru varsa `total` bunu söyler.

`managementEvents` hedefi `AGENT_PROFILE` ve bu profil olan son 10 audit kaydıdır. Sayfa şekli `{ items, page, limit, total }` olur. Tam sayfa `GET /admin/audit-logs?entityType=AGENT_PROFILE&entityId=` olur. Eski kayıtlarda `reason` olmayabilir.

Private logo yalnız bu profilin güncel `logoFileId` değeridir. Başka profil, başvuru belgesi, ilan görseli, silinmiş dosya ve değiştirilmiş eski logo 404 döner. Dosya diskte yoksa 404 `File not found` döner. Yanıt `Cache-Control: private, no-store` ve dosyanın MIME türünü taşır. Token URL'de yoktur. Public `/files/:id` kuralı değişmez.

Durum gövdesi `{ "isActive": false, "reason": "..." }` olur. `reason` trim edilir, 3–500 karakterdir ve boş olamaz. Geçersiz gerekçe, durum zaten aynı olsa bile 400 döner. Geçerli gerekçeyle aynı durum tekrar gönderilirse audit yazılmaz, ilan durumları, kullanıcı, rol ve `tokenVersion` değişmez. Yanıt `{ "id", "isActive" }` olur. Gerçek değişiklikte yalnız `AgentProfile.isActive` değişir. Kullanıcı, rol, başvuru, ilan durumları ve dosyalar durur. `tokenVersion` artmaz ve oturumlar kapatılmaz. Audit ile durum aynı transaction içindedir. Audit yazılamazsa durum geri alınır. Kayıt `AGENT_PROFILE_DEACTIVATED` veya `AGENT_PROFILE_ACTIVATED` olur. Metadata `{ previousIsActive, nextIsActive, reason }` taşır. Transaction profil satırını `FOR UPDATE` ile kilitler, ardından aktörün `users` satırını `FOR SHARE` ile kilitleyip hâlâ aktif `ADMIN` olduğunu doğrular; değilse 403 döner ve durum değişmez. Emlakçı yazma kapısı (`lockActiveAgent`) ise önce `users` satırını `FOR SHARE`, ardından `agent_profiles` satırını `FOR UPDATE` ile kilitler; böylece hesap pasife alma işlemi devam eden emlakçı yazma işlemiyle çakışmadan sıralanır.

`GET /admin/agents/summary` platformdaki bütün profilleri sayar. Liste filtresi ve zaman serisi bu sayaçları değiştirmez. Aralık yoksa `created` `null` olur. `createdFrom`, `createdTo` ve `bucket` (`day` veya `month`) birlikte zorunludur. Günlük en fazla 366, aylık en fazla 36 kovadır. Boş kova `0` döner. Seri `AgentProfile.createdAt` üzerindedir; başvuru veya onay sayısı değildir.

```json
{
  "total": 0,
  "active": 0,
  "suspended": 0,
  "publiclyVisible": 0,
  "accountStatuses": { "active": 0, "inactive": 0 },
  "profileAccounts": {
    "activeProfileActiveAccount": 0,
    "activeProfileInactiveAccount": 0,
    "suspendedProfileActiveAccount": 0,
    "suspendedProfileInactiveAccount": 0
  },
  "listingSummary": {
    "total": 0,
    "active": 0,
    "inactive": 0,
    "sold": 0,
    "rented": 0,
    "publiclyVisible": 0
  },
  "cities": {
    "basis": "stored-city-name",
    "items": [{ "city": "Konya", "count": 1 }],
    "otherCount": 0,
    "blankCount": 0,
    "distinctCount": 1
  },
  "created": null
}
```

`active` profil aktifliğidir. `suspended` askıdaki profildir. `publiclyVisible` profil sayısı, public profil kuralıdır: profil ve hesap birlikte aktiftir. `profileAccounts` dört kombinasyonun toplamı `total` ile aynıdır. `listingSummary` bütün profillerin silinmemiş profesyonel ilanlarıdır. Askı veya pasif hesap, kayıtlı ilanı bu toplamdan çıkarmaz. `cities` `AgentProfile.city` metnidir, `City` tablosuna bağlanmaz ve büyük küçük harfi ayrı tutar. Boş veya yalnız boşluk şehir bir isme yazılmaz; `blankCount` olur. `items` en yüksek 10 adlandırılmış şehirdir. Kalan adlandırılmış toplam `otherCount` olur. `created`, kullanıcı summary'sindeki `registrations` ile aynı kova şeklindedir: `from`, `to`, `bucket`, `total`, `points`. `points` öğesi `{ bucketStart, count }` olur. Grafik adı "Yeni Emlakçı Profilleri" bu seridir.

### Properties

```text
GET    /admin/properties
GET    /admin/properties/:id
PATCH  /admin/properties/:id/deactivate
DELETE /admin/properties/:id/images/:imageId
DELETE /admin/properties/:id
```

Liste query'si `status`, `listingType`, `city` (adın tam eşleşmesi), `deleted` (`"true"` / `"false"`, varsayılan silinmemişler), `ownerUserId`, `agentUserId`, `page`, `limit`. `ownerUserId` bireysel sahip, `agentUserId` emlakçı hesabıdır. İkisi birlikte verilirse iki koşul AND olur.

Liste öğesi `PropertyRecord` artı `sellerType` taşır. AGENT ilanında kısa `agent` korunur: `id`, `slug`, `companyName`, `isActive`, `user: { id, role, isActive }`. `owner` bu kayıtta `null` olur. INDIVIDUAL ilanında `agent` `null` olur ve `owner` `{ id, role, isActive }` döner.

Detayda AGENT `agent` daha geniştir (`phone`, `email`, `city`, `district`, `user.email` eklenir). INDIVIDUAL detayında `owner` `{ id, email, role, isActive }` olur. Şifre ve parola özeti yoktur. Silinmemiş canlı fotoğraflar `sortOrder` sırasında `images: PropertyImage[]` olarak taşınır. Pasife alma ve silme iki satıcı tipinde de çalışır.

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
