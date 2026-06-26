deploy test

Native launch checklist

1. Backend env:
   - DATABASE_URL points at the intended database.
   - JWT_SECRET is a long production secret.
   - FRONTEND_URL matches the deployed web/app URL.
   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are set only when web push is re-enabled.
   - PRAYER_NOTIFICATION_JOB_ENABLED=true unless another scheduler owns prayer reminders.
   - Production startup must use `prisma migrate deploy`; do not run `prisma db push` against production data.

2. Register or log in as a community user.
   - Confirm login persists after refreshing and closing/reopening the app.
   - Confirm the app asks for location after sign-in and uses fallback masjid/prayer data if permission is denied.
   - Confirm the app asks for notification permission after sign-in without showing an install prompt or startup checklist.
   - Open Prayer and verify the notification card reflects device permission status.

3. Enable notifications.
   - Confirm device notification permission is granted.
   - Confirm Settings or Prayer shows notification preferences.
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
   - Open the notification bell and confirm the DM appears in notification history, then becomes read after opening the sheet.

7. Failure checks.
   - Temporarily remove VAPID keys in a non-production environment and confirm backend logs show push skipped rather than fake success.
   - Delete or invalidate a browser subscription and confirm stale subscriptions are cleaned after a failed send.
   - Create an event/post with push disabled and confirm the in-app notification history still records eligible notifications.
