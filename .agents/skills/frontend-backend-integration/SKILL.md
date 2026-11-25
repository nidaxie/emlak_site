---
name: frontend-backend-integration
description: React + Vite + TypeScript frontend'in mevcut NestJS (/api/v1) backend'e güvenli ve contract-driven şekilde entegre edilmesi. Frontend-backend entegrasyonu, API bağlantısı, endpoint entegrasyonu veya faz bazlı entegrasyon görevlerinde kullan.
---

Bu skill, React + Vite + TypeScript frontend'in mevcut NestJS backend'e güvenli ve contract-driven şekilde entegre edilmesi için kullanılacak.

## Proje bağlamı

Gerçek business backend:

```text
apps/api
```

Teknoloji:

```text
NestJS
Prisma
PostgreSQL
PostGIS
/api/v1
```

Frontend:

```text
apps/web
```

Teknoloji:

```text
React
Vite
TypeScript
Wouter
React Query
```

Frontend içinde Express bulunabilir ancak Express gerçek business backend değildir.

## Authoritative API contract

Skill her entegrasyon görevinden önce şu dosyaları okumalı:

```text
docs/frontend-integration.md
docs/api-endpoints.md
docs/frontend-types.ts
```

Bu üç dosya API sözleşmesinin authoritative kaynağıdır.

## Temel kurallar

1. Backend'i frontend'e göre değiştirme.
2. Frontend'i mevcut backend contract'a uydur.
3. Kodda olmayan endpoint uydurma.
4. Request field uydurma.
5. Response field uydurma.
6. Enum değeri uydurma.
7. Backend'de olmayan feature için fake API oluşturma.
8. API mode'da mock fallback yapma.
9. Mock mode ve API mode birbirinden kesin ayrılmalı.
10. Production API mode kullanmalı.
11. Decimal alanların string contract'ını koru.
12. Pagination contract:
   `items`, `page`, `limit`, `total`.
13. `totalPages` backend'den geliyormuş gibi davranma.
14. Public property, agent property ve favorite listelerinde ortak `PropertyCard` contract'ını kullan.
15. File URL path'lerini `VITE_API_BASE_URL` ile yanlış birleştirme.
16. `/api/v1/files/:id` root-relative path ise API origin ile birleştir.
17. Access token Bearer token'dır.
18. Refresh token HttpOnly cookie'dedir.
19. Refresh token'ı localStorage/sessionStorage içine yazma.
20. Login/refresh/logout isteklerinde `credentials: 'include'` kullan.
21. 401 refresh retry yalnız bir kez yapılmalı.
22. Infinite refresh loop oluşturma.
23. Cross-origin local development için CORS_ORIGIN kontrol edilmeli.
24. Express üzerinden paralel business API üretme.
25. Gerçek backend çağrıları NestJS `/api/v1` endpointlerine gitmeli.

## Çalışma sırası

Her entegrasyon görevinde şu akışı izle:

### A. Inspect

Önce:

- ilgili controller
- DTO
- service
- frontend integration docs
- frontend types
- mevcut frontend service
- React Query hook
- route/component

incele.

### B. Contract check

Kod yazmadan önce gerçek:

- endpoint
- method
- query
- request
- response
- auth
- role
- enum
- nullability

bilgilerini doğrula.

### C. Minimal integration

Mevcut UI tasarımını bozma.

Sadece gerçek API bağlantısı için gerekli minimum değişikliği yap.

### D. No silent fallback

API çağrısı başarısızsa:

- loading
- error
- empty state

göster.

Mock veriyle gizleme.

### E. Verify

İlgili gerçek endpoint'e request gönderildiğini doğrula.

Network/API smoke yap.

Mock response üzerinden PASS yazma.

### F. Regression

Mümkün olan yerde:

- TypeScript
- build
- lint
- prettier
- mevcut testler

çalıştır.

## Entegrasyon fazları

Skill aşağıdaki sırayı tercih etmeli:

```text
Phase 1 - Public API
Phase 2 - Auth
Phase 3 - Favorites + User Profile
Phase 4 - Agent Application
Phase 5 - Agent Panel + Property Management
Phase 6 - Admin
Phase 7 - Final integration regression
```

Kullanıcı açıkça istemedikçe bir sonraki faza geçme.

## Public API phase

Endpointler:

```text
GET /properties
GET /properties/:id
GET /agents/:slug
GET /agents/:slug/properties
GET /locations/cities
GET /locations/cities/:cityId/districts
GET /locations/districts/:districtId/neighborhoods
GET /files/:id
```

## Unsupported feature policy

Frontend tasarımında backend'de olmayan bir özellik görürsen örneğin:

```text
featured listings
popular cities
agent rating
reviews
view count
individual seller listing flow
project developer management
team management
bulk portfolio management
```

şunları yapma:

- fake backend
- fake success
- new endpoint
- silent backend modification

Bunun yerine feature'ı:

```text
BACKEND_GAP
```

olarak raporla ve mümkünse mevcut backend verisiyle yanıltıcı olmayan UI davranışı kullan.

## Rapor formatı

Her kullanım sonunda:

```text
FILES_CHANGED =
ENDPOINTS_INTEGRATED =
REAL_API_VERIFIED =
MOCK_FALLBACK =
CONTRACT_MISMATCHES =
BUILD =
TYPECHECK =
LINT =
TESTS =
BACKEND_GAPS =
```

ve:

```text
INTEGRATION_PHASE = COMPLETE
```

veya:

```text
INTEGRATION_PHASE = NOT_COMPLETE
```

yaz.

Doğrulanmamış hiçbir şeyi PASS veya COMPLETE olarak raporlama.
