```
# `Architecture/Security.md````md# SecurityRepository: https://github.com/HamzaQamar05/masjid## Security PurposeMujtama handles user accounts, masjid admin accounts, private messages, push notifications, organization data, applications, and future donations.Security must be treated as a core product feature, not an afterthought.## Current Security Controls### Authentication- JWT-based login- bcrypt password hashing- Password reset flow- Authenticated `/api/me`- Role/account type checks### AuthorizationAccount types:- USER- MASJID- MSA- IMAM- STUDENT_OF_KNOWLEDGE- BUSINESS- ADMINOrganization permissions handled partly through:```txtbackend/lib/organizationPermissions.js
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
### API Protection

- CORS allowlist
- Rate limiting
- Auth limiter
- Password reset limiter
- Message limiter
- Notification limiter
- AI limiter

### Secrets

Stored in environment variables:

```
DATABASE_URLJWT_SECRETOPENAI_API_KEYVAPID_PRIVATE_KEYVAPID_PUBLIC_KEYVAPID_SUBJECT
```

Secrets should live in:

- GitHub Secrets
- VPS backend `.env`
- Vercel environment variables
- Render environment variables if used as backup

Secrets should never be committed.

### Push Notifications

Uses VAPID keys.

Push-related risks:

- Invalid subscriptions
- Stale subscriptions
- Spam notifications
- Notification permission issues
- Privacy leaks in notification body

### AI Security

AI features use OpenAI.

Risks:

- Prompt injection
- Unsafe generated content
- Hallucinated Islamic/community content
- Abuse of AI endpoints
- Cost spikes

Existing protection:

- AI limiter
- AI moderation endpoint
- AI usage/caching models

### File / Media Security

Uploads exist through backend media volume.

Risks:

- Large files
- Malicious uploads
- Unsafe file names
- Private data leakage
- Missing malware scanning

## Immediate Security TODO

- [ ]  Rotate any exposed real secrets.
- [ ]  Use strong JWT secret in production.
- [ ]  Remove old Vercel origins if no longer needed.
- [ ]  Add refresh tokens or session model.
- [ ]  Add account/session revocation.
- [ ]  Add security headers.
- [ ]  Add stricter upload validation.
- [ ]  Add admin audit logs.
- [ ]  Add moderation/reporting system.
- [ ]  Add backup/restore plan.
- [ ]  Add dependency scanning.
- [ ]  Add rate limits for all sensitive endpoints.
- [ ]  Add production logging without leaking secrets.

## Future Security Features

- 2FA
- Passkeys
- Apple Login
- Google Login
- Device sessions
- Login history
- Admin audit logs
- Organization audit logs
- Report user/post/message
- Content moderation queue
- Encrypted attachments
- Payment security for donations
- Privacy controls for profiles
- Account deletion/export

## Security Notes For Codex

When making backend changes:

- Never expose env variables.
- Never log secrets.
- Never put API keys into frontend code.
- Check authorization before modifying organization-owned data.
- Do not let normal users access admin endpoints.
- Validate all request bodies.
- Rate limit sensitive endpoints.
- Keep Prisma queries scoped to the current user/org.