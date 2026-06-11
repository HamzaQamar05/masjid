Frontend code: GitHub + Vercel build
Frontend live site : Vercel
Backend code: GitHub + Docker image on VPS
Backend running app: DigitalOcean Docker container
Database data: Neon PostgreSQL
Redis data: VPS Docker volume
HTTPS config: Caddy on VPS
Environment variables: Vercel env + /opt/masjid/backend/.env
SSL certificate: Managed by Caddy on VPS
Domain-like HTTPS URL: sslip.io pointing to VPS IP

