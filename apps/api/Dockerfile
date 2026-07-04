# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @calorie-tracker/api...

COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api

# COPY replaces workspace dirs and removes node_modules created above (bundle has no node_modules).
RUN pnpm install --frozen-lockfile --filter @calorie-tracker/api...

RUN pnpm --filter @calorie-tracker/shared build \
  && pnpm --filter @calorie-tracker/db build \
  && pnpm --filter @calorie-tracker/api build

FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++ \
  && corepack enable && corepack prepare pnpm@9.15.4 --activate \
  && addgroup -S app && adduser -S app -G app

WORKDIR /app

ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder /app/packages/db/scripts ./packages/db/scripts
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Hoisted install so scripts like packages/db/scripts/migrate.js can require('postgres').
RUN echo "node-linker=hoisted" > .npmrc \
  && pnpm install --frozen-lockfile --prod --filter @calorie-tracker/api... --filter @calorie-tracker/db... \
  && node -e "const { createRequire } = require('module'); createRequire('/app/packages/db/scripts/migrate.js').resolve('postgres'); createRequire('/app/apps/api/dist/main.js').resolve('@nestjs/core'); createRequire('/app/apps/api/dist/main.js').resolve('@calorie-tracker/db')" \
  && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
