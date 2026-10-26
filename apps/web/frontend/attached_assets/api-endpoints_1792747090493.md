# API endpoint referansı

Tüm path'ler `/api/v1` altındadır. Ayrıntılı akış, örnek JSON ve kurallar `docs/frontend-integration.md` içindedir. Tipler `docs/frontend-types.ts` içindedir.

Auth sütunu:

- `Yok`: token gerekmez
- `Opsiyonel`: Bearer yoksa anonim devam eder, varsa doğrulanır
- `Bearer`: `Authorization: Bearer <accessToken>`
- `Cookie`: HttpOnly `refresh_token`, `credentials: 'include'` ve eşleşen `Origin`

## Health

| Method | Path      | Auth | Role | Request | Response         | Purpose                    |
| ------ | --------- | ---- | ---- | ------- | ---------------- | -------------------------- |
| GET    | `/health` | Yok  | —    | —       | `HealthResponse` | API, PostgreSQL ve PostGIS |

## Auth

| Method | Path             | Auth               | Role | Request           | Response          | Purpose                            |
| ------ | ---------------- | ------------------ | ---- | ----------------- | ----------------- | ---------------------------------- |
| POST   | `/auth/register` | Yok                | —    | `RegisterRequest` | `AuthUser`, 201   | Hesap açar                         |
| POST   | `/auth/login`    | Cookie için Origin | —    | `LoginRequest`    | `LoginResponse`   | Access token ve refresh cookie     |
| POST   | `/auth/refresh`  | Cookie + Origin    | —    | —                 | `RefreshResponse` | Access token yeniler, cookie döner |
| POST   | `/auth/logout`   | Cookie + Origin    | —    | —                 | `LogoutResponse`  | Oturumu kapatır, cookie siler      |

## Users

| Method | Path        | Auth   | Role        | Request                    | Response      | Purpose            |
| ------ | ----------- | ------ | ----------- | -------------------------- | ------------- | ------------------ |
| GET    | `/users/me` | Bearer | Aktif hesap | —                          | `UserProfile` | Oturumdaki profil  |
| PATCH  | `/users/me` | Bearer | Aktif hesap | `UpdateUserProfileRequest` | `UserProfile` | Ad, soyad, telefon |

## Favorites

| Method | Path                     | Auth   | Role        | Request         | Response                        | Purpose            |
| ------ | ------------------------ | ------ | ----------- | --------------- | ------------------------------- | ------------------ |
| GET    | `/favorites`             | Bearer | Aktif hesap | `page`, `limit` | `FavoriteListResponse`          | Görünür favoriler  |
| POST   | `/favorites/:propertyId` | Bearer | Aktif hesap | —               | `FavoriteMutationResponse`, 200 | Idempotent ekleme  |
| DELETE | `/favorites/:propertyId` | Bearer | Aktif hesap | —               | `FavoriteRemovalResponse`, 200  | Idempotent çıkarma |

## Locations

| Method | Path                                             | Auth | Role | Request | Response         | Purpose    |
| ------ | ------------------------------------------------ | ---- | ---- | ------- | ---------------- | ---------- |
| GET    | `/locations/cities`                              | Yok  | —    | —       | `City[]`         | İller      |
| GET    | `/locations/cities/:cityId/districts`            | Yok  | —    | —       | `District[]`     | İlçeler    |
| GET    | `/locations/districts/:districtId/neighborhoods` | Yok  | —    | —       | `Neighborhood[]` | Mahalleler |

## Agent Applications

| Method | Path                                           | Auth   | Role        | Request                          | Response                     | Purpose                     |
| ------ | ---------------------------------------------- | ------ | ----------- | -------------------------------- | ---------------------------- | --------------------------- |
| POST   | `/agent-applications`                          | Bearer | `USER`      | `CreateAgentApplicationRequest`  | `AgentApplication`, 201      | Başvuru                     |
| GET    | `/agent-applications/me`                       | Bearer | Aktif hesap | —                                | `AgentApplication`           | Son başvuru                 |
| PATCH  | `/agent-applications/me`                       | Bearer | Aktif hesap | `UpdateAgentApplicationRequest`  | `AgentApplication`           | Yalnız `PENDING` güncelleme |
| POST   | `/agent-applications/me/documents`             | Bearer | `USER`      | multipart `file`, `documentType` | `UploadedAgentDocument`, 201 | Belge ekler veya değiştirir |
| GET    | `/agent-applications/me/documents`             | Bearer | Aktif hesap | —                                | `AgentApplicationDocument[]` | Son başvurunun belgeleri    |
| GET    | `/agent-applications/me/documents/:documentId` | Bearer | Sahip       | —                                | dosya akışı                  | Kendi belgesini indirir     |

## Agents

| Method | Path                       | Auth      | Role    | Request                     | Response                          | Purpose                    |
| ------ | -------------------------- | --------- | ------- | --------------------------- | --------------------------------- | -------------------------- |
| GET    | `/agents/me`               | Bearer    | `AGENT` | —                           | `AgentProfile`                    | Kendi profil               |
| PATCH  | `/agents/me`               | Bearer    | `AGENT` | `UpdateAgentProfileRequest` | `AgentProfile`                    | Profil güncelleme          |
| POST   | `/agents/me/logo`          | Bearer    | `AGENT` | multipart `file`            | `AgentLogoResponse`, 201          | Logo                       |
| GET    | `/agents/:slug/properties` | Opsiyonel | —       | `AgentPropertyListQuery`    | `PaginatedResponse<PropertyCard>` | Emlakçının public ilanları |
| GET    | `/agents/:slug`            | Yok       | —       | —                           | `AgentPublicProfile`              | Public profil              |

## Properties

| Method | Path                                    | Auth      | Role    | Request                       | Response                            | Purpose                 |
| ------ | --------------------------------------- | --------- | ------- | ----------------------------- | ----------------------------------- | ----------------------- |
| POST   | `/properties`                           | Bearer    | `AGENT` | `CreatePropertyRequest`       | `PropertyRecord`, 201               | İlan oluşturur          |
| GET    | `/properties/me`                        | Bearer    | `AGENT` | `MyPropertyListQuery`         | `PaginatedResponse<PropertyRecord>` | Kendi ilanları          |
| GET    | `/properties/me/:id`                    | Bearer    | `AGENT` | —                             | `PropertyRecord`                    | Kendi ilan detayı       |
| PATCH  | `/properties/:id`                       | Bearer    | `AGENT` | `UpdatePropertyRequest`       | `PropertyRecord`                    | Kendi ilanını günceller |
| PATCH  | `/properties/:id/status`                | Bearer    | `AGENT` | `UpdatePropertyStatusRequest` | `PropertyRecord`                    | Durum geçişi            |
| DELETE | `/properties/:id`                       | Bearer    | `AGENT` | —                             | `DeletePropertyResponse`            | Soft delete             |
| POST   | `/properties/:id/images`                | Bearer    | `AGENT` | multipart `file`              | `UploadedPropertyImage`, 201        | Fotoğraf                |
| PATCH  | `/properties/:id/images/order`          | Bearer    | `AGENT` | `PropertyImageOrderRequest`   | `PropertyImageOrderResponse`        | Sıra                    |
| PATCH  | `/properties/:id/images/:imageId/cover` | Bearer    | `AGENT` | —                             | `PropertyCoverResponse`             | Kapak                   |
| DELETE | `/properties/:id/images/:imageId`       | Bearer    | `AGENT` | —                             | `DeletedPropertyImageResponse`      | Fotoğraf siler          |
| GET    | `/properties`                           | Opsiyonel | —       | `PublicPropertyListQuery`     | `PaginatedResponse<PropertyCard>`   | Public liste            |
| GET    | `/properties/:id`                       | Opsiyonel | —       | —                             | `PropertyDetail`                    | Public detay            |

## Files

| Method | Path         | Auth | Role | Request | Response           | Purpose                |
| ------ | ------------ | ---- | ---- | ------- | ------------------ | ---------------------- |
| GET    | `/files/:id` | Yok  | —    | —       | public dosya akışı | Logo ve ilan fotoğrafı |

## Admin Users

| Method | Path                      | Auth   | Role    | Request               | Response                       | Purpose                  |
| ------ | ------------------------- | ------ | ------- | --------------------- | ------------------------------ | ------------------------ |
| GET    | `/admin/users`            | Bearer | `ADMIN` | `AdminUserListQuery`  | `PaginatedResponse<AdminUser>` | Kullanıcı listesi        |
| GET    | `/admin/users/:id`        | Bearer | `ADMIN` | —                     | `AdminUserDetail`              | Kullanıcı detayı         |
| PATCH  | `/admin/users/:id/status` | Bearer | `ADMIN` | `ActiveStatusRequest` | `ActiveStatusResponse`         | Hesabı açar veya kapatır |

## Admin Agent Applications

| Method | Path                                                  | Auth   | Role    | Request                          | Response                                           | Purpose         |
| ------ | ----------------------------------------------------- | ------ | ------- | -------------------------------- | -------------------------------------------------- | --------------- |
| GET    | `/admin/agent-applications`                           | Bearer | `ADMIN` | `AdminAgentApplicationListQuery` | `PaginatedResponse<AdminAgentApplicationListItem>` | Başvuru listesi |
| GET    | `/admin/agent-applications/:id`                       | Bearer | `ADMIN` | —                                | `AdminAgentApplication`                            | Başvuru detayı  |
| GET    | `/admin/agent-applications/:id/documents`             | Bearer | `ADMIN` | —                                | `AgentApplicationDocument[]`                       | Belge listesi   |
| GET    | `/admin/agent-applications/:id/documents/:documentId` | Bearer | `ADMIN` | —                                | dosya akışı                                        | Private belge   |
| POST   | `/admin/agent-applications/:id/approve`               | Bearer | `ADMIN` | —                                | `AgentApplicationApproval`, 200                    | Onay            |
| POST   | `/admin/agent-applications/:id/reject`                | Bearer | `ADMIN` | `ModerationReasonRequest`        | `AgentApplicationRejection`, 200                   | Red             |

## Admin Agents

| Method | Path                       | Auth   | Role    | Request               | Response                                | Purpose                 |
| ------ | -------------------------- | ------ | ------- | --------------------- | --------------------------------------- | ----------------------- |
| GET    | `/admin/agents`            | Bearer | `ADMIN` | `AdminAgentListQuery` | `PaginatedResponse<AdminAgentListItem>` | Emlakçı listesi         |
| GET    | `/admin/agents/:id`        | Bearer | `ADMIN` | —                     | `AdminAgent`                            | Emlakçı detayı          |
| PATCH  | `/admin/agents/:id/status` | Bearer | `ADMIN` | `ActiveStatusRequest` | `ActiveStatusResponse`                  | `AgentProfile.isActive` |

## Admin Properties

| Method | Path                                    | Auth   | Role    | Request                   | Response                           | Purpose            |
| ------ | --------------------------------------- | ------ | ------- | ------------------------- | ---------------------------------- | ------------------ |
| GET    | `/admin/properties`                     | Bearer | `ADMIN` | `AdminPropertyListQuery`  | `PaginatedResponse<AdminProperty>` | Moderasyon listesi |
| GET    | `/admin/properties/:id`                 | Bearer | `ADMIN` | —                         | `AdminPropertyDetail`              | Moderasyon detayı  |
| PATCH  | `/admin/properties/:id/deactivate`      | Bearer | `ADMIN` | `ModerationReasonRequest` | `PropertyRecord`                   | İlanı pasife alır  |
| DELETE | `/admin/properties/:id/images/:imageId` | Bearer | `ADMIN` | —                         | `DeletedPropertyImageResponse`     | Fotoğraf siler     |
| DELETE | `/admin/properties/:id`                 | Bearer | `ADMIN` | `ModerationReasonRequest` | `DeletePropertyResponse`           | Soft delete        |

## Audit

| Method | Path                | Auth   | Role    | Request             | Response                      | Purpose           |
| ------ | ------------------- | ------ | ------- | ------------------- | ----------------------------- | ----------------- |
| GET    | `/admin/audit-logs` | Bearer | `ADMIN` | `AuditLogListQuery` | `PaginatedResponse<AuditLog>` | Salt okunur audit |
