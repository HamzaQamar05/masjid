# Mujtama Final QA

## Real-device permission QA

Use a fresh install or clear app data before each run.

### iOS

1. Open the app and log in.
2. Confirm the Mujtama permission intro appears before any iOS permission prompt.
3. Tap **Enable location**.
4. Confirm iOS shows the location prompt with the Mujtama purpose copy.
5. Allow location and confirm Prayer/Masjids refresh from fallback data to current-location data.
6. Tap **Enable notifications**.
7. Allow notifications and confirm prayer/message notification status changes to enabled.
8. Force close and reopen the app, then confirm the permission intro does not reappear for the same user after Done/Maybe later.

### Android

1. Open the app and log in.
2. Confirm the Mujtama permission intro appears before any Android permission prompt.
3. Tap **Enable location**.
4. Allow precise or approximate location and confirm Prayer/Masjids refresh.
5. Tap **Enable notifications** on Android 13+ and allow notifications.
6. Confirm notification status changes to enabled and no browser-style permission prompt appears before tapping Enable.
7. Clear app data and repeat with Deny for both permissions to confirm fallback data and error toasts are clear.

## Google Search Console

1. Add a **Domain** property for `mujtamaconnect.com`.
2. Copy the TXT record Google gives you.
3. Add the TXT record at the DNS host for `mujtamaconnect.com`.
4. Wait for DNS propagation, then click **Verify** in Search Console.
5. Submit `https://mujtamaconnect.com/sitemap.xml`.
6. Use URL Inspection for `https://mujtamaconnect.com/` and request indexing.
7. Use URL Inspection for `https://mujtamaconnect.com/app` only after the public landing page is indexed.

Mujtama already ships `robots.txt`, `sitemap.xml`, route-aware metadata, canonical tags, and JSON-LD. Search Console ownership still requires the account-specific TXT record from Google.
