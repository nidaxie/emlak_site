# Yuva — Gayrimenkul Marketplace

Turkish-language, responsive real-estate marketplace frontend built with Vite, React, TypeScript, Wouter and TanStack Query. API models in `src/types/api.ts` are copied verbatim from the supplied contract.

## Requirements and setup

- Node.js 20+ and pnpm from the workspace
- The separately running API service and its configured CORS origin
- Install workspace dependencies from the repository root, then run this artifact's scripts

```sh
pnpm install
pnpm --filter @workspace/real-estate-marketplace dev
pnpm --filter @workspace/real-estate-marketplace build
```

Set `VITE_API_BASE_URL` in the frontend environment to the API base URL, including `/api/v1`. If omitted during development, the client uses `http://localhost:3001/api/v1`. That localhost address works only when the browser can reach the API on its own host; for a Replit preview or published app, set a browser-accessible API URL and allow the app's origin in the API's CORS configuration. The frontend never configures or changes backend variables.

## Public discovery demo data

`VITE_DATA_MODE` is the single switch for public read-only marketplace data:

- `mock`: uses the bundled Turkish sample listings, agents, and locations.
- `api`: uses the existing API service for public listings, details, agents, and locations.

When unset, local development defaults to `mock` and production builds default to `api`. Set `VITE_DATA_MODE=api` to check the live public API while developing. The app shows a demo-mode notice when mock data is active and starts in a logged-out state without attempting session restoration. Manual login, registration, favorites, profile changes, applications, uploads, agent tools, and admin tools always use the existing real API service; mock mode never reports those operations as successful.

The sample catalog and filtering implementation live in `src/mocks/marketplace-data.ts`. The read-only switch lives in `src/services/public-marketplace-data.ts`; the existing `src/services/api.ts` contract/service layer remains unchanged. Sample property photos use Unsplash image URLs and render the existing local illustration fallback if a remote image cannot load. Public search selectors use the sample locations in mock mode; the agent property editor uses API-backed location hooks so it never submits mock location IDs.

## Authentication

The access token is held in JavaScript memory only. Initial session restoration and login, refresh, and logout send cookies with `credentials: include`; the HttpOnly refresh cookie is never read by the frontend. Protected requests receive Bearer authorization and a single-flight refresh/retry flow. Auth changes clear user-scoped TanStack Query caches. Backend role checks remain authoritative; client route guards are only a navigation aid.

## Routes

- Public discovery: `/`, `/ilanlar`, `/ilan/:id`, `/emlakci/:slug`
- Account: `/giris`, `/kayit`, `/profil`, `/favoriler`, `/emlakci-basvuru`
- Agent workspace: `/panel`, `/panel/ilanlar`, `/panel/ilanlar/yeni`, `/panel/ilanlar/:id/duzenle`, `/panel/emlakci-profili`
- Admin workspace: `/admin`, `/admin/kullanicilar`, `/admin/kullanicilar/:id`, `/admin/basvurular`, `/admin/basvurular/:id`, `/admin/emlakcilar`, `/admin/emlakcilar/:id`, `/admin/ilanlar`, `/admin/ilanlar/:id`, `/admin/audit-logs`

Public image paths are resolved against the API origin, while private application documents use the authenticated download routes. Decimal API values remain strings at the request boundary and are formatted only for display.

## Contract limitations surfaced in UI

Agent-owned property detail and admin property detail responses in the supplied TypeScript contract do not contain image arrays. The editor manages image uploads/order/cover/removal for images uploaded during the current editing session and explains that existing image metadata is not returned. Admin property moderation likewise does not expose image IDs for a delete action. No extra API endpoints or response fields are assumed.
