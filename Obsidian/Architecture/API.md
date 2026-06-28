
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

The Mujtama API is the backend layer used by the Vercel frontend, Capacitor iOS app, and local development builds.

It handles authentication, users, masjids/organizations, posts, messaging, events, jobs, volunteer applications, notifications, prayer times, AI features, and location-based masjid discovery.

## Runtime

- Node.js
- Express 5
- Prisma
- PostgreSQL through Neon
- Socket.IO
- Redis
- Web Push
- OpenAI API

## Base URLs

Production frontend:

- https://masjid-nine-chi.vercel.app

Allowed client origins currently include:

- Vercel frontend
- `capacitor://localhost`
- `http://localhost`
- Local Vite frontend
- Older Vercel deployment URLs still present in code

## Main API Groups

### Health

- `GET /`
- `GET /api/health`

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/me`
- `PUT /api/me`

### Notifications

- `GET /api/notifications/vapid-public-key`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences`
- `POST /api/notifications/subscriptions`
- `DELETE /api/notifications/subscriptions`
- `GET /api/notifications/history`
- `PUT /api/notifications/history/read`

### Users and Social

- `GET /api/users`
- `GET /api/users/:id/social`
- `DELETE /api/users/:id`
- `PUT /api/users/:id/role`
- `POST /api/users/:id/password-reset`
- `GET /api/users/:id/warnings`
- `POST /api/users/:id/warnings`

### Connections

- `POST /api/connections/:userId`
- `DELETE /api/connections/:userId`
- `PUT /api/connections/:connectionId`
- `GET /api/connections`

### Organizations / Masjids

- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/organizations/:id`
- `PUT /api/organizations/:id`
- `POST /api/organizations/:id/onboard`
- `GET /api/me/organizations`
- `GET /api/me/notification-masjids`
- `GET /api/me/favorite-masjids`
- `GET /api/display/:masjidId`

### AI

- `POST /api/ai/moderate`
- `POST /api/ai/masjids/:id/generate-copy`
- `POST /api/ai/masjids/:id/extract-poster`
- `POST /api/ai/translate`
- `GET /api/ai/recommendations`
- `POST /api/ai/masjids/:id/newsletter`
- `PUT /api/ai/newsletters/:draftId`

### Posts / Feed

- `GET /api/posts`
- `POST /api/organizations/:id/posts`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/save`
- `DELETE /api/posts/:id/save`
- `POST /api/posts/:id/like`
- `DELETE /api/posts/:id/like`
- `POST /api/posts/:id/comments`
- `DELETE /api/posts/:postId/comments/:commentId`

### Organization Following

- `POST /api/organizations/:id/follow`
- `DELETE /api/organizations/:id/follow`
- `POST /api/organizations/:id/favorite`
- `DELETE /api/organizations/:id/favorite`
- `DELETE /api/organizations/:id/followers/:userId`

### Organization People

- `POST /api/organizations/:id/people`
- `POST /api/organizations/:id/people/invite`
- `DELETE /api/organizations/:id/people/:userId`

### Events

- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:eventId`
- `DELETE /api/events/:eventId`
- `POST /api/events/:eventId/subscribe`
- `DELETE /api/events/:eventId/subscribe`
- `POST /api/events/:eventId/register`
- `PUT /api/events/:eventId/registrations/:registrationId`
- `PUT /api/events/:eventId/registrations`
- `DELETE /api/events/:eventId/register`

### Jobs / Volunteer / Opportunities

- `GET /api/opportunities`
- `POST /api/organizations/:id/opportunities`
- `PUT /api/opportunities/:id`
- `DELETE /api/opportunities/:id`
- `POST /api/opportunities/:id/apply`
- `PUT /api/opportunities/:id/applications`
- `PUT /api/opportunities/:id/applications/:applicationId`

### Messaging

- `GET /api/messages/threads`
- `GET /api/messages/:userId`
- `POST /api/messages`
- `PUT /api/messages/threads/:userId`
- `DELETE /api/messages/threads/:userId`
- `DELETE /api/messages/:messageId`
- `POST /api/messages/:messageId/reactions`

### Groups

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId/messages`
- `POST /api/groups/:groupId/messages`
- `PUT /api/groups/:groupId`

### Location / Prayer

- `GET /api/location/masjids`
- `GET /api/prayer-times`

## Realtime API

Socket.IO is used for realtime messaging and typing state.

Socket events currently include:

- `thread:join`
- `thread:leave`
- `typing:start`
- `typing:stop`
- `disconnect`

## API Risks

- `backend/server.js` currently contains too much application logic.
- Routes, controllers, services, jobs, and validation should eventually be separated.
- API documentation should eventually be converted into OpenAPI/Swagger.