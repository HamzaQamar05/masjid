## Related Notes  
  
- [[Backend]]  
- [[Frontend]]  
- [[Database]]  
- [[Security]]  
- [[Infrastructure]]  
- [[Authentication]]  
- [[Messaging]]  
- [[Notifications]]
DatabaseRepository: https://github.com/HamzaQamar05/masjid## Current DatabaseMujtama uses PostgreSQL through Neon.Production-style database URL points to Neon: neon.tech
```

ORM:

```
Prisma
```

Schema file:

```
backend/prisma/schema.prisma
```

## Datasource

```
datasource db {  provider = "postgresql"  url      = env("DATABASE_URL")}
```

## Core Enum

```
enum AccountType {  USER  MASJID  MSA  IMAM  STUDENT_OF_KNOWLEDGE  BUSINESS  ADMIN}
```

## Main Models

Current Prisma models include:

- User
- UserWarning
- UserNotificationPreference
- PushSubscription
- Notification
- Organization
- AiUsageLog
- AiCache
- AiNewsletterDraft
- Post
- SavedPost
- PostLike
- PostComment
- Event
- EventSubscription
- Connection
- EventRegistration
- Message
- ConversationPreference
- OrganizationFollow
- FavoriteMasjid
- OrganizationPerson
- Opportunity
- VolunteerApplication
- MessageReaction
- GroupChat
- GroupChatMember
- GroupMessage

## User Model Responsibilities

The `User` model is central.

It connects to:

- Created events
- Created posts
- Event registrations
- Sent messages
- Received messages
- Message reactions
- Conversation preferences
- Social connections
- Organization follows
- Favorite masjids
- Organization affiliations
- Volunteer applications
- Saved posts
- Event subscriptions
- Notification preferences
- Warnings
- Post likes
- Comments
- Push subscriptions
- Notifications
- Group chats
- AI usage logs
- AI cache
- AI newsletter drafts

## Organization / Masjid Data

Organizations represent masjids, MSAs, businesses, and related community entities.

Connected features include:

- Profiles
- Followers
- Favorite masjids
- Posts
- Events
- Jobs
- Volunteer opportunities
- Organization people/team members
- Notification targeting
- Masjid display page

## Feed Data

Feed-related models:

- Post
- SavedPost
- PostLike
- PostComment
- Organization
- User

## Messaging Data

Messaging-related models:

- Message
- MessageReaction
- ConversationPreference
- GroupChat
- GroupChatMember
- GroupMessage

## Events Data

Event-related models:

- Event
- EventRegistration
- EventSubscription
- User
- Organization

## Opportunities Data

Jobs and volunteer features use:

- Opportunity
- VolunteerApplication
- Organization
- User

## Notification Data

Notification system uses:

- Notification
- PushSubscription
- UserNotificationPreference
- User
- OrganizationFollow
- FavoriteMasjid

## AI Data

AI system uses:

- AiUsageLog
- AiCache
- AiNewsletterDraft

## Current Database Strengths

- Clear use of Prisma relations.
- Strong foundation for social app features.
- Supports multiple account types.
- Supports masjid/organization management.
- Supports feed, events, jobs, messaging, notifications, and AI.

## Database Risks

- Schema is already large.
- Future migrations need to be handled carefully.
- Need backups before production changes.
- Need indexes reviewed for feed, notifications, messaging, and search.
- Need audit logging before serious production usage.

## Future Improvements

- AuditLog model
- DeviceSession model
- RefreshToken model
- Report/Moderation models
- Search index
- Analytics tables
- Payment/Donation models
- Masjid subscription billing models
- AI embedding/recommendation tables