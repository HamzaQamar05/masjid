# Backend

Repository: https://github.com/HamzaQamar05/masjid
## Related Notes  
  
- [[Backend]]  
- [[Frontend]]  
- [[Database]]  
- [[Security]]  
- [[Infrastructure]]  
- [[Authentication]]  
- [[Messaging]]  
- [[Notifications]]
## Purpose

The backend powers Mujtama’s core application logic.

It serves the API for the frontend and mobile app, manages users and organizations, handles messaging, notifications, AI features, prayer times, opportunities, events, and admin-style operations.

## Location

Main backend folder:

backend/server.js

## Stack

- Node.js
- Express 5
- Prisma 6
- PostgreSQL
- Neon Database
- Redis
- Socket.IO
- JWT
- bcryptjs
- nodemailer
- web-push
- OpenAI API
- Docker

## Backend Scripts:
 npm run dev
npm run start
npm run generate
npm run db:push:dev
npm run migrate:deploy
npm run prisma

## Important Files


backend/server.js
backend/prisma/schema.prisma
backend/lib/aiService.js
backend/lib/organizationPermissions.js
backend/.env.example
backend/Dockerfile


## Environment Variables

Used by backend:
DATABASE_URL
JWT_SECRET
PORT
FRONTEND_URL
APP_URL
PUBLIC_API_URL
UPLOADS_DIR
CORS_ALLOWED_ORIGINS
OPENAI_API_KEY
OPENAI_MODEL
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
PRAYER_NOTIFICATION_JOB_ENABLED
PRAYER_NOTIFICATION_POLL_MS
PRAYER_NOTIFICATION_LOOKAHEAD_MS
REDIS_URL

## Main Responsibilities

- User registration
- User login
- JWT authentication
- Password reset
- Profile updates
- Account type management
- Organization creation
- Organization onboarding
- Masjid profile management
- Feed posts
- Comments
- Likes
- Saved posts
- Event creation
- Event registration
- Event subscriptions
- Job and volunteer opportunities
- Applications
- Messaging
- Message reactions
- Group chats
- Push notifications
- Notification preferences
- Prayer time reminders
- AI moderation
- AI translations
- AI post/newsletter generation
- Location-based masjid discovery

Client
  ↓
Express API
  ↓
Prisma ORM
  ↓
Neon PostgreSQL

Socket.IO
  ↓
Realtime messaging / typing

Redis
  ↓
Cache / production support

Web Push
  ↓
Browser push notifications

OpenAI
  ↓
AI features


## Authentication

Authentication uses:

- JWT
- bcrypt password hashing
- auth middleware
- role/account type checks

Account types:

- USER
- MASJID
- MSA
- IMAM
- STUDENT_OF_KNOWLEDGE
- BUSINESS
- ADMIN

## AI Backend

AI support exists through:

```
backend/lib/aiService.js
```

Used for:

- Moderation
- Text generation
- Image/poster extraction
- Translation
- Recommendations
- Newsletter draft generation

Configured by:

```
OPENAI_API_KEYOPENAI_MODEL=gpt-4o-mini
```

## Notification Backend

Notification system includes:

- VAPID web push
- Push subscriptions
- Notification preferences
- Notification history
- Prayer reminder job
- Followed/favorite masjid notifications

Configured by:

```
VAPID_PUBLIC_KEYVAPID_PRIVATE_KEYVAPID_SUBJECTPRAYER_NOTIFICATION_JOB_ENABLED=true
```

## Technical Debt

Highest priority backend cleanup:

- Split `server.js` into smaller files.
- Move routes into `routes/`.
- Move business logic into `services/`.
- Move repeated permission logic into middleware/services.
- Add request validation.
- Add tests.
- Add OpenAPI docs.
- Add structured logging.
- Add better error handling.

