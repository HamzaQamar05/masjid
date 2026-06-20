Before making any changes, read and understand:
docs/PRODUCT_VISION.md
docs/UI_GUIDELINES.md
If any implementation decision conflicts with these documents, follow the documents.

After completing work, explain:
1. What was changed
2. Which sections of PRODUCT_VISION.md were addressed
3. Any remaining gaps between the implementation and the product vision


Ummah Connect — Dashboard + Workflow Documentation
Note: comment out explanations in code for understanding

1. Goal
Build separate experiences for each account type:
User Dashboard: normal community member experience.
Masjid Dashboard: professional/admin dashboard for masjid staff.
Imam Dashboard: professional dashboard for imams/speakers.
Admin Dashboard: platform owner dashboard to create/manage masjids, users, reports, and approvals.
Make optimal as well, like the admin page should be searchable not scroll through every post/masjid. Same for every category it should be searchable. Masjid should be able to see everything they posted easily
Use Instagram as inspiration:
Normal users see a social feed.
Masjids/Imams get a professional-style dashboard with insights, requests, posts, and management tools.

2. Account Types
User
A normal community member.
Users can:
View posts from masjids they follow.
Follow/unfollow masjids.
Apply for volunteering opportunities.
Apply for job opportunities.
Message masjids, imams, and other users.
View nearby masjids.
View events, announcements, and prayer-related updates.
Masjid
A masjid organization account.
Masjids should be created by the platform admin for now.
Masjid profile details:
Masjid name
Address/location
Phone number
Email
Website
Instagram/Facebook/social links
Description
Logo/image
Prayer time settings/API info
Admin contact person
Masjids can:
Create/delete posts.
Create/delete volunteering opportunities.
Create/delete job opportunities.
View volunteering requests.
View job applications.
Message users.
Message other masjids.
Be followed by users.
View their followers.
Access a professional dashboard.
Imam
An imam/speaker/student of knowledge account.
Imams can:
Create profile.
Show bio, topics, credentials, location, socials.
Be contacted by masjids/users.
Possibly post reminders/content.
View messages.
Later: accept speaking requests or event invitations.
Admin
Platform owner account.
Admins can:
Create masjid accounts.
Edit masjid details.
Delete/suspend masjids.
Manage users.
Manage imams.
View all posts/opportunities.
Review reports.
Control roles and permissions.
3. Homepage / Feed Changes
Current homepage masjid cards should be replaced with a social feed.
Feed Content
The feed should show:
Masjid posts
Announcements
Events
Volunteering opportunities
Job opportunities
Imam reminders/posts later
Posts should look like Instagram-style cards:
Masjid profile image
Masjid name
Post date
Image optional
Text content
Like/save/share optional later
Comment optional later
“Apply” button if opportunity post
Feed Rules
Users see posts from followed masjids first.
Then show nearby masjid posts.
Then show general public posts.
Masjids can create and delete their own posts.
Admin can delete any post.
4. Messaging Changes
Move messaging to the top-right corner like Instagram DMs / Facebook Messenger.
UI Placement
Top nav should include:
Home/feed icon
Search icon
DM/message icon in top-right
Profile/dashboard icon
Messaging Format
Messaging should look like modern DMs:
Inbox screen
List of conversations
Profile image
Name
Last message preview
Timestamp
Unread badge
Search conversations bar
Chat screen
Header with profile image/name
Message bubbles
Sent messages aligned right
Received messages aligned left
Typing indicator
Online status optional
Input bar fixed at bottom
Send button
Unsend/react optional later
Message Types
Allow:
User ↔ User
User ↔ Masjid
User ↔ Imam
Masjid ↔ Masjid
Masjid ↔ Imam

5. Masjid Workflow
Step 1 — Admin Creates Masjid
Admin enters:
Masjid name
Location/address
Contact email
Phone number
Website
Social links
Description
Logo/image
Login email for masjid admin
System creates masjid profile and masjid login account.
Step 2 — Masjid Logs In
Masjid sees professional dashboard.
Dashboard sections:
Overview
Posts
Volunteering
Jobs
Applications
Messages
Network
Profile Settings
Step 3 — Masjid Creates Posts
Masjid can create:
General announcement
Event post
Reminder
Fundraiser post
Class/program post
Fields:
Title
Description
Image optional
Post type
Date/time optional
Location optional
Masjid can delete its own posts.
Step 4 — Masjid Creates Volunteering Opportunities
Fields:
Title
Description
Date/time
Location
Number of volunteers needed
Requirements
Contact info optional
Users can apply.
Masjid dashboard shows:
Applicant name
Contact info
Message button
Status: pending / accepted / rejected
Step 5 — Masjid Creates Job Opportunities
Fields:
Job title
Description
Type: full-time / part-time / contract / volunteer
Location
Pay optional
Requirements
Deadline optional
Users can apply.
Masjid dashboard shows applications.
Step 6 — Masjid Network Section
Masjids have a network page showing other masjids.
Features:
Search masjids
Filter by location
View masjid profile
Follow/connect
Message masjid
Purpose:
Collaboration
Joint events
Resource sharing
Community networking

6. User Workflow
Step 1 — User Creates Account
User signs up with:
Name
Email
Password
Location optional
Role = User
Step 2 — User Sees Feed
User homepage shows:
Posts from followed masjids
Nearby masjid posts
Opportunities
Events
Step 3 — User Follows Masjids
User can follow masjids from:
Masjid profile
Search page
Nearby masjids page
Feed posts
Following a masjid affects feed ranking.
Step 4 — User Applies to Opportunities
For volunteering/jobs:
User clicks apply and submits:
Name
Email
Phone optional
Short message
Resume optional later
Application goes to masjid dashboard.
Step 5 — User Messages
User can message:
Masjids
Imams
Other users
Messages are accessed from top-right DM icon.

7. Imam Workflow
Step 1 — Imam Account Created
Either:
Admin creates imam account, or
Imam signs up and admin approves later.
Fields:
Name
Bio
Location
Topics/specialties
Credentials
Social links
Contact info
Profile image
Step 2 — Imam Dashboard
Imam sees:
Profile overview
Messages
Requests
Posts/reminders
Events invited to later
Step 3 — Messaging
Users and masjids can message imams.
Later feature:
Masjids can request imam for khutbah/class/event.

8. Dashboard Design
User Dashboard
Simple dashboard:
Profile
Followed masjids
Saved posts
Applications
Messages
Settings
Masjid Dashboard
Professional dashboard:
Total followers
Recent posts
Active opportunities
Pending volunteer requests
Pending job applications
Messages
Profile completion
Imam Dashboard
Professional dashboard:
Profile views later
Messages
Requests
Posts/reminders
Availability later
Admin Dashboard
Platform management:
Users
Masjids
Imams
Posts
Opportunities
Reports
Role management

9. Permissions
User
Can:
Read public posts
Follow masjids
Apply to opportunities
Message allowed accounts
Cannot:
Create masjid posts
Manage applications
Delete other content
Masjid
Can:
Create/delete own posts
Create/delete own opportunities
View own applications
Message users/masjids/imams
Edit own profile
Cannot:
Edit other masjids
Delete other masjid posts
Create other masjids
Imam
Can:
Edit own profile
Message users/masjids
Create own posts later
Admin
Can:
Full platform control
Create masjids
Manage roles
Delete inappropriate content

10. Database Models Needed
Suggested models:
User
Masjid
ImamProfile
Post
Follow
VolunteerOpportunity
VolunteerApplication
JobOpportunity
JobApplication
Conversation
Message
OrganizationNetworkConnection optional
Notification later

11. Build Order
Phase 1 — Core MVP
Admin can create masjids.
Masjid profile page exists.
Users can follow masjids.
Feed shows masjid posts.
Masjids can create/delete posts.
Messaging moved to top-right DM layout.
Basic user ↔ masjid messaging.
Phase 2 — Opportunities
Masjids create volunteering opportunities.
Users apply.
Masjid dashboard views requests.
Masjids create job opportunities.
Users apply.
Masjid dashboard views job applications.
Phase 3 — Network
Masjid network page.
Masjids can search other masjids.
Masjid ↔ masjid messaging.
Follow/connect masjids.
Phase 4 — Imam Features
Imam profiles.
Imam dashboard.
Imam messaging.
Masjid requests to imams.

12. AI Builder Prompt
Build a role-based dashboard system for my Ummah Connect app.
Create separate dashboards for User, Masjid, Imam, and Admin accounts. Use an Instagram-style model where normal users get a social feed, while Masjid and Imam accounts get professional dashboards.
Replace the homepage masjid listing with a post feed. Masjids should be able to create and delete posts. Posts should show masjid name, profile image, content, date, optional image, and post type.
Move messaging to a top-right DM icon like Instagram/Facebook Messenger. Redesign messages into a modern DM layout with an inbox list, conversation previews, unread badges, chat bubbles, fixed input bar, and conversation header.
Create the Masjid workflow:
Admin creates masjid accounts for now.
Masjid details include name, location, socials, website, description, logo, phone, and email.
Masjids can create/delete posts.
Masjids can create/delete volunteering opportunities.
Masjids can create/delete job opportunities.
Masjids can view volunteering requests and job applications in their dashboard.
Masjids can be followed by users.
Masjids have a network section showing other masjids.
Masjids can message other masjids.
Create the User workflow:
Users can create accounts.
Users can follow masjids.
Users see posts from followed masjids and nearby masjids.
Users can apply to volunteering and job opportunities.
Users can message masjids, imams, and other users.
Users can manage profile, followed masjids, applications, and messages.
Create the Imam workflow:
Imams have profiles with bio, location, topics, credentials, socials, and contact information.
Imams have a dashboard.
Imams can receive messages from users and masjids.
Later, masjids can request imams for events/classes/khutbahs.
Create permissions so users, masjids, imams, and admins only access what they are allowed to manage.
Use clean mobile-first UI. Keep the app feeling like a social/community app, not a boring admin portal.

