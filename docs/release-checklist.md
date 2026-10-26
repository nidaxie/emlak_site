# Release Checklist (YUVA Platform)

Production dağıtımı öncesinde, sırasında ve sonrasında doğrulanması gereken uygulama kontrol listesi.

---

## 1. Pre-Deploy

- [ ] Çalışma ağacı (`git status`) temiz ve hedef commit etiketlendi.
- [ ] `npm run lint` hatasız geçti (`api` + `web`).
- [ ] `npm run typecheck:web` hatasız geçti (`0` hata).
- [ ] `npm test` (backend unit testleri) ve `npm run test:e2e` (tüm e2e testleri) hatasız geçti.
- [ ] Production `.env` içinde `NODE_ENV=production`, `COOKIE_SECURE=true`, gerçek `CORS_ORIGIN` ve en az 32 karakterli benzersiz `JWT_SECRET` / `JWT_REFRESH_SECRET` tanımlandı.
- [ ] Web build argümanlarında `VITE_DATA_MODE=api` ve gerçek `VITE_API_BASE_URL` tanımlandı (`localhost` içermediği doğrulandı).

---

## 2. Database

- [ ] Production PostgreSQL veritabanının tam yedeği (`pg_dump` veya snapshot) alındı.
- [ ] Veritabanında `postgis` eklentisinin kurulu olduğu doğrulandı.
- [ ] `npm run db:deploy` (`prisma migrate deploy`) çalıştırıldı ve bekleyen migration kalmadı.
- [ ] Lokasyon ana verisi (`cities`, `districts`, `neighborhoods`) boşsa `import-locations.mjs` ile yüklendi.
- [ ] `audit_logs_immutable` ve `properties_sync_location` trigger'larının aktif olduğu doğrulandı.

---

## 3. Storage

- [ ] `/app/storage` (`STORAGE_LOCAL_ROOT`) dizinine kalıcı disk/volume (`storage_data`) bağlandı.
- [ ] Çalışma zamanı kullanıcısının (`node`) `/app/storage` dizininde okuma/yazma yetkisi olduğu doğrulandı.
- [ ] Dosya depolama alanı için periyodik yedekleme (volume backup) tanımlandı.

---

## 4. API & Frontend Containers

- [ ] `apps/api/Dockerfile` ve `apps/web/Dockerfile` temiz (`--no-cache`) build edildi.
- [ ] API container'ı ayağa kalktı ve `GET /api/v1/health` → `200 OK` (`database: up`, `postgis: up`) döndü.
- [ ] Web container'ı `node apps/web/server.mjs` ile ayağa kalktı (`vite dev` kullanılmadığı doğrulandı).
- [ ] Reverse proxy üzerinde HTTPS aktif ve `client_max_body_size` en az `12m` olarak ayarlandı.

---

## 5. Security

- [ ] `GET /api/v1/admin/users` anonim istekte `401`, `USER`/`AGENT` rolünde `403` dönüyor.
- [ ] Login yanıtında `refresh_token` çerezi `HttpOnly`, `Secure`, `Path=/api/v1/auth` olarak geliyor.
- [ ] Private başvuru belgeleri `GET /api/v1/files/:id` üzerinden `404` dönüyor.
- [ ] Hatalı/beklenmeyen isteklerde (örn. bozuk UUID) `500` veya stack trace yerine standart JSON hata gövdesi (`400`/`404`) dönüyor.

---

## 6. Post-Deploy Smoke

- [ ] `/` (Ana sayfa), `/ilanlar`, `/ilan/:id`, `/emlakci/:slug` sayfaları doğrudan URL ile açıldığında (SPA fallback) `200` dönüyor.
- [ ] `GET /api/v1/locations/cities` ve `GET /api/v1/properties` gerçek veri döndürüyor.
- [ ] Giriş (`/giris`), sayfa yenileme (`POST /auth/refresh` ile session restore) ve çıkış (`POST /auth/logout`) akışı çalışıyor.
- [ ] Agent hesabıyla ilan düzenleme sayfası yenilendiğinde mevcut ilan fotoğrafları (`GET /properties/me/:id`) yükleniyor.
- [ ] Admin hesabıyla `/admin` paneli ve `/admin/audit-logs` görüntüleniyor.

---

## 7. Rollback

- [ ] Smoke testlerinde P0 hata görülürse API ve Web servisleri bir önceki imaj etiketine geri alındı.
- [ ] Şema kaynaklı bir sorun varsa deploy öncesi alınan veritabanı ve storage yedeğinden geri dönüş başlatıldı.
