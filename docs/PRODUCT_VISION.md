
Before making any changes, read and understand:
docs/PRODUCT_VISION.md
docs/UI_GUIDELINES.md
If any implementation decision conflicts with these documents, follow the documents.

After completing work, explain:
1. What was changed
2. Which sections of PRODUCT_VISION.md were addressed
3. Any remaining gaps between the implementation and the product vision

You are improving my Masjid community platform frontend and workflows.

The app currently feels too much like a demo. I want it to feel like a real product combining:

* Instagram for feed, profiles, posts, DMs
* LinkedIn for professional organization profiles and networking
* Indeed for job/volunteer applications

Main issue:
Masjid accounts currently feel too similar to normal user accounts. This is wrong. A masjid should feel like a professional organization account with its own tools, dashboards, and management workflows.

Do a full frontend and workflow refactor with these priorities:

1. Separate User and Masjid experiences completely

Masjid accounts should NOT be able to apply to volunteer opportunities or jobs like normal users.

If the logged-in account is a masjid:

* Hide user-only actions like “Apply”
* Hide user-style profile flows
* Show masjid management tools instead
* Use professional dashboard layout
* Prioritize posts, prayer times, jobs, volunteers, classes, imams, applications, and messages

If the logged-in account is a user:

* Show feed
* Show follow masjid options
* Show job/volunteer application options
* Show user profile, saved posts, messages, and applications

2. Build a real Masjid dashboard

Create a comfortable masjid dashboard with sections/cards for:

* Create post
* Manage posts
* Manage prayer times
* Manage classes/programs
* Manage volunteer opportunities
* Manage job opportunities
* View volunteer applications
* View job applications
* Add/manage imams
* View messages
* View followers
* Edit masjid profile
* Network with other masjids

The masjid dashboard should feel like a LinkedIn company page mixed with a professional admin portal.

3. Make post creation easy

Masjids should be able to quickly create posts with:

* Title
* Description
* Image optional
* Post type: announcement, event, reminder, fundraiser, class, volunteer, job
* Date/time optional
* Location optional

The create post UI should be clean, simple, and obvious.

4. Add profile pictures and banners

Add support in the UI for:

* Profile picture/avatar
* Profile banner/cover image
* Default banner choices
* Default profile image fallback

Profiles should look much more complete.

For masjid profiles:

* Banner image
* Profile logo
* Masjid name
* Location
* Website
* Social links
* Description
* Prayer times
* Classes
* Posts
* Jobs
* Volunteer opportunities
* Message button
* Follow button for users only

For user profiles:

* Banner image
* Profile picture
* Name
* Bio
* Location optional
* Followed masjids
* Applications
* Posts/saved posts if available

5. Improve networking page

Networking should look like LinkedIn.

Each network card should show:

* Profile picture/logo
* Banner or visual accent
* Name
* Role/type: User, Masjid, Imam, Business, etc.
* Location
* Short bio/description
* View profile button
* Message button
* Follow/connect button when applicable

Clicking a profile should open a detailed profile page.

6. Improve job and volunteer applications

Make applications feel like Indeed.

Masjids should be able to create job/volunteer listings with:

* Title
* Description
* Requirements
* Location
* Type: full-time, part-time, contract, volunteer
* Deadline optional
* Custom application questions

Custom application questions should support:

* Short answer
* Long answer
* Yes/no
* Multiple choice later if easy

Users should apply through a clean popup/modal.

Application modal should include:

* Name
* Email
* Phone optional
* Resume upload placeholder optional
* Cover message
* Answers to custom questions
* Submit button

After applying:

* User sees application status
* Masjid sees the application in its dashboard

7. Build a better masjid application portal

Masjid dashboard should show job/volunteer applications in a clean portal.

Each application card/table should show:

* Applicant name
* Email
* Phone
* Listing applied to
* Answers to questions
* Status: new, reviewing, interview, accepted, rejected
* Buttons:

  * View application
  * Email applicant
  * Message applicant
  * Mark as reviewing
  * Move to interview
  * Accept
  * Reject

This should feel like a simple applicant tracking system.

8. Prayer times management

Masjids need a dedicated prayer times section.

Masjid should be able to set/update:

* Fajr
* Dhuhr
* Asr
* Maghrib
* Isha
* Jumuah times
* Ramadan mode later
* Notes/announcements

Prayer times should show on the masjid profile and possibly homepage/feed.

9. Classes and programs

Masjids should be able to create classes/programs.

Fields:

* Class title
* Teacher/imam
* Description
* Day/time
* Location
* Gender/family notes optional
* Registration link optional

Users should be able to view classes on the masjid profile.

10. Imams management

Masjids should be able to add/manage imams.

Imam profile fields:

* Name
* Profile picture
* Bio
* Topics/specialties
* Credentials
* Contact/message option
* Linked masjid

Show imams on the masjid profile.

11. Redesign messaging like Instagram DMs

Move the message icon to the top-right.

Do not keep messaging as a normal nav tab.

Messaging should have:

* Top-right DM icon
* Inbox list
* Search conversations
* Profile pictures
* Last message preview
* Unread badges
* Chat screen with bubbles
* Sent messages on right
* Received messages on left
* Fixed message input at bottom
* Clean mobile-first layout
* Clicking message opens chat immediately

Make it feel like Instagram DMs or Facebook Messenger.

12. Add dark mode

Add a dark mode toggle.

Requirements:

* Button in top nav or settings
* Save preference in localStorage
* Use CSS variables
* Light and dark themes should both look polished
* Dark mode should not break text contrast

13. Make the whole UI less plain

The current UI feels basic/sluggish.

Improve:

* Cards
* Shadows
* Spacing
* Typography
* Profile images
* Banners
* Empty states
* Buttons
* Modals
* Form layouts
* Dashboard sections
* Mobile responsiveness

Make it feel like a finished SaaS/social product, not a demo.

14. Role-based UI rules

Implement clear role-based rendering.

User sees:

* Feed
* Follow masjids
* Apply to jobs/volunteers
* Message
* User profile
* Saved/applied items

Masjid sees:

* Dashboard
* Create/manage posts
* Manage prayer times
* Manage classes
* Manage imams
* Manage jobs
* Manage volunteers
* View applications
* Message users/masjids/imams
* Network page

Imam sees:

* Profile
* Messages
* Linked masjid
* Classes/events
* Requests later

Admin sees:
CRITICAL PROJECT CONTEXT

This project is not a generic CRUD application.

The goal is to build a production-ready Muslim community platform that combines:

- Instagram (social feed, profiles, posts, DMs)
- LinkedIn (professional organization pages, networking, dashboards)
- Indeed (job and volunteer applications)

Before making ANY changes:

1. Re-read this entire prompt.
2. Verify that your changes support the overall product vision.
3. Do not optimize only for the current task.
4. Maintain consistency with the long-term architecture.
5. If implementing a feature, explain how it fits into the overall product.
6. Never replace existing working functionality unless necessary.
7. Prefer extending existing components over creating duplicate systems.
8. At the end of every response, provide:
   - What was changed
   - What remains incomplete
   - How this fits into the product vision

Treat this instruction as a permanent system requirement for the entire session.

* Create masjids
* Manage all accounts
* Manage posts
* Manage reports
* Manage platform settings

15. Important implementation instructions

Before coding:

* Inspect the current React component structure
* Find where roles are checked
* Find current messaging screen
* Find current profile/network/feed components
* Reuse existing API calls where possible
* Do not break backend auth
* Do not remove existing working features
* Add frontend-only placeholders where backend support does not exist yet
* Clearly mark TODOs for backend endpoints needed

Focus first on:

1. Separate masjid dashboard from user dashboard
2. Hide apply buttons for masjids
3. Better job/volunteer application modal
4. Masjid application management portal
5. Prayer times management UI
6. Profile pictures and banners
7. Instagram-style DMs
8. Dark mode
9. Better networking cards
10. Better overall visual polish

The final result should feel like a real platform for masjids, not a user account with a different label.


     Before every response, ask yourself:

"Does this change make the application feel more like Instagram + LinkedIn + Indeed for Masjids?"

If the answer is no, rethink the implementation.
