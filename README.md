# Calorie Tracker

Personal calorie and macronutrient planner/tracker built as a mobile-first PWA, with NestJS API, Postgres, and local-first sync.

## Monorepo structure

```
apps/web        Mobile-first PWA (Vite + React + Dexie)
apps/api        NestJS REST API with JWT auth
apps/mobile     Legacy Expo app (archived — see apps/mobile/ARCHIVED.md)
packages/client Shared API client, sync engine, and local-store
packages/db     Drizzle schema + Postgres migrations
packages/shared Zod schemas and shared types
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres)
- [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup.html) (optional, for food search)

## Quick start

```bash
# 1. Install dependencies and build shared packages
pnpm setup

# 2. Configure environment
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit .env — set JWT secrets and optional USDA_API_KEY

# 3. Start Postgres
docker compose up -d

# 4. Run migrations
pnpm db:migrate

# 5. Start API (terminal 1)
pnpm dev:api

# 6. Start web app (terminal 2)
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173). The web app talks to the API at `http://localhost:3000/api` by default (override with `VITE_API_URL` in `apps/web/.env`).

## API endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Sign in |
| `POST /api/auth/refresh` | Refresh tokens |
| `GET/PUT /api/macro-targets` | Date-specific macro targets (overrides) |
| `GET /api/macro-targets/effective?from=&to=` | Resolved targets (override → weekly default) |
| `GET/PUT /api/weekly-macro-targets` | Default targets by day of week (Mon–Sun) |
| `GET/POST/PATCH/DELETE /api/weekly-meal-plans` | Weekly meal plan templates by day of week |
| `GET /api/meal-plans/effective?date=` | Resolved meal plan (date override → weekly template) |
| `GET/POST/PATCH/DELETE /api/foods` | Saved foods |
| `GET /api/foods/search?q=` | USDA + Open Food Facts search |
| `GET/POST/PATCH/DELETE /api/meal-plans` | Meal plans |
| `GET/POST/PATCH/DELETE /api/food-logs` | Food logs |
| `GET /api/sync` | Pull changes since timestamp |
| `POST /api/sync/push` | Push outbox mutations |

## Web app features

- **Today** — macro progress vs daily target, logged foods
- **Calendar** — month view with macro target indicators; tap a day for details
- **Day detail** — set targets, view meal plan and food log tabs
- **My Foods** — saved foods, manual entry, external search
- **Settings** — weekly macro defaults, manual sync, sign out
- **Offline** — IndexedDB (Dexie) local store with outbox sync queue; auto-sync on reconnect
- **PWA** — installable on mobile home screen; service worker caches static assets

## Production build

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for full VPS deployment instructions.

```bash
pnpm build:packages
VITE_API_URL=https://mammonesoftware.org/api pnpm --filter @calorie-tracker/web build
# Static output in apps/web/dist — served by host nginx in production
# Set WEB_ORIGIN and ALLOW_REGISTRATION=false on the API for production
```

Production deploys are triggered by pushing a version tag (e.g. `v0.1.0`) — see `.github/workflows/deploy-production.yml`.

## Development scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Start NestJS API with hot reload |
| `pnpm dev:web` | Start Vite dev server (port 5173) |
| `pnpm dev:mobile` | Start legacy Expo dev server |
| `pnpm build:packages` | Build shared, db, and client packages |
| `pnpm db:migrate` | Apply Postgres migrations |
| `pnpm db:studio` | Open Drizzle Studio |
