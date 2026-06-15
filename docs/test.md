deploy test

Notification launch checklist

1. Backend env:
   - DATABASE_URL points at the intended database.
   - JWT_SECRET is a long production secret.
   - FRONTEND_URL matches the deployed web/app URL.
   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are set.
   - PRAYER_NOTIFICATION_JOB_ENABLED=true unless another scheduler owns prayer reminders.
   - WHATSAPP_ENABLED=false for launch unless a separate WhatsApp sender service is deployed.
   - If WhatsApp is enabled, WHATSAPP_SERVICE_URL points to the isolated sender service and WHATSAPP_SERVICE_TOKEN is set.

2. Register or log in as a community user.
   - Confirm login persists after refreshing and closing/reopening the app.
   - Open Home or Prayer and verify the in-app notification card appears before the browser permission prompt.

3. Enable notifications.
   - Click Enable notifications.
   - Confirm browser/device permission is granted.
   - Confirm Settings or Prayer shows at least one saved device subscription.
   - If permission is denied, confirm the UI explains how to re-enable it.

4. Save location and prayer preferences.
   - Allow GPS or save a manual city.
   - Enable prayer reminders.
   - Choose enabled prayers and an offset.
   - Watch backend logs for "Prayer notification job enabled" and "Prayer notification processed".

5. Follow/favorite masjid notifications.
   - Follow and favorite a masjid from a user account.
   - From that masjid/admin account, create an event.
   - Confirm the follower/favorite user receives a push and the API response includes a push summary.
   - Create announcement/class/job/volunteer posts and confirm eligible followers/favorites are notified.

6. Message notification.
   - Send a DM from one account to another.
   - Confirm unread count updates through sockets.
   - Confirm the receiver gets a push unless message notifications are disabled in settings.

7. Failure checks.
   - Temporarily remove VAPID keys in a non-production environment and confirm backend logs show push skipped rather than fake success.
   - Delete or invalidate a browser subscription and confirm stale subscriptions are cleaned after a failed send.

8. WhatsApp foundation.
   - Open Settings and save a phone number in E.164 format, for example +15551234567.
   - Toggle WhatsApp notifications on and confirm the saved state survives refresh.
   - With WHATSAPP_ENABLED=false, create a followed masjid event/post and confirm push still works while WhatsApp returns a disabled summary.
   - With WHATSAPP_ENABLED=true but no WHATSAPP_SERVICE_URL, confirm backend logs show WhatsApp skipped as not configured.
