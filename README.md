# Mujtama

Mujtama is a Muslim community platform focused on users and masjids. The current MVP direction is:

- Community users discover and follow masjids, read updates, save events, apply to jobs/volunteer roles, and message others.
- Masjid/MSA operators use a dedicated dashboard to manage prayer times, announcements, posts, events, classes/programs, followers, applications, team members, and public profile previews.

## Local setup

Frontend:

```bash
npm install
cp .env.example .env
npm run dev
```

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run generate
npm run dev
```

## Important repo hygiene

Do not commit or share:

- `.env` files
- `node_modules`
- production build folders like `dist`
- database files or local uploads containing private data

Use `.env.example` files as templates and keep real secrets in Vercel, the VPS, or another secure secret manager.

## Key docs

- `docs/PRODUCT_VISION.md`
- `docs/UI_GUIDELINES.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `docs/SystemDiagram.md`
