```
# `Architecture/Infrastructure.md````md# InfrastructureRepository: https://github.com/HamzaQamar05/masjid## Current Production ArchitectureMujtama currently uses a practical startup-style deployment:```txtFrontend: VercelBackend: DigitalOcean VPSDatabase: Neon PostgreSQLCache: Redis through Docker ComposeMobile: Capacitor iOSBackup/previous infra: RenderCI/CD: GitHub Actions
```
## Related Notes  
  
- [[Backend]]  
- [[Frontend]]  
- [[Database]]  
- [[Security]]  
- [[Infrastructure]]  
- [[Authentication]]  
- [[Messaging]]  
- [[Notifications]]
## Main Services

### Frontend

Hosted on Vercel.

Production frontend:

```
https://masjid-nine-chi.vercel.app
```

### Backend

Hosted on DigitalOcean VPS.

Known production path:

```
/opt/masjid/opt/masjid/backend
```

Backend runs on:

```
PORT=5000
```

### Database

Hosted on Neon PostgreSQL.

Connection through:

```
DATABASE_URL
```

### Redis

Redis runs through Docker Compose:

```
redis:7-alpine
```

Used for cache/background support, with memory fallback if unavailable.

### Media Uploads

Docker Compose mounts uploads to:

```
media-uploads:/app/uploads
```

### Backup / Previous Infra

Render has been used as backup/previous infrastructure.

Obsidian should track Render as fallback infra, not the primary backend.

## Docker

Root Dockerfile:

```
Dockerfile
```

Backend Dockerfile:

```
backend/Dockerfile
```

Docker Compose:

```
docker-compose.yml
```

Docker Compose services:

```
backendredis
```

Backend service:

- Builds from `./backend`
- Uses `backend/.env`
- Exposes port `5000:5000`
- Depends on Redis
- Mounts `media-uploads`

Redis service:

- Uses `redis:7-alpine`
- Persists data with `redis-data`
- Uses append-only mode

## GitHub Actions Deployment

Backend deployment workflow:

```
.github/workflows/deploy-vps.yml
```

Deployment flow:

```
Push to main  ↓GitHub Actions  ↓SSH into DigitalOcean VPS  ↓cd /opt/masjid  ↓Backup backend/.env  ↓git fetch origin  ↓git reset --hard origin/main  ↓Restore/regenerate backend/.env  ↓docker compose build / up  ↓Prisma migrate deploy
```

Secrets used by deployment:

```
DATABASE_URLJWT_SECRETFRONTEND_URLPUBLIC_API_URLCORS_ALLOWED_ORIGINSOPENAI_API_KEYOPENAI_MODELVAPID_PUBLIC_KEYVAPID_PRIVATE_KEYVAPID_SUBJECTVPS_HOSTVPS_SSH_KEY
```

## iOS CI

iOS workflow:

```
.github/workflows/ios-build.yml
```

Runs on:

```
macos-15
```

Checks:

- Frontend install
- Frontend build
- Capacitor sync
- iOS simulator build using Xcode

## Environment Reality

Current env shows:

```
DATABASE_URL=Neon PostgreSQLPORT=5000FRONTEND_URL=https://masjid-nine-chi.vercel.appCORS_ALLOWED_ORIGINS=https://masjid-nine-chi.vercel.app,capacitor://localhost,http://localhostPRAYER_NOTIFICATION_JOB_ENABLED=trueOPENAI_MODEL=gpt-4o-mini
```

## Known Infra Mismatches To Fix

There are older Vercel URLs still present in repo/config.

Examples:

- `https://ummah-connect-psi.vercel.app`
- older HamzaQamar Vercel preview URLs

Need to clean these up once the production domain is final.

## Current Infrastructure Strengths

- Vercel frontend is simple and fast.
- DigitalOcean backend gives full control.
- Neon removes database management burden.
- Docker Compose keeps backend + Redis repeatable.
- GitHub Actions deploys backend automatically.
- iOS build check exists.

## Infrastructure Risks

- Single VPS backend.
- No clear monitoring yet.
- No automated database backup notes.
- Env file handling is fragile.
- Upload storage depends on VPS volume.
- Render backup infra is not formally documented.
- No blue/green deploys yet.
- No Sentry/Prometheus/Grafana yet.

## Future Improvements

- Add domain
- Add Caddy or Nginx reverse proxy documentation
- Add uptime monitoring
- Add Sentry
- Add structured logs
- Add database backup process
- Add Redis monitoring
- Add image/file storage strategy
- Add production runbook
- Add rollback process
- Add Render fallback runbook