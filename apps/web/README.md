# Yuva — Gayrimenkul Marketplace (apps/web)

React, Vite, TypeScript, Wouter ve TanStack Query ile geliştirilmiş gayrimenkul platformu web arayüzü. API tipleri `src/types/api.ts` içinde `docs/frontend-types.ts` sözleşmesiyle birebir uyumludur.

## Kurulum ve Çalıştırma

Depo kökünden:

```bash
npm install
npm run dev:web
npm run build:web
npm run lint -w web
```

## Ortam Değişkenleri

`VITE_DATA_MODE=api` ve `VITE_API_BASE_URL=http://localhost:3001/api/v1` değerleri `.env` (veya `apps/web/.env`) üzerinden okunur.

- `VITE_DATA_MODE=api`: Tüm public okuma isteklerini doğrudan NestJS `/api/v1` backend'ine gönderir (mock fallback yapılmaz).
- `VITE_DATA_MODE=mock`: Yalnız yerel görsel demo için `src/mocks/marketplace-data.ts` verisini kullanır.
