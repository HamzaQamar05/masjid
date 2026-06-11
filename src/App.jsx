import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  HeartHandshake,
  Home,
  Library,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Navigation,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import { businesses, defaultLocation, lectures, prayers, seedEvents, seedOrganizations } from './data/seedData.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const notificationTimers = new Map();

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'organizations', label: 'Masjids', icon: Building2 },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'volunteers', label: 'Volunteer', icon: HeartHandshake },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'library', label: 'Library', icon: Library },
  { key: 'businesses', label: 'Business', icon: Briefcase },
  { key: 'profile', label: 'Profile', icon: UserCheck },
  { key: 'dashboard', label: 'Admin', icon: BarChart3 }
];

const mobileNavKeys = ['home', 'organizations', 'network', 'volunteers', 'profile'];

function token() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function canManageOrgs(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function isOrganizationAccount(user) {
  return ['MASJID', 'MSA'].includes(user?.accountType);
}

function isImamAccount(user) {
  return ['IMAM', 'STUDENT_OF_KNOWLEDGE'].includes(user?.accountType);
}

function isUserAccount(user) {
  return user?.accountType === 'USER';
}

function initials(name = 'UC') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function profileBannerStyle(item = {}) {
  const image = item.bannerUrl || item.heroImageUrl || item.cover || item.coverImageUrl;
  return image ? { backgroundImage: `url(${image})` } : undefined;
}

function displayRoleLabel(accountType = 'USER') {
  const labels = {
    USER: 'Community member',
    MASJID: 'Masjid organization',
    MSA: 'Student organization',
    IMAM: 'Imam / scholar',
    STUDENT_OF_KNOWLEDGE: 'Student of knowledge',
    BUSINESS: 'Business',
    ADMIN: 'Platform admin'
  };
  return labels[accountType] || accountType;
}

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || '';
}

function textToList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function directionsUrl(item) {
  const query = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : encodeURIComponent(item.address || item.location || item.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const savedToken = token();
  if (savedToken) headers.Authorization = `Bearer ${savedToken}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function distanceText(item) {
  if (item.distanceKm == null) return 'Distance unavailable';
  return `${item.distanceKm.toFixed ? item.distanceKm.toFixed(1) : item.distanceKm} km away`;
}

async function showPrayerNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'SHOW_PRAYER_NOTIFICATION', title, body, tag });
      return;
    }
    await registration.showNotification(title, { body, tag });
    return;
  }
  new Notification(title, { body, tag });
}

function Shell({ user, tab, setTab, children, searchQuery, setSearchQuery, searchResults, onSearchSelect, onLogout, hasDashboardAccess, theme, toggleTheme }) {
  const [navOpen, setNavOpen] = useState(false);
  function navigate(key) {
    setTab(key);
    setNavOpen(false);
  }
  return (
    <div className="app">
      <header className="top-nav">
        <button className="icon-button mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        <button className="brand" onClick={() => navigate('home')} aria-label="Ummah Connect home"><span>UC</span><strong>Ummah Connect</strong></button>
        <div className="search-wrap">
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users, masjids, events, skills" />
          </label>
          {searchQuery && (
            <div className="search-results">
              {searchResults.length ? searchResults.map((result) => (
                <button key={`${result.kind}-${result.id}`} onClick={() => { onSearchSelect(result); setSearchQuery(''); setNavOpen(false); }}>
                  <span>{result.kind}</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </button>
              )) : <p>No matches yet.</p>}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
          <button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'dashboard' : 'events')}><Plus size={18} /><span>{canPost(user) ? 'Create' : 'Event'}</span></button>
          <button className="dm-top-button" onClick={() => navigate('messages')} aria-label="Open messages">
  <Mail size={22} />
  <span className="dm-dot"></span>
</button>
          <button className="profile-chip" onClick={() => navigate('profile')}><span>{initials(user.name)}</span><strong>{user.name}</strong></button>
        </div>
        
      </header>
      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head"><strong>Menu</strong><button className="icon-button" onClick={() => setNavOpen(false)}><X size={20} /></button></div>
        <div className="drawer-profile">
          <button className="profile-avatar" onClick={() => navigate('profile')}>{initials(user.name)}</button>
          <div><strong>{user.name}</strong><span>{user.accountType}</span></div>
        </div>
        <NavigationList tab={tab} setTab={navigate} user={user} hasDashboardAccess={hasDashboardAccess} />
        <button className="mobile-logout" onClick={onLogout}><LogOut size={18} />Logout</button>
      </div>
      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} setTab={navigate} />
        <NavigationList tab={tab} setTab={navigate} user={user} hasDashboardAccess={hasDashboardAccess} />
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}

function NavigationList({ tab, setTab, user, hasDashboardAccess }) {
  const visibleNav = navItems.filter((item) => {
    if (item.key === 'dashboard') return canManageOrgs(user) || hasDashboardAccess || isImamAccount(user);
    if (isOrganizationAccount(user) && ['volunteers', 'jobs', 'businesses'].includes(item.key)) return false;
    return true;
  });
  return (
    <nav className="side-nav">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const label = item.key === 'dashboard' && user.accountType !== 'ADMIN' ? 'Dashboard' : item.label;
        return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{label}</span></button>;
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout, setTab }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" style={profileBannerStyle(user)} />
      <div className="profile-body">
        <button className="profile-avatar" onClick={() => setTab('profile')}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}</button>
        <h2>{user.name}</h2>
        <p>{isOrganizationAccount(user) ? 'Manage posts, applications, prayer times, imams, followers, and messages from your dashboard.' : (user.bio || 'Add your bio, experience, skills, education, languages, and interests.')}</p>
        <div className="profile-meta"><span>{displayRoleLabel(user.accountType)}</span><span>{user.city || 'No city yet'}</span></div>
        <button className="text-action" onClick={onLogout}><LogOut size={16} />Logout</button>
      </div>
    </section>
  );
}

function HomeScreen({ user, posts, masjids, locationStatus, requestLocation, prayerTimes, setTab, openOrganization }) {
  const orgAccount = isOrganizationAccount(user);
  return (
    <div className="content-grid">
      <section className="feed-column">
        <section className="composer">
          <div className="composer-main">
            <button onClick={() => setTab(orgAccount ? 'dashboard' : 'profile')}>
              {orgAccount ? 'Open your masjid operations dashboard for posts, applications, prayer times, classes, and imams' : 'Complete your profile so masjids can understand your skills, studies, and interests'}
            </button>
          </div>
          <div className="composer-actions">
            <button onClick={() => setTab(orgAccount ? 'dashboard' : 'events')}><CalendarDays size={18} />{orgAccount ? 'Manage' : 'Events'}</button>
            <button onClick={() => setTab('network')}><Users size={18} />Network</button>
            <button onClick={() => setTab('messages')}><Mail size={18} />Messages</button>
          </div>
        </section>
        <PostFeed posts={posts} openOrganization={openOrganization} />
      </section>
      <aside className="right-rail">
        <PrayerWidget prayerTimes={prayerTimes} />
        <NearbyMasjids masjids={masjids.slice(0, 3)} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />
        <section className="panel">
          <div className="section-title"><h2>Account</h2><button onClick={() => setTab('profile')}>Edit</button></div>
          <p className="helper-text">{orgAccount ? `Logged in as ${user.name}, an organization account. User-only application flows are hidden; use Dashboard for management.` : `Logged in as ${user.name}. Feed, applications, followed masjids, messages, and profile data are backend-backed.`}</p>
        </section>
      </aside>
    </div>
  );
}

function PostFeed({ posts, openOrganization }) {
  return (
    <section className="panel">
      <div className="section-title"><div><p className="eyebrow">Feed</p><h2>Community updates</h2></div><span>{posts.length}</span></div>
      <div className="stack-list">
        {posts.map((post) => (
          <article className="mini-row feed-post" key={post.id}>
            <div className="thread-head">
              <div className="org-logo">{post.organization?.imageUrl ? <img src={post.organization.imageUrl} alt="" /> : initials(post.organization?.name || 'UC')}</div>
              <div>
                <button className="text-action" onClick={() => post.organization?.id && openOrganization(post.organization.id)}>{post.organization?.name || 'Community'}</button>
                <p>{post.type} - {new Date(post.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
            <strong>{post.title}</strong>
            <p>{post.content}</p>
            {post.location && <div className="meta-line"><MapPin size={16} />{post.location}</div>}
            {post.eventTime && <div className="meta-line"><CalendarDays size={16} />{new Date(post.eventTime).toLocaleString()}</div>}
            {post.isFromFollowedMasjid && <span className="status-pill">Following</span>}
          </article>
        ))}
        {!posts.length && <p className="helper-text">Follow masjids or ask an admin to create posts to populate your feed.</p>}
      </div>
    </section>
  );
}

function PrayerWidget({ prayerTimes }) {
  return (
    <section className="panel prayer-panel">
      <div className="section-title"><div><p className="eyebrow">Live API</p><h2>Prayer times today</h2></div><ShieldCheck size={22} /></div>
      <div className="prayer-grid detailed">
        {prayerTimes.map((item) => (
          <div key={item.name}><span>{item.name}</span><strong>{item.adhan}</strong><em>Iqamah {item.iqamah || 'Set by masjid'}</em></div>
        ))}
      </div>
    </section>
  );
}

function NearbyMasjids({ masjids, locationStatus, requestLocation, openOrganization }) {
  return (
    <section className="panel nearby-panel">
      <div className="section-title">
        <div><p className="eyebrow">Location</p><h2>Nearby masjids</h2></div>
        <button onClick={requestLocation}><Navigation size={16} />Refresh location</button>
      </div>
      <p className="helper-text">{locationStatus}</p>
      <div className="nearby-list">
        {masjids.map((masjid) => (
          <article className="nearby-card" key={masjid.id}>
            <div>
              <h3>{masjid.name}</h3>
              <p>{masjid.address || masjid.city || 'Address unavailable'}</p>
              <p>{distanceText(masjid)}{masjid.walkingMinutes ? ` - ${masjid.walkingMinutes} min walk - ${masjid.drivingMinutes} min drive` : ''}</p>
              <p>{masjid.followerCount || 0} followers - {(masjid.events || []).length} events - {(masjid.opportunities || []).length} opportunities</p>
            </div>
            <div className="nearby-actions">
              {openOrganization && <button className="secondary-button" onClick={() => openOrganization(masjid.id)}>Profile</button>}
              <a className="secondary-button" href={directionsUrl(masjid)} target="_blank" rel="noreferrer">Directions</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventsScreen({ user, events, loadEvents, myOrganizations, registerEvent, unregisterEvent }) {
  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await loadEvents();
  }
  return (
    <Page title="Events" subtitle="Create, register for, and delete events you own. Admins can delete any event.">
      <div className="card-grid two">
        {events.map((event) => {
          const canDelete = user.accountType === 'ADMIN' || event.createdById === user.id || event.createdBy?.id === user.id || myOrganizations.some((org) => org.id === event.organizationId);
          const registration = (event.registrations || []).find((item) => item.userId === user.id);
          const registeredCount = (event.registrations || []).filter((item) => item.status !== 'DENIED').length;
          const remaining = event.capacity ? Math.max(0, event.capacity - registeredCount) : null;
          return (
            <article className="event-card" key={event.id}>
              <div className="event-top"><span>Event</span>{canDelete && <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete</button>}</div>
              <h3>{event.title}</h3>
              <p>{event.description || 'No description yet.'}</p>
              <div className="meta-line"><CalendarDays size={16} />{event.startTime ? new Date(event.startTime).toLocaleString() : event.time || 'Time TBA'}</div>
              <div className="meta-line"><MapPin size={16} />{event.location || event.place || 'Location TBA'}</div>
              <div className="check-row"><span>Seats</span><strong>{event.capacity ? `${registeredCount}/${event.capacity} registered - ${remaining} left` : `${registeredCount} registered`}</strong></div>
              {event.requiresApproval && <div className="check-row"><span>Entry</span><strong>Approval required</strong></div>}
              {registration && <div className="check-row"><span>Your status</span><strong>{registration.status}</strong></div>}
              <div className="card-footer">
                <span>{event.organization?.name || (event.createdBy?.name ? `By ${event.createdBy.name}` : 'Community event')}</span>
                {registration ? <button className="secondary-button" onClick={() => unregisterEvent(event.id)}>Cancel</button> : <button className="primary-button" onClick={() => registerEvent(event.id)}>{event.requiresApproval ? 'Request entry' : 'Register'}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}

function PostEventScreen({ setTab, createEvent, myOrganizations }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '', organizationId: '', capacity: '', requiresApproval: false });
  async function submit(event) {
    event.preventDefault();
    await createEvent(form);
    setTab('events');
  }
  return (
    <Page title="Post Event" subtitle="Events are saved to the backend and can be deleted afterward.">
      <form className="post-form" onSubmit={submit}>
        <input required placeholder="Event title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <input required type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
        <select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
          <option value="">Personal/admin event</option>
          {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <input placeholder="Capacity" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
        <label className="check-toggle"><input type="checkbox" checked={form.requiresApproval} onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })} />Requires approval/payment</label>
        <button className="primary-button">Post event</button>
      </form>
    </Page>
  );
}

function OrganizationsScreen({ masjids, locationStatus, requestLocation, openOrganization }) {
  return (
    <Page title="Masjid Discovery" subtitle="SQL-backed masjid profiles sorted by your browser location.">
      <NearbyMasjids masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />
    </Page>
  );
}

function NetworkScreen({ user, users, connections, loadNetwork, openProfile, startMessage }) {
  const [networkQuery, setNetworkQuery] = useState('');

  function connectionFor(otherId) {
    return connections.find((connection) => [connection.requesterId, connection.receiverId].includes(otherId));
  }

  async function connect(otherId) {
    await api(`/api/connections/${otherId}`, { method: 'POST' });
    await loadNetwork();
  }

  async function accept(connectionId) {
    await api(`/api/connections/${connectionId}`, { method: 'PUT', body: JSON.stringify({ status: 'ACCEPTED' }) });
    await loadNetwork();
  }

  const filteredUsers = users.filter((person) => {
    const query = networkQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      person.name,
      person.email,
      person.accountType,
      displayRoleLabel(person.accountType),
      person.city,
      person.location,
      person.bio,
      ...(person.skills || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  return (
    <Page title="Network" subtitle="LinkedIn-style community directory for masjids, imams, professionals, businesses, and volunteers.">
      <section className="panel network-search-panel">
        <label className="network-search">
          <Search size={18} />
          <input
            value={networkQuery}
            onChange={(event) => setNetworkQuery(event.target.value)}
            placeholder="Search users, masjids, imams, skills, city, or role"
          />
        </label>
        <p className="helper-text">
          Showing {filteredUsers.length} of {users.length} profiles
        </p>
      </section>

      <div className="card-grid two">
        {filteredUsers.map((person) => {
          const connection = connectionFor(person.id);
          const incoming = connection?.receiverId === user.id && connection.status === 'PENDING';

          return (
            <article className="person-card" key={person.id}>
              <div className="person-banner" style={profileBannerStyle(person)} />
              <button className="profile-avatar network-avatar" onClick={() => openProfile(person)}>
                {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials(person.name)}
              </button>
              <div>
                <h3>{person.name}</h3>
                <p>{displayRoleLabel(person.accountType)} - {person.city || person.location || 'Location not added'}</p>
              </div>
              <p>{person.bio || 'No bio yet.'}</p>
              <TagRow tags={person.skills || []} />
              <div className="card-footer profile-actions">
                <button className="secondary-button" onClick={() => openProfile(person)}>View profile</button>
                {person.id !== user.id && <button className="secondary-button" onClick={() => startMessage(person)}>Message</button>}
                {person.id !== user.id && !connection && <button className="primary-button" onClick={() => connect(person.id)}>Connect</button>}
                {incoming && <button className="primary-button" onClick={() => accept(connection.id)}>Accept</button>}
                {connection && !incoming && <span>{connection.status}</span>}
              </div>
            </article>
          );
        })}

        {!filteredUsers.length && (
          <p className="helper-text">No profiles match your search.</p>
        )}
      </div>
    </Page>
  );
}

function MessagesScreen({
  users,
  selectedUser,
  setSelectedUser,
  messages,
  threads,
  loadMessages,
  loadOlderMessages,
  loadThreads,
  messagePage,
  sendTyping,
  onlineUserIds,
  typingUserIds,
  reactToMessage,
  unsendMessage
}) {
  const [draft, setDraft] = useState('');
  const [conversationQuery, setConversationQuery] = useState('');
  const selectedThread = selectedUser ? threads.find((thread) => thread.user.id === selectedUser.id) : null;
  const visibleUsers = users.filter((person) => `${person.name} ${person.accountType} ${person.city || ''}`.toLowerCase().includes(conversationQuery.trim().toLowerCase()));

  useEffect(() => {
    if (!selectedUser?.id) return undefined;
    let active = true;
    async function refreshThread() {
      try {
        if (active) {
          await loadMessages(selectedUser.id);
          await loadThreads();
        }
      } catch (error) {
        console.error(error);
      }
    }
    refreshThread();
    const timer = setInterval(refreshThread, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedUser?.id]);

  useEffect(() => {
    if (!selectedUser?.id) return undefined;
    sendTyping(selectedUser.id, Boolean(draft.trim()));
    const timer = setTimeout(() => sendTyping(selectedUser.id, false), 900);
    return () => clearTimeout(timer);
  }, [draft, selectedUser?.id]);

  async function chooseUser(person) {
    setSelectedUser(person);
    await loadMessages(person.id);
  }
  async function sendMessage() {
    if (!selectedUser || !draft.trim()) return;
    await api('/api/messages', { method: 'POST', body: JSON.stringify({ receiverId: selectedUser.id, content: draft }) });
    setDraft('');
    await loadMessages(selectedUser.id);
    await loadThreads();
  }

  function onMessageScroll(event) {
    if (event.currentTarget.scrollTop < 24 && messagePage.hasMore && !messagePage.loadingOlder) {
      loadOlderMessages(selectedUser.id);
    }
  }

  return (
    <Page title="Messages" subtitle="Instagram-style inbox for users, masjids, imams, and community organizations.">
      <div className="messaging-layout">
        <section className="panel inbox-list">
          <label className="dm-search"><Search size={16} /><input placeholder="Search conversations" value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} /></label>
          {visibleUsers.map((person) => {
            const thread = threads.find((item) => item.user.id === person.id);
            const isOnline = onlineUserIds.includes(person.id);
            return (
              <button key={person.id} className={selectedUser?.id === person.id ? 'active' : ''} onClick={() => chooseUser(person)}>
                <span className="org-logo dm-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials(person.name)}</span>
                <strong>{person.name}</strong>
                <span>{isOnline ? 'Online' : displayRoleLabel(person.accountType)}</span>
                <p>{thread?.lastMessage || person.city || 'No messages yet'}</p>
                {thread?.unread > 0 && <em>{thread.unread}</em>}
              </button>
            );
          })}
          {!visibleUsers.length && <p className="helper-text">No conversations match this search.</p>}
        </section>
        <section className="panel message-thread">
          {selectedUser ? (
            <>
              <div className="thread-head"><div className="org-logo">{selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt="" /> : initials(selectedUser.name)}</div><div><h2>{selectedUser.name}</h2><p>{onlineUserIds.includes(selectedUser.id) ? 'Online now' : selectedThread?.lastMessageAt ? `Last message ${new Date(selectedThread.lastMessageAt).toLocaleString()}` : displayRoleLabel(selectedUser.accountType)}</p></div></div>
              <div className="message-list" onScroll={onMessageScroll}>
                {messagePage.hasMore && <button className="load-more" onClick={() => loadOlderMessages(selectedUser.id)}>{messagePage.loadingOlder ? 'Loading...' : 'Load older messages'}</button>}
                {messages.map((message) => (
                  <div className={message.senderId === selectedUser.id ? 'chat-bubble received' : 'chat-bubble sent'} key={message.id}>
                    <p>{message.content}</p>
                    {!!message.reactions?.length && <div className="reaction-row">{message.reactions.map((reaction) => <span key={reaction.id}>{reaction.emoji}</span>)}</div>}
                    {!message.isDeleted && (
                      <div className="message-actions">
                        {['heart', 'smile', 'dua', 'like'].map((emoji) => <button key={emoji} onClick={() => reactToMessage(message.id, emoji)}>{emoji}</button>)}
                        {message.senderId !== selectedUser.id ? null : <button onClick={() => unsendMessage(message.id)}>Unsend</button>}
                      </div>
                    )}
                  </div>
                ))}
                {typingUserIds.includes(selectedUser.id) && <div className="typing-indicator">{selectedUser.name} is typing...</div>}
              </div>
              <div className="message-composer">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selectedUser.name}`} />
                <button className="primary-button" onClick={sendMessage} aria-label="Send message"><Send size={18} /></button>
              </div>
            </>
          ) : <p className="helper-text">Choose a person to start messaging.</p>}
        </section>
      </div>
    </Page>
  );
}

function LibraryScreen() {
  return (
    <Page title="Lecture Library" subtitle="Save and browse community lectures, notes, videos, and audio.">
      <div className="card-grid three">
        {lectures.map((lecture) => (
          <article className="library-card" key={lecture.id}>
            <div className="library-icon"><Library size={24} /></div>
            <span>{lecture.category}</span>
            <h3>{lecture.title}</h3>
            <p>{lecture.speaker}</p>
            <div className="card-footer"><span>{lecture.format}</span><button className="secondary-button">{lecture.saved ? 'Saved' : 'Save'}</button></div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function BusinessDirectoryScreen() {
  return (
    <Page title="Business Directory" subtitle="Browse Muslim-owned businesses and event sponsors.">
      <div className="card-grid three">
        {businesses.map((business) => (
          <article className="business-card" key={business.id}>
            <Briefcase size={24} />
            <h3>{business.name}</h3>
            <p>{business.category} - {business.city}</p>
            <div className="card-footer"><span>{business.rating} rating</span><span>Sponsored: {business.sponsor}</span></div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function MasjidProfileScreen({ organization, user, onFollow, onBack }) {
  if (!organization) return <Page title="Masjid Profile" subtitle="Choose a masjid to view its profile."><button className="secondary-button" onClick={onBack}>Back to masjids</button></Page>;
  const posts = organization.posts || [];
  const events = organization.events || [];
  const opportunities = organization.opportunities || [];
  const jobs = opportunities.filter((item) => item.type === 'JOB');
  const volunteer = opportunities.filter((item) => item.type !== 'JOB');
  const iqamah = organization.iqamahTimes || {};
  const classes = organization.classes || organization.programs || [];
  const canFollowMasjid = isUserAccount(user);
  return (
    <Page title={organization.name} subtitle={organization.description || 'Masjid profile with events, opportunities, jobs, prayer times, location, and links.'}>
      <section className="panel masjid-profile">
        <div className="masjid-hero" style={{ backgroundImage: organization.heroImageUrl ? `url(${organization.heroImageUrl})` : undefined }}>
          <div className="org-logo">{organization.imageUrl ? <img src={organization.imageUrl} alt="" /> : initials(organization.name)}</div>
          <div>
            <h2>{organization.name}</h2>
            <p>{organization.address || organization.city || 'Location not added yet'}</p>
            <p>{organization.followerCount || 0} followers - {organization.peopleCount || 0} team members</p>
          </div>
        </div>
        <div className="profile-actions">
          {canFollowMasjid && <button className="primary-button" onClick={() => onFollow(organization.id, false)}>{organization.isFollowing ? 'Following' : 'Follow masjid'}</button>}
          {canFollowMasjid && <button className="secondary-button" onClick={() => onFollow(organization.id, true)}>{organization.notifyPrayers ? 'Prayer notifications on' : 'Enable prayer notifications'}</button>}
          {!canFollowMasjid && <span className="status-pill">Organization profile</span>}
          <a className="secondary-button" href={directionsUrl(organization)} target="_blank" rel="noreferrer">Directions</a>
          {organization.website && <a className="secondary-button" href={organization.website} target="_blank" rel="noreferrer">Website</a>}
          {organization.donationUrl && <a className="secondary-button" href={organization.donationUrl} target="_blank" rel="noreferrer">Donate</a>}
        </div>
      </section>

      <div className="content-grid">
        <section className="feed-column">
          <section className="panel">
            <div className="section-title"><h2>Posts</h2><span>{posts.length}</span></div>
            <div className="stack-list">
              {posts.map((post) => <article className="mini-row feed-post" key={post.id}><span>{post.type} - {new Date(post.createdAt).toLocaleString()}</span><strong>{post.title}</strong><p>{post.content}</p>{post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}</article>)}
              {!posts.length && <p className="helper-text">No posts yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Events</h2><span>{events.length}</span></div>
            <div className="stack-list">
              {events.map((event) => <article className="mini-row" key={event.id}><strong>{event.title}</strong><span>{new Date(event.startTime).toLocaleString()}</span><p>{event.description || event.location || 'No details yet.'}</p></article>)}
              {!events.length && <p className="helper-text">No events yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Classes & Programs</h2><span>{classes.length}</span></div>
            <div className="stack-list">
              {classes.map((item) => <article className="mini-row" key={item.id || item.title}><strong>{item.title}</strong><span>{item.teacher || item.imam || item.dayTime || 'Schedule TBD'}</span><p>{item.description || item.location || item.registrationLink || 'Registration details coming soon.'}</p></article>)}
              {!classes.length && <p className="helper-text">No classes listed yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Opportunities</h2><span>{volunteer.length}</span></div>
            <div className="stack-list">
              {volunteer.map((item) => <article className="mini-row" key={item.id}><strong>{item.title}</strong><span>{item.type}</span><p>{item.description || item.location || 'No details yet.'}</p></article>)}
              {!volunteer.length && <p className="helper-text">No opportunities yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Jobs</h2><span>{jobs.length}</span></div>
            <div className="stack-list">
              {jobs.map((item) => <article className="mini-row" key={item.id}><strong>{item.title}</strong><span>{item.location || 'Location TBD'}</span><p>{item.description || 'No details yet.'}</p></article>)}
              {!jobs.length && <p className="helper-text">No jobs posted yet.</p>}
            </div>
          </section>
        </section>
        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Imams & Team</h2><span>{organization.peopleCount || 0}</span></div>
            <div className="stack-list">
              {(organization.people || []).map((person) => (
                <article className="mini-row" key={person.id}>
                  <strong>{person.user?.name || 'Team member'}</strong>
                  <span>{person.roleLabel}</span>
                  <p>{person.user?.bio || person.user?.city || person.user?.accountType || 'Community profile'}</p>
                </article>
              ))}
              {!(organization.people || []).length && <p className="helper-text">No imams or team members listed yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Iqamah Times</h2><ShieldCheck size={20} /></div>
            <div className="prayer-grid detailed">
              {[...prayers, { name: 'Jumuah', iqamah: 'TBD' }].map((prayer) => <div key={prayer.name}><span>{prayer.name}</span><strong>{iqamah[prayer.name] || iqamah[prayer.name.toLowerCase()] || prayer.iqamah || 'TBD'}</strong></div>)}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Links</h2></div>
            <p>{organization.phone || 'Phone not added'}</p>
            <p>{organization.email || 'Email not added'}</p>
            <p>{organization.facilities || 'Facilities not added'}</p>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function printableHoursReport(user, visible) {
  const rows = visible
    .map((item) => ({ item, application: item.applications?.[0] }))
    .filter(({ application }) => application && Number(application.approvedHours || 0) > 0)
    .map(({ item, application }) => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.organization?.name || 'Community organization')}</td>
        <td>${escapeHtml(application.status)}</td>
        <td>${escapeHtml(application.approvedHours || 0)}</td>
      </tr>
    `).join('');
  const total = visible.reduce((sum, item) => sum + (item.applications?.[0]?.approvedHours || 0), 0);
  const report = window.open('', '_blank');
  if (!report) return alert('Allow popups to print or save your volunteer hours report.');
  report.document.write(`
    <html>
      <head>
        <title>Verified Volunteer Hours</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #17212b; }
          h1 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border: 1px solid #d7dee8; padding: 10px; text-align: left; }
          th { background: #f3f6f8; }
          .total { margin-top: 20px; font-size: 20px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Verified Volunteer Hours</h1>
        <p>${escapeHtml(user.name)} - Generated ${escapeHtml(new Date().toLocaleString())}</p>
        <table><thead><tr><th>Opportunity</th><th>Masjid</th><th>Status</th><th>Hours</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No approved hours yet.</td></tr>'}</tbody></table>
        <p class="total">Total verified hours: ${total}</p>
      </body>
    </html>
  `);
  report.document.close();
  report.focus();
  report.print();
}

function OpportunitiesScreen({ user, opportunities, type = 'VOLUNTEER', applyToOpportunity, title, subtitle }) {
  const visible = opportunities.filter((item) => item.type === type || (type === 'VOLUNTEER' && item.type === 'OPPORTUNITY'));
  const verifiedTotal = visible.reduce((sum, item) => sum + (item.applications?.[0]?.approvedHours || 0), 0);
  const [activeOpportunity, setActiveOpportunity] = useState(null);
  const [applicationForms, setApplicationForms] = useState({});
  const userCanApply = isUserAccount(user);
  const activeQuestions = activeOpportunity ? normalizeList(activeOpportunity.applicationQuestions || activeOpportunity.questions) : [];
  function updateApplicationForm(id, field, value) {
    setApplicationForms((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  }
  function updateAnswer(id, question, value) {
    setApplicationForms((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        answers: { ...((current[id] || {}).answers || {}), [question]: value }
      }
    }));
  }
  async function submitApplication(id) {
    await applyToOpportunity(id, applicationForms[id] || {});
    setApplicationForms((current) => ({ ...current, [id]: { note: '', contactPhone: '', resumeUrl: '' } }));
    setActiveOpportunity(null);
  }
  return (
    <Page title={title} subtitle={subtitle}>
      {!userCanApply && (
        <section className="panel role-notice">
          <strong>Organization account</strong>
          <p>Masjid and MSA accounts manage listings from the dashboard. Applying is reserved for community member accounts.</p>
        </section>
      )}
      {type === 'VOLUNTEER' && (
        <section className="hours-summary panel">
          <div>
            <span>Verified Hours</span>
            <h2>{verifiedTotal}</h2>
            <p>Hours only count after the masjid approves them.</p>
          </div>
          <button className="secondary-button" onClick={() => printableHoursReport(user, visible)}>Download PDF</button>
        </section>
      )}
      <div className="card-grid two">
        {visible.map((item) => {
          const application = item.applications?.[0];
          return (
          <article className="role-card" key={item.id}>
            <div className="role-icon">{item.type === 'JOB' ? <Briefcase size={24} /> : <HeartHandshake size={24} />}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.organization?.name || 'Community organization'}</p>
              <TagRow tags={[item.location || 'Location TBD', item.workType || item.type, item.deadline && `Deadline ${new Date(item.deadline).toLocaleDateString()}`, item.hours ? `${item.hours} hours` : null, ...(Array.isArray(item.skills) ? item.skills : normalizeList(item.skills))].filter(Boolean)} />
            </div>
            <p>{item.description || 'No description yet.'}</p>
            {item.requirements && <div className="check-row"><span>Requirements</span><strong>{item.requirements}</strong></div>}
            <div className="check-row"><span>Status</span><strong>{application?.status || 'Not applied'}</strong></div>
            <div className="check-row"><span>Approved hours</span><strong>{application?.approvedHours || 0}</strong></div>
            {application?.note && <div className="check-row"><span>Your note</span><strong>{application.note}</strong></div>}
            <div className="card-footer">
              {application ? <span className="status-pill">{application.status}</span> : userCanApply ? <button className="primary-button" onClick={() => setActiveOpportunity(item)}>Apply</button> : <span className="status-pill">Manage in dashboard</span>}
            </div>
          </article>
        );})}
        {!visible.length && <p className="helper-text">No {type.toLowerCase()} posts yet.</p>}
      </div>
      {activeOpportunity && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Apply to ${activeOpportunity.title}`}>
          <section className="application-modal panel">
            <div className="section-title">
              <div><p className="eyebrow">{activeOpportunity.type === 'JOB' ? 'Job application' : 'Volunteer application'}</p><h2>{activeOpportunity.title}</h2></div>
              <button className="icon-button" onClick={() => setActiveOpportunity(null)} aria-label="Close application"><X size={18} /></button>
            </div>
            <p className="helper-text">{activeOpportunity.organization?.name || 'Community organization'} - {activeOpportunity.location || 'Location TBD'}</p>
            <div className="application-form modal-form">
              <div className="form-grid">
                <input placeholder="Full name" value={applicationForms[activeOpportunity.id]?.name || user.name || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'name', event.target.value)} />
                <input placeholder="Email" value={applicationForms[activeOpportunity.id]?.email || user.email || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'email', event.target.value)} />
                <input placeholder="Phone optional" value={applicationForms[activeOpportunity.id]?.contactPhone || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'contactPhone', event.target.value)} />
                <input placeholder="Resume/profile link optional" value={applicationForms[activeOpportunity.id]?.resumeUrl || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'resumeUrl', event.target.value)} />
              </div>
              <textarea placeholder={activeOpportunity.type === 'JOB' ? 'Cover message' : 'Availability or short message'} value={applicationForms[activeOpportunity.id]?.note || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'note', event.target.value)} />
              {activeQuestions.map((question) => (
                <label className="question-field" key={question}>
                  <span>{question}</span>
                  <textarea placeholder="Your answer" value={applicationForms[activeOpportunity.id]?.answers?.[question] || ''} onChange={(event) => updateAnswer(activeOpportunity.id, question, event.target.value)} />
                </label>
              ))}
              {!activeQuestions.length && <p className="helper-text">This listing does not have custom questions yet.</p>}
              <button className="primary-button" onClick={() => submitApplication(activeOpportunity.id)}>Submit application</button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

function ProfileScreen({ user, viewedUser, onCloseViewed, onSave, social }) {
  const editingSelf = !viewedUser || viewedUser.id === user.id;
  const profile = viewedUser || user;
  const [form, setForm] = useState(() => ({
    name: profile.name || '',
    city: profile.city || '',
    location: profile.location || '',
    bio: profile.bio || '',
    education: profile.education || '',
    experience: profile.experience || '',
    availability: profile.availability || '',
    avatarUrl: profile.avatarUrl || '',
    bannerUrl: profile.bannerUrl || profile.heroImageUrl || '',
    skills: listToText(profile.skills),
    interests: listToText(profile.interests),
    languages: listToText(profile.languages),
    hobbies: listToText(profile.hobbies)
  }));

  useEffect(() => {
    setForm({
      name: profile.name || '',
      city: profile.city || '',
      location: profile.location || '',
      bio: profile.bio || '',
      education: profile.education || '',
      experience: profile.experience || '',
      availability: profile.availability || '',
      avatarUrl: profile.avatarUrl || '',
      bannerUrl: profile.bannerUrl || profile.heroImageUrl || '',
      skills: listToText(profile.skills),
      interests: listToText(profile.interests),
      languages: listToText(profile.languages),
      hobbies: listToText(profile.hobbies)
    });
  }, [profile.id]);

  async function submit(event) {
    event.preventDefault();
    const updated = await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ ...form, skills: textToList(form.skills), interests: textToList(form.interests), languages: textToList(form.languages), hobbies: textToList(form.hobbies) })
    });
    onSave(updated);
  }

  return (
    <Page title={editingSelf ? 'Your Profile' : profile.name} subtitle="Complete community profile with banner, avatar, role, applications, followed masjids, and network context.">
      {!editingSelf && <button className="secondary-button" onClick={onCloseViewed}>Back to your profile</button>}
      <section className="panel profile-detail">
        <div className="profile-banner" style={profileBannerStyle(profile)} />
        <div className="profile-hero"><div className="profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.name)}</div><div><h2>{profile.name}</h2><p>{displayRoleLabel(profile.accountType)} - {profile.city || 'No city yet'}</p></div></div>
        {editingSelf ? (
          <form className="profile-form" onSubmit={submit}>
            <div className="form-grid">
              {['name', 'city', 'location', 'availability', 'avatarUrl', 'bannerUrl'].map((field) => <input key={field} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
            </div>
            <p className="helper-text">Avatar and banner images make profiles feel complete across feed, networking, and messaging.</p>
            <textarea placeholder="Bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            <textarea placeholder="Experience" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} />
            <textarea placeholder="Education" value={form.education} onChange={(event) => setForm({ ...form, education: event.target.value })} />
            <input placeholder="Skills, comma separated" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
            <input placeholder="Interests, comma separated" value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} />
            <input placeholder="Languages, comma separated" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} />
            <input placeholder="Hobbies, comma separated" value={form.hobbies} onChange={(event) => setForm({ ...form, hobbies: event.target.value })} />
            <button className="primary-button">Save profile</button>
          </form>
        ) : <ReadOnlyProfile profile={profile} />}
      </section>
      <section className="panel profile-social">
        <div className="section-title"><h2>Connections</h2><span>{social.connections.length}</span></div>
        <div className="tag-row">{social.connections.map((person) => <span key={person.id}>{person.name}</span>)}</div>
        {!social.connections.length && <p className="helper-text">No accepted connections yet.</p>}
        <div className="section-title"><h2>Following Masjids</h2><span>{social.followingMasjids.length}</span></div>
        <div className="tag-row">{social.followingMasjids.map((org) => <span key={org.id}>{org.name}</span>)}</div>
        {!social.followingMasjids.length && <p className="helper-text">No followed masjids yet.</p>}
        <div className="section-title"><h2>Masjid Roles</h2><span>{social.affiliatedMasjids.length}</span></div>
        <div className="stack-list">
          {social.affiliatedMasjids.map((item) => <article className="mini-row" key={item.id}><strong>{item.organization?.name}</strong><span>{item.roleLabel}</span></article>)}
        </div>
        {!social.affiliatedMasjids.length && <p className="helper-text">No masjid roles listed yet.</p>}
      </section>
    </Page>
  );
}

function ReadOnlyProfile({ profile }) {
  return (
    <div className="profile-read">
      <p>{profile.bio || 'No bio yet.'}</p>
      <InfoBlock title="Experience" value={profile.experience} />
      <InfoBlock title="Education" value={profile.education} />
      <InfoBlock title="Availability" value={profile.availability} />
      <TagRow tags={profile.skills || []} />
      <TagRow tags={profile.interests || []} />
      <TagRow tags={profile.languages || []} />
      <TagRow tags={profile.hobbies || []} />
    </div>
  );
}

function InfoBlock({ title, value }) {
  return <div className="info-block"><strong>{title}</strong><p>{value || 'Not added yet.'}</p></div>;
}

function ImamDashboard({ user, social, setTab }) {
  const linkedMasjids = social.affiliatedMasjids || [];
  const linkedPrograms = linkedMasjids.flatMap((affiliation) => (affiliation.organization?.classes || []).map((program) => ({ ...program, organization: affiliation.organization })));
  const profileFields = [user.bio, user.avatarUrl, user.bannerUrl, user.city || user.location, user.skills?.length, user.availability].filter(Boolean).length;
  const completion = Math.round((profileFields / 6) * 100);
  return (
    <Page title="Imam Dashboard" subtitle="Professional hub for profile, messages, linked masjids, classes, reminders, and future requests.">
      <div className="content-grid">
        <section className="feed-column">
          <section className="panel ops-overview">
            <div className="section-title"><div><p className="eyebrow">Imam workspace</p><h2>{user.name}</h2></div><span>{displayRoleLabel(user.accountType)}</span></div>
            <div className="metric-grid compact">
              <button type="button" className="metric-card metric-button" onClick={() => setTab('profile')}><span>Profile</span><strong>{completion}%</strong><em>Bio, topics, image, and availability</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('messages')}><span>Messages</span><strong>DM</strong><em>Users and masjids can contact you</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('organizations')}><span>Linked masjids</span><strong>{linkedMasjids.length}</strong><em>Affiliations and roles</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('network')}><span>Network</span><strong>{social.connections.length}</strong><em>Community connections</em></button>
            </div>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Profile Overview</h2><button onClick={() => setTab('profile')}>Edit</button></div>
            <div className="profile-hero"><div className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}</div><div><h2>{user.name}</h2><p>{user.bio || 'Add your bio, credentials, topics, and availability.'}</p></div></div>
            <TagRow tags={[...(user.skills || []), user.availability, user.city || user.location].filter(Boolean)} />
          </section>

          <section className="panel">
            <div className="section-title"><h2>Classes & Programs</h2><span>{linkedPrograms.length}</span></div>
            <div className="stack-list">
              {linkedPrograms.map((program, index) => (
                <article className="mini-row" key={program.id || `${program.organization.id}-${program.title}-${index}`}>
                  <strong>{program.title}</strong>
                  <span>{program.organization.name} - {program.dayTime || 'Schedule TBD'}</span>
                  <p>{program.description || program.notes || program.location || 'Program details are not filled in yet.'}</p>
                </article>
              ))}
              {!linkedPrograms.length && <p className="helper-text">No linked classes yet. Ask the masjid dashboard manager to add your class or attach you to the masjid team.</p>}
            </div>
          </section>
        </section>

        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Linked Masjids</h2><span>{linkedMasjids.length}</span></div>
            <div className="stack-list">
              {linkedMasjids.map((affiliation) => (
                <article className="mini-row" key={affiliation.id}>
                  <strong>{affiliation.organization?.name || 'Masjid'}</strong>
                  <span>{affiliation.roleLabel}</span>
                  <p>{affiliation.organization?.city || affiliation.organization?.address || 'Location not added yet.'}</p>
                </article>
              ))}
              {!linkedMasjids.length && <p className="helper-text">No masjid affiliation is attached yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Requests</h2><span>Later</span></div>
            <div className="stack-list">
              <article className="mini-row"><strong>Speaking requests</strong><span>Khutbah, halaqah, class, and counseling request workflow planned.</span></article>
              <article className="mini-row"><strong>Reminder posts</strong><span>Imam-authored reminders can build on the existing post model.</span></article>
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function AdminScreen({ user, users, loadNetwork, loadMyOrganizations, myOrganizations, createOrganization, updateOrganization, createOpportunity, updateOpportunity, createPost, updatePost, createEvent, updateEvent, deletePost, deleteEvent, updateApplication, bulkUpdateApplications, updateRegistration, bulkUpdateRegistrations, deleteOpportunity, addOrganizationPerson, inviteOrganizationPerson, removeOrganizationPerson, removeOrganizationFollower, openProfile, startMessage }) {
  const emptyOrgForm = { name: '', type: 'MASJID', city: '', address: '', website: '', email: '', phone: '', ownerEmail: '', description: '', facilities: '', imageUrl: '', heroImageUrl: '', donationUrl: '', instagramUrl: '', facebookUrl: '', latitude: '', longitude: '' };
  const [orgForm, setOrgForm] = useState(emptyOrgForm);
  const [postForm, setPostForm] = useState({ organizationId: '', type: 'ANNOUNCEMENT', title: '', content: '', imageUrl: '', location: '', eventTime: '' });
  const [eventForm, setEventForm] = useState({ organizationId: '', title: '', description: '', location: '', startTime: '', capacity: '', requiresApproval: false });
  const [oppForm, setOppForm] = useState({ organizationId: '', type: 'VOLUNTEER', title: '', description: '', requirements: '', location: '', skills: '', hours: '', workType: 'volunteer', deadline: '', applicationQuestions: '' });
  const emptyClassForm = { organizationId: '', title: '', teacher: '', description: '', dayTime: '', location: '', notes: '', registrationLink: '' };
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [peopleForm, setPeopleForm] = useState({ organizationId: '', userId: '', roleLabel: 'Imam' });
  const [inviteForm, setInviteForm] = useState({ organizationId: '', name: '', email: '', accountType: 'IMAM', roleLabel: 'Imam' });
  const [peopleQuery, setPeopleQuery] = useState('');
  const [editingOrgId, setEditingOrgId] = useState('');
  const [editOrgForm, setEditOrgForm] = useState({});
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [dashboardQuery, setDashboardQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const query = dashboardQuery.trim().toLowerCase();
  const peopleSearch = peopleQuery.trim().toLowerCase();
  const teamCandidates = users
    .filter((person) => person.id !== user.id)
    .filter((person) => !peopleSearch || `${person.name} ${person.email} ${person.accountType} ${person.city || ''} ${(person.skills || []).join(' ')}`.toLowerCase().includes(peopleSearch))
    .slice(0, 40);
  const dashboardSections = [
    ['all', 'All'],
    ['posts', 'Posts'],
    ['events', 'Events'],
    ['programs', 'Programs'],
    ['volunteers', 'Volunteers'],
    ['jobs', 'Jobs'],
    ['applications', 'Applications'],
    ['team', 'Team'],
    ['followers', 'Followers']
  ];
  const showSection = (section) => activeSection === 'all' || activeSection === section;
  const scopedOrganizations = myOrganizations
    .filter((org) => !selectedOrgId || org.id === selectedOrgId)
    .filter((org) => {
      if (!query) return true;
      const searchable = [
        org.name,
        org.city,
        org.address,
        org.email,
        org.phone,
        ...(org.posts || []).map((post) => `${post.title} ${post.content} ${post.type}`),
        ...(org.events || []).map((event) => `${event.title} ${event.description || ''} ${event.location || ''}`),
        ...(org.classes || []).map((item) => `${item.title || ''} ${item.teacher || ''} ${item.description || ''} ${item.dayTime || ''} ${item.location || ''}`),
        ...(org.opportunities || []).map((opportunity) => `${opportunity.title} ${opportunity.description || ''} ${opportunity.type} ${opportunity.location || ''}`),
        ...(org.people || []).map((person) => `${person.user?.name || ''} ${person.roleLabel}`),
        ...(org.followers || []).map((follow) => follow.user?.name || '')
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  const pendingApplications = scopedOrganizations.flatMap((org) => (org.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).filter((application) => application.status === 'PENDING').map((application) => ({ org, opportunity, application }))));
  const allApplications = scopedOrganizations.flatMap((org) => (org.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).map((application) => ({ org, opportunity, application }))));
  const pendingRegistrations = scopedOrganizations.flatMap((org) => (org.events || []).flatMap((event) => (event.registrations || []).filter((registration) => registration.status === 'PENDING').map((registration) => ({ org, event, registration }))));
  const allFollowers = scopedOrganizations.flatMap((org) => (org.followers || []).map((follow) => ({ org, follow })));
  const adminStats = {
    users: users.filter((person) => person.accountType === 'USER').length,
    masjids: myOrganizations.filter((org) => ['MASJID', 'MSA'].includes(String(org.type).toUpperCase())).length,
    imams: users.filter((person) => ['IMAM', 'STUDENT_OF_KNOWLEDGE'].includes(person.accountType)).length,
    businesses: users.filter((person) => person.accountType === 'BUSINESS').length,
    posts: myOrganizations.reduce((sum, org) => sum + (org.posts || []).length, 0),
    opportunities: myOrganizations.reduce((sum, org) => sum + (org.opportunities || []).length, 0),
    reports: 0
  };
  const metrics = {
    followers: scopedOrganizations.reduce((sum, org) => sum + (org.followerCount || 0), 0),
    posts: scopedOrganizations.reduce((sum, org) => sum + (org.posts || []).length, 0),
    events: scopedOrganizations.reduce((sum, org) => sum + (org.events || []).length, 0),
    programs: scopedOrganizations.reduce((sum, org) => sum + (org.classes || []).length, 0),
    pendingApplications: pendingApplications.length,
    pendingRegistrations: pendingRegistrations.length,
    applications: allApplications.length,
    jobs: scopedOrganizations.reduce((sum, org) => sum + (org.opportunities || []).filter((item) => item.type === 'JOB').length, 0),
    volunteers: scopedOrganizations.reduce((sum, org) => sum + (org.opportunities || []).filter((item) => item.type !== 'JOB').length, 0)
  };
  async function deleteUser(id) {
    if (!confirm('Delete this user and their messages/events?')) return;
    await api(`/api/users/${id}`, { method: 'DELETE' });
    await loadNetwork();
  }
  async function updateRole(id, accountType) {
    await api(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ accountType }) });
    await Promise.all([loadNetwork(), loadMyOrganizations()]);
  }
  async function submitOrg(event) {
    event.preventDefault();
    const created = await createOrganization(orgForm);
    if (created?.temporaryPassword) alert(`Masjid login created for ${orgForm.ownerEmail}. Temporary password: ${created.temporaryPassword}`);
    setOrgForm(emptyOrgForm);
  }
  async function submitOpp(event) {
    event.preventDefault();
    const organizationId = oppForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createOpportunity(organizationId, oppForm);
    setOppForm({ organizationId, type: 'VOLUNTEER', title: '', description: '', requirements: '', location: '', skills: '', hours: '', workType: 'volunteer', deadline: '', applicationQuestions: '' });
  }
  async function submitPost(event) {
    event.preventDefault();
    const organizationId = postForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createPost(organizationId, postForm);
    setPostForm({ organizationId, type: 'ANNOUNCEMENT', title: '', content: '', imageUrl: '', location: '', eventTime: '' });
  }
  async function submitEvent(event) {
    event.preventDefault();
    const organizationId = eventForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createEvent({ ...eventForm, organizationId });
    setEventForm({ organizationId, title: '', description: '', location: '', startTime: '', capacity: '', requiresApproval: false });
    setActiveSection('events');
  }
  async function submitClass(event) {
    event.preventDefault();
    const organizationId = classForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    if (!classForm.title.trim()) return alert('Class title is required.');
    const org = myOrganizations.find((item) => item.id === organizationId);
    const nextClass = {
      id: `class-${Date.now()}`,
      title: classForm.title.trim(),
      teacher: classForm.teacher.trim(),
      description: classForm.description.trim(),
      dayTime: classForm.dayTime.trim(),
      location: classForm.location.trim(),
      notes: classForm.notes.trim(),
      registrationLink: classForm.registrationLink.trim()
    };
    await updateOrganization(organizationId, { classes: [...(org?.classes || []), nextClass] });
    setClassForm({ ...emptyClassForm, organizationId });
    setActiveSection('programs');
  }
  async function submitPerson(event) {
    event.preventDefault();
    const organizationId = peopleForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId || !peopleForm.userId) return alert('Select a masjid and person first.');
    await addOrganizationPerson(organizationId, { userId: peopleForm.userId, roleLabel: peopleForm.roleLabel });
    setPeopleForm({ organizationId, userId: '', roleLabel: 'Imam' });
  }
  async function submitInvite(event) {
    event.preventDefault();
    const organizationId = inviteForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId || !inviteForm.email.trim()) return alert('Select a masjid and enter an email first.');
    const invited = await inviteOrganizationPerson(organizationId, inviteForm);
    if (invited?.temporaryPassword) alert(`Login created for ${inviteForm.email}. Temporary password: ${invited.temporaryPassword}`);
    setInviteForm({ organizationId, name: '', email: '', accountType: 'IMAM', roleLabel: 'Imam' });
    setActiveSection('team');
  }
  async function quickAddTeam(organizationId, person, roleLabel = 'Team member') {
    if (!person?.id) return;
    const nextRole = prompt('Team role?', roleLabel);
    if (!nextRole) return;
    await addOrganizationPerson(organizationId, { userId: person.id, roleLabel: nextRole });
    setActiveSection('team');
  }
  async function approveApplication(opportunityId, applicationId) {
    const approvedHours = Number(prompt('Approved volunteer hours?', '0') || 0);
    await updateApplication(opportunityId, applicationId, { status: 'APPROVED', approvedHours });
  }
  async function approvePendingApplications(opportunityId) {
    const approvedHours = Number(prompt('Approved hours for each pending applicant?', '0') || 0);
    await bulkUpdateApplications(opportunityId, { status: 'APPROVED', fromStatus: 'PENDING', approvedHours });
  }
  async function moveApplication(opportunityId, applicationId, status) {
    await updateApplication(opportunityId, applicationId, { status });
  }
  function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : 'Not recorded';
  }
  function toDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  async function editPost(post) {
    const title = prompt('Post title', post.title || '');
    if (title === null) return;
    const content = prompt('Post content', post.content || '');
    if (content === null) return;
    const location = prompt('Location', post.location || '');
    if (location === null) return;
    await updatePost(post.id, { title, content, location });
  }
  async function editEvent(eventItem) {
    const title = prompt('Event title', eventItem.title || '');
    if (title === null) return;
    const startTime = prompt('Start time', toDateTimeInput(eventItem.startTime));
    if (startTime === null) return;
    const location = prompt('Location', eventItem.location || '');
    if (location === null) return;
    const capacity = prompt('Capacity', eventItem.capacity || '');
    if (capacity === null) return;
    await updateEvent(eventItem.id, { title, startTime, location, capacity });
  }
  async function editOpportunity(opportunity) {
    const title = prompt('Title', opportunity.title || '');
    if (title === null) return;
    const description = prompt('Description', opportunity.description || '');
    if (description === null) return;
    const location = prompt('Location', opportunity.location || '');
    if (location === null) return;
    const skills = prompt('Skills, comma separated', (opportunity.skills || []).join(', '));
    if (skills === null) return;
    const hours = prompt('Hours', opportunity.hours || '');
    if (hours === null) return;
    await updateOpportunity(opportunity.id, { title, description, location, skills, hours });
  }
  async function editClass(org, classItem, classIndex) {
    const title = prompt('Class title', classItem.title || '');
    if (title === null) return;
    const teacher = prompt('Teacher or imam', classItem.teacher || '');
    if (teacher === null) return;
    const dayTime = prompt('Day/time', classItem.dayTime || '');
    if (dayTime === null) return;
    const location = prompt('Location', classItem.location || '');
    if (location === null) return;
    const description = prompt('Description', classItem.description || '');
    if (description === null) return;
    const classes = (org.classes || []).map((item, index) => (classItem.id ? item.id === classItem.id : index === classIndex) ? { ...item, title, teacher, dayTime, location, description } : item);
    await updateOrganization(org.id, { classes });
  }
  async function deleteClass(org, classItem, classIndex) {
    if (!confirm('Delete this class or program?')) return;
    await updateOrganization(org.id, { classes: (org.classes || []).filter((item, index) => classItem.id ? item.id !== classItem.id : index !== classIndex) });
  }
  function startEditOrg(org) {
    setEditingOrgId(org.id);
    setEditOrgForm({
      name: org.name || '',
      type: org.type || 'MASJID',
      city: org.city || '',
      address: org.address || '',
      website: org.website || '',
      email: org.email || '',
      phone: org.phone || '',
      description: org.description || '',
      facilities: org.facilities || '',
      imageUrl: org.imageUrl || '',
      heroImageUrl: org.heroImageUrl || '',
      donationUrl: org.donationUrl || '',
      instagramUrl: org.instagramUrl || '',
      facebookUrl: org.facebookUrl || '',
      latitude: org.latitude || '',
      longitude: org.longitude || '',
      fajr: org.iqamahTimes?.Fajr || '',
      dhuhr: org.iqamahTimes?.Dhuhr || '',
      asr: org.iqamahTimes?.Asr || '',
      maghrib: org.iqamahTimes?.Maghrib || '',
      isha: org.iqamahTimes?.Isha || '',
      jumuah: org.iqamahTimes?.Jumuah || org.iqamahTimes?.jumuah || '',
      prayerNotes: org.prayerNotes || org.iqamahTimes?.notes || ''
    });
  }
  async function submitEditOrg(event) {
    event.preventDefault();
    const iqamahTimes = {
      Fajr: editOrgForm.fajr,
      Dhuhr: editOrgForm.dhuhr,
      Asr: editOrgForm.asr,
      Maghrib: editOrgForm.maghrib,
      Isha: editOrgForm.isha,
      Jumuah: editOrgForm.jumuah,
      notes: editOrgForm.prayerNotes
    };
    await updateOrganization(editingOrgId, { ...editOrgForm, iqamahTimes });
    setEditingOrgId('');
    setEditOrgForm({});
  }
  return (
    <Page title={user.accountType === 'ADMIN' ? 'Admin Dashboard' : 'Masjid Dashboard'} subtitle="Run daily masjid operations: posts, volunteers, jobs, event attendees, imams, followers, and profile settings.">
      <div className="content-grid">
        <section className="feed-column">
          <section className="panel ops-overview">
            <div className="section-title"><div><p className="eyebrow">Operations</p><h2>Today at a glance</h2></div><span>{scopedOrganizations.length} profiles</span></div>
            <div className="form-grid">
              <select value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)}>
                <option value="">All managed masjids/MSAs</option>
                {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
              <input placeholder="Search posts, volunteers, jobs, imams, followers, events" value={dashboardQuery} onChange={(event) => setDashboardQuery(event.target.value)} />
            </div>
            <div className="metric-grid compact">
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('followers')}><span>Followers</span><strong>{metrics.followers}</strong><em>People following managed profiles</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('posts')}><span>Posts</span><strong>{metrics.posts}</strong><em>Announcements and updates</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('applications')}><span>Applications</span><strong>{metrics.applications}</strong><em>{metrics.pendingApplications} waiting for review</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('events')}><span>Event approvals</span><strong>{metrics.pendingRegistrations}</strong><em>{metrics.events} events total</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('programs')}><span>Programs</span><strong>{metrics.programs}</strong><em>Classes and recurring programs</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('jobs')}><span>Jobs</span><strong>{metrics.jobs}</strong><em>Active job posts</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setActiveSection('volunteers')}><span>Volunteer roles</span><strong>{metrics.volunteers}</strong><em>Active service roles</em></button>
            </div>
            <div className="filter-bar dashboard-filter">
              {dashboardSections.map(([key, label]) => (
                <button key={key} className={activeSection === key ? 'active' : ''} type="button" onClick={() => setActiveSection(key)}>{label}</button>
              ))}
            </div>
          </section>

          {(pendingApplications.length > 0 || pendingRegistrations.length > 0) && (
            <section className="panel">
              <div className="section-title"><h2>Needs attention</h2><span>{pendingApplications.length + pendingRegistrations.length}</span></div>
              <div className="stack-list">
                {pendingApplications.map(({ org, opportunity, application }) => (
                  <article className="mini-row" key={application.id}>
                    <strong>{application.applicant?.name || 'Applicant'} applied for {opportunity.title}</strong>
                    <span>{org.name} - {opportunity.type}</span>
                    {application.note && <p>{application.note}</p>}
                    <TagRow tags={[application.contactPhone && `Phone: ${application.contactPhone}`, application.resumeUrl && 'Resume/profile link'].filter(Boolean)} />
                    <div className="manager-row">
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'REVIEWING')}>Reviewing</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'INTERVIEW')}>Interview</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'APPROVED')}>Accept</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'DENIED')}>Reject</button>
                      {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                      {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                      {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                      {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Volunteer Coordinator')}>Add to team</button>}
                    </div>
                  </article>
                ))}
                {pendingRegistrations.map(({ org, event, registration }) => (
                  <article className="mini-row" key={registration.id}>
                    <strong>{registration.user?.name || 'Attendee'} requested entry to {event.title}</strong>
                    <span>{org.name} - {new Date(event.startTime).toLocaleString()}</span>
                    <div className="manager-row">
                      <button onClick={() => updateRegistration(event.id, registration.id, 'APPROVED')}>Approve</button>
                      <button onClick={() => updateRegistration(event.id, registration.id, 'DENIED')}>Deny</button>
                      {registration.user && <button onClick={() => startMessage(registration.user)}>Message</button>}
                      {registration.user && <button onClick={() => openProfile(registration.user)}>Profile</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {user.accountType === 'ADMIN' && (
            <section className="panel">
            <div className="section-title"><h2>Create Masjid Profile</h2></div>
            <form className="profile-form" onSubmit={submitOrg}>
              <div className="form-grid">
                <input required placeholder="Masjid name" value={orgForm.name} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} />
                <select value={orgForm.type} onChange={(event) => setOrgForm({ ...orgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                <input placeholder="City" value={orgForm.city} onChange={(event) => setOrgForm({ ...orgForm, city: event.target.value })} />
                <input placeholder="Address" value={orgForm.address} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} />
                <input placeholder="Website" value={orgForm.website} onChange={(event) => setOrgForm({ ...orgForm, website: event.target.value })} />
                <input placeholder="Public email" value={orgForm.email} onChange={(event) => setOrgForm({ ...orgForm, email: event.target.value })} />
                <input placeholder="Phone" value={orgForm.phone} onChange={(event) => setOrgForm({ ...orgForm, phone: event.target.value })} />
                <input placeholder="Masjid admin login email" value={orgForm.ownerEmail} onChange={(event) => setOrgForm({ ...orgForm, ownerEmail: event.target.value })} />
                <input placeholder="Logo image URL" value={orgForm.imageUrl} onChange={(event) => setOrgForm({ ...orgForm, imageUrl: event.target.value })} />
                <input placeholder="Hero image URL" value={orgForm.heroImageUrl} onChange={(event) => setOrgForm({ ...orgForm, heroImageUrl: event.target.value })} />
                <input placeholder="Donation URL" value={orgForm.donationUrl} onChange={(event) => setOrgForm({ ...orgForm, donationUrl: event.target.value })} />
                <input placeholder="Instagram URL" value={orgForm.instagramUrl} onChange={(event) => setOrgForm({ ...orgForm, instagramUrl: event.target.value })} />
                <input placeholder="Facebook URL" value={orgForm.facebookUrl} onChange={(event) => setOrgForm({ ...orgForm, facebookUrl: event.target.value })} />
                <input placeholder="Latitude" value={orgForm.latitude} onChange={(event) => setOrgForm({ ...orgForm, latitude: event.target.value })} />
                <input placeholder="Longitude" value={orgForm.longitude} onChange={(event) => setOrgForm({ ...orgForm, longitude: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={orgForm.description} onChange={(event) => setOrgForm({ ...orgForm, description: event.target.value })} />
              <textarea placeholder="Facilities, programs, parking, accessibility notes" value={orgForm.facilities} onChange={(event) => setOrgForm({ ...orgForm, facilities: event.target.value })} />
              <button className="primary-button">Create profile</button>
            </form>
          </section>
          )}

          <section className="panel">
            <div className="section-title"><h2>Create Feed Post</h2></div>
            <form className="profile-form" onSubmit={submitPost}>
              <div className="form-grid">
                <select value={postForm.organizationId} onChange={(event) => setPostForm({ ...postForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <select value={postForm.type} onChange={(event) => setPostForm({ ...postForm, type: event.target.value })}>
                  {['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'FUNDRAISER', 'CLASS', 'VOLUNTEER', 'JOB'].map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input required placeholder="Post title" value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />
                <input placeholder="Image URL" value={postForm.imageUrl} onChange={(event) => setPostForm({ ...postForm, imageUrl: event.target.value })} />
                <input placeholder="Location" value={postForm.location} onChange={(event) => setPostForm({ ...postForm, location: event.target.value })} />
                <input type="datetime-local" value={postForm.eventTime} onChange={(event) => setPostForm({ ...postForm, eventTime: event.target.value })} />
              </div>
              <textarea required placeholder="Post content" value={postForm.content} onChange={(event) => setPostForm({ ...postForm, content: event.target.value })} />
              <button className="primary-button">Publish post</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Create Event</h2></div>
            <form className="profile-form" onSubmit={submitEvent}>
              <div className="form-grid">
                <select value={eventForm.organizationId} onChange={(event) => setEventForm({ ...eventForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input required placeholder="Event title" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} />
                <input placeholder="Location" value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} />
                <input required type="datetime-local" value={eventForm.startTime} onChange={(event) => setEventForm({ ...eventForm, startTime: event.target.value })} />
                <input placeholder="Capacity" value={eventForm.capacity} onChange={(event) => setEventForm({ ...eventForm, capacity: event.target.value })} />
                <label className="check-toggle"><input type="checkbox" checked={eventForm.requiresApproval} onChange={(event) => setEventForm({ ...eventForm, requiresApproval: event.target.checked })} />Requires approval</label>
              </div>
              <textarea placeholder="Description" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} />
              <button className="primary-button">Post event</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Create Class or Program</h2></div>
            <form className="profile-form" onSubmit={submitClass}>
              <div className="form-grid">
                <select value={classForm.organizationId} onChange={(event) => setClassForm({ ...classForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input required placeholder="Class title" value={classForm.title} onChange={(event) => setClassForm({ ...classForm, title: event.target.value })} />
                <input placeholder="Teacher or imam" value={classForm.teacher} onChange={(event) => setClassForm({ ...classForm, teacher: event.target.value })} />
                <input placeholder="Day/time" value={classForm.dayTime} onChange={(event) => setClassForm({ ...classForm, dayTime: event.target.value })} />
                <input placeholder="Location" value={classForm.location} onChange={(event) => setClassForm({ ...classForm, location: event.target.value })} />
                <input placeholder="Registration link optional" value={classForm.registrationLink} onChange={(event) => setClassForm({ ...classForm, registrationLink: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} />
              <textarea placeholder="Gender, family, or attendance notes optional" value={classForm.notes} onChange={(event) => setClassForm({ ...classForm, notes: event.target.value })} />
              <button className="primary-button">Publish class</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Post Job or Opportunity</h2></div>
            <form className="profile-form" onSubmit={submitOpp}>
              <div className="form-grid">
                <select value={oppForm.organizationId} onChange={(event) => setOppForm({ ...oppForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <select value={oppForm.type} onChange={(event) => setOppForm({ ...oppForm, type: event.target.value })}><option value="VOLUNTEER">Volunteer</option><option value="JOB">Job</option><option value="OPPORTUNITY">Opportunity</option></select>
                <input required placeholder="Title" value={oppForm.title} onChange={(event) => setOppForm({ ...oppForm, title: event.target.value })} />
                <input placeholder="Location" value={oppForm.location} onChange={(event) => setOppForm({ ...oppForm, location: event.target.value })} />
                <input placeholder="Skills, comma separated" value={oppForm.skills} onChange={(event) => setOppForm({ ...oppForm, skills: event.target.value })} />
                <input placeholder="Hours" value={oppForm.hours} onChange={(event) => setOppForm({ ...oppForm, hours: event.target.value })} />
                <select value={oppForm.workType} onChange={(event) => setOppForm({ ...oppForm, workType: event.target.value })}>
                  <option value="volunteer">Volunteer</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
                <input type="date" value={oppForm.deadline} onChange={(event) => setOppForm({ ...oppForm, deadline: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={oppForm.description} onChange={(event) => setOppForm({ ...oppForm, description: event.target.value })} />
              <textarea placeholder="Requirements" value={oppForm.requirements} onChange={(event) => setOppForm({ ...oppForm, requirements: event.target.value })} />
              <textarea placeholder="Custom application questions, one per line" value={oppForm.applicationQuestions} onChange={(event) => setOppForm({ ...oppForm, applicationQuestions: event.target.value })} />
              <p className="helper-text">Custom questions are stored with the listing and shown in the application modal.</p>
              <button className="primary-button">Post</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Masjid Team</h2></div>
            <form className="profile-form" onSubmit={submitInvite}>
              <div className="form-grid">
                <select value={inviteForm.organizationId} onChange={(event) => setInviteForm({ ...inviteForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input placeholder="Name" value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} />
                <input required placeholder="Email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} />
                <select value={inviteForm.accountType} onChange={(event) => setInviteForm({ ...inviteForm, accountType: event.target.value })}>
                  <option value="IMAM">Imam</option>
                  <option value="STUDENT_OF_KNOWLEDGE">Student of Knowledge</option>
                  <option value="USER">User</option>
                  <option value="MASJID">Masjid Staff</option>
                  <option value="MSA">MSA Staff</option>
                </select>
                <input placeholder="Role, e.g. Imam, Volunteer Coordinator" value={inviteForm.roleLabel} onChange={(event) => setInviteForm({ ...inviteForm, roleLabel: event.target.value })} />
              </div>
              <p className="helper-text">Creates a login if the email is new, or attaches the existing account if it already exists.</p>
              <button className="primary-button">Invite or create team login</button>
            </form>
            <form className="profile-form" onSubmit={submitPerson}>
              <div className="form-grid">
                <select value={peopleForm.organizationId} onChange={(event) => setPeopleForm({ ...peopleForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input placeholder="Search people by name, email, city, skills" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} />
                <select value={peopleForm.userId} onChange={(event) => setPeopleForm({ ...peopleForm, userId: event.target.value })}>
                  <option value="">Select person</option>
                  {teamCandidates.map((person) => <option key={person.id} value={person.id}>{person.name} - {person.accountType} - {person.email}</option>)}
                </select>
                <input placeholder="Role, e.g. Imam, Khateeb, Coordinator" value={peopleForm.roleLabel} onChange={(event) => setPeopleForm({ ...peopleForm, roleLabel: event.target.value })} />
              </div>
              <p className="helper-text">Showing {teamCandidates.length} matching people. Search first if the network is large.</p>
              <button className="primary-button">Add to masjid profile</button>
            </form>
          </section>

          {scopedOrganizations.map((org) => (
            <section className="panel" key={org.id}>
              <div className="section-title"><h2>{org.name}</h2><button onClick={() => startEditOrg(org)}>Edit profile</button><span>{org.followerCount || 0} followers</span><span>{org.peopleCount || 0} team</span></div>
              {editingOrgId === org.id && (
                <form className="profile-form manager-edit-form" onSubmit={submitEditOrg}>
                  <div className="form-grid">
                    {['name', 'city', 'address', 'website', 'email', 'phone', 'imageUrl', 'heroImageUrl', 'donationUrl', 'instagramUrl', 'facebookUrl', 'latitude', 'longitude'].map((field) => (
                      <input key={field} placeholder={field} value={editOrgForm[field] || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, [field]: event.target.value })} />
                    ))}
                    <select value={editOrgForm.type || 'MASJID'} onChange={(event) => setEditOrgForm({ ...editOrgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                  </div>
                  <textarea placeholder="Description" value={editOrgForm.description || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, description: event.target.value })} />
                  <textarea placeholder="Facilities" value={editOrgForm.facilities || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, facilities: event.target.value })} />
                  <div className="section-title compact-title"><h3>Prayer Times Management</h3><span>Profile visible</span></div>
                  <div className="form-grid">
                    {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah'].map((field) => <input key={field} placeholder={`${field} iqamah, e.g. 05:30`} value={editOrgForm[field] || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, [field]: event.target.value })} />)}
                  </div>
                  <textarea placeholder="Prayer notes or announcements" value={editOrgForm.prayerNotes || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, prayerNotes: event.target.value })} />
                  <p className="helper-text">Prayer notes and Jumuah are saved with the masjid profile. Ramadan mode can build on this same profile surface.</p>
                  <div className="profile-actions">
                    <button className="primary-button">Save masjid profile</button>
                    <button className="secondary-button" type="button" onClick={() => setEditingOrgId('')}>Cancel</button>
                  </div>
                </form>
              )}
              {showSection('applications') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Application Portal</h3><span>{(org.opportunities || []).reduce((sum, opportunity) => sum + (opportunity.applications || []).length, 0)}</span></div>
                  <div className="application-portal">
                    {(org.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).map((application) => ({ opportunity, application }))).map(({ opportunity, application }) => (
                      <article className="application-card" key={application.id}>
                        <div>
                          <strong>{application.applicantName || application.applicant?.name || 'Applicant'}</strong>
                          <span>{application.applicantEmail || application.applicant?.email || application.email || 'Email not provided'}</span>
                          <p>{opportunity.title} - {opportunity.type}</p>
                        </div>
                        <TagRow tags={[`Status: ${application.status || 'NEW'}`, application.contactPhone && `Phone: ${application.contactPhone}`, application.resumeUrl && 'Resume/profile link'].filter(Boolean)} />
                        {application.note && <p>{application.note}</p>}
                        {application.answers && <pre>{JSON.stringify(application.answers, null, 2)}</pre>}
                        <div className="manager-row">
                          {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">View application</a>}
                          {(application.applicantEmail || application.applicant?.email) && <a className="secondary-button" href={`mailto:${application.applicantEmail || application.applicant.email}`}>Email applicant</a>}
                          {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message applicant</button>}
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'REVIEWING')}>Mark reviewing</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'INTERVIEW')}>Move to interview</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'ACCEPTED')}>Accept</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'REJECTED')}>Reject</button>
                        </div>
                      </article>
                    ))}
                    {!(org.opportunities || []).some((opportunity) => (opportunity.applications || []).length) && <p className="helper-text">No applications yet.</p>}
                  </div>
                </div>
              )}
              {showSection('programs') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Classes & Programs</h3><span>{(org.classes || []).length}</span></div>
                  <div className="stack-list">
                    {(org.classes || []).length ? (org.classes || []).map((item, index) => (
                      <article className="mini-row" key={item.id || `${item.title}-${index}`}>
                        <strong>{item.title}</strong>
                        <span>{item.teacher || 'Teacher TBD'} - {item.dayTime || 'Schedule TBD'}</span>
                        <p>{item.description || item.location || item.notes || 'No class details yet.'}</p>
                        <TagRow tags={[item.location, item.notes, item.registrationLink && 'Registration link'].filter(Boolean)} />
                        <div className="manager-row">
                          <button onClick={() => editClass(org, item, index)}>Edit class</button>
                          {item.registrationLink && <a className="secondary-button" href={item.registrationLink} target="_blank" rel="noreferrer">Open registration</a>}
                          <button className="secondary-button danger" onClick={() => deleteClass(org, item, index)}>Delete class</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No classes or programs have been added yet.</p>}
                  </div>
                </div>
              )}
              {showSection('team') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Team</h3><span>{(org.people || []).length}</span></div>
                  <div className="stack-list">
                    {(org.people || []).length ? (org.people || []).map((person) => (
                      <article className="mini-row" key={person.id}>
                        <strong>{person.user?.name || 'Person'}</strong>
                        <span>{person.roleLabel}</span>
                        <div className="manager-row">
                          {person.user && <button onClick={() => startMessage(person.user)}>Message</button>}
                          {person.user && <button onClick={() => openProfile(person.user)}>Profile</button>}
                          <button onClick={() => removeOrganizationPerson(org.id, person.userId)}>Remove</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No imams or team members attached yet.</p>}
                  </div>
                </div>
              )}

              {showSection('posts') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Posts</h3><span>{(org.posts || []).length}</span></div>
                  <div className="stack-list">
                    {(org.posts || []).length ? (org.posts || []).map((post) => (
                      <article className="mini-row" key={post.id}>
                        <strong>{post.title}</strong>
                        <span>{post.type} - {new Date(post.createdAt).toLocaleString()}</span>
                        <p>{post.content}</p>
                        <div className="manager-row">
                          <button onClick={() => editPost(post)}>Edit post</button>
                          <button className="secondary-button danger" onClick={() => deletePost(post.id)}>Delete post</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No posts match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('events') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Events</h3><span>{(org.events || []).length}</span></div>
                  <div className="stack-list">
                    {(org.events || []).length ? (org.events || []).map((event) => (
                      <article className="mini-row" key={event.id}>
                        <strong>{event.title}</strong>
                        <span>{new Date(event.startTime).toLocaleString()} - {(event.registrations || []).length} attendees</span>
                        <p>{event.location || 'Location TBA'}</p>
                        <div className="manager-row">
                          <span>{(event.registrations || []).filter((registration) => registration.status === 'PENDING').length} pending, {(event.registrations || []).filter((registration) => registration.status === 'APPROVED').length} approved, {(event.registrations || []).filter((registration) => registration.status === 'ATTENDED').length} attended</span>
                          <button onClick={() => bulkUpdateRegistrations(event.id, { status: 'APPROVED', fromStatus: 'PENDING' })}>Approve pending</button>
                          <button onClick={() => bulkUpdateRegistrations(event.id, { status: 'ATTENDED', fromStatus: 'APPROVED' })}>Mark approved attended</button>
                          <button onClick={() => editEvent(event)}>Edit event</button>
                          <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete event</button>
                        </div>
                        {(event.registrations || []).map((registration) => (
                          <div className="manager-row" key={registration.id}>
                            <span>{registration.user?.name || 'User'} - {registration.status}</span>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'APPROVED')}>Approve</button>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'DENIED')}>Deny</button>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'ATTENDED')}>Attended</button>
                            {registration.user && <button onClick={() => startMessage(registration.user)}>Message</button>}
                            {registration.user && <button onClick={() => openProfile(registration.user)}>Profile</button>}
                          </div>
                        ))}
                      </article>
                    )) : <p className="helper-text">No events match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('volunteers') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Volunteers</h3><span>{(org.opportunities || []).filter((item) => item.type !== 'JOB').length}</span></div>
                  <div className="stack-list">
                    {(org.opportunities || []).filter((item) => item.type !== 'JOB').length ? (org.opportunities || []).filter((item) => item.type !== 'JOB').map((opportunity) => (
                      <article className="mini-row" key={opportunity.id}>
                        <strong>{opportunity.title}</strong>
                        <span>{opportunity.type} - {(opportunity.applications || []).length} applicants</span>
                        <div className="manager-row">
                          <span>{(opportunity.applications || []).filter((application) => application.status === 'PENDING').length} pending, {(opportunity.applications || []).filter((application) => application.status === 'APPROVED').length} approved, {(opportunity.applications || []).filter((application) => application.status === 'COMPLETED').length} completed</span>
                          <button onClick={() => approvePendingApplications(opportunity.id)}>Approve pending</button>
                          <button onClick={() => bulkUpdateApplications(opportunity.id, { status: 'COMPLETED', fromStatus: 'APPROVED', checkedOutAt: true })}>Complete approved</button>
                          <button onClick={() => editOpportunity(opportunity)}>Edit post</button>
                          <button className="secondary-button danger" onClick={() => deleteOpportunity(opportunity.id)}>Delete post</button>
                        </div>
                        {(opportunity.applications || []).map((application) => (
                          <div className="manager-row" key={application.id}>
                            <span>{application.applicant?.name || 'Applicant'} - {application.status} - {application.approvedHours || 0} hrs{application.contactPhone ? ` - ${application.contactPhone}` : ''}</span>
                            {application.note && <p>{application.note}</p>}
                            <button onClick={() => approveApplication(opportunity.id, application.id)}>Approve hours</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'APPROVED', checkedInAt: true })}>Check in</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'COMPLETED', checkedOutAt: true })}>Check out</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'DENIED' })}>Deny</button>
                            {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                            {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                            {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                            {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Volunteer')}>Add to team</button>}
                            <small>In: {formatDateTime(application.checkedInAt)} | Out: {formatDateTime(application.checkedOutAt)}</small>
                          </div>
                        ))}
                      </article>
                    )) : <p className="helper-text">No volunteer opportunities match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('jobs') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Jobs</h3><span>{(org.opportunities || []).filter((item) => item.type === 'JOB').length}</span></div>
                  <div className="stack-list">
                    {(org.opportunities || []).filter((item) => item.type === 'JOB').length ? (org.opportunities || []).filter((item) => item.type === 'JOB').map((opportunity) => (
                      <article className="mini-row" key={opportunity.id}>
                        <strong>{opportunity.title}</strong>
                        <span>{(opportunity.applications || []).length} applicants</span>
                        <div className="manager-row">
                          <span>{(opportunity.applications || []).filter((application) => application.status === 'PENDING').length} pending, {(opportunity.applications || []).filter((application) => application.status === 'APPROVED').length} approved</span>
                          <button onClick={() => bulkUpdateApplications(opportunity.id, { status: 'APPROVED', fromStatus: 'PENDING' })}>Approve pending</button>
                          <button onClick={() => editOpportunity(opportunity)}>Edit job</button>
                          <button className="secondary-button danger" onClick={() => deleteOpportunity(opportunity.id)}>Delete job</button>
                        </div>
                        {(opportunity.applications || []).map((application) => (
                          <div className="manager-row" key={application.id}>
                            <span>{application.applicant?.name || 'Applicant'} - {application.status}{application.contactPhone ? ` - ${application.contactPhone}` : ''}</span>
                            {application.note && <p>{application.note}</p>}
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'APPROVED' })}>Approve</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'DENIED' })}>Deny</button>
                            {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                            {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                            {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                            {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Staff')}>Add to team</button>}
                          </div>
                        ))}
                      </article>
                    )) : <p className="helper-text">No jobs match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('followers') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Followers</h3><span>{(org.followers || []).length}</span></div>
                  <div className="stack-list">
                    {(org.followers || []).length ? (org.followers || []).map((follow) => (
                      <article className="mini-row" key={follow.id}>
                        <strong>{follow.user?.name || 'Follower'}</strong>
                        <span>{follow.user?.email || org.name}</span>
                        <div className="manager-row">
                          {follow.user && <button onClick={() => startMessage(follow.user)}>Message</button>}
                          {follow.user && <button onClick={() => openProfile(follow.user)}>Profile</button>}
                          {follow.user && <button onClick={() => quickAddTeam(org.id, follow.user, 'Community Liaison')}>Add to team</button>}
                          <button className="secondary-button danger" onClick={() => removeOrganizationFollower(org.id, follow.userId)}>Remove follower</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No followers match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}
            </section>
          ))}
          {!scopedOrganizations.length && <section className="panel"><p className="helper-text">No managed masjids match this search.</p></section>}
        </section>

        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Followers</h2><span>{allFollowers.length}</span></div>
            <div className="stack-list">
              {allFollowers.slice(0, 25).map(({ org, follow }) => (
                <article className="mini-row" key={follow.id}>
                  <strong>{follow.user?.name || 'Follower'}</strong>
                  <span>{org.name}</span>
                  <div className="manager-row">
                    {follow.user && <button onClick={() => startMessage(follow.user)}>Message</button>}
                    {follow.user && <button onClick={() => openProfile(follow.user)}>Profile</button>}
                    {follow.user && <button onClick={() => quickAddTeam(org.id, follow.user, 'Community Liaison')}>Add to team</button>}
                    <button className="secondary-button danger" onClick={() => removeOrganizationFollower(org.id, follow.userId)}>Remove</button>
                  </div>
                </article>
              ))}
              {!allFollowers.length && <p className="helper-text">No followers match this dashboard filter yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Operator checklist</h2></div>
            <div className="stack-list">
              <article className="mini-row"><strong>1. Keep profile current</strong><span>Logo, address, links, prayer/iqamah times, and contact info.</span></article>
              <article className="mini-row"><strong>2. Review pending requests</strong><span>Approve event entries and volunteer/job applications before they pile up.</span></article>
              <article className="mini-row"><strong>3. Post weekly updates</strong><span>Announcements, classes, fundraisers, reminders, and volunteer calls.</span></article>
              <article className="mini-row"><strong>4. Attach imams and coordinators</strong><span>Add team members so users know who represents the masjid.</span></article>
            </div>
          </section>
          {user.accountType === 'ADMIN' && (
            <>
            <section className="panel">
              <div className="section-title"><h2>Platform Overview</h2><span>Admin</span></div>
              <div className="metric-grid compact">
                <article className="metric-card"><span>Users</span><strong>{adminStats.users}</strong><em>Community members</em></article>
                <article className="metric-card"><span>Masjids/MSAs</span><strong>{adminStats.masjids}</strong><em>Organization profiles</em></article>
                <article className="metric-card"><span>Imams</span><strong>{adminStats.imams}</strong><em>Religious service accounts</em></article>
                <article className="metric-card"><span>Posts</span><strong>{adminStats.posts}</strong><em>Organization content</em></article>
                <article className="metric-card"><span>Opportunities</span><strong>{adminStats.opportunities}</strong><em>Jobs and volunteer listings</em></article>
                <article className="metric-card"><span>Reports</span><strong>{adminStats.reports}</strong><em>Moderation queue</em></article>
              </div>
            </section>
            <section className="panel">
              <div className="section-title"><h2>Reports & Settings</h2><span>Launch</span></div>
              <div className="stack-list">
                <article className="mini-row"><strong>Reports queue</strong><span>No report model yet. Add backend reports before enabling public report actions.</span></article>
                <article className="mini-row"><strong>Role management</strong><span>Use the searchable role table below for admins, masjids, imams, businesses, and users.</span></article>
                <article className="mini-row"><strong>Production readiness</strong><span>Neon migration is committed. Render should run Prisma migrate/deploy before starting the API.</span></article>
                <article className="mini-row"><strong>Content oversight</strong><span>Use search plus dashboard filters to review posts, programs, jobs, volunteers, and applications.</span></article>
              </div>
            </section>
            <section className="panel">
              <div className="section-title"><h2>User Roles</h2></div>
              <div className="stack-list">
                {users.filter((person) => person.id !== user.id).filter((person) => !query || `${person.name} ${person.email} ${person.accountType} ${person.city || ''}`.toLowerCase().includes(query)).map((person) => (
                  <article className="mini-row" key={person.id}>
                    <strong>{person.name}</strong>
                    <span>{person.email}</span>
                    <select value={person.accountType} onChange={(event) => updateRole(person.id, event.target.value)}>
                      {['USER', 'MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'ADMIN'].map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button className="secondary-button danger" onClick={() => deleteUser(person.id)}>Delete user</button>
                  </article>
                ))}
              </div>
            </section>
            </>
          )}
        </aside>
      </div>
    </Page>
  );
}

function Page({ title, subtitle, action, children }) {
  return <section className="page"><div className="page-header"><div><p className="eyebrow">Ummah Connect</p><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="primary-button" onClick={action.onClick}><Plus size={18} />{action.label}</button>}</div>{children}</section>;
}

function TagRow({ tags = [] }) {
  if (!tags.length) return null;
  return <div className="tag-row">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user') || localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [messagePage, setMessagePage] = useState({ nextCursor: null, hasMore: false, loadingOlder: false });
  const [socket, setSocket] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserIdRef = useRef(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [profileSocial, setProfileSocial] = useState({ connections: [], followingMasjids: [], affiliatedMasjids: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [locationStatus, setLocationStatus] = useState('Waiting for browser location permission.');
  const [masjids, setMasjids] = useState([]);
  const [prayerTimes, setPrayerTimes] = useState(prayers);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  async function bootstrap() {
    if (!token()) return;
    const me = await api('/api/me');
    sessionStorage.setItem('user', JSON.stringify(me));
    setUser(me);
    await Promise.all([loadNetwork(), loadPosts(), loadEvents(), loadOpportunities(), loadMyOrganizations(me), loadProfileSocial(me.id), loadThreads(), loadNotificationMasjids()]);
  }

  async function loadNetwork() {
    if (!token()) return;
    const [loadedUsers, loadedConnections] = await Promise.all([api('/api/users'), api('/api/connections')]);
    setUsers(loadedUsers);
    setConnections(loadedConnections);
  }

  async function loadEvents() {
    const loadedEvents = await api('/api/events').catch(() => seedEvents);
    setEvents(loadedEvents);
  }

  async function loadPosts() {
    const loadedPosts = await api('/api/posts').catch(() => []);
    setPosts(loadedPosts);
  }

  async function loadOpportunities() {
    const loaded = await api('/api/opportunities').catch(() => []);
    setOpportunities(loaded);
  }

  async function loadMyOrganizations(currentUser = user) {
    if (!canManageOrgs(currentUser)) {
      setMyOrganizations([]);
      return;
    }
    const loaded = await api('/api/me/organizations').catch(() => []);
    setMyOrganizations(loaded);
  }

  async function loadProfileSocial(userId) {
    const loaded = await api(`/api/users/${userId}/social`).catch(() => ({ connections: [], followingMasjids: [], affiliatedMasjids: [] }));
    setProfileSocial({ connections: loaded.connections || [], followingMasjids: loaded.followingMasjids || [], affiliatedMasjids: loaded.affiliatedMasjids || [] });
  }

  async function loadNotificationMasjids() {
    const orgs = await api('/api/me/notification-masjids').catch(() => []);
    orgs.forEach(schedulePrayerNotification);
  }

  async function loadMessages(userId) {
    if (!userId) return;
    const loaded = await api(`/api/messages/${userId}?limit=30`);
    setMessages(loaded.messages || loaded);
    setMessagePage({ nextCursor: loaded.nextCursor || null, hasMore: Boolean(loaded.hasMore), loadingOlder: false });
  }

  async function loadThreads() {
    const loaded = await api('/api/messages/threads').catch(() => ({ threads: [] }));
    setThreads(Array.isArray(loaded) ? loaded : loaded.threads || []);
    if (loaded.onlineUserIds) setOnlineUserIds(loaded.onlineUserIds);
  }

  async function loadOlderMessages(userId) {
    if (!userId || !messagePage.hasMore || messagePage.loadingOlder) return;
    setMessagePage((page) => ({ ...page, loadingOlder: true }));
    const loaded = await api(`/api/messages/${userId}?limit=30&before=${encodeURIComponent(messagePage.nextCursor)}`);
    setMessages((current) => [...(loaded.messages || []), ...current]);
    setMessagePage({ nextCursor: loaded.nextCursor || null, hasMore: Boolean(loaded.hasMore), loadingOlder: false });
  }

  function mergeMessage(message) {
    setMessages((current) => {
      const exists = current.some((item) => item.id === message.id);
      if (exists) return current.map((item) => (item.id === message.id ? message : item));
      const inCurrentThread = selectedUserIdRef.current && [message.senderId, message.receiverId].includes(selectedUserIdRef.current);
      return inCurrentThread ? [...current, message] : current;
    });
  }

  async function reactToMessage(messageId, emoji) {
    const updated = await api(`/api/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
    mergeMessage(updated);
  }

  async function applyToOpportunity(id, form = {}) {
    await api(`/api/opportunities/${id}/apply`, { method: 'POST', body: JSON.stringify(form) });
    await loadOpportunities();
  }

  async function registerEvent(id) {
    await api(`/api/events/${id}/register`, { method: 'POST' });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function unregisterEvent(id) {
    await api(`/api/events/${id}/register`, { method: 'DELETE' });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function createOpportunity(organizationId, form) {
    await api(`/api/organizations/${organizationId}/opportunities`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function updateOpportunity(id, form) {
    await api(`/api/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOpportunities(), loadLocationData(location)]);
  }

  async function createPost(organizationId, form) {
    await api(`/api/organizations/${organizationId}/posts`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function updatePost(id, form) {
    await api(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function createEvent(form) {
    await api('/api/events', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadEvents(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function updateEvent(id, form) {
    await api(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadEvents(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await Promise.all([loadEvents(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deleteOpportunity(id) {
    if (!confirm('Delete this job or opportunity?')) return;
    await api(`/api/opportunities/${id}`, { method: 'DELETE' });
    await Promise.all([loadMyOrganizations(), loadOpportunities(), loadLocationData(location)]);
  }

  async function createOrganization(form) {
    const created = await api('/api/organizations', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadLocationData(location)]);
    return created;
  }

  async function updateOrganization(id, form) {
    const updated = await api(`/api/organizations/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadLocationData(location)]);
    if (selectedOrganization?.id === id) setSelectedOrganization({ ...selectedOrganization, ...updated });
  }

  async function addOrganizationPerson(id, form) {
    await api(`/api/organizations/${id}/people`, { method: 'POST', body: JSON.stringify(form) });
    const refreshed = await api(`/api/organizations/${id}`);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id) setSelectedOrganization(refreshed);
  }

  async function inviteOrganizationPerson(id, form) {
    const invited = await api(`/api/organizations/${id}/people/invite`, { method: 'POST', body: JSON.stringify(form) });
    const refreshed = await api(`/api/organizations/${id}`);
    await Promise.all([loadNetwork(), loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id) setSelectedOrganization(refreshed);
    return invited;
  }

  async function removeOrganizationPerson(id, userId) {
    await api(`/api/organizations/${id}/people/${userId}`, { method: 'DELETE' });
    const refreshed = await api(`/api/organizations/${id}`).catch(() => null);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id && refreshed) setSelectedOrganization(refreshed);
  }

  async function removeOrganizationFollower(id, userId) {
    if (!confirm('Remove this follower from the masjid?')) return;
    await api(`/api/organizations/${id}/followers/${userId}`, { method: 'DELETE' });
    const refreshed = await api(`/api/organizations/${id}`).catch(() => null);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadPosts()]);
    if (selectedOrganization?.id === id && refreshed) setSelectedOrganization(refreshed);
  }

  async function updateApplication(opportunityId, applicationId, data) {
    await api(`/api/opportunities/${opportunityId}/applications/${applicationId}`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function bulkUpdateApplications(opportunityId, data) {
    await api(`/api/opportunities/${opportunityId}/applications`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function updateRegistration(eventId, registrationId, status) {
    await api(`/api/events/${eventId}/registrations/${registrationId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function bulkUpdateRegistrations(eventId, data) {
    await api(`/api/events/${eventId}/registrations`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function unsendMessage(messageId) {
    const updated = await api(`/api/messages/${messageId}`, { method: 'DELETE' });
    mergeMessage(updated);
  }

  function sendTyping(receiverId, isTyping) {
    if (!socket || !receiverId) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { receiverId });
  }

  async function loadLocationData(nextLocation) {
    try {
      const [masjidData, prayerData] = await Promise.all([
        api(`/api/location/masjids?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}`),
        api(`/api/prayer-times?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}&date=${Math.floor(Date.now() / 1000)}`)
      ]);
      setMasjids(masjidData);
      const timings = prayerData.timings || {};
      setPrayerTimes(prayers.map((item) => ({ ...item, adhan: (timings[item.name] || item.adhan).slice(0, 5) })));
    } catch {
      setMasjids(seedOrganizations);
      setPrayerTimes(prayers);
    }
  }

  function schedulePrayerNotification(org) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iqamah = org.iqamahTimes || {};
    const now = new Date();
    const candidates = prayers.map((prayer) => {
      const time = iqamah[prayer.name] || prayer.iqamah;
      if (!time) return null;
      const [hour, minute] = String(time).split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      const when = new Date();
      when.setHours(hour, minute - 15, 0, 0);
      return when > now ? { prayer: prayer.name, when } : null;
    }).filter(Boolean);
    const next = candidates.sort((a, b) => a.when - b.when)[0];
    if (!next) return;
    const key = `${org.id}:${next.prayer}:${next.when.toDateString()}`;
    if (notificationTimers.has(key)) clearTimeout(notificationTimers.get(key));
    const timer = setTimeout(() => {
      showPrayerNotification(`${next.prayer} iqamah soon`, `${org.name} congregation starts in 15 minutes.`, key).catch(console.error);
      notificationTimers.delete(key);
    }, next.when.getTime() - now.getTime());
    notificationTimers.set(key, timer);
  }

  async function openOrganization(id) {
    const org = await api(`/api/organizations/${id}`);
    setSelectedOrganization(org);
    setTab('masjidProfile');
  }

  async function followOrganization(id, notifyPrayers = false) {
    if (notifyPrayers && 'Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return alert('Notifications were not enabled.');
    }
    await api(`/api/organizations/${id}/follow`, { method: 'POST', body: JSON.stringify({ notifyPrayers }) });
    const org = await api(`/api/organizations/${id}`);
    setSelectedOrganization(org);
    if (notifyPrayers) schedulePrayerNotification(org);
    await Promise.all([loadLocationData(location), loadPosts()]);
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is unavailable in this browser.');
      loadLocationData(defaultLocation);
      return;
    }
    setLocationStatus('Requesting browser GPS permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { label: 'Your location', latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(next);
        setLocationStatus('Location enabled. Nearby masjids and prayer times refreshed.');
        loadLocationData(next);
      },
      () => {
        setLocationStatus('Location permission denied. Showing Milton fallback data.');
        loadLocationData(defaultLocation);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  useEffect(() => { bootstrap().catch(() => logout()); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
  }, []);
  useEffect(() => { if (user) requestLocation(); }, [Boolean(user)]);
  useEffect(() => { selectedUserIdRef.current = selectedUser?.id || null; }, [selectedUser?.id]);
  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === 'visible') {
        loadLocationData(location);
        loadPosts();
      }
    }
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => document.removeEventListener('visibilitychange', refreshOnFocus);
  }, [location]);

  useEffect(() => {
    if (!user || !token()) return undefined;
    const nextSocket = io(API, { auth: { token: token() }, transports: ['websocket', 'polling'] });
    setSocket(nextSocket);
    nextSocket.on('message:new', (message) => {
      mergeMessage(message);
      loadThreads().catch(console.error);
    });
    nextSocket.on('message:update', (message) => {
      mergeMessage(message);
      loadThreads().catch(console.error);
    });
    nextSocket.on('presence:update', ({ onlineUserIds: ids = [] }) => setOnlineUserIds(ids));
    nextSocket.on('typing:update', ({ userId, isTyping }) => {
      setTypingUserIds((current) => {
        const filtered = current.filter((id) => id !== userId);
        return isTyping ? [...filtered, userId] : filtered;
      });
    });
    return () => nextSocket.disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !selectedUser?.id) return undefined;
    socket.emit('thread:join', { otherUserId: selectedUser.id });
    return () => socket.emit('thread:leave', { otherUserId: selectedUser.id });
  }, [socket, selectedUser?.id]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    setUsers([]);
    setPosts([]);
    setConnections([]);
    setMessages([]);
    setThreads([]);
    setSocket((activeSocket) => {
      activeSocket?.disconnect();
      return null;
    });
    setOnlineUserIds([]);
    setTypingUserIds([]);
  }

  function afterLogin(nextUser) {
    sessionStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    setTab('home');
    setTimeout(() => bootstrap().catch(console.error), 0);
  }

  function openProfile(person) {
    setViewedUser(person);
    loadProfileSocial(person.id).catch(console.error);
    setTab('profile');
  }

  function startMessage(person) {
    setSelectedUser(person);
    setTab('messages');
    loadMessages(person.id).catch(console.error);
  }

  function handleSearchSelect(result) {
    if (result.kind === 'User') {
      const person = users.find((item) => item.id === result.id);
      if (person) return openProfile(person);
    }
    if (result.kind === 'Masjid') return openOrganization(result.id).catch(console.error);
    if (result.kind === 'Job') setTab('jobs');
    else if (result.kind === 'Volunteer') setTab('volunteers');
    else setTab(result.tab);
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  const otherUsers = users.filter((person) => person.id !== user?.id);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const index = [
      ...users.map((person) => ({ id: person.id, kind: 'User', title: person.name, subtitle: `${person.accountType} ${person.city || ''} ${(person.skills || []).join(' ')}`, tab: 'network' })),
      ...posts.map((post) => ({ id: post.id, kind: 'Post', title: post.title, subtitle: `${post.organization?.name || ''} ${post.type} ${post.content || ''}`, tab: 'home' })),
      ...masjids.map((masjid) => ({ id: masjid.id, kind: 'Masjid', title: masjid.name, subtitle: `${masjid.address || ''} ${masjid.city || ''}`, tab: 'organizations' })),
      ...events.map((event) => ({ id: event.id, kind: 'Event', title: event.title, subtitle: `${event.description || ''} ${event.location || ''}`, tab: 'events' })),
      ...opportunities.map((item) => ({ id: item.id, kind: item.type === 'JOB' ? 'Job' : 'Volunteer', title: item.title, subtitle: `${item.organization?.name || ''} ${item.description || ''} ${item.location || ''} ${Array.isArray(item.skills) ? item.skills.join(' ') : item.skills || ''}`, tab: item.type === 'JOB' ? 'jobs' : 'volunteers' })),
      ...lectures.map((lecture) => ({ id: lecture.id, kind: 'Lecture', title: lecture.title, subtitle: `${lecture.speaker} ${lecture.category}`, tab: 'library' })),
      ...businesses.map((business) => ({ id: business.id, kind: 'Business', title: business.name, subtitle: `${business.category} ${business.city}`, tab: 'businesses' }))
    ];
    return index.filter((item) => `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 8);
  }, [searchQuery, users, posts, masjids, events, opportunities]);

  if (!user) return <div className="app auth-only"><AuthScreen onLogin={afterLogin} theme={theme} toggleTheme={toggleTheme} /></div>;

  const screens = {
    home: <HomeScreen user={user} posts={posts} masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} prayerTimes={prayerTimes} setTab={setTab} openOrganization={openOrganization} />,
    events: <EventsScreen user={user} events={events} loadEvents={loadEvents} myOrganizations={myOrganizations} registerEvent={registerEvent} unregisterEvent={unregisterEvent} />,
    post: <PostEventScreen setTab={setTab} createEvent={createEvent} myOrganizations={myOrganizations} />,
    organizations: <OrganizationsScreen masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />,
    masjidProfile: <MasjidProfileScreen organization={selectedOrganization} user={user} onFollow={followOrganization} onBack={() => setTab('organizations')} />,
    network: <NetworkScreen user={user} users={users} connections={connections} loadNetwork={loadNetwork} openProfile={openProfile} startMessage={startMessage} />,
    volunteers: <OpportunitiesScreen user={user} opportunities={opportunities} type="VOLUNTEER" applyToOpportunity={applyToOpportunity} title="Volunteer Marketplace" subtitle="Apply for masjid-approved service opportunities. Hours only count after masjid approval." />,
    jobs: <OpportunitiesScreen user={user} opportunities={opportunities} type="JOB" applyToOpportunity={applyToOpportunity} title="Jobs" subtitle="Separate job category for paid and professional Muslim community opportunities." />,
    library: <LibraryScreen />,
    businesses: <BusinessDirectoryScreen />,
    messages: <MessagesScreen users={otherUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} messages={messages} threads={threads} loadMessages={loadMessages} loadOlderMessages={loadOlderMessages} loadThreads={loadThreads} messagePage={messagePage} sendTyping={sendTyping} onlineUserIds={onlineUserIds} typingUserIds={typingUserIds} reactToMessage={reactToMessage} unsendMessage={unsendMessage} />,
    profile: <ProfileScreen user={user} viewedUser={viewedUser} onCloseViewed={() => { setViewedUser(null); loadProfileSocial(user.id); }} onSave={(updated) => { setUser(updated); sessionStorage.setItem('user', JSON.stringify(updated)); loadNetwork(); }} social={profileSocial} />,
    dashboard: isImamAccount(user) ? <ImamDashboard user={user} social={profileSocial} setTab={setTab} /> : <AdminScreen user={user} users={users} loadNetwork={loadNetwork} loadMyOrganizations={loadMyOrganizations} myOrganizations={myOrganizations} createOrganization={createOrganization} updateOrganization={updateOrganization} createOpportunity={createOpportunity} updateOpportunity={updateOpportunity} createPost={createPost} updatePost={updatePost} createEvent={createEvent} updateEvent={updateEvent} deletePost={deletePost} deleteEvent={deleteEvent} updateApplication={updateApplication} bulkUpdateApplications={bulkUpdateApplications} updateRegistration={updateRegistration} bulkUpdateRegistrations={bulkUpdateRegistrations} deleteOpportunity={deleteOpportunity} addOrganizationPerson={addOrganizationPerson} inviteOrganizationPerson={inviteOrganizationPerson} removeOrganizationPerson={removeOrganizationPerson} removeOrganizationFollower={removeOrganizationFollower} openProfile={openProfile} startMessage={startMessage} />
  };

  return (
    <>
      <Shell user={user} tab={tab} setTab={setTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onSearchSelect={handleSearchSelect} onLogout={logout} hasDashboardAccess={myOrganizations.length > 0 || isImamAccount(user)} theme={theme} toggleTheme={toggleTheme}>
        {screens[tab] || screens.home}
      </Shell>
      <section className="mobile-bottom-nav">
        {navItems.filter((item) => mobileNavKeys.includes(item.key)).filter((item) => !(isOrganizationAccount(user) && ['volunteers', 'jobs'].includes(item.key))).map((item) => {
          const Icon = item.icon;
          return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{item.label}</span></button>;
        })}
      </section>
      <div className="app-glow" />
    </>
  );
}
