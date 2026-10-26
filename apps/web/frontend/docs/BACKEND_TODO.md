# Backend TODO

The marketplace frontend currently serves only the Express health route `GET /api/healthz`. The existing public API contract expects business endpoints under the configured `/api/v1` base URL. The lists below are the endpoints used by the frontend's preserved API service and documented contract; they are not implemented by the current Express source.

## Contract and runtime alignment

- [ ] Choose and document the backend stack. The attached integration notes describe NestJS/Prisma/PostGIS; the current source is Express/Drizzle/PostgreSQL.
- [ ] Align API prefix/version and health route. Current source mounts `/api/healthz`; frontend configuration defaults to `/api/v1`, and the supplied endpoint contract names `GET /health`.
- [ ] Configure the frontend origin for credentialed CORS and HttpOnly refresh-cookie requests.
- [ ] Add environment examples for API port, database URL, frontend origin, and API base URL.
- [ ] Make health checks verify the database and, if retained as a requirement, PostGIS rather than returning a static status.
- [ ] Add PostgreSQL tables, migrations, constraints, seed strategy, and repository queries. The current Drizzle schema is empty and the API server does not use the DB package.
- [ ] Define file storage, validation, limits, visibility, and download authorization for uploaded documents and images.

## Public discovery and location data

- [ ] `GET /properties` — filtered, sorted, paginated public listing response, including visibility and active-agent checks.
- [ ] `GET /properties/:id` — public listing details, images, and agent contact summary.
- [ ] `GET /agents/:slug` — public agent profile.
- [ ] `GET /agents/:slug/properties` — filtered and paginated public agent listings.
- [ ] `GET /locations/cities`.
- [ ] `GET /locations/cities/:cityId/districts`.
- [ ] `GET /locations/districts/:districtId/neighborhoods`.
- [ ] `GET /files/:id` — public agent logos and property photos.

## Authentication, user profile, and favorites

- [ ] `POST /auth/register`.
- [ ] `POST /auth/login`.
- [ ] `POST /auth/refresh` — issue access token and HttpOnly refresh cookie.
- [ ] `POST /auth/logout` — revoke refresh session and clear cookie.
- [ ] `GET /users/me`.
- [ ] `PATCH /users/me`.
- [ ] `GET /favorites`.
- [ ] `POST /favorites/:propertyId`.
- [ ] `DELETE /favorites/:propertyId`.

## Agent applications and documents

- [ ] `POST /agent-applications`.
- [ ] `GET /agent-applications/me`.
- [ ] `PATCH /agent-applications/me`.
- [ ] `POST /agent-applications/me/documents`.
- [ ] `GET /agent-applications/me/documents`.
- [ ] `GET /agent-applications/me/documents/:documentId`.
- [ ] `GET /admin/agent-applications`.
- [ ] `GET /admin/agent-applications/:id`.
- [ ] `GET /admin/agent-applications/:id/documents`.
- [ ] `GET /admin/agent-applications/:id/documents/:documentId`.
- [ ] `POST /admin/agent-applications/:id/approve`.
- [ ] `POST /admin/agent-applications/:id/reject`.

## Agent profile and property management

- [ ] `GET /agents/me`.
- [ ] `PATCH /agents/me`.
- [ ] `POST /agents/me/logo`.
- [ ] `POST /properties`.
- [ ] `GET /properties/me`.
- [ ] `GET /properties/me/:id`.
- [ ] `PATCH /properties/:id`.
- [ ] `PATCH /properties/:id/status`.
- [ ] `DELETE /properties/:id`.
- [ ] `POST /properties/:id/images`.
- [ ] `PATCH /properties/:id/images/order`.
- [ ] `PATCH /properties/:id/images/:imageId/cover`.
- [ ] `DELETE /properties/:id/images/:imageId`.

## Admin operations and audit

- [ ] `GET /admin/users`.
- [ ] `GET /admin/users/:id`.
- [ ] `PATCH /admin/users/:id/status`.
- [ ] `GET /admin/agents`.
- [ ] `GET /admin/agents/:id`.
- [ ] `PATCH /admin/agents/:id/status`.
- [ ] `GET /admin/properties`.
- [ ] `GET /admin/properties/:id`.
- [ ] `PATCH /admin/properties/:id/deactivate`.
- [ ] `DELETE /admin/properties/:id/images/:imageId`.
- [ ] `DELETE /admin/properties/:id`.
- [ ] `GET /admin/audit-logs`.

## Frontend mode boundaries

- Mock mode supplies read-only public catalog, agent, and discovery-location responses. The agent property editor continues to read locations from the API so demo IDs are never sent in write requests. Mock mode does not implement or imply success for any endpoint in the authentication, favorites, profile mutation, applications, uploads, agent workspace, or admin groups above.
- When backend endpoints are implemented, set `VITE_DATA_MODE=api` to switch public discovery to the existing API service without removing the sample catalog.
