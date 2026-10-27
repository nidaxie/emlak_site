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

COPY apps/api apps/api

ARG DATABASE_URL=postgresql://emlak:emlak@localhost:5432/emlak
ENV DATABASE_URL=$DATABASE_URL

RUN npm run prisma:generate -w api && npm run build -w api

FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/storage && chown -R node:node /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma7.config.ts ./apps/api/prisma7.config.ts

COPY apps/api/docker-entrypoint.mjs /usr/local/bin/docker-entrypoint.mjs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "/usr/local/bin/docker-entrypoint.mjs"]
CMD ["node", "apps/api/dist/main.js"]
