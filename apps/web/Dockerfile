FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Some networks drop TLS when the SNI is registry.npmjs.org. package-lock
# integrity still verifies every tarball. Use the mirror only in that case.
RUN set -eu; \
    if node -e "const h=require('https');const r=h.get('https://registry.npmjs.org/npm',{timeout:8000},s=>{s.resume();process.exit(s.statusCode===200?0:2)});r.on('timeout',()=>{r.destroy();process.exit(2)});r.on('error',()=>process.exit(2))"; then \
      echo "npm registry: official"; \
    else \
      npm config set registry https://registry.npmmirror.com; \
      npm config set replace-registry-host npmjs; \
      echo "npm registry: mirror"; \
    fi; \
    npm ci

COPY apps/web apps/web

ARG VITE_DATA_MODE=api
ARG VITE_API_BASE_URL=http://localhost:3001/api/v1
ENV VITE_DATA_MODE=$VITE_DATA_MODE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build -w web

FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/vite.config.ts ./apps/web/vite.config.ts
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "web"]
