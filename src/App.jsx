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
  Navigation,
  Plus,
  Search,
  Send,
  ShieldCheck,
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
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'profile', label: 'Profile', icon: UserCheck },
  { key: 'dashboard', label: 'Admin', icon: BarChart3 }
];

const mobileNavKeys = ['home', 'organizations', 'network', 'volunteers', 'messages', 'profile'];

function token() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function canManageOrgs(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function initials(name = 'UC') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || '';
}

function textToList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
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

function Shell({ user, tab, setTab, children, searchQuery, setSearchQuery, searchResults, onLogout }) {
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
                <button key={`${result.kind}-${result.id}`} onClick={() => { navigate(result.tab); setSearchQuery(''); }}>
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
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'post' : 'events')}><Plus size={18} /><span>Event</span></button>
          <button className="profile-chip" onClick={() => navigate('profile')}><span>{initials(user.name)}</span><strong>{user.name}</strong></button>
        </div>
      </header>
      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head"><strong>Menu</strong><button className="icon-button" onClick={() => setNavOpen(false)}><X size={20} /></button></div>
        <div className="drawer-profile">
          <button className="profile-avatar" onClick={() => navigate('profile')}>{initials(user.name)}</button>
          <div><strong>{user.name}</strong><span>{user.accountType}</span></div>
        </div>
        <NavigationList tab={tab} setTab={navigate} user={user} />
        <button className="mobile-logout" onClick={onLogout}><LogOut size={18} />Logout</button>
      </div>
      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} setTab={navigate} />
        <NavigationList tab={tab} setTab={navigate} user={user} />
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}

function NavigationList({ tab, setTab, user }) {
  return (
    <nav className="side-nav">
      {navItems.filter((item) => item.key !== 'dashboard' || canManageOrgs(user)).map((item) => {
        const Icon = item.icon;
        return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{item.label}</span></button>;
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout, setTab }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" />
      <div className="profile-body">
        <button className="profile-avatar" onClick={() => setTab('profile')}>{initials(user.name)}</button>
        <h2>{user.name}</h2>
        <p>{user.bio || 'Add your bio, experience, skills, education, languages, and interests.'}</p>
        <div className="profile-meta"><span>{user.accountType}</span><span>{user.city || 'No city yet'}</span></div>
        <button className="text-action" onClick={onLogout}><LogOut size={16} />Logout</button>
      </div>
    </section>
  );
}

function HomeScreen({ user, masjids, locationStatus, requestLocation, prayerTimes, setTab, openOrganization }) {
  return (
    <div className="content-grid">
      <section className="feed-column">
        <section className="composer">
          <div className="composer-main">
            <button onClick={() => setTab('profile')}>Complete your profile so other Muslims can find your skills, studies, and interests</button>
          </div>
          <div className="composer-actions">
            <button onClick={() => setTab('events')}><CalendarDays size={18} />Events</button>
            <button onClick={() => setTab('network')}><Users size={18} />Network</button>
            <button onClick={() => setTab('messages')}><Mail size={18} />Messages</button>
          </div>
        </section>
        <NearbyMasjids masjids={masjids.slice(0, 5)} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />
      </section>
      <aside className="right-rail">
        <PrayerWidget prayerTimes={prayerTimes} />
        <section className="panel">
          <div className="section-title"><h2>Account</h2><button onClick={() => setTab('profile')}>Edit</button></div>
          <p className="helper-text">Logged in as {user.name}. Network, messages, connections, events, and profile data are now backend-backed.</p>
        </section>
      </aside>
    </div>
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

function EventsScreen({ user, events, loadEvents, myOrganizations }) {
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
          return (
            <article className="event-card" key={event.id}>
              <div className="event-top"><span>Event</span>{canDelete && <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete</button>}</div>
              <h3>{event.title}</h3>
              <p>{event.description || 'No description yet.'}</p>
              <div className="meta-line"><CalendarDays size={16} />{event.startTime ? new Date(event.startTime).toLocaleString() : event.time || 'Time TBA'}</div>
              <div className="meta-line"><MapPin size={16} />{event.location || event.place || 'Location TBA'}</div>
              <div className="card-footer"><span>{event.createdBy?.name ? `By ${event.createdBy.name}` : 'Community event'}</span></div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}

function PostEventScreen({ setTab, loadEvents, loadMyOrganizations, myOrganizations }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '', organizationId: '', capacity: '', requiresApproval: false });
  async function submit(event) {
    event.preventDefault();
    await api('/api/events', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
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
  return (
    <Page title="Network" subtitle="Every registered account appears here automatically. Connect, view profiles, and message each other.">
      <div className="card-grid two">
        {users.map((person) => {
          const connection = connectionFor(person.id);
          const incoming = connection?.receiverId === user.id && connection.status === 'PENDING';
          return (
            <article className="person-card" key={person.id}>
              <button className="profile-avatar" onClick={() => openProfile(person)}>{initials(person.name)}</button>
              <div><h3>{person.name}</h3><p>{person.accountType} - {person.city || 'No city'}</p></div>
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
  const selectedThread = selectedUser ? threads.find((thread) => thread.user.id === selectedUser.id) : null;

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
    <Page title="Messages" subtitle="Start a conversation with any registered user and send backend-backed messages.">
      <div className="messaging-layout">
        <section className="panel inbox-list">
          {users.map((person) => {
            const thread = threads.find((item) => item.user.id === person.id);
            const isOnline = onlineUserIds.includes(person.id);
            return (
              <button key={person.id} className={selectedUser?.id === person.id ? 'active' : ''} onClick={() => chooseUser(person)}>
                <strong>{person.name}</strong>
                <span>{isOnline ? 'Online' : person.accountType}</span>
                <p>{thread?.lastMessage || person.city || 'No messages yet'}</p>
                {thread?.unread > 0 && <em>{thread.unread}</em>}
              </button>
            );
          })}
        </section>
        <section className="panel message-thread">
          {selectedUser ? (
            <>
              <div className="thread-head"><div className="org-logo">{initials(selectedUser.name)}</div><div><h2>{selectedUser.name}</h2><p>{onlineUserIds.includes(selectedUser.id) ? 'Online now' : selectedThread?.lastMessageAt ? `Last message ${new Date(selectedThread.lastMessageAt).toLocaleString()}` : 'Conversation'}</p></div></div>
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
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selectedUser.name}`} />
              <button className="primary-button" onClick={sendMessage}><Send size={18} />Send message</button>
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
  const events = organization.events || [];
  const opportunities = organization.opportunities || [];
  const jobs = opportunities.filter((item) => item.type === 'JOB');
  const volunteer = opportunities.filter((item) => item.type !== 'JOB');
  const iqamah = organization.iqamahTimes || {};
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
          <button className="primary-button" onClick={() => onFollow(organization.id, false)}>{organization.isFollowing ? 'Following' : 'Follow masjid'}</button>
          <button className="secondary-button" onClick={() => onFollow(organization.id, true)}>{organization.notifyPrayers ? 'Prayer notifications on' : 'Enable prayer notifications'}</button>
          <a className="secondary-button" href={directionsUrl(organization)} target="_blank" rel="noreferrer">Directions</a>
          {organization.website && <a className="secondary-button" href={organization.website} target="_blank" rel="noreferrer">Website</a>}
          {organization.donationUrl && <a className="secondary-button" href={organization.donationUrl} target="_blank" rel="noreferrer">Donate</a>}
        </div>
      </section>

      <div className="content-grid">
        <section className="feed-column">
          <section className="panel">
            <div className="section-title"><h2>Events</h2><span>{events.length}</span></div>
            <div className="stack-list">
              {events.map((event) => <article className="mini-row" key={event.id}><strong>{event.title}</strong><span>{new Date(event.startTime).toLocaleString()}</span><p>{event.description || event.location || 'No details yet.'}</p></article>)}
              {!events.length && <p className="helper-text">No events yet.</p>}
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
              {prayers.map((prayer) => <div key={prayer.name}><span>{prayer.name}</span><strong>{iqamah[prayer.name] || prayer.iqamah || 'TBD'}</strong></div>)}
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

function OpportunitiesScreen({ opportunities, type = 'VOLUNTEER', applyToOpportunity, title, subtitle }) {
  const visible = opportunities.filter((item) => item.type === type || (type === 'VOLUNTEER' && item.type === 'OPPORTUNITY'));
  const verifiedTotal = visible.reduce((sum, item) => sum + (item.applications?.[0]?.approvedHours || 0), 0);
  return (
    <Page title={title} subtitle={subtitle}>
      {type === 'VOLUNTEER' && (
        <section className="hours-summary panel">
          <div>
            <span>Verified Hours</span>
            <h2>{verifiedTotal}</h2>
            <p>Hours only count after the masjid approves them.</p>
          </div>
          <button className="secondary-button">Download PDF</button>
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
              <TagRow tags={[item.location || 'Location TBD', item.hours ? `${item.hours} hours` : item.type, ...(item.skills || [])]} />
            </div>
            <p>{item.description || 'No description yet.'}</p>
            <div className="check-row"><span>Status</span><strong>{application?.status || 'Not applied'}</strong></div>
            <div className="check-row"><span>Approved hours</span><strong>{application?.approvedHours || 0}</strong></div>
            <div className="card-footer">
              {application ? <span>{application.status}</span> : <button className="primary-button" onClick={() => applyToOpportunity(item.id)}>Apply</button>}
            </div>
          </article>
        );})}
        {!visible.length && <p className="helper-text">No {type.toLowerCase()} posts yet.</p>}
      </div>
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
    <Page title={editingSelf ? 'Your Profile' : profile.name} subtitle="Community profile with education, experience, skills, languages, interests, and hobbies.">
      {!editingSelf && <button className="secondary-button" onClick={onCloseViewed}>Back to your profile</button>}
      <section className="panel profile-detail">
        <div className="profile-hero"><div className="profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.name)}</div><div><h2>{profile.name}</h2><p>{profile.accountType} - {profile.city || 'No city yet'}</p></div></div>
        {editingSelf ? (
          <form className="profile-form" onSubmit={submit}>
            <div className="form-grid">
              {['name', 'city', 'location', 'availability', 'avatarUrl'].map((field) => <input key={field} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
            </div>
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

function AdminScreen({ user, users, loadNetwork, loadMyOrganizations, myOrganizations, createOrganization, updateOrganization, createOpportunity, updateApplication, updateRegistration, addOrganizationPerson, removeOrganizationPerson }) {
  const [orgForm, setOrgForm] = useState({ name: '', type: 'MASJID', city: '', address: '', website: '', description: '', latitude: '', longitude: '' });
  const [oppForm, setOppForm] = useState({ organizationId: '', type: 'VOLUNTEER', title: '', description: '', location: '', skills: '', hours: '' });
  const [peopleForm, setPeopleForm] = useState({ organizationId: '', userId: '', roleLabel: 'Imam' });
  const [editingOrgId, setEditingOrgId] = useState('');
  const [editOrgForm, setEditOrgForm] = useState({});
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
    await createOrganization(orgForm);
    setOrgForm({ name: '', type: 'MASJID', city: '', address: '', website: '', description: '', latitude: '', longitude: '' });
  }
  async function submitOpp(event) {
    event.preventDefault();
    const organizationId = oppForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createOpportunity(organizationId, oppForm);
    setOppForm({ organizationId, type: 'VOLUNTEER', title: '', description: '', location: '', skills: '', hours: '' });
  }
  async function submitPerson(event) {
    event.preventDefault();
    const organizationId = peopleForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId || !peopleForm.userId) return alert('Select a masjid and person first.');
    await addOrganizationPerson(organizationId, { userId: peopleForm.userId, roleLabel: peopleForm.roleLabel });
    setPeopleForm({ organizationId, userId: '', roleLabel: 'Imam' });
  }
  async function approveApplication(opportunityId, applicationId) {
    const approvedHours = Number(prompt('Approved volunteer hours?', '0') || 0);
    await updateApplication(opportunityId, applicationId, { status: 'APPROVED', approvedHours });
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
      isha: org.iqamahTimes?.Isha || ''
    });
  }
  async function submitEditOrg(event) {
    event.preventDefault();
    const iqamahTimes = {
      Fajr: editOrgForm.fajr,
      Dhuhr: editOrgForm.dhuhr,
      Asr: editOrgForm.asr,
      Maghrib: editOrgForm.maghrib,
      Isha: editOrgForm.isha
    };
    await updateOrganization(editingOrgId, { ...editOrgForm, iqamahTimes });
    setEditingOrgId('');
    setEditOrgForm({});
  }
  return (
    <Page title="Dashboard" subtitle="Manage masjid onboarding, attendees, jobs, opportunities, volunteers, and account roles.">
      <div className="content-grid">
        <section className="feed-column">
          <section className="panel">
            <div className="section-title"><h2>Create Masjid Profile</h2></div>
            <form className="profile-form" onSubmit={submitOrg}>
              <div className="form-grid">
                <input required placeholder="Masjid name" value={orgForm.name} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} />
                <select value={orgForm.type} onChange={(event) => setOrgForm({ ...orgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                <input placeholder="City" value={orgForm.city} onChange={(event) => setOrgForm({ ...orgForm, city: event.target.value })} />
                <input placeholder="Address" value={orgForm.address} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} />
                <input placeholder="Website" value={orgForm.website} onChange={(event) => setOrgForm({ ...orgForm, website: event.target.value })} />
                <input placeholder="Latitude" value={orgForm.latitude} onChange={(event) => setOrgForm({ ...orgForm, latitude: event.target.value })} />
                <input placeholder="Longitude" value={orgForm.longitude} onChange={(event) => setOrgForm({ ...orgForm, longitude: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={orgForm.description} onChange={(event) => setOrgForm({ ...orgForm, description: event.target.value })} />
              <button className="primary-button">Create profile</button>
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
              </div>
              <textarea placeholder="Description" value={oppForm.description} onChange={(event) => setOppForm({ ...oppForm, description: event.target.value })} />
              <button className="primary-button">Post</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Masjid Team</h2></div>
            <form className="profile-form" onSubmit={submitPerson}>
              <div className="form-grid">
                <select value={peopleForm.organizationId} onChange={(event) => setPeopleForm({ ...peopleForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <select value={peopleForm.userId} onChange={(event) => setPeopleForm({ ...peopleForm, userId: event.target.value })}>
                  <option value="">Select person</option>
                  {users.filter((person) => person.id !== user.id).map((person) => <option key={person.id} value={person.id}>{person.name} - {person.accountType}</option>)}
                </select>
                <input placeholder="Role, e.g. Imam, Khateeb, Coordinator" value={peopleForm.roleLabel} onChange={(event) => setPeopleForm({ ...peopleForm, roleLabel: event.target.value })} />
              </div>
              <button className="primary-button">Add to masjid profile</button>
            </form>
          </section>

          {myOrganizations.map((org) => (
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
                  <div className="form-grid">
                    {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((field) => <input key={field} placeholder={`${field} iqamah, e.g. 05:30`} value={editOrgForm[field] || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, [field]: event.target.value })} />)}
                  </div>
                  <div className="profile-actions">
                    <button className="primary-button">Save masjid profile</button>
                    <button className="secondary-button" type="button" onClick={() => setEditingOrgId('')}>Cancel</button>
                  </div>
                </form>
              )}
              <div className="stack-list">
                <article className="mini-row">
                  <strong>Profile team</strong>
                  {(org.people || []).length ? (org.people || []).map((person) => (
                    <div className="manager-row" key={person.id}>
                      <span>{person.user?.name || 'Person'} - {person.roleLabel}</span>
                      <button onClick={() => removeOrganizationPerson(org.id, person.userId)}>Remove</button>
                    </div>
                  )) : <p className="helper-text">No imams or team members attached yet.</p>}
                </article>
              </div>
              <div className="stack-list">
                {(org.events || []).map((event) => (
                  <article className="mini-row" key={event.id}>
                    <strong>{event.title}</strong>
                    <span>{(event.registrations || []).length} attendees</span>
                    {(event.registrations || []).map((registration) => (
                      <div className="manager-row" key={registration.id}>
                        <span>{registration.user?.name || 'User'} - {registration.status}</span>
                        <button onClick={() => updateRegistration(event.id, registration.id, 'APPROVED')}>Approve</button>
                        <button onClick={() => updateRegistration(event.id, registration.id, 'DENIED')}>Deny</button>
                        <button onClick={() => updateRegistration(event.id, registration.id, 'ATTENDED')}>Attended</button>
                      </div>
                    ))}
                  </article>
                ))}
                {(org.opportunities || []).map((opportunity) => (
                  <article className="mini-row" key={opportunity.id}>
                    <strong>{opportunity.title}</strong>
                    <span>{opportunity.type} - {(opportunity.applications || []).length} applicants</span>
                    {(opportunity.applications || []).map((application) => (
                      <div className="manager-row" key={application.id}>
                        <span>{application.applicant?.name || 'Applicant'} - {application.status} - {application.approvedHours || 0} hrs</span>
                        <button onClick={() => approveApplication(opportunity.id, application.id)}>Approve hours</button>
                        <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'DENIED' })}>Deny</button>
                        <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'COMPLETED', checkedOutAt: true })}>Complete</button>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>

        {user.accountType === 'ADMIN' && (
          <aside className="right-rail">
            <section className="panel">
              <div className="section-title"><h2>User Roles</h2></div>
              <div className="stack-list">
                {users.filter((person) => person.id !== user.id).map((person) => (
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
          </aside>
        )}
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

  async function bootstrap() {
    if (!token()) return;
    const me = await api('/api/me');
    sessionStorage.setItem('user', JSON.stringify(me));
    setUser(me);
    await Promise.all([loadNetwork(), loadEvents(), loadOpportunities(), loadMyOrganizations(me), loadProfileSocial(me.id), loadThreads(), loadNotificationMasjids()]);
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

  async function applyToOpportunity(id) {
    await api(`/api/opportunities/${id}/apply`, { method: 'POST' });
    await loadOpportunities();
  }

  async function createOpportunity(organizationId, form) {
    await api(`/api/organizations/${organizationId}/opportunities`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function createOrganization(form) {
    await api('/api/organizations', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadLocationData(location)]);
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

  async function removeOrganizationPerson(id, userId) {
    await api(`/api/organizations/${id}/people/${userId}`, { method: 'DELETE' });
    const refreshed = await api(`/api/organizations/${id}`).catch(() => null);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id && refreshed) setSelectedOrganization(refreshed);
  }

  async function updateApplication(opportunityId, applicationId, data) {
    await api(`/api/opportunities/${opportunityId}/applications/${applicationId}`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function updateRegistration(eventId, registrationId, status) {
    await api(`/api/events/${eventId}/registrations/${registrationId}`, { method: 'PUT', body: JSON.stringify({ status }) });
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
    await loadLocationData(location);
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
  }, []);
  useEffect(() => { if (user) requestLocation(); }, [Boolean(user)]);
  useEffect(() => { selectedUserIdRef.current = selectedUser?.id || null; }, [selectedUser?.id]);
  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === 'visible') loadLocationData(location);
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

  const otherUsers = users.filter((person) => person.id !== user?.id);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const index = [
      ...users.map((person) => ({ id: person.id, kind: 'User', title: person.name, subtitle: `${person.accountType} ${person.city || ''} ${(person.skills || []).join(' ')}`, tab: 'network' })),
      ...masjids.map((masjid) => ({ id: masjid.id, kind: 'Masjid', title: masjid.name, subtitle: `${masjid.address || ''} ${masjid.city || ''}`, tab: 'organizations' })),
      ...events.map((event) => ({ id: event.id, kind: 'Event', title: event.title, subtitle: `${event.description || ''} ${event.location || ''}`, tab: 'events' })),
      ...lectures.map((lecture) => ({ id: lecture.id, kind: 'Lecture', title: lecture.title, subtitle: `${lecture.speaker} ${lecture.category}`, tab: 'library' })),
      ...businesses.map((business) => ({ id: business.id, kind: 'Business', title: business.name, subtitle: `${business.category} ${business.city}`, tab: 'businesses' }))
    ];
    return index.filter((item) => `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 8);
  }, [searchQuery, users, masjids, events]);

  if (!user) return <div className="app auth-only"><AuthScreen onLogin={afterLogin} /></div>;

  const screens = {
    home: <HomeScreen user={user} masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} prayerTimes={prayerTimes} setTab={setTab} openOrganization={openOrganization} />,
    events: <EventsScreen user={user} events={events} loadEvents={loadEvents} myOrganizations={myOrganizations} />,
    post: <PostEventScreen setTab={setTab} loadEvents={loadEvents} loadMyOrganizations={loadMyOrganizations} myOrganizations={myOrganizations} />,
    organizations: <OrganizationsScreen masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />,
    masjidProfile: <MasjidProfileScreen organization={selectedOrganization} user={user} onFollow={followOrganization} onBack={() => setTab('organizations')} />,
    network: <NetworkScreen user={user} users={users} connections={connections} loadNetwork={loadNetwork} openProfile={openProfile} startMessage={startMessage} />,
    volunteers: <OpportunitiesScreen opportunities={opportunities} type="VOLUNTEER" applyToOpportunity={applyToOpportunity} title="Volunteer Marketplace" subtitle="Apply for masjid-approved service opportunities. Hours only count after masjid approval." />,
    jobs: <OpportunitiesScreen opportunities={opportunities} type="JOB" applyToOpportunity={applyToOpportunity} title="Jobs" subtitle="Separate job category for paid and professional Muslim community opportunities." />,
    library: <LibraryScreen />,
    businesses: <BusinessDirectoryScreen />,
    messages: <MessagesScreen users={otherUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} messages={messages} threads={threads} loadMessages={loadMessages} loadOlderMessages={loadOlderMessages} loadThreads={loadThreads} messagePage={messagePage} sendTyping={sendTyping} onlineUserIds={onlineUserIds} typingUserIds={typingUserIds} reactToMessage={reactToMessage} unsendMessage={unsendMessage} />,
    profile: <ProfileScreen user={user} viewedUser={viewedUser} onCloseViewed={() => { setViewedUser(null); loadProfileSocial(user.id); }} onSave={(updated) => { setUser(updated); sessionStorage.setItem('user', JSON.stringify(updated)); loadNetwork(); }} social={profileSocial} />,
    dashboard: <AdminScreen user={user} users={users} loadNetwork={loadNetwork} loadMyOrganizations={loadMyOrganizations} myOrganizations={myOrganizations} createOrganization={createOrganization} updateOrganization={updateOrganization} createOpportunity={createOpportunity} updateApplication={updateApplication} updateRegistration={updateRegistration} addOrganizationPerson={addOrganizationPerson} removeOrganizationPerson={removeOrganizationPerson} />
  };

  return (
    <>
      <Shell user={user} tab={tab} setTab={setTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onLogout={logout}>
        {screens[tab] || screens.home}
      </Shell>
      <section className="mobile-bottom-nav">
        {navItems.filter((item) => mobileNavKeys.includes(item.key)).map((item) => {
          const Icon = item.icon;
          return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{item.label}</span></button>;
        })}
      </section>
      <div className="app-glow" />
    </>
  );
}
