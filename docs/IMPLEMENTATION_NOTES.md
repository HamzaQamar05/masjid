# Implementation Notes

## 2026-06 improvement pass

### Product direction
The app is now organized around a clearer first release:

1. Community users discover/follow masjids, read updates, save events, apply to roles, and message people.
2. Masjid/MSA accounts land on a professional dashboard instead of the normal user home feed.
3. Masjid operators get a launch-readiness checklist focused on the pieces that make the product pitch-ready: profile, contact details, prayer/Jumuah times, announcements, events/classes, and public profile preview.

### Code structure
Shared frontend helpers were moved out of `App.jsx`:

- `src/lib/authStorage.js` — token, user session storage, API base.
- `src/lib/apiClient.js` — authenticated fetch wrapper.
- `src/lib/account.js` — account type, role, preferences, and job eligibility helpers.
- `src/lib/text.js` — list, initials, normalization, and HTML escaping helpers.
- `src/lib/date.js` — date input formatting.
- `src/lib/masjid.js` — prayer-time dashboard helpers and masjid utility data.

Backend organization role matching was moved to:

- `backend/lib/organizationPermissions.js`

### Security and repo hygiene
Do not commit or share real `.env` files or `node_modules`. Use `.env.example` and `backend/.env.example` as the templates.

### Still recommended next
- Split `src/App.jsx` into feature screens after this helper extraction.
- Split `backend/server.js` into route files.
- Replace image URL fields with first-class file upload UI.
- Add integration tests for auth, organization permissions, posts, applications, messages, and notifications.
