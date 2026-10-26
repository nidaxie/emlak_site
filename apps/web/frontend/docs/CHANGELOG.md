# Changelog

## 2026-10-24 — Public marketplace demo data

- Added a centralized, contract-typed sample catalog with 24 Turkish property listings across six cities and four public agent profiles.
- Filled listing type, property type, TRY price, room counts, gross/net area, location identifiers and labels, coordinates, property attributes, dates, and image galleries with internally consistent sample values.
- Added sample city, district, and neighborhood data so the existing cascading location selectors can be tried without a locations API.
- Kept the agent property editor on API-backed location hooks, preventing sample location IDs from being submitted to the backend.
- Added a single `VITE_DATA_MODE` switch. Local development defaults to `mock`; production defaults to `api`. Explicit values are `mock` and `api`.
- Routed only public read operations (property list/detail, public agent/profile listings, and locations) through a read-only data facade. The facade delegates to the existing API service when API mode is selected.
- Implemented mock listing filtering for listing/property type, exact city/district/neighborhood, price range, room/living-room counts, and gross-area range; added newest/price sorting and contract-shaped pagination. Room count follows the supplied contract's equality semantics.
- Added a persistent-in-session demo-mode notice that identifies the actions which still require the real API.
- Mock mode starts logged out and skips automatic cookie session restoration so public demo browsing does not wait for auth backend availability. Manual login and other auth operations still call the real API.
- Added a local visual fallback for property card and detail images. Demo photos use Unsplash URLs; the UI falls back if a remote image fails.
- Kept login, registration, favorites, profile changes, applications, documents, agent mutations, property management, and admin operations on the existing real API calls. No mock mutation success was introduced.
- Preserved `src/services/api.ts`, `src/types/api.ts`, and the backend source.

## Validation

- A read-only Node smoke check passed for location hierarchy, 24 listings, four agents, listing filters, price sorting, pagination, and agent-scoped results. Build and typecheck were not run because `pnpm` and workspace dependencies are unavailable in the current environment. The Vite build also writes `dist/public`, so it was not run under the no-generated-output constraint.
- No automated tests or test scripts are currently configured for the workspace.
