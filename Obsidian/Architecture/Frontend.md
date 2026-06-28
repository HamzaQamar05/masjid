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
  
The frontend is the main user interface for Mujtama.  
  
It is built as a React/Vite app and deployed on Vercel. It is also wrapped with Capacitor for iOS/mobile development.  
  
## Stack  
  
- React 18  
- Vite  
- React Router  
- Socket.IO Client  
- Capacitor  
- Lucide React Icons  
- Vercel Speed Insights  
- Service Worker  
  
## Main Frontend Location  
   
src/

Important files:


src/App.jsxsrc/main.jsxsrc/styles/global.csssrc/sw.jssrc/components/AuthScreen.jsxsrc/components/MasjidTvDisplay.jsxsrc/lib/apiClient.jssrc/lib/authStorage.jssrc/lib/nativeApp.jssrc/lib/account.jssrc/lib/masjid.jssrc/lib/geo.jssrc/lib/date.jssrc/lib/text.js

## Frontend Deployment

Frontend is deployed on Vercel.

Production frontend URL:

```
https://masjid-nine-chi.vercel.app
```Vercel config:

```
vercel.json
```

Vercel rewrites all routes to:

```
/index.html
```

This supports client-side routing.

## API Connection

Frontend API base comes from:

```
VITE_API_URL
```

Defined in:

```
src/lib/authStorage.js
```

Fallback local backend:

```
http://localhost:5000
```

## Authentication Storage

Auth state is stored using:

- localStorage
- sessionStorage
- Capacitor Preferences for native apps

Files:

```
src/lib/authStorage.js
```

Stored keys:

```
tokenuser
```

## Native App Support

Capacitor is used for iOS/mobile.

Capacitor config:

```
capacitor.config.json
```

App ID:

```
com.mujtama.app
```

App name:

```
Mujtama
```

Web directory:

```
dist
```

Native support includes:

- Browser
- Geolocation
- Local Notifications
- Push Notifications
- Preferences

Native helper file:

```
src/lib/nativeApp.js
```

## iOS Development

iOS build/check exists in GitHub Actions:

```
.github/workflows/ios-build.yml
```

Workflow does:

- Install Node
- `npm ci`
- `npm run build`
- `npx cap sync ios`
- Builds iOS simulator with Xcode

Capacitor scripts:

```
npm run mobile:buildnpm run mobile:open:iosnpm run prepare:mobile
```

## Current UI Areas

The frontend currently covers:

- Authentication
- Feed
- Masjid profiles
- User profiles
- Messaging
- Notifications
- Prayer times
- Events
- Jobs/opportunities
- Volunteer applications
- Search
- Settings
- Admin/organization dashboard
- Masjid TV display
- AI-assisted features

## Frontend Risks

- `App.jsx` is very large.
- Many features are centralized in one file.
- Should be split into pages/components/hooks.
- Need stronger frontend architecture before scaling.

## Recommended Frontend Refactor

Future structure:

```
src/  pages/  components/  features/    auth/    feed/    messaging/    notifications/    organizations/    events/    jobs/    prayer/  hooks/  lib/  styles/
```

## Future Improvements

- Split App.jsx
- Add proper route structure
- Add loading/error states consistently
- Improve offline handling
- Improve iOS push notification support
- Improve accessibility
- Add form validation layer
- Add frontend tests