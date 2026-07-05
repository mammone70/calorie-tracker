# Production deployment (Ubuntu VPS)

Deploy the Calorie Tracker API (NestJS) and web PWA (static Vite build) to a single Ubuntu VPS using Docker Compose and host nginx (TLS via certbot).

## Architecture

| Component | Role |
|-----------|------|
| **Host nginx** | HTTPS for web + API subdomains; serves `apps/web/dist`, proxies API subdomain to localhost |
| **Web** | `https://cal-count.mammonesoftware.org` |
| **API** | `https://api.cal-count.mammonesoftware.org/api` (NestJS on host `127.0.0.1:3001`) |
| **Postgres** | Database (internal network only, not exposed publicly) |

Future mobile apps connect to the same HTTPS API URL (`https://api.cal-count.mammonesoftware.org/api`) — no CORS changes needed for native clients.

## Prerequisites

- Ubuntu 22.04+ VPS with root/sudo access
- nginx already installed and serving port 80/443
- Domain name pointed at the VPS (A record → VPS IP)
- GitHub repository with this code
- [USDA API key](https://fdc.nal.usda.gov/api-key-signup.html) (optional)

## 1. VPS bootstrap (one time)

### Install Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Create deploy user

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
```

Copy your SSH public key to `/home/deploy/.ssh/authorized_keys`.

### Allow GitHub Actions to reload nginx

The deploy workflow runs `sudo nginx -t && sudo systemctl reload nginx` over SSH. Grant the `deploy` user passwordless sudo for those commands only:

```bash
sudo tee /etc/sudoers.d/deploy-nginx >/dev/null <<'EOF'
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/systemctl reload nginx
EOF
sudo chmod 440 /etc/sudoers.d/deploy-nginx
sudo visudo -c
```

Verify as the deploy user:

```bash
sudo -n nginx -t && sudo -n systemctl reload nginx
```

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Restrict SSH to your IP if possible:

```bash
sudo ufw delete allow OpenSSH
sudo ufw allow from YOUR.IP.ADDRESS to any port 22
```

**Do not** open extra ports for Docker — the API binds to `127.0.0.1:3001` only.

### SSH hardening

Edit `/etc/ssh/sshd_config`:

- `PasswordAuthentication no`
- `PermitRootLogin no`
- `PubkeyAuthentication yes`

Then: `sudo systemctl restart sshd`

### App directory

```bash
sudo mkdir -p /opt/calorie-tracker/backups
sudo chown deploy:deploy /opt/calorie-tracker
```

### DNS

Create A records pointing at your VPS IP:

| Host | Points to |
|------|-----------|
| `cal-count.mammonesoftware.org` | VPS IP |
| `api.cal-count.mammonesoftware.org` | VPS IP |

### nginx site config

After the first code sync to `/opt/calorie-tracker`:

```bash
sudo cp /opt/calorie-tracker/deploy/nginx/calorie-tracker.conf \
  /etc/nginx/sites-available/calorie-tracker
sudo ln -sf /etc/nginx/sites-available/calorie-tracker /etc/nginx/sites-enabled/
```

TLS:

```bash
sudo certbot --nginx -d cal-count.mammonesoftware.org -d api.cal-count.mammonesoftware.org
sudo nginx -t && sudo systemctl reload nginx
```

## 2. Configure secrets

On the VPS, create `/opt/calorie-tracker/.env` from the example:

```bash
cp deploy/.env.production.example .env
nano .env
```

Required values:

| Variable | Example |
|----------|---------|
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `WEB_ORIGIN` | `https://cal-count.mammonesoftware.org` |
| `ALLOW_REGISTRATION` | `false` |

**Never commit `.env` to git.**

## 3. First manual deploy

Before CI is wired up, deploy once by hand:

```bash
# On your dev machine — build web with production API URL
VITE_API_URL=https://api.cal-count.mammonesoftware.org/api pnpm install
pnpm build:packages
pnpm --filter @calorie-tracker/web build

# Sync to VPS (adjust user/host)
rsync -az --exclude '.env' --exclude 'backups/' \
  ./ deploy@YOUR_VPS:/opt/calorie-tracker/

# On VPS
cd /opt/calorie-tracker
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml up -d
sudo nginx -t && sudo systemctl reload nginx
```

Verify:

```bash
curl -s https://api.cal-count.mammonesoftware.org/api/health
curl -I https://cal-count.mammonesoftware.org
```

## 4. Create the first user (invite-only)

Registration is disabled when `ALLOW_REGISTRATION=false`. Create accounts with:

```bash
cd /opt/calorie-tracker
docker compose -f docker-compose.prod.yml run --rm --entrypoint node api \
  packages/db/scripts/create-user.js you@example.com 'your-secure-password'
```

Alternatively, temporarily set `ALLOW_REGISTRATION=true` in `.env`, restart the API, register via the web UI, then set it back to `false`:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

### Port user data from dev to production

Export on your dev machine (local Postgres running, same schema):

```bash
pnpm --filter @calorie-tracker/db export:user mammone@gmail.com mammone-export.json
```

Create the same user on production if needed (password can differ from dev):

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint node api \
  packages/db/scripts/create-user.js mammone@gmail.com 'your-production-password'
```

Copy the export file to the VPS:

```bash
scp mammone-export.json deploy@YOUR_VPS:/opt/calorie-tracker/
```

Import on the VPS (`--replace` clears existing data for that user first). Mount the export file into the container:

```bash
cd /opt/calorie-tracker
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/calorie-tracker/mammone-export.json:/app/mammone-export.json:ro \
  --entrypoint node api \
  packages/db/scripts/import-user-data.js mammone-export.json mammone@gmail.com --replace
```

Confirm the file exists on the host first: `ls -la /opt/calorie-tracker/mammone-export.json`

This copies foods, weekly/daily meal plans, macro targets, and food logs. It does **not** copy passwords or refresh tokens.

**Do not commit export JSON files** — they contain your personal data.

## 5. GitHub Actions automated deploy

Deploys run when you push a version tag (e.g. `v0.1.0`):

```bash
git tag v0.1.0
git push origin v0.1.0
```

**Before the first tag deploy:**

1. Commit and push all deploy files to `main` (`apps/api/Dockerfile`, `docker-compose.prod.yml`, `deploy/`, `.github/workflows/`, etc.).
2. Create `/opt/calorie-tracker/.env` on the VPS **before** pushing the tag. The workflow rsyncs code but never creates or overwrites `.env`.
3. Push a **new** tag after workflow fixes — tags point at a fixed commit; reusing `v0.1.0` after fixes requires deleting and re-pushing the tag.

Example first-time `.env` on the VPS (after `/opt/calorie-tracker` exists):

```bash
sudo -u deploy nano /opt/calorie-tracker/.env
```

Paste values from `deploy/.env.production.example` and fill in secrets (`openssl rand -hex 32` for passwords/JWT secrets).

### GitHub repository secrets

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Private key for deploy user (PEM contents) |
| `PRODUCTION_API_URL` | `https://api.cal-count.mammonesoftware.org/api` |

`VPS_HOST` must be the server IP or hostname only (not a URL). `SSH_PRIVATE_KEY` must be the full private key PEM, including `-----BEGIN ... KEY-----` lines.

If you restricted SSH with UFW to a single IP, GitHub Actions cannot connect. Either keep `ufw allow OpenSSH` for port 22, or allow [GitHub Actions IP ranges](https://api.github.com/meta) (they change over time).

The workflow (`.github/workflows/deploy-production.yml`) builds the web app, rsyncs to the VPS, rebuilds the API image, runs migrations, restarts services, and reloads nginx.

### Rollback

SSH to the VPS and checkout a previous tag, then redeploy:

```bash
cd /opt/calorie-tracker
git fetch --tags
git checkout v0.0.9   # if git history exists on server; otherwise re-run workflow for old tag
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d
sudo nginx -t && sudo systemctl reload nginx
```

With the rsync-based deploy, rollback is typically: push an older tag again from GitHub.

## 6. Database backups

See [BACKUP.md](./BACKUP.md) for automated daily backups and restore procedures.

Quick setup:

```bash
sudo cp deploy/systemd/calorie-tracker-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now calorie-tracker-backup.timer
```

## 7. Security summary

| Control | Status |
|---------|--------|
| HTTPS (Let's Encrypt via certbot + nginx) | Yes |
| API bound to localhost only | `127.0.0.1:3001` |
| Postgres not publicly exposed | Docker internal network |
| JWT auth on all data routes | Yes |
| bcrypt password hashing (cost 12) | Yes |
| Refresh token rotation | Yes |
| Invite-only registration | `ALLOW_REGISTRATION=false` |
| Auth rate limiting | 10 req/min per IP on `/api/auth/*` |
| Security headers (Helmet + nginx) | Yes |
| Production JWT secret validation | Fails fast if missing/weak |

## 8. Operations cheat sheet

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api

# Restart after .env change
docker compose -f docker-compose.prod.yml up -d

# Reload nginx after static file deploy
sudo nginx -t && sudo systemctl reload nginx

# Run migrations manually
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate

# Manual backup
./deploy/scripts/backup-db.sh
```

## 9. Mobile app (future)

Point the Expo app at your production API:

```json
"extra": {
  "apiUrl": "https://api.cal-count.mammonesoftware.org/api"
}
```

Same JWT login/refresh/sync endpoints as the web app.
