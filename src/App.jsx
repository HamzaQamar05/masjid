import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bookmark,
  Briefcase, 
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Download,
  Filter,
  Heart,
  HeartHandshake,
  Home,
  Library,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import {
  businesses,
  conversations,
  dashboardMetrics,
  defaultLocation,
  feedPosts,
  lectures,
  prayers,
  seedEvents,
  seedOrganizations,
  seedPeople,
  volunteerRoles
} from './data/seedData.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const defaultUser = {
  id: 'demo-user',
  name: 'Hamza Qamar',
  email: 'hamza@example.com',
  accountType: 'ADMIN',
  city: 'Milton',
  bio: 'Building the community operating system for masjids, MSAs, imams, volunteers, and Muslim professionals.',
  skills: ['Cloud', 'Cybersecurity', 'Volunteer ops'],
  availability: 'Open to help'
};

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'organizations', label: 'Masjids', icon: Building2 },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'volunteers', label: 'Volunteers', icon: HeartHandshake },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'lectures', label: 'Lectures', icon: Library },
  { key: 'businesses', label: 'Businesses', icon: Briefcase },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 }
];

function token() {
  return localStorage.getItem('token');
}

function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function initials(name = 'UC') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

function haversineKm(from, to) {
  if (!from || !to?.latitude || !to?.longitude) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelTimes(distanceKm) {
  if (!distanceKm && distanceKm !== 0) return { walk: 'TBD', drive: 'TBD' };
  return {
    walk: `${Math.max(1, Math.round(distanceKm / 5 * 60))} min walk`,
    drive: `${Math.max(1, Math.round(distanceKm / 35 * 60 + 3))} min drive`
  };
}

function directionsUrl(item) {
  const query = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : encodeURIComponent(item.address || item.place || item.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildSearchIndex(user, events, organizations, people) {
  const currentUser = {
    ...user,
    id: user.id || 'current-user',
    role: user.accountType,
    headline: user.bio,
    areas: user.skills || [],
    availability: user.availability || 'Available'
  };

  return [
    ...organizations.map((item) => ({ kind: item.type, title: item.name, subtitle: `${item.city} - ${item.tags.join(', ')}`, tab: 'organizations' })),
    ...events.map((item) => ({ kind: 'Event', title: item.title, subtitle: `${item.host} - ${item.tags?.join(', ') || ''}`, tab: 'events' })),
    ...people.concat(currentUser).map((item) => ({ kind: item.accountType || 'User', title: item.name, subtitle: `${item.role || item.accountType} - ${item.city || ''} - ${(item.areas || []).join(', ')}`, tab: 'network' })),
    ...volunteerRoles.map((item) => ({ kind: 'Volunteer', title: item.title, subtitle: `${item.org} - ${item.skill}`, tab: 'volunteers' })),
    ...lectures.map((item) => ({ kind: 'Lecture', title: item.title, subtitle: `${item.speaker} - ${item.category}`, tab: 'lectures' })),
    ...businesses.map((item) => ({ kind: 'Business', title: item.name, subtitle: `${item.category} - ${item.city}`, tab: 'businesses' }))
  ];
}

function Shell({ user, tab, setTab, children, onLogout, onAuthOpen, searchQuery, setSearchQuery, searchResults }) {
  const [navOpen, setNavOpen] = useState(false);

  function navigate(key) {
    setTab(key);
    setNavOpen(false);
  }

  return (
    <div className="app">
      <header className="top-nav">
        <button className="icon-button mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <button className="brand" onClick={() => navigate('home')} aria-label="Ummah Connect home">
          <span>UC</span>
          <strong>Ummah Connect</strong>
        </button>
        <div className="search-wrap">
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search Milton, Quran, youth, volunteer, TMU" />
          </label>
          {searchQuery && (
            <div className="search-results">
              {searchResults.length ? searchResults.map((result) => (
                <button key={`${result.kind}-${result.title}`} onClick={() => { navigate(result.tab); setSearchQuery(''); }}>
                  <span>{result.kind}</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </button>
              )) : <p>No matches yet. Try masjid, Quran, youth, volunteer, or Milton.</p>}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications">
            <Bell size={20} />
          </button>
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'post' : 'events')}>
            <Plus size={18} />
            <span>Post</span>
          </button>
          <button className="profile-chip" onClick={onAuthOpen}>
            <span>{initials(user.name)}</span>
            <strong>{user.name}</strong>
          </button>
        </div>
      </header>

      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head">
          <strong>Menu</strong>
          <button className="icon-button" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <NavigationList tab={tab} setTab={navigate} />
      </div>

      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} />
        <NavigationList tab={tab} setTab={navigate} />
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  );
}

function NavigationList({ tab, setTab }) {
  return (
    <nav className="side-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" />
      <div className="profile-body">
        <div className="profile-avatar">{initials(user.name)}</div>
        <h2>{user.name}</h2>
        <p>{user.bio}</p>
        <div className="profile-meta">
          <span>{user.accountType}</span>
          <span>{user.city}</span>
        </div>
        <button className="text-action" onClick={onLogout}>
          <LogOut size={16} />
          Reset demo profile
        </button>
      </div>
    </section>
  );
}

function HomeScreen({ user, events, organizations, location, locationStatus, requestLocation, prayerTimes, setTab, registerEvent, followedIds, toggleFollow }) {
  return (
    <div className="content-grid">
      <section className="feed-column">
        <HeroComposer user={user} setTab={setTab} />
        <NearbyMasjids organizations={organizations.slice(0, 3)} locationStatus={locationStatus} requestLocation={requestLocation} toggleFollow={toggleFollow} followedIds={followedIds} compact />
        {feedPosts.map((post) => (
          <FeedPost key={post.id} post={post} />
        ))}
      </section>

      <aside className="right-rail">
        <PrayerWidget prayerTimes={prayerTimes} location={location} />
        <section className="panel">
          <div className="section-title">
            <h2>Trending events</h2>
            <button onClick={() => setTab('events')}>See all</button>
          </div>
          <div className="stack">
            {events.slice(0, 2).map((event) => (
              <CompactEvent key={event.id} event={event} onRegister={registerEvent} />
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Admin pulse</h2>
            <button onClick={() => setTab('dashboard')}>Open</button>
          </div>
          <div className="metric-list">
            {dashboardMetrics.slice(0, 4).map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <em>{metric.change}</em>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function HeroComposer({ user, setTab }) {
  return (
    <section className="composer">
      <div className="composer-main">
        <div className="profile-avatar small">{initials(user.name)}</div>
        <button onClick={() => setTab(canPost(user) ? 'post' : 'events')}>Share an announcement, event, lecture, fundraiser, or volunteer role</button>
      </div>
      <div className="composer-actions">
        <button onClick={() => setTab('events')}><CalendarDays size={18} />Event</button>
        <button onClick={() => setTab('volunteers')}><HeartHandshake size={18} />Volunteer</button>
        <button onClick={() => setTab('messages')}><Mail size={18} />Message</button>
      </div>
    </section>
  );
}

function FeedPost({ post }) {
  return (
    <article className="feed-post">
      <div className="post-head">
        <div className="org-logo">{initials(post.org)}</div>
        <div>
          <h3>{post.org}</h3>
          <p>{post.role} - {post.time}</p>
        </div>
        <span>{post.type}</span>
      </div>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
      <TagRow tags={post.tags} />
      <div className="post-actions">
        <button><Heart size={18} />{post.reactions}</button>
        <button><MessageCircle size={18} />{post.comments}</button>
        <button><Send size={18} />Share</button>
      </div>
    </article>
  );
}

function PrayerWidget({ prayerTimes, location }) {
  return (
    <section className="panel prayer-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">{location.label || 'Your location'}</p>
          <h2>Prayer times today</h2>
        </div>
        <ShieldCheck size={22} />
      </div>
      <div className="prayer-grid detailed">
        {prayerTimes.map((item) => (
          <div key={item.name}>
            <span>{item.name}</span>
            <strong>{item.adhan}</strong>
            <em>Iqamah {item.iqamah}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function NearbyMasjids({ organizations, locationStatus, requestLocation, toggleFollow, followedIds, compact = false }) {
  return (
    <section className={compact ? 'panel nearby-panel' : 'nearby-panel'}>
      <div className="section-title">
        <div>
          <p className="eyebrow">GPS discovery</p>
          <h2>Nearby masjids</h2>
        </div>
        <button onClick={requestLocation}><Navigation size={16} /> Use GPS</button>
      </div>
      <p className="helper-text">{locationStatus}</p>
      <div className="nearby-list">
        {organizations.filter((org) => org.type === 'Masjid').map((org) => {
          const times = travelTimes(org.distanceKm);
          return (
            <article className="nearby-card" key={org.id}>
              <div>
                <h3>{org.name}</h3>
                <p>{org.distanceKm == null ? 'Distance pending' : `${org.distanceKm.toFixed(1)} km away`} - {times.walk} - {times.drive}</p>
              </div>
              <div className="nearby-actions">
                <a className="secondary-button" href={directionsUrl(org)} target="_blank" rel="noreferrer">Directions</a>
                <button className="primary-button" onClick={() => toggleFollow(org.id)}>{followedIds.includes(org.id) ? 'Following' : 'Follow'}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EventsScreen({ events, registerEvent, setTab, user }) {
  return (
    <Page title="Events" subtitle="Registration, capacity, waitlists, attendance tracking, QR check-in, reminders, and sponsor placements." action={canPost(user) ? { label: 'Post event', onClick: () => setTab('post') } : null}>
      <FilterBar items={['Nearby', 'Today', 'Youth', 'Sisters', 'Family', 'MSA', 'Fundraiser', 'Online']} />
      <div className="card-grid two">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onRegister={registerEvent} />
        ))}
      </div>
    </Page>
  );
}

function EventCard({ event, onRegister }) {
  const going = event.going || event.registrations?.length || 0;
  const remaining = Math.max((event.capacity || 0) - going, 0);
  const percent = event.capacity ? Math.min(100, Math.round((going / event.capacity) * 100)) : 0;

  return (
    <article className="event-card">
      <div className="event-top">
        <span>{event.type || 'Event'}</span>
        <button className="icon-button" aria-label="Save event"><Bookmark size={18} fill={event.saved ? 'currentColor' : 'none'} /></button>
      </div>
      <h3>{event.title}</h3>
      <p>{event.description || 'Community event details will appear here.'}</p>
      <div className="meta-line"><CalendarDays size={16} />{event.time || 'Time TBA'}</div>
      <div className="meta-line"><MapPin size={16} />{event.place || event.location || 'Location TBA'}</div>
      {event.sponsor && <div className="sponsor-strip">{event.sponsor}</div>}
      <TagRow tags={event.tags || []} />
      <div className="capacity-block">
        <div><strong>{event.capacity} seats</strong><span>{going} registered - {remaining} remaining - {event.waitlist} waitlist</span></div>
        <div className="progress"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="qr-row">
        <div className="qr-box"><QrCode size={34} /></div>
        <div>
          <strong>QR check-in ready</strong>
          <p>{event.checkedIn} attendees checked in</p>
        </div>
      </div>
      <div className="card-footer">
        <a href={directionsUrl(event)} target="_blank" rel="noreferrer">Directions</a>
        <button className="primary-button" onClick={() => onRegister?.(event.id)}>{remaining > 0 ? 'Register' : 'Join waitlist'}</button>
      </div>
    </article>
  );
}

function CompactEvent({ event, onRegister }) {
  return (
    <article className="compact-card">
      <span>{event.type}</span>
      <h3>{event.title}</h3>
      <p>{event.host}</p>
      <button onClick={() => onRegister(event.id)}>Register<ChevronRight size={16} /></button>
    </article>
  );
}

function OrganizationsScreen({ organizations, locationStatus, requestLocation, followedIds, toggleFollow }) {
  return (
    <Page title="Masjid Discovery" subtitle="GPS distance, walking and driving estimates, directions, verified profiles, follow state, donations, and iqamah times.">
      <NearbyMasjids organizations={organizations} locationStatus={locationStatus} requestLocation={requestLocation} toggleFollow={toggleFollow} followedIds={followedIds} />
      <FilterBar items={['Masjids near me', 'Youth programs', 'Sisters programs', 'MSAs', 'Charities', 'Classes']} />
      <div className="organization-grid">
        {organizations.map((org) => (
          <article className="organization-card" key={org.id}>
            <div className="org-cover" style={{ backgroundImage: `url(${org.cover})` }} />
            <div className="org-card-body">
              <div className="org-title-row">
                <div className="org-logo">{initials(org.name)}</div>
                <div>
                  <h3>{org.name}</h3>
                  <p>{org.type} - {org.city}</p>
                </div>
                {org.verified && <CheckCircle2 size={20} />}
              </div>
              <p>{org.description}</p>
              <TagRow tags={org.tags} />
              <div className="org-detail-row">
                <span>{org.followers.toLocaleString()} followers</span>
                <span>{org.distanceKm == null ? 'GPS pending' : `${org.distanceKm.toFixed(1)} km away`}</span>
              </div>
              {org.campaign && (
                <div className="donation-card">
                  <strong>{org.campaign.name}</strong>
                  <span>{formatMoney(org.campaign.raised)} raised of {formatMoney(org.campaign.goal)}</span>
                  <div className="progress"><span style={{ width: `${Math.round((org.campaign.raised / org.campaign.goal) * 100)}%` }} /></div>
                </div>
              )}
              <div className="card-footer">
                <a href={directionsUrl(org)} target="_blank" rel="noreferrer">Directions</a>
                <button className="primary-button" onClick={() => toggleFollow(org.id)}>{followedIds.includes(org.id) ? 'Following' : 'Follow'}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function NetworkScreen({ user, people, filter, setFilter }) {
  const registeredUser = {
    ...user,
    id: 'current-user',
    role: user.accountType,
    headline: user.bio,
    areas: user.skills || [],
    availability: user.availability || 'Available'
  };
  const visiblePeople = people.concat(registeredUser).filter((person) => filter === 'All' || person.accountType === filter);

  return (
    <Page title="Dynamic Network Directory" subtitle="Registered users automatically appear with category, location, availability, and skill filters.">
      <div className="filter-panel">
        <Filter size={18} />
        {['All', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'USER', 'ADMIN'].map((item) => (
          <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item.replaceAll('_', ' ')}</button>
        ))}
      </div>
      <div className="card-grid two">
        {visiblePeople.map((person) => (
          <article className="person-card" key={person.id}>
            <div className="profile-avatar">{initials(person.name)}</div>
            <div>
              <h3>{person.name}</h3>
              <p>{person.role} - {person.city}</p>
            </div>
            <p>{person.headline}</p>
            <TagRow tags={person.areas || []} />
            <div className="card-footer">
              <span>{person.availability}</span>
              <button className="primary-button"><UserCheck size={16} />Connect</button>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function VolunteersScreen({ roles, updateRole }) {
  const verifiedTotal = roles.reduce((sum, role) => sum + (role.verifiedHours || 0), 0);

  return (
    <Page title="Volunteer Hour Tracking" subtitle="Apply, approve, check in, check out, verify hours, and download student-ready proof.">
      <section className="hours-summary panel">
        <div>
          <p className="eyebrow">Verified Hours</p>
          <h2>Hamza Qamar - {verifiedTotal.toFixed(1)} hours</h2>
          <p>Food bank, donation desk, and event support hours can be verified by masjid admins.</p>
        </div>
        <button className="primary-button" onClick={() => window.print()}><Download size={18} />Download PDF</button>
      </section>
      <div className="card-grid two">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-icon"><HeartHandshake size={22} /></div>
            <h3>{role.title}</h3>
            <p>{role.org} - {role.shift}</p>
            <div className="role-meta">
              <span>{role.hours} hrs</span>
              <span>{role.skill}</span>
              <span>{role.applicants} applicants</span>
              <span>{role.status}</span>
            </div>
            <div className="check-row">
              <span>In: {role.checkIn || '--'}</span>
              <span>Out: {role.checkOut || '--'}</span>
              <strong>{role.verifiedHours} verified hrs</strong>
            </div>
            <div className="card-footer">
              <button className="secondary-button" onClick={() => updateRole(role.id, 'Approved')}>Approve</button>
              <button className="primary-button" onClick={() => updateRole(role.id, role.checkIn ? 'Checked out' : 'Checked in')}>{role.checkIn ? 'Check out' : 'Check in'}</button>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function MessagesScreen({ inbox, setInbox }) {
  const [draft, setDraft] = useState('Assalamu alaikum, I am available to volunteer this Saturday from 2pm to 5pm.');
  const active = inbox[0];

  function sendMessage() {
    if (!draft.trim()) return;
    setInbox((items) => items.map((item, index) => index === 0 ? { ...item, preview: draft, unread: 0, read: true } : item));
    setDraft('');
  }

  return (
    <Page title="Messaging" subtitle="User to imam, user to organization, and volunteer to masjid conversations with read-state scaffolding.">
      <div className="messaging-layout">
        <section className="panel inbox-list">
          {inbox.map((thread) => (
            <button key={thread.id} className={thread.id === active.id ? 'active' : ''}>
              <strong>{thread.name}</strong>
              <span>{thread.role}</span>
              <p>{thread.preview}</p>
              {thread.unread > 0 && <em>{thread.unread}</em>}
            </button>
          ))}
        </section>
        <section className="panel message-thread">
          <div className="thread-head">
            <div className="org-logo">{initials(active.name)}</div>
            <div>
              <h2>{active.name}</h2>
              <p>{active.read ? 'Read receipt enabled' : 'Unread'}</p>
            </div>
          </div>
          <div className="chat-bubble received">{active.preview}</div>
          <div className="chat-bubble sent">JazakAllah khair. I can help with intake and setup.</div>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button className="primary-button" onClick={sendMessage}><Send size={18} />Send message</button>
        </section>
      </div>
    </Page>
  );
}

function LecturesScreen() {
  return (
    <Page title="Lecture Library" subtitle="Audio, video, articles, saved lectures, and PDF notes by imams, teachers, and speakers.">
      <FilterBar items={['Aqeedah', 'Fiqh', 'Tafsir', 'Seerah', 'Marriage', 'Parenting', 'Youth']} />
      <div className="card-grid three">
        {lectures.map((lecture) => (
          <article className="library-card" key={lecture.id}>
            <div className="library-icon"><Library size={24} /></div>
            <span>{lecture.category}</span>
            <h3>{lecture.title}</h3>
            <p>{lecture.speaker}</p>
            <strong>{lecture.format}</strong>
            <button className="secondary-button">{lecture.saved ? 'Saved' : 'Save lecture'}</button>
          </article>
        ))}
      </div>
    </Page>
  );
}

function BusinessesScreen() {
  return (
    <Page title="Muslim Business Directory" subtitle="Paid business pages, sponsor placements, professional categories, and local discovery.">
      <div className="card-grid three">
        {businesses.map((business) => (
          <article className="business-card" key={business.id}>
            <Briefcase size={24} />
            <h3>{business.name}</h3>
            <p>{business.category} - {business.city}</p>
            <strong>{business.rating} rating</strong>
            <span className="sponsor-strip">Sponsors: {business.sponsor}</span>
            <button className="secondary-button">View page</button>
          </article>
        ))}
      </div>
    </Page>
  );
}

function DashboardScreen({ inbox, roles, events, followedIds }) {
  const verifiedHours = roles.reduce((sum, role) => sum + (role.verifiedHours || 0), 0);
  const unread = inbox.reduce((sum, item) => sum + item.unread, 0);
  const registrations = events.reduce((sum, event) => sum + (event.going || 0), 0);
  const checkIns = events.reduce((sum, event) => sum + (event.checkedIn || 0), 0);
  const liveMetrics = [
    { label: 'Live registrations', value: registrations.toLocaleString(), change: '+demo' },
    { label: 'QR check-ins', value: checkIns.toLocaleString(), change: '+today' },
    { label: 'Verified hours', value: verifiedHours.toFixed(1), change: '+approved' },
    { label: 'Unread messages', value: unread.toString(), change: '+inbox' },
    { label: 'Followed orgs', value: followedIds.length.toString(), change: '+feed' },
    ...dashboardMetrics.slice(0, 3)
  ];

  return (
    <Page title="Organization Dashboard" subtitle="What masjids pay for: registrations, followers, engagement, volunteer hours, messages, campaigns, and permissions.">
      <div className="metric-grid">
        {liveMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.change}</em>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section className="panel">
          <h2>Campaigns</h2>
          <div className="campaign-row">
            <CircleDollarSign size={22} />
            <div>
              <strong>Ramadan community fund</strong>
              <p>$18,420 raised of $30,000</p>
            </div>
          </div>
          <div className="progress"><span style={{ width: '61%' }} /></div>
        </section>
        <section className="panel">
          <h2>Role management</h2>
          <ul className="plain-list">
            <li>Admin can verify organizations and assign coordinators</li>
            <li>Imams can publish lectures and answer messages</li>
            <li>Volunteer coordinators approve shifts and hours</li>
          </ul>
        </section>
      </div>
    </Page>
  );
}

function PostEventScreen({ setTab, refreshEvents }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '', capacity: 100 });

  async function submit(event) {
    event.preventDefault();
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Could not post event');
      await refreshEvents();
      setTab('events');
    } catch (err) {
      console.error(err);
      alert('Backend is offline. Demo event publishing UI is ready.');
    }
  }

  return (
    <Page title="Post Event" subtitle="Publish events with capacity, waitlist, QR check-in, and attendance tracking fields.">
      <form className="post-form" onSubmit={submit}>
        <input required placeholder="Event title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <input required type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
        <input type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
        <button className="primary-button">Post event</button>
      </form>
    </Page>
  );
}

function Page({ title, subtitle, action, children }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Ummah Connect</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action && <button className="primary-button" onClick={action.onClick}><Plus size={18} />{action.label}</button>}
      </div>
      {children}
    </section>
  );
}

function FilterBar({ items }) {
  return (
    <div className="filter-bar">
      {items.map((item, index) => <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>)}
    </div>
  );
}

function TagRow({ tags }) {
  return (
    <div className="tag-row">
      {tags.map((tag) => <span key={tag}>{tag}</span>)}
    </div>
  );
}

function AuthModal({ onClose, onLogin }) {
  return (
    <div className="modal-backdrop">
      <div className="auth-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close login"><X size={20} /></button>
        <AuthScreen onLogin={(user) => { onLogin(user); onClose(); }} />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [events, setEvents] = useState(seedEvents);
  const [roles, setRoles] = useState(volunteerRoles);
  const [inbox, setInbox] = useState(conversations);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState('All');
  const [location, setLocation] = useState(defaultLocation);
  const [locationStatus, setLocationStatus] = useState('Using Milton demo location. Enable GPS to sort by your real distance.');
  const [prayerTimes, setPrayerTimes] = useState(prayers);
  const [followedIds, setFollowedIds] = useState(() => JSON.parse(localStorage.getItem('followedOrganizations') || '["hicc","imam-bukhari-centre"]'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? { ...defaultUser, ...JSON.parse(saved) } : defaultUser;
  });

  const organizationsWithDistance = useMemo(() => (
    seedOrganizations
      .map((org) => ({ ...org, distanceKm: haversineKm(location, org) }))
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
  ), [location]);

  const searchIndex = useMemo(() => buildSearchIndex(user, events, organizationsWithDistance, seedPeople), [user, events, organizationsWithDistance]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return searchIndex.filter((item) => `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 8);
  }, [searchIndex, searchQuery]);

  async function refreshEvents() {
    try {
      const res = await fetch(`${API}/api/events`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setEvents([...data, ...seedEvents]);
    } catch {
      setEvents(seedEvents);
    }
  }

  useEffect(() => {
    refreshEvents();
  }, []);

  useEffect(() => {
    localStorage.setItem('followedOrganizations', JSON.stringify(followedIds));
  }, [followedIds]);

  useEffect(() => {
    async function fetchPrayerTimes() {
      try {
        const today = new Date();
        const url = `https://api.aladhan.com/v1/timings/${Math.floor(today.getTime() / 1000)}?latitude=${location.latitude}&longitude=${location.longitude}&method=2`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Prayer API unavailable');
        const data = await res.json();
        const timings = data?.data?.timings || {};
        setPrayerTimes(prayers.map((item) => ({ ...item, adhan: (timings[item.name] || item.adhan).slice(0, 5) })));
      } catch {
        setPrayerTimes(prayers);
      }
    }
    fetchPrayerTimes();
  }, [location]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is not available in this browser. Showing Milton demo distances.');
      return;
    }
    setLocationStatus('Requesting browser GPS permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          label: 'Your GPS location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('GPS enabled. Masjids are sorted by closest distance.');
      },
      () => setLocationStatus('GPS permission was not granted. Showing Milton demo distances.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function registerEvent(id) {
    setEvents((items) => items.map((event) => event.id === id ? {
      ...event,
      going: event.going + (event.going >= event.capacity ? 0 : 1),
      waitlist: event.going >= event.capacity ? event.waitlist + 1 : event.waitlist
    } : event));

    try {
      const res = await fetch(`${API}/api/events/${id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) refreshEvents();
    } catch {
      // Local demo state already updated.
    }
  }

  function updateRole(id, nextStatus) {
    setRoles((items) => items.map((role) => {
      if (role.id !== id) return role;
      if (nextStatus === 'Approved') return { ...role, status: 'Approved' };
      if (nextStatus === 'Checked in') return { ...role, status: 'Checked in', checkIn: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
      return { ...role, status: 'Verified', checkOut: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), verifiedHours: role.hours };
    }));
  }

  function toggleFollow(id) {
    setFollowedIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(defaultUser);
  }

  const screens = {
    home: <HomeScreen user={user} events={events} organizations={organizationsWithDistance} location={location} locationStatus={locationStatus} requestLocation={requestLocation} prayerTimes={prayerTimes} setTab={setTab} registerEvent={registerEvent} followedIds={followedIds} toggleFollow={toggleFollow} />,
    events: <EventsScreen user={user} setTab={setTab} events={events} registerEvent={registerEvent} />,
    organizations: <OrganizationsScreen organizations={organizationsWithDistance} locationStatus={locationStatus} requestLocation={requestLocation} followedIds={followedIds} toggleFollow={toggleFollow} />,
    network: <NetworkScreen user={user} people={seedPeople} filter={networkFilter} setFilter={setNetworkFilter} />,
    volunteers: <VolunteersScreen roles={roles} updateRole={updateRole} />,
    messages: <MessagesScreen inbox={inbox} setInbox={setInbox} />,
    lectures: <LecturesScreen />,
    businesses: <BusinessesScreen />,
    dashboard: <DashboardScreen inbox={inbox} roles={roles} events={events} followedIds={followedIds} />,
    post: <PostEventScreen setTab={setTab} refreshEvents={refreshEvents} />
  };

  return (
    <>
      <Shell user={user} tab={tab} setTab={setTab} onLogout={logout} onAuthOpen={() => setAuthOpen(true)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults}>
        {screens[tab] || screens.home}
      </Shell>
      <section className="mobile-bottom-nav">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </section>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={setUser} />}
      <div className="app-glow" />
    </>
  );
}
